import React, { JSXElementConstructor, ReactElement, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  ListRenderItemInfo,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import { resolveAvatarUri } from '../utils/mediaUrl';

import {
  Image as ImageIcon,
  Camera,
  UserPlus,
  MapPin,
  Globe,
  Lock,
  Users,
  ChevronRight,
  LayoutGrid,
  X,
} from 'lucide-react-native';

import { LinearGradient } from 'expo-linear-gradient';

import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import MapView, {
  Marker,
} from 'react-native-maps';

import { socialMediaApi } from '../api/socialMediaApi';
import { ScreenContainer } from '../components/ScreenContainer';
import { SearchBar } from '../components/SearchBar';
import ScreenGlow from '../components/ScreenGlow';
import { goBack } from '../utils/navigation';
import { prepareImageForUpload } from '../utils/mediaCompression';
import { Play } from 'lucide-react-native';

// Platform-gated, matches the same native-only-module convention used by
// CaptureFlow.tsx (Reels/Stories) - no web target for this.
let VideoThumbnails: any = null;
if (Platform.OS !== 'web') {
  try {
    VideoThumbnails = require('expo-video-thumbnails');
  } catch {}
}

// Shorter than Reels' 180s cap (CreateReelScreen.MAX_REEL_SECONDS) - a
// regular feed Post is feed-weight content, not a headline video, and a
// tighter cap keeps R2 storage/transcoding cost down for what's still a
// secondary use case of this screen.
const MAX_POST_VIDEO_SECONDS = 60;

export default function CreatePostScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const router = useRouter();

  const [caption, setCaption] = useState('');

  const [visibility, setVisibility] =
    useState<'public' | 'friends' | 'private'>(
      'public'
    );

  const [selectedImage, setSelectedImage] =
    useState<any>(null);

  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [videoThumbnail, setVideoThumbnail] = useState<any>(null);

  const [loading, setLoading] =
    useState(false);

  const [tagModalVisible, setTagModalVisible] =
    useState(false);

  const [locationModalVisible, setLocationModalVisible] =
    useState(false);

  const [searchText, setSearchText] =
    useState('');

  const [taggedUsers, setTaggedUsers] =
    useState<any[]>([]);

  const [searchResults, setSearchResults] =
    useState<any[]>([]);

  const [selectedLocation, setSelectedLocation] =
    useState<any>(null);

  const pickFromGallery = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission required'
      );
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          ImagePicker.MediaTypeOptions.All,
        videoMaxDuration: MAX_POST_VIDEO_SECONDS,
        quality: 0.8,
      });

    if (!result.canceled) {
      await applyPickedAsset(result.assets[0]);
    }
  };

  const openCamera = async () => {
    const permission =
      await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Camera permission required'
      );
      return;
    }

    const result =
      await ImagePicker.launchCameraAsync({
        mediaTypes:
          ImagePicker.MediaTypeOptions.All,
        videoMaxDuration: MAX_POST_VIDEO_SECONDS,
        quality: 0.8,
      });

    if (!result.canceled) {
      await applyPickedAsset(result.assets[0]);
    }
  };

  // Resizes/recompresses a freshly picked or captured photo before it's held
  // in state (and later uploaded) — see mediaCompression.ts for why. Runs for
  // both the gallery and camera paths since either can hand back a full-size
  // original (a 12MP+ HD/4K photo can be several MB to tens of MB otherwise).
  const applyPickedImage = async (asset: ImagePicker.ImagePickerAsset) => {
    const prepared = await prepareImageForUpload(asset.uri, asset.width, asset.height);
    setMediaType('IMAGE');
    setVideoThumbnail(null);
    setSelectedImage({
      ...asset,
      uri: prepared.uri,
      width: prepared.width ?? asset.width,
      height: prepared.height ?? asset.height,
      // prepareImageForUpload always re-encodes to JPEG regardless of the
      // source format — keep the declared type in sync with the actual bytes
      // so the backend doesn't try to decode e.g. a HEIC original as JPEG.
      mimeType: 'image/jpeg',
      fileName: asset.fileName?.replace(/\.[^.]+$/, '.jpg') ?? 'post.jpg',
    });
  };

  // No client-side video compression exists in this codebase yet (same as
  // Reels' capture flow - the backend's FileStorageService/VideoProcessingService
  // re-encodes server-side), so the picked file is used as-is, capped to
  // MAX_POST_VIDEO_SECONDS by the picker's own videoMaxDuration option.
  const applyPickedVideo = async (asset: ImagePicker.ImagePickerAsset) => {
    setMediaType('VIDEO');
    setSelectedImage({
      uri: asset.uri,
      mimeType: asset.mimeType || 'video/mp4',
      fileName: asset.fileName ?? 'post.mp4',
    });
    setVideoThumbnail(null);
    if (VideoThumbnails) {
      try {
        const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(asset.uri, { time: 0 });
        setVideoThumbnail({ uri: thumbUri, mimeType: 'image/jpeg', fileName: 'thumb.jpg' });
      } catch {
        // Non-fatal - the post just won't have a poster-frame thumbnail.
      }
    }
  };

  const applyPickedAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    if (asset.type === 'video') {
      await applyPickedVideo(asset);
    } else {
      await applyPickedImage(asset);
    }
  };

  // Debounced "Tag Players" search — waits 400ms after the user stops typing
  // before querying, instead of firing a request on every keystroke.
  useEffect(() => {
    const delay = setTimeout(() => {
      if (searchText.trim().length >= 2) {
        fetchTaggableUsers();
      } else {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [searchText]);

  const fetchTaggableUsers = async () => {
    try {
      setLoading(true);
      const data = await socialMediaApi.searchUsers(searchText);
      setSearchResults(data?.content || []);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    try {
      if (!selectedImage) {
        Alert.alert(
          'Please select an image'
        );
        return;
      }

      setLoading(true);

      await socialMediaApi.createPost({
        caption,
        media: selectedImage,
        thumbnail: mediaType === 'VIDEO' ? videoThumbnail : undefined,
        mediaType,
        sport: 'CRICKET',
        visibility,
        taggedUsers: taggedUsers.map(
          (u) => u.id
        ),
        locationName:
          selectedLocation?.name,
        latitude:
          selectedLocation?.latitude,
        longitude:
          selectedLocation?.longitude,
      });

      Alert.alert(
        'Success',
        'Post created successfully'
      );

      goBack(router);
    } catch (error: any) {
      if (__DEV__) {
        console.warn('[CreatePostScreen] createPost failed', {
          status: error?.response?.status,
          data: error?.response?.data,
          message: error?.message,
          code: error?.code,
        });
      }

      const message =
        error?.response?.data?.message ??
        (error?.code === 'ECONNABORTED'
          ? 'Upload timed out. Check your connection and try again.'
          : error?.message === 'Network Error'
          ? 'Network error. Check your connection and try again.'
          : 'Failed to create post');

      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const selectLocation = async (
    event: any
  ) => {
    const coordinate =
      event.nativeEvent.coordinate;

    setSelectedLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      name: 'Selected Location',
    });

    setLocationModalVisible(false);
  };

  function renderItem(info: ListRenderItemInfo<any>): ReactElement<unknown, string | JSXElementConstructor<any>> | null {
    throw new Error('Function not implemented.');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenGlow />
      {/* Floating glass-gradient header */}
      <View style={styles.topHeaderShadow}>
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGlassStroke} pointerEvents="none" />

          <TouchableOpacity
            onPress={() => goBack(router)}
          >
            <Text style={styles.cancelText}>
              Cancel
            </Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Create Post
          </Text>

          <TouchableOpacity
            style={styles.postButton}
            onPress={createPost}
            disabled={loading}
          >
            <Text style={styles.postButtonText}>
              {loading ? 'Posting...' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mediaRow}>
          <TouchableOpacity
            style={styles.mediaCard}
            onPress={pickFromGallery}
          >
            <View
              style={styles.mediaIconWrapper}
            >
              <ImageIcon
                size={24}
                color={colors.primary}
              />

              <LayoutGrid
                size={14}
                color={colors.primary}
                style={styles.gridIcon}
              />
            </View>

            <Text style={styles.mediaLabel}>
              Gallery
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mediaCard}
            onPress={openCamera}
          >
            <Camera
              size={28}
              color={colors.primary}
            />

            <Text style={styles.mediaLabel}>
              Camera
            </Text>
          </TouchableOpacity>
        </View>

        {selectedImage && mediaType === 'VIDEO' ? (
          <View style={styles.previewImage}>
            {videoThumbnail ? (
              <Image source={{ uri: videoThumbnail.uri }} style={StyleSheet.absoluteFillObject} />
            ) : (
              <View style={[StyleSheet.absoluteFillObject, styles.videoPreviewFallback]} />
            )}
            <View style={styles.videoPreviewPlayBadge}>
              <Play color="#fff" size={26} strokeWidth={2.5} fill="#fff" />
            </View>
          </View>
        ) : selectedImage && (
          <Image
            source={{
              uri: selectedImage.uri,
            }}
            style={styles.previewImage}
          />
        )}

        <View style={styles.captionCard}>
          <Text style={styles.captionLabel}>
            CAPTION
          </Text>

          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption..."
            placeholderTextColor={colors.textMuted}
            multiline
            value={caption}
            onChangeText={setCaption}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() =>
            setTagModalVisible(true)
          }
        >
          <View
            style={styles.optionIconWrapper}
          >
            <UserPlus
              size={20}
              color={colors.textSecondary}
            />
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>
              Tag Players
            </Text>

            <Text
              style={styles.optionSubtitle}
            >
              {taggedUsers.length > 0
                ? `${taggedUsers.length} players tagged`
                : 'Add friends or teammates'}
            </Text>
          </View>

          <ChevronRight
            size={20}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() =>
            setLocationModalVisible(true)
          }
        >
          <View
            style={styles.optionIconWrapper}
          >
            <MapPin
              size={20}
              color={colors.textSecondary}
            />
          </View>

          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>
              Add Location
            </Text>

            <Text
              style={styles.optionSubtitle}
            >
              {selectedLocation?.name ||
                'Share where you played'}
            </Text>
          </View>

          <ChevronRight
            size={20}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        <View
          style={styles.visibilityContainer}
        >
          <TouchableOpacity
            style={[
              styles.visibilityButton,
              visibility === 'public' &&
                styles.visibilityButtonActive,
            ]}
            onPress={() =>
              setVisibility('public')
            }
          >
            <Globe
              size={18}
              color={
                visibility === 'public'
                  ? colors.white
                  : colors.textSecondary
              }
            />

            <Text
              style={[
                styles.visibilityText,
                visibility === 'public' &&
                  styles.visibilityTextActive,
              ]}
            >
              Public
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.visibilityButton,
              visibility === 'friends' &&
                styles.visibilityButtonActive,
            ]}
            onPress={() =>
              setVisibility('friends')
            }
          >
            <Users
              size={18}
              color={
                visibility === 'friends'
                  ? colors.white
                  : colors.textSecondary
              }
            />

            <Text
              style={[
                styles.visibilityText,
                visibility === 'friends' &&
                  styles.visibilityTextActive,
              ]}
            >
              Friends
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.visibilityButton,
              visibility === 'private' &&
                styles.visibilityButtonActive,
            ]}
            onPress={() =>
              setVisibility('private')
            }
          >
            <Lock
              size={18}
              color={
                visibility === 'private'
                  ? colors.white
                  : colors.textSecondary
              }
            />

            <Text
              style={[
                styles.visibilityText,
                visibility === 'private' &&
                  styles.visibilityTextActive,
              ]}
            >
              Private
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routePreview}>
          <LinearGradient
            colors={[
              '#374151',
              '#1f2937',
            ]}
            style={styles.routeGradient}
          >
            <View
              style={styles.routeTextContainer}
            >
              <Text
                style={styles.routeTitle}
              >
                Preview Route
              </Text>

              <Text
                style={styles.routeSubtitle}
              >
                OPTIONAL DATA
                VISUALIZATION
              </Text>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* TAG PLAYER MODAL */}

{/* TAG PLAYER MODAL */}

<Modal
  visible={tagModalVisible}
  animationType="fade"
  transparent
>
  {/* BACKDROP */}
  <View style={styles.tagOverlay}>
    
    {/* POPUP CARD */}
    <View style={styles.tagPopup}>

      {/* HEADER */}
      <View style={styles.tagPopupHeader}>
        <Text style={styles.tagPopupTitle}>
          Tag Players
        </Text>

        <TouchableOpacity
          onPress={() => setTagModalVisible(false)}
        >
          <X size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={{ marginTop: 10 }}>
        <SearchBar
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search players..."
        />
      </View>

      {/* LOADING */}
      {loading && (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={{ marginTop: 10 }}
        />
      )}

      {/* DROPDOWN LIST */}
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id?.toString()}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 260, marginTop: 10 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isTagged = taggedUsers.some(
            (u) => u.id === item.id
          );

          return (
            <TouchableOpacity
              style={styles.tagPopupItem}
              onPress={() => {
                if (!isTagged) {
                  setTaggedUsers((prev) => [
                    ...prev,
                    item,
                  ]);
                }
              }}
            >
              <Image
                source={{ uri: resolveAvatarUri(item.profileImageUrl, item.displayName) }}
                style={styles.tagPopupAvatar}
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.tagPopupName}>
                  {item.displayName}
                </Text>
                <Text style={styles.tagPopupSub}>
                  @{item.username || 'player'}
                </Text>
              </View>

              {isTagged ? (
                <Text style={styles.taggedBadge}>
                  Tagged
                </Text>
              ) : (
                <ChevronRight size={18} color={colors.textMuted} />
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  </View>
</Modal>

      {/* LOCATION MODAL */}

      <Modal
        visible={locationModalVisible}
        animationType="slide"
      >
        <SafeAreaView
          style={styles.modalContainer}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Select Location
            </Text>

            <TouchableOpacity
              onPress={() =>
                setLocationModalVisible(
                  false
                )
              }
            >
              <X size={24} />
            </TouchableOpacity>
          </View>

          <MapView
            style={{ flex: 1 }}
            onPress={selectLocation}
            initialRegion={{
              latitude: 6.9271,
              longitude: 79.8612,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {selectedLocation && (
              <Marker
                coordinate={{
                  latitude:
                    selectedLocation.latitude,
                  longitude:
                    selectedLocation.longitude,
                }}
              />
            )}
          </MapView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  flexOne: {
    flex: 1,
  },

  topHeaderShadow: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 2,
    borderRadius: 26,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 26,
    overflow: 'hidden',
  },

  headerGlassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },

  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },

  postButton: {
    backgroundColor: colors.cardBg,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },

  postButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  mediaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },

  mediaCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mediaIconWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  gridIcon: {
    marginLeft: 2,
    marginTop: -2,
  },

  mediaLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginTop: 12,
  },

  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreviewFallback: {
    // Fixed dark background regardless of app theme, matching ReelPlayer's
    // own video-surface fallback — a video frame reads as dark either way.
    backgroundColor: '#1a1a2e',
  },
  videoPreviewPlayBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  captionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    minHeight: 160,
  },

  captionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },

  captionInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },

  optionIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.neutral100,
    justifyContent: 'center',
    alignItems: 'center',
  },

  optionContent: {
    flex: 1,
    marginLeft: 12,
  },

  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  optionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  visibilityContainer: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },

  visibilityButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },

  visibilityButtonActive: {
    backgroundColor: colors.primary,
  },

  visibilityText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  visibilityTextActive: {
    color: '#fff',
  },

  routePreview: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 140,
  },

  routeGradient: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.primary,
  },

  routeTextContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },

  routeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  routeSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginTop: 4,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },

  searchInput: {
    backgroundColor: colors.inputBg,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },

  userCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },


  tagModalContainer: {
  flex: 1,
  backgroundColor: colors.background,
},

tagModalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 16,
  backgroundColor: colors.background,
},

tagModalTitle: {
  fontSize: 20,
  fontWeight: '800',
  color: colors.text,
},

tagUserCard: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: colors.cardBg,
  padding: 12,
  borderRadius: 14,
  marginBottom: 10,

  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
},

tagAvatar: {
  width: 44,
  height: 44,
  borderRadius: 22,
  marginRight: 12,
},

tagUserName: {
  fontSize: 15,
  fontWeight: '700',
  color: colors.text,
},

tagUserSub: {
  fontSize: 12,
  color: colors.textSecondary,
},

tagOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.35)',
  justifyContent: 'center',
  alignItems: 'center',
},

tagPopup: {
  width: '90%',
  maxHeight: '70%',
  backgroundColor: colors.cardBg,
  borderRadius: 18,
  padding: 14,
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 20,
  elevation: 10,
},

tagPopupHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

tagPopupTitle: {
  fontSize: 18,
  fontWeight: '800',
  color: colors.text,
},

tagPopupItem: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 10,
  borderBottomWidth: 1,
  borderBottomColor: colors.divider,
},

tagPopupAvatar: {
  width: 38,
  height: 38,
  borderRadius: 19,
  marginRight: 10,
},

tagPopupName: {
  fontSize: 14,
  fontWeight: '700',
  color: colors.text,
},

tagPopupSub: {
  fontSize: 12,
  color: colors.textSecondary,
},

taggedBadge: {
  fontSize: 12,
  fontWeight: '700',
  color: colors.success,
},
});
