import React, { memo, useRef } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertCircle, CalendarClock, ChevronRight, MapPin } from 'lucide-react-native';
import { ChatMessage } from '../../api/chatApi';
import { ThemeColors } from '../../styles/colors';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { ChatAvatar } from './ChatAvatar';
import { matchWhen, sportEmoji } from './chatFormat';

export const MINE_GRADIENT: [string, string] = ['#3B8FD4', '#2977C2'];
const IMG_MAX_W = 236;
const DOUBLE_TAP_MS = 280;

interface Props {
  m: ChatMessage;
  mine: boolean;
  first: boolean;   // first in a run from the same sender
  last: boolean;    // last in that run (shows avatar / tail)
  me: string | null;
  otherName: string;
  otherAvatar?: string | null;
  /** Group chats: show the sender's name above the first bubble of their run. */
  senderLabel?: string | null;
  /** Group chats: resolve a uid to a name (for "replying to"). */
  nameOf?: (uid: string) => string;
  colors: ThemeColors;
  onLongPress: (m: ChatMessage) => void;
  onDoubleTap: (m: ChatMessage) => void;
  onOpenImage: (uri: string) => void;
  onOpenMatch: (bookingId: number) => void;
  /** STORY_REPLY / STORY messages: open the story (live, privacy-checked). */
  onOpenStory?: (storyId: string) => void;
  onRetry: (m: ChatMessage) => void;
}

function bubbleRadii(mine: boolean, first: boolean, last: boolean) {
  const big = 20;
  const small = 6;
  return mine
    ? { borderTopLeftRadius: big, borderBottomLeftRadius: big, borderTopRightRadius: first ? big : small, borderBottomRightRadius: last ? big : small }
    : { borderTopRightRadius: big, borderBottomRightRadius: big, borderTopLeftRadius: first ? big : small, borderBottomLeftRadius: last ? big : small };
}

export const MessageBubble = memo(function MessageBubble({
  m, mine, first, last, me, otherName, otherAvatar, senderLabel, nameOf, colors, onLongPress, onDoubleTap, onOpenImage, onOpenMatch, onOpenStory, onRetry,
}: Props) {
  const lastTap = useRef(0);
  const radii = bubbleRadii(mine, first, last);
  const textColor = mine ? '#FFFFFF' : colors.text;
  const reactions = Object.values(m.reactions ?? {});
  const reactionSummary = summarise(reactions);

  const handlePress = () => {
    if (m.failed) { onRetry(m); return; }
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) { lastTap.current = 0; onDoubleTap(m); return; }
    lastTap.current = now;
  };

  const replyBlock = m.replyTo && !m.unsent ? (
    <View style={[s.reply, { borderLeftColor: mine ? 'rgba(255,255,255,0.7)' : colors.primary, backgroundColor: mine ? 'rgba(255,255,255,0.14)' : colors.neutral100 }]}>
      <Text style={[s.replyName, { color: mine ? '#fff' : colors.primary }]} numberOfLines={1}>
        {m.replyTo.senderUid === me ? 'You' : nameOf ? nameOf(m.replyTo.senderUid) : otherName}
      </Text>
      <Text style={[s.replyText, { color: mine ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]} numberOfLines={2}>
        {m.replyTo.text ?? 'Message unsent'}
      </Text>
    </View>
  ) : null;

  let body: React.ReactNode;
  if (m.unsent) {
    body = (
      <View style={[s.unsent, radii, { borderColor: colors.neutral200 }]}>
        <Text style={[s.unsentText, { color: colors.textMuted }]}>{mine ? 'You unsent a message' : 'Message unsent'}</Text>
      </View>
    );
  } else if (m.type === 'IMAGE') {
    const uri = m.localUri ?? resolveMediaUrl(m.mediaUrl) ?? '';
    const ratio = m.mediaWidth && m.mediaHeight ? Math.min(1.8, Math.max(0.55, m.mediaWidth / m.mediaHeight)) : 0.8;
    body = (
      <View style={[s.imageWrap, radii]}>
        {replyBlock && <View style={{ padding: 6, backgroundColor: mine ? '#2977C2' : colors.cardBg }}>{replyBlock}</View>}
        <Pressable onPress={() => (m.pending || m.failed ? handlePress() : onOpenImage(uri))} onLongPress={() => onLongPress(m)} delayLongPress={300}>
          <Image source={{ uri }} style={{ width: IMG_MAX_W, height: IMG_MAX_W / ratio, backgroundColor: colors.neutral200 }} resizeMode="cover" />
          {m.pending && (
            <View style={s.imageOverlay}><ActivityIndicator color="#fff" /></View>
          )}
        </Pressable>
        {!!m.text && (
          <View style={{ padding: 10, backgroundColor: mine ? '#2977C2' : colors.cardBg }}>
            <Text style={[s.text, { color: textColor }]}>{m.text}</Text>
          </View>
        )}
      </View>
    );
  } else if ((m.type === 'STORY_REPLY' || m.type === 'STORY') && m.story) {
    const st = m.story;
    const expired = !!st.expiresAt && new Date(st.expiresAt).getTime() < Date.now();
    const thumb = !expired && st.mediaUrl ? resolveMediaUrl(st.mediaUrl) : null;
    const label = m.type === 'STORY_REPLY'
      ? (mine ? `You replied to ${st.ownerName?.split(' ')[0] ?? 'their'}’s story` : 'Replied to your story')
      : `${st.ownerName ?? 'A'}’s story`;
    body = (
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
        <Text style={[s.storyLabel, { color: colors.textMuted }]}>{label}</Text>
        <Pressable
          onPress={() => { if (m.failed) onRetry(m); else if (!expired) onOpenStory?.(st.storyId); }}
          onLongPress={() => onLongPress(m)}
          delayLongPress={300}
          style={[s.storyThumb, { borderColor: colors.neutral200 }]}
          accessibilityRole="button"
          accessibilityLabel={expired ? 'Story no longer available' : 'Open story'}
        >
          {thumb ? (
            <Image source={{ uri: thumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#22D3EE', '#2977C2', '#1E3A8A']} style={[StyleSheet.absoluteFillObject, s.storyThumbPh]}>
              <Text style={s.storyThumbText}>{expired ? 'Story\nunavailable' : st.mediaType === 'VIDEO' ? '▶︎ Video story' : 'Story'}</Text>
            </LinearGradient>
          )}
        </Pressable>
        {!!m.text && (
          <View style={[s.bubble, radii, mine ? { backgroundColor: '#2977C2' } : { backgroundColor: colors.cardBg }]}>
            <Text style={[s.text, { color: textColor }]}>{m.text}</Text>
          </View>
        )}
      </View>
    );
  } else if (m.type === 'MATCH' && m.match) {
    const mc = m.match;
    body = (
      <Pressable
        onPress={() => { if (m.failed) onRetry(m); else onOpenMatch(mc.bookingId); }}
        onLongPress={() => onLongPress(m)}
        delayLongPress={300}
        style={[s.matchCard, radii, { backgroundColor: colors.cardBg, borderColor: colors.primary + '55' }]}
        accessibilityRole="button"
        accessibilityLabel={`Shared match ${mc.title ?? ''}. Open match`}
      >
        <LinearGradient colors={['#22D3EE', '#2977C2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.matchBanner}>
          <Text style={s.matchEmoji}>{sportEmoji(mc.sport)}</Text>
          <Text style={s.matchBannerText}>{(mc.sport ?? 'MATCH').toUpperCase()} MATCH</Text>
        </LinearGradient>
        <View style={s.matchBody}>
          <Text style={[s.matchTitle, { color: colors.text }]} numberOfLines={2}>{mc.title || 'Match'}</Text>
          {!!mc.venueName && (
            <View style={s.matchMeta}>
              <MapPin color={colors.textMuted} size={12} strokeWidth={2.4} />
              <Text style={[s.matchMetaText, { color: colors.textSecondary }]} numberOfLines={1}>{mc.venueName}</Text>
            </View>
          )}
          {!!mc.date && (
            <View style={s.matchMeta}>
              <CalendarClock color={colors.textMuted} size={12} strokeWidth={2.4} />
              <Text style={[s.matchMetaText, { color: colors.textSecondary }]}>{matchWhen(mc.date, mc.startTime)}</Text>
            </View>
          )}
          {mc.status === 'CANCELLED' && <Text style={[s.matchCancelled, { color: colors.error }]}>Cancelled</Text>}
          <View style={[s.matchCta, { backgroundColor: colors.primary + '14' }]}>
            <Text style={[s.matchCtaText, { color: colors.primary }]}>View match</Text>
            <ChevronRight color={colors.primary} size={15} strokeWidth={2.6} />
          </View>
        </View>
      </Pressable>
    );
  } else {
    const content = (
      <>
        {replyBlock}
        <Text style={[s.text, { color: textColor }]} selectable={false}>{m.text}</Text>
      </>
    );
    body = mine ? (
      <LinearGradient colors={MINE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.bubble, radii]}>{content}</LinearGradient>
    ) : (
      <View style={[s.bubble, radii, { backgroundColor: colors.cardBg, borderColor: colors.neutral200, borderWidth: StyleSheet.hairlineWidth }]}>{content}</View>
    );
  }

  return (
    <View style={[s.row, mine ? s.rowMine : s.rowTheirs, { marginTop: first ? 8 : 2 }]}>
      {!mine && (
        <View style={s.avatarSlot}>
          {last && <ChatAvatar uri={otherAvatar} name={otherName} size={28} ringColor={colors.background} />}
        </View>
      )}
      <View style={{ maxWidth: '78%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
        {!mine && first && !!senderLabel && (
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textSecondary, marginBottom: 3, marginLeft: 4 }} numberOfLines={1}>
            {senderLabel}
          </Text>
        )}
        <Pressable
          onPress={handlePress}
          onLongPress={() => !m.pending && onLongPress(m)}
          delayLongPress={300}
          disabled={m.type !== 'TEXT' && !m.unsent}
          style={{ opacity: m.pending ? 0.75 : 1 }}
        >
          {body}
        </Pressable>
        {reactionSummary.length > 0 && (
          <View style={[s.reactions, { backgroundColor: colors.cardBg, borderColor: colors.background }, mine ? { marginRight: 6 } : { marginLeft: 6 }]}>
            {reactionSummary.map(([emoji, n]) => (
              <Text key={emoji} style={s.reactionText}>{emoji}{n > 1 ? <Text style={[s.reactionCount, { color: colors.textSecondary }]}> {n}</Text> : null}</Text>
            ))}
          </View>
        )}
        {m.failed && (
          <Pressable onPress={() => onRetry(m)} style={s.failedRow} hitSlop={6}>
            <AlertCircle color={colors.error} size={13} strokeWidth={2.6} />
            <Text style={[s.failedText, { color: colors.error }]}>Not sent · Tap to retry</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

function summarise(list: string[]): [string, number][] {
  const map = new Map<string, number>();
  list.forEach((e) => map.set(e, (map.get(e) ?? 0) + 1));
  return [...map.entries()].slice(0, 4);
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  avatarSlot: { width: 34, alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 9 },
  text: { fontSize: 15.5, lineHeight: 21 },
  reply: { borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 6 },
  replyName: { fontSize: 11.5, fontWeight: '900' },
  replyText: { fontSize: 12.5, marginTop: 1 },
  unsent: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  unsentText: { fontSize: 14, fontStyle: 'italic' },
  imageWrap: { overflow: 'hidden' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  storyLabel: { fontSize: 11.5, fontWeight: '700', marginHorizontal: 4 },
  storyThumb: { width: 120, height: 200, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  storyThumbPh: { alignItems: 'center', justifyContent: 'center' },
  storyThumbText: { color: '#fff', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  matchCard: { width: 248, borderWidth: 1.5, overflow: 'hidden' },
  matchBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  matchEmoji: { fontSize: 14 },
  matchBannerText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  matchBody: { padding: 12, gap: 5 },
  matchTitle: { fontSize: 15.5, fontWeight: '900' },
  matchMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchMetaText: { fontSize: 12.5, flexShrink: 1 },
  matchCancelled: { fontSize: 12, fontWeight: '900' },
  matchCta: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 10, paddingVertical: 8 },
  matchCtaText: { fontSize: 13, fontWeight: '900' },
  reactions: {
    flexDirection: 'row', gap: 2, marginTop: -8, borderRadius: 12, borderWidth: 2,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  reactionText: { fontSize: 13 },
  reactionCount: { fontSize: 11, fontWeight: '800' },
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  failedText: { fontSize: 11.5, fontWeight: '800' },
});
