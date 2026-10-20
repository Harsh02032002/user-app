import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import React from 'react';
import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
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

// Keep the native splash up until the brand fonts are ready (avoids a flash of system font)
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_500Medium_Italic,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  React.useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // If fonts fail to load the app still works with system fonts
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <NavigationContainer>
            <StatusBar barStyle="dark-content" backgroundColor="#FBF7F1" />
            <RootNavigator />
            <Toast />
          </NavigationContainer>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
