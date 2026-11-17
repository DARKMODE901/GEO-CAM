// src/services/userProfile.ts
// Gestión del perfil dinámico del usuario para personalizar el Tutor IA (C2)

import { secureStorage } from '@/lib/secureStorage';

export interface UserProfile {
  nombre: string;
  tema: string;
  nivel: 'Principiante' | 'Intermedio' | 'Avanzado';
}

export const DEFAULT_PROFILE: UserProfile = {
  nombre: 'Explorador GeoCam',
  tema: 'Geografía y Entorno',
  nivel: 'Intermedio',
};

const PROFILE_KEY = 'geocam_user_profile';

export async function getUserProfile(): Promise<UserProfile> {
  try {
    const raw = await secureStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    return {
      nombre: typeof parsed.nombre === 'string' && parsed.nombre.trim() ? parsed.nombre.trim() : DEFAULT_PROFILE.nombre,
      tema: typeof parsed.tema === 'string' && parsed.tema.trim() ? parsed.tema.trim() : DEFAULT_PROFILE.tema,
      nivel: ['Principiante', 'Intermedio', 'Avanzado'].includes(parsed.nivel) ? parsed.nivel : DEFAULT_PROFILE.nivel,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveUserProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
  const current = await getUserProfile();
  const updated: UserProfile = {
    nombre: profile.nombre !== undefined ? profile.nombre.trim() : current.nombre,
    tema: profile.tema !== undefined ? profile.tema.trim() : current.tema,
    nivel: profile.nivel ?? current.nivel,
  };
  await secureStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
  return updated;
}
