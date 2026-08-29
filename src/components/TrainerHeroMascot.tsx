import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay,
  FadeIn, Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Ellipse, Circle, Path } from 'react-native-svg';
import { Colors } from '../styles/colors';

interface Props {
  size?: number;
  style?: ViewStyle;
}

/**
 * Small hand-drawn "coach" character (SVG shapes, no image assets) used on the
 * Trainer profile screen for an eye-catching entrance, in the Paasxo blue
 * theme accent — mirrors the vendor-app's Mascot component's construction style.
 */
export default function TrainerHeroMascot({ size = 96, style }: Props) {
  const bob = useSharedValue(0);
  const armSwing = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    armSwing.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  return (
    <Animated.View entering={FadeIn.duration(500)} style={[{ width: size, height: size }, bobStyle, style]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <LinearGradient id="trainerBody" x1="20%" y1="0%" x2="90%" y2="100%">
            <Stop offset="0%" stopColor={Colors.primaryAccent} />
            <Stop offset="55%" stopColor={Colors.trainer} />
            <Stop offset="100%" stopColor={Colors.primaryDark} />
          </LinearGradient>
        </Defs>

        <Ellipse cx={78} cy={182} rx={16} ry={8} fill={Colors.primaryDark} opacity={0.85} />
        <Ellipse cx={124} cy={182} rx={16} ry={8} fill={Colors.primaryDark} opacity={0.85} />

        {/* legs */}
        <Path d="M86 150 L80 180" stroke="url(#trainerBody)" strokeWidth={14} strokeLinecap="round" />
        <Path d="M116 150 L122 180" stroke="url(#trainerBody)" strokeWidth={14} strokeLinecap="round" />

        {/* body */}
        <Ellipse cx={101} cy={122} rx={46} ry={54} fill="url(#trainerBody)" />

        {/* left arm holding a small dumbbell */}
        <Path d="M62 110 Q40 118 34 100" stroke="url(#trainerBody)" strokeWidth={14} strokeLinecap="round" fill="none" />
        <Path d="M22 92 h24" stroke={Colors.primaryDark} strokeWidth={6} strokeLinecap="round" />
        <Circle cx={20} cy={92} r={9} fill={Colors.primaryDark} />
        <Circle cx={48} cy={92} r={9} fill={Colors.primaryDark} />

        {/* right arm — raised, animates via bob for a lively feel */}
        <Path d="M140 108 Q164 96 158 68" stroke="url(#trainerBody)" strokeWidth={14} strokeLinecap="round" fill="none" />
        <Circle cx={158} cy={64} r={10} fill={Colors.primaryAccent} />

        {/* head */}
        <Circle cx={101} cy={72} r={34} fill="url(#trainerBody)" />
        <Ellipse cx={88} cy={62} rx={9} ry={6} fill={Colors.white} opacity={0.25} />

        {/* headband */}
        <Path d="M68 66 Q101 50 134 66 L134 58 Q101 42 68 58 Z" fill={Colors.white} />

        {/* face */}
        <Ellipse cx={90} cy={74} rx={6} ry={7} fill={Colors.white} />
        <Ellipse cx={114} cy={74} rx={6} ry={7} fill={Colors.white} />
        <Circle cx={92} cy={76} r={3} fill={Colors.text} />
        <Circle cx={116} cy={76} r={3} fill={Colors.text} />
        <Path d="M90 90 Q101 100 113 90" stroke={Colors.text} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}
