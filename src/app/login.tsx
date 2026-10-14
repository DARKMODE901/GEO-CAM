// src/app/login.tsx
// Pantalla de inicio de sesión y registro para GeoCam.
// Se renderiza condicionalmente en _layout.tsx cuando no hay sesión activa.
// REGLA 5: NO usa router.replace() — renderizado condicional en el layout.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (error: any) {
      Alert.alert(
        'Error al iniciar sesión',
        error?.message ?? 'Ocurrió un error inesperado.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email y contraseña.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password);
      Alert.alert(
        'Registro exitoso',
        'Revisa tu correo electrónico para confirmar tu cuenta.'
      );
    } catch (error: any) {
      Alert.alert(
        'Error al registrarse',
        error?.message ?? 'Ocurrió un error inesperado.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Pantalla de carga ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={styles.loadingText}>Procesando...</Text>
      </SafeAreaView>
    );
  }

  // ── UI principal ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Encabezado */}
          <View style={styles.header}>
            <Text style={styles.logo}>📸</Text>
            <Text style={styles.title}>GeoCam</Text>
            <Text style={styles.subtitle}>
              Inicia sesión o crea una cuenta
            </Text>
          </View>

          {/* Formulario */}
          <View style={styles.card}>
            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="tu@email.com"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="password"
            />

            {/* Botón Iniciar Sesión */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSignIn}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Iniciar Sesión</Text>
            </TouchableOpacity>

            {/* Botón Registrarse */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleSignUp}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Registrarse</Text>
            </TouchableOpacity>
          </View>

          {/* Versión */}
          <Text style={styles.version}>
            GeoCam v1.0 - Semana 8 Supabase
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Estilos (tema oscuro) ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 12,
  },

  // Encabezado
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
  },

  // Tarjeta del formulario
  card: {
    backgroundColor: '#1c1c1c',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  label: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },

  // Botones
  primaryButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#0a7ea4',
  },
  secondaryButtonText: {
    color: '#0a7ea4',
    fontSize: 16,
    fontWeight: '600',
  },

  // Versión
  version: {
    textAlign: 'center',
    color: '#555',
    fontSize: 12,
  },
});
