/**
 * ChatApp Ultra - Channel Key Manager (channelKeyManager.ts)
 * ──────────────────────────────────────────────────────────
 * Zero-Knowledge Channel Key Dağıtımı ve Rotasyonu.
 * 
 * Her channel için 32-byte symmetric channel_key üretilir.
 * channel_key plaintext olarak ASLA server'a gitmez.
 * 
 * Her kullanıcı için:
 *   ECDH (Curve25519) → shared_secret
 *   HKDF → wrapping_key (32 byte)
 *   AES-256-GCM ile channel_key şifrelenir → encrypted_channel_key
 * 
 * Database: channel_keys tablosu
 *   (channel_id, user_id, encrypted_channel_key, iv, auth_tag, created_at)
 * 
 * Server sadece encrypted blob saklar, plaintext görmez.
 * 
 * KEY ROTATION:
 * - Admin istediğinde veya periyodik olarak channel key yenilenebilir
 * - Eski key grace period boyunca kabul edilir
 * - Yeni key tüm aktif üyelere dağıtılır
 * 
 * Standartlar: X25519 (RFC 7748), HKDF (RFC 5869), AES-256-GCM (NIST SP 800-38D)
 */

import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import {
  subtle,
  cryptoAPI,
  hkdfDerive,
  x25519SharedSecret,
} from './keyManager';
import { supabase } from './supabase';
import {
  storeEncryptedData,
  getEncryptedData,
  deleteEncryptedData,
  deleteEncryptedDataByPrefix,
} from './secureStore';
import { getMyIdentityKeyPair, fetchUserKeyBundle } from './userKeyManager';

// ============================================================
// SABİTLER
// ============================================================

const CHANNEL_KEY_CACHE_PREFIX = 'sentinel_ck_cache_';
const CHANNEL_KEY_HISTORY_PREFIX = 'sentinel_ck_hist_';

/** Channel key rotasyon süresi: 24 saat */
const CHANNEL_KEY_ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Grace period: Eski key bu süre boyunca kabul edilir (1 saat) */
const CHANNEL_KEY_GRACE_PERIOD_MS = 60 * 60 * 1000;

/** Maksimum eski key geçmişi */
const MAX_KEY_HISTORY = 5;

// ============================================================
// TİP TANIMLARI
// ============================================================

export interface ChannelKeyRecord {
  channelId: string;
  symmetricKey: string;       // Base64 encoded 32-byte AES key
  version: number;
  createdAt: number;
  distributorDeviceId: string;
}

interface ChannelKeyHistory {
  keys: Array<{
    symmetricKey: string;
    version: number;
    createdAt: number;
    expiredAt: number;
  }>;
}

export interface ChannelKeyDistributionResult {
  channelId: string;
  version: number;
  totalMembers: number;
  successCount: number;
  failedDeviceIds: string[];
}

// ============================================================
// CHANNEL KEY ÜRETİMİ
// ============================================================

/**
 * 32-byte kriptografik olarak güvenli channel key üretir.
 * Bu key AES-256-GCM'de symmetric key olarak kullanılır.
 */
export function generateChannelSymmetricKey(): string {
  const key = cryptoAPI.getRandomValues(new Uint8Array(32));
  return encodeBase64(key);
}

// ============================================================
// ECDH + HKDF + AES-GCM KEY WRAPPING
// ============================================================

/**
 * Channel key'i bir kullanıcının public key'i ile şifreler.
 * 
 * Akış:
 * 1. ECDH(sender_priv, recipient_pub) → shared_secret (32 byte)
 * 2. HKDF(shared_secret, salt, info) → wrapping_key (32 byte)
 * 3. AES-256-GCM(wrapping_key, channel_key) → {ciphertext, iv, auth_tag}
 * 
 * Server sadece şifreli blob'u saklar.
 * 
 * @returns { encrypted_channel_key, iv, auth_tag } (hepsi base64)
 */
export async function wrapChannelKeyForUser(
  channelKey: string,
  senderSecretKey: string,
  recipientPublicKey: string,
  channelId: string
): Promise<{
  encrypted_channel_key: string;
  iv: string;
  auth_tag: string;
}> {
  // 1. ECDH shared secret
  const sharedSecret = x25519SharedSecret(senderSecretKey, recipientPublicKey);

  // 2. HKDF ile wrapping key türet
  // Domain separation: channel_id'yi salt'a dahil et (multi-tenant izolasyon)
  const salt = new TextEncoder().encode('sentinel-ckw-v1-' + channelId);
  const wrappingKeyBytes = await hkdfDerive(
    sharedSecret,
    salt,
    'sentinel-channel-key-wrap',
    32
  );

  // 3. AES-256-GCM ile channel key'i şifrele
  const aesKey = await subtle.importKey(
    'raw',
    wrappingKeyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = cryptoAPI.getRandomValues(new Uint8Array(12));
  const channelKeyBytes = decodeBase64(channelKey);

  const ciphertextWithTag = await subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    channelKeyBytes
  );

  // AES-GCM çıktısı: ciphertext + auth_tag (son 16 byte)
  const fullOutput = new Uint8Array(ciphertextWithTag);
  const ciphertext = fullOutput.slice(0, fullOutput.length - 16);
  const authTag = fullOutput.slice(fullOutput.length - 16);

  // Secure zeroing
  wrappingKeyBytes.fill(0);
  sharedSecret.fill(0);

  return {
    encrypted_channel_key: encodeBase64(ciphertext),
    iv: encodeBase64(iv),
    auth_tag: encodeBase64(authTag),
  };
}

/**
 * Şifreli channel key'i çözer.
 * 
 * @returns Plaintext channel key (base64) veya null
 */
export async function unwrapChannelKey(
  encryptedChannelKey: string,
  iv: string,
  authTag: string,
  recipientSecretKey: string,
  senderPublicKey: string,
  channelId: string
): Promise<string | null> {
  try {
    // 1. ECDH shared secret
    const sharedSecret = x25519SharedSecret(recipientSecretKey, senderPublicKey);

    // 2. HKDF ile wrapping key türet
    const salt = new TextEncoder().encode('sentinel-ckw-v1-' + channelId);
    const wrappingKeyBytes = await hkdfDerive(
      sharedSecret,
      salt,
      'sentinel-channel-key-wrap',
      32
    );

    // 3. AES-GCM ile çöz
    const aesKey = await subtle.importKey(
      'raw',
      wrappingKeyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // ciphertext + auth_tag'ı birleştir (Web Crypto API beklentisi)
    const ciphertextBytes = decodeBase64(encryptedChannelKey);
    const authTagBytes = decodeBase64(authTag);
    const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
    combined.set(ciphertextBytes, 0);
    combined.set(authTagBytes, ciphertextBytes.length);

    const ivBytes = decodeBase64(iv);

    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes, tagLength: 128 },
      aesKey,
      combined
    );

    // Secure zeroing
    wrappingKeyBytes.fill(0);
    sharedSecret.fill(0);

    return encodeBase64(new Uint8Array(decrypted));
  } catch {
    return null; // Yanlış key veya bozuk veri
  }
}

// ============================================================
// CHANNEL KEY DAĞITIMI
// ============================================================

/**
 * Channel key'i tüm kanal üyelerine dağıtır.
 * Her üye için ayrı ECDH + AES-GCM wrapped kopya oluşturulur.
 * 
 * @param channelId - Kanal UUID
 * @param channelKey - Plaintext channel key (base64)
 * @param adminDeviceId - Admin'in device ID'si
 * @param workspaceId - Workspace UUID
 * @param memberDeviceIds - Üye device ID'leri
 */
export async function distributeChannelKey(
  channelId: string,
  channelKey: string,
  adminDeviceId: string,
  workspaceId: string,
  memberDeviceIds: string[]
): Promise<ChannelKeyDistributionResult> {
  const result: ChannelKeyDistributionResult = {
    channelId,
    version: 1,
    totalMembers: memberDeviceIds.length,
    successCount: 0,
    failedDeviceIds: [],
  };

  // Admin'in identity key pair'ini al
  const adminKeyPair = await getMyIdentityKeyPair(workspaceId, adminDeviceId);
  if (!adminKeyPair) {
    result.failedDeviceIds = memberDeviceIds;
    return result;
  }

  for (const deviceId of memberDeviceIds) {
    try {
      // Üyenin public key bundle'ını al
      const memberBundle = await fetchUserKeyBundle(deviceId, workspaceId);
      if (!memberBundle) {
        result.failedDeviceIds.push(deviceId);
        continue;
      }

      // Channel key'i bu üye için şifrele
      const wrapped = await wrapChannelKeyForUser(
        channelKey,
        adminKeyPair.secretKey,
        memberBundle.identityPublicKey,
        channelId
      );

      // Supabase'e kaydet
      const { error } = await supabase.from('channel_keys').upsert({
        channel_id: channelId,
        device_id: deviceId,
        workspace_id: workspaceId,
        encrypted_channel_key: wrapped.encrypted_channel_key,
        iv: wrapped.iv,
        auth_tag: wrapped.auth_tag,
        distributor_device_id: adminDeviceId,
        distributor_public_key: adminKeyPair.publicKey,
        key_version: result.version,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'channel_id,device_id',
      });

      if (error) {
        result.failedDeviceIds.push(deviceId);
      } else {
        result.successCount++;
      }
    } catch {
      result.failedDeviceIds.push(deviceId);
    }
  }

  // Admin'in kendi cache'ine de kaydet
  await cacheChannelKey(workspaceId, channelId, {
    channelId,
    symmetricKey: channelKey,
    version: result.version,
    createdAt: Date.now(),
    distributorDeviceId: adminDeviceId,
  });

  return result;
}

// ============================================================
// CHANNEL KEY ALMA VE ÇÖZME
// ============================================================

/**
 * Bir kullanıcı için kanal anahtarını alır ve çözer.
 * Önce local cache'e bakar, yoksa Supabase'den çeker.
 */
export async function getChannelKey(
  channelId: string,
  deviceId: string,
  workspaceId: string
): Promise<string | null> {
  // 1. Local cache'e bak
  const cached = await getCachedChannelKey(workspaceId, channelId);
  if (cached) return cached.symmetricKey;

  // 2. Supabase'den al
  try {
    const { data, error } = await supabase
      .from('channel_keys')
      .select('encrypted_channel_key, iv, auth_tag, distributor_public_key, distributor_device_id, key_version')
      .eq('channel_id', channelId)
      .eq('device_id', deviceId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    // 3. Kendi private key'imizle çöz
    const myKeyPair = await getMyIdentityKeyPair(workspaceId, deviceId);
    if (!myKeyPair) return null;

    const channelKey = await unwrapChannelKey(
      data.encrypted_channel_key,
      data.iv,
      data.auth_tag,
      myKeyPair.secretKey,
      data.distributor_public_key,
      channelId
    );

    if (!channelKey) return null;

    // 4. Cache'e kaydet
    await cacheChannelKey(workspaceId, channelId, {
      channelId,
      symmetricKey: channelKey,
      version: data.key_version,
      createdAt: Date.now(),
      distributorDeviceId: data.distributor_device_id,
    });

    return channelKey;
  } catch {
    return null;
  }
}

// ============================================================
// CHANNEL KEY ROTATION
// ============================================================

/**
 * Channel key'i yeniler (rotation).
 * 
 * Akış:
 * 1. Yeni 32-byte channel key üret
 * 2. Eski key'i geçmişe taşı (grace period)
 * 3. Yeni key'i tüm üyelere dağıt
 * 4. Grace period sonrası eski key silinir
 */
export async function rotateChannelKey(
  channelId: string,
  adminDeviceId: string,
  workspaceId: string,
  memberDeviceIds: string[]
): Promise<ChannelKeyDistributionResult & { newKey: string }> {
  // 1. Eski key'i geçmişe taşı
  const oldCached = await getCachedChannelKey(workspaceId, channelId);
  if (oldCached) {
    await addToKeyHistory(workspaceId, channelId, {
      symmetricKey: oldCached.symmetricKey,
      version: oldCached.version,
      createdAt: oldCached.createdAt,
      expiredAt: Date.now(),
    });
  }

  // 2. Yeni channel key üret
  const newKey = generateChannelSymmetricKey();

  // 3. Tüm üyelere dağıt
  const distribution = await distributeChannelKey(
    channelId,
    newKey,
    adminDeviceId,
    workspaceId,
    memberDeviceIds
  );

  return { ...distribution, newKey };
}

/**
 * Channel key rotasyona ihtiyaç duyup duymadığını kontrol eder.
 */
export async function shouldRotateChannelKey(
  workspaceId: string,
  channelId: string
): Promise<{
  needsRotation: boolean;
  reason: 'none' | 'time_expired' | 'member_removed' | 'compromised';
  keyAge: number;
}> {
  const cached = await getCachedChannelKey(workspaceId, channelId);
  if (!cached) {
    return { needsRotation: false, reason: 'none', keyAge: 0 };
  }

  const age = Date.now() - cached.createdAt;

  if (age > CHANNEL_KEY_ROTATION_INTERVAL_MS) {
    return { needsRotation: true, reason: 'time_expired', keyAge: age };
  }

  return { needsRotation: false, reason: 'none', keyAge: age };
}

// ============================================================
// GRACE PERIOD - ESKİ KEY İLE ÇÖZME
// ============================================================

/**
 * Eski key ile mesaj çözmeyi dener (grace period içinde).
 * Yeni key ile çözülemezse eski key'ler denenir.
 */
export async function tryDecryptWithHistoricalKeys(
  workspaceId: string,
  channelId: string,
  decryptFn: (key: string) => Promise<unknown | null>
): Promise<unknown | null> {
  const history = await getKeyHistory(workspaceId, channelId);
  if (!history || history.keys.length === 0) return null;

  const now = Date.now();

  for (const historicalKey of history.keys) {
    // Grace period kontrolü
    if (now - historicalKey.expiredAt > CHANNEL_KEY_GRACE_PERIOD_MS) {
      continue; // Grace period geçmiş, bu key artık geçersiz
    }

    const result = await decryptFn(historicalKey.symmetricKey);
    if (result !== null) return result;
  }

  return null;
}

// ============================================================
// CACHE YÖNETİMİ (IndexedDB)
// ============================================================

async function cacheChannelKey(
  workspaceId: string,
  channelId: string,
  record: ChannelKeyRecord
): Promise<void> {
  await storeEncryptedData(
    CHANNEL_KEY_CACHE_PREFIX + workspaceId + '_' + channelId,
    record
  );
}

async function getCachedChannelKey(
  workspaceId: string,
  channelId: string
): Promise<ChannelKeyRecord | null> {
  return getEncryptedData<ChannelKeyRecord>(
    CHANNEL_KEY_CACHE_PREFIX + workspaceId + '_' + channelId
  );
}

async function addToKeyHistory(
  workspaceId: string,
  channelId: string,
  entry: ChannelKeyHistory['keys'][0]
): Promise<void> {
  const key = CHANNEL_KEY_HISTORY_PREFIX + workspaceId + '_' + channelId;
  const history = await getEncryptedData<ChannelKeyHistory>(key) || { keys: [] };

  history.keys.push(entry);

  // Maksimum geçmiş boyutunu aşma
  if (history.keys.length > MAX_KEY_HISTORY) {
    history.keys = history.keys.slice(-MAX_KEY_HISTORY);
  }

  await storeEncryptedData(key, history);
}

async function getKeyHistory(
  workspaceId: string,
  channelId: string
): Promise<ChannelKeyHistory | null> {
  return getEncryptedData<ChannelKeyHistory>(
    CHANNEL_KEY_HISTORY_PREFIX + workspaceId + '_' + channelId
  );
}

// ============================================================
// TEMİZLİK
// ============================================================

/**
 * Bir kanalın key cache'ini ve geçmişini temizler.
 */
export async function clearChannelKeyData(
  workspaceId: string,
  channelId: string
): Promise<void> {
  await deleteEncryptedData(CHANNEL_KEY_CACHE_PREFIX + workspaceId + '_' + channelId);
  await deleteEncryptedData(CHANNEL_KEY_HISTORY_PREFIX + workspaceId + '_' + channelId);
}

/**
 * Bir workspace'in tüm channel key verilerini temizler.
 */
export async function clearAllChannelKeyData(workspaceId: string): Promise<void> {
  await deleteEncryptedDataByPrefix(CHANNEL_KEY_CACHE_PREFIX + workspaceId);
  await deleteEncryptedDataByPrefix(CHANNEL_KEY_HISTORY_PREFIX + workspaceId);
}

/**
 * Grace period'u geçmiş eski key'leri temizler (periyodik bakım).
 */
export async function cleanupExpiredKeys(
  workspaceId: string,
  channelId: string
): Promise<number> {
  const key = CHANNEL_KEY_HISTORY_PREFIX + workspaceId + '_' + channelId;
  const history = await getEncryptedData<ChannelKeyHistory>(key);
  if (!history) return 0;

  const now = Date.now();
  const before = history.keys.length;

  history.keys = history.keys.filter(
    k => now - k.expiredAt <= CHANNEL_KEY_GRACE_PERIOD_MS
  );

  const removed = before - history.keys.length;

  if (removed > 0) {
    await storeEncryptedData(key, history);
  }

  return removed;
}
