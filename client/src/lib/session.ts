/**
 * ChatApp Ultra - Oturum Yönetimi Modülü (session.ts)
 * ──────────────────────────────────────────────────────
 * GÜVENLİK SERTLEŞTİRME v2:
 * - CryptoJS KALDIRILDI → Tüm işlemler Web Crypto API
 * - localStorage KALDIRILDI → IndexedDB (secureStore.ts)
 * - v1/v2 legacy decrypt fonksiyonları KALDIRILDI
 * - Session expiration ve yeniden handshake mekanizması EKLENDİ
 * - Debug logları üretim ortamında devre dışı
 * 
 * Güvenlik Katmanları:
 * - Workspace key device-bound AES-GCM ile korunur (IndexedDB)
 * - Davet kodundan PBKDF2 (200K iterasyon) ile anahtar türetme
 * - v3: HKDF + AES-256-GCM (authenticated encryption)
 * - Session expiration: 7 gün sonra yeniden handshake zorunlu
 */

import {
  subtle,
  cryptoAPI,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  stringToArrayBuffer,
  arrayBufferToString,
  KEY_STORAGE_PREFIX,
} from './keyManager';

import {
  storeEncryptedData,
  getEncryptedData,
  deleteEncryptedData,
  deleteEncryptedDataByPrefix,
  getDeviceId,
} from './secureStore';

// ============================================================
// SABİTLER
// ============================================================

/** Session süresi: 7 gün (milisaniye) */
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** Session metadata prefix */
const SESSION_META_PREFIX = 'sentinel_session_meta_';

// ============================================================
// AES-256-GCM ŞİFRELEME (Authenticated Encryption)
// ============================================================

export async function deriveAESKey(masterKeyBase64: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const masterKeyBuffer = base64ToArrayBuffer(masterKeyBase64);

  const baseKey = await subtle.importKey(
    'raw',
    masterKeyBuffer,
    'HKDF',
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: stringToArrayBuffer('sentinel-ultra-aes-gcm-v3')
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function aesGcmEncrypt(plaintext: string, key: CryptoKey): Promise<{
  ciphertext: string;
  iv: string;
}> {
  const iv = cryptoAPI.getRandomValues(new Uint8Array(12));
  const encoded = stringToArrayBuffer(plaintext);

  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv, tagLength: 128 },
    key,
    encoded
  );

  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer)
  };
}

export async function aesGcmDecrypt(ciphertext: string, ivBase64: string, key: CryptoKey): Promise<string> {
  const iv = base64ToArrayBuffer(ivBase64);
  const encrypted = base64ToArrayBuffer(ciphertext);

  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv, tagLength: 128 },
    key,
    encrypted
  );

  return arrayBufferToString(decrypted);
}

// ============================================================
// WORKSPACE ANAHTAR YÖNETİMİ (IndexedDB)
// ============================================================

/**
 * Workspace anahtarını IndexedDB'de device-bound şifreli saklar.
 * (localStorage KALDIRILDI)
 */
export async function storeWorkspaceKey(workspaceId: string, key: string): Promise<void> {
  await storeEncryptedData(KEY_STORAGE_PREFIX + workspaceId, key);
}

/**
 * Workspace anahtarını IndexedDB'den okur.
 * Eski localStorage formatını da migration yapar (tek seferlik).
 */
export async function getWorkspaceKey(workspaceId: string): Promise<string | null> {
  // IndexedDB'den oku
  const stored = await getEncryptedData<string>(KEY_STORAGE_PREFIX + workspaceId);
  if (stored) return stored;

  // localStorage'dan migration (geriye uyumluluk - tek seferlik)
  const legacyV3 = localStorage.getItem(KEY_STORAGE_PREFIX + workspaceId);
  if (legacyV3 && legacyV3.includes('.')) {
    try {
      const [ivBase64, encryptedBase64] = legacyV3.split('.');
      const deviceId = await getDeviceId();

      const deviceKeyMaterial = await subtle.importKey(
        'raw',
        stringToArrayBuffer(deviceId + '_key_protection_v3'),
        'HKDF',
        false,
        ['deriveKey']
      );

      const protectionKey = await subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: stringToArrayBuffer('sentinel-device-protection'),
          info: stringToArrayBuffer('device-key-wrap')
        },
        deviceKeyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      const decrypted = await subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToArrayBuffer(ivBase64), tagLength: 128 },
        protectionKey,
        base64ToArrayBuffer(encryptedBase64)
      );

      const key = arrayBufferToString(decrypted);
      if (key) {
        // IndexedDB'ye taşı ve localStorage'dan sil
        await storeWorkspaceKey(workspaceId, key);
        localStorage.removeItem(KEY_STORAGE_PREFIX + workspaceId);
        return key;
      }
    } catch {
      // Migration başarısız - devam et
    }
  }

  // Eski legacy prefix kontrolü
  const legacyKey = 'sentinel_e2ee_key_' + workspaceId;
  const legacyStored = localStorage.getItem(legacyKey);
  if (legacyStored) {
    // Eski plaintext key'i IndexedDB'ye taşı
    await storeWorkspaceKey(workspaceId, legacyStored);
    localStorage.removeItem(legacyKey);
    return legacyStored;
  }

  return null;
}

/**
 * Workspace anahtarını siler (IndexedDB + localStorage temizliği).
 */
export async function deleteWorkspaceKey(workspaceId: string): Promise<void> {
  await deleteEncryptedData(KEY_STORAGE_PREFIX + workspaceId);
  // Legacy localStorage temizliği
  localStorage.removeItem(KEY_STORAGE_PREFIX + workspaceId);
  localStorage.removeItem('sentinel_e2ee_key_' + workspaceId);
  localStorage.removeItem('sentinel_ecdh_' + workspaceId + '_pub');
  localStorage.removeItem('sentinel_ecdh_' + workspaceId + '_priv');
}

/**
 * Workspace anahtarının var olup olmadığını kontrol eder.
 */
export async function hasWorkspaceKey(workspaceId: string): Promise<boolean> {
  const key = await getEncryptedData<string>(KEY_STORAGE_PREFIX + workspaceId);
  if (key) return true;

  // Legacy kontrol
  return !!(
    localStorage.getItem(KEY_STORAGE_PREFIX + workspaceId) ||
    localStorage.getItem('sentinel_e2ee_key_' + workspaceId)
  );
}

// ============================================================
// DAVET KODU İLE ANAHTAR PAYLAŞIMI (Web Crypto API only)
// ============================================================

export async function encryptKeyForInvite(workspaceKey: string, inviteCode: string): Promise<string> {
  const keyMaterial = await subtle.importKey(
    'raw',
    stringToArrayBuffer(inviteCode),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = cryptoAPI.getRandomValues(new Uint8Array(16));

  const derivedKey = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 200000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = cryptoAPI.getRandomValues(new Uint8Array(12));
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv, tagLength: 128 },
    derivedKey,
    stringToArrayBuffer(workspaceKey)
  );

  return arrayBufferToBase64(salt.buffer) + '.' +
         arrayBufferToBase64(iv.buffer) + '.' +
         arrayBufferToBase64(encrypted);
}

export async function decryptKeyFromInvite(encryptedKey: string, inviteCode: string): Promise<string | null> {
  try {
    const parts = encryptedKey.split('.');
    if (parts.length !== 3) {
      // Eski CryptoJS formatı artık desteklenmiyor
      return null;
    }

    const [saltBase64, ivBase64, encryptedBase64] = parts;

    const keyMaterial = await subtle.importKey(
      'raw',
      stringToArrayBuffer(inviteCode),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    const derivedKey = await subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: base64ToArrayBuffer(saltBase64),
        iterations: 200000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToArrayBuffer(ivBase64), tagLength: 128 },
      derivedKey,
      base64ToArrayBuffer(encryptedBase64)
    );

    return arrayBufferToString(decrypted);
  } catch {
    return null;
  }
}

// ============================================================
// SESSION EXPIRATION VE YENİDEN HANDSHAKE
// ============================================================

interface SessionMeta {
  createdAt: number;
  lastActivity: number;
  handshakeCount: number;
  /** Son rekey zamanı (ms) */
  lastRekeyAt: number;
  /** Rekey grace window başlangıcı (ms) - bu süreden sonra eski key de kabul edilir */
  graceWindowStart: number;
  /** Session durumu: 'active' | 'rekeying' | 'grace' */
  rekeyState: 'active' | 'rekeying' | 'grace';
}

/**
 * Session metadata'sını oluşturur veya günceller.
 */
export async function createSessionMeta(workspaceId: string, channelId: string): Promise<void> {
  const key = SESSION_META_PREFIX + workspaceId + '_' + channelId;
  const now = Date.now();
  const meta: SessionMeta = {
    createdAt: now,
    lastActivity: now,
    handshakeCount: 1,
    lastRekeyAt: now,
    graceWindowStart: 0,
    rekeyState: 'active',
  };
  await storeEncryptedData(key, meta);
}

/**
 * Session'ın aktif olduğunu kaydeder (son aktivite günceller).
 */
export async function touchSession(workspaceId: string, channelId: string): Promise<void> {
  const key = SESSION_META_PREFIX + workspaceId + '_' + channelId;
  const meta = await getEncryptedData<SessionMeta>(key);
  if (meta) {
    meta.lastActivity = Date.now();
    await storeEncryptedData(key, meta);
  }
}

/**
 * Session'ın süresinin dolup dolmadığını kontrol eder.
 * Süresi dolmuşsa yeniden handshake gerekir.
 */
export async function isSessionExpired(workspaceId: string, channelId: string): Promise<boolean> {
  const key = SESSION_META_PREFIX + workspaceId + '_' + channelId;
  const meta = await getEncryptedData<SessionMeta>(key);

  if (!meta) return true; // Meta yoksa session yok → expired

  const now = Date.now();
  const age = now - meta.createdAt;

  return age > SESSION_EXPIRY_MS;
}

/**
 * Session metadata'sını siler (yeniden handshake için).
 */
export async function deleteSessionMeta(workspaceId: string, channelId: string): Promise<void> {
  const key = SESSION_META_PREFIX + workspaceId + '_' + channelId;
  await deleteEncryptedData(key);
}

// ============================================================
// REKEY HANDSHAKE PROTOCOL
// ============================================================

/** Rekey grace window süresi: 5 dakika */
const REKEY_GRACE_WINDOW_MS = 5 * 60 * 1000;

/** Rekey öncesi uyarı süresi: Session expiry'den 1 saat önce */
const REKEY_WARNING_BEFORE_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Session'un rekey'e ihtiyacı olup olmadığını kontrol eder.
 * Session expiry'den 1 saat önce rekey başlatılır.
 */
export async function checkRekeyNeeded(workspaceId: string, channelId: string): Promise<{
  needsRekey: boolean;
  reason: 'none' | 'approaching_expiry' | 'expired' | 'forced';
  timeUntilExpiry: number;
}> {
  const key = SESSION_META_PREFIX + workspaceId + '_' + channelId;
  const meta = await getEncryptedData<SessionMeta>(key);

  if (!meta) {
    return { needsRekey: true, reason: 'expired', timeUntilExpiry: 0 };
  }

  const now = Date.now();
  const age = now - meta.createdAt;
  const timeUntilExpiry = SESSION_EXPIRY_MS - age;

  if (age > SESSION_EXPIRY_MS) {
    return { needsRekey: true, reason: 'expired', timeUntilExpiry: 0 };
  }

  if (timeUntilExpiry < REKEY_WARNING_BEFORE_EXPIRY_MS) {
    return { needsRekey: true, reason: 'approaching_expiry', timeUntilExpiry };
  }

  return { needsRekey: false, reason: 'none', timeUntilExpiry };
}

/**
 * Rekey handshake başlatır.
 * Grace window açılır: Bu süre içinde hem eski hem yeni key kabul edilir.
 */
export async function initiateRekey(workspaceId: string, channelId: string): Promise<void> {
  const key = SESSION_META_PREFIX + workspaceId + '_' + channelId;
  const meta = await getEncryptedData<SessionMeta>(key);

  if (meta) {
    meta.rekeyState = 'rekeying';
    meta.graceWindowStart = Date.now();
    await storeEncryptedData(key, meta);
  }
}

/**
 * Rekey tamamlandıktan sonra grace window başlatır.
 * Grace window süresince eski key de kabul edilir.
 */
export async function completeRekey(workspaceId: string, channelId: string): Promise<void> {
  const key = SESSION_META_PREFIX + workspaceId + '_' + channelId;
  const meta = await getEncryptedData<SessionMeta>(key);

  if (meta) {
    const now = Date.now();
    meta.rekeyState = 'grace';
    meta.lastRekeyAt = now;
    meta.graceWindowStart = now;
    meta.handshakeCount += 1;
    // Session'u yenile (yeni expiry)
    meta.createdAt = now;
    meta.lastActivity = now;
    await storeEncryptedData(key, meta);
  }
}

/**
 * Grace window'un aktif olup olmadığını kontrol eder.
 * Grace window içindeyse hem eski hem yeni key kabul edilir.
 */
export async function isInGraceWindow(workspaceId: string, channelId: string): Promise<boolean> {
  const key = SESSION_META_PREFIX + workspaceId + '_' + channelId;
  const meta = await getEncryptedData<SessionMeta>(key);

  if (!meta || meta.rekeyState !== 'grace') return false;

  const now = Date.now();
  const graceAge = now - meta.graceWindowStart;

  if (graceAge > REKEY_GRACE_WINDOW_MS) {
    // Grace window bitti - active'e dön
    meta.rekeyState = 'active';
    await storeEncryptedData(key, meta);
    return false;
  }

  return true;
}

/**
 * Session key continuity doğrulaması.
 * Mevcut session'un geçerli olup olmadığını kontrol eder.
 */
export async function validateSessionContinuity(workspaceId: string, channelId: string): Promise<{
  valid: boolean;
  reason: string;
}> {
  const key = SESSION_META_PREFIX + workspaceId + '_' + channelId;
  const meta = await getEncryptedData<SessionMeta>(key);

  if (!meta) {
    return { valid: false, reason: 'no_session' };
  }

  const now = Date.now();

  // Session expired
  if (now - meta.createdAt > SESSION_EXPIRY_MS) {
    return { valid: false, reason: 'expired' };
  }

  // Inactivity check (24 saat aktivite yoksa)
  if (now - meta.lastActivity > 24 * 60 * 60 * 1000) {
    return { valid: false, reason: 'inactive' };
  }

  return { valid: true, reason: 'ok' };
}

/**
 * Bir workspace'e ait tüm session metadata'larını temizler.
 */
export async function clearAllSessionMeta(workspaceId: string): Promise<void> {
  await deleteEncryptedDataByPrefix(SESSION_META_PREFIX + workspaceId);
}
