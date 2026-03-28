/**
 * ChatApp Ultra - Firebase Cloud Messaging (FCM) Entegrasyonu
 * Push bildirimleri için Firebase SDK konfigürasyonu
 * 
 * NOT: Firebase Console'dan alınan bilgiler burada yapılandırılır.
 * Kullanıcı kendi Firebase projesini oluşturup bilgileri güncelleyecek.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

// Firebase konfigürasyonu - Firebase Console'dan alınacak
// Kullanıcı kendi bilgilerini buraya girecek
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'YOUR_PROJECT.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'YOUR_PROJECT.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'YOUR_APP_ID',
};

// VAPID Key - Firebase Console > Cloud Messaging > Web Push certificates
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'YOUR_VAPID_KEY';

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

/**
 * Firebase'in yapılandırılıp yapılandırılmadığını kontrol et
 */
export function isFirebaseConfigured(): boolean {
  return (
    firebaseConfig.apiKey !== 'YOUR_API_KEY' &&
    firebaseConfig.projectId !== 'YOUR_PROJECT_ID' &&
    firebaseConfig.messagingSenderId !== 'YOUR_SENDER_ID'
  );
}

/**
 * Firebase uygulamasını başlat
 */
function initFirebase(): FirebaseApp | null {
  if (app) return app;
  if (!isFirebaseConfigured()) {
    console.warn('[Firebase] Yapılandırma eksik. Firebase Console bilgilerini .env dosyasına ekleyin.');
    return null;
  }
  try {
    app = initializeApp(firebaseConfig);
    return app;
  } catch (e) {
    console.error('[Firebase] Başlatma hatası:', e);
    return null;
  }
}

/**
 * Firebase Messaging servisini al
 */
function getMessagingInstance(): Messaging | null {
  if (messaging) return messaging;
  const firebaseApp = initFirebase();
  if (!firebaseApp) return null;
  try {
    messaging = getMessaging(firebaseApp);
    return messaging;
  } catch (e) {
    console.error('[Firebase] Messaging hatası:', e);
    return null;
  }
}

/**
 * Bildirim izni iste ve FCM token al
 */
export async function requestNotificationPermission(): Promise<string | null> {
  // Tarayıcı desteği kontrolü
  if (!('Notification' in window)) {
    console.warn('[FCM] Bu tarayıcı bildirimleri desteklemiyor.');
    return null;
  }

  // Service Worker desteği kontrolü
  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM] Service Worker desteklenmiyor.');
    return null;
  }

  try {
    // Bildirim izni iste
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Bildirim izni reddedildi.');
      return null;
    }

    const msg = getMessagingInstance();
    if (!msg) {
      // Firebase yapılandırılmamışsa, yerel bildirim sistemi kullan
      // Firebase yapılandırılmamış, yerel bildirim sistemi aktif
      return 'local-notifications-enabled';
    }

    // Service Worker'ı kaydet
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    
    // FCM Token al
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      // Token alındı - production'da loglanmaz
      return token;
    } else {
      console.warn('[FCM] Token alınamadı.');
      return null;
    }
  } catch (e) {
    console.error('[FCM] Token alma hatası:', e);
    // Hata olsa bile yerel bildirim sistemi çalışsın
    if (Notification.permission === 'granted') {
      return 'local-notifications-enabled';
    }
    return null;
  }
}

/**
 * Ön planda mesaj dinle (uygulama açıkken)
 */
export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  const msg = getMessagingInstance();
  if (!msg) return null;
  
  try {
    const unsubscribe = onMessage(msg, (payload) => {
      // Ön plan mesajı alındı
      callback(payload);
    });
    return unsubscribe;
  } catch (e) {
    console.error('[FCM] Ön plan dinleme hatası:', e);
    return null;
  }
}

/**
 * Yerel bildirim gönder (Firebase olmadan da çalışır)
 * Bu, tarayıcının Notification API'sini kullanır
 */
export function showLocalNotification(title: string, body: string, options?: {
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  onClick?: () => void;
}): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: options?.icon || '/favicon.ico',
      badge: options?.badge || '/favicon.ico',
      tag: options?.tag || 'chatapp-ultra-message',
      silent: false,
      requireInteraction: false,
      data: options?.data,
    });

    // Bildirime tıklandığında
    notification.onclick = () => {
      window.focus();
      notification.close();
      options?.onClick?.();
    };

    // 5 saniye sonra otomatik kapat
    setTimeout(() => notification.close(), 5000);
  } catch (e) {
    console.error('[Notification] Yerel bildirim hatası:', e);
  }
}

/**
 * Bildirim izni durumunu kontrol et
 */
export function getNotificationPermissionStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Ses çal - yeni mesaj geldiğinde
 */
export function playNotificationSound(): void {
  try {
    // Web Audio API ile kısa bir "ding" sesi oluştur
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 830; // Yüksek ton
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    // Ses çalınamazsa sessizce devam et
  }
}
