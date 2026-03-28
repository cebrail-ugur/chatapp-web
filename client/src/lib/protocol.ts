/**
 * ChatApp Ultra - Şifreleme Protokolü Giriş Noktası (protocol.ts)
 * ──────────────────────────────────────────────────────────────────
 * GÜVENLİK SERTLEŞTİRME v3:
 * - CryptoJS KALDIRILDI → Tüm işlemler Web Crypto API
 * - Legacy encrypt/decrypt fonksiyonları KALDIRILDI (v1, v2, fallback)
 * - Debug logları üretim ortamında devre dışı
 * - Anahtar substring logları KALDIRILDI
 * - Session expiration entegre edildi
 * - Zero-Knowledge Channel Key Exchange eklendi
 * - User Key Manager eklendi (identity key lifecycle)
 * - Nonce Manager eklendi (96-bit nonce benzersizlik garantisi)
 * - Fingerprint & Safety Number eklendi (MITM tespiti)
 * - Key Revocation IndexedDB'ye taşındı (localStorage kaldırıldı)
 * 
 * Signal Protocol: X3DH + Double Ratchet + AES-256-GCM
 * 
 * MODÜL YAPISI:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  protocol.ts (Bu dosya - Ana Giriş Noktası)                    │
 * │  ├── secureStore.ts        (IndexedDB güvenli depo)             │
 * │  ├── keyManager.ts         (Anahtar üretimi/saklama)            │
 * │  ├── x3dh.ts               (X3DH handshake)                     │
 * │  ├── ratchet.ts            (Double Ratchet)                      │
 * │  ├── session.ts            (Workspace key, davet kodu)           │
 * │  ├── headerEncryption.ts   (Header encryption)                   │
 * │  ├── metadataGuard.ts      (Metadata koruma, padding)            │
 * │  ├── auditLog.ts           (Zero-knowledge audit log)            │
 * │  ├── keyRevocation.ts      (Anahtar iptal - IndexedDB)           │
 * │  ├── channelGuard.ts       (Kanal erişim kontrolü)               │
 * │  ├── nonceManager.ts       (Nonce benzersizlik - 96-bit)         │
 * │  ├── fingerprint.ts        (Fingerprint & Safety Number)         │
 * │  ├── channelKeyManager.ts  (Channel Key Manager)                 │
 * │  └── userKeyManager.ts     (User Key Lifecycle Manager)          │
 * └─────────────────────────────────────────────────────────────────┘
 */

// ============================================================
// RE-EXPORTS: Tüm modüllerden public API
// ============================================================

// secureStore.ts - IndexedDB güvenli anahtar deposu
export {
  initSecureStore,
  storeCryptoKey,
  getCryptoKey,
  deleteCryptoKey,
  storeEncryptedData,
  getEncryptedData,
  deleteEncryptedData,
  deleteEncryptedDataByPrefix,
  storeMetadata,
  getMetadata,
  deleteMetadata,
  getDeviceId as getDeviceIdAsync,
  clearWorkspaceData,
  clearAllSecureData,
  migrateFromLocalStorage,
} from './secureStore';

// keyManager.ts - Anahtar üretimi, saklama, yardımcılar
export {
  // Sabitler
  KEY_STORAGE_PREFIX,
  KEYPAIR_STORAGE_PREFIX,
  X25519_IDENTITY_PREFIX,
  RATCHET_STATE_PREFIX,
  X3DH_SPK_PREFIX,
  X3DH_OPK_PREFIX,
  X3DH_BUNDLE_PREFIX,
  X3DH_SESSION_PREFIX,
  LEGACY_KEY_PREFIX,
  // Crypto API referansları
  cryptoAPI,
  subtle,
  // Yardımcı fonksiyonlar
  arrayBufferToBase64,
  base64ToArrayBuffer,
  arrayBufferToHex,
  hexToArrayBuffer,
  stringToArrayBuffer,
  arrayBufferToString,
  concatUint8Arrays,
  hkdfDerive,
  // X25519 anahtar yönetimi
  generateX25519IdentityKeyPair,
  generateX25519EphemeralKeyPair,
  storeX25519IdentityKey,
  getX25519IdentityKey,
  x25519SharedSecret,
  // ECDH P-256 (extractable: false)
  generateECDHKeyPair,
  getECDHPublicKey,
  getECDHPrivateKey,
  deriveSharedSecret,
  // SHA-256
  sha256Hash,
  // Cihaz kimliği
  generateDeviceId,
  getOrCreateDeviceIdSync,
  // Workspace key üretimi
  generateWorkspaceKey,
  // Güvenlik yardımcıları
  sanitizeInput,
  unsanitizeForDisplay,
  RateLimiter,
} from './keyManager';

// x3dh.ts - X3DH handshake protokolü
export {
  // Tipler
  type SignedPreKey,
  type OneTimePreKey,
  type PreKeyBundle,
  type X3DHSession,
  // Signed PreKey
  generateSignedPreKey,
  verifySignedPreKey,
  getSigningVerifyKey,
  // One-Time PreKey
  generateOneTimePreKeys,
  // PreKey Bundle
  createPreKeyBundle,
  // X3DH Handshake
  x3dhInitiatorHandshake,
  x3dhResponderHandshake,
  // X3DH → Double Ratchet geçişi
  initRatchetFromX3DH,
  // Tam anahtar seti
  generateFullX3DHKeySet,
  // X3DH depolama (IndexedDB)
  storeSignedPreKey,
  getSignedPreKey,
  storeOneTimePreKeys,
  getOneTimePreKeys,
  consumeOneTimePreKey,
  storePreKeyBundle,
  getPreKeyBundle,
  storeX3DHSession,
  getX3DHSession,
  storeFullX3DHKeySet,
  clearX3DHData,
} from './x3dh';

// ratchet.ts - Double Ratchet mekanizması
export {
  type RatchetState,
  initRatchetState,
  storeRatchetState,
  getRatchetState,
  deleteRatchetState,
  deleteSkippedKeys,
  ratchetEncrypt,
  ratchetDecrypt,
  // Zaman bazlı anahtar rotasyonu
  shouldRotateKeys,
  performKeyRotation,
  getRotationStatus,
} from './ratchet';

// headerEncryption.ts - Header encryption (DH pub key ve mesaj indeksi şifreleme)
export {
  deriveHeaderKey,
  encryptHeader,
  decryptHeader,
  exportHeaderKey,
  importHeaderKey,
} from './headerEncryption';

// metadataGuard.ts - Metadata koruma (padding, şifreli typing/online, timing jitter)
export {
  padMessage,
  unpadMessage,
  padMessageFixed,
  createEncryptedTypingSignal,
  decryptTypingSignal,
  createEncryptedPresenceSignal,
  decryptPresenceSignal,
  getTimingJitter,
  generateDummyPacket,
} from './metadataGuard';

// auditLog.ts - Metadata-only audit log (Zero Knowledge uyumlu)
export {
  logAudit,
  getAuditLogs,
  cleanupAuditLog,
  getAuditStats,
  getAuditActionLabel,
  type AuditEntry,
  type AuditAction,
} from './auditLog';

// keyRevocation.ts - Anahtar iptal mekanizması (IndexedDB - localStorage KALDIRILDI)
export {
  revokeUserKeys,
  isKeyRevoked,
  isKeyRevokedSync,
  subscribeToRevocations,
  regenerateKeysAfterRevocation,
  clearRevocationList,
  getRevocationStats,
  preloadRevocationCache,
  type RevocationEntry,
} from './keyRevocation';

// channelGuard.ts - Kanal erişim kontrolü
export {
  validateWorkspaceMembership,
  validateChannelAccess,
  canSendMessage,
  clearMembershipCache,
  getChannelMembers,
} from './channelGuard';

// nonceManager.ts - Nonce Manager (64-bit random + 32-bit counter)
export {
  generateNonce,
  checkNonceUniqueness,
  generateSafeNonce,
  resetNonceForRekey,
  getNonceManagerStats,
  clearNonceData,
} from './nonceManager';

// fingerprint.ts - Fingerprint & Safety Number (gelişmiş, QR destekli)
export {
  generateFingerprintInfo,
  generateSafetyNumber,
  verifySafetyNumbers,
  generateQRData,
  parseQRData,
  checkKeyChange,
  markContactVerified,
  isContactVerified,
  getVerifiedContacts,
  unverifyContact,
  clearFingerprintData,
  type SafetyNumberResult,
  type FingerprintInfo,
  type KeyChangeStatus,
} from './fingerprint';

// channelKeyManager.ts - Channel Key Manager (rotation, grace period)
export {
  generateChannelSymmetricKey,
  wrapChannelKeyForUser,
  unwrapChannelKey,
  distributeChannelKey,
  getChannelKey,
  rotateChannelKey,
  shouldRotateChannelKey,
  tryDecryptWithHistoricalKeys,
  clearChannelKeyData,
  clearAllChannelKeyData,
  cleanupExpiredKeys,
  type ChannelKeyRecord,
  type ChannelKeyDistributionResult,
} from './channelKeyManager';

// userKeyManager.ts - User Key Lifecycle Manager
export {
  generateUserKeyBundle,
  getMyIdentityKeyPair,
  getMySignedPreKey,
  getMyOneTimePreKeys,
  fetchUserKeyBundle,
  getKeyMeta,
  consumeOneTimePreKey as consumeUserOPK,
  shouldRotateSignedPreKey,
  rotateSignedPreKey,
  deleteAllUserKeys,
  clearAllUserKeysForWorkspace,
  verifyKeyConsistency,
  validateUserKeyBundle,
  generateFingerprint as generateUserFingerprint,
  getShortFingerprint as getUserShortFingerprint,
  type UserKeyBundle,
} from './userKeyManager';

// session.ts - Workspace key, davet kodu, AES-GCM, session expiration
export {
  deriveAESKey,
  aesGcmEncrypt,
  aesGcmDecrypt,
  storeWorkspaceKey,
  getWorkspaceKey,
  deleteWorkspaceKey,
  hasWorkspaceKey,
  encryptKeyForInvite,
  decryptKeyFromInvite,
  // Session expiration
  createSessionMeta,
  touchSession,
  isSessionExpired,
  deleteSessionMeta,
  clearAllSessionMeta,
  checkRekeyNeeded,
  initiateRekey,
  completeRekey,
  isInGraceWindow,
  validateSessionContinuity,
} from './session';

// ============================================================
// ANA ŞİFRELEME / ÇÖZME FONKSİYONLARI
// ============================================================

import { arrayBufferToBase64, cryptoAPI, stringToArrayBuffer } from './keyManager';
import { padMessage, unpadMessage } from './metadataGuard';
import { getRatchetState, initRatchetState, storeRatchetState, ratchetEncrypt, ratchetDecrypt } from './ratchet';
import { getWorkspaceKey, deriveAESKey, aesGcmEncrypt, aesGcmDecrypt, isSessionExpired, createSessionMeta, touchSession } from './session';
import { base64ToArrayBuffer } from './keyManager';
import { deleteRatchetState } from './ratchet';

/**
 * Mesajı şifreler.
 * 
 * v4 (Double Ratchet): Ratchet state varsa kullanılır.
 *   Format: v4:DH_PUB:SEND_COUNT:PREV_CHAIN_LEN:IV:CIPHERTEXT
 * 
 * v3 (AES-256-GCM fallback): Ratchet state yoksa workspace key ile.
 *   Format: v3:SALT:IV:CIPHERTEXT
 * 
 * Session expiration: Süresi dolmuş session'lar yeniden başlatılır.
 */
export async function encrypt(data: unknown, workspaceId: string, channelId?: string): Promise<string> {
  const workspaceKey = await getWorkspaceKey(workspaceId);
  if (!workspaceKey) {
    throw new Error('[E2EE] Workspace anahtarı bulunamadı. Şifreleme yapılamaz.');
  }

  const jsonStr = JSON.stringify(data);

  // Mesaj boyut padding uygula (256-byte bloklar)
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(jsonStr);
  const paddedBytes = padMessage(plainBytes);
  const paddedStr = new TextDecoder().decode(paddedBytes);

  // v4 Double Ratchet
  if (channelId) {
    // Session expiration kontrolü
    const expired = await isSessionExpired(workspaceId, channelId);
    if (expired) {
      // Eski ratchet state'i sil ve yeniden başlat
      await deleteRatchetState(workspaceId, channelId);
    }

    let state = await getRatchetState(workspaceId, channelId);
    if (!state) {
      state = await initRatchetState(workspaceKey);
      await createSessionMeta(workspaceId, channelId);
    }

    const { encrypted, newState } = await ratchetEncrypt(paddedStr, state);
    await storeRatchetState(workspaceId, channelId, newState);
    await touchSession(workspaceId, channelId);

    return encrypted;
  }

  // v3 fallback (workspace-level encryption)
  const salt = cryptoAPI.getRandomValues(new Uint8Array(16));
  const aesKey = await deriveAESKey(workspaceKey, salt.buffer);
  const { ciphertext, iv } = await aesGcmEncrypt(paddedStr, aesKey);
  return `v3:${arrayBufferToBase64(salt.buffer)}:${iv}:${ciphertext}`;
}

/**
 * Şifreli mesajı çözer. v4 ve v3 formatlarını destekler.
 * CryptoJS legacy formatları (v1, v2) artık desteklenmiyor.
 */
export async function decrypt(ciphertext: string, workspaceId: string, channelId?: string): Promise<unknown> {
  try {
    if (!ciphertext || typeof ciphertext !== 'string') return null;

    // v4 formatı (Double Ratchet)
    if (ciphertext.startsWith('v4:') && channelId) {
      return decryptV4Ratchet(ciphertext, workspaceId, channelId);
    }

    if (ciphertext.startsWith('v4:') && !channelId) {
      return null;
    }

    // v3 formatı (Web Crypto API + AES-GCM)
    if (ciphertext.startsWith('v3:')) {
      return decryptV3(ciphertext, workspaceId);
    }

    // v2 ve v1 formatları artık desteklenmiyor (CryptoJS kaldırıldı)
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// DAHİLİ ÇÖZME FONKSİYONLARI
// ============================================================

async function decryptV4Ratchet(ciphertext: string, workspaceId: string, channelId: string): Promise<unknown> {
  try {
    const workspaceKey = await getWorkspaceKey(workspaceId);
    if (!workspaceKey) return null;

    const state = await getRatchetState(workspaceId, channelId);
    if (!state) return null; // State yoksa yeni oluşturma — ratchet senkronizasyonu bozulur

    const result = await ratchetDecrypt(ciphertext, state, workspaceId, channelId);
    if (!result) {
      return null;
    }

    await storeRatchetState(workspaceId, channelId, result.newState);
    await touchSession(workspaceId, channelId);

    // Padding'i kaldır
    const paddedBytes = new Uint8Array(new TextEncoder().encode(result.decrypted));
    const unpadded = unpadMessage(paddedBytes);
    const originalStr = new TextDecoder().decode(unpadded);
    return JSON.parse(originalStr);
  } catch {
    // Padding olmayan eski mesajları da destekle (geriye uyumluluk)
    try {
      const workspaceKey = await getWorkspaceKey(workspaceId);
      if (!workspaceKey) return null;
      const state = await getRatchetState(workspaceId, channelId);
      if (!state) return null; // Fallback'te de yeni state oluşturma — senkronizasyon bozulur
      const result = await ratchetDecrypt(ciphertext, state, workspaceId, channelId);
      if (!result) return null;
      await storeRatchetState(workspaceId, channelId, result.newState);
      return JSON.parse(result.decrypted);
    } catch {
      return null;
    }
  }
}

async function decryptV3(ciphertext: string, workspaceId: string): Promise<unknown> {
  const parts = ciphertext.split(':');
  if (parts.length !== 4) return null;

  const [, saltBase64, ivBase64, encryptedBase64] = parts;

  const workspaceKey = await getWorkspaceKey(workspaceId);
  if (!workspaceKey) return null;

  const salt = base64ToArrayBuffer(saltBase64);
  const aesKey = await deriveAESKey(workspaceKey, salt);
  const decrypted = await aesGcmDecrypt(encryptedBase64, ivBase64, aesKey);

  // Padding'i kaldır (geriye uyumluluk: padding olmayan eski mesajlar da desteklenir)
  try {
    const paddedBytes = new TextEncoder().encode(decrypted);
    const unpadded = unpadMessage(paddedBytes);
    const originalStr = new TextDecoder().decode(unpadded);
    return JSON.parse(originalStr);
  } catch {
    // Padding yoksa direkt parse et
    return JSON.parse(decrypted);
  }
}
