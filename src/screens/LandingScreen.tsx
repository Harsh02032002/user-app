import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import { DEFAULT_LOCATION_LABEL, getReadableLocation, LOCATION_NAME_KEY } from '../utils/location';
import { SERVICE_RADIUS_KM } from '../config/serviceArea';
import { colors, fonts, radius, spacing, type } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const logo = require('../../assets/images/logo.png');
const homeChefPhoto = require('../../assets/images/home-chef.jpg');
const restaurantPhoto = require('../../assets/images/restaurant.jpg');

export default function LandingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [location, setLocation] = useState('');
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LOCATION_NAME_KEY).then((name) => name && setLocation(name)).catch(() => {});
  }, []);

  const detectLocation = async () => {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access so we can show kitchens that deliver to you.');
        return;
      }
      const next = await getReadableLocation(); // also saves coordinates + name
      setLocation(next && next !== DEFAULT_LOCATION_LABEL ? next : '');
    } catch {
      Alert.alert('Could not get your location', 'Please try again in a moment.');
    } finally {
      setDetecting(false);
    }
  };

  const go = async (preferred: 'home_chef' | 'restaurant' | 'all') => {
    await AsyncStorage.setItem('preferredFoodType', preferred).catch(() => {});
    if (user) navigation.navigate('MainTabs' as any);
    else navigation.navigate('SimpleLogin' as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Image source={logo} style={styles.logo} contentFit="contain" accessibilityLabel="Dabba Nation" />
          {!user ? (
            <TouchableOpacity onPress={() => navigation.navigate('SimpleLogin' as any)} hitSlop={10} accessibilityRole="button">
              <Text style={styles.signIn}>Sign in</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.kicker}>DABBA NATION</Text>
        <Text style={styles.headline}>
          Ghar ka khana,{'\n'}
          <Text style={styles.headlineAccent}>from a kitchen near you.</Text>
        </Text>
        <Text style={[type.body, styles.lede]}>
          Fresh meals from home cooks and local restaurants within {SERVICE_RADIUS_KM} km, delivered hot.
        </Text>

        <TouchableOpacity style={styles.location} onPress={detectLocation} disabled={detecting} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={location ? `Delivering to ${location}. Tap to update` : 'Use my current location'}>
          <View style={styles.locationPin}>
            <Ionicons name="location-sharp" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={type.overline}>Deliver to</Text>
            <Text style={styles.locationValue} numberOfLines={1}>{detecting ? 'Finding you…' : location || 'Use my current location'}</Text>
          </View>
          <Ionicons name={location ? 'refresh' : 'navigate-outline'} size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={[type.title, { marginTop: spacing.xxl, marginBottom: spacing.md }]}>What are you in the mood for?</Text>

        <ChoiceTile
          photo={homeChefPhoto}
          title="Home kitchens"
          subtitle="Daily dal-chawal, rotis and thalis from home cooks"
          onPress={() => go('home_chef')}
        />
        <ChoiceTile
          photo={restaurantPhoto}
          title="Restaurants"
          subtitle="Local favourites, cooked to order"
          onPress={() => go('restaurant')}
        />

        <TouchableOpacity style={styles.browseAll} onPress={() => go('all')} accessibilityRole="button">
          <Text style={styles.browseAllText}>Show me everything</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.text} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const ChoiceTile: React.FC<{ photo: number; title: string; subtitle: string; onPress: () => void }> = ({ photo, title, subtitle, onPress }) => (
  <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`}>
    <Image source={photo} style={styles.tilePhoto} contentFit="cover" />
    <View style={styles.tileBody}>
      <View style={{ flex: 1 }}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={type.caption} numberOfLines={2}>{subtitle}</Text>
      </View>
      <View style={styles.tileArrow}>
        <Ionicons name="arrow-forward" size={18} color={colors.textInverse} />
      </View>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scroll: { paddingHorizontal: spacing.screen },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52 },
  logo: { width: 48, height: 48 },
  signIn: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, textDecorationLine: 'underline' },

  kicker: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2, color: colors.primaryInk, marginTop: spacing.xl },
  headline: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, letterSpacing: -0.8, color: colors.text, marginTop: spacing.sm },
  headlineAccent: { fontFamily: fonts.displayItalic, color: colors.primaryInk },
  lede: { color: colors.textSecondary, marginTop: spacing.md },

  location: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl,
    padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  locationPin: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  locationValue: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 2 },

  tile: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  tilePhoto: { width: '100%', aspectRatio: 2.1, backgroundColor: colors.surfaceMuted },
  tileBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  tileTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.text },
  tileArrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },

  browseAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.lg },
  browseAllText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
});
