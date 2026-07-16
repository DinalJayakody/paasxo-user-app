import React, { useState, useRef, type ReactNode } from 'react';
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
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Home as HomeIcon, Search, Plus, Settings, Users, Trophy, Swords, X, Sparkles, Camera, Video } from 'lucide-react-native';
import { Colors } from '../styles/colors';

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
      colors: [Colors.primary, Colors.primaryDark] as [string, string],
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
      colors: [Colors.primary, Colors.primaryDark] as [string, string],
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
      colors: ['#7B1FA2', '#3B1D6E'] as [string, string],
      Icon: Sparkles,
      spin: true,
      onPress: handleCreateStoryOption,
    },
  ];

  const activeMenuOptions = isExploreTab ? matchMenuOptions : postMenuOptions;

  return (
    <View style={styles.container}>
      {NAV_ITEMS.slice(0, 2).map(({ id, label, Icon, route }) => {
        const active = activeTab === id;
        const color = active ? Colors.primary : Colors.neutral400;

        return (
          <Pressable
            key={id}
            onPress={() => handlePress(route)}
            style={styles.item}
            android_ripple={{ color: Colors.neutral200, borderless: true }}
          >
            <Icon color={color} size={22} strokeWidth={2.5} />
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </Pressable>
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
              style={styles.fab}
              android_ripple={{ color: Colors.primaryLight, borderless: true }}
            >
              <Plus color={Colors.white} size={26} strokeWidth={3} />
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
                    <X color={Colors.neutral600} size={18} strokeWidth={2.5} />
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
                        <option.Icon color={Colors.white} size={20} strokeWidth={2.5} />
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
        const color = active ? Colors.primary : Colors.neutral400;

        return (
          <Pressable
            key={id}
            onPress={() => handlePress(route)}
            style={styles.item}
            android_ripple={{ color: Colors.neutral200, borderless: true }}
          >
            <Icon color={color} size={22} strokeWidth={2.5} />
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 82,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    paddingHorizontal: 10,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 60,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    shadowColor: Colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.neutral400,
  },
  labelActive: {
    color: Colors.primary,
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
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: Colors.neutral900,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.neutral200,
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
    color: Colors.text,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creativeOption: {
    borderRadius: 22,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: Colors.neutral900,
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
    color: Colors.white,
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
    backgroundColor: Colors.neutral200,
    marginHorizontal: 16,
  },
});