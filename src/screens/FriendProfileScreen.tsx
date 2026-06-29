import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MoreVertical, Share2, CheckCircle2 } from 'lucide-react-native';
import { BottomNavbar } from '../components/BottomNavbar';
import { Colors } from '../styles/colors';
import { socialMediaApi } from '../api/socialMediaApi';


const profileUsers = {
  alex: {
    name: 'Alex “Thunder” Ray',
    role: 'Pro Futsal Player • 2h ago',
    bio: 'Incredible team effort tonight! That final volley was something else. See you all in the semifinals!',
    avatar: 'https://images.pexels.com/photos/3991871/pexels-photo-3991871.jpeg?auto=compress&cs=tinysrgb&w=400',
    stats: { posts: '142', followers: '12.4k', following: '852' },
    highlights: [
      { id: 'matches', title: 'Matches Played', value: '156' },
      { id: 'rate', title: 'Strike Rate', value: '138.4' },
      { id: 'mvp', title: 'MVP Awards', value: '12' },
      { id: 'skill', title: 'Elite Skill', value: 'CRICKET PRO' },
    ],
  },
  marcus: {
    name: 'Marcus Chen',
    role: 'Futsal Specialist • Forward',
    bio: 'Driven to score every match. Training hard, playing harder. Let’s build the next winning squad.',
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400',
    stats: { posts: '98', followers: '9.8k', following: '710' },
    highlights: [
      { id: 'matches', title: 'Matches Played', value: '142' },
      { id: 'rate', title: 'Strike Rate', value: '132.8' },
      { id: 'mvp', title: 'MVP Awards', value: '9' },
      { id: 'skill', title: 'Elite Skill', value: 'FUTSAL PRO' },
    ],
  },
};

const tabs = ['Moments', 'Videos', 'Tagged', 'Stats'];
const gallery = [
  'https://images.pexels.com/photos/163403/cricket-batsman-batting-cricket-pitch-163403.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/2159/football-american-sport-ball.jpg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/2265878/pexels-photo-2265878.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/1858804/pexels-photo-1858804.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/3991856/pexels-photo-3991856.jpeg?auto=compress&cs=tinysrgb&w=400',
  'https://images.pexels.com/photos/1023755/pexels-photo-1023755.jpeg?auto=compress&cs=tinysrgb&w=400',
];

export default function FriendProfileScreen() {
  const router = useRouter();
  const { user } = useLocalSearchParams();
  const profile = useMemo(() => {
    const userId = Array.isArray(user) ? user[0] : user;
    return profileUsers[userId as keyof typeof profileUsers] || profileUsers.alex;
  }, [user]);

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const userId = Array.isArray(user) ? user[0] : user;

  //FOLLOW AND UNFOLLOW LOGIC
  const [isFollowing, setIsFollowing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      console.log('Fetching profile for user ID:', userId);
      try {
        setLoading(true);
        setIsFollowing(!isFollowing);

        const res = await socialMediaApi.getUserProfile(userId as string);

        setProfileData(res);
        setIsFollowing(res.following);
      } catch (err) {
        console.log('PROFILE ERROR:', err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchProfile();
  }, [userId]);

  const handleFollowToggle = async () => {
    try {
      setActionLoading(true);

      if (isFollowing) {
        await socialMediaApi.unfollowUser(userId as string);
        setIsFollowing(false);
      } else {
        await socialMediaApi.followUser(userId as string);
        setIsFollowing(true);
      }

    } catch (err) {
      console.log('FOLLOW ERROR:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !profileData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading profile...</Text>
      </View>
    );
  }



  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft color={Colors.neutral900} size={22} strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.brandHeading}>Paasxo</Text>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton}>
              <Share2 color={Colors.neutral900} size={22} strokeWidth={2.5} />
            </Pressable>
            <Pressable style={[styles.iconButton, styles.iconButtonSmall]}>
              <MoreVertical color={Colors.neutral900} size={22} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <Image                       source={{
                        uri: profileData.profile.profileImageUrl
                          ? profileData.profile.profileImageUrl?.startsWith('http') || profileData.profile.profileImageUrl?.startsWith('file')
                            ? profileData.profile.profileImageUrl
                            : `data:image/jpeg;base64,${profileData.profile.profileImageUrl}`
                          : undefined,
                      }} style={styles.avatar} />
            <View style={styles.verifiedBadge}>
              <CheckCircle2 color={Colors.white} size={16} strokeWidth={2} />
            </View>
          </View>
          <Text style={styles.profileName}>{profileData.profile.displayName}</Text>
          <Text style={styles.profileRole}>{profileData.profile.sport}</Text>
          <Text style={styles.profileBio}>{profile.bio}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profileData.posts}</Text>
              <Text style={styles.statLabel}>POSTS</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profileData.followersCount}</Text>
              <Text style={styles.statLabel}>FOLLOWERS</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profileData.followingCount}</Text>
              <Text style={styles.statLabel}>FOLLOWING</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={handleFollowToggle}
              disabled={actionLoading}
              style={[
                styles.followButton,
                isFollowing && { backgroundColor: Colors.neutral900 }
              ]}
            >
              <Text style={styles.followButtonText}>
                {actionLoading
                  ? 'Loading...'
                  : isFollowing
                    ? 'Unfollow'
                    : 'Follow'}
              </Text>
            </Pressable>
            <Pressable style={styles.messageButton}>
              <Text style={styles.messageButtonText}>Message</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Performance Highlights</Text>
          <Text style={styles.sectionBadge}>SEASON 2024</Text>
        </View>

        <View style={styles.performanceGrid}>
          {profile.highlights.map((item) => (
            <View key={item.id} style={styles.performanceCard}>
              <Text style={styles.performanceLabel}>{item.title}</Text>
              <Text style={styles.performanceValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabsRow}>
          {tabs.map((tab) => (
            <View key={tab} style={[styles.tabItem, tab === 'Moments' && styles.tabItemActive]}>
              <Text style={[styles.tabText, tab === 'Moments' && styles.tabTextActive]}>{tab}</Text>
            </View>
          ))}
        </View>

        <View style={styles.galleryGrid}>
          {gallery.map((uri, index) => (
            <Image key={String(index)} source={{ uri }} style={styles.galleryImage} />
          ))}
        </View>
      </ScrollView>

      <BottomNavbar activeTab="FRIENDS" showCreateButton={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 110,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 24,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.neutral900,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  iconButtonSmall: {
    marginLeft: 10,
  },
  brandHeading: {
    color: Colors.neutral900,
    fontSize: 18,
    fontWeight: '900',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 32,
    padding: 22,
    alignItems: 'center',
    shadowColor: Colors.neutral900,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
    marginBottom: 22,
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 100,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 100,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.neutral900,
    marginBottom: 6,
  },
  profileRole: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.neutral500,
    marginBottom: 16,
  },
  profileBio: {
    fontSize: 13,
    color: Colors.neutral700,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 22,
  },
  statItem: {
    width: '30%',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.neutral900,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.neutral500,
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  followButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  followButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  messageButton: {
    flex: 1,
    backgroundColor: Colors.neutral200,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  messageButtonText: {
    color: Colors.neutral900,
    fontSize: 14,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.neutral900,
  },
  sectionBadge: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.logoBlue,
    textTransform: 'uppercase',
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  performanceCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.neutral900,
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  performanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.neutral500,
    marginBottom: 6,
  },
  performanceValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.neutral900,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: Colors.neutral200,
    marginHorizontal: 4,
  },
  tabItemActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.neutral900,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.neutral700,
  },
  tabTextActive: {
    color: Colors.logoBlue,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  galleryImage: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 18,
    marginBottom: 12,
  },
});