import React, { useState, useRef, useMemo, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Home as HomeIcon, Search, Plus, Settings, Users, Trophy, Swords, X, Sparkles, Camera, Video } from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

// Content-only height (icons + labels) of the floating pill itself, excluding
// the safe-area clearance that lifts it off the bottom edge. Matches the
// original fixed-height design closely so nothing shifts on devices where
// this was never an issue.
const NAV_CONTENT_HEIGHT = Platform.OS === 'ios' ? 64 : 68;
const NAV_PILL_GAP = Platform.OS === 'ios' ? 12 : 10;

/** Total rendered height of <BottomNavbar/> on this device, incl. the bottom
 *  safe-area inset (Android system nav bar / iOS home indicator). Screens
 *  that render the bar should size their scrollable content's bottom padding
 *  off this so nothing ends up hidden behind it. */
export function useBottomNavBarHeight() {
  const insets = useSafeAreaInsets();
  return NAV_CONTENT_HEIGHT + NAV_PILL_GAP + insets.bottom + 12;
}

const NAV_ITEMS = [
  {
    id: 'FEED',
    label: 'FEED',
    route: '/feed',
    Icon: HomeIcon,
  },
  {
    id: 'EXPLORE',
    label: 'EXPLORE',
    route: '/home',
    Icon: Search,
  },
  {
    id: 'FRIENDS',
    label: 'FRIENDS',
    route: '/friends',
    Icon: Users,
  },
  {
    id: 'PROFILE',
    label: 'PROFILE',
    route: '/profile',
    Icon: Settings,
  },
] as const;

type NavItemRoute = typeof NAV_ITEMS[number]['route'];
type NavItemId = typeof NAV_ITEMS[number]['id'];

interface BottomNavbarProps {
  activeTab: NavItemId;
  showCreateButton?: boolean;
}

export function BottomNavbar({ activeTab, showCreateButton = false }: BottomNavbarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, resolvedTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [createMenuVisible, setCreateMenuVisible] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const bounceLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const spinLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [fabCenterX, setFabCenterX] = useState<number | null>(null);

  const isExploreTab = activeTab === 'EXPLORE';

  const handlePress = (route: NavItemRoute) => {
    router.push(route as any);
  };

  const openCreateMenu = () => {
    // reset animation values and show modal
    scaleAnim.setValue(0);
    opacityAnim.setValue(0);
    setCreateMenuVisible(true);

    Animated.sequence([
      Animated.timing(fabScale, {
        toValue: 0.88,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(fabScale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    bounceAnim.setValue(0);
    bounceLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    bounceLoopRef.current.start();

    spinAnim.setValue(0);
    spinLoopRef.current = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoopRef.current.start();
  };

  const closeMatchMenu = () => {
    bounceLoopRef.current?.stop();
    spinLoopRef.current?.stop();
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCreateMenuVisible(false);
    });
  };

  const handleNormalMatch = () => {
    closeMatchMenu();
    router.push('/create-match' as any);
  };

  const handleTournamentMode = () => {
    closeMatchMenu();
    router.push('/create-tournament' as any);
  };

  const handleCreatePostOption = () => {
    closeMatchMenu();
    router.push('/create-post' as any);
  };

  const handleCreateReelOption = () => {
    closeMatchMenu();
    router.push('/create-reel' as any);
  };

  const handleCreateStoryOption = () => {
    closeMatchMenu();
    router.push('/story-create' as any);
  };

  const matchMenuOptions = [
    {
      key: 'match',
      emoji: '⚽',
      title: 'Create Match',
      subtitle: 'Book a quick game and invite friends',
      colors: [colors.primary, colors.primaryDark] as [string, string],
      Icon: Swords,
      spin: false,
      onPress: handleNormalMatch,
    },
    {
      key: 'tournament',
      emoji: '🏆',
      title: 'Create Tournament',
      subtitle: 'Run a bracket with live scores',
      colors: ['#F59E0B', '#DC2626'] as [string, string],
      Icon: Sparkles,
      spin: true,
      onPress: handleTournamentMode,
    },
  ];

  const postMenuOptions = [
    {
      key: 'post',
      emoji: '📷',
      title: 'Create Post',
      subtitle: 'Share a photo with your feed',
      colors: [colors.primary, colors.primaryDark] as [string, string],
      Icon: Camera,
      spin: false,
      onPress: handleCreatePostOption,
    },
    {
      key: 'reel',
      emoji: '🎬',
      title: 'Create Reel',
      subtitle: 'Post a short video, up to 3 minutes',
      colors: ['#F59E0B', '#DC2626'] as [string, string],
      Icon: Video,
      spin: false,
      onPress: handleCreateReelOption,
    },
    {
      key: 'story',
      emoji: '✨',
      title: 'Create Story',
      subtitle: 'Share a moment that disappears in 24h',
      colors: [colors.success, colors.successDark] as [string, string],
      Icon: Sparkles,
      spin: true,
      onPress: handleCreateStoryOption,
    },
  ];

  const activeMenuOptions = isExploreTab ? matchMenuOptions : postMenuOptions;

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + NAV_PILL_GAP }]} pointerEvents="box-none">
      <View style={[styles.pill, { height: NAV_CONTENT_HEIGHT }]}>
        {/* Clipped separately from `pill` itself — the FAB's glow shadow
            below is a sibling of this layer, not a child, so overflow:hidden
            here (needed to round off the blur's square corners) never cuts
            the shadow off. */}
        <View style={styles.pillClip} pointerEvents="none">
          <BlurView
            intensity={Platform.OS === 'ios' ? 50 : 80}
            tint={resolvedTheme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[colors.primaryAccent + '26', colors.primary + '1F', colors.primaryDark + '26']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {NAV_ITEMS.slice(0, 2).map(({ id, label, Icon, route }) => {
          const active = activeTab === id;
          return (
            <NavItem
              key={id}
              Icon={Icon}
              label={label}
              active={active}
              onPress={() => handlePress(route)}
              colors={colors}
              styles={styles}
            />
          );
        })}

        {(isExploreTab || activeTab === 'FEED') && (
          <>
            <Animated.View
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setFabCenterX(x + width / 2);
              }}
              style={{ transform: [{ scale: fabScale }] }}
            >
              <Pressable
                onPress={openCreateMenu}
                style={styles.fabTouchable}
                android_ripple={{ color: colors.primaryLight, borderless: true }}
              >
                <LinearGradient
                  colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.fab}
                >
                  <Plus color={colors.white} size={26} strokeWidth={3} />
                </LinearGradient>
              </Pressable>
            </Animated.View>
            <Modal
            visible={createMenuVisible}
            transparent
            animationType="none"
            onRequestClose={closeMatchMenu}
          >
            <View style={styles.sheetOverlay}>
              <Pressable style={styles.backdropPress} onPress={closeMatchMenu}>
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}>
                  <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
                </Animated.View>
              </Pressable>

              <Animated.View
                style={[
                  styles.sheetCard,
                  { paddingBottom: (Platform.OS === 'ios' ? 36 : 24) + insets.bottom },
                  {
                    opacity: opacityAnim,
                    transform: [
                      {
                        translateY: scaleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [220, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeaderRow}>
                  <View>
                    <Text style={styles.sheetTitle}>Let's get started 🎉</Text>
                    <Text style={styles.sheetSubtitle}>What would you like to create?</Text>
                  </View>
                  <Pressable style={styles.sheetCloseBtn} onPress={closeMatchMenu}>
                    <X color={colors.neutral600} size={18} strokeWidth={2.5} />
                  </Pressable>
                </View>

                {activeMenuOptions.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={option.onPress}
                    style={({ pressed }) => [styles.creativeOption, pressed && styles.creativeOptionPressed]}
                  >
                    <LinearGradient
                      colors={option.colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.creativeOptionGradient}
                    >
                      <Animated.Text
                        style={[
                          styles.creativeMascot,
                          {
                            transform: [
                              {
                                translateY: bounceAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, -8],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        {option.emoji}
                      </Animated.Text>
                      <View style={styles.creativeOptionTextWrap}>
                        <Text style={styles.creativeOptionTitle}>{option.title}</Text>
                        <Text style={styles.creativeOptionSubtitle}>{option.subtitle}</Text>
                      </View>
                      <Animated.View
                        style={[
                          styles.creativeOptionIconWrap,
                          option.spin && {
                            transform: [
                              {
                                rotate: spinAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '360deg'],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <option.Icon color={colors.white} size={20} strokeWidth={2.5} />
                      </Animated.View>
                    </LinearGradient>
                  </Pressable>
                ))}
              </Animated.View>
            </View>
          </Modal>
        </>
      )}

        {NAV_ITEMS.slice(2).map(({ id, label, Icon, route }) => {
          const active = activeTab === id;
          return (
            <NavItem
              key={id}
              Icon={Icon}
              label={label}
              active={active}
              onPress={() => handlePress(route)}
              colors={colors}
              styles={styles}
            />
          );
        })}
      </View>
    </View>
  );
}

/** A single nav icon+label, with a spring scale-down on press for tactile
 *  feedback (no native "hover" on touch devices, so press-in/out stands in). */
function NavItem({
  Icon,
  label,
  active,
  onPress,
  colors,
  styles,
}: {
  Icon: typeof HomeIcon;
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const color = active ? colors.primary : colors.neutral400;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={styles.itemTouchable}
      android_ripple={{ color: colors.neutral200, borderless: true, radius: 28 }}
    >
      <Animated.View style={[styles.item, { transform: [{ scale }] }]}>
        {active && <View style={styles.itemActiveDot} />}
        <Icon color={color} size={22} strokeWidth={2.5} />
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: 6,
    shadowColor: colors.neutral900,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  pillClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    overflow: 'hidden',
  },
  itemTouchable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  itemActiveDot: {
    position: 'absolute',
    top: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  fabTouchable: {
    marginHorizontal: 6,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.neutral400,
  },
  labelActive: {
    color: colors.primary,
  },
  backdropPress: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: colors.neutral900,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.neutral200,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creativeOption: {
    borderRadius: 22,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: colors.neutral900,
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  creativeOptionPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  creativeOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
  },
  creativeMascot: {
    fontSize: 34,
  },
  creativeOptionTextWrap: {
    flex: 1,
  },
  creativeOptionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 3,
  },
  creativeOptionSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  creativeOptionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createMenuDivider: {
    height: 1,
    backgroundColor: colors.neutral200,
    marginHorizontal: 16,
  },
});