// src/services/syncConflicts.ts

/**
 * Normaliza cualquier representación de fecha (ms, ISO string o Date) a milisegundos Epoch.
 */
export function toEpochMs(value: number | string | Date | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Regla de resolución de conflictos "Último cambio gana" (Last-Write-Wins).
 * Compara la fecha updatedAt local contra la fecha updated_at remota.
 * Retorna true únicamente si la versión remota es estrictamente más reciente que la local.
 */
export function remoteWins(
  localUpdatedAt: number | string | Date | null | undefined,
  remoteUpdatedAt: number | string | Date | null | undefined
): boolean {
  const localMs = toEpochMs(localUpdatedAt);
  const remoteMs = toEpochMs(remoteUpdatedAt);
  return remoteMs > localMs;
}
