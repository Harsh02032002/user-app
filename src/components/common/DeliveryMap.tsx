import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

// Only require WebView on native platforms
const WebView = Platform.OS !== 'web' ? require('react-native-webview').WebView : null;

interface DeliveryMapProps {
  pickupCoords?: [number, number]; // [lng, lat]
  dropCoords?: [number, number];   // [lng, lat]
  userCoords?: [number, number];   // [lng, lat]
  height?: number;
}

export const DeliveryMap = ({ pickupCoords, dropCoords, userCoords, height = 200 }: DeliveryMapProps) => {
  // Center on user coords if available, else midpoint
  let centerLat = 28.6139; // Delhi fallback
  let centerLng = 77.2090;

  if (userCoords) {
    centerLat = userCoords[1];
    centerLng = userCoords[0];
  } else if (pickupCoords && dropCoords) {
    centerLat = (pickupCoords[1] + dropCoords[1]) / 2;
    centerLng = (pickupCoords[0] + dropCoords[0]) / 2;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { margin: 0; padding: 0; background: #f0f0f0; }
          #map { height: 100vh; width: 100vw; }
          .custom-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            color: white;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          const map = L.map('map', {
            zoomControl: false,
            attributionControl: false
          }).setView([${centerLat}, ${centerLng}], 15);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

          ${userCoords ? `
          const userIcon = L.divIcon({
            html: '<div class="custom-icon" style="background: #FF6B00; width: 24px; height: 24px; font-size: 12px;">📍</div>',
            iconSize: [24, 24],
            className: ''
          });
          L.marker([${userCoords[1]}, ${userCoords[0]}], { icon: userIcon }).addTo(map);
          ` : ''}

          ${pickupCoords && dropCoords ? `
          const pickupIcon = L.divIcon({
            html: '<div class="custom-icon" style="background: #3B82F6; width: 30px; height: 30px; font-size: 15px;">🏪</div>',
            iconSize: [30, 30],
            className: ''
          });
          const dropIcon = L.divIcon({
            html: '<div class="custom-icon" style="background: #10B981; width: 30px; height: 30px; font-size: 15px;">🏠</div>',
            iconSize: [30, 30],
            className: ''
          });

          L.marker([${pickupCoords[1]}, ${pickupCoords[0]}], { icon: pickupIcon }).addTo(map);
          L.marker([${dropCoords[1]}, ${dropCoords[0]}], { icon: dropIcon }).addTo(map);

          const polyline = L.polyline([[${pickupCoords[1]}, ${pickupCoords[0]}], [${dropCoords[1]}, ${dropCoords[0]}]], {
            color: '#FF6B00',
            weight: 3,
            dashArray: '10, 10'
          }).addTo(map);

          map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
          ` : ''}
        </script>
      </body>
    </html>
  `;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height }]}>
        <iframe
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Delivery Map"
        />
      </View>
    );
  }

  if (!WebView) return null;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.map}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
});
