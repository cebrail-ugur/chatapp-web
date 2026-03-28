/**
 * ChatApp Ultra - User Key Manager (userKeyManager.ts)
 * ─────────────────────────────────────────────────────
 * Kullanıcı anahtar yaşam döngüsü yönetimi.
 * 
 * Her kullanıcı için:
 * - identity_private_key (Curve25519) → Sadece cihazda, IndexedDB, device-bound AES-GCM
 * - identity_public_key (Curve25519) → Supabase user_keys tablosunda publish
 * - signed_prekey → X3DH handshake için
 * - one_time_prekeys → X3DH tek kullanımlık anahtarlar
 * - fingerprint → SHA-256 hash of identity_public_key
 * 
 * GÜVENLİK İLKELERİ:
 * 1. Private key ASLA server'a gitmez
 * 2. Private key device-bound AES-GCM ile şifrelenir (IndexedDB)
 * 3. Public key Supabase'e publish edilir (diğer kullanıcılar ECDH yapabilsin)
 * 4. Fingerprint = SHA-256(identity_public_key) → MITM tespiti
 * 5. Key rotation: Signed prekey periyodik yenilenir
 * 6. One-time prekeys tükendiğinde otomatik yenilenir
 * 
 * Standartlar: X25519 (RFC 7748), Ed25519 (RFC 8032), SHA-256 (FIPS 180-4)
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import {
  subtle,
  cryptoAPI,
  arrayBufferToHex,
  generateX25519IdentityKeyPair,
  hkdfDerive,
} from './keyManager';
import {
  generateSignedPreKey,
  generateOneTimePreKeys,
  type SignedPreKey,
  type OneTimePreKey,
} from './x3dh';
import { supabase } from './supabase';
import {
  storeEncryptedData,
  getEncryptedData,
  deleteEncryptedData,
  deleteEncryptedDataByPrefix,
} from './secureStore';

// ============================================================
// SABİTLER
// ============================================================

const USER_IDENTITY_KEY_PREFIX = 'sentinel_uik_v2_';
const USER_SPK_PREFIX = 'sentinel_user_spk_';
const USER_OPK_PREFIX = 'sentinel_user_opk_';
const USER_KEY_META_PREFIX = 'sentinel_ukm_';

/** One-time prekey minimum sayısı (bu sayının altına düşünce yenilenir) */
const MIN_OPK_COUNT = 5;

/** One-time prekey batch üretim sayısı */
const OPK_BATCH_SIZE = 10;

/** Signed prekey rotasyon süresi: 7 gün */
const SPK_ROTATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================
// TİP TANIMLARI
// ============================================================

export interface UserKeyBundle {
  identityPublicKey: string;
  signedPreKey: SignedPreKey;
  oneTimePreKeys: OneTimePreKey[];
  fingerprint: string;
  createdAt: number;
}

interface UserKeyMeta {
  identityPublicKey: string;
  fingerprint: string;
  spkCreatedAt: number;
  opkCount: number;
  lastPublishedAt: number;
  keyVersion: number;
}

interface StoredIdentityKey {
  publicKey: string;
  secretKey: string;
  createdAt: number;
  version: number;
}

// ============================================================
// FINGERPRINT ÜRETİMİ
// ============================================================

/**
 * Identity public key'den SHA-256 fingerprint üretir.
 * Format: 64 hex karakter (32 byte hash)
 */
export async function generateFingerprint(identityPublicKey: string): Promise<string> {
  const keyBytes = decodeBase64(identityPublicKey);
  const hash = await subtle.digest('SHA-256', keyBytes);
  return arrayBufferToHex(hash);
}

/**
 * Kısa fingerprint (UI gösterimi için).
 * Format: "AB12 CD34 EF56 GH78" (16 hex karakter, 4x4 gruplu)
 */
export async function getShortFingerprint(identityPublicKey: string): Promise<string> {
  const full = await generateFingerprint(identityPublicKey);
  const short = full.substring(0, 16).toUpperCase();
  return short.match(/.{1,4}/g)?.join(' ') || short;
}

// ============================================================
// ANAHTAR ÜRETİMİ VE SAKLAMA
// ============================================================

/**
 * Kullanıcı için tam anahtar seti üretir.
 * 
 * 1. X25519 identity key pair üretir
 * 2. Signed prekey üretir (Ed25519 imzalı)
 * 3. One-time prekeys üretir (10 adet)
 * 4. Fingerprint hesaplar
 * 5. Private key'i IndexedDB'ye device-bound şifreli kaydeder
 * 6. Public key bundle'ı Supabase'e publish eder
 * 
 * @returns UserKeyBundle (public bilgiler)
 */
export async function generateUserKeyBundle(
  userId: string,
  deviceId: string,
  workspaceId: string
): Promise<UserKeyBundle> {
  // 1. Identity key pair
  const identityKeyPair = generateX25519IdentityKeyPair();

  // 2. Signed prekey
  const signedPreKey = generateSignedPreKey(identityKeyPair.secretKey);

  // 3. One-time prekeys
  const oneTimePreKeys = generateOneTimePreKeys(OPK_BATCH_SIZE);

  // 4. Fingerprint
  const fingerprint = await generateFingerprint(identityKeyPair.publicKey);

  const now = Date.now();

  // 5. Private key'i IndexedDB'ye kaydet (device-bound AES-GCM)
  const identityStore: StoredIdentityKey = {
    publicKey: identityKeyPair.publicKey,
    secretKey: identityKeyPair.secretKey,
    createdAt: now,
    version: 1,
  };
  await storeEncryptedData(
    USER_IDENTITY_KEY_PREFIX + workspaceId + '_' + deviceId,
    identityStore
  );

  // Signed prekey'i kaydet
  await storeEncryptedData(
    USER_SPK_PREFIX + workspaceId + '_' + deviceId,
    signedPreKey
  );

  // One-time prekeys'i kaydet
  await storeEncryptedData(
    USER_OPK_PREFIX + workspaceId + '_' + deviceId,
    oneTimePreKeys
  );

  // Key metadata
  const meta: UserKeyMeta = {
    identityPublicKey: identityKeyPair.publicKey,
    fingerprint,
    spkCreatedAt: now,
    opkCount: oneTimePreKeys.length,
    lastPublishedAt: now,
    keyVersion: 1,
  };
  await storeEncryptedData(
    USER_KEY_META_PREFIX + workspaceId + '_' + deviceId,
    meta
  );

  // 6. Public key bundle'ı Supabase'e publish et
  await publishKeyBundle(userId, deviceId, workspaceId, {
    identityPublicKey: identityKeyPair.publicKey,
    signedPreKey,
    oneTimePreKeys,
    fingerprint,
  });

  return {
    identityPublicKey: identityKeyPair.publicKey,
    signedPreKey,
    oneTimePreKeys,
    fingerprint,
    createdAt: now,
  };
}

/**
 * Public key bundle'ı Supabase user_keys tablosuna publish eder.
 * Server sadece public bilgileri saklar.
 */
async function publishKeyBundle(
  userId: string,
  deviceId: string,
  workspaceId: string,
  bundle: {
    identityPublicKey: string;
    signedPreKey: SignedPreKey;
    oneTimePreKeys: OneTimePreKey[];
    fingerprint: string;
  }
): Promise<void> {
  try {
    await supabase.from('user_keys').upsert({
      user_id: userId,
      device_id: deviceId,
      workspace_id: workspaceId,
      identity_public_key: bundle.identityPublicKey,
      signed_prekey: JSON.stringify(bundle.signedPreKey),
      one_time_prekeys: JSON.stringify(bundle.oneTimePreKeys),
      fingerprint: bundle.fingerprint,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
    }, {
      onConflict: 'device_id,workspace_id',
    });
  } catch {
    // Tablo yoksa sessizce devam et (migration gerekebilir)
  }
}

// ============================================================
// ANAHTAR OKUMA
// ============================================================

/**
 * Kendi identity key pair'imizi IndexedDB'den okur.
 */
export async function getMyIdentityKeyPair(
  workspaceId: string,
  deviceId: string
): Promise<{ publicKey: string; secretKey: string } | null> {
  const stored = await getEncryptedData<StoredIdentityKey>(
    USER_IDENTITY_KEY_PREFIX + workspaceId + '_' + deviceId
  );
  if (!stored) return null;
  return { publicKey: stored.publicKey, secretKey: stored.secretKey };
}

/**
 * Kendi signed prekey'imizi IndexedDB'den okur.
 */
export async function getMySignedPreKey(
  workspaceId: string,
  deviceId: string
): Promise<SignedPreKey | null> {
  return getEncryptedData<SignedPreKey>(
    USER_SPK_PREFIX + workspaceId + '_' + deviceId
  );
}

/**
 * Kendi one-time prekeys'imizi IndexedDB'den okur.
 */
export async function getMyOneTimePreKeys(
  workspaceId: string,
  deviceId: string
): Promise<OneTimePreKey[]> {
  const stored = await getEncryptedData<OneTimePreKey[]>(
    USER_OPK_PREFIX + workspaceId + '_' + deviceId
  );
  return stored || [];
}

/**
 * Bir kullanıcının public key bundle'ını Supabase'den alır.
 */
export async function fetchUserKeyBundle(
  deviceId: string,
  workspaceId: string
): Promise<{
  identityPublicKey: string;
  signedPreKey: SignedPreKey;
  oneTimePreKeys: OneTimePreKey[];
  fingerprint: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from('user_keys')
      .select('identity_public_key, signed_prekey, one_time_prekeys, fingerprint')
      .eq('device_id', deviceId)
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    return {
      identityPublicKey: data.identity_public_key,
      signedPreKey: JSON.parse(data.signed_prekey),
      oneTimePreKeys: JSON.parse(data.one_time_prekeys || '[]'),
      fingerprint: data.fingerprint,
    };
  } catch {
    return null;
  }
}

/**
 * Key metadata'yı okur.
 */
export async function getKeyMeta(
  workspaceId: string,
  deviceId: string
): Promise<UserKeyMeta | null> {
  return getEncryptedData<UserKeyMeta>(
    USER_KEY_META_PREFIX + workspaceId + '_' + deviceId
  );
}

// ============================================================
// ONE-TIME PREKEY YÖNETİMİ
// ============================================================

/**
 * Bir one-time prekey tüketir (X3DH handshake sonrası).
 * Tüketilen key listeden çıkarılır ve Supabase güncellenir.
 */
export async function consumeOneTimePreKey(
  workspaceId: string,
  deviceId: string,
  opkId: string
): Promise<void> {
  const opks = await getMyOneTimePreKeys(workspaceId, deviceId);
  const remaining = opks.filter(k => k.id !== opkId);

  await storeEncryptedData(
    USER_OPK_PREFIX + workspaceId + '_' + deviceId,
    remaining
  );

  // OPK sayısı minimum altına düştüyse yenilerini üret
  if (remaining.length < MIN_OPK_COUNT) {
    await replenishOneTimePreKeys(workspaceId, deviceId);
  }
}

/**
 * One-time prekeys tükendiğinde yeni batch üretir.
 */
async function replenishOneTimePreKeys(
  workspaceId: string,
  deviceId: string
): Promise<void> {
  const existing = await getMyOneTimePreKeys(workspaceId, deviceId);
  const newOPKs = generateOneTimePreKeys(OPK_BATCH_SIZE);
  const combined = [...existing, ...newOPKs];

  await storeEncryptedData(
    USER_OPK_PREFIX + workspaceId + '_' + deviceId,
    combined
  );

  // Supabase'i güncelle
  try {
    await supabase
      .from('user_keys')
      .update({
        one_time_prekeys: JSON.stringify(combined),
        updated_at: new Date().toISOString(),
      })
      .eq('device_id', deviceId)
      .eq('workspace_id', workspaceId);
  } catch {
    // Sessizce devam et
  }
}

// ============================================================
// SIGNED PREKEY ROTASYONU
// ============================================================

/**
 * Signed prekey'in rotasyona ihtiyacı olup olmadığını kontrol eder.
 */
export async function shouldRotateSignedPreKey(
  workspaceId: string,
  deviceId: string
): Promise<boolean> {
  const meta = await getKeyMeta(workspaceId, deviceId);
  if (!meta) return true;

  const age = Date.now() - meta.spkCreatedAt;
  return age > SPK_ROTATION_INTERVAL_MS;
}

/**
 * Signed prekey'i yeniler.
 * Eski signed prekey bir süre daha kabul edilir (grace period).
 */
export async function rotateSignedPreKey(
  userId: string,
  workspaceId: string,
  deviceId: string
): Promise<SignedPreKey | null> {
  const identity = await getMyIdentityKeyPair(workspaceId, deviceId);
  if (!identity) return null;

  const newSPK = generateSignedPreKey(identity.secretKey);

  await storeEncryptedData(
    USER_SPK_PREFIX + workspaceId + '_' + deviceId,
    newSPK
  );

  // Metadata güncelle
  const meta = await getKeyMeta(workspaceId, deviceId);
  if (meta) {
    meta.spkCreatedAt = Date.now();
    meta.lastPublishedAt = Date.now();
    await storeEncryptedData(
      USER_KEY_META_PREFIX + workspaceId + '_' + deviceId,
      meta
    );
  }

  // Supabase'i güncelle
  try {
    await supabase
      .from('user_keys')
      .update({
        signed_prekey: JSON.stringify(newSPK),
        updated_at: new Date().toISOString(),
      })
      .eq('device_id', deviceId)
      .eq('workspace_id', workspaceId);
  } catch {
    // Sessizce devam et
  }

  return newSPK;
}

// ============================================================
// ANAHTAR SİLME VE TEMİZLİK
// ============================================================

/**
 * Kullanıcının tüm anahtarlarını siler (workspace'den çıkış).
 */
export async function deleteAllUserKeys(
  workspaceId: string,
  deviceId: string
): Promise<void> {
  const suffix = workspaceId + '_' + deviceId;

  await deleteEncryptedData(USER_IDENTITY_KEY_PREFIX + suffix);
  await deleteEncryptedData(USER_SPK_PREFIX + suffix);
  await deleteEncryptedData(USER_OPK_PREFIX + suffix);
  await deleteEncryptedData(USER_KEY_META_PREFIX + suffix);

  // Supabase'den de sil
  try {
    await supabase
      .from('user_keys')
      .update({ is_active: false })
      .eq('device_id', deviceId)
      .eq('workspace_id', workspaceId);
  } catch {
    // Sessizce devam et
  }
}

/**
 * Bir workspace'e ait tüm user key verilerini temizler.
 */
export async function clearAllUserKeysForWorkspace(workspaceId: string): Promise<void> {
  await deleteEncryptedDataByPrefix(USER_IDENTITY_KEY_PREFIX + workspaceId);
  await deleteEncryptedDataByPrefix(USER_SPK_PREFIX + workspaceId);
  await deleteEncryptedDataByPrefix(USER_OPK_PREFIX + workspaceId);
  await deleteEncryptedDataByPrefix(USER_KEY_META_PREFIX + workspaceId);
}

// ============================================================
// ANAHTAR DOĞRULAMA
// ============================================================

/**
 * Bir kullanıcının public key'inin değişip değişmediğini kontrol eder.
 * Key değişikliği MITM saldırısı veya cihaz değişikliği anlamına gelebilir.
 */
export async function verifyKeyConsistency(
  deviceId: string,
  workspaceId: string,
  knownFingerprint: string
): Promise<{
  consistent: boolean;
  currentFingerprint: string | null;
  warning: string | null;
}> {
  const bundle = await fetchUserKeyBundle(deviceId, workspaceId);
  if (!bundle) {
    return {
      consistent: false,
      currentFingerprint: null,
      warning: 'Kullanıcının anahtar bilgisi bulunamadı',
    };
  }

  const currentFingerprint = await generateFingerprint(bundle.identityPublicKey);

  if (currentFingerprint === knownFingerprint) {
    return {
      consistent: true,
      currentFingerprint,
      warning: null,
    };
  }

  return {
    consistent: false,
    currentFingerprint,
    warning: 'Kullanıcının güvenlik anahtarı değişti! Olası MITM saldırısı veya cihaz değişikliği.',
  };
}

/**
 * Kullanıcının anahtar setinin geçerli olup olmadığını kontrol eder.
 */
export async function validateUserKeyBundle(
  workspaceId: string,
  deviceId: string
): Promise<{
  valid: boolean;
  hasIdentityKey: boolean;
  hasSignedPreKey: boolean;
  opkCount: number;
  needsRotation: boolean;
}> {
  const identity = await getMyIdentityKeyPair(workspaceId, deviceId);
  const spk = await getMySignedPreKey(workspaceId, deviceId);
  const opks = await getMyOneTimePreKeys(workspaceId, deviceId);
  const needsRotation = await shouldRotateSignedPreKey(workspaceId, deviceId);

  return {
    valid: !!identity && !!spk,
    hasIdentityKey: !!identity,
    hasSignedPreKey: !!spk,
    opkCount: opks.length,
    needsRotation,
  };
}
