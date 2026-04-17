import * as Location from 'expo-location';
import { Platform } from 'react-native';

type Coordinates = {
  latitude: number;
  longitude: number;
};

type AddressLike = {
  latitude?: number | string | null;
  longitude?: number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  location?: {
    coordinates?: [number, number] | number[] | null;
  } | null;
} | null | undefined;

export const DEFAULT_LOCATION_LABEL = 'Mumbai, Maharashtra';
export const isWeb = Platform.OS === 'web';

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const requestLocationPermission = async () => {
  const permission = await Location.requestForegroundPermissionsAsync();
  return permission.status === 'granted';
};

export const getCurrentCoordinates = async (): Promise<Coordinates | null> => {
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    return null;
  }

  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
  } catch (error) {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (!lastKnown) {
      return null;
    }

    return {
      latitude: lastKnown.coords.latitude,
      longitude: lastKnown.coords.longitude,
    };
  }
};

export const getReadableLocation = async (): Promise<string> => {
  const coords = await getCurrentCoordinates();
  if (!coords) {
    return DEFAULT_LOCATION_LABEL;
  }

  // Skip geocoding on web - SDK 49 removed geocoding API on web
  if (isWeb) {
    return 'Current Location';
  }

  // Only use geocoding on native platforms (Android/iOS)
  try {
    const geo = await Location.reverseGeocodeAsync(coords);
    const place = geo[0];

    if (place) {
      // Build address from available fields
      const city = place.city || place.district || place.subregion;
      const region = place.region || place.country;
      
      if (city) {
        return region ? `${city}, ${region}` : city;
      }
      
      // If no city but have street address, use that
      if (place.street || place.name) {
        const street = place.street || place.name;
        const area = place.subregion || place.city || '';
        return area ? `${street}, ${area}` : street;
      }
    }
  } catch (error) {
    console.warn('Reverse geocode failed:', error);
  }

  return 'Current Location';
};

export const extractCoordinates = (address?: AddressLike): Coordinates | null => {
  if (!address) {
    return null;
  }

  const latitude =
    toNumber(address.latitude) ??
    toNumber(address.lat) ??
    toNumber(address.location?.coordinates?.[1]);
  const longitude =
    toNumber(address.longitude) ??
    toNumber(address.lng) ??
    toNumber(address.location?.coordinates?.[0]);

  if (latitude == null || longitude == null) {
    return null;
  }

  if (latitude === 0 && longitude === 0) {
    return null;
  }

  return { latitude, longitude };
};
