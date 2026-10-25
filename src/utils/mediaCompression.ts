import * as ImageManipulator from 'expo-image-manipulator';

// Matches the server's stored size (FileStorageService): at most 1080px on the
// SHORT edge and 2400px on the long edge — Instagram's standard, sharp at full
// width on any phone. Sizing here first means the upload is already small
// (typically 250-600 KB instead of a 3-10 MB original) and the server only
// re-encodes (stripping EXIF/GPS) instead of resampling a second time.
const MAX_SHORT_EDGE_PX = 1080;
const MAX_LONG_EDGE_PX = 2400;
const JPEG_QUALITY = 0.9;

function fitScale(width: number, height: number): number {
  return Math.min(1, MAX_SHORT_EDGE_PX / Math.min(width, height), MAX_LONG_EDGE_PX / Math.max(width, height));
}

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
    const scale = width && height ? fitScale(width, height) : 1;
    const actions: ImageManipulator.Action[] = scale < 1
      ? [{ resize: { width: Math.round(width! * scale), height: Math.round(height! * scale) } }]
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

/**
 * Story photos: crops to the screen's aspect ratio, centred — exactly the area
 * the full-screen camera/preview shows (it uses "cover") — then scales to
 * 1080px wide. Stored at the size it's displayed, a story photo stays crisp
 * on a full-screen phone instead of being stretched ~1.8x from a 3:4 shot.
 */
export async function prepareStoryImage(
  uri: string,
  width: number | undefined,
  height: number | undefined,
  screenAspect: number, // width / height of the viewer, e.g. 0.46
): Promise<{ uri: string; width?: number; height?: number }> {
  if (!width || !height || !(screenAspect > 0)) return prepareImageForUpload(uri, width, height);
  try {
    const srcAspect = width / height;
    let crop = { originX: 0, originY: 0, width, height };
    if (srcAspect > screenAspect * 1.01) {
      const w = Math.round(height * screenAspect);
      crop = { originX: Math.round((width - w) / 2), originY: 0, width: w, height };
    } else if (srcAspect < screenAspect * 0.99) {
      const h = Math.round(width / screenAspect);
      crop = { originX: 0, originY: Math.round((height - h) / 2), width, height: h };
    }
    const targetW = Math.min(MAX_SHORT_EDGE_PX, crop.width);
    const actions: ImageManipulator.Action[] = [{ crop }];
    if (targetW < crop.width) actions.push({ resize: { width: targetW } });
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: result.uri, width: result.width, height: result.height };
  } catch {
    return prepareImageForUpload(uri, width, height);
  }
}
