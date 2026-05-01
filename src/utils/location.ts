import * as Location from 'expo-location';
import { Platform } from 'react-native';

export const DEFAULT_LOCATION_LABEL = 'Detecting location...';
export const isWeb = Platform.OS === 'web';

let isFetching = false;
let lastLocation = DEFAULT_LOCATION_LABEL;
let lastFetchTime = 0;

export const requestLocationPermission = async () => {
  const permission = await Location.requestForegroundPermissionsAsync();
  return permission.status === 'granted';
};

export const getCurrentCoordinates = async () => {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
  } catch (error) {
    console.warn('Error getting coordinates:', error);
    return null;
  }
};

export const getReadableLocation = async (): Promise<string> => {
  const now = Date.now();
  // Return cached location if fetched recently (within 1 minute)
  if (lastLocation !== DEFAULT_LOCATION_LABEL && now - lastFetchTime < 60000) {
    return lastLocation;
  }

  if (isFetching) return lastLocation;
  isFetching = true;

  try {
    const coords = await getCurrentCoordinates();
    if (!coords) {
      isFetching = false;
      return lastLocation;
    }

    let locationStr = 'Current Location';

    if (isWeb) {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const city = addr.city || addr.town || addr.village || addr.suburb;
        const state = addr.state || addr.region;
        locationStr = city && state ? `${city}, ${state}` : data.display_name.split(',')[0];
      }
    } else {
      const geo = await Location.reverseGeocodeAsync(coords);
      if (geo[0]) {
        const place = geo[0];
        locationStr = place.city ? (place.region ? `${place.city}, ${place.region}` : place.city) : 'Current Location';
      }
    }

    lastLocation = locationStr;
    lastFetchTime = Date.now();
    return locationStr;
  } catch (error) {
    console.warn('Location fetch failed:', error);
    return lastLocation;
  } finally {
    isFetching = false;
  }
};

export const extractCoordinates = (addressObj: any) => {
  if (!addressObj) return null;
  
  // Try location.coordinates [lng, lat] (standard GeoJSON)
  if (addressObj.location?.coordinates && Array.isArray(addressObj.location.coordinates)) {
    return {
      longitude: addressObj.location.coordinates[0],
      latitude: addressObj.location.coordinates[1]
    };
  }
  
  // Try direct lat/lng or latitude/longitude
  const lat = addressObj.latitude || addressObj.lat;
  const lng = addressObj.longitude || addressObj.lng;
  
  if (lat !== undefined && lng !== undefined) {
    return {
      latitude: Number(lat),
      longitude: Number(lng)
    };
  }
  
  return null;
};
