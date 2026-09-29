// src/hooks/useCamera.ts
import { useCallback, useRef, useState } from 'react';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { Linking } from 'react-native';
import type { PermissionState } from '@/types/geo';

interface UseCameraReturn {
  cameraRef: React.RefObject<CameraView | null>;
  facing: CameraType;
  permissionState: PermissionState;
  isCapturing: boolean;
  isReady: boolean;
  requestPermission: () => Promise<void>;
  openSettings: () => Promise<void>;
  toggleFacing: () => void;
  takePhoto: () => Promise<{ uri: string } | null>;
  onCameraReady: () => void;
}

export function useCamera(): UseCameraReturn {
  // Regla Top-Level: todos los hooks al inicio, nunca en condicionales
  const [permission, requestPerm] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // useRef: guarda la referencia a CameraView sin causar re-renders
  const cameraRef = useRef<CameraView | null>(null);

  // Derivamos un PermissionState tipado desde el objeto de permiso de Expo
  const permissionState: PermissionState = (() => {
    if (!permission) return 'checking';
    if (permission.granted) return 'granted';
    if (permission.canAskAgain) return 'denied';
    return 'blocked';
  })();

  const requestPermission = useCallback(async () => {
    await requestPerm();
  }, [requestPerm]);

  const openSettings = useCallback(async () => {
    await Linking.openSettings();
  }, []);

  const toggleFacing = useCallback(() => {
    // prevState: el nuevo valor depende del anterior
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, []);

  const onCameraReady = useCallback(() => {
    setIsReady(true);
  }, []);

  const takePhoto = useCallback(async (): Promise<{ uri: string } | null> => {
    if (!cameraRef.current || !isReady || isCapturing) return null;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: false,
      });
      return photo ? { uri: photo.uri } : null;
    } catch (err) {
      console.error('[useCamera] takePhoto error:', err);
      return null;
    } finally {
      // prevState funcional para garantizar el valor correcto
      setIsCapturing(false);
    }
  }, [isReady, isCapturing]);

  return {
    cameraRef,
    facing,
    permissionState,
    isCapturing,
    isReady,
    requestPermission,
    openSettings,
    toggleFacing,
    takePhoto,
    onCameraReady,
  };
}
