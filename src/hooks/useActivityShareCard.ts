/**
 * Builds a flat, shareable image (map/photo + stats card — see
 * ActivityShareCard) for a completed activity, AND renders a genuine live
 * on-screen preview that updates instantly as the user switches between
 * templates/aspect ratio — not just a flat swatch that only matters once
 * you've already committed to Save/Share. Two separate card instances are
 * rendered for this: a hidden full-resolution one (`ShareCardPortal`,
 * captured via react-native-view-shot for the real output image) and a
 * visible, scaled-down one (`SharePreview`) purely for display — keeping
 * the capture path untouched by the preview's CSS transform avoids any risk
 * of view-shot capturing a transformed view incorrectly.
 * Shared by ActivityTrackerScreen (share right after finishing) and
 * ActivityDetailScreen (share later from history) so both get the exact
 * same card rather than two slightly-different implementations.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MapView from 'react-native-maps';
import { StoredActivity } from '../api/activityApi';
import {
  ActivityShareCard, ShareCardAspectRatio, ShareCardTemplateId, SHARE_CARD_DIMENSIONS, templateUsesMap,
} from '../components/activity/ActivityShareCard';

// Snapshotted at a lower resolution than the final card (which is captured
// at SHARE_CARD_WIDTH/HEIGHT) — react-native-maps upscales/crops fine as a
// background image, and a full-resolution map tile fetch isn't worth the
// extra latency here.
const MAP_SNAPSHOT_WIDTH = 1080;
const MAP_SNAPSHOT_HEIGHT = 900;

// How wide the on-screen live preview renders, regardless of device size —
// capped so it never dominates a tablet-width screen either.
const PREVIEW_MAX_WIDTH = Math.min(360, Dimensions.get('window').width - 48);

export function useActivityShareCard(
  activity: StoredActivity | null,
  authorName: string,
  records: string[] = []
) {
  const cardRef = useRef<View>(null);
  const [mapSnapshotUri, setMapSnapshotUri] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<ShareCardAspectRatio>('post');
  const [templateId, setTemplateId] = useState<ShareCardTemplateId>('classic');
  const imageLoadedRef = useRef(false);
  const cachedCardUriRef = useRef<string | null>(null);
  const snapshottingRef = useRef(false);

  const handleMapImageLoad = useCallback(() => {
    imageLoadedRef.current = true;
  }, []);

  /**
   * Proactively takes the map snapshot (if a map template might be picked
   * and one hasn't been taken yet) so the live preview has something to
   * show the instant the user opens the design picker, rather than only
   * fetching it lazily the first time they actually share. Cheap to call
   * more than once — a no-op once mapSnapshotUri is already set. Local
   * device-side map rendering only, no network/backend call.
   */
  const ensureMapSnapshot = useCallback(async (mapRef?: React.RefObject<MapView | null>) => {
    if (mapSnapshotUri || snapshottingRef.current) return;
    if (!mapRef?.current || !activity || activity.routeCoordinates.length <= 1) return;
    snapshottingRef.current = true;
    try {
      const uri = await mapRef.current.takeSnapshot({
        width: MAP_SNAPSHOT_WIDTH,
        height: MAP_SNAPSHOT_HEIGHT,
        format: 'png',
        result: 'file',
      });
      setMapSnapshotUri(uri);
    } catch {
      // Preview/capture both fall back to the plain gradient background.
    } finally {
      snapshottingRef.current = false;
    }
  }, [mapSnapshotUri, activity]);

  /**
   * Opens the camera for the 'photo' template's background — a selfie or a
   * shot of the route taken right after finishing, Strava-style. Does
   * nothing (no Alert) if the user denies the permission or cancels; the
   * card just falls back to the map/gradient, same as a failed map snapshot.
   */
  const pickPhoto = useCallback(async (): Promise<boolean> => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return false;
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return false;
      setPhotoUri(result.assets[0].uri);
      cachedCardUriRef.current = null;
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * Returns a local file:// URI for the flattened share card (cached after
   * the first call for this activity+aspect-ratio+template combo — pass a
   * new `shareLinkUrl` to force a rebuild, e.g. once the activity has just
   * been synced and a real link is available for the first time). `mapRef`
   * is the MapView already showing the fitted route on the calling screen —
   * reused rather than mounting a second hidden map. `targetAspectRatio`
   * defaults to 'post' (4:5, feed/external); pass 'story' for the 9:16
   * Story canvas. `targetTemplateId` picks the visual design (see
   * SHARE_CARD_TEMPLATES) — defaults to 'classic'.
   */
  const buildShareCard = useCallback(async (
    mapRef?: React.RefObject<MapView | null>,
    shareLinkUrl?: string | null,
    targetAspectRatio: ShareCardAspectRatio = 'post',
    targetTemplateId: ShareCardTemplateId = 'classic'
  ): Promise<string | null> => {
    if (!activity) return null;
    if (
      cachedCardUriRef.current && shareLinkUrl === undefined
      && targetAspectRatio === aspectRatio && targetTemplateId === templateId
    ) {
      return cachedCardUriRef.current;
    }

    if (targetAspectRatio !== aspectRatio) {
      setAspectRatio(targetAspectRatio);
      cachedCardUriRef.current = null;
    }
    if (targetTemplateId !== templateId) {
      setTemplateId(targetTemplateId);
      cachedCardUriRef.current = null;
    }
    if (shareLinkUrl !== undefined) {
      setShareUrl(shareLinkUrl);
      cachedCardUriRef.current = null;
    }

    imageLoadedRef.current = false;
    // The preview flow (ensureMapSnapshot) usually already set this before
    // the user ever got here — this is just the fallback for a direct
    // buildShareCard call (e.g. external share) that skipped the preview.
    if (templateUsesMap(targetTemplateId) && !mapSnapshotUri && mapRef?.current && activity.routeCoordinates.length > 1) {
      try {
        const uri = await mapRef.current.takeSnapshot({
          width: MAP_SNAPSHOT_WIDTH,
          height: MAP_SNAPSHOT_HEIGHT,
          format: 'png',
          result: 'file',
        });
        setMapSnapshotUri(uri);
      } catch {
        // falls back to the gradient-only card below
      }
    }

    // Let the hidden card actually render with the new state before either
    // waiting on its Image or capturing it (gradient-only card still needs
    // one paint cycle).
    await new Promise((r) => setTimeout(r, 50));

    const needsImageWait = templateUsesMap(targetTemplateId) ? !!mapSnapshotUri : !!photoUri;
    if (needsImageWait) {
      // Wait for the background <Image> (map or photo) to paint — capturing
      // before it has loaded is the classic react-native-view-shot gotcha
      // that produces a blank area. Bounded so a stuck load can't hang the
      // whole share flow.
      await new Promise<void>((resolve) => {
        const deadline = Date.now() + 1500;
        const poll = () => {
          if (imageLoadedRef.current || Date.now() > deadline) resolve();
          else setTimeout(poll, 40);
        };
        poll();
      });
    }

    try {
      // Lazily required — react-native-view-shot's native module isn't
      // registered on every build (e.g. a simulator build predating it, or
      // one missing the native linking step), and a static top-level import
      // throws synchronously at module-load time ("RNViewShot could not be
      // found"), crashing every screen that transitively imports this hook
      // before any UI can render. Same fix as ActivityTrackerScreen's
      // expo-sharing/expo-sensors lazy-requires.
      const { captureRef } = require('react-native-view-shot') as typeof import('react-native-view-shot');
      const dim = SHARE_CARD_DIMENSIONS[targetAspectRatio];
      const uri = await captureRef(cardRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
        width: dim.width,
        height: dim.height,
      });
      cachedCardUriRef.current = uri;
      return uri;
    } catch (e) {
      console.warn('[useActivityShareCard] capture failed:', e);
      return null;
    }
  }, [activity, aspectRatio, templateId, mapSnapshotUri, photoUri]);

  const dim = SHARE_CARD_DIMENSIONS[aspectRatio];
  const previewScale = PREVIEW_MAX_WIDTH / dim.width;
  const previewWidth = dim.width * previewScale;
  const previewHeight = dim.height * previewScale;

  const ShareCardPortal = activity
    ? React.createElement(
        View,
        // Rendered off-screen (not display:none — view-shot needs an actual
        // laid-out, painted view to capture) rather than conditionally
        // mounted, so buildShareCard always has something to point at.
        { style: { position: 'absolute', top: -100000, left: 0 }, pointerEvents: 'none' as const },
        React.createElement(ActivityShareCard, {
          ref: cardRef,
          activity,
          aspectRatio,
          template: templateId,
          records,
          authorName,
          mapSnapshotUri,
          photoUri,
          shareUrl,
          onMapImageLoad: handleMapImageLoad,
        })
      )
    : null;

  // Visible, scaled-down twin of the hidden capture card — purely for
  // on-screen preview, never captured itself, so it's safe to update
  // instantly on every template/aspect-ratio tap with zero extra cost (no
  // re-snapshot, no re-capture, just a prop change re-rendering a cheap
  // React tree).
  // Outer box is the actual on-screen (scaled) size with overflow clipped;
  // centering a full-size (dim.width x dim.height) child inside it via flex
  // means the child's native center-anchored `scale` transform paints
  // exactly into that box with no overflow to clip — this avoids needing
  // the fiddly manual translate-offset math a top-left-anchored scale would
  // otherwise require (easy to get subtly wrong and hard to verify without
  // a device in hand).
  const SharePreview = activity
    ? React.createElement(
        View,
        {
          style: {
            width: previewWidth, height: previewHeight, overflow: 'hidden', borderRadius: 20,
            alignItems: 'center', justifyContent: 'center',
          },
        },
        React.createElement(
          View,
          { style: { width: dim.width, height: dim.height, transform: [{ scale: previewScale }] } },
          React.createElement(ActivityShareCard, {
            activity,
            aspectRatio,
            template: templateId,
            records,
            authorName,
            mapSnapshotUri,
            photoUri,
            shareUrl,
          })
        )
      )
    : null;

  return {
    ShareCardPortal, SharePreview, buildShareCard,
    templateId, setTemplateId, aspectRatio, setAspectRatio,
    photoUri, pickPhoto, ensureMapSnapshot,
  };
}
