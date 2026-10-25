import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

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
  // Classic referee whistle: round barrel, mouthpiece with sound slot,
  // the pea inside, and the lanyard ring.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.2 8.2 H20.6 a0.8 0.8 0 0 1 0.8 0.8 V11.2 a0.8 0.8 0 0 1 -0.8 0.8 H15 A6 6 0 1 1 9.2 8.2 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M12.6 8.2 V10.4 H15.2 V8.2" stroke={color} strokeWidth={strokeWidth * 0.85} strokeLinejoin="round" />
      <Circle cx={9.2} cy={14.2} r={2} fill={color} />
      <Circle cx={4.3} cy={7.4} r={1.7} stroke={color} strokeWidth={strokeWidth * 0.85} />
    </Svg>
  );
}
