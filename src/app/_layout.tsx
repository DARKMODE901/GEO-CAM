// src/app/_layout.tsx
// Layout raíz con SQLite Migrations (Semana 7) y Supabase Auth Guard (Semana 8)
// REGLA 5: Renderizado condicional declarativo para el estado de autenticación (NO router.replace)

import React, { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme, View, Text, ActivityIndicator } from 'react-native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import { db } from '@/db/client';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { GeoPhotosProvider } from '@/context/GeoPhotosContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import LoginScreen from '@/app/login';

SplashScreen.preventAutoHideAsync();

function MainContent() {
  const { session, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' }}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={{ marginTop: 12, color: '#aaa', fontSize: 14 }}>
          Verificando sesión segura...
        </Text>
      </View>
    );
  }

  // REGLA 5: Si no hay sesión activa, renderiza la pantalla de Login directamente
  if (!session) {
    return <LoginScreen />;
  }

  // Usuario autenticado: acceso a toda la aplicación con SQLite y Supabase
  return (
    <GeoPhotosProvider>
      <AppTabs />
    </GeoPhotosProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (error) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [error]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#111' }}>
        <Text style={{ color: '#ef4444', textAlign: 'center', fontSize: 16, fontWeight: 'bold' }}>
          Error al ejecutar migraciones de SQLite:
        </Text>
        <Text style={{ color: '#aaa', marginTop: 8, textAlign: 'center' }}>{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' }}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text style={{ marginTop: 12, color: '#aaa', fontSize: 14 }}>
          Cargando base de datos offline...
        </Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <MainContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
