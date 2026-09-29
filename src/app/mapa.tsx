// src/app/mapa.tsx
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import type { GeoPhoto } from '@/types/geo';

export default function MapaScreen() {
  const { photos, removePhoto, clearAll } = useGeoPhotos();

  if (photos.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>🗺️</Text>
        <Text style={styles.emptyTitle}>Sin fotos registradas</Text>
        <Text style={styles.emptyText}>
          Ve a la pestaña 📷 Cámara para tomar tu primera foto geolocalizada.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📸 {photos.length} foto{photos.length !== 1 ? 's' : ''}</Text>
        <Pressable onPress={clearAll} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>🗑️ Borrar todo</Text>
        </Pressable>
      </View>

      {/* Galería */}
      <FlatList<GeoPhoto>
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.uri }} style={styles.image} />

            {/* Badge de fuente */}
            <View style={[
              styles.sourceBadge,
              item.source === 'gallery' ? styles.galleryBadge : styles.camBadge,
            ]}>
              <Text style={styles.sourceBadgeText}>
                {item.source === 'gallery' ? 'GAL' : 'CAM'}
              </Text>
            </View>

            {/* Coordenadas */}
            {item.coords ? (
              <View style={styles.coordsOverlay}>
                <Text style={styles.coordsText} numberOfLines={1}>
                  {item.coords.latitude.toFixed(4)}, {item.coords.longitude.toFixed(4)}
                </Text>
              </View>
            ) : (
              <View style={styles.coordsOverlay}>
                <Text style={styles.coordsTextNoGeo}>Sin ubicación</Text>
              </View>
            )}

            {/* Botón eliminar */}
            <Pressable
              style={styles.deleteBtn}
              onPress={() => removePhoto(item.id)}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  empty: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  clearBtn: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  grid: { paddingHorizontal: 8, paddingBottom: 32 },
  row: { gap: 8, marginBottom: 8 },
  card: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#222',
    position: 'relative',
  },
  image: { width: '100%', aspectRatio: 1 },
  sourceBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  camBadge: { backgroundColor: '#2563eb' },
  galleryBadge: { backgroundColor: '#9333ea' },
  sourceBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  coordsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  coordsText: { color: '#fff', fontSize: 10, fontFamily: 'monospace' },
  coordsTextNoGeo: { color: '#888', fontSize: 10, fontStyle: 'italic' },
  deleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
