/**
 * ChatApp Ultra - Nonce Manager (nonceManager.ts)
 * ────────────────────────────────────────────────
 * AES-256-GCM Nonce/IV Benzersizlik Garantisi.
 * 
 * AES-GCM'de aynı key ile aynı nonce kullanılması catastrophic failure'a
 * yol açar: XOR ile plaintext sızar, auth tag forge edilebilir.
 * 
 * NONCE FORMAT (96-bit = 12 byte):
 * ┌────────────────────────────┬────────────────────┐
 * │  64-bit random prefix      │  32-bit counter    │
 * │  (8 byte)                  │  (4 byte)          │
 * └────────────────────────────┴────────────────────┘
 * 
 * - 64-bit random prefix: Cihazlar arası çakışmayı önler (P(collision) ≈ 2^-64)
 * - 32-bit counter: Aynı cihazda tekrarı önler (monoton artan, ~4.3 milyar mesaj)
 * 
 * COUNTER KURALLARI:
 * - IndexedDB'de saklanır (session'lar arası persist)
 * - Session başına RESETLENMEZ
 * - Rekey sonrası SIFIRLANIR (yeni key = yeni counter space)
 * - Overflow durumunda yeni random prefix üretilir
 * 
 * COLLISION DETECTION:
 * - Son 10.000 nonce hash'i saklanır
 * - Üretilen her nonce collision check'ten geçer
 * - Collision tespit edilirse yeni nonce üretilir (max 3 deneme)
 * - 3 denemede de collision olursa pure random fallback
 * 
 * Standartlar: NIST SP 800-38D Section 8.2.1 (Deterministic Construction)
 */

import {
  storeEncryptedData,
  getEncryptedData,
  deleteEncryptedData,
} from './secureStore';

// ============================================================
// SABİTLER
// ============================================================

const NONCE_STATE_KEY = 'sentinel_nonce_state_v2';
const NONCE_HISTORY_KEY = 'sentinel_nonce_hist_v2';

/** Nonce geçmişi maksimum boyutu */
const MAX_NONCE_HISTORY = 10000;

/** Nonce geçmişi temizleme eşiği (FIFO) */
const NONCE_CLEANUP_THRESHOLD = 8000;

/** Counter overflow eşiği (2^32 - 1) */
const COUNTER_MAX = 0xFFFFFFFF;

// ============================================================
// TİP TANIMLARI
// ============================================================

interface NonceState {
  /** 64-bit random prefix (hex string, 16 karakter) */
  randomPrefix: string;
  /** Monoton artan counter (0 → 2^32-1) */
  counter: number;
  /** Son kullanım zamanı (ms) */
  lastUsed: number;
  /** Toplam üretilen nonce sayısı (istatistik) */
  totalGenerated: number;
  /** Kaçıncı prefix epoch'undayız (overflow sayacı) */
  prefixEpoch: number;
}

// ============================================================
// IN-MEMORY CACHE
// ============================================================

let cachedState: NonceState | null = null;
let nonceHistoryCache: Set<string> | null = null;

// ============================================================
// STATE YÖNETİMİ
// ============================================================

/**
 * Nonce state'i başlatır veya mevcut state'i yükler.
 */
async function getOrInitState(): Promise<NonceState> {
  if (cachedState) return cachedState;

  const stored = await getEncryptedData<NonceState>(NONCE_STATE_KEY);
  if (stored) {
    cachedState = stored;
    return stored;
  }

  // Yeni state oluştur
  const prefixBytes = crypto.getRandomValues(new Uint8Array(8));
  const randomPrefix = bytesToHex(prefixBytes);

  const newState: NonceState = {
    randomPrefix,
    counter: 0,
    lastUsed: Date.now(),
    totalGenerated: 0,
    prefixEpoch: 0,
  };

  cachedState = newState;
  await storeEncryptedData(NONCE_STATE_KEY, newState);
  return newState;
}

/**
 * State'i günceller ve persist eder.
 */
async function persistState(state: NonceState): Promise<void> {
  cachedState = state;
  await storeEncryptedData(NONCE_STATE_KEY, state);
}

// ============================================================
// NONCE ÜRETİMİ
// ============================================================

/**
 * Benzersiz 12-byte (96-bit) nonce üretir.
 * 
 * Format:
 * - Byte 0-7: 64-bit random prefix (cihaz başına sabit, overflow'da yenilenir)
 * - Byte 8-11: 32-bit counter (monoton artan, big-endian)
 * 
 * Bu yapı NIST SP 800-38D Section 8.2.1'e uygun
 * "deterministic construction" yöntemidir.
 * 
 * @returns 12-byte Uint8Array nonce
 */
export async function generateNonce(): Promise<Uint8Array> {
  const state = await getOrInitState();

  // Counter'ı arttır
  state.counter++;
  state.totalGenerated++;
  state.lastUsed = Date.now();

  // Counter overflow kontrolü
  if (state.counter >= COUNTER_MAX) {
    // Yeni random prefix üret ve counter'ı sıfırla
    const newPrefixBytes = crypto.getRandomValues(new Uint8Array(8));
    state.randomPrefix = bytesToHex(newPrefixBytes);
    state.counter = 1;
    state.prefixEpoch++;
  }

  await persistState(state);

  // 12-byte nonce oluştur
  const nonce = new Uint8Array(12);

  // Byte 0-7: 64-bit random prefix
  const prefixBytes = hexToBytes(state.randomPrefix);
  nonce.set(prefixBytes, 0);

  // Byte 8-11: 32-bit counter (big-endian)
  const counterView = new DataView(nonce.buffer, 8, 4);
  counterView.setUint32(0, state.counter, false); // big-endian

  return nonce;
}

/**
 * Nonce'un daha önce kullanılıp kullanılmadığını kontrol eder.
 * Collision detection katmanı.
 * 
 * @returns true = nonce güvenli (kullanılmamış), false = collision!
 */
export async function checkNonceUniqueness(nonce: Uint8Array): Promise<boolean> {
  const nonceHex = bytesToHex(nonce);

  // In-memory cache'i yükle
  if (!nonceHistoryCache) {
    const stored = await getEncryptedData<string[]>(NONCE_HISTORY_KEY);
    nonceHistoryCache = new Set(stored || []);
  }

  // Collision kontrolü
  if (nonceHistoryCache.has(nonceHex)) {
    return false; // COLLISION DETECTED
  }

  // Nonce'u geçmişe ekle
  nonceHistoryCache.add(nonceHex);

  // Boyut kontrolü ve persist
  if (nonceHistoryCache.size > MAX_NONCE_HISTORY) {
    // FIFO: En eski nonce'ları sil
    const arr = Array.from(nonceHistoryCache);
    const trimmed = arr.slice(arr.length - NONCE_CLEANUP_THRESHOLD);
    nonceHistoryCache = new Set(trimmed);
  }

  // Async persist (non-blocking)
  storeEncryptedData(NONCE_HISTORY_KEY, Array.from(nonceHistoryCache)).catch(() => {});

  return true;
}

/**
 * Güvenli nonce üretir ve benzersizliğini doğrular.
 * Collision durumunda yeni nonce üretir (max 3 deneme).
 * 
 * Bu fonksiyon tüm şifreleme işlemlerinde kullanılmalıdır:
 * - ratchetEncrypt
 * - aesGcmEncrypt
 * - wrapChannelKeyForUser
 * - encryptHeader
 */
export async function generateSafeNonce(): Promise<Uint8Array> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const nonce = await generateNonce();
    const isUnique = await checkNonceUniqueness(nonce);

    if (isUnique) {
      return nonce;
    }

    // Collision tespit edildi - counter zaten arttı, tekrar dene
    console.warn(`[NonceManager] Collision detected, attempt ${attempt + 1}/3`);
  }

  // 3 denemede de collision (astronomik olasılık): pure random fallback
  console.error('[NonceManager] 3 consecutive collisions! Using pure random fallback.');
  const fallbackNonce = crypto.getRandomValues(new Uint8Array(12));
  await checkNonceUniqueness(fallbackNonce); // Geçmişe ekle
  return fallbackNonce;
}

// ============================================================
// REKEY SONRASI SIFIRLAMA
// ============================================================

/**
 * Rekey sonrası counter'ı sıfırlar ve yeni random prefix üretir.
 * Yeni key = yeni nonce space, counter güvenle sıfırlanabilir.
 */
export async function resetNonceForRekey(): Promise<void> {
  const prefixBytes = crypto.getRandomValues(new Uint8Array(8));

  const newState: NonceState = {
    randomPrefix: bytesToHex(prefixBytes),
    counter: 0,
    lastUsed: Date.now(),
    totalGenerated: cachedState?.totalGenerated || 0,
    prefixEpoch: (cachedState?.prefixEpoch || 0) + 1,
  };

  cachedState = newState;
  await storeEncryptedData(NONCE_STATE_KEY, newState);

  // Nonce geçmişini de temizle (yeni key space)
  nonceHistoryCache = new Set();
  await storeEncryptedData(NONCE_HISTORY_KEY, []);
}

// ============================================================
// İSTATİSTİKLER VE İZLEME
// ============================================================

/**
 * Nonce manager durumunu döndürür (monitoring/debug için).
 */
export async function getNonceManagerStats(): Promise<{
  counter: number;
  prefixEpoch: number;
  totalGenerated: number;
  historySize: number;
  lastUsed: number;
  counterUtilization: string; // "0.001%" gibi
}> {
  const state = await getOrInitState();

  if (!nonceHistoryCache) {
    const stored = await getEncryptedData<string[]>(NONCE_HISTORY_KEY);
    nonceHistoryCache = new Set(stored || []);
  }

  const utilization = ((state.counter / COUNTER_MAX) * 100).toFixed(6);

  return {
    counter: state.counter,
    prefixEpoch: state.prefixEpoch,
    totalGenerated: state.totalGenerated,
    historySize: nonceHistoryCache.size,
    lastUsed: state.lastUsed,
    counterUtilization: utilization + '%',
  };
}

// ============================================================
// TEMİZLİK
// ============================================================

/**
 * Tüm nonce verilerini temizler (workspace çıkışı).
 */
export async function clearNonceData(): Promise<void> {
  cachedState = null;
  nonceHistoryCache = null;
  await deleteEncryptedData(NONCE_STATE_KEY);
  await deleteEncryptedData(NONCE_HISTORY_KEY);
}

// ============================================================
// YARDIMCI FONKSİYONLAR
// ============================================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
