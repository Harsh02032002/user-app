import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';

const WebView = Platform.OS !== 'web' ? require('react-native-webview').WebView : null;

export interface DeliveryMapProps {
  pickupCoords?: { lat: number; lng: number } | [number, number]; // [lng, lat] or { lat, lng }
  dropCoords?: { lat: number; lng: number } | [number, number];
  riderCoords?: { lat: number; lng: number } | [number, number] | null;
  /** Customer's current location ([lng, lat] or { lat, lng }). If given without pickup/drop, map shows a single pin. */
  userCoords?: { lat: number; lng: number } | [number, number] | null;
  restaurantName?: string;
  dropLabel?: string;
  height?: number;
  style?: any;
}

function parseLatLng(coords?: { lat: number; lng: number } | [number, number] | null): { lat: number; lng: number } | null {
  if (!coords) return null;
  if (Array.isArray(coords)) {
    if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      // In GeoJSON, coords are [lng, lat]
      return { lat: Number(coords[1]), lng: Number(coords[0]) };
    }
    return null;
  }
  if (coords.lat != null && coords.lng != null && !isNaN(coords.lat) && !isNaN(coords.lng)) {
    return { lat: Number(coords.lat), lng: Number(coords.lng) };
  }
  return null;
}

export const DeliveryMap = forwardRef<any, DeliveryMapProps>(({
  pickupCoords,
  dropCoords,
  riderCoords,
  userCoords,
  restaurantName = 'Store',
  dropLabel = 'Delivery Address',
  height = 240,
  style,
}, ref) => {
  const webRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const p = parseLatLng(pickupCoords) || { lat: 30.7333, lng: 76.7794 };
  let d = parseLatLng(dropCoords) || { lat: p.lat + 0.009, lng: p.lng + 0.007 };

  // Sanity check: If drop is >35km from pickup, clamp drop near pickup so map stays focused locally
  const dist = Math.hypot(p.lat - d.lat, p.lng - d.lng) * 111;
  if (dist > 35) {
    d = { lat: p.lat + 0.009, lng: p.lng + 0.007 };
  }

  const r = parseLatLng(riderCoords);
  const u = parseLatLng(userCoords);
  const userOnlyMode = !!u && !pickupCoords && !dropCoords;

  const centerLat = +((p.lat + d.lat) / 2).toFixed(6);
  const centerLng = +((p.lng + d.lng) / 2).toFixed(6);

  useImperativeHandle(ref, () => ({
    updateRiderLocation: (lat: number, lng: number) => {
      const payload = JSON.stringify({ type: 'riderUpdate', lat, lng });
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(payload, '*');
      } else {
        webRef.current?.postMessage(payload);
      }
    },
  }));

  // Send message on rider coords change
  useEffect(() => {
    if (r) {
      const payload = JSON.stringify({ type: 'riderUpdate', lat: r.lat, lng: r.lng });
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(payload, '*');
      } else {
        webRef.current?.postMessage(payload);
      }
    }
  }, [r?.lat, r?.lng]);

  const userOnlyHtml = u ? `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E8EFF5; }</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { center: [${u.lat}, ${u.lng}], zoom: 16, zoomControl: false, attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, subdomains: 'abc' }).addTo(map);
  var icon = L.divIcon({
    html: '<div style="background:#FF6B00;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:15px;">📍</div>',
    iconSize: [30, 30], iconAnchor: [15, 30], className: ''
  });
  L.marker([${u.lat}, ${u.lng}], { icon: icon }).addTo(map).bindPopup('<b>Your Location</b>');
</script>
</body>
</html>` : '';

  const routeHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E8EFF5; }
  .pulse-ring {
    position: absolute; width: 44px; height: 44px; border-radius: 50%;
    background: rgba(255,107,0,0.35); top: -4px; left: -4px;
    animation: pul 1.6s ease-out infinite; pointer-events: none;
  }
  @keyframes pul { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
  .rider-bubble {
    position: relative; background: #FF6B00; border-radius: 50%;
    width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
    border: 2.5px solid #fff; box-shadow: 0 3px 8px rgba(0,0,0,0.35);
    font-size: 18px;
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', {
    center: [${centerLat}, ${centerLng}],
    zoom: 14,
    zoomControl: false,
    attributionControl: false
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc'
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Pickup marker (Store)
  var pickupIcon = L.divIcon({
    html: '<div style="background:#FF6B00;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:16px;">🏪</div>',
    iconSize: [34, 34], iconAnchor: [17, 34], className: ''
  });
  L.marker([${p.lat}, ${p.lng}], { icon: pickupIcon })
    .addTo(map)
    .bindPopup('<b>📦 ${restaurantName.replace(/'/g, "\\'")}</b><br><small>Restaurant / Kitchen</small>');

  // Drop marker (Home)
  var dropIcon = L.divIcon({
    html: '<div style="background:#22C55E;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);font-size:16px;">🏠</div>',
    iconSize: [34, 34], iconAnchor: [17, 34], className: ''
  });
  L.marker([${d.lat}, ${d.lng}], { icon: dropIcon })
    .addTo(map)
    .bindPopup('<b>📍 ${dropLabel.replace(/'/g, "\\'")}</b><br><small>Delivery Location</small>');

  // Route dashed polyline
  L.polyline([[${p.lat}, ${p.lng}], [${d.lat}, ${d.lng}]], {
    color: '#3B82F6', weight: 4, opacity: 0.8, dashArray: '8,6'
  }).addTo(map);

  // Live Rider marker
  var riderMarker = null;
  function updateRider(lat, lng) {
    if (!lat || !lng) return;
    var riderIcon = L.divIcon({
      html: '<div style="position:relative"><div class="pulse-ring"></div><div class="rider-bubble">🛵</div></div>',
      iconSize: [36, 36], iconAnchor: [18, 18], className: ''
    });
    if (riderMarker) {
      riderMarker.setLatLng([lat, lng]);
    } else {
      riderMarker = L.marker([lat, lng], { icon: riderIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<b>🛵 Delivery Partner</b><br><small>On the way to you</small>');
    }
  }

  ${r ? `updateRider(${r.lat}, ${r.lng});` : ''}

  var pts = [[${p.lat}, ${p.lng}], [${d.lat}, ${d.lng}]];
  ${r ? `pts.push([${r.lat}, ${r.lng}]);` : ''}
  try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 }); } catch(e) {}

  function onMsg(raw) {
    try {
      var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (data && data.type === 'riderUpdate' && data.lat && data.lng) {
        updateRider(data.lat, data.lng);
      }
    } catch(e) {}
  }
  document.addEventListener('message', function(e) { onMsg(e.data); });
  window.addEventListener('message', function(e) { onMsg(e.data); });
</script>
</body>
</html>`;

  const html = userOnlyMode ? userOnlyHtml : routeHtml;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height }, style]}>
        {/* @ts-ignore */}
        <iframe
          ref={iframeRef}
          srcDoc={html}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Delivery Map"
        />
      </View>
    );
  }

  if (!WebView) {
    return (
      <View style={[styles.container, { height, justifyContent: 'center', alignItems: 'center' }, style]}>
        <ActivityIndicator color="#FF6B00" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.map}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
      />
    </View>
  );
});

DeliveryMap.displayName = 'DeliveryMap';

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#E8EFF5',
  },
  map: {
    flex: 1,
  },
});

export default DeliveryMap;
