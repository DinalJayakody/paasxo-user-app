import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { LogIn, UserPlus } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

interface AuthTabBarProps {
  active: 'login' | 'register';
}

/** Floating glass pill switcher shared by SignInScreen/SignUpScreen — a normal
 *  flex sibling below each screen's ScrollView (not absolutely positioned), so
 *  it always sits above Android's gesture/button nav bar and never overlaps or
 *  steals touches from scrolled content. Purely visual: same two routes
 *  ('/sign-in', '/sign-up') as before this component existed. */
export default function AuthTabBar({ active }: AuthTabBarProps) {
  const router = useRouter();
  const { colors, resolvedTheme } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        {/* Clipped separately from `pill` — a view can't both clip its
            content (needed to round the blur's square corners) and cast its
            own drop shadow, so the shadow lives on `pill` and the clipping
            lives on this absolutely-filled inner layer instead. */}
        <View style={styles.pillClip} pointerEvents="none">
          <BlurView
            intensity={Platform.OS === 'ios' ? 46 : 70}
            tint={resolvedTheme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.glassTint} />
        </View>
        <AuthTab
          label="LOGIN"
          Icon={LogIn}
          active={active === 'login'}
          onPress={() => router.push('/sign-in')}
          colors={colors}
          styles={styles}
        />
        <AuthTab
          label="REGISTER"
          Icon={UserPlus}
          active={active === 'register'}
          onPress={() => router.push('/sign-up')}
          colors={colors}
          styles={styles}
        />
      </View>
    </View>
  );
}

function AuthTab({
  label,
  Icon,
  active,
  onPress,
  colors,
  styles,
}: {
  label: string;
  Icon: typeof LogIn;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  };

  return (
    <Pressable
      onPress={active ? undefined : onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={styles.tabTouchable}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {active ? (
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tabActive}
          >
            <Icon color={colors.white} size={18} strokeWidth={2.4} />
            <Text style={styles.tabLabelActive}>{label}</Text>
          </LinearGradient>
        ) : (
          <View style={styles.tab}>
            <Icon color={colors.textSecondary} size={18} strokeWidth={2.2} />
            <Text style={styles.tabLabel}>{label}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 4,
  },
  pill: {
    flexDirection: 'row',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: 6,
    gap: 6,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  pillClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    overflow: 'hidden',
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.glassTint,
  },
  tabTouchable: {
    flex: 1,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 20,
  },
  tabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 20,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.white,
  },
});
