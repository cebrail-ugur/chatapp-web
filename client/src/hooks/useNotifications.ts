/**
 * ChatApp Ultra - Push Bildirim Hook'u
 * FCM token yönetimi, bildirim izni ve yerel bildirim sistemi
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
// Firebase lazy import - sadece ihtiyaç duyulduğunda yüklenir (bundle boyutu optimizasyonu)
const getFirebase = () => import('@/lib/firebase');

// Senkron bildirim durumu kontrolü (Firebase yüklemeden)
function getPermissionSync(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

interface UseNotificationsOptions {
  userId: string | null;
  deviceId: string;
  currentChannelId: string | null;
  enabled: boolean;
}

interface NotificationState {
  permission: 'granted' | 'denied' | 'default' | 'unsupported';
  fcmToken: string | null;
  isSupported: boolean;
  unreadCount: number;
}

export function useNotifications({ userId, deviceId, currentChannelId, enabled }: UseNotificationsOptions) {
  const [state, setState] = useState<NotificationState>({
    permission: getPermissionSync(),
    fcmToken: null,
    isSupported: 'Notification' in window,
    unreadCount: 0,
  });
  
  const foregroundUnsubRef = useRef<(() => void) | null>(null);
  const isDocumentVisibleRef = useRef(true);

  // Sayfa görünürlüğünü takip et
  useEffect(() => {
    const handleVisibility = () => {
      isDocumentVisibleRef.current = document.visibilityState === 'visible';
      if (isDocumentVisibleRef.current) {
        // Sayfa görünür olduğunda okunmamış sayısını sıfırla
        setState(prev => ({ ...prev, unreadCount: 0 }));
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Bildirim izni iste
  const requestPermission = useCallback(async () => {
    const fb = await getFirebase();
    const token = await fb.requestNotificationPermission();
    
    if (token) {
      setState(prev => ({
        ...prev,
        permission: 'granted',
        fcmToken: token,
      }));

      // FCM token'ı Supabase'e kaydet
      if (userId && token !== 'local-notifications-enabled') {
        try {
          await supabase.from('users').update({ fcm_token: token }).eq('id', userId);
          // FCM token kaydedildi
        } catch (e) {
          console.error('[Notifications] FCM token kaydetme hatası:', e);
        }
      }
    } else {
      setState(prev => ({
        ...prev,
        permission: getPermissionSync(),
      }));
    }

    return token;
  }, [userId]);

  // Firebase ön plan mesajlarını dinle
  useEffect(() => {
    if (!enabled || state.permission !== 'granted') return;

    let cancelled = false;
    (async () => {
      const fb = await getFirebase();
      if (cancelled) return;
      if (fb.isFirebaseConfigured()) {
        const unsub = fb.onForegroundMessage((payload) => {
          const channelId = payload.data?.channelId;
          if (channelId === currentChannelId && isDocumentVisibleRef.current) return;
          fb.showLocalNotification(
            payload.notification?.title || 'ChatApp Ultra',
            payload.notification?.body || 'Yeni mesaj',
            { tag: `chatapp-${channelId}`, data: payload.data }
          );
          fb.playNotificationSound();
          setState(prev => ({ ...prev, unreadCount: prev.unreadCount + 1 }));
        });
        foregroundUnsubRef.current = unsub;
      }
    })();

    return () => {
      cancelled = true;
      if (foregroundUnsubRef.current) {
        foregroundUnsubRef.current();
        foregroundUnsubRef.current = null;
      }
    };
  }, [enabled, state.permission, currentChannelId]);

  // Yerel bildirim gönder (ChatContext'ten çağrılacak)
  const notifyNewMessage = useCallback(async (senderName: string, messageText: string, channelName: string, channelId: string) => {
    if (!enabled || state.permission !== 'granted') return;
    if (channelId === currentChannelId && isDocumentVisibleRef.current) return;

    const fb = await getFirebase();
    const truncatedText = messageText.length > 100 
      ? messageText.substring(0, 100) + '...' 
      : messageText;

    fb.showLocalNotification(
      `${senderName} • ${channelName}`,
      truncatedText,
      {
        tag: `chatapp-msg-${channelId}`,
        data: { channelId, senderName },
        onClick: () => { window.focus(); },
      }
    );
    fb.playNotificationSound();

    if (!isDocumentVisibleRef.current) {
      setState(prev => ({ ...prev, unreadCount: prev.unreadCount + 1 }));
    }
  }, [enabled, state.permission, currentChannelId]);

  // Okunmamış sayısını sıfırla
  const clearUnread = useCallback(() => {
    setState(prev => ({ ...prev, unreadCount: 0 }));
  }, []);

  return {
    ...state,
    requestPermission,
    notifyNewMessage,
    clearUnread,
  };
}
