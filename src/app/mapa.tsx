// src/app/mapa.tsx
import { useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import type { GeoPhoto } from '@/types/geo';

function getStaticMapUrl(lat: number, lng: number): string {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=600x250&markers=${lat},${lng},red-pushpin`;
}

function openInMaps(lat: number, lng: number) {
  Linking.openURL(
    `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
  );
}

export default function MapaScreen() {
  const { photos, removePhoto, clearAll } = useGeoPhotos();

  if (photos.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>mapa</Text>
        <Text style={styles.emptyTitle}>Sin fotos registradas</Text>
        <Text style={styles.emptyText}>
          Ve a la pestana Camera para tomar tu primera foto geolocalizada.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Fotos: {photos.length}
        </Text>
        <Pressable onPress={clearAll} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Borrar todo</Text>
        </Pressable>
      </View>

      <FlatList<GeoPhoto>
        data={photos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <PhotoCard item={item} onDelete={removePhoto} />
        )}
      />
    </View>
  );
}

function PhotoCard({
  item,
  onDelete,
}: {
  item: GeoPhoto;
  onDelete: (id: string) => void;
}) {
  const [mapError, setMapError] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.photoRow}>
        <Image source={{ uri: item.uri }} style={styles.photo} />
        <View style={[styles.sourceBadge, item.source === 'gallery' ? styles.galleryBadge : styles.camBadge]}>
          <Text style={styles.sourceBadgeText}>{item.source === 'gallery' ? 'GAL' : 'CAM'}</Text>
        </View>
        <Pressable style={styles.deleteBtn} onPress={() => onDelete(item.id)}>
          <Text style={styles.deleteBtnText}>X</Text>
        </Pressable>
      </View>

      {item.coords ? (
        <>
          <View style={styles.coordsBar}>
            <Text style={styles.coordsText}>
              LAT: {item.coords.latitude.toFixed(5)}  LNG: {item.coords.longitude.toFixed(5)}
            </Text>
          </View>

          <Pressable
            onPress={() => openInMaps(item.coords!.latitude, item.coords!.longitude)}
            style={styles.mapContainer}>
            {!mapError ? (
              <Image
                source={{ uri: getStaticMapUrl(item.coords.latitude, item.coords.longitude) }}
                style={styles.mapImage}
                resizeMode="cover"
                onError={() => setMapError(true)}
              />
            ) : (
              <View style={styles.mapFallback}>
                <Text style={styles.mapFallbackText}>Toca para ver en OpenStreetMap</Text>
              </View>
            )}
            <View style={styles.mapOverlay}>
              <Text style={styles.mapOverlayText}>Abrir en OpenStreetMap</Text>
            </View>
          </Pressable>
        </>
      ) : (
        <View style={styles.noLocationBar}>
          <Text style={styles.noLocationText}>Sin ubicacion GPS</Text>
        </View>
      )}

      <View style={styles.dateBar}>
        <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  empty: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyIcon: { fontSize: 64, color: '#fff' },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  clearBtn: { backgroundColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  clearBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 12, paddingBottom: 32, gap: 16 },
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#1a1a1a' },
  photoRow: { position: 'relative' },
  photo: { width: '100%', aspectRatio: 1.33 },
  sourceBadge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  camBadge: { backgroundColor: '#2563eb' },
  galleryBadge: { backgroundColor: '#9333ea' },
  sourceBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  deleteBtn: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  coordsBar: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#222' },
  coordsText: { color: '#00ff88', fontSize: 12, fontFamily: 'monospace' },
  mapContainer: { position: 'relative' },
  mapImage: { width: '100%', height: 200, backgroundColor: '#333' },
  mapFallback: { width: '100%', height: 200, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  mapFallbackText: { color: '#888', fontSize: 13 },
  mapOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 10, paddingVertical: 4, borderTopLeftRadius: 8 },
  mapOverlayText: { color: '#5b9bd5', fontSize: 11 },
  noLocationBar: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#222' },
  noLocationText: { color: '#888', fontSize: 12, fontStyle: 'italic' },
  dateBar: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#1a1a1a' },
  dateText: { color: '#666', fontSize: 11 },
});