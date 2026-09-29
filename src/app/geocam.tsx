// app/(tabs)/geocam.tsx
import { View, Text, Pressable, Image, StyleSheet, Alert } from 'react-native';
import { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useCamera } from '@/hooks/useCamera';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useShake } from '@/hooks/useShake';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { PermissionPrimer } from '@/components/PermissionPrimer';

export default function GeoCamScreen() {
  const cam = useCamera();
  const geo = useGeoLocation({ watch: true });
  const { photos, addPhoto, clearAll } = useGeoPhotos();
  const lastPhoto = photos[0] ?? null;

  // R4: Al agitar el teléfono, preguntar si se borran todas las fotos
  useShake(() => {
    if (photos.length === 0) return;
    Alert.alert(
      'Borrar todas las fotos',
      '¿Estás seguro de que deseas eliminar todas las fotos registradas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar todo', style: 'destructive', onPress: clearAll },
      ]
    );
  });

  if (cam.permissionState === 'checking') {
    return <View style={styles.container} />;
  }

  if (cam.permissionState !== 'granted') {
    return (
      <PermissionPrimer
        title="Permiso de Cámara"
        description="GeoCam necesita acceso a tu cámara para tomar fotos geolocalizadas."
        state={cam.permissionState}
        onRequest={cam.requestPermission}
        onOpenSettings={cam.openSettings}
      />
    );
  }

  const handleCapture = async () => {
    const photo = await cam.takePhoto();
    if (!photo) return;

    // Degradación elegante: sin permiso de ubicación, coords queda en null
    const coords =
      geo.permission === 'granted' ? geo.coords ?? (await geo.getCurrent()) : null;

    addPhoto({
      id: String(Date.now()),
      uri: photo.uri,
      coords,
      source: 'camera',
      createdAt: Date.now(),
    });
  };

  // R2: Importar desde galería
  const handlePickGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const coords =
        geo.permission === 'granted' ? geo.coords ?? (await geo.getCurrent()) : null;

      addPhoto({
        id: String(Date.now()),
        uri: result.assets[0].uri,
        coords,
        source: 'gallery',
        createdAt: Date.now(),
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* CameraView sin hijos: los controles van como hermanos absolutos */}
      <CameraView
        ref={cam.cameraRef}
        style={StyleSheet.absoluteFill}
        facing={cam.facing}
        onCameraReady={cam.onCameraReady}
      />

      {/* Banner de ubicación: pedir en contexto sin bloquear la cámara */}
      {geo.permission !== 'granted' && geo.permission !== 'checking' && (
        <Pressable
          style={styles.locationBanner}
          onPress={
            geo.permission === 'blocked' ? geo.openSettings : geo.requestPermission
          }
        >
          <Text style={styles.bannerText}>
            {geo.permission === 'blocked'
              ? 'Ubicación bloqueada. Toca para abrir Ajustes'
              : 'Activa la ubicación para etiquetar tus fotos'}
          </Text>
        </Pressable>
      )}

      {/* Coordenadas en vivo */}
      {geo.coords && (
        <View style={styles.coordsBadge}>
          <Text style={styles.coordsText}>
            {geo.coords.latitude.toFixed(5)}, {geo.coords.longitude.toFixed(5)} ±
            {Math.round(geo.coords.accuracy ?? 0)} m
          </Text>
        </View>
      )}

      {/* Controles inferiores */}
      <View style={styles.controls}>
        {/* Miniatura de la última foto (distingue cámara vs galería) o botón de galería */}
        <View style={styles.sideSlot}>
          {lastPhoto ? (
            <Pressable onPress={handlePickGallery} style={styles.thumbWrapper}>
              <Image source={{ uri: lastPhoto.uri }} style={styles.thumbnail} />
              <View
                style={[
                  styles.sourceBadge,
                  lastPhoto.source === 'gallery' ? styles.galleryBadge : styles.camBadge,
                ]}
              >
                <Text style={styles.sourceBadgeText}>
                  {lastPhoto.source === 'gallery' ? 'GAL' : 'CAM'}
                </Text>
              </View>
            </Pressable>
          ) : (
            <Pressable style={styles.secondaryBtn} onPress={handlePickGallery}>
              <Text style={styles.btnText}>🖼️</Text>
            </Pressable>
          )}
        </View>

        {/* Botón de disparo */}
        <Pressable
          style={[styles.shutterBtn, cam.isCapturing && { opacity: 0.5 }]}
          onPress={handleCapture}
          disabled={cam.isCapturing}
        />

        {/* Botón girar cámara + botón extra galería */}
        <View style={styles.rightActions}>
          <Pressable style={styles.secondaryBtn} onPress={cam.toggleFacing}>
            <Text style={styles.btnText}>↻</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={handlePickGallery}>
            <Text style={styles.btnText}>＋</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  locationBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(234, 179, 8, 0.9)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bannerText: { color: '#000', fontWeight: '600', fontSize: 14 },
  coordsBadge: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  coordsText: { color: '#fff', fontSize: 12, fontFamily: 'monospace' },
  controls: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideSlot: { width: 64, alignItems: 'center' },
  rightActions: { flexDirection: 'row', gap: 10 },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  secondaryBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 22 },
  thumbWrapper: { position: 'relative' },
  thumbnail: { width: 52, height: 52, borderRadius: 8, borderWidth: 2, borderColor: '#fff' },
  sourceBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  camBadge: { backgroundColor: '#2563eb' },
  galleryBadge: { backgroundColor: '#9333ea' },
  sourceBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
});