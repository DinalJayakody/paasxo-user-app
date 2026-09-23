/**
 * Builds a flat, shareable image (map + stats card — see ActivityShareCard)
 * for a completed activity: renders the card off-screen, waits for its map
 * snapshot to actually paint, then flattens it with react-native-view-shot.
 * Shared by ActivityTrackerScreen (share right after finishing) and
 * ActivityDetailScreen (share later from history) so both get the exact
 * same card rather than two slightly-different implementations.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import MapView from 'react-native-maps';
import { captureRef } from 'react-native-view-shot';
import { StoredActivity } from '../api/activityApi';
import { ActivityShareCard, ShareCardAspectRatio, SHARE_CARD_DIMENSIONS } from '../components/activity/ActivityShareCard';

// Snapshotted at a lower resolution than the final card (which is captured
// at SHARE_CARD_WIDTH/HEIGHT) — react-native-maps upscales/crops fine as a
// background image, and a full-resolution map tile fetch isn't worth the
// extra latency here.
const MAP_SNAPSHOT_WIDTH = 1080;
const MAP_SNAPSHOT_HEIGHT = 900;

export function useActivityShareCard(
  activity: StoredActivity | null,
  authorName: string,
  records: string[] = []
) {
  const cardRef = useRef<View>(null);
  const [mapSnapshotUri, setMapSnapshotUri] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<ShareCardAspectRatio>('post');
  const imageLoadedRef = useRef(false);
  const cachedCardUriRef = useRef<string | null>(null);

  const handleMapImageLoad = useCallback(() => {
    imageLoadedRef.current = true;
  }, []);

  /**
   * Returns a local file:// URI for the flattened share card (cached after
   * the first call for this activity+aspect-ratio combo — pass a new
   * `shareLinkUrl` to force a rebuild, e.g. once the activity has just been
   * synced and a real link is available for the first time). `mapRef` is the
   * MapView already showing the fitted route on the calling screen — reused
   * rather than mounting a second hidden map, which would need its own
   * GPS/tile load time. `targetAspectRatio` defaults to 'post' (4:5,
   * feed/external); pass 'story' for the 9:16 Story canvas.
   */
  const buildShareCard = useCallback(async (
    mapRef?: React.RefObject<MapView | null>,
    shareLinkUrl?: string | null,
    targetAspectRatio: ShareCardAspectRatio = 'post'
  ): Promise<string | null> => {
    if (!activity) return null;
    if (cachedCardUriRef.current && shareLinkUrl === undefined && targetAspectRatio === aspectRatio) {
      return cachedCardUriRef.current;
    }

    if (targetAspectRatio !== aspectRatio) {
      setAspectRatio(targetAspectRatio);
      cachedCardUriRef.current = null;
    }
    if (shareLinkUrl !== undefined) {
      setShareUrl(shareLinkUrl);
      cachedCardUriRef.current = null;
    }

    imageLoadedRef.current = false;
    let snapshotUri: string | null = null;
    if (mapRef?.current && activity.routeCoordinates.length > 1) {
      try {
        snapshotUri = await mapRef.current.takeSnapshot({
          width: MAP_SNAPSHOT_WIDTH,
          height: MAP_SNAPSHOT_HEIGHT,
          format: 'png',
          result: 'file',
        });
      } catch {
        snapshotUri = null; // falls back to the gradient-only card below
      }
    }
    setMapSnapshotUri(snapshotUri);

    // Let the hidden card actually render with the new state before either
    // waiting on its Image or capturing it (gradient-only card still needs
    // one paint cycle).
    await new Promise((r) => setTimeout(r, 50));

    if (snapshotUri) {
      // Wait for the map <Image> to paint — capturing before it has loaded
      // is the classic react-native-view-shot gotcha that produces a blank
      // area where the map should be. Bounded so a stuck load can't hang
      // the whole share flow.
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
  }, [activity, aspectRatio]);

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
          records,
          authorName,
          mapSnapshotUri,
          shareUrl,
          onMapImageLoad: handleMapImageLoad,
        })
      )
    : null;

  return { ShareCardPortal, buildShareCard };
}
