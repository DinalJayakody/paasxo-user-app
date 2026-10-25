import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// expo-media-library is a native module: present only in app builds made
// after it was added. Older builds fall back to the share sheet, whose
// "Save Image / Save Video" does the same job — never a crash.
let MediaLibrary: any = null;
try {
  MediaLibrary = require('expo-media-library');
  if (!MediaLibrary?.saveToLibraryAsync) MediaLibrary = null;
} catch {
  MediaLibrary = null;
}
let Sharing: any = null;
try {
  Sharing = require('expo-sharing');
} catch {
  Sharing = null;
}

export type SaveResult = 'saved' | 'shared' | 'denied' | 'failed';

const EXT = /\.(jpe?g|png|mp4|mov|m4v|webp)(?:\?|$)/i;

/** Downloads a remote file into the cache (reused if already there). */
async function toLocalFile(uriOrUrl: string, isVideo: boolean): Promise<string> {
  if (!/^https?:\/\//i.test(uriOrUrl)) return uriOrUrl;
  const ext = (EXT.exec(uriOrUrl)?.[1] ?? (isVideo ? 'mp4' : 'jpg')).toLowerCase();
  const name = uriOrUrl.split('?')[0].split('/').pop()?.replace(/[^A-Za-z0-9_.-]/g, '') || `paasxo-${Date.now()}.${ext}`;
  const target = `${FileSystem.cacheDirectory}paasxo-save-${name.endsWith(ext) ? name : `${name}.${ext}`}`;
  const info = await FileSystem.getInfoAsync(target);
  if (info.exists && (info as any).size > 0) return target;
  const res = await FileSystem.downloadAsync(uriOrUrl, target);
  if (res.status < 200 || res.status >= 300) throw new Error(`Download failed (${res.status})`);
  return res.uri;
}

/**
 * Saves a photo/video (local file or https URL) to the device's gallery.
 * Asks only for "add photos" access. Without the media-library module in this
 * build, opens the share sheet so the user can still "Save Image/Video".
 */
export async function saveMediaToDevice(uriOrUrl: string, isVideo: boolean): Promise<SaveResult> {
  let local: string;
  try {
    local = await toLocalFile(uriOrUrl, isVideo);
  } catch {
    return 'failed';
  }

  if (MediaLibrary) {
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm?.granted) return 'denied';
      await MediaLibrary.saveToLibraryAsync(local);
      return 'saved';
    } catch {
      // fall through to the share sheet
    }
  }

  try {
    if (Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(local, {
        mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
        UTI: Platform.OS === 'ios' ? (isVideo ? 'public.mpeg-4' : 'public.jpeg') : undefined,
        dialogTitle: 'Save to your phone',
      });
      return 'shared';
    }
  } catch {
    // ignore
  }
  return 'failed';
}
