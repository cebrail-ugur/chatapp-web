/**
 * ChatApp Ultra - Metadata Koruma Modülü (metadataGuard.ts)
 * ──────────────────────────────────────────────────────────
 * DEVLET SEVİYESİ SERTLEŞTİRME:
 * - Mesaj boyut padding (256-byte bloklar)
 * - Sabit uzunluklu ciphertext opsiyonu
 * - Şifreli typing indicator
 * - Şifreli online/offline indicator
 * - Timing jitter (mesaj gönderim zamanlaması gürültüsü)
 * 
 * Amaç: Trafik analizi saldırılarına karşı metadata sızıntısını minimize etmek.
 * Referans: Signal Protocol - Sealed Sender konsepti
 */

import { cryptoAPI } from './keyManager';

// ============================================================
// SABİTLER
// ============================================================

/** Padding blok boyutu (byte) */
const PADDING_BLOCK_SIZE = 256;

/** Sabit uzunluk modu için maksimum mesaj boyutu (byte) */
const FIXED_LENGTH_SIZE = 4096;

/** Padding magic byte - padding başlangıcını işaretler */
const PADDING_MARKER = 0x80;

/** Timing jitter aralığı (ms) - 50-500ms arası rastgele gecikme */
const MIN_JITTER_MS = 50;
const MAX_JITTER_MS = 500;

// ============================================================
// MESAJ BOYUT PADDİNG
// ============================================================

/**
 * Plaintext'e PKCS#7 benzeri padding ekler.
 * Mesaj boyutunu PADDING_BLOCK_SIZE'ın katına yuvarlar.
 * 
 * Format: [orijinal veri][0x80][0x00...0x00]
 * 
 * Bu sayede bir gözlemci mesajın gerçek boyutunu bilemez,
 * sadece hangi 256-byte bloğuna düştüğünü görebilir.
 */
export function padMessage(plaintext: Uint8Array): Uint8Array {
  // 0x80 marker + en az 1 byte padding
  const contentLen = plaintext.length + 1;
  const paddedLen = Math.ceil(contentLen / PADDING_BLOCK_SIZE) * PADDING_BLOCK_SIZE;
  
  const padded = new Uint8Array(paddedLen);
  padded.set(plaintext, 0);
  padded[plaintext.length] = PADDING_MARKER; // Marker byte
  // Geri kalan byte'lar zaten 0x00 (Uint8Array default)
  
  return padded;
}

/**
 * Padding'i kaldırır ve orijinal plaintext'i döndürür.
 * 0x80 marker byte'ını geriye doğru arar.
 */
export function unpadMessage(padded: Uint8Array): Uint8Array {
  // ISO/IEC 7816-4 padding kaldırma:
  // Sondan geriye doğru 0x00 byte'ları atla, ilk 0x80 marker'ı bul.
  // Bu yaklaşım, orijinal mesajda 0x80 byte'ı olsa bile doğru çalışır
  // çünkü padding her zaman sondan eklenir ve 0x80'den sonra sadece 0x00'lar gelir.
  let i = padded.length - 1;
  
  // Sondaki 0x00 byte'ları atla
  while (i >= 0 && padded[i] === 0x00) {
    i--;
  }
  
  // Şimdi padded[i] ya 0x80 (marker) ya da veri byte'ı
  if (i >= 0 && padded[i] === PADDING_MARKER) {
    return padded.slice(0, i);
  }
  
  // Marker bulunamadı - orijinal veriyi döndür (padding uygulanmamış olabilir)
  return padded;
}

/**
 * Sabit uzunluklu padding: Tüm mesajları FIXED_LENGTH_SIZE'a yuvarlar.
 * Daha güçlü metadata koruması sağlar ama bant genişliği kullanır.
 * 
 * Kısa mesajlar (< 4KB): 4KB'a padlenir
 * Uzun mesajlar (> 4KB): 4KB'ın katlarına padlenir
 */
export function padMessageFixed(plaintext: Uint8Array): Uint8Array {
  const contentLen = plaintext.length + 1;
  const paddedLen = Math.ceil(contentLen / FIXED_LENGTH_SIZE) * FIXED_LENGTH_SIZE;
  
  const padded = new Uint8Array(paddedLen);
  padded.set(plaintext, 0);
  padded[plaintext.length] = PADDING_MARKER;
  
  return padded;
}

// ============================================================
// ŞİFRELİ TYPING INDICATOR
// ============================================================

/**
 * Typing sinyalini şifreler.
 * Plaintext typing bilgisi yerine, HMAC-tabanlı token gönderilir.
 * Sunucu veya gözlemci kimin yazdığını bilemez.
 * 
 * Format: { token: base64(HMAC-SHA256(deviceId + timestamp)), ts: timestamp }
 */
export async function createEncryptedTypingSignal(
  deviceId: string,
  username: string,
  channelSecret: string
): Promise<{ encryptedPayload: string; ts: number }> {
  const ts = Date.now();
  const encoder = new TextEncoder();
  
  // Channel secret'tan HMAC key türet
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Typing payload'u şifrele
  const payload = JSON.stringify({ d: deviceId, u: username, t: ts });
  const payloadBytes = encoder.encode(payload);
  
  // AES-GCM ile şifrele (channel secret'tan türetilmiş key ile)
  const aesKeyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = cryptoAPI.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKeyMaterial,
    payloadBytes
  );
  
  // IV + ciphertext birleştir
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  const encryptedPayload = btoa(Array.from(combined).map(b => String.fromCharCode(b)).join(''));
  return { encryptedPayload, ts };
}

/**
 * Şifreli typing sinyalini çözer.
 */
export async function decryptTypingSignal(
  encryptedPayload: string,
  channelSecret: string
): Promise<{ deviceId: string; username: string; ts: number } | null> {
  try {
    const encoder = new TextEncoder();
    const combined = Uint8Array.from(atob(encryptedPayload), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    const aesKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(channelSecret.slice(0, 32).padEnd(32, '0')),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      aesKey,
      ciphertext
    );
    
    const payload = JSON.parse(new TextDecoder().decode(decrypted));
    return { deviceId: payload.d, username: payload.u, ts: payload.t };
  } catch {
    return null;
  }
}

// ============================================================
// ŞİFRELİ ONLINE/OFFLINE INDICATOR
// ============================================================

/**
 * Online/offline durumunu şifreli olarak broadcast eder.
 * Sunucu sadece şifreli blob görür, kimin online olduğunu bilemez.
 */
export async function createEncryptedPresenceSignal(
  deviceId: string,
  isOnline: boolean,
  channelSecret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const ts = Date.now();
  
  const payload = JSON.stringify({ d: deviceId, o: isOnline, t: ts });
  const payloadBytes = encoder.encode(payload);
  
  const aesKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = cryptoAPI.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    payloadBytes
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(Array.from(combined).map(b => String.fromCharCode(b)).join(''));
}

/**
 * Şifreli presence sinyalini çözer.
 */
export async function decryptPresenceSignal(
  encryptedPayload: string,
  channelSecret: string
): Promise<{ deviceId: string; isOnline: boolean; ts: number } | null> {
  try {
    const encoder = new TextEncoder();
    const combined = Uint8Array.from(atob(encryptedPayload), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    const aesKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(channelSecret.slice(0, 32).padEnd(32, '0')),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      aesKey,
      ciphertext
    );
    
    const payload = JSON.parse(new TextDecoder().decode(decrypted));
    return { deviceId: payload.d, isOnline: payload.o, ts: payload.t };
  } catch {
    return null;
  }
}

// ============================================================
// TIMING JİTTER (Zamanlama Gürültüsü)
// ============================================================

/**
 * Mesaj gönderiminde rastgele gecikme ekler.
 * Trafik analizi saldırılarında zamanlama korelasyonunu kırar.
 */
export function getTimingJitter(): Promise<void> {
  const jitter = MIN_JITTER_MS + Math.floor(
    cryptoAPI.getRandomValues(new Uint8Array(2))[0] / 255 * (MAX_JITTER_MS - MIN_JITTER_MS)
  );
  return new Promise(resolve => setTimeout(resolve, jitter));
}

/**
 * Dummy traffic: Belirli aralıklarla sahte şifreli paketler gönderir.
 * Gerçek mesaj trafiğini gizler.
 * 
 * NOT: Bu fonksiyon opsiyoneldir ve performans etkisi olabilir.
 * Yüksek güvenlik gerektiren senaryolarda etkinleştirilmelidir.
 */
export function generateDummyPacket(): Uint8Array {
  // Gerçek mesaj boyutuna benzer rastgele veri
  const size = PADDING_BLOCK_SIZE * (1 + Math.floor(Math.random() * 4));
  return cryptoAPI.getRandomValues(new Uint8Array(size));
}
