// Stub for react-native-maps on web — Metro alias routes here via metro.config.js
import React from 'react';
import { View } from 'react-native';

const MapView = ({ children, style, ...rest }) =>
  React.createElement(View, { style }, children);

const Marker = () => null;
const Callout = () => null;
const Polyline = () => null;
const Polygon = () => null;
const Circle = () => null;

const PROVIDER_GOOGLE = 'google';
const PROVIDER_DEFAULT = null;

export { Marker, Callout, Polyline, Polygon, Circle, PROVIDER_GOOGLE, PROVIDER_DEFAULT };
export default MapView;
