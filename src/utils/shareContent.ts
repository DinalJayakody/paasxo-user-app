import { Platform, Share } from 'react-native';

// Public web app — the same base the activity share links use. A link opens the
// matching screen in the Paasxo web app (and, once universal links are set up
// in a native build, in the installed app).
const WEB_BASE = 'https://www.paasxo.com';
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const shareUrl = {
  post: (id: string) => `${WEB_BASE}/post/${encodeURIComponent(id)}`,
  reel: (id: string) => `${WEB_BASE}/reel/${encodeURIComponent(id)}`,
  story: (id: string) => `${WEB_BASE}/story/${encodeURIComponent(id)}`,
};

/**
 * Opens the system share sheet (WhatsApp, Instagram, Messages, Mail, Copy…)
 * with a short message and the link. Returns false if the id looks malformed
 * or sharing failed; a user dismissing the sheet isn't an error.
 */
export async function shareContent(kind: 'post' | 'reel' | 'story', id: string, authorName?: string): Promise<boolean> {
  if (!SAFE_ID.test(id)) return false;
  const url = shareUrl[kind](id);
  const who = authorName?.trim() ? `${authorName.trim()}'s` : 'this';
  const noun = kind === 'post' ? 'post' : kind === 'reel' ? 'reel' : 'story';
  const text = `Check out ${who} ${noun} on Paasxo 🏆`;
  try {
    // iOS takes the link separately (rich preview; putting it in `message` too
    // made WhatsApp show it twice). Android only reads `message`.
    await Share.share(
      Platform.OS === 'ios' ? { message: text, url } : { message: `${text}\n${url}` },
      { subject: `A ${noun} on Paasxo` },
    );
    return true;
  } catch {
    return false;
  }
}
