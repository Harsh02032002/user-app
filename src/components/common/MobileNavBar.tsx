import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../context/CartContext';

export const MobileNavBar = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { totalItems } = useCart();
  const [currentScreen, setCurrentScreen] = React.useState('Home');

  React.useEffect(() => {
    const updateScreen = (state: any) => {
      if (!state) return;
      let route = state.routes[state.index];
      while (route.state) {
        route = route.state.routes[route.state.index];
      }
      setCurrentScreen(route.name);
    };

    // Set initial
    try {
      const state = navigation.getState();
      if (state) updateScreen(state);
    } catch (e) {}

    // Listen for updates
    const unsubscribe = navigation.addListener('state', (e: any) => {
      if (e.data && e.data.state) {
        updateScreen(e.data.state);
      }
    });

    return unsubscribe;
  }, [navigation]);

  const tabs = [
    { name: 'Home', icon: 'home', outline: 'home-outline', label: 'Home', screen: 'Home' },
    { name: 'Orders', icon: 'bag', outline: 'bag-outline', label: 'Orders', screen: 'Orders' },
    { name: 'MyPlans', icon: 'star', outline: 'star-outline', label: 'My Plans', screen: 'MyPlans' },
    { name: 'Wallet', icon: 'wallet', outline: 'wallet-outline', label: 'Wallet', screen: 'Wallet' },
    { name: 'Settings', icon: 'settings', outline: 'settings-outline', label: 'Settings', screen: 'Settings' },
  ];

  if (currentScreen === 'Landing' || currentScreen === 'Login' || currentScreen === 'Register' || currentScreen === 'Otp') {
    return null;
  }

  const handlePress = (screenName: string) => {
    navigation.navigate('MainTabs', { screen: screenName });
  };

  return (
    <View style={[
      styles.container, 
      { 
        paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 25),
        height: Platform.OS === 'ios' ? Math.max(85, insets.bottom + 50) : 85,
      }
    ]}>
      {tabs.map((tab) => {
        const isActive = currentScreen === tab.name || currentScreen === tab.screen;
        return (
          <TouchableOpacity 
            key={tab.name} 
            style={styles.tab} 
            onPress={() => handlePress(tab.screen)}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons 
                name={(isActive ? tab.icon : tab.outline) as any} 
                size={22} 
                color={isActive ? '#FF6B00' : '#64748b'} 
              />
              {(tab.name === 'Home' && totalItems > 0) && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{totalItems}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color: isActive ? '#FF6B00' : '#64748b' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 500 : '100%',
    alignSelf: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    zIndex: 1000,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingTop: 10,
  },
  iconContainer: {
    position: 'relative',
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -12,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
});
