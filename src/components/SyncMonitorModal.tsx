// src/components/SyncMonitorModal.tsx
// Monitor de Estado de Sincronización Offline-First (consume SQLite sync_meta + TanStack Query v5).

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { useNetworkOnline } from '@/hooks/useNetworkOnline';

interface SyncMonitorModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Nunca';
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return new Date(parsed).toLocaleString();
}

export function SyncMonitorModal({ visible, onClose }: SyncMonitorModalProps) {
  const { monitorState, forceSync, clearSyncErrors } = useGeoPhotos();
  const { isOnline, networkType } = useNetworkOnline();
  const [manualRunning, setManualRunning] = useState(false);

  const isBusy = manualRunning || monitorState.isSyncing;

  const getQueryStatusLabel = (): { label: string; color: string } => {
    if (!isOnline || monitorState.fetchStatus === 'paused') {
      return { label: 'Pausado (Sin conexión)', color: '#f59e0b' };
    }
    if (isBusy) {
      return { label: 'Sincronizando (Pull → Push)...', color: '#38bdf8' };
    }
    if (monitorState.status === 'pending') {
      return { label: 'Pendiente / Inicializando', color: '#a78bfa' };
    }
    if (monitorState.status === 'error') {
      return { label: 'Error en último intento', color: '#ef4444' };
    }
    return { label: 'En reposo (Sincronizado)', color: '#22c55e' };
  };

  const statusInfo = getQueryStatusLabel();

  const handleForceSync = async () => {
    setManualRunning(true);
    try {
      const result = await forceSync();
      if (result) {
        Alert.alert(
          'Ciclo Pull → Push completado',
          `Bajadas (Pull): ${result.pulled}\nSubidas (Push): ${result.pushed}\nFallidas: ${result.failed}`
        );
      }
    } catch (err: any) {
      Alert.alert(
        'No se pudo sincronizar',
        err?.message || 'Verifica tu conexión e inténtalo nuevamente.'
      );
    } finally {
      setManualRunning(false);
    }
  };

  const handleClearErrors = async () => {
    await clearSyncErrors();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header del Modal */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>📊 Monitor de Sincronización</Text>
            <Text style={styles.subtitle}>Estado de SQLite, sync_meta y TanStack Query v5</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Cerrar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Tarjeta Red y Motor */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CONECTIVIDAD Y MOTOR</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.rowKey}>Estado de red ({networkType ?? 'N/A'}):</Text>
              <View style={[styles.pill, isOnline ? styles.pillOnline : styles.pillOffline]}>
                <Text style={styles.pillText}>{isOnline ? '● Online' : '○ Offline'}</Text>
              </View>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.rowKey}>Motor Pull → Push:</Text>
              <Text style={[styles.rowValBold, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
            {monitorState.queryError && (
              <View style={styles.queryErrorBox}>
                <Text style={styles.queryErrorText}>
                  Error de red/consulta: {monitorState.queryError.message}
                </Text>
              </View>
            )}
          </View>

          {/* Tarjeta Cola Pendiente Local */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>COLA LOCAL EN SQLITE</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
                  {monitorState.pendingStats.totalPending}
                </Text>
                <Text style={styles.statCaption}>Total Pendientes</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#38bdf8' }]}>
                  {monitorState.pendingStats.pendingUploads}
                </Text>
                <Text style={styles.statCaption}>Subidas/Edición</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#f87171' }]}>
                  {monitorState.pendingStats.pendingDeletes}
                </Text>
                <Text style={styles.statCaption}>Borrados Lógicos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#22c55e' }]}>
                  {monitorState.pendingStats.syncedCount}
                </Text>
                <Text style={styles.statCaption}>Al Día</Text>
              </View>
            </View>
          </View>

          {/* Tarjeta Telemetría sync_meta */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>TELEMETRÍA (TABLA sync_meta)</Text>
            <View style={styles.metaLine}>
              <Text style={styles.rowKey}>Última ejecución:</Text>
              <Text style={styles.rowVal}>
                {formatDateTime(monitorState.lastSyncResult?.timestamp)}
              </Text>
            </View>

            <View style={styles.metaLine}>
              <Text style={styles.rowKey}>Resultado último ciclo:</Text>
              <Text style={styles.rowVal}>
                {monitorState.lastSyncResult
                  ? `↓ ${monitorState.lastSyncResult.pulled} bajadas • ↑ ${monitorState.lastSyncResult.pushed} subidas • ✕ ${monitorState.lastSyncResult.failed} fallos`
                  : 'Sin ejecuciones registradas'}
              </Text>
            </View>

            <View style={styles.cursorBox}>
              <Text style={styles.cursorLabel}>Cursor de bajada (server_updated_at):</Text>
              <Text style={styles.cursorValue} selectable>
                {monitorState.pullCursor ?? 'Sin cursor guardado (descarga inicial completa)'}
              </Text>
            </View>
          </View>

          {/* Botón Forzar Sincronización */}
          <Pressable
            onPress={handleForceSync}
            disabled={isBusy}
            style={[styles.forceBtn, isBusy && { opacity: 0.65 }]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.forceBtnText}>🔄 Forzar Sincronización Manual (Pull → Push)</Text>
            )}
          </Pressable>

          {/* Errores por elemento */}
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>
                ERRORES REGISTRADOS ({monitorState.errors.length})
              </Text>
              {monitorState.errors.length > 0 && (
                <Pressable onPress={handleClearErrors} style={styles.clearErrBtn}>
                  <Text style={styles.clearErrText}>Limpiar</Text>
                </Pressable>
              )}
            </View>

            {monitorState.errors.length === 0 ? (
              <Text style={styles.emptyErrors}>
                Sin errores de sincronización por elemento.
              </Text>
            ) : (
              monitorState.errors.map((err, index) => (
                <View key={`${err.clientId}-${err.timestamp}-${index}`} style={styles.errorRow}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.errorPhase}>
                      [{err.phase.toUpperCase()}] {err.clientId.slice(0, 12)}...
                    </Text>
                    <Text style={styles.errorTime}>
                      {new Date(err.timestamp).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Text style={styles.errorMsg}>{err.message}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: '#181818',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#1c1c1c',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#262626',
    gap: 10,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowKey: {
    color: '#aaa',
    fontSize: 13,
  },
  rowVal: {
    color: '#eee',
    fontSize: 13,
    flexShrink: 1,
  },
  rowValBold: {
    fontSize: 13,
    fontWeight: '700',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillOnline: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  pillOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  pillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  queryErrorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  queryErrorText: {
    color: '#fca5a5',
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#242424',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
  },
  statCaption: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 2,
  },
  metaLine: {
    gap: 2,
  },
  cursorBox: {
    backgroundColor: '#242424',
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  cursorLabel: {
    color: '#888',
    fontSize: 11,
  },
  cursorValue: {
    color: '#38bdf8',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  forceBtn: {
    backgroundColor: '#0a7ea4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forceBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  clearErrBtn: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  clearErrText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyErrors: {
    color: '#666',
    fontSize: 13,
    fontStyle: 'italic',
  },
  errorRow: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 10,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorPhase: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  errorTime: {
    color: '#888',
    fontSize: 11,
  },
  errorMsg: {
    color: '#eee',
    fontSize: 12,
  },
});
