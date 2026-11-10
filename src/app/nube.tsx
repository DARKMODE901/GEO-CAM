// src/app/nube.tsx
// Pestaña Nube: Feed remoto paginado por cursor con TanStack Query v5 + Persistencia Offline + Realtime.
// Reglas aplicadas:
// - useInfiniteQuery con initialPageParam: null as string | null y paginación por cursor (created_at < último)
// - Comprobación de carga v5 con status === 'pending' (sin 'loading' ni cacheTime)
// - Validación hasNextPage && !isFetchingNextPage en onEndReached
// - Suscripción Realtime con limpieza estricta (supabase.removeChannel)
// - Borrado lógico sincronizado (sin comandos DELETE directos)

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SyncMonitorModal } from '@/components/SyncMonitorModal';
import { useAuth } from '@/context/AuthContext';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useNetworkOnline } from '@/hooks/useNetworkOnline';
import { usePostsFeed } from '@/hooks/usePostsFeed';
import { supabase } from '@/lib/supabase';
import { photoRepository } from '@/repositories/photoRepository';
import {
  softDeleteRemotePhoto,
  type RemotePhotoFeedItem,
} from '@/services/cloudPhotos';

export default function NubeScreen() {
  const { user } = useAuth();
  const { monitorState, removePhoto } = useGeoPhotos();
  const { isOnline } = useNetworkOnline();
  const queryClient = useQueryClient();

  const [searchText, setSearchText] = useState('');
  const [monitorOpen, setMonitorOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(searchText, 400);

  const {
    items,
    status,
    fetchStatus,
    error,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
    fetchNextPage,
    refetch,
  } = usePostsFeed(user?.id, debouncedSearch);

  // Suscripción en Tiempo Real (Realtime) con limpieza estricta
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('public:photos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos' },
        (payload) => {
          console.log('[Realtime] Cambio detectado en public.photos:', payload.eventType);
          void queryClient.invalidateQueries({ queryKey: ['posts-feed'] });
          void queryClient.invalidateQueries({ queryKey: ['sync'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const handleRefresh = () => {
    if (!isOnline) {
      Alert.alert(
        'Modo Offline',
        'No hay conexión a internet. Estás visualizando el muro guardado en caché persistente.'
      );
      return;
    }
    void refetch();
  };

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      if (isOnline) {
        void fetchNextPage();
      }
    }
  };

  const handleDeleteRemote = (photo: RemotePhotoFeedItem) => {
    Alert.alert(
      'Eliminar foto (Borrado Lógico)',
      'La foto se marcará como eliminada y se limpiará de tu dispositivo y de la nube tras sincronizar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const local = await photoRepository.getByClientId(photo.client_id);
              if (local) {
                await removePhoto(local.id);
              } else {
                if (!isOnline) {
                  Alert.alert(
                    'Sin conexión',
                    'Este elemento aún no existe localmente; conéctate para eliminarlo de la nube.'
                  );
                  return;
                }
                await softDeleteRemotePhoto(photo);
                await queryClient.invalidateQueries({ queryKey: ['sync'] });
              }
              await queryClient.invalidateQueries({ queryKey: ['posts-feed'] });
            } catch (err: any) {
              Alert.alert(
                'Error',
                err?.message || 'No se pudo procesar el borrado lógico.'
              );
            }
          },
        },
      ]
    );
  };

  const openMap = (lat: number, lng: number) => {
    Linking.openURL(
      `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
    );
  };

  const pendingBadgeCount = monitorState.pendingStats.totalPending;
  const hasErrors = monitorState.errors.length > 0;

  // Estado inicial pendiente en TanStack Query v5 (status === 'pending')
  if (status === 'pending' && fetchStatus !== 'paused' && items.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={styles.loadingText}>Cargando feed remoto desde Supabase...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>☁️ Feed en la Nube</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {user?.email} • {items.length} cargadas {hasNextPage ? '(hay más)' : ''}
          </Text>
        </View>

        <View style={styles.headerButtons}>
          <Pressable
            onPress={() => setMonitorOpen(true)}
            style={[
              styles.monitorBtn,
              hasErrors
                ? styles.monitorBtnError
                : pendingBadgeCount > 0
                ? styles.monitorBtnPending
                : null,
            ]}
          >
            <Text style={styles.monitorBtnText}>
              {monitorState.isSyncing
                ? '⏳ Sync'
                : pendingBadgeCount > 0
                ? `📊 Sync (${pendingBadgeCount})`
                : hasErrors
                ? '⚠️ Monitor'
                : '📊 Sync ✓'}
            </Text>
          </Pressable>

          <Pressable onPress={handleRefresh} style={styles.refreshBtn}>
            <Text style={styles.refreshBtnText}>↻</Text>
          </Pressable>
        </View>
      </View>

      {/* Banner Offline Persistente */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📴 Sin conexión — Mostrando caché persistente offline
          </Text>
        </View>
      )}

      {/* Barra de Búsqueda Debounced */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nota o fuente (camera / gallery)..."
          placeholderTextColor="#777"
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => setSearchText('')} style={styles.clearSearchBtn}>
            <Text style={styles.clearSearchText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Banner de error si falló la consulta remota */}
      {status === 'error' && error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            ⚠️ Error al consultar la nube: {error.message}
          </Text>
        </View>
      )}

      {/* Lista de Fotos Remotas con Paginación por Cursor */}
      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>☁️</Text>
          <Text style={styles.emptyTitle}>
            {debouncedSearch
              ? 'Sin resultados para tu búsqueda'
              : !isOnline && status === 'pending'
              ? 'Feed remoto sin caché offline aún'
              : 'Sin fotos en la nube'}
          </Text>
          <Text style={styles.emptyText}>
            {debouncedSearch
              ? `No se encontraron publicaciones que coincidan con "${debouncedSearch}".`
              : !isOnline && status === 'pending'
              ? 'Conéctate una vez a internet para descargar y persistir el muro remoto en caché.'
              : 'Tus fotos sincronizadas aparecerán aquí automáticamente gracias a la cola Pull → Push en segundo plano.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.client_id}
          contentContainerStyle={styles.list}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={handleRefresh}
              tintColor="#0a7ea4"
            />
          }
          ListFooterComponent={
            <View style={styles.footerContainer}>
              {isFetchingNextPage ? (
                <View style={styles.footerRow}>
                  <ActivityIndicator size="small" color="#0a7ea4" />
                  <Text style={styles.footerText}>Cargando más publicaciones...</Text>
                </View>
              ) : !hasNextPage ? (
                <Text style={styles.footerEndText}>— Fin del muro remoto —</Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.imageWrapper}>
                {item.signedUrl ? (
                  <Image
                    source={{ uri: item.signedUrl }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderOfflineText}>
                      {isOnline ? 'Cargando vista previa...' : 'Sin vista previa en caché'}
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.sourceBadge,
                    item.source === 'gallery' ? styles.galleryBadge : styles.camBadge,
                  ]}
                >
                  <Text style={styles.sourceBadgeText}>
                    {item.source === 'gallery' ? 'GAL' : 'CAM'}
                  </Text>
                </View>

                <Pressable
                  style={styles.deleteCircle}
                  onPress={() => handleDeleteRemote(item)}
                >
                  <Text style={styles.deleteCircleText}>✕</Text>
                </Pressable>
              </View>

              <View style={styles.metaContainer}>
                <View style={styles.row}>
                  <Text style={styles.dateText}>
                    {new Date(item.taken_at).toLocaleDateString()} •{' '}
                    {new Date(item.taken_at).toLocaleTimeString()}
                  </Text>
                  {item.favorite && <Text style={styles.favoriteBadge}>⭐ Favorita</Text>}
                </View>

                {item.latitude !== null && item.longitude !== null && (
                  <Pressable
                    style={styles.coordsRow}
                    onPress={() => openMap(item.latitude!, item.longitude!)}
                  >
                    <Text style={styles.coordsText}>
                      📍 {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                    </Text>
                    <Text style={styles.mapLink}>Ver mapa ↗</Text>
                  </Pressable>
                )}

                {item.note ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteText}>📝 {item.note}</Text>
                  </View>
                ) : null}

                <Text style={styles.storagePathText} numberOfLines={1}>
                  📁 {item.storage_path}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Monitor de Estado de Sincronización */}
      <SyncMonitorModal visible={monitorOpen} onClose={() => setMonitorOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: '#181818',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    gap: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monitorBtn: {
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  monitorBtnPending: {
    backgroundColor: '#92400e',
  },
  monitorBtnError: {
    backgroundColor: '#7f1d1d',
  },
  monitorBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  refreshBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshBtnText: {
    color: '#0a7ea4',
    fontSize: 14,
    fontWeight: '700',
  },
  offlineBanner: {
    backgroundColor: '#78350f',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#92400e',
  },
  offlineBannerText: {
    color: '#fde68a',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b1b1b',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2c2c2c',
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 10,
    fontSize: 13,
  },
  clearSearchBtn: {
    padding: 6,
  },
  clearSearchText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.16)',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorBannerText: {
    color: '#fca5a5',
    fontSize: 12,
  },
  list: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 52,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#1c1c1c',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1.4,
    backgroundColor: '#222',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  placeholderOfflineText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  sourceBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  camBadge: { backgroundColor: '#2563eb' },
  galleryBadge: { backgroundColor: '#9333ea' },
  sourceBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  deleteCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteCircleText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: 'bold',
  },
  metaContainer: {
    padding: 14,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    color: '#888',
    fontSize: 12,
  },
  favoriteBadge: {
    color: '#eab308',
    fontSize: 12,
    fontWeight: '600',
  },
  coordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#262626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  coordsText: {
    color: '#00ff88',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  mapLink: {
    color: '#5b9bd5',
    fontSize: 12,
    fontWeight: '600',
  },
  noteBox: {
    backgroundColor: '#262626',
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0a7ea4',
  },
  noteText: {
    color: '#ddd',
    fontSize: 13,
  },
  storagePathText: {
    color: '#555',
    fontSize: 11,
    marginTop: 2,
  },
  footerContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: '#888',
    fontSize: 12,
  },
  footerEndText: {
    color: '#555',
    fontSize: 12,
  },
});
