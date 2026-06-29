import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Heart,
  MessageCircle,
  Play,
  Search,
  Share2,
  Sparkles,
  Star,
  Trophy,
  X,
  Zap,
} from 'lucide-react-native';
import { useSubscription } from '../hooks/useSubscription';
import { BottomNavbar } from '../components/BottomNavbar';
import { SearchBar } from '../components/SearchBar';
import { Colors } from '../styles/colors';
import { socialMediaApi } from '../api/socialMediaApi';
import { PostCard } from '../components/PostCard';
import { TournamentFeedCard, TournamentFeedItem } from '../components/TournamentFeedCard';
import { futsalApi } from '../api/futsalApi';
import { tournamentApi } from '../api/tournamentApi';
import { StoryReel } from '../components/StoryReel';

const communityCards = [
  {
    id: 'futsal',
    label: 'Futsal Hub',
    image: 'https://images.pexels.com/photos/209280/pexels-photo-209280.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 'cricket',
    label: 'Cricket Clan',
    image: 'https://images.pexels.com/photos/163403/cricket-batsman-batting-cricket-pitch-163403.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 'pickleball',
    label: 'Pickleball Pro',
    image: 'https://images.pexels.com/photos/3823096/pexels-photo-3823096.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 'dance',
    label: 'Dance Arena',
    image: 'https://images.pexels.com/photos/396548/pexels-photo-396548.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
];

const users = [
  { id: 'alex', name: 'Alex “Thunder” Ray' },
  { id: 'marcus', name: 'Marcus Chen' },
  { id: 'sarah', name: 'Sarah Jenkins' },
  { id: 'david', name: 'David Miller' },
  { id: 'omar', name: 'Omar Siddiqui' },
];

type FeedItem =
  | { kind: 'post'; data: any }
  | { kind: 'tournament-ad'; data: TournamentFeedItem };

const getTournamentLifecycle = (t: any): 'UPCOMING' | 'LIVE' | 'COMPLETED' => {
  const s = (t.status || '').toUpperCase();
  if (s === 'ACTIVE' || s === 'LIVE' || s === 'IN_PROGRESS') return 'LIVE';
  if (s === 'COMPLETED' || s === 'FINISHED' || s === 'ENDED') return 'COMPLETED';
  if (t.date) {
    const d = new Date(t.date);
    if (!isNaN(d.getTime())) return d > new Date() ? 'UPCOMING' : 'COMPLETED';
  }
  return 'UPCOMING';
};

const FeedScreen = () => {
  const router = useRouter();
  const { active: isPro } = useSubscription();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Tournament ads injected between posts
  const [tournamentAds, setTournamentAds] = useState<TournamentFeedItem[]>([]);

  //Pagination for Feed
  const onEndReachedCalledDuringMomentum = React.useRef(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const mergeUniquePosts = (prev: any[], incoming: any[]) => {
    const map = new Map();

    [...prev, ...incoming].forEach(item => {
      map.set(item.id, item);
    });

    return Array.from(map.values());
  };

  const fetchPosts = async (nextPage = 0) => {
    if (loading) return;

    try {
      setLoading(true);
      const res = await socialMediaApi.getPosts(nextPage);
   

      const safeData = Array.isArray(res) ? res : [];

      setPosts(prev => {
        const merged =
          nextPage === 0
            ? safeData
            : mergeUniquePosts(prev, safeData);

        return merged;
      });

      setHasMore(safeData.length > 0);
      setPage(nextPage);

    } catch (err) {
      console.log('FETCH POSTS ERROR:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(0);
  }, []);

  // Fetch tournament ads from backend (futsals → their tournaments)
  useEffect(() => {
    const loadTournamentAds = async () => {
      try {
        const futsals = await futsalApi.listVenues();
        const futsalList = Array.isArray(futsals) ? futsals : Array.isArray(futsals?.data) ? futsals.data : [];
        const ads: TournamentFeedItem[] = [];
        for (const futsal of futsalList.slice(0, 5)) {
          if (ads.length >= 6) break;
          try {
            const ts = await tournamentApi.listForFutsal(futsal.id ?? futsal._id);
            for (const t of (ts || []).slice(0, 2)) {
              ads.push({
                id: t.id,
                name: t.name || 'Tournament',
                sport: (t.sport || futsal.sport || 'FUTSAL').toUpperCase(),
                date: t.date || t.startDate || '',
                venueName: futsal.name || futsal.futsalName || `Venue #${futsal.id}`,
                teamsCount: t.teamsCount ?? t.registeredTeams ?? 0,
                expectedTeams: t.expectedTeams ?? t.maxTeams ?? 8,
                lifecycle: getTournamentLifecycle(t),
                isOwner: false,
              });
            }
          } catch { /* skip this futsal */ }
        }
        setTournamentAds(ads);
      } catch { /* silent */ }
    };
    loadTournamentAds();
  }, []);

  const loadMore = () => {
    if (!hasMore || loading) return;
    fetchPosts(page + 1);
  };


  const handleBack = () => {
    router.push('/home');
  };

  const handleViewSchedule = () => {
    // TODO: Replace with actual schedule route
    console.log('View schedule pressed');
  };

  const handleLearnMore = () => {
    // TODO: Implement sponsored CTA action
    console.log('Learn more pressed');
  };

  const handleViewRankings = () => {
    // TODO: Replace with actual rankings route
    console.log('View rankings pressed');
  };

  const handleShare = () => {
    console.log('Share post');
  };

  const handleCreatePost = () => {
    router.push('/create-post');
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      if (searchQuery.trim().length > 0) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [searchQuery]);

  const handleSearch = async (text: string) => {
    try {
      setSearchLoading(true);

      const response = await socialMediaApi.searchUsers(text);
      setSearchResults(response);
      // console.log('RAW SEARCH RESPONSE:', response);

      const safe = Array.isArray(response.data)
        ? response.data
        : [];

      // setSearchResults(safe);
    } catch (err) {
      console.log('SEARCH ERROR:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const stats = useMemo(
    () => [
      { id: 'team', value: '32', label: 'Total Teams' },
      { id: 'matches', value: '128', label: 'Matches' },
      { id: 'prize', value: '$15k', label: 'Prize Pool' },
    ],
    []
  );

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [searchQuery]
  );

  // Build mixed feed: inject one tournament ad every 5 posts
  const feedItems = useMemo((): FeedItem[] => {
    if (tournamentAds.length === 0) return posts.map((p) => ({ kind: 'post', data: p }));
    const result: FeedItem[] = [];
    posts.forEach((post, index) => {
      result.push({ kind: 'post', data: post });
      if ((index + 1) % 5 === 0) {
        const adIdx = Math.floor(index / 5) % tournamentAds.length;
        result.push({ kind: 'tournament-ad', data: tournamentAds[adIdx] });
      }
    });
    return result;
  }, [posts, tournamentAds]);

  const handleSelectUser = (userId: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    router.push(`/friend-profile?user=${userId}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <View style={styles.topBarRow}>
          <View style={styles.brandContainer}>
            <View style={styles.logoStack}>
              <Image
                source={require('../../assets/logo.jpeg')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              {isPro && (
                <View style={styles.proBadge}>
                  <Zap color="#1A1A2E" size={8} strokeWidth={2.5} fill="#1A1A2E" />
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={styles.brandLabel}>Paasxo</Text>
          </View>
          <View style={styles.topBarActions}>
            <Pressable
              onPress={() => setSearchOpen((value) => !value)}
              style={styles.iconButton}
            >
              <Search color={Colors.white} size={20} />
            </Pressable>
            <Pressable style={[styles.iconButton, styles.topBarActionButton]}>
              <Bell color={Colors.white} size={20} />
            </Pressable>
          </View>
        </View>

        {searchOpen && (
          <View style={styles.searchWrapper}>
            <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Search results</Text>
              <Text style={styles.resultsCount}>
                {searchResults.length} found
              </Text>
            </View>

            {searchLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              searchResults.map((user) => (
                <Pressable
                  key={user.id}
                  style={styles.resultItem}
                  onPress={() => handleSelectUser(user.firebaseUid)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>

                    <Image
                      source={{
                        uri: user.profileImageUrl
                          ? user.profileImageUrl?.startsWith('http') || user.profileImageUrl?.startsWith('file')
                            ? user.profileImageUrl
                            : `data:image/jpeg;base64,${user.profileImageUrl}`
                          : undefined,
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        marginRight: 10,
                      }}
                    />



                    <View>
                      <Text style={styles.resultName}>
                        {user.displayName}
                      </Text>

                      <Text style={{ color: '#aaa', fontSize: 12 }}>
                        {user.sport ?? 'No sport'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* {searchOpen && (
          <View style={styles.searchWrapper}>
            <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>Search results</Text>
              <Text style={styles.resultsCount}>{filteredUsers.length} found</Text>
            </View>
            {filteredUsers.map((user) => (
              <Pressable key={user.id} style={styles.resultItem} onPress={() => handleSelectUser(user.id)}>
                <Text style={styles.resultName}>{user.name}</Text>
              </Pressable>
            ))}
          </View>
        )} */}
      </View>

      <FlatList
        data={feedItems}
        keyExtractor={(item, index) =>
          item.kind === 'post' ? `post-${item.data.id}-${index}` : `ad-${item.data.id}-${index}`
        }
        renderItem={({ item }) => {
          if (item.kind === 'tournament-ad') {
            return (
              <View style={styles.tournamentAdWrap}>
                <View style={styles.tournamentAdLabel}>
                  <Trophy color={Colors.primary} size={12} strokeWidth={2.5} />
                  <Text style={styles.tournamentAdLabelText}>FEATURED TOURNAMENT</Text>
                </View>
                <TournamentFeedCard
                  tournament={item.data}
                  onPress={() => router.push(`/tournament/${item.data.id}` as any)}
                />
              </View>
            );
          }
          return <PostCard post={item.data} />;
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}

        onEndReached={() => {
          if (!onEndReachedCalledDuringMomentum.current) {
            loadMore();
            onEndReachedCalledDuringMomentum.current = true;
          }
        }}

        onMomentumScrollBegin={() => {
          onEndReachedCalledDuringMomentum.current = false;
        }}
        onEndReachedThreshold={0.5}

        ListHeaderComponent={
          <>
            {/* STORIES */}
            <StoryReel />

            {/* LIVE & RECENT */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Live & Recent</Text>
              <Pressable onPress={handleViewSchedule}>
                <Text style={styles.sectionAction}>VIEW SCHEDULE</Text>
              </Pressable>
            </View>

            <View style={styles.liveCardsRow}>
              <View style={styles.liveCard}>
                <View style={styles.liveBadgeRow}>
                  <View style={styles.livePill}>
                    <Text style={styles.livePillText}>LIVE</Text>
                  </View>
                  <Text style={styles.liveLeague}>FUTSAL LEAGUE</Text>
                </View>

                <View style={styles.scoreRow}>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreAbbr}>ST</Text>
                    <Text style={styles.scoreValue}>3</Text>
                  </View>

                  <View style={styles.scoreCenter}>
                    <Text style={styles.scoreResult}>3 - 2</Text>
                    <Text style={styles.scoreLabel}>2nd Half</Text>
                  </View>

                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreAbbr}>BL</Text>
                    <Text style={styles.scoreValue}>2</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.liveCard, styles.finishedCard]}>
                <View style={styles.liveBadgeRow}>
                  <Text style={styles.finishedLabel}>FINISHED</Text>
                  <Text style={styles.liveLeague}>FUTSAL LEAGUE</Text>
                </View>

                <View style={styles.scoreRow}>
                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreAbbr}>TI</Text>
                    <Text style={styles.scoreValue}>1</Text>
                  </View>

                  <View style={styles.scoreCenter}>
                    <Text style={styles.scoreResult}>1 - 1</Text>
                    <Text style={styles.scoreLabel}>Full Time</Text>
                  </View>

                  <View style={styles.scoreItem}>
                    <Text style={styles.scoreAbbr}>DC</Text>
                    <Text style={styles.scoreValue}>1</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* SPONSORED */}
            <View style={styles.sponsoredCard}>
              <View style={styles.sponsoredHeader}>
                <Text style={styles.sponsoredLabel}>SPONSORED</Text>
                <Pressable style={styles.closeButton}>
                  <X color={Colors.neutral500} size={18} strokeWidth={2.5} />
                </Pressable>
              </View>

              <View style={styles.sponsoredBanner}>
                <Text style={styles.sponsoredBannerTitle}>BRAND</Text>
                <Text style={styles.sponsoredBannerTitleAlt}>FIK WAK</Text>
                <Text style={styles.sponsoredBannerSubtitle}>SAFE FOR WORK</Text>
              </View>

              <Text style={styles.sponsoredText}>
                Elevate Your Performance with Nike Pro Elite.
              </Text>

              <Pressable onPress={handleLearnMore} style={styles.sponsoredButton}>
                <Text style={styles.sponsoredButtonText}>Learn More</Text>
              </Pressable>
            </View>

            {/* FEATURED */}
            <View style={styles.featuredCard}>
              <View style={styles.featuredHeader}>
                <Text style={styles.featuredBadge}>FEATURED EVENT</Text>
                <View style={styles.featuredIconBox}>
                  <Trophy color={Colors.white} size={18} strokeWidth={2.5} />
                </View>
              </View>

              <Text style={styles.featuredTitle}>
                Paddles Championship Season 04
              </Text>

              <View style={styles.featuredStatsRow}>
                {stats.map((item) => (
                  <View key={item.id} style={styles.featuredStatItem}>
                    <Text style={styles.featuredStatValue}>{item.value}</Text>
                    <Text style={styles.featuredStatLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>

              <Pressable onPress={handleViewRankings} style={styles.featuredButton}>
                <Text style={styles.featuredButtonText}>View Rankings →</Text>
              </Pressable>
            </View>
          </>
        }

        ListFooterComponent={
          <>
            {/* UNLOCK CARD */}
            {/* <View style={styles.unlockCard}>
        <View style={styles.unlockHeader}>
          <View style={styles.unlockBadge}>
            <Star color={Colors.primary} size={16} strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.unlockTitle}>PAASXO ELITE</Text>
            <Text style={styles.unlockSubtitle}>EXCLUSIVE CONTENT</Text>
          </View>
        </View>

        <View style={styles.unlockBody}>
          <View style={styles.lockIconBox}>
            <Sparkles color={Colors.primary} size={22} strokeWidth={2.5} />
          </View>

          <Text style={styles.unlockHeading}>
            Unlock Advanced Strategy Guides
          </Text>

          <Text style={styles.unlockCopy}>
            Get access to premium training content.
          </Text>

          <Pressable style={styles.unlockButton}>
            <Text style={styles.unlockButtonText}>
              Upgrade to Gold
            </Text>
          </Pressable>
        </View>
      </View> */}

            {/* COMMUNITIES */}
            <Text style={styles.discoverTitle}>
              Discover Communities
            </Text>

            <View style={styles.communityGrid}>
              {communityCards.map((item) => (
                <Pressable key={item.id} style={styles.communityCard}>
                  <Image source={{ uri: item.image }} style={styles.communityImage} />
                  <View style={styles.communityOverlay} />
                  <Text style={styles.communityLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* LOADING */}
            {loading && (
              <ActivityIndicator size="small" style={{ marginVertical: 20 }} />
            )}
          </>
        }
      />
      <BottomNavbar activeTab="FEED" showCreateButton={true} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 130,
  },
  topBar: {
    backgroundColor: Colors.logoBlue,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginHorizontal: -18,
    marginBottom: 18,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandLabel: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 10,
  },
  logoImage: {
    width: 42,
    height: 42,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarActionButton: {
    marginLeft: 12,
  },
  searchWrapper: {
    marginTop: 14,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsTitle: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  resultsCount: {
    color: Colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
  },
  resultItem: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  resultName: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.white,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.neutral900,
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  liveCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  liveCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: 18,
    shadowColor: Colors.neutral900,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  finishedCard: {
    backgroundColor: Colors.neutral100,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  livePill: {
    backgroundColor: '#FF4C4C',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  livePillText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  finishedLabel: {
    color: Colors.neutral500,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  liveLeague: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.neutral500,
    textTransform: 'uppercase',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreAbbr: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.primary,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.neutral900,
  },
  scoreCenter: {
    alignItems: 'center',
  },
  scoreResult: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.neutral900,
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.neutral500,
    textTransform: 'uppercase',
  },
  sponsoredCard: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: 18,
    marginBottom: 22,
    shadowColor: Colors.neutral900,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  sponsoredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sponsoredLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.neutral500,
    letterSpacing: 1.2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: Colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsoredBanner: {
    height: 130,
    borderRadius: 22,
    backgroundColor: Colors.neutral900,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 18,
  },
  sponsoredBannerTitle: {
    color: Colors.white,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sponsoredBannerTitleAlt: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sponsoredBannerSubtitle: {
    marginTop: 8,
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  sponsoredText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  sponsoredButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sponsoredButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  featuredCard: {
    backgroundColor: Colors.primary,
    borderRadius: 28,
    padding: 20,
    marginBottom: 22,
  },
  featuredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  featuredBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primaryLight,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  featuredIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredTitle: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 18,
  },
  featuredStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },
  featuredStatItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
  },
  featuredStatValue: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  featuredStatLabel: {
    color: Colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  featuredButton: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  featuredButtonText: {
    color: Colors.neutral900,
    fontSize: 13,
    fontWeight: '900',
  },
  postCard: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: 18,
    marginBottom: 22,
    shadowColor: Colors.neutral900,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  postUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  postAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  postMeta: {
    justifyContent: 'center',
  },
  postName: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.neutral900,
  },
  postSubtitle: {
    fontSize: 12,
    color: Colors.neutral500,
    marginTop: 2,
  },
  iconButtonSmall: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  postLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.neutral500,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  postPreview: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  postImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  playButton: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 58,
    height: 58,
    marginLeft: -29,
    marginTop: -29,
    borderRadius: 30,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postStatText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.neutral600,
  },
  shareAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tournamentAdWrap: { marginBottom: 8 },
  tournamentAdLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 6, paddingHorizontal: 4,
  },
  tournamentAdLabelText: {
    fontSize: 10, fontWeight: '800', color: Colors.primary,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },

  unlockCard: {
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: 20,
    marginBottom: 22,
    shadowColor: Colors.neutral900,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  unlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    gap: 14,
  },
  unlockBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.neutral900,
    marginBottom: 6,
  },
  unlockSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    color: Colors.primary,
  },
  unlockBody: {
    alignItems: 'center',
  },
  lockIconBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.neutral100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  unlockHeading: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.neutral900,
    textAlign: 'center',
    marginBottom: 12,
  },
  unlockCopy: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  unlockButton: {
    borderRadius: 18,
    backgroundColor: Colors.neutral900,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  unlockButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  discoverTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.neutral900,
    marginBottom: 16,
  },
  communityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  communityCard: {
    width: '48%',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
  },
  communityImage: {
    width: '100%',
    height: 140,
  },
  communityOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
  },
  communityLabel: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    color: Colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  logoStack: {
    alignItems: 'center',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.warning,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 3,
  },
  proBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#1A1A2E',
    letterSpacing: 0.6,
  },
});

export default FeedScreen;
