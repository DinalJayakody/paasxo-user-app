import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { Colors } from '../../styles/colors';

// Self-contained react-native-svg character illustrations for the Friends
// screen's empty states — no external image assets or network requests.
// Each is wrapped in a gentle looping bob using the plain RN Animated API,
// matching this app's existing convention (see FriendsScreen's ScalePressable,
// which also uses Animated rather than reanimated).

function useBounce(distance: number = 6, duration: number = 1400) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration]);

  const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] });
  return translateY;
}

function BounceWrap({ children, distance, duration }: { children: React.ReactNode; distance?: number; duration?: number }) {
  const translateY = useBounce(distance, duration);
  return <Animated.View style={{ transform: [{ translateY }] }}>{children}</Animated.View>;
}

const BODY = Colors.primary;
const BODY_DARK = Colors.primaryDark;
const SKIN = Colors.primaryLight;
const ACCENT = Colors.white;

/** Waving friendly blob character — empty Followers tab. */
export function NoFollowersIllustration({ size = 132 }: { size?: number }) {
  const armAngle = useBounce(1, 900);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <BounceWrap distance={5}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Ellipse cx="60" cy="104" rx="30" ry="6" fill={Colors.neutral200} opacity={0.5} />
          <Circle cx="60" cy="60" r="38" fill={SKIN} />
          <Circle cx="60" cy="58" r="30" fill={BODY} />
          <Circle cx="49" cy="54" r="4.5" fill={ACCENT} />
          <Circle cx="71" cy="54" r="4.5" fill={ACCENT} />
          <Path d="M48 68 Q60 78 72 68" stroke={ACCENT} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Circle cx="90" cy="40" r="9" fill={BODY_DARK} />
        </Svg>
      </BounceWrap>
      <Animated.View
        style={{
          position: 'absolute',
          right: size * 0.14,
          top: size * 0.18,
          transform: [
            {
              rotate: armAngle.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '18deg'] }),
            },
          ],
        }}
      >
        <Svg width={26} height={26} viewBox="0 0 26 26">
          <Circle cx="13" cy="13" r="10" fill={BODY_DARK} />
          <Path d="M9 13 L17 13 M13 9 L13 17" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Character holding a magnifying glass — empty Following tab. */
export function NoFollowingIllustration({ size = 132 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <BounceWrap distance={5} duration={1600}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Ellipse cx="60" cy="104" rx="30" ry="6" fill={Colors.neutral200} opacity={0.5} />
          <Circle cx="60" cy="62" r="34" fill={BODY} />
          <Circle cx="50" cy="58" r="4" fill={ACCENT} />
          <Circle cx="70" cy="58" r="4" fill={ACCENT} />
          <Path d="M50 72 Q60 68 70 72" stroke={ACCENT} strokeWidth={3} strokeLinecap="round" fill="none" />
          {/* Magnifying glass */}
          <Circle cx="86" cy="82" r="12" fill="none" stroke={BODY_DARK} strokeWidth={5} />
          <Path d="M95 91 L104 100" stroke={BODY_DARK} strokeWidth={5} strokeLinecap="round" />
        </Svg>
      </BounceWrap>
    </View>
  );
}

/** Character giving a thumbs-up / checkmark — empty Requests tab. */
export function AllCaughtUpIllustration({ size = 132 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <BounceWrap distance={6} duration={1300}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Ellipse cx="60" cy="104" rx="30" ry="6" fill={Colors.neutral200} opacity={0.5} />
          <Circle cx="60" cy="60" r="36" fill={BODY} />
          <Circle cx="49" cy="56" r="4.5" fill={ACCENT} />
          <Circle cx="71" cy="56" r="4.5" fill={ACCENT} />
          <Path d="M47 68 Q60 80 73 68" stroke={ACCENT} strokeWidth={3.5} strokeLinecap="round" fill="none" />
          {/* Checkmark badge */}
          <Circle cx="90" cy="86" r="16" fill={Colors.success} />
          <Path d="M83 86 L88 91 L98 80" stroke={ACCENT} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </BounceWrap>
    </View>
  );
}

/** Character with a compass — empty Suggested tab. */
export function NoSuggestionsIllustration({ size = 132 }: { size?: number }) {
  const needleSpin = useBounce(1, 2000);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <BounceWrap distance={5} duration={1500}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Ellipse cx="60" cy="104" rx="30" ry="6" fill={Colors.neutral200} opacity={0.5} />
          <Circle cx="60" cy="60" r="36" fill={BODY} />
          <Circle cx="49" cy="56" r="4.5" fill={ACCENT} />
          <Circle cx="71" cy="56" r="4.5" fill={ACCENT} />
          <Path d="M50 70 Q60 66 70 70" stroke={ACCENT} strokeWidth={3} strokeLinecap="round" fill="none" />
        </Svg>
      </BounceWrap>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: size * 0.06,
          right: size * 0.16,
          transform: [
            { rotate: needleSpin.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '10deg'] }) },
          ],
        }}
      >
        <Svg width={30} height={30} viewBox="0 0 30 30">
          <Circle cx="15" cy="15" r="13" fill={ACCENT} stroke={BODY_DARK} strokeWidth={2.5} />
          <Path d="M15 7 L18 15 L15 23 L12 15 Z" fill={BODY_DARK} />
        </Svg>
      </Animated.View>
    </View>
  );
}
