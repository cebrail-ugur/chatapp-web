/**
 * ChatApp Ultra - Firebase Messaging Service Worker
 * Arka planda push bildirimleri almak için gerekli
 * 
 * Bu dosya client/public/ dizininde olmalı (root'ta serve edilir)
 */

/* eslint-disable no-restricted-globals */

// Firebase SDK'yı CDN'den yükle (Service Worker'da import kullanılamaz)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase konfigürasyonu
// NOT: Service Worker'lar import.meta.env okuyamaz — değerleri manuel girin.
// .env.example dosyasındaki VITE_FIREBASE_* değerlerini buraya kopyalayın.
// Adımlar:
//   1. Firebase Console → Project Settings → General → Web app
//   2. Aşağıdaki alanları kendi proje bilgilerinizle doldurun
//   3. Push bildirim kullanmayacaksanız bu dosyayı değiştirmenize gerek yok
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',             // VITE_FIREBASE_API_KEY değeri
  authDomain: 'YOUR_PROJECT.firebaseapp.com', // VITE_FIREBASE_AUTH_DOMAIN
  projectId: 'YOUR_PROJECT_ID',       // VITE_FIREBASE_PROJECT_ID
  storageBucket: 'YOUR_PROJECT.appspot.com',  // VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: 'YOUR_SENDER_ID',// VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: 'YOUR_APP_ID',               // VITE_FIREBASE_APP_ID
};

// Konfigürasyon kontrolü
const isConfigured = firebaseConfig.apiKey !== 'YOUR_API_KEY';

if (isConfigured) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Arka plan mesajı geldiğinde bildirim göster
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Arka plan mesajı alındı:', payload);

    const notificationTitle = payload.notification?.title || 'ChatApp Ultra';
    const notificationOptions = {
      body: payload.notification?.body || 'Yeni bir mesajınız var',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'chatapp-ultra-' + (payload.data?.channelId || 'general'),
      data: payload.data,
      actions: [
        { action: 'open', title: 'Aç' },
        { action: 'dismiss', title: 'Kapat' }
      ],
      vibrate: [200, 100, 200],
      requireInteraction: false,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Bildirime tıklandığında uygulamayı aç
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Uygulamayı aç veya odakla
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Zaten açık bir pencere varsa odakla
      for (const client of clientList) {
        if (client.url.includes('/app') && 'focus' in client) {
          return client.focus();
        }
      }
      // Yoksa yeni pencere aç
      if (self.clients.openWindow) {
        return self.clients.openWindow('/app');
      }
    })
  );
});

// Service Worker kurulumu
self.addEventListener('install', (event) => {
  console.log('[SW] ChatApp Ultra Service Worker kuruldu');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] ChatApp Ultra Service Worker aktif');
  event.waitUntil(self.clients.claim());
});
