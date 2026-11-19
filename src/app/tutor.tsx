// src/app/tutor.tsx
// Pestaña Tutor IA: Chat en Streaming y Multimodal con Gemini y Supabase Edge Function (Módulo 1)
// Incluye Retos C1 (SQLite), C2 (Perfil Dinámico), C3 (Tarjetas Repaso) y C4 (Manejo de Errores y Red)

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Network from 'expo-network';
import { useChat } from '@ai-sdk/react';
import type { FileUIPart, UIMessage } from 'ai';

import { supabase } from '@/lib/supabase';
import { crearTransporte } from '@/lib/chatTransport';
import { crearParteFotoParaChat } from '@/lib/foto';
import { chatRepository } from '@/repositories/chatRepository';
import {
  DEFAULT_PROFILE,
  getUserProfile,
  saveUserProfile,
  type UserProfile,
} from '@/services/userProfile';
import {
  generarTarjetasDeRepaso,
  type TarjetaRepaso,
} from '@/services/tarjetasService';

export default function TutorScreen() {
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loadedHistory, setLoadedHistory] = useState(false);

  useEffect(() => {
    chatRepository
      .getAll()
      .then((msgs) => {
        setInitialMessages(msgs);
        setLoadedHistory(true);
      })
      .catch((err) => {
        console.warn('[tutor] Error cargando historial de SQLite:', err);
        setLoadedHistory(true);
      });
  }, []);

  if (!loadedHistory) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={styles.loadingText}>Cargando historial de chat offline...</Text>
      </View>
    );
  }

  return <TutorChatView initialMessages={initialMessages} />;
}

function TutorChatView({ initialMessages }: { initialMessages: UIMessage[] }) {
  const transport = useMemo(() => crearTransporte('tutor'), []);

  // Estado de red (C4)
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    Network.getNetworkStateAsync().then((state) => {
      if (mounted) {
        setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      }
    });

    const interval = setInterval(async () => {
      const state = await Network.getNetworkStateAsync();
      if (mounted) {
        setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // useChat de @ai-sdk/react (SDK v7)
  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    regenerate,
    clearError,
    setMessages,
  } = useChat({
    transport,
    messages: initialMessages,
    onFinish: async ({ messages: currentMessages }) => {
      try {
        await chatRepository.upsertMany(currentMessages);
      } catch (err) {
        console.warn('[tutor] Error guardando mensajes en SQLite:', err);
      }
    },
    onError: async (err) => {
      console.warn('[tutor] Error en useChat:', err);
      if (
        err.message.includes('401') ||
        err.message.includes('JWT') ||
        err.message.includes('No hay sesión')
      ) {
        Alert.alert(
          'Sesión Expirada (401)',
          'Tu sesión ha vencido. Serás redirigido a la pantalla de inicio de sesión.',
          [{ text: 'Entendido', onPress: () => supabase.auth.signOut() }]
        );
      }
    },
  });

  // Estados locales de entrada y foto
  const [inputText, setInputText] = useState('');
  const [selectedPhotoPart, setSelectedPhotoPart] = useState<FileUIPart | null>(null);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // Estados de Perfil Dinámico (C2)
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editTema, setEditTema] = useState('');
  const [editNivel, setEditNivel] = useState<'Principiante' | 'Intermedio' | 'Avanzado'>('Intermedio');

  // Estados de Tarjetas de Repaso (C3)
  const [isCardsModalOpen, setIsCardsModalOpen] = useState(false);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [flashcards, setFlashcards] = useState<TarjetaRepaso[]>([]);
  const [revealedCardIdxs, setRevealedCardIdxs] = useState<number[]>([]);

  const flatListRef = useRef<FlatList>(null);

  // Cargar perfil guardado
  useEffect(() => {
    getUserProfile().then((p) => {
      setProfile(p);
      setEditNombre(p.nombre);
      setEditTema(p.tema);
      setEditNivel(p.nivel);
    });
  }, []);

  const handleOpenProfileModal = () => {
    setEditNombre(profile.nombre);
    setEditTema(profile.tema);
    setEditNivel(profile.nivel);
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    const updated = await saveUserProfile({
      nombre: editNombre,
      tema: editTema,
      nivel: editNivel,
    });
    setProfile(updated);
    setIsProfileModalOpen(false);
    Alert.alert('Perfil Guardado', 'El Tutor IA adaptará sus explicaciones a tu perfil.');
  };

  // Selector de imagen de galería
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setIsProcessingPhoto(true);
        const uri = result.assets[0].uri;
        setSelectedPhotoUri(uri);
        const part = await crearParteFotoParaChat(uri);
        setSelectedPhotoPart(part);
      }
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo cargar la imagen: ' + err.message);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Tomar foto con cámara
  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara para tomar fotos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setIsProcessingPhoto(true);
        const uri = result.assets[0].uri;
        setSelectedPhotoUri(uri);
        const part = await crearParteFotoParaChat(uri);
        setSelectedPhotoPart(part);
      }
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo capturar la foto: ' + err.message);
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Enviar mensaje
  const handleSendMessage = async () => {
    if (!isOnline) {
      Alert.alert('Sin red', 'No tienes conexión a internet para consultar al Tutor IA.');
      return;
    }

    const textToSend = inputText.trim();
    if (!textToSend && !selectedPhotoPart) {
      return;
    }

    const filesToSend = selectedPhotoPart ? [selectedPhotoPart] : undefined;

    // Limpiar estados locales antes de disparar
    setInputText('');
    setSelectedPhotoPart(null);
    setSelectedPhotoUri(null);
    clearError();

    await sendMessage({
      text: textToSend || '¿Qué ves en esta foto y qué detalles geográficos o culturales destacan?',
      files: filesToSend,
    });
  };

  // Botón "Nueva conversación" (C1)
  const handleNewConversation = () => {
    Alert.alert(
      'Nueva Conversación',
      '¿Deseas vaciar el historial del chat en SQLite e iniciar una nueva sesión con el Tutor IA?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Nueva sesión',
          style: 'destructive',
          onPress: async () => {
            setMessages([]);
            await chatRepository.clearAll();
          },
        },
      ]
    );
  };

  // Generar Tarjetas de Repaso (C3)
  const handleGenerateCards = async () => {
    if (!isOnline) {
      Alert.alert('Sin red', 'Se requiere internet para generar tarjetas con IA.');
      return;
    }
    if (messages.length === 0) {
      Alert.alert('Conversación Vacía', 'Primero chatea con el Tutor IA para poder generar tarjetas de estudio sobre la conversación.');
      return;
    }

    setIsGeneratingCards(true);
    setFlashcards([]);
    setRevealedCardIdxs([]);
    setIsCardsModalOpen(true);

    try {
      const cards = await generarTarjetasDeRepaso(messages);
      setFlashcards(cards);
    } catch (err: any) {
      Alert.alert('Error al generar tarjetas', err?.message || 'No se pudieron generar las tarjetas.');
      setIsCardsModalOpen(false);
    } finally {
      setIsGeneratingCards(false);
    }
  };

  const toggleRevealCard = (idx: number) => {
    setRevealedCardIdxs((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const ocupado = status === 'submitted' || status === 'streaming';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Barra Superior con Perfil, Tarjetas y Nueva Conversación */}
      <View style={styles.topBar}>
        <View style={styles.topInfo}>
          <Text style={styles.topTitle}>🤖 Tutor IA</Text>
          <Text style={styles.topSubtitle} numberOfLines={1}>
            {profile.tema} • {profile.nivel}
          </Text>
        </View>

        <View style={styles.topActions}>
          <Pressable
            style={styles.topBtn}
            onPress={handleGenerateCards}
            disabled={ocupado}
          >
            <Text style={styles.topBtnText}>✨ Tarjetas</Text>
          </Pressable>

          <Pressable style={styles.topBtn} onPress={handleOpenProfileModal}>
            <Text style={styles.topBtnText}>⚙️ Perfil</Text>
          </Pressable>

          <Pressable
            style={[styles.topBtn, styles.topBtnDanger]}
            onPress={handleNewConversation}
          >
            <Text style={styles.topBtnDangerText}>🗑️</Text>
          </Pressable>
        </View>
      </View>

      {/* Banner de Conexión Offline (C4) */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            ⚠️ Modo Offline: Sin conexión a internet. El chat está en modo lectura.
          </Text>
        </View>
      )}

      {/* Mensaje de Error (C4) */}
      {error && (
        <View style={styles.errorBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.errorTitle}>
              {error.message.includes('429')
                ? 'Límite de Consultas (429)'
                : error.message.includes('NOT_FOUND') || error.message.includes('not found')
                ? 'Edge Function No Desplegada (404)'
                : 'Error al comunicarse con Gemini'}
            </Text>
            <Text style={styles.errorText}>
              {error.message.includes('429')
                ? 'Has alcanzado el límite diario o temporal de Gemini. Por favor espera un momento o vuelve mañana.'
                : error.message.includes('NOT_FOUND') || error.message.includes('not found')
                ? 'La función "tutor" no está desplegada en tu Supabase. Ejecuta: npx supabase functions deploy tutor'
                : error.message}
            </Text>
          </View>
          <View style={styles.errorActions}>
            <Pressable
              style={styles.retryBtn}
              onPress={() => {
                clearError();
                regenerate();
              }}
            >
              <Text style={styles.retryBtnText}>🔄 Reintentar</Text>
            </Pressable>
            <Pressable style={styles.dismissBtn} onPress={() => clearError()}>
              <Text style={styles.dismissBtnText}>✕</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Lista de Mensajes */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🧭</Text>
            <Text style={styles.emptyTitle}>¡Hola, {profile.nombre}!</Text>
            <Text style={styles.emptyText}>
              Soy tu Tutor IA en GeoCam. Pregúntame sobre geografía, arquitectura o naturaleza, o
              adjunta una foto para analizarla juntos.
            </Text>
            <View style={styles.examplesContainer}>
              <Pressable
                style={styles.exampleChip}
                onPress={() => setInputText('¿Cómo puedo reconocer si un paisaje es de origen volcánico?')}
              >
                <Text style={styles.exampleText}>🌋 ¿Cómo reconocer paisaje volcánico?</Text>
              </Pressable>
              <Pressable
                style={styles.exampleChip}
                onPress={() => setInputText('Explícame la diferencia entre arquitectura colonial y republicana.')}
              >
                <Text style={styles.exampleText}>🏛️ Arquitectura colonial vs republicana</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View
              style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text style={styles.roleLabel}>
                {isUser ? '👤 Tú' : '🤖 Tutor IA'}
              </Text>

              {item.parts?.map((part: any, pIdx: number) => {
                if (part.type === 'text') {
                  return (
                    <Text
                      key={pIdx}
                      style={[
                        styles.messageText,
                        isUser ? styles.userText : styles.assistantText,
                      ]}
                      selectable
                    >
                      {part.text}
                    </Text>
                  );
                }
                if (part.type === 'file' && part.url) {
                  return (
                    <Image
                      key={pIdx}
                      source={{ uri: part.url }}
                      style={styles.messageImage}
                      resizeMode="cover"
                    />
                  );
                }
                return null;
              })}
            </View>
          );
        }}
        ListFooterComponent={
          status === 'submitted' ? (
            <View style={styles.statusIndicator}>
              <ActivityIndicator size="small" color="#38bdf8" />
              <Text style={styles.statusText}>El Tutor IA está pensando...</Text>
            </View>
          ) : status === 'streaming' ? (
            <View style={styles.statusIndicator}>
              <ActivityIndicator size="small" color="#00ff88" />
              <Text style={[styles.statusText, { color: '#00ff88' }]}>
                Escribiendo respuesta palabra por palabra...
              </Text>
            </View>
          ) : undefined
        }
      />

      {/* Vista previa de foto seleccionada para enviar */}
      {selectedPhotoUri && (
        <View style={styles.photoPreviewRow}>
          <Image source={{ uri: selectedPhotoUri }} style={styles.previewThumb} />
          <View style={styles.previewInfo}>
            <Text style={styles.previewTitle}>Foto lista para enviar</Text>
            <Text style={styles.previewNotice}>🔒 Optimizada a &lt; 300 KB para Gemini</Text>
          </View>
          <Pressable
            style={styles.previewRemoveBtn}
            onPress={() => {
              setSelectedPhotoUri(null);
              setSelectedPhotoPart(null);
            }}
          >
            <Text style={styles.previewRemoveText}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Barra de Entrada de Texto y Acciones */}
      <View style={styles.inputContainer}>
        {/* Botones de Cámara y Galería */}
        <Pressable
          style={[styles.mediaBtn, (!isOnline || ocupado) && styles.btnDisabled]}
          onPress={handleTakePhoto}
          disabled={!isOnline || ocupado || isProcessingPhoto}
        >
          <Text style={styles.mediaBtnText}>📷</Text>
        </Pressable>

        <Pressable
          style={[styles.mediaBtn, (!isOnline || ocupado) && styles.btnDisabled]}
          onPress={handlePickImage}
          disabled={!isOnline || ocupado || isProcessingPhoto}
        >
          <Text style={styles.mediaBtnText}>🖼️</Text>
        </Pressable>

        {/* Input de Texto */}
        <TextInput
          style={styles.textInput}
          placeholder={
            !isOnline
              ? 'Sin conexión a internet...'
              : ocupado
              ? 'El tutor está respondiendo...'
              : 'Escribe tu pregunta sobre geografía o fotos...'
          }
          placeholderTextColor="#888"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
          editable={isOnline && !ocupado}
        />

        {/* Botón de Envío o Botón de Detener (Stop) */}
        {ocupado ? (
          <Pressable style={styles.stopBtn} onPress={() => stop()}>
            <Text style={styles.stopBtnIcon}>■</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.sendBtn,
              (!isOnline || (!inputText.trim() && !selectedPhotoPart)) && styles.btnDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!isOnline || (!inputText.trim() && !selectedPhotoPart)}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </Pressable>
        )}
      </View>

      {/* Modal de Configuración de Perfil (C2) */}
      <Modal visible={isProfileModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚙️ Perfil de Aprendizaje</Text>
            <Text style={styles.modalSubtitle}>
              Personaliza cómo el Tutor IA de Gemini te explica los conceptos.
            </Text>

            <Text style={styles.inputLabel}>Tu Nombre o Apodo:</Text>
            <TextInput
              style={styles.modalInput}
              value={editNombre}
              onChangeText={setEditNombre}
              placeholder="Ej. Leo"
              placeholderTextColor="#777"
            />

            <Text style={styles.inputLabel}>Tema o Área de Enfoque:</Text>
            <TextInput
              style={styles.modalInput}
              value={editTema}
              onChangeText={setEditTema}
              placeholder="Ej. Geología, Urbanismo, Paisajes..."
              placeholderTextColor="#777"
            />

            <Text style={styles.inputLabel}>Nivel de Explicación:</Text>
            <View style={styles.nivelSelector}>
              {(['Principiante', 'Intermedio', 'Avanzado'] as const).map((lvl) => (
                <Pressable
                  key={lvl}
                  style={[styles.nivelBtn, editNivel === lvl && styles.nivelBtnActive]}
                  onPress={() => setEditNivel(lvl)}
                >
                  <Text
                    style={[
                      styles.nivelBtnText,
                      editNivel === lvl && styles.nivelBtnTextActive,
                    ]}
                  >
                    {lvl}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancelBtn]}
                onPress={() => setIsProfileModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalSaveBtn]}
                onPress={handleSaveProfile}
              >
                <Text style={styles.modalSaveText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Tarjetas de Repaso Estructuradas (C3) */}
      <Modal visible={isCardsModalOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>✨ Tarjetas de Repaso (Flashcards)</Text>
            <Text style={styles.modalSubtitle}>
              Generadas con Vercel AI SDK v7 (`output: Output.object`) a partir del chat.
            </Text>

            {isGeneratingCards ? (
              <View style={styles.centerContainerModal}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.loadingText}>Analizando chat y redactando tarjetas con Gemini...</Text>
              </View>
            ) : flashcards.length === 0 ? (
              <Text style={styles.emptyText}>No se generaron tarjetas en esta ocasión.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.cardsScroll}>
                {flashcards.map((card, idx) => {
                  const revealed = revealedCardIdxs.includes(idx);
                  return (
                    <Pressable
                      key={idx}
                      style={[styles.cardItem, revealed && styles.cardItemRevealed]}
                      onPress={() => toggleRevealCard(idx)}
                    >
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardIndex}>Tarjeta {idx + 1} de {flashcards.length}</Text>
                        <Text style={styles.cardTapHint}>
                          {revealed ? '👁️ Respuesta visible' : '👆 Toca para voltear'}
                        </Text>
                      </View>

                      <Text style={styles.cardQuestion}>❓ {card.pregunta}</Text>

                      {revealed ? (
                        <View style={styles.cardAnswerBox}>
                          <Text style={styles.cardAnswerLabel}>Respuesta:</Text>
                          <Text style={styles.cardAnswerText}>{card.respuesta}</Text>
                        </View>
                      ) : (
                        <View style={styles.cardCover}>
                          <Text style={styles.cardCoverText}>Toca para revelar la respuesta</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Pressable
              style={[styles.modalBtn, styles.modalCloseBtn, { alignSelf: 'center', marginTop: 12 }]}
              onPress={() => setIsCardsModalOpen(false)}
            >
              <Text style={styles.modalCloseText}>Cerrar Tarjetas</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 20,
  },
  centerContainerModal: { padding: 32, alignItems: 'center', gap: 12 },
  loadingText: { color: '#94a3b8', fontSize: 13, marginTop: 12 },

  // Barra Superior
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 10,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  topInfo: { flex: 1, marginRight: 8 },
  topTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  topSubtitle: { color: '#38bdf8', fontSize: 12, fontWeight: '600' },
  topActions: { flexDirection: 'row', gap: 6 },
  topBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  topBtnText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  topBtnDanger: { backgroundColor: '#451a1a' },
  topBtnDangerText: { color: '#f87171', fontSize: 12 },

  // Banners
  offlineBanner: {
    backgroundColor: '#854d0e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  offlineBannerText: { color: '#fef08a', fontSize: 12, fontWeight: '600' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#991b1b',
    gap: 8,
  },
  errorTitle: { color: '#fecaca', fontSize: 13, fontWeight: '700' },
  errorText: { color: '#fca5a5', fontSize: 12, marginTop: 2 },
  errorActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  retryBtn: {
    backgroundColor: '#b91c1c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  retryBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  dismissBtn: { padding: 4 },
  dismissBtnText: { color: '#fca5a5', fontSize: 14, fontWeight: '700' },

  // Lista de Mensajes
  messagesList: { padding: 14, gap: 12 },
  emptyState: { alignItems: 'center', padding: 24, gap: 12, marginTop: 40 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  examplesContainer: { width: '100%', gap: 8, marginTop: 12 },
  exampleChip: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  exampleText: { color: '#38bdf8', fontSize: 13, fontWeight: '500' },

  messageBubble: {
    maxWidth: '85%',
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0284c7',
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderBottomLeftRadius: 2,
  },
  roleLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  messageText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#ffffff' },
  assistantText: { color: '#f1f5f9' },
  messageImage: { width: 220, height: 160, borderRadius: 8, marginTop: 4 },

  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    marginVertical: 4,
  },
  statusText: { color: '#94a3b8', fontSize: 12 },

  // Vista previa de foto
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 10,
  },
  previewThumb: { width: 44, height: 44, borderRadius: 6 },
  previewInfo: { flex: 1 },
  previewTitle: { color: '#f8fafc', fontSize: 12, fontWeight: '600' },
  previewNotice: { color: '#38bdf8', fontSize: 10 },
  previewRemoveBtn: { padding: 6 },
  previewRemoveText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },

  // Input Container
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 8,
  },
  mediaBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaBtnText: { fontSize: 18 },
  textInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stopBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtnIcon: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  btnDisabled: { opacity: 0.4 },

  // Modales
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  modalSubtitle: { color: '#94a3b8', fontSize: 12 },
  inputLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', marginTop: 4 },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  nivelSelector: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  nivelBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  nivelBtnActive: { backgroundColor: '#0284c7', borderColor: '#38bdf8' },
  nivelBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  nivelBtnTextActive: { color: '#fff', fontWeight: '700' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  modalCancelBtn: { backgroundColor: '#334155' },
  modalCancelText: { color: '#cbd5e1', fontWeight: '600' },
  modalSaveBtn: { backgroundColor: '#0284c7' },
  modalSaveText: { color: '#fff', fontWeight: '700' },
  modalCloseBtn: { backgroundColor: '#334155', paddingHorizontal: 20 },
  modalCloseText: { color: '#fff', fontWeight: '600' },

  // Tarjetas Flashcards
  cardsScroll: { gap: 12, paddingVertical: 8 },
  cardItem: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardItemRevealed: { borderColor: '#38bdf8' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardIndex: { color: '#38bdf8', fontSize: 11, fontWeight: '700' },
  cardTapHint: { color: '#64748b', fontSize: 11 },
  cardQuestion: { color: '#f8fafc', fontSize: 15, fontWeight: '600', lineHeight: 22 },
  cardCover: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  cardCoverText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic' },
  cardAnswerBox: {
    backgroundColor: '#132e48',
    borderColor: '#0284c7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 4,
    marginTop: 4,
  },
  cardAnswerLabel: { color: '#38bdf8', fontSize: 11, fontWeight: '700' },
  cardAnswerText: { color: '#e0f2fe', fontSize: 14, lineHeight: 20 },
});
