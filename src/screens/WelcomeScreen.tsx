import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ScrollView,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Trophy } from 'lucide-react-native';
import { Colors } from '../styles/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    id: 1,
    title: 'Discover sports &\nactivities around you',
    subtitle: 'Find local games, classes, and events\nand connect with people nearby instantly.',
    image: require('../../assets/pickleball.png'),
    badge: 'JOIN NOW',
  },
  {
    id: 2,
    title: 'Join teams &\ncompete locally',
    subtitle: 'Form your squad, challenge rivals, and\nclimb the leaderboards.',
    image: require('../../assets/futsal.png'),
    badge: '0.4 mi away',
  },
  {
    id: 3,
    title: 'Track your\nathletic journey',
    subtitle: 'Monitor performance stats and celebrate\nevery milestone.',
    image: require('../../assets/pickleball.png'),
    badge: 'LIVE NEARBY',
  },
  {
    id: 4,
    title: 'Connect with\nyour community',
    subtitle: 'Meet like-minded people and build\nlasting friendships through sport & fun.',
    image: require('../../assets/futsal.png'),
    badge: '3 SPOTS LEFT',
  },
];

const GRADIENT_COLORS = [Colors.primary, '#5B9BFF', Colors.primary];

export default function WelcomeScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Animation refs
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(1)).current;
  const gradientShift = useRef(new Animated.Value(0)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {

    // Animated gradient shimmer loop on CTA button (drives non-native positions)
    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientShift, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(gradientShift, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Gentle pulsing scale on CTA
    Animated.loop(
      Animated.sequence([
        Animated.timing(ctaScale, {
          toValue: 1.03,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ctaScale, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  };

  const handleGetStarted = () => {
    router.push('/sign-up');
  };

  const handleSkip = () => {
    router.push('/sign-in');
  };

  // Animate gradient start/end x positions for a continuously "moving" effect
  const gradientStartX = gradientShift.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const gradientEndX = gradientShift.interpolate({ inputRange: [0, 1], outputRange: [1, 2] });

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 36 }} />
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Hero: Centered logo */}
      <View style={styles.hero}>
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require('../../assets/logo.jpeg')}
            style={styles.logo}
            resizeMode="cover"
          />
        </Animated.View>
        <Text style={styles.heroTagline}>Play. Connect. Compete.</Text>
      </View>

      {/* Swipeable Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.slider}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={styles.slide}>
            {/* Hero Image with a single subtle badge */}
            <View style={styles.mapContainer}>
              <Image source={slide.image} style={styles.mapImage} resizeMode="cover" />

              {/* Bottom shade for readability */}
              <View style={styles.imageShade} />

              {/* Single corner badge */}
              <View style={styles.badge}>
                {slide.badge.includes('mi') ? (
                  <MapPin color={Colors.white} size={13} strokeWidth={2.2} />
                ) : (
                  <Trophy color={Colors.white} size={13} strokeWidth={2.2} />
                )}
                <Text style={styles.badgeText}>{slide.badge}</Text>
              </View>
            </View>

            {/* Text */}
            <View style={styles.textContainer}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottom}>
        {/* Pagination dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA Button with animated moving gradient */}
        <Animated.View style={{ width: '100%', transform: [{ scale: ctaScale }] }}>
          <TouchableOpacity
            onPress={handleGetStarted}
            activeOpacity={0.85}
            style={styles.ctaTouchable}
          >
            <AnimatedLinearGradient
              colors={GRADIENT_COLORS}
              startXAnim={gradientStartX}
              endXAnim={gradientEndX}
              fixedY={{ start: 0, end: 1 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>Get Started</Text>
            </AnimatedLinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

/**
 * Wrapper that animates the gradient's start/end x positions
 * via an Animated.Value listener, creating a continuously
 * "moving" diagonal gradient effect.
 */
function AnimatedLinearGradient({
  colors,
  startXAnim,
  endXAnim,
  fixedY,
  style,
  children,
}: any) {
  const [points, setPoints] = useState({
    start: { x: 0, y: fixedY.start },
    end: { x: 1, y: fixedY.end },
  });

  useEffect(() => {
    const startListener = startXAnim.addListener(({ value }: { value: number }) => {
      setPoints((p) => ({ ...p, start: { x: value, y: fixedY.start } }));
    });
    const endListener = endXAnim.addListener(({ value }: { value: number }) => {
      setPoints((p) => ({ ...p, end: { x: value, y: fixedY.end } }));
    });
    return () => {
      startXAnim.removeListener(startListener);
      endXAnim.removeListener(endListener);
    };
  }, []);

  return (
    <LinearGradient colors={colors} start={points.start} end={points.end} style={style}>
      {children}
    </LinearGradient>
  );
}

const LOGO_SIZE = 96;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.neutral500,
  },

  // ---- Hero / Logo section ----
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  logoWrapper: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
    backgroundColor: Colors.white,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  heroTagline: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },

  // ---- Slider ----
  slider: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 20,
  },
  mapContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    height: 300,
    backgroundColor: Colors.neutral200,
    position: 'relative',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  imageShade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  badge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // ---- Text ----
  textContainer: {
    paddingTop: 28,
    paddingBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // ---- Bottom ----
  bottom: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    backgroundColor: Colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: Colors.neutral300,
  },

  // CTA
  ctaTouchable: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaGradient: {
    width: '100%',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  ctaText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});