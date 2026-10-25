import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { chatSocket } from '../lib/chatSocket';
import { initChat, resetChat } from '../stores/chatStore';

/**
 * Keeps the realtime chat connection open while signed in and the app is in
 * the foreground; closes it in the background (the server then pushes new
 * messages instead) and on sign-out. Mounted once in app/_layout.tsx.
 */
export function useChatConnection() {
  const { user } = useAuth();
  const uid = user?.firebaseUid ?? null;
  const isPlayer = !user?.accountType || user.accountType === 'USER';

  useEffect(() => {
    if (!uid || !isPlayer) {
      chatSocket.stop();
      resetChat();
      return;
    }
    initChat(uid);
    if (AppState.currentState === 'active') chatSocket.start();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') chatSocket.start();
      else if (next === 'background') chatSocket.stop();
    });
    return () => {
      sub.remove();
      chatSocket.stop();
    };
  }, [uid, isPlayer]);
}
