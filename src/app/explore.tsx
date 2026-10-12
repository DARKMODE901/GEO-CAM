// src/app/explore.tsx
import { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import type { Album } from '@/db/schema';

export default function ExploreScreen() {
  const { photos, albums, createAlbum, removeAlbum, setFilter } = useGeoPhotos();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const totalPhotos = photos.length;
  const totalFavorites = photos.filter((p) => p.isFavorite).length;

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para el álbum');
      return;
    }
    await createAlbum(name.trim(), description.trim() || undefined);
    setName('');
    setDescription('');
    setIsModalOpen(false);
  };

  const handleDeleteAlbum = (id: number, albumName: string) => {
    Alert.alert(
      'Eliminar Álbum',
      `¿Deseas eliminar el álbum "${albumName}"? Las fotos no se borrarán, solo quedarán sin álbum.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => removeAlbum(id) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestor de Álbumes</Text>
        <Text style={styles.headerSubtitle}>Base de datos SQLite local (Drizzle ORM)</Text>
      </View>

      {/* Resumen de Métricas */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalPhotos}</Text>
          <Text style={styles.statLabel}>Fotos Guardadas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalFavorites}</Text>
          <Text style={styles.statLabel}>⭐ Favoritas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{albums.length}</Text>
          <Text style={styles.statLabel}>Álbumes</Text>
        </View>
      </View>

      {/* Título de sección y botón nuevo */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tus Álbumes</Text>
        <Pressable style={styles.createBtn} onPress={() => setIsModalOpen(true)}>
          <Text style={styles.createBtnText}>+ Nuevo Álbum</Text>
        </Pressable>
      </View>

      {/* Lista de Álbumes */}
      {albums.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📁</Text>
          <Text style={styles.emptyTitle}>Sin álbumes creados</Text>
          <Text style={styles.emptyText}>
            Organiza tus fotos geolocalizadas creando tu primer álbum.
          </Text>
        </View>
      ) : (
        <FlatList<Album>
          data={albums}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const count = photos.filter((p) => p.albumId === item.id).length;
            return (
              <View style={styles.albumCard}>
                <View style={styles.albumInfo}>
                  <Text style={styles.albumName}>📁 {item.name}</Text>
                  {item.description && (
                    <Text style={styles.albumDesc}>{item.description}</Text>
                  )}
                  <Text style={styles.albumCount}>{count} foto(s) asociada(s)</Text>
                </View>
                <Pressable
                  style={styles.deleteAlbumBtn}
                  onPress={() => handleDeleteAlbum(item.id, item.name)}>
                  <Text style={styles.deleteAlbumText}>✕</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {/* Modal Crear Álbum */}
      <Modal visible={isModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Crear Álbum</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del álbum"
              placeholderTextColor="#888"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Descripción (opcional)"
              placeholderTextColor="#888"
              value={description}
              onChangeText={setDescription}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setIsModalOpen(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleCreate}>
                <Text style={styles.saveText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', paddingTop: 56, paddingHorizontal: 16 },
  header: { marginBottom: 16 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: '#888', fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2b2b2b',
  },
  statNumber: { color: '#0a7ea4', fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  createBtn: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  list: { gap: 12, paddingBottom: 40 },
  albumCard: {
    backgroundColor: '#1c1c1c',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#282828',
  },
  albumInfo: { flex: 1, gap: 4 },
  albumName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  albumDesc: { color: '#999', fontSize: 13 },
  albumCount: { color: '#60a5fa', fontSize: 12, marginTop: 2 },
  deleteAlbumBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  deleteAlbumText: { color: '#ef4444', fontSize: 14, fontWeight: 'bold' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  emptyText: { color: '#888', fontSize: 13, textAlign: 'center', lineHeight: 18 },
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
  input: {
    backgroundColor: '#333',
    borderRadius: 8,
    color: '#fff',
    padding: 12,
    fontSize: 14,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  cancelBtn: { backgroundColor: '#333' },
  cancelText: { color: '#ccc', fontWeight: '600' },
  saveBtn: { backgroundColor: '#0a7ea4' },
  saveText: { color: '#fff', fontWeight: '700' },
});
