// src/services/syncService.ts
// Motor central de sincronización bidireccional Offline-First.
// Regla inquebrantable de secuencia:
//   Paso 1: Bajar (Pull) por cursor (server_updated_at) resolviendo conflictos con remoteWins()
//   Paso 2: Subir (Push) registros pendientes (incluyendo borrados lógicos) con upsert onConflict:'client_id'
//           y markSynced usando exactamente el updatedAt subido.

import { photoRepository } from '@/repositories/photoRepository';
import {
  syncMetaRepository,
  type SyncItemError,
  type SyncResultMetadata,
} from '@/repositories/syncMetaRepository';
import {
  getSignedUrl,
  pullRemoteChangesBatch,
  removeStorageObject,
  uploadPhoto,
  upsertPhotoMetadata,
} from '@/services/cloudPhotos';
import {
  deletePhysicalPhoto,
  downloadPhotoFromUrl,
  localFileExists,
} from '@/services/photoStorage';
import { remoteWins, toEpochMs } from '@/services/syncConflicts';

const PULL_BATCH_SIZE = 200;
const MAX_PULL_BATCHES = 50;

export interface SyncProgress {
  phase: 'pull' | 'push';
  current: number;
  total: number;
}

export interface SyncCycleResult {
  timestamp: string;
  pulled: number;
  pushed: number;
  failed: number;
  errors: SyncItemError[];
  cursor: string;
}

let activeSyncPromise: Promise<SyncCycleResult> | null = null;

/**
 * Paso 1: Bajar (Pull) cambios desde Supabase posteriores al cursor guardado en `sync_meta`.
 * Avanza el cursor fila por fila durante la iteración.
 */
async function pullRemoteChanges(
  userId: string,
  errors: SyncItemError[]
): Promise<{ pulled: number; failedPulls: number; cursor: string }> {
  let cursor = await syncMetaRepository.getPullCursor(userId);
  let pulled = 0;
  let failedPulls = 0;

  for (let batchIdx = 0; batchIdx < MAX_PULL_BATCHES; batchIdx++) {
    const remoteRows = await pullRemoteChangesBatch(userId, cursor, PULL_BATCH_SIZE);
    if (remoteRows.length === 0) {
      break;
    }

    let abortedBatch = false;

    for (const remote of remoteRows) {
      try {
        const remoteUpdatedAtMs = toEpochMs(remote.updated_at);
        const remoteCreatedAtMs = toEpochMs(remote.taken_at || remote.created_at);
        const remoteDeletedAtMs = remote.deleted_at ? toEpochMs(remote.deleted_at) : null;

        const local = await photoRepository.getByClientId(remote.client_id);

        if (!local) {
          // Si ya fue borrada en remoto y no existe en local, no descargamos archivo físico
          if (remoteDeletedAtMs === null) {
            const signedUrl = await getSignedUrl(remote.storage_path);
            const localUri = await downloadPhotoFromUrl(signedUrl, remote.client_id);

            await photoRepository.createFromRemote({
              clientId: remote.client_id,
              uri: localUri,
              latitude: remote.latitude,
              longitude: remote.longitude,
              source: remote.source,
              notes: remote.note,
              isFavorite: remote.favorite,
              createdAtMs: remoteCreatedAtMs || Date.now(),
              remoteUpdatedAtMs: remoteUpdatedAtMs || Date.now(),
              remotePath: remote.storage_path,
              ownerId: remote.user_id,
              deletedAtMs: null,
            });
            pulled++;
          }
        } else if (remoteWins(local.updatedAt, remote.updated_at)) {
          // La versión remota es más nueva -> aplicar cambios e igualar fechas
          if (remoteDeletedAtMs !== null) {
            await photoRepository.applyRemoteUpdate(local.id, {
              latitude: remote.latitude,
              longitude: remote.longitude,
              notes: remote.note,
              isFavorite: remote.favorite,
              remotePath: remote.storage_path,
              ownerId: remote.user_id,
              remoteUpdatedAtMs,
              deletedAtMs: remoteDeletedAtMs,
            });
            await deletePhysicalPhoto(local.uri);
            pulled++;
          } else {
            let targetUri = local.uri;
            const hasLocalFile = await localFileExists(local.uri);
            if (!hasLocalFile || local.remotePath !== remote.storage_path) {
              const signedUrl = await getSignedUrl(remote.storage_path);
              targetUri = await downloadPhotoFromUrl(signedUrl, remote.client_id);
            }

            await photoRepository.applyRemoteUpdate(local.id, {
              uri: targetUri,
              latitude: remote.latitude,
              longitude: remote.longitude,
              notes: remote.note,
              isFavorite: remote.favorite,
              remotePath: remote.storage_path,
              ownerId: remote.user_id,
              remoteUpdatedAtMs,
              deletedAtMs: null,
            });
            pulled++;
          }
        }

        // Avanzar el cursor de progreso local fila por fila únicamente al completarse con éxito
        if (remote.server_updated_at) {
          cursor = remote.server_updated_at;
          await syncMetaRepository.setPullCursor(userId, cursor);
        }
      } catch (err: any) {
        failedPulls++;
        errors.push({
          clientId: remote.client_id,
          phase: 'pull',
          message: err?.message ?? 'Error al bajar registro remoto.',
          timestamp: new Date().toISOString(),
        });
        // Detenemos el bucle Pull en la fila fallida para que el cursor no la salte en el próximo intento
        abortedBatch = true;
        break;
      }
    }

    if (abortedBatch || remoteRows.length < PULL_BATCH_SIZE) {
      break;
    }
  }

  return { pulled, failedPulls, cursor };
}

/**
 * Sube un único registro local (activo o borrado lógico) a Supabase
 * preservando exactamente targetUpdatedAt al llamar a markSynced.
 */
async function pushSinglePhotoRecord(
  photo: Awaited<ReturnType<typeof photoRepository.getPendingSync>>[number],
  userId: string
): Promise<void> {
  const targetUpdatedAt =
    photo.updatedAt && photo.updatedAt > 0 ? photo.updatedAt : photo.createdAt;
  const takenAtIso = new Date(photo.createdAt).toISOString();
  const updatedAtIso = new Date(targetUpdatedAt).toISOString();

  if (photo.deletedAt !== null) {
    // Borrado lógico pendiente de sincronizar
    const deletedAtIso = new Date(photo.deletedAt).toISOString();

    if (photo.remotePath) {
      // 1. Subir marca deleted_at a Supabase primero
      await upsertPhotoMetadata({
        userId,
        clientId: photo.clientId,
        storagePath: photo.remotePath,
        latitude: photo.latitude,
        longitude: photo.longitude,
        note: photo.notes,
        favorite: Boolean(photo.isFavorite),
        source: photo.source,
        takenAt: takenAtIso,
        updatedAt: updatedAtIso,
        deletedAt: deletedAtIso,
      });

      // 2. Confirmar sincronización con el updatedAt exacto subido
      await photoRepository.markSynced(
        photo.id,
        photo.remotePath,
        targetUpdatedAt,
        userId
      );

      // 3. Destruir archivos físicos (bucket y local) solo tras confirmar la marca
      await removeStorageObject(photo.remotePath);
      await deletePhysicalPhoto(photo.uri);
    } else {
      // Foto eliminada localmente antes de haberse subido jamás a la nube
      await photoRepository.markSynced(photo.id, null, targetUpdatedAt, userId);
      await deletePhysicalPhoto(photo.uri);
    }
    return;
  }

  // Foto activa pendiente de subir o actualizar
  let storagePath = photo.remotePath;
  if (!storagePath) {
    const fileOk = await localFileExists(photo.uri);
    if (!fileOk) {
      throw new Error('Archivo físico local no encontrado para subir a Storage.');
    }
    storagePath = await uploadPhoto(userId, photo.clientId, photo.uri);
  }

  await upsertPhotoMetadata({
    userId,
    clientId: photo.clientId,
    storagePath,
    latitude: photo.latitude,
    longitude: photo.longitude,
    note: photo.notes,
    favorite: Boolean(photo.isFavorite),
    source: photo.source,
    takenAt: takenAtIso,
    updatedAt: updatedAtIso,
    deletedAt: null,
  });

  // Jamás usar Date.now() — usar exactamente el targetUpdatedAt recién subido
  await photoRepository.markSynced(photo.id, storagePath, targetUpdatedAt, userId);
}

/**
 * Paso 2: Subir (Push) todos los registros locales pendientes.
 * Maneja errores por elemento sin interrumpir el resto del lote.
 */
async function pushLocalPendingChanges(
  userId: string,
  errors: SyncItemError[],
  onProgress?: (progress: SyncProgress) => void
): Promise<{ pushed: number; failedPushes: number }> {
  const pendingPhotos = await photoRepository.getPendingSync(userId);
  const total = pendingPhotos.length;
  let pushed = 0;
  let failedPushes = 0;

  if (total === 0) {
    onProgress?.({ phase: 'push', current: 0, total: 0 });
    return { pushed: 0, failedPushes: 0 };
  }

  for (let i = 0; i < total; i++) {
    const photo = pendingPhotos[i];
    onProgress?.({ phase: 'push', current: i + 1, total });

    try {
      await pushSinglePhotoRecord(photo, userId);
      pushed++;
    } catch (err: any) {
      failedPushes++;
      console.warn(`[syncService] Fallo push foto id=${photo.id}:`, err);
      errors.push({
        clientId: photo.clientId,
        photoId: photo.id,
        phase: 'push',
        message: err?.message ?? 'Error al subir elemento a Supabase.',
        timestamp: new Date().toISOString(),
      });
      // Continúa el bucle: el registro problemático conserva syncedAt antiguo y reintentará luego
    }
  }

  return { pushed, failedPushes };
}

/**
 * Ejecuta el ciclo completo de sincronización secuencial: Pull -> Push.
 * Protegido por exclusión mutua para evitar ciclos concurrentes duplicados.
 */
async function executeSyncCycle(
  userId: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncCycleResult> {
  const errors: SyncItemError[] = [];

  await photoRepository.ensureSyncFields();

  // Paso 1: Bajar (Pull)
  // Si la consulta inicial a Supabase falla por red/servidor, registramos en sync_meta y relanzamos
  // para que TanStack Query aplique su política automática de reintentos.
  let pulled = 0;
  let failedPulls = 0;
  let cursor = await syncMetaRepository.getPullCursor(userId);

  try {
    const pullRes = await pullRemoteChanges(userId, errors);
    pulled = pullRes.pulled;
    failedPulls = pullRes.failedPulls;
    cursor = pullRes.cursor;
  } catch (err: any) {
    const pullErr: SyncItemError = {
      clientId: 'pull-batch',
      phase: 'pull',
      message: err?.message ?? 'Error consultando cambios remotos en Supabase.',
      timestamp: new Date().toISOString(),
    };
    errors.push(pullErr);
    await syncMetaRepository.saveLastSyncResult(userId, {
      timestamp: new Date().toISOString(),
      pulled: 0,
      pushed: 0,
      failed: 1,
      cursor,
    });
    await syncMetaRepository.saveErrors(userId, errors);
    throw err;
  }

  // Paso 2: Subir (Push)
  const { pushed, failedPushes } = await pushLocalPendingChanges(
    userId,
    errors,
    onProgress
  );

  const failed = failedPulls + failedPushes;
  const timestamp = new Date().toISOString();

  const summary: SyncResultMetadata = {
    timestamp,
    pulled,
    pushed,
    failed,
    cursor,
  };

  await syncMetaRepository.saveLastSyncResult(userId, summary);
  await syncMetaRepository.saveErrors(userId, errors);

  return {
    timestamp,
    pulled,
    pushed,
    failed,
    errors,
    cursor,
  };
}

export async function runSyncCycle(
  userId: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncCycleResult> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = executeSyncCycle(userId, onProgress).finally(() => {
    activeSyncPromise = null;
  });

  return activeSyncPromise;
}

/**
 * Sincroniza una foto puntual respetando la secuencia obligatoria: Pull primero, Push después.
 */
export async function syncSinglePhotoWithPullFirst(
  photoId: number,
  userId: string
): Promise<void> {
  if (activeSyncPromise) {
    await activeSyncPromise;
  }

  const run = (async (): Promise<SyncCycleResult> => {
    const errors: SyncItemError[] = [];
    const pullRes = await pullRemoteChanges(userId, errors);

    const freshPhoto = await photoRepository.getById(photoId);
    let pushed = 0;
    let failedPush = 0;

    if (freshPhoto) {
      try {
        await pushSinglePhotoRecord(freshPhoto, userId);
        pushed = 1;
      } catch (err: any) {
        failedPush = 1;
        errors.push({
          clientId: freshPhoto.clientId,
          photoId: freshPhoto.id,
          phase: 'push',
          message: err?.message ?? 'Error sincronizando la foto seleccionada.',
          timestamp: new Date().toISOString(),
        });
        await syncMetaRepository.saveErrors(userId, errors);
        throw err;
      }
    } else {
      throw new Error('La foto no existe en la base local.');
    }

    const summary: SyncResultMetadata = {
      timestamp: new Date().toISOString(),
      pulled: pullRes.pulled,
      pushed,
      failed: pullRes.failedPulls + failedPush,
      cursor: pullRes.cursor,
    };
    await syncMetaRepository.saveLastSyncResult(userId, summary);
    await syncMetaRepository.saveErrors(userId, errors);
    return {
      timestamp: summary.timestamp,
      pulled: summary.pulled,
      pushed: summary.pushed,
      failed: summary.failed,
      cursor: pullRes.cursor,
      errors,
    };
  })();

  activeSyncPromise = run.finally(() => {
    activeSyncPromise = null;
  });

  await activeSyncPromise;
}
