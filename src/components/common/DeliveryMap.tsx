import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { colors } from '../../theme';

const WebView = Platform.OS !== 'web' ? require('react-native-webview').WebView : null;

export interface DeliveryMapProps {
  pickupCoords?: { lat: number; lng: number } | [number, number]; // [lng, lat] or { lat, lng }
  dropCoords?: { lat: number; lng: number } | [number, number];
  riderCoords?: { lat: number; lng: number } | [number, number] | null;
  riderHeading?: number | null;
  deliveryStage?: 'to_restaurant' | 'to_customer' | 'delivered';
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
  riderHeading = null,
  deliveryStage = 'to_customer',
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
    updateRiderLocation: (lat: number, lng: number, heading?: number | null, stage?: string) => {
      const payload = JSON.stringify({ type: 'riderUpdate', lat, lng, heading, stage });
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(payload, '*');
      } else {
        webRef.current?.postMessage(payload);
      }
    },
  }));

  // Send message on rider coords or stage change
  useEffect(() => {
    if (r) {
      const payload = JSON.stringify({
        type: 'riderUpdate',
        lat: r.lat,
        lng: r.lng,
        heading: riderHeading,
        stage: deliveryStage,
      });
      if (Platform.OS === 'web') {
        iframeRef.current?.contentWindow?.postMessage(payload, '*');
      } else {
        webRef.current?.postMessage(payload);
      }
    }
  }, [r?.lat, r?.lng, riderHeading, deliveryStage]);

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
    html: '<div style="background:#DC2828;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>',
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
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E8EFF5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .pulse-ring {
    position: absolute; width: 48px; height: 48px; border-radius: 50%;
    background: rgba(220, 40, 40,0.32); top: -4px; left: -4px;
    animation: pul 1.5s ease-out infinite; pointer-events: none;
  }
  @keyframes pul { 0% { transform: scale(0.75); opacity: 1; } 100% { transform: scale(1.9); opacity: 0; } }
  .rider-wrap {
    position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
  }
  .rider-bubble {
    position: relative; background: #DC2828; border-radius: 50%;
    width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
    border: 2.5px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.35);
    font-size: 19px; z-index: 2;
  }
  .heading-cone {
    position: absolute; top: -8px; left: 11px; width: 0; height: 0;
    border-left: 9px solid transparent; border-right: 9px solid transparent;
    border-bottom: 12px solid #DC2828; z-index: 1;
    filter: drop-shadow(0 -1px 2px rgba(0,0,0,0.2));
  }
  #eta-pill {
    position: fixed; bottom: 12px; left: 12px; z-index: 1000;
    background: rgba(17, 24, 39, 0.92); color: #fff;
    padding: 7px 12px; border-radius: 12px;
    display: flex; align-items: center; gap: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    font-size: 12px; font-weight: 700;
  }
  #eta-pill .eta-badge {
    background: #22C55E; color: #fff; padding: 3px 7px; border-radius: 7px;
    font-weight: 800; font-size: 11px;
  }
  #recenter-btn {
    position: fixed; bottom: 80px; right: 10px; z-index: 1000;
    width: 34px; height: 34px; border-radius: 10px;
    background: #fff; border: 1px solid #E5E7EB;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; cursor: pointer;
  }
</style>
</head>
<body>
<div id="map"></div>
<div id="eta-pill" style="display:none;">
  <span class="eta-badge" id="eta-time">-- min</span>
  <span id="eta-dist">Tracking...</span>
</div>
<div id="recenter-btn" title="Fit Route" onclick="recenterMap()">
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#111827" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var pickupPos = { lat: ${p.lat}, lng: ${p.lng} };
  var dropPos = { lat: ${d.lat}, lng: ${d.lng} };
  var currentStage = '${deliveryStage}';
  var followRider = true;
  var prevRiderPos = null;
  var lastRoutedPos = null;
  var lastRoutedStage = null;
  var animFrame = null;
  var storeSvg = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
  var homeSvg = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var scooterSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>';

  var map = L.map('map', {
    center: [${centerLat}, ${centerLng}],
    zoom: 14,
    zoomControl: false,
    attributionControl: false
  });

  map.on('dragstart', function() { followRider = false; });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: 'abc'
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Pickup marker (Store)
  var pickupIcon = L.divIcon({
    html: '<div style="background:#DC2828;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);">' + storeSvg + '</div>',
    iconSize: [34, 34], iconAnchor: [17, 34], className: ''
  });
  L.marker([pickupPos.lat, pickupPos.lng], { icon: pickupIcon })
    .addTo(map)
    .bindPopup('<b>${restaurantName.replace(/'/g, "\\'")}</b><br><small>Restaurant / Kitchen</small>');

  // Drop marker (Home)
  var dropIcon = L.divIcon({
    html: '<div style="background:#22C55E;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);">' + homeSvg + '</div>',
    iconSize: [34, 34], iconAnchor: [17, 34], className: ''
  });
  L.marker([dropPos.lat, dropPos.lng], { icon: dropIcon })
    .addTo(map)
    .bindPopup('<b>${dropLabel.replace(/'/g, "\\'")}</b><br><small>Delivery Location</small>');

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function calcBearing(lat1, lng1, lat2, lng2) {
    var dLon = (lng2 - lng1) * Math.PI / 180;
    var y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    var x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    var brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  function updateEtaPill(distKm, durationSec, stageLabel) {
    var pill = document.getElementById('eta-pill');
    var timeEl = document.getElementById('eta-time');
    var distEl = document.getElementById('eta-dist');
    if (!pill || !timeEl || !distEl) return;
    pill.style.display = 'flex';
    var mins = durationSec ? Math.max(1, Math.round(durationSec / 60)) : Math.max(1, Math.round((distKm / 25) * 60));
    timeEl.textContent = mins + ' min';
    var distStr = distKm < 1 ? Math.round(distKm * 1000) + ' m' : distKm.toFixed(1) + ' km';
    distEl.textContent = distStr + ' • ' + stageLabel;
  }

  function fetchOsrmRoute(fromLat, fromLng, toLat, toLng, callback) {
    var url = 'https://router.project-osrm.org/route/v1/driving/' +
      fromLng + ',' + fromLat + ';' + toLng + ',' + toLat +
      '?overview=full&geometries=geojson';
    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.routes && data.routes[0] && data.routes[0].geometry) {
          var coords = data.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
          callback(coords, data.routes[0].distance / 1000, data.routes[0].duration);
        } else {
          callback([[fromLat, fromLng], [toLat, toLng]], haversineKm(fromLat, fromLng, toLat, toLng), null);
        }
      })
      .catch(function() {
        callback([[fromLat, fromLng], [toLat, toLng]], haversineKm(fromLat, fromLng, toLat, toLng), null);
      });
  }

  // Base Store -> Customer road route
  var fullRouteLine = L.polyline([[pickupPos.lat, pickupPos.lng], [dropPos.lat, dropPos.lng]], {
    color: '#94A3B8', weight: 4, opacity: 0.65, dashArray: '6,8'
  }).addTo(map);
  var activeRouteLine = null;

  fetchOsrmRoute(pickupPos.lat, pickupPos.lng, dropPos.lat, dropPos.lng, function(coords, distKm, durSec) {
    if (fullRouteLine) fullRouteLine.setLatLngs(coords);
    if (!prevRiderPos) {
      updateEtaPill(distKm, durSec, 'Delivery Route');
    }
  });

  function recenterMap() {
    followRider = true;
    var pts = [[pickupPos.lat, pickupPos.lng], [dropPos.lat, dropPos.lng]];
    if (prevRiderPos) pts.push([prevRiderPos.lat, prevRiderPos.lng]);
    try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 17 }); } catch(e) {}
  }

  function buildRiderIcon(headingDeg) {
    var rot = headingDeg != null && !isNaN(headingDeg) ? headingDeg : 0;
    var coneHtml = headingDeg != null && !isNaN(headingDeg)
      ? '<div style="position:absolute;width:40px;height:40px;top:0;left:0;transform:rotate(' + rot + 'deg);"><div class="heading-cone"></div></div>'
      : '';
    return L.divIcon({
      html: '<div class="rider-wrap"><div class="pulse-ring"></div>' + coneHtml + '<div class="rider-bubble">' + scooterSvg + '</div></div>',
      iconSize: [40, 40], iconAnchor: [20, 20], className: ''
    });
  }

  function updateActiveRoute(rLat, rLng, stage) {
    var target = stage === 'to_restaurant' ? pickupPos : dropPos;
    var label = stage === 'to_restaurant' ? 'Rider reaching kitchen' : 'Arriving at your location';
    var lineColor = stage === 'to_restaurant' ? '#DC2828' : '#16A34A';

    var movedKm = lastRoutedPos ? haversineKm(lastRoutedPos.lat, lastRoutedPos.lng, rLat, rLng) : 999;
    if (movedKm < 0.03 && lastRoutedStage === stage) return;

    lastRoutedPos = { lat: rLat, lng: rLng };
    lastRoutedStage = stage;

    fetchOsrmRoute(rLat, rLng, target.lat, target.lng, function(coords, distKm, durSec) {
      if (activeRouteLine) {
        activeRouteLine.setLatLngs(coords);
        activeRouteLine.setStyle({ color: lineColor });
      } else {
        activeRouteLine = L.polyline(coords, {
          color: lineColor, weight: 5, opacity: 0.92, lineCap: 'round', lineJoin: 'round'
        }).addTo(map);
      }
      updateEtaPill(distKm, durSec, label);
    });
  }

  // Live Rider marker
  var riderMarker = null;
  function updateRider(lat, lng, heading, stage) {
    if (!lat || !lng) return;
    if (stage) currentStage = stage;

    var computedHeading = heading;
    if ((computedHeading == null || isNaN(computedHeading) || computedHeading < 0) && prevRiderPos) {
      var moved = haversineKm(prevRiderPos.lat, prevRiderPos.lng, lat, lng);
      if (moved > 0.004) {
        computedHeading = calcBearing(prevRiderPos.lat, prevRiderPos.lng, lat, lng);
      }
    }

    var riderIcon = buildRiderIcon(computedHeading);
    if (!riderMarker) {
      riderMarker = L.marker([lat, lng], { icon: riderIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup('<b>Delivery Partner</b><br><small>Live on the way</small>');
      prevRiderPos = { lat: lat, lng: lng };
      updateActiveRoute(lat, lng, currentStage);
      return;
    }

    riderMarker.setIcon(riderIcon);

    // Smooth Blinkit-style gliding animation over 2.2 seconds
    var startLat = prevRiderPos ? prevRiderPos.lat : lat;
    var startLng = prevRiderPos ? prevRiderPos.lng : lng;
    prevRiderPos = { lat: lat, lng: lng };

    if (animFrame) cancelAnimationFrame(animFrame);
    var startTime = performance.now();
    var duration = 2200;

    function animateStep(now) {
      var t = Math.min(1, (now - startTime) / duration);
      var ease = t * (2 - t);
      var curLat = startLat + (lat - startLat) * ease;
      var curLng = startLng + (lng - startLng) * ease;
      riderMarker.setLatLng([curLat, curLng]);
      if (t < 1) {
        animFrame = requestAnimationFrame(animateStep);
      }
    }
    animFrame = requestAnimationFrame(animateStep);

    updateActiveRoute(lat, lng, currentStage);

    if (followRider && map) {
      var target = currentStage === 'to_restaurant' ? pickupPos : dropPos;
      try {
        map.fitBounds([[lat, lng], [target.lat, target.lng]], { padding: [45, 45], maxZoom: 17, animate: true });
      } catch(e) {}
    }
  }

  ${r ? `updateRider(${r.lat}, ${r.lng}, ${riderHeading ?? 'null'}, '${deliveryStage}');` : ''}

  var pts = [[pickupPos.lat, pickupPos.lng], [dropPos.lat, dropPos.lng]];
  ${r ? `pts.push([${r.lat}, ${r.lng}]);` : ''}
  try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 }); } catch(e) {}

  function onMsg(raw) {
    try {
      var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (data && data.type === 'riderUpdate' && data.lat && data.lng) {
        updateRider(data.lat, data.lng, data.heading, data.stage);
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
        <ActivityIndicator color={colors.primary} />
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
    borderColor: colors.border,
    backgroundColor: colors.infoSoft,
  },
  map: {
    flex: 1,
  },
});

export default DeliveryMap;
