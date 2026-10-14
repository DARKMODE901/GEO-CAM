// src/app/mapa.tsx
import { useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { useAuth } from '@/context/AuthContext';
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
  const { user, signOut } = useAuth();
  const {
    photos,
    albums,
    filter,
    setFilter,
    removePhoto,
    clearAll,
    updateNotes,
    toggleFavorite,
    setAlbum,
    createAlbum,
    syncPhoto,
    syncAllPhotos,
  } = useGeoPhotos();

  // Estados para modales de notas, asignación de álbum y creación de álbum
  const [selectedPhotoForNote, setSelectedPhotoForNote] = useState<GeoPhoto | null>(null);
  const [noteText, setNoteText] = useState('');

  const [selectedPhotoForAlbum, setSelectedPhotoForAlbum] = useState<GeoPhoto | null>(null);

  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');

  // Estados de sincronización (T5 y C2)
  const [syncingPhotoId, setSyncingPhotoId] = useState<number | null>(null);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const handleOpenNoteModal = (photo: GeoPhoto) => {
    setSelectedPhotoForNote(photo);
    setNoteText(photo.notes ?? '');
  };

  const handleSaveNote = async () => {
    if (selectedPhotoForNote) {
      await updateNotes(selectedPhotoForNote.id, noteText.trim());
      setSelectedPhotoForNote(null);
    }
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) {
      Alert.alert('Error', 'El nombre del álbum no puede estar vacío.');
      return;
    }
    await createAlbum(newAlbumName.trim(), newAlbumDesc.trim() || undefined);
    setNewAlbumName('');
    setNewAlbumDesc('');
    setIsCreatingAlbum(false);
  };

  const handleAssignAlbum = async (albumId: number | null) => {
    if (selectedPhotoForAlbum) {
      await setAlbum(selectedPhotoForAlbum.id, albumId);
      setSelectedPhotoForAlbum(null);
    }
  };

  // Sincronización individual (T5)
  const handleSyncSingle = async (photoId: number) => {
    setSyncingPhotoId(photoId);
    try {
      await syncPhoto(photoId);
      Alert.alert('Sincronización Exitosa', 'Foto y metadatos respaldados en Supabase.');
    } catch (err: any) {
      Alert.alert('Error de sincronización', err?.message || 'No se pudo sincronizar la foto.');
    } finally {
      setSyncingPhotoId(null);
    }
  };

  // Sincronización masiva con progreso (C2)
  const handleSyncAll = async () => {
    const pendingCount = photos.filter((p) => p.syncStatus !== 'synced').length;
    if (pendingCount === 0) {
      Alert.alert('Al día', 'Todas las fotos ya están sincronizadas con la nube.');
      return;
    }

    setIsBatchSyncing(true);
    setBatchProgress({ current: 0, total: pendingCount });

    try {
      const result = await syncAllPhotos((current, total) => {
        setBatchProgress({ current, total });
      });

      Alert.alert(
        'Sincronización Completada',
        `Se sincronizaron exitosamente ${result.synced} fotos.${result.failed > 0 ? ` Fallaron: ${result.failed}` : ''}`
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Ocurrió un error en la sincronización masiva.');
    } finally {
      setIsBatchSyncing(false);
      setBatchProgress(null);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Deseas cerrar tu sesión actual de Supabase?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Error al cerrar sesión.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Barra de usuario y cierre de sesión */}
      <View style={styles.userBar}>
        <Text style={styles.userEmail} numberOfLines={1}>
          👤 {user?.email ?? 'Usuario'}
        </Text>
        <Pressable onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutBtnText}>Salir</Text>
        </Pressable>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Fotos Offline</Text>
          <Text style={styles.headerSubtitle}>
            {photos.length} en SQLite • {photos.filter((p) => p.syncStatus === 'synced').length} en Nube
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleSyncAll}
            disabled={isBatchSyncing}
            style={[styles.syncAllBtn, isBatchSyncing && { opacity: 0.6 }]}>
            <Text style={styles.syncAllBtnText}>
              {isBatchSyncing ? '⏳ Subiendo...' : '☁️ Sync Todo'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setIsCreatingAlbum(true)}
            style={styles.addAlbumBtn}>
            <Text style={styles.addAlbumBtnText}>+ Álbum</Text>
          </Pressable>
          {photos.length > 0 && (
            <Pressable onPress={clearAll} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Borrar</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Banner de progreso de sincronización masiva (C2) */}
      {isBatchSyncing && batchProgress && (
        <View style={styles.progressBanner}>
          <ActivityIndicator size="small" color="#00ff88" />
          <Text style={styles.progressBannerText}>
            Sincronizando {batchProgress.current} de {batchProgress.total} fotos con Supabase...
          </Text>
        </View>
      )}

      {/* Barra de Filtros (Todas, Favoritas, Álbumes) */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <Pressable
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}>
            <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
              Todas
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, filter === 'favorites' && styles.filterChipActive]}
            onPress={() => setFilter('favorites')}>
            <Text style={[styles.filterChipText, filter === 'favorites' && styles.filterChipTextActive]}>
              ⭐ Favoritas
            </Text>
          </Pressable>

          {albums.map((alb) => (
            <Pressable
              key={alb.id}
              style={[styles.filterChip, filter === alb.id && styles.filterChipActive]}
              onPress={() => setFilter(alb.id)}>
              <Text style={[styles.filterChipText, filter === alb.id && styles.filterChipTextActive]}>
                📁 {alb.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Lista de Fotos o Estado Vacío */}
      {photos.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyTitle}>Sin fotos registradas</Text>
          <Text style={styles.emptyText}>
            {filter === 'favorites'
              ? 'No tienes fotos marcadas como favoritas aún.'
              : typeof filter === 'number'
              ? 'Este álbum aún no tiene fotos.'
              : 'Ve a la pestaña Cámara para capturar tu primera foto geolocalizada con persistencia offline y respaldo en Supabase.'}
          </Text>
        </View>
      ) : (
        <FlatList<GeoPhoto>
          data={photos}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const albumName = albums.find((a) => a.id === item.albumId)?.name;
            return (
              <PhotoCard
                item={item}
                albumName={albumName}
                onDelete={removePhoto}
                onToggleFavorite={toggleFavorite}
                onOpenNote={handleOpenNoteModal}
                onOpenAlbumSelect={(photo) => setSelectedPhotoForAlbum(photo)}
                onSync={handleSyncSingle}
                isSyncing={syncingPhotoId === item.id}
              />
            );
          }}
        />
      )}

      {/* Modal para Editar Notas (Migración 2) */}
      <Modal visible={Boolean(selectedPhotoForNote)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>📝 Notas de la Foto</Text>
            <Text style={styles.modalSubtitle}>Agrega detalles o comentarios a esta captura</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Escribe una nota aquí..."
              placeholderTextColor="#888"
              multiline
              numberOfLines={4}
              value={noteText}
              onChangeText={setNoteText}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setSelectedPhotoForNote(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalSaveBtn]} onPress={handleSaveNote}>
                <Text style={styles.modalSaveText}>Guardar Nota</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Crear Álbum */}
      <Modal visible={isCreatingAlbum} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>📁 Nuevo Álbum</Text>
            <TextInput
              style={styles.singleInput}
              placeholder="Nombre del álbum (ej. Vacaciones)"
              placeholderTextColor="#888"
              value={newAlbumName}
              onChangeText={setNewAlbumName}
            />
            <TextInput
              style={styles.singleInput}
              placeholder="Descripción (opcional)"
              placeholderTextColor="#888"
              value={newAlbumDesc}
              onChangeText={setNewAlbumDesc}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setIsCreatingAlbum(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalSaveBtn]} onPress={handleCreateAlbum}>
                <Text style={styles.modalSaveText}>Crear</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Asignar Álbum a Foto */}
      <Modal visible={Boolean(selectedPhotoForAlbum)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mover a Álbum</Text>
            <Pressable
              style={styles.albumOption}
              onPress={() => handleAssignAlbum(null)}>
              <Text style={styles.albumOptionText}>Ninguno (Sin álbum)</Text>
            </Pressable>
            {albums.map((alb) => (
              <Pressable
                key={alb.id}
                style={styles.albumOption}
                onPress={() => handleAssignAlbum(alb.id)}>
                <Text style={styles.albumOptionText}>📁 {alb.name}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.modalBtn, styles.modalCancelBtn, { marginTop: 12 }]}
              onPress={() => setSelectedPhotoForAlbum(null)}>
              <Text style={styles.modalCancelText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PhotoCard({
  item,
  albumName,
  onDelete,
  onToggleFavorite,
  onOpenNote,
  onOpenAlbumSelect,
  onSync,
  isSyncing,
}: {
  item: GeoPhoto;
  albumName?: string;
  onDelete: (id: number) => void;
  onToggleFavorite: (id: number, current: boolean) => void;
  onOpenNote: (photo: GeoPhoto) => void;
  onOpenAlbumSelect: (photo: GeoPhoto) => void;
  onSync: (id: number) => void;
  isSyncing: boolean;
}) {
  const [mapError, setMapError] = useState(false);

  // C1: Renderizar el badge de sincronización
  const renderSyncBadge = () => {
    if (item.syncStatus === 'synced') {
      return (
        <View style={[styles.syncBadge, styles.syncBadgeSynced]}>
          <Text style={styles.syncBadgeText}>☁️✓ Nube</Text>
        </View>
      );
    }
    if (item.syncStatus === 'modified_pending') {
      return (
        <View style={[styles.syncBadge, styles.syncBadgePending]}>
          <Text style={styles.syncBadgeText}>☁️⬆️ Pendiente</Text>
        </View>
      );
    }
    return (
      <View style={[styles.syncBadge, styles.syncBadgeLocal]}>
        <Text style={styles.syncBadgeText}>📱 Local</Text>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.photoRow}>
        <Image source={{ uri: item.uri }} style={styles.photo} />

        {/* Badges superiores izquierdos: Fuente y Sincronización */}
        <View style={styles.topLeftBadges}>
          <View
            style={[
              styles.sourceBadge,
              item.source === 'gallery' ? styles.galleryBadge : styles.camBadge,
            ]}>
            <Text style={styles.sourceBadgeText}>
              {item.source === 'gallery' ? 'GAL' : 'CAM'}
            </Text>
          </View>

          {renderSyncBadge()}
        </View>

        {/* Acciones flotantes superiores derechas: Favorito y Eliminar */}
        <View style={styles.floatingActions}>
          <Pressable
            style={[styles.actionCircle, item.isFavorite && styles.favoriteActive]}
            onPress={() => onToggleFavorite(item.id, item.isFavorite)}>
            <Text style={styles.actionIcon}>{item.isFavorite ? '⭐' : '☆'}</Text>
          </Pressable>
          <Pressable style={styles.actionCircle} onPress={() => onDelete(item.id)}>
            <Text style={styles.actionIcon}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* Barra de Coordenadas */}
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
          <Text style={styles.noLocationText}>Sin ubicación GPS</Text>
        </View>
      )}

      {/* Footer de la tarjeta: Álbum, Notas y Botón de Sincronización */}
      <View style={styles.cardFooter}>
        <View style={styles.metaRow}>
          <Pressable style={styles.albumBadge} onPress={() => onOpenAlbumSelect(item)}>
            <Text style={styles.albumBadgeText}>
              📁 {albumName ? albumName : 'Sin Álbum (Asignar)'}
            </Text>
          </Pressable>

          {/* Botón de sincronización individual (T5) */}
          <Pressable
            onPress={() => onSync(item.id)}
            disabled={isSyncing}
            style={[
              styles.syncBtn,
              item.syncStatus === 'synced' ? styles.syncBtnSynced : styles.syncBtnPending,
            ]}>
            {isSyncing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.syncBtnText}>
                {item.syncStatus === 'synced' ? '✓ En Nube' : '☁️ Subir a Nube'}
              </Text>
            )}
          </Pressable>

          <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>

        {item.notes ? (
          <Pressable style={styles.noteBox} onPress={() => onOpenNote(item)}>
            <Text style={styles.noteContent}>📝 {item.notes}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.addNoteBtn} onPress={() => onOpenNote(item)}>
            <Text style={styles.addNoteBtnText}>+ Agregar nota</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  userBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 6,
    backgroundColor: '#161616',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  userEmail: { color: '#0a7ea4', fontSize: 13, fontWeight: '600', maxWidth: '75%' },
  signOutBtn: {
    backgroundColor: '#262626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  signOutBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  headerSubtitle: { color: '#888', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  syncAllBtn: {
    backgroundColor: '#166534',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncAllBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  addAlbumBtn: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addAlbumBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  clearBtn: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },

  progressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#064e3b',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  progressBannerText: { color: '#6ee7b7', fontSize: 12, fontWeight: '600' },

  filterContainer: { paddingVertical: 8, backgroundColor: '#181818' },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#262626',
  },
  filterChipActive: { backgroundColor: '#0a7ea4' },
  filterChipText: { color: '#bbb', fontSize: 13, fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  list: { paddingHorizontal: 12, paddingVertical: 12, gap: 16 },
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#1c1c1c' },
  photoRow: { position: 'relative' },
  photo: { width: '100%', aspectRatio: 1.33 },
  topLeftBadges: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: 6,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  camBadge: { backgroundColor: '#2563eb' },
  galleryBadge: { backgroundColor: '#9333ea' },
  sourceBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  syncBadgeSynced: { backgroundColor: '#15803d' },
  syncBadgePending: { backgroundColor: '#d97706' },
  syncBadgeLocal: { backgroundColor: '#475569' },
  syncBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  floatingActions: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 },
  actionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteActive: { backgroundColor: '#eab308' },
  actionIcon: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

  coordsBar: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#242424' },
  coordsText: { color: '#00ff88', fontSize: 12, fontFamily: 'monospace' },
  mapContainer: { position: 'relative' },
  mapImage: { width: '100%', height: 180, backgroundColor: '#333' },
  mapFallback: {
    width: '100%',
    height: 180,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapFallbackText: { color: '#888', fontSize: 13 },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderTopLeftRadius: 8,
  },
  mapOverlayText: { color: '#5b9bd5', fontSize: 11 },
  noLocationBar: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#242424' },
  noLocationText: { color: '#888', fontSize: 12, fontStyle: 'italic' },

  cardFooter: { padding: 12, gap: 8, backgroundColor: '#1c1c1c' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  albumBadge: {
    backgroundColor: '#2b2b2b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  albumBadgeText: { color: '#60a5fa', fontSize: 12, fontWeight: '600' },
  syncBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  syncBtnSynced: { backgroundColor: '#15803d' },
  syncBtnPending: { backgroundColor: '#0a7ea4' },
  syncBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  dateText: { color: '#777', fontSize: 11 },

  noteBox: {
    backgroundColor: '#262626',
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0a7ea4',
  },
  noteContent: { color: '#ddd', fontSize: 13, lineHeight: 18 },
  addNoteBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  addNoteBtnText: { color: '#0a7ea4', fontSize: 12, fontWeight: '600' },

  // Estilos de Modales
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalSubtitle: { color: '#888', fontSize: 12 },
  textInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    color: '#fff',
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  singleInput: {
    backgroundColor: '#333',
    borderRadius: 8,
    color: '#fff',
    padding: 12,
    fontSize: 14,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  modalCancelBtn: { backgroundColor: '#333' },
  modalCancelText: { color: '#ccc', fontWeight: '600' },
  modalSaveBtn: { backgroundColor: '#0a7ea4' },
  modalSaveText: { color: '#fff', fontWeight: '700' },
  albumOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  albumOptionText: { color: '#eee', fontSize: 15 },
});