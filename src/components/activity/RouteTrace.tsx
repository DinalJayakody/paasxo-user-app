import React, { useMemo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * The route as a vector line (no map tiles) — for share-card designs whose
 * background isn't the map, so every design still shows where you went.
 * Projects lat/lng with an equirectangular approximation (fine at the scale
 * of a run) and keeps the route's aspect ratio inside the box.
 */
export function RouteTrace({
  coords, width, height, color = '#FFFFFF', strokeWidth = 4,
}: {
  coords: { latitude: number; longitude: number }[];
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
}) {
  const geo = useMemo(() => {
    if (!coords || coords.length < 2) return null;
    // Down-sample long routes — a share card never needs >400 vertices.
    const step = Math.max(1, Math.floor(coords.length / 400));
    const pts = coords.filter((_, i) => i % step === 0 || i === coords.length - 1);
    const lat0 = pts.reduce((a, p) => a + p.latitude, 0) / pts.length;
    const kx = Math.cos((lat0 * Math.PI) / 180);
    const xs = pts.map((p) => p.longitude * kx);
    const ys = pts.map((p) => -p.latitude);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX || 1e-9;
    const spanY = maxY - minY || 1e-9;
    const pad = strokeWidth * 2;
    const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
    const offX = (width - spanX * scale) / 2;
    const offY = (height - spanY * scale) / 2;
    const P = xs.map((x, i) => [offX + (x - minX) * scale, offY + (ys[i] - minY) * scale]);
    const d = P.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    return { d, start: P[0], end: P[P.length - 1] };
  }, [coords, width, height, strokeWidth]);

  if (!geo) return null;
  return (
    <Svg width={width} height={height}>
      <Path d={geo.d} stroke="rgba(0,0,0,0.25)" strokeWidth={strokeWidth + 3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={geo.d} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={geo.start[0]} cy={geo.start[1]} r={strokeWidth * 1.3} fill="#22C55E" stroke="#fff" strokeWidth={2} />
      <Circle cx={geo.end[0]} cy={geo.end[1]} r={strokeWidth * 1.3} fill="#EF4444" stroke="#fff" strokeWidth={2} />
    </Svg>
  );
}
