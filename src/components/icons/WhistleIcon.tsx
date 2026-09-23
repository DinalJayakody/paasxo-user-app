import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// A referee/coach whistle — used in place of a generic bell for the Explore
// page's notification trigger, matching this screen's sports-discovery
// theme (ExploreScreen.tsx). Drawn in the same stroke-icon style as the
// lucide-react-native icons used everywhere else (currentColor stroke,
// round caps/joins, 24x24 viewBox) so it drops in as a like-for-like swap.
export function WhistleIcon({
  color = '#000',
  size = 24,
  strokeWidth = 2,
}: {
  color?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={4} cy={13} r={2.4} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={5.6} y={9} width={11} height={8} rx={4} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={10.2} cy={9.4} r={1} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M18 10.5 Q20.5 13 18 15.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 9 Q23.5 13 20 17"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
