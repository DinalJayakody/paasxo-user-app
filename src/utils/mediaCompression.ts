import * as ImageManipulator from 'expo-image-manipulator';

// Longer-edge cap applied to every photo before it ever leaves the device —
// for a post/reel/story feed rendered at typical phone screen widths, 1600px
// is comfortably above what's visible (a 3x-density 6" phone screen is
// ~1200-1300px wide), so nothing perceptible is lost, while an iPhone's
// original 12-48MP capture (often 4032x3024 or larger — several MB to
// several tens of MB per photo) drops to roughly a few hundred KB to ~2MB.
// The backend re-compresses everything again on receipt (see
// FileStorageService#compressImage, capped at 1080px) as a safety net for
// any client that skips this step, but doing it here first means the actual
// bytes that have to survive the mobile network transfer — and the nginx
// body-size/timeout limits in front of the API — are already small, instead
// of shipping a 10-20MB original just to throw most of it away server-side.
const MAX_DIMENSION_PX = 1600;
const JPEG_QUALITY = 0.9;

/**
 * Resizes+recompresses a picked/captured photo for upload. No-ops (skips the
 * resize step, keeps the compress pass) if the image is already within
 * MAX_DIMENSION_PX. Always re-encodes as JPEG, since that's what every
 * upload endpoint on the backend normalizes stored images to anyway.
 *
 * `width`/`height` should come from the ImagePicker/camera asset when
 * available (avoids an extra image decode just to measure it); omit them to
 * let ImageManipulator resize purely by fixed target width, which slightly
 * over-shrinks a landscape image's longer (horizontal) edge.
 */
export async function prepareImageForUpload(
  uri: string,
  width?: number,
  height?: number
): Promise<{ uri: string; width?: number; height?: number }> {
  try {
    const isLandscape = !width || !height || width >= height;
    const needsResize = !!width && !!height && Math.max(width, height) > MAX_DIMENSION_PX;

    const actions: ImageManipulator.Action[] = needsResize
      ? [{ resize: isLandscape ? { width: MAX_DIMENSION_PX } : { height: MAX_DIMENSION_PX } }]
      : [];

    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: result.uri, width: result.width, height: result.height };
  } catch {
    // Non-fatal — worst case the original (larger) file gets uploaded as-is
    // and the backend's own compression pass still catches it.
    return { uri, width, height };
  }
}
