import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import RootNavigator from './src/navigation/RootNavigator';
import Toast from 'react-native-toast-message';

import { SafeAreaProvider } from 'react-native-safe-area-context';

// Web only: off-screen toasts must not make the whole document scrollable
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // 'clip' (unlike 'hidden') also blocks focus-driven scrolling; browsers without it keep 'hidden'
  for (const el of [document.documentElement, document.body]) {
    el.style.overflow = 'hidden';
    el.style.overflow = 'clip';
  }
}

export default function App() {
  console.log('App rendering');
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <RootNavigator />
            <Toast />
          </NavigationContainer>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
