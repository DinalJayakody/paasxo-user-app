import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Image, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft, Send, MoreHorizontal, Phone, Video,
  Image as ImageIcon, Smile, Mic,
} from 'lucide-react-native';
import { ThemeColors } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';
import HeaderIconButton from '../components/HeaderIconButton';
import ScreenGlow from '../components/ScreenGlow';

interface Message {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
  read?: boolean;
}

// Demo conversation — replace with real WebSocket/API messages
const DEMO_MESSAGES: Message[] = [
  { id: '1', fromMe: false, text: "Hey! Are you joining the match tonight? ⚽", time: "7:32 PM", read: true },
  { id: '2', fromMe: true, text: "Yeah! I'll be there. 7:30 at City Futsal?", time: "7:35 PM", read: true },
  { id: '3', fromMe: false, text: "Perfect! I'll bring my team too 🔥", time: "7:36 PM", read: true },
  { id: '4', fromMe: false, text: "Can you pick a team name?", time: "7:36 PM", read: true },
  { id: '5', fromMe: true, text: "How about 'Thunder Strikers'? 😄", time: "7:38 PM", read: true },
  { id: '6', fromMe: false, text: "Love it! See you there 🏆", time: "7:39 PM", read: true },
];

const DEMO_PROFILES: Record<string, { name: string; avatar: string; sport: string; online: boolean }> = {
  default: {
    name: 'Marcus Chen',
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400',
    sport: 'FUTSAL',
    online: true,
  },
};

export default function ChatScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string; name?: string }>();
  const userId = params.userId ?? 'default';
  const profile = DEMO_PROFILES[userId] ?? DEMO_PROFILES.default;

  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const sendScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Scroll to bottom on mount
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
  }, []);

  const animateSend = () => {
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(sendScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  };

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || sending) return;
    animateSend();
    setSending(true);
    const msg: Message = {
      id: String(Date.now()),
      fromMe: true,
      text,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, msg]);
    setInputText('');
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
      setSending(false);
    }, 100);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const prevMsg = messages[index - 1];
    const showAvatar = !item.fromMe && (!prevMsg || prevMsg.fromMe);

    return (
      <View style={[styles.msgRow, item.fromMe ? styles.msgRowMe : styles.msgRowThem]}>
        {!item.fromMe && (
          <View style={styles.msgAvatarWrap}>
            {showAvatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.msgAvatar} />
            ) : (
              <View style={styles.msgAvatarSpacer} />
            )}
          </View>
        )}
        <View style={[styles.msgBubble, item.fromMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
          <Text style={[styles.msgText, item.fromMe ? styles.msgTextMe : styles.msgTextThem]}>
            {item.text}
          </Text>
          <Text style={[styles.msgTime, item.fromMe ? styles.msgTimeMe : styles.msgTimeThem]}>
            {item.time}{item.fromMe && item.read ? ' ✓✓' : ''}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenGlow />
      {/* Floating glass-gradient header */}
      <View style={styles.topHeaderShadow}>
        <View style={styles.topHeader}>
          <LinearGradient
            colors={[colors.primaryAccent, colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerGlassStroke} pointerEvents="none" />

          <HeaderIconButton onPress={() => router.back()} style={styles.headerBack}>
            <ArrowLeft color={colors.white} size={22} strokeWidth={2.5} />
          </HeaderIconButton>

          <Image source={{ uri: profile.avatar }} style={styles.headerAvatar} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{params.name ?? profile.name}</Text>
            <View style={styles.onlineRow}>
              <View style={[styles.onlineDot, { backgroundColor: profile.online ? colors.success : colors.neutral400 }]} />
              <Text style={styles.onlineText}>{profile.online ? 'Active now' : 'Offline'}</Text>
              <Text style={styles.sportBadge}>{profile.sport}</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <HeaderIconButton onPress={() => {}} style={styles.headerActionBtn}>
              <Phone color={colors.white} size={19} strokeWidth={2} />
            </HeaderIconButton>
            <HeaderIconButton onPress={() => {}} style={styles.headerActionBtn}>
              <Video color={colors.white} size={19} strokeWidth={2} />
            </HeaderIconButton>
          </View>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <View style={styles.chatDateHeader}>
              <View style={styles.chatDateLine} />
              <Text style={styles.chatDateText}>Today</Text>
              <View style={styles.chatDateLine} />
            </View>
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.inputSideBtn} activeOpacity={0.8}>
            <ImageIcon color={colors.neutral500} size={20} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message..."
              placeholderTextColor={colors.neutral400}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
            <TouchableOpacity style={styles.emojiBtn} activeOpacity={0.8}>
              <Smile color={colors.neutral400} size={18} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {inputText.trim() ? (
            <Animated.View style={{ transform: [{ scale: sendScale }] }}>
              <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.88}>
                <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.sendBtnGrad}>
                  <Send color={colors.white} size={18} strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity style={styles.inputSideBtn} activeOpacity={0.8}>
              <Mic color={colors.neutral500} size={20} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },

  // Header
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
  topHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 26,
    overflow: 'hidden',
    gap: 10,
  },
  headerGlassStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  headerBack: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white + '18',
  },
  headerAvatar: { width: 42, height: 42, borderRadius: 14, borderWidth: 2, borderColor: colors.white + '50' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '800', color: colors.white },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: { fontSize: 11, color: colors.white + 'BB', fontWeight: '600' },
  sportBadge: {
    fontSize: 9, fontWeight: '800', color: colors.primaryLight,
    backgroundColor: colors.white + '20', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, letterSpacing: 0.5,
  },
  headerActions: { flexDirection: 'row', gap: 6 },
  headerActionBtn: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white + '18',
  },

  // Messages
  messagesList: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, gap: 4 },
  chatDateHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, marginTop: 4 },
  chatDateLine: { flex: 1, height: 1, backgroundColor: colors.neutral200 },
  chatDateText: { fontSize: 11, fontWeight: '700', color: colors.neutral400 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 2 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },

  msgAvatarWrap: { width: 30 },
  msgAvatar: { width: 30, height: 30, borderRadius: 10 },
  msgAvatarSpacer: { width: 30, height: 30 },

  msgBubble: {
    maxWidth: '75%', borderRadius: 18, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  msgBubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  msgBubbleThem: {
    backgroundColor: colors.cardBg,
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 15, lineHeight: 21 },
  msgTextMe: { color: colors.white },
  msgTextThem: { color: colors.text },
  msgTime: { fontSize: 10, marginTop: 4, fontWeight: '600' },
  msgTimeMe: { color: colors.white + 'AA', textAlign: 'right' },
  msgTimeThem: { color: colors.neutral400 },

  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1, borderTopColor: colors.neutral200,
  },
  inputSideBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.neutral100,
  },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: colors.neutral100, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, minHeight: 40,
  },
  input: {
    flex: 1, fontSize: 15, color: colors.text,
    maxHeight: 100, lineHeight: 20,
  },
  emojiBtn: { paddingLeft: 6, paddingBottom: 2 },
  sendBtn: { borderRadius: 14, overflow: 'hidden' },
  sendBtnGrad: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
