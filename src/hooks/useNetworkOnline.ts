// src/hooks/useNetworkOnline.ts
import * as Network from 'expo-network';

/**
 * Hook reactivo basado en expo-network para conocer si hay conectividad en tiempo real.
 */
export function useNetworkOnline(): {
  isOnline: boolean;
  networkType: Network.NetworkStateType | undefined;
} {
  const state = Network.useNetworkState();
  const isOnline =
    state.isConnected === undefined
      ? true
      : Boolean(state.isConnected && state.isInternetReachable !== false);

  return {
    isOnline,
    networkType: state.type,
  };
}
