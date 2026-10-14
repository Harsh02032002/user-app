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

const { width, height } = Dimensions.get('window');

const PRIMARY = "#FF6B00";

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
      style={[
        styles.animatedChar,
        side === 'left' ? styles.charLeft : styles.charRight,
        { opacity, transform: [{ translateY }] },
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

  // ✅ Stable callback: react-native-web's Image re-runs its load effect whenever the
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

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Background */}
      <Image 
        source={heroBg} 
        style={styles.bg} 
        resizeMode="cover" 
        onLoad={handleImageLoad}
        onError={handleImageLoad}
      />
      <View style={styles.overlay} />

      {!imagesLoaded ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
      <SafeAreaView style={{ flex: 1 }}>

        {/* HEADER */}
        <View style={styles.header}>
          <Image 
            source={logo} 
            style={styles.logo}
            resizeMode="cover"
          />

          {/* Join Us — only show if not logged in */}
          {!user && (
            <TouchableOpacity 
              style={styles.joinBtnWrapper}
              onPress={() => navigation.navigate('SimpleLogin')}
            >
              <LinearGradient
                colors={['#FF6B00', '#4CAF50']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.joinBtn}
              >
                <Text style={styles.joinBtnText}>Join Us</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
        >

          {/* LOCATION */}
          <View style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity style={styles.location} onPress={detectLocation}>
              <Ionicons name="location" size={18} color={PRIMARY} />
              <View style={{ marginHorizontal: 10 }}>
                <Text style={styles.locLabel}>DELIVER TO</Text>
                <Text style={styles.locValue}>
                  {detecting ? 'Locating...' : location || 'Detect my location'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color="#555" />
            </TouchableOpacity>

          </View>

          {/* HERO TEXT */}
          <View style={styles.hero}>
            <Text style={styles.heroText}>
              What are you{' '}
              <Text style={{ color: PRIMARY, fontStyle: 'italic' }}>craving</Text>
              {' '}today?
            </Text>

            {/* ✅ Fix: Added missing subtitle line from web */}
            <Text style={styles.heroSub}>
              From the warmth of a{' '}
              <Text style={{ fontWeight: '700', color: PRIMARY }}>Home Kitchen</Text>
              {' '}to the bold flavors of your{' '}
              <Text style={{ fontWeight: '700', color: PRIMARY }}>Favorite Bistro</Text>
            </Text>
          </View>

          {/* CARDS */}
          <View style={styles.cards}>

            {/* HOME CHEF */}
            <TouchableOpacity 
              style={styles.card} 
              activeOpacity={0.9}
              onPress={() => handleSelectType('home_chef')}
            >
              <Image 
                source={homeChef} 
                style={styles.cardImg} 
                resizeMode="cover" 
              />
              <View style={styles.cardOverlay}>
                <MaterialCommunityIcons name="home-heart" size={22} color="#fff" />
                <Text style={styles.cardTitle}>Home Chef</Text>
                <Text style={styles.cardSub}>Ghar jaisa swad. Fresh dabbas made with love.</Text>
              </View>
            </TouchableOpacity>

            {/* RESTAURANT */}
            <TouchableOpacity 
              style={styles.card} 
              activeOpacity={0.9}
              onPress={() => handleSelectType('restaurant')}
            >
              <Image 
                source={restaurant} 
                style={styles.cardImg} 
                resizeMode="cover" 
              />
              <View style={styles.cardOverlay}>
                <MaterialCommunityIcons name="store" size={22} color="#fff" />
                <Text style={styles.cardTitle}>Restaurant</Text>
                <Text style={styles.cardSub}>Signature dishes from top-rated restaurants.</Text>
              </View>
            </TouchableOpacity>

          </View>

          {/* BROWSE */}
          <TouchableOpacity onPress={handleBrowseAll}>
            <Text style={styles.browse}>
              Can't decide?{' '}
              <Text style={{ color: PRIMARY, textDecorationLine: 'underline' }}>
                Browse everything
              </Text>
            </Text>
          </TouchableOpacity>

          {/* Spacer so characters don't overlap browse text */}
          <View style={{ height: 100 }} />

        </ScrollView>
      </SafeAreaView>
      )}

      {/* ✅ Characters rendered OUTSIDE ScrollView so they stay fixed at bottom */}
      {imagesLoaded && (
        <>
          <AnimatedCharacter side="left"  imageSource={leftChar}  delay={200} />
          <AnimatedCharacter side="right" imageSource={rightChar} delay={400} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  bg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'center',
  },

  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },

  // Seller Portal — gradient border with transparent inner
  sellerBtnWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },

  sellerBtnGradientBorder: {
    padding: 1.5,
    borderRadius: 20,
  },

  sellerBtnInner: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 19,
  },

  sellerBtnText: {
    fontWeight: '700',
    fontSize: 13,
    // gradient text effect via orange (closest we can do without extra lib)
    color: '#FF6B00',
  },

  // Join Us — solid gradient fill
  joinBtnWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#FF6B00',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 3px 6px rgba(255, 107, 0, 0.35)',
      },
    }),
  },

  joinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },

  joinBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  scroll: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 16,
  },

  location: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 25,
    marginBottom: 25,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
      },
    }),
  },

  locLabel: {
    fontSize: 10,
    color: '#888',
    letterSpacing: 0.5,
    fontWeight: '600',
  },

  locValue: {
    fontSize: 14,
    fontWeight: '500',
  },

  hero: {
    marginBottom: 24,
    alignItems: 'center',
  },

  heroText: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 38,
  },

  // ✅ New: subtitle matching web
  heroSub: {
    marginTop: 8,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: width * 0.75,
  },

  cards: {
    alignItems: 'center',
    gap: 14,
  },

  card: {
    width: width * 0.72,
    height: width * 0.46,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.18)',
      },
    }),
  },

  cardImg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },

  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    // gradient effect via semi-transparent black
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },

  cardSub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    marginTop: 2,
  },

  browse: {
    marginTop: 18,
    color: '#666',
    fontSize: 13,
  },

  // ✅ Fixed character positioning to prevent cutting and removed overflow: hidden
  animatedChar: {
    position: 'absolute',
    width: width * 0.35,
    height: width * 0.60,
    zIndex: 10,
    bottom: 45, // Moved up slightly
  },

  charLeft: {
    left: -10,
  },

  charRight: {
    right: -10,
  },

  charImage: {
    width: '100%',
    height: '100%',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: PRIMARY,
    fontWeight: '600',
  },
});
