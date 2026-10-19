import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, sizes, type } from '../../theme';

/** Height of the bar above the safe-area inset — use for bottom content padding */
export const TAB_BAR_HEIGHT = sizes.tabBarHeight;

const TABS = [
  { name: 'Home', icon: 'home', outline: 'home-outline', label: 'Home' },
  { name: 'Orders', icon: 'receipt', outline: 'receipt-outline', label: 'Orders' },
  { name: 'MyPlans', icon: 'calendar', outline: 'calendar-outline', label: 'My Plans' },
  { name: 'Wallet', icon: 'wallet', outline: 'wallet-outline', label: 'Wallet' },
  { name: 'Settings', icon: 'person-circle', outline: 'person-circle-outline', label: 'Account' },
] as const;

const TAB_NAMES = TABS.map((t) => t.name) as string[];

export const MobileNavBar = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [currentScreen, setCurrentScreen] = React.useState('Home');

  React.useEffect(() => {
    const updateScreen = (state: any) => {
      if (!state) return;
      let route = state.routes[state.index];
      while (route.state) {
        route = route.state.routes[route.state.index ?? 0];
      }
      // A freshly-navigated tab navigator may not have its own state yet; fall back to the requested tab
      if (route.name === 'MainTabs') {
        setCurrentScreen(route.params?.screen || 'Home');
        return;
      }
      setCurrentScreen(route.name);
    };

    try {
      const state = navigation.getState();
      if (state) updateScreen(state);
    } catch (e) {}

    const unsubscribe = navigation.addListener('state', (e: any) => {
      if (e.data && e.data.state) {
        updateScreen(e.data.state);
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Only top-level destinations show the tab bar; detail and flow screens use their own headers/CTAs
  if (!TAB_NAMES.includes(currentScreen)) {
    return null;
  }

  const handlePress = (screenName: string) => {
    navigation.navigate('MainTabs', { screen: screenName });
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const isActive = currentScreen === tab.name;
        const tint = isActive ? colors.primary : colors.textTertiary;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => handlePress(tab.name)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Ionicons name={(isActive ? tab.icon : tab.outline) as any} size={24} color={tint} />
            <Text style={[styles.label, { color: tint }, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
    zIndex: 1000,
    elevation: 12,
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  tab: {
    flex: 1,
    height: TAB_BAR_HEIGHT - 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: { ...type.caption, fontSize: 11, lineHeight: 14, fontWeight: '500' },
  labelActive: { fontWeight: '600' },
});
