// src/app/nube.tsx
// Pestaña Nube (C4): Galería de fotos respaldadas en Supabase con suscripción Realtime.
// REGLA 6: Carga fotos vía URL firmada temporal (createSignedUrl) al ser un bucket privado.
// REGLA 9: Suscripción a Realtime con limpieza estricta (supabase.removeChannel) en useEffect.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Alert,
  Linking,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  fetchRemotePhotos,
  getSignedUrl,
  deleteCloudPhoto,
  type RemotePhoto,
} from '@/services/cloudPhotos';

interface RemotePhotoWithUrl extends RemotePhoto {
  signedUrl?: string;
}

export default function NubeScreen() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<RemotePhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Carga de fotos remotas y generación de URLs firmadas ─────────────────────

  const loadCloudPhotos = useCallback(async () => {
    try {
      const remoteList = await fetchRemotePhotos();

      // Generar URLs firmadas para cada foto remota (bucket privado)
      const withUrls: RemotePhotoWithUrl[] = await Promise.all(
        remoteList.map(async (photo) => {
          try {
            const url = await getSignedUrl(photo.storage_path);
            return { ...photo, signedUrl: url };
          } catch (err) {
            console.warn(`Error obteniendo signedUrl para ${photo.storage_path}:`, err);
            return photo;
          }
        })
      );

      setPhotos(withUrls);
    } catch (err: any) {
      console.error('[NubeScreen] Error cargando fotos remotas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ─── Suscripción en Tiempo Real (Realtime) con limpieza estricta ───────────────

  useEffect(() => {
    // Carga inicial
    loadCloudPhotos();

    // REGLA 9: Crear canal Realtime para escuchar cambios en la tabla 'photos'
    const channel = supabase
      .channel('public:photos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos' },
        (payload) => {
          console.log('[Realtime] Cambio detectado en public.photos:', payload.eventType);
          loadCloudPhotos();
        }
      )
      .subscribe();

    // Limpieza estricta de canal al desmontar el componente
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadCloudPhotos]);

  const onRefresh = () => {
    setRefreshing(true);
    loadCloudPhotos();
  };

  // ─── Eliminar foto de la nube ────────────────────────────────────────────────

  const handleDeleteRemote = (photo: RemotePhotoWithUrl) => {
    Alert.alert(
      'Eliminar de la Nube',
      '¿Deseas eliminar esta foto de Supabase Storage y de la base de datos remota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCloudPhoto(photo.storage_path, photo.client_id);
              setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
              Alert.alert('Éxito', 'Foto eliminada de la nube.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'No se pudo eliminar la foto remota.');
            }
          },
        },
      ]
    );
  };

  const openMap = (lat: number, lng: number) => {
    Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`);
  };

  // ─── Renderizado ─────────────────────────────────────────────────────────────

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={styles.loadingText}>Conectando con Supabase...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>☁️ Respaldo en la Nube</Text>
          <Text style={styles.headerSubtitle}>
            {user?.email} • {photos.length} fotos en Supabase
          </Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshBtnText}>↻ Recargar</Text>
        </Pressable>
      </View>

      {/* Lista de Fotos en la Nube */}
      {photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>☁️</Text>
          <Text style={styles.emptyTitle}>Sin fotos en la nube</Text>
          <Text style={styles.emptyText}>
            Tus fotos respaldadas aparecerán aquí. Ve a la pestaña Mapa y presiona &quot;Sincronizar&quot;
            en cualquier foto o &quot;Sincronizar todo&quot; para subirlas a Supabase.
          </Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0a7ea4" />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Imagen con Signed URL */}
              <View style={styles.imageWrapper}>
                {item.signedUrl ? (
                  <Image source={{ uri: item.signedUrl }} style={styles.image} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <ActivityIndicator size="small" color="#0a7ea4" />
                  </View>
                )}

                {/* Badge de fuente */}
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

                {/* Botón flotante eliminar */}
                <Pressable
                  style={styles.deleteCircle}
                  onPress={() => handleDeleteRemote(item)}
                >
                  <Text style={styles.deleteCircleText}>✕</Text>
                </Pressable>
              </View>

              {/* Metadatos */}
              <View style={styles.metaContainer}>
                <View style={styles.row}>
                  <Text style={styles.dateText}>
                    {new Date(item.taken_at).toLocaleDateString()} • {new Date(item.taken_at).toLocaleTimeString()}
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
    paddingTop: 56,
    paddingBottom: 14,
    backgroundColor: '#181818',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
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
  refreshBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshBtnText: {
    color: '#0a7ea4',
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    gap: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 56,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
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
});
