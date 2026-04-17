// Mock for react-native-maps on web
// This file is used as an alias when bundling for web

const React = require('react');
const { View } = require('react-native');

// Mock MapView component
const MapView = (props) => React.createElement(View, { style: props.style }, props.children);
MapView.Marker = (props) => React.createElement(View, null, props.children);
MapView.Callout = (props) => React.createElement(View, null, props.children);
MapView.Circle = (props) => React.createElement(View, null);
MapView.Polygon = (props) => React.createElement(View, null);
MapView.Polyline = (props) => React.createElement(View, null);

// Mock Marker component
const Marker = (props) => React.createElement(View, null, props.children);
Marker.Animated = Marker;

// Mock constants
const PROVIDER_DEFAULT = null;
const PROVIDER_GOOGLE = 'google';

module.exports = {
  default: MapView,
  MapView,
  Marker,
  Callout: MapView.Callout,
  Circle: MapView.Circle,
  Polygon: MapView.Polygon,
  Polyline: MapView.Polyline,
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
};
