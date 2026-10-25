import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  Animated,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_LOCATION_LABEL, getReadableLocation, getCurrentCoordinates, LOCATION_COORDS_KEY, LOCATION_NAME_KEY } from '../utils/location';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { colors, elevation, fonts, gradients, radius, spacing, surfaces, type } from '../theme';

const { width, height } = Dimensions.get('window');

const PRIMARY = colors.primary;

// Static image sources (module-level so their identity never changes between renders)
const heroBg     = require('../../assets/images/hero-bg.jpg');
const logo       = require('../../assets/images/logo.png');
const leftChar   = require('../../assets/images/chef-character.png');
const rightChar  = require('../../assets/images/traditional-woman.png');
const homeChef   = require('../../assets/images/home-chef.jpg');
const restaurant = require('../../assets/images/restaurant.jpg');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AnimatedCharacterProps {
  side: 'left' | 'right';
  imageSource: any;
  delay?: number;
  onLoad?: () => void;
}

const AnimatedCharacter = ({ side, imageSource, delay = 0, onLoad }: AnimatedCharacterProps) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false, // Fixed for web compatibility
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -10,
          duration: 2000,
          useNativeDriver: false, // Fixed for web compatibility
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false, // Fixed for web compatibility
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.animatedChar,
        { opacity, transform: [{ translateY: Animated.multiply(translateY, 0.5) }] },
      ]}
    >
      <Image
        source={imageSource}
        style={styles.charImage}
        resizeMode="contain"
        onLoad={onLoad}
      />
    </Animated.View>
  );
};

export default function LandingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [location, setLocation] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const tabBarHeight = 65; // Height of the bottom tab bar

  // Fallback: never block the landing UI for more than 2.5s even if the hero image is slow/fails
  useEffect(() => {
    const t = setTimeout(() => setImagesLoaded(true), 2500);
    return () => clearTimeout(t);
  }, []);

  // Load previously saved location on mount
  useEffect(() => {
    AsyncStorage.getItem(LOCATION_NAME_KEY).then(name => {
      if (name) setLocation(name);
    });
  }, []);

  // Stable callback: react-native-web's Image re-runs its load effect whenever the
  // onLoad identity changes. A new function every render + setState = infinite loop
  // ("Maximum update depth exceeded"). Setting `true` repeatedly is a no-op for React.
  const handleImageLoad = useCallback(() => {
    setImagesLoaded(true);
  }, []);

  const detectLocation = async () => {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow location access.');
        return;
      }
      const coords = await getCurrentCoordinates();
      const nextLocation = await getReadableLocation();
      setLocation(nextLocation);
      // getReadableLocation already saves to AsyncStorage via location.ts
    } catch {
      setLocation(DEFAULT_LOCATION_LABEL);
    } finally {
      setDetecting(false);
    }
  };

  const handleSelectType = async (type: string) => {
    await AsyncStorage.setItem('preferredFoodType', type);
    if (user) {
      // Already logged in, go back to home
      navigation.navigate('MainTabs');
    } else {
      // Not logged in, go to login
      navigation.navigate('SimpleLogin');
    }
  };

  const handleBrowseAll = async () => {
    await AsyncStorage.setItem('preferredFoodType', 'all');
    if (user) {
      navigation.navigate('MainTabs');
    } else {
      navigation.navigate('SimpleLogin');
    }
  };

  const kitchens = [
    {
      key: 'home_chef',
      image: homeChef,
      icon: 'home-heart' as const,
      tag: 'Home-cooked',
      title: 'Home Chef',
      sub: 'Ghar jaisa swad. Fresh dabbas made with love.',
    },
    {
      key: 'restaurant',
      image: restaurant,
      icon: 'storefront-outline' as const,
      tag: 'Top rated',
      title: 'Restaurant',
      sub: 'Signature dishes from top-rated restaurants.',
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {!imagesLoaded ? (
        <View style={styles.loadingContainer}>
          {/* Preload the hero texture; the screen appears once it has loaded (or after the 2.5s fallback) */}
          <Image source={heroBg} style={styles.preload} onLoad={handleImageLoad} onError={handleImageLoad} />
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.xxxl + 80 }}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO — brand gradient panel, same as .gradient-primary in the seller/admin panels */}
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Image source={heroBg} style={styles.heroTexture} resizeMode="cover" />
            <SafeAreaView edges={['top']}>
              <View style={styles.header}>
                <View style={styles.brandRow}>
                  <Image source={logo} style={styles.logo} resizeMode="cover" />
                  <View>
                    <Text style={styles.brandName}>Dabba Nation</Text>
                    <Text style={styles.brandTag}>Ghar ka khana, delivered</Text>
                  </View>
                </View>

                {/* Join Us — only show if not logged in */}
                {!user && (
                  <TouchableOpacity
                    style={styles.joinBtn}
                    onPress={() => navigation.navigate('SimpleLogin')}
                    accessibilityRole="button"
                  >
                    <Text style={styles.joinBtnText}>Join Us</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* LOCATION */}
              <TouchableOpacity style={styles.location} onPress={detectLocation} activeOpacity={0.85} accessibilityRole="button">
                <View style={styles.locIcon}>
                  <Ionicons name="location" size={16} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locLabel}>Deliver to</Text>
                  <Text style={styles.locValue} numberOfLines={1}>
                    {detecting ? 'Locating...' : location || 'Detect my location'}
                  </Text>
                </View>
                {detecting ? (
                  <ActivityIndicator size="small" color={PRIMARY} />
                ) : (
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>

              {/* HERO TEXT */}
              <Text style={styles.heroText}>
                What are you{' '}
                <Text style={styles.heroAccent}>craving</Text>
                {'\n'}today?
              </Text>
              <Text style={styles.heroSub}>
                From the warmth of a <Text style={styles.heroSubStrong}>Home Kitchen</Text> to the bold flavors of your{' '}
                <Text style={styles.heroSubStrong}>Favorite Bistro</Text>
              </Text>
            </SafeAreaView>
          </LinearGradient>

          {/* CARDS */}
          <View style={styles.section}>
            <Text style={styles.overline}>Choose your kitchen</Text>
            {kitchens.map((k) => (
              <TouchableOpacity
                key={k.key}
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => handleSelectType(k.key)}
                accessibilityRole="button"
                accessibilityLabel={`${k.title}. ${k.sub}`}
              >
                <Image source={k.image} style={styles.cardImg} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(48,37,29,0)', 'rgba(48,37,29,0.35)', 'rgba(48,37,29,0.88)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.cardTag}>
                  <MaterialCommunityIcons name={k.icon} size={13} color={PRIMARY} />
                  <Text style={styles.cardTagText}>{k.tag}</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{k.title}</Text>
                    <Text style={styles.cardSub} numberOfLines={2}>{k.sub}</Text>
                  </View>
                  <View style={styles.cardArrow}>
                    <Ionicons name="arrow-forward" size={18} color={colors.white} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {/* BROWSE */}
            <TouchableOpacity style={styles.browseBtn} onPress={handleBrowseAll} activeOpacity={0.85} accessibilityRole="button">
              <Text style={styles.browseLabel}>Can't decide?</Text>
              <View style={styles.browseAction}>
                <Text style={styles.browseActionText}>Browse everything</Text>
                <Ionicons name="arrow-forward" size={16} color={PRIMARY} />
              </View>
            </TouchableOpacity>
          </View>

          {/* MASCOTS — in their own card, so they never cover content */}
          <View style={styles.mascotCard}>
            <AnimatedCharacter side="left" imageSource={leftChar} delay={200} />
            <View style={styles.mascotCopy}>
              <Text style={styles.mascotTitle}>Made by real cooks</Text>
              <Text style={styles.mascotSub}>Home chefs and local kitchens from your neighbourhood.</Text>
            </View>
            <AnimatedCharacter side="right" imageSource={rightChar} delay={400} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.canvas,
  },
  preload: { width: 1, height: 1, opacity: 0, position: 'absolute' },
  loadingText: { ...type.label, color: PRIMARY, marginTop: spacing.md },

  // Hero
  hero: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroTexture: { ...StyleSheet.absoluteFill, width: '100%', height: '100%', opacity: 0.12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  brandName: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 22, color: colors.white },
  brandTag: { ...type.caption, color: 'rgba(255,255,255,0.8)' },
  joinBtn: {
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
  joinBtnText: { ...type.label, fontFamily: fonts.bold, color: PRIMARY },

  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    ...elevation.raised,
  },
  locIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locLabel: { ...type.overline, fontSize: 10, lineHeight: 12 },
  locValue: { ...type.subheading, marginTop: 1 },

  heroText: {
    marginTop: spacing.xxl,
    fontFamily: fonts.displayBold,
    fontSize: 34,
    lineHeight: 40,
    color: colors.white,
  },
  heroAccent: { fontFamily: fonts.displayItalic, fontStyle: 'italic', color: '#FFE7A8' },
  heroSub: {
    ...type.body,
    marginTop: spacing.sm,
    color: 'rgba(255,255,255,0.85)',
    maxWidth: 320,
  },
  heroSubStrong: { fontFamily: fonts.bold, color: colors.white },

  // Kitchen cards
  section: { paddingHorizontal: spacing.screen, marginTop: spacing.xxl },
  overline: { ...type.overline, marginBottom: spacing.md },
  card: {
    height: 184,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    ...elevation.card,
  },
  cardImg: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  cardTag: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  cardTagText: { ...type.caption, fontFamily: fonts.bold, color: colors.text },
  cardBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardTitle: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 30, color: colors.white },
  cardSub: { ...type.small, color: 'rgba(255,255,255,0.88)', marginTop: 2 },
  cardArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.brand,
  },

  browseBtn: {
    ...surfaces.flat,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 54,
    paddingHorizontal: spacing.lg,
  },
  browseLabel: { ...type.body, color: colors.textSecondary },
  browseAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  browseActionText: { ...type.label, fontFamily: fonts.bold, color: PRIMARY },

  // Mascots
  mascotCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: spacing.screen,
    marginTop: spacing.section,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  mascotCopy: { flex: 1, alignSelf: 'center', paddingBottom: spacing.lg },
  mascotTitle: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 24, color: colors.text, textAlign: 'center' },
  mascotSub: { ...type.caption, textAlign: 'center', marginTop: spacing.xs },
  animatedChar: { width: 76, height: 128 },
  charImage: { width: '100%', height: '100%' },
});
