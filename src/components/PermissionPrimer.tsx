// src/components/PermissionPrimer.tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { PermissionState } from '@/types/geo';

interface PermissionPrimerProps {
  title: string;
  description: string;
  state: Exclude<PermissionState, 'checking' | 'granted'>;
  onRequest: () => Promise<void>;
  onOpenSettings: () => Promise<void>;
}

/**
 * PermissionPrimer: pantalla que se muestra cuando no se tiene permiso.
 *  - 'denied'  → botón para pedir el permiso
 *  - 'blocked' → botón para abrir Ajustes del sistema
 */
export function PermissionPrimer({
  title,
  description,
  state,
  onRequest,
  onOpenSettings,
}: PermissionPrimerProps) {
  const isBlocked = state === 'blocked';

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{isBlocked ? '🔒' : '📷'}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      {isBlocked ? (
        <>
          <Text style={styles.blockedNote}>
            El permiso fue denegado definitivamente. Ve a los ajustes del
            sistema para habilitarlo manualmente.
          </Text>
          <Pressable style={styles.btn} onPress={onOpenSettings}>
            <Text style={styles.btnText}>Abrir Ajustes</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.btn} onPress={onRequest}>
          <Text style={styles.btnText}>Conceder permiso</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emoji: { fontSize: 56 },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  blockedNote: {
    color: '#f97316',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
