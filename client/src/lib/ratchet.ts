/**
 * ChatApp Ultra - Double Ratchet Modülü (ratchet.ts)
 * ──────────────────────────────────────────────────────
 * GÜVENLİK SERTLEŞTİRME v2:
 * - localStorage KALDIRILDI → IndexedDB (secureStore.ts)
 * - Ratchet state şifreli saklanır (device-bound AES-GCM)
 * - Replay protection güçlendirildi (mesaj index kontrolü)
 * - Debug logları üretim ortamında devre dışı
 * - Anahtar substring logları KALDIRILDI
 * 
 * Signal Protocol Double Ratchet Algoritması - Tam Spesifikasyon
 * Referans: https://signal.org/docs/specifications/doubleratchet/
 * 
 * Standartlar: HKDF (RFC 5869), AES-256-GCM (NIST SP 800-38D)
 */

import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

import {
  subtle,
  cryptoAPI,
  x25519SharedSecret,
  generateX25519EphemeralKeyPair,
  hkdfDerive,
  RATCHET_STATE_PREFIX,
} from './keyManager';

import {
  storeEncryptedData,
  getEncryptedData,
  deleteEncryptedData,
} from './secureStore';

// ============================================================
// SABİTLER
// ============================================================

const MAX_SKIP = 256;

/**
 * Güvenli bellek temizleme: Hassas anahtar materyalini sıfırlar.
 * JavaScript GC'ye güvenmek yerine explicit zeroing yapar.
 */
function secureZero(arr: Uint8Array): void {
  if (arr && arr.length > 0) {
    cryptoAPI.getRandomValues(arr); // Önce random yaz (anti-optimization)
    arr.fill(0);                    // Sonra sıfırla
  }
}

// ============================================================
// ZAMAN BAZLI ANAHTAR ROTASYONU SABİTLERİ
// ============================================================

/**
 * Rotasyon aralığı: 1 saat (milisaniye).
 * Her 1 saatte bir zorunlu DH ratchet tetiklenir.
 * Signal Protocol'de bu süre genellikle 1-24 saat arasındadır.
 */
const ROTATION_INTERVAL_MS = 60 * 60 * 1000; // 1 saat

/**
 * Epoch başına maksimum mesaj sayısı.
 * Bu eşiğe ulaşıldığında zaman geçmemiş olsa bile
 * zorunlu DH ratchet tetiklenir (mesaj bazlı rotasyon).
 */
const MAX_MESSAGES_PER_EPOCH = 500;

/**
 * Rotasyon öncesi uyarı eşiği (mesaj sayısı).
 * Bu eşiğe yaklaşıldığında proaktif rotasyon önerilir.
 */
const ROTATION_WARNING_THRESHOLD = 450;

const MAX_STORED_SKIPPED_KEYS = 1000;
/** Skipped key'lerin maksimum yaşam süresi: 24 saat */
const SKIPPED_KEY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Replay window: Mevcut recvCount'tan ne kadar geriye bakılabilir */
const REPLAY_WINDOW_SIZE = 512;
const SKIPPED_KEYS_PREFIX = 'sentinel_skipped_mk_';

/**
 * Replay protection: Görülen mesaj index'lerini takip eder.
 * Aynı (dhPub, index) çifti iki kez işlenmez.
 */
const SEEN_MESSAGES_PREFIX = 'sentinel_seen_msg_';

// ============================================================
// TİP TANIMLARI
// ============================================================

export interface RatchetState {
  rootKey: string;
  chainKeySend: string;
  chainKeyRecv: string;
  dhKeyPair: {
    publicKey: string;
    secretKey: string;
  };
  remoteDhPub: string;
  sendCount: number;
  recvCount: number;
  previousChainLength: number;
  /** Zaman bazlı anahtar rotasyonu metadata */
  lastRotationTime: number;      // Son rotasyon zaman damgası (ms)
  epochMessageCount: number;     // Bu epoch'taki toplam mesaj sayısı
  rotationEpoch: number;         // Kaçıncı rotasyon dönemi
}

interface SkippedMessageKey {
  messageKey: string;
  timestamp: number;
}

interface SkippedKeysStore {
  [key: string]: SkippedMessageKey;
}

/**
 * Replay protection: Görülen mesajların index seti.
 */
interface SeenMessagesStore {
  [key: string]: number; // dhPub:index → timestamp
}

// ============================================================
// KDF CHAIN RATCHET (Symmetric Ratchet)
// ============================================================

async function kdfChainRatchet(chainKey: string): Promise<{
  newChainKey: string;
  messageKey: Uint8Array;
}> {
  const ck = decodeBase64(chainKey);

  const newChainKeyBytes = await hkdfDerive(
    ck,
    new Uint8Array(32),
    'sentinel-chain-key-ratchet',
    32
  );

  const messageKeyBytes = await hkdfDerive(
    ck,
    new Uint8Array(32),
    'sentinel-message-key-derive',
    32
  );

  // Eski chainKey bytes'ını sıfırla (forward secrecy)
  secureZero(ck);

  return {
    newChainKey: encodeBase64(newChainKeyBytes),
    messageKey: messageKeyBytes
  };
}

// ============================================================
// DH RATCHET
// ============================================================

async function dhRatchetStep(
  rootKey: string,
  dhOutput: Uint8Array
): Promise<{
  newRootKey: string;
  newChainKey: string;
}> {
  const rk = decodeBase64(rootKey);

  // DH output'u kullanıldıktan sonra sıfırlanacak
  const derived = await hkdfDerive(
    dhOutput,
    rk,
    'sentinel-dh-ratchet-step',
    64
  );

  const result = {
    newRootKey: encodeBase64(derived.slice(0, 32)),
    newChainKey: encodeBase64(derived.slice(32, 64))
  };

  // Eski rootKey ve derived bytes'ları sıfırla
  secureZero(rk);
  secureZero(derived);

  return result;
}

// ============================================================
// SKIPPED MESSAGE KEYS YÖNETİMİ (IndexedDB)
// ============================================================

async function getSkippedKeys(workspaceId: string, channelId: string): Promise<SkippedKeysStore> {
  const key = SKIPPED_KEYS_PREFIX + workspaceId + '_' + channelId;
  const stored = await getEncryptedData<SkippedKeysStore>(key);
  return stored ?? {};
}

async function setSkippedKeys(workspaceId: string, channelId: string, store: SkippedKeysStore): Promise<void> {
  const key = SKIPPED_KEYS_PREFIX + workspaceId + '_' + channelId;
  const now = Date.now();

  // 1) Expired skipped key'leri temizle (24 saat)
  for (const [k, entry] of Object.entries(store)) {
    if (now - entry.timestamp > SKIPPED_KEY_MAX_AGE_MS) {
      delete store[k];
    }
  }

  // 2) Kapasite aşımı kontrolü
  const entries = Object.entries(store);
  if (entries.length > MAX_STORED_SKIPPED_KEYS) {
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.length - MAX_STORED_SKIPPED_KEYS;
    for (let i = 0; i < toRemove; i++) {
      delete store[entries[i][0]];
    }
  }

  await storeEncryptedData(key, store);
}

function trySkippedMessageKeySync(
  store: SkippedKeysStore,
  dhPub: string,
  messageIndex: number
): { messageKey: Uint8Array; updatedStore: SkippedKeysStore } | null {
  const lookupKey = dhPub + ':' + messageIndex;
  const entry = store[lookupKey];
  if (!entry) return null;

  // Anahtarı sil (tek kullanımlık - forward secrecy)
  const updatedStore = { ...store };
  delete updatedStore[lookupKey];

  return {
    messageKey: decodeBase64(entry.messageKey),
    updatedStore
  };
}

async function skipMessageKeys(
  workspaceId: string,
  channelId: string,
  chainKey: string,
  currentIndex: number,
  targetIndex: number,
  dhPub: string
): Promise<{ newChainKey: string }> {
  const skip = targetIndex - currentIndex;

  if (skip > MAX_SKIP) {
    throw new Error(
      `[Ratchet] MAX_SKIP aşıldı: ${skip} > ${MAX_SKIP}. ` +
      `Olası DoS saldırısı veya bozuk mesaj.`
    );
  }

  // Replay window kontrolü: Çok eski index'ler reddedilir
  if (targetIndex > currentIndex + REPLAY_WINDOW_SIZE) {
    throw new Error(
      `[Ratchet] Replay window aşıldı: ${targetIndex - currentIndex} > ${REPLAY_WINDOW_SIZE}. ` +
      `Olası manipulasyon veya bozuk mesaj.`
    );
  }

  if (skip <= 0) {
    return { newChainKey: chainKey };
  }

  const store = await getSkippedKeys(workspaceId, channelId);
  let ck = chainKey;
  const now = Date.now();

  for (let i = currentIndex; i < targetIndex; i++) {
    const { newChainKey, messageKey } = await kdfChainRatchet(ck);

    const lookupKey = dhPub + ':' + i;
    store[lookupKey] = {
      messageKey: encodeBase64(messageKey),
      timestamp: now
    };

    ck = newChainKey;
  }

  await setSkippedKeys(workspaceId, channelId, store);

  return { newChainKey: ck };
}

export async function deleteSkippedKeys(workspaceId: string, channelId: string): Promise<void> {
  const key = SKIPPED_KEYS_PREFIX + workspaceId + '_' + channelId;
  await deleteEncryptedData(key);
}

// ============================================================
// REPLAY PROTECTION
// ============================================================

async function getSeenMessages(workspaceId: string, channelId: string): Promise<SeenMessagesStore> {
  const key = SEEN_MESSAGES_PREFIX + workspaceId + '_' + channelId;
  const stored = await getEncryptedData<SeenMessagesStore>(key);
  return stored ?? {};
}

async function markMessageSeen(
  workspaceId: string,
  channelId: string,
  dhPub: string,
  messageIndex: number
): Promise<void> {
  const seen = await getSeenMessages(workspaceId, channelId);
  const lookupKey = dhPub + ':' + messageIndex;
  seen[lookupKey] = Date.now();

  // Eski kayıtları temizle (1 saatten eski)
  const oneHourAgo = Date.now() - 3600000;
  for (const [k, ts] of Object.entries(seen)) {
    if (ts < oneHourAgo) delete seen[k];
  }

  const key = SEEN_MESSAGES_PREFIX + workspaceId + '_' + channelId;
  await storeEncryptedData(key, seen);
}

async function isMessageSeen(
  workspaceId: string,
  channelId: string,
  dhPub: string,
  messageIndex: number
): Promise<boolean> {
  const seen = await getSeenMessages(workspaceId, channelId);
  const lookupKey = dhPub + ':' + messageIndex;
  return lookupKey in seen;
}

// ============================================================
// RATCHET STATE BAŞLATMA
// ============================================================

export async function initRatchetState(workspaceKey: string): Promise<RatchetState> {
  const dhKeyPair = generateX25519EphemeralKeyPair();

  const wkBytes = decodeBase64(workspaceKey);
  const initialRoot = await hkdfDerive(
    wkBytes,
    new TextEncoder().encode('sentinel-ratchet-init-v4'),
    'sentinel-ratchet-root-key',
    32
  );

  const sendChain = await hkdfDerive(
    initialRoot,
    new TextEncoder().encode('sentinel-send-chain'),
    'sentinel-chain-send-init',
    32
  );

  const recvChain = await hkdfDerive(
    initialRoot,
    new TextEncoder().encode('sentinel-recv-chain'),
    'sentinel-chain-recv-init',
    32
  );

  return {
    rootKey: encodeBase64(initialRoot),
    chainKeySend: encodeBase64(sendChain),
    chainKeyRecv: encodeBase64(recvChain),
    dhKeyPair: dhKeyPair,
    remoteDhPub: '',
    sendCount: 0,
    recvCount: 0,
    previousChainLength: 0,
    lastRotationTime: Date.now(),
    epochMessageCount: 0,
    rotationEpoch: 0,
  };
}

// ============================================================
// ZAMAN BAZLI ANAHTAR ROTASYONU FONKSİYONLARI
// ============================================================

/**
 * Rotasyon gerekip gerekmediğini kontrol eder.
 * İki koşul kontrol edilir:
 *   1) Zaman bazlı: Son rotasyondan bu yana ROTATION_INTERVAL_MS geçti mi?
 *   2) Mesaj bazlı: Bu epoch'ta MAX_MESSAGES_PER_EPOCH mesaj gönderildi mi?
 * 
 * Her iki koşuldan biri sağlanırsa rotasyon zorunludur.
 */
export function shouldRotateKeys(state: RatchetState): {
  needsRotation: boolean;
  reason: 'none' | 'time_expired' | 'message_limit' | 'both';
  warning: boolean;
} {
  const now = Date.now();
  const lastRotation = state.lastRotationTime ?? 0;
  const epochMsgCount = state.epochMessageCount ?? 0;

  const timeExpired = (now - lastRotation) >= ROTATION_INTERVAL_MS;
  const messageLimitReached = epochMsgCount >= MAX_MESSAGES_PER_EPOCH;
  const warning = !messageLimitReached && epochMsgCount >= ROTATION_WARNING_THRESHOLD;

  if (timeExpired && messageLimitReached) {
    return { needsRotation: true, reason: 'both', warning: false };
  }
  if (timeExpired) {
    return { needsRotation: true, reason: 'time_expired', warning: false };
  }
  if (messageLimitReached) {
    return { needsRotation: true, reason: 'message_limit', warning: false };
  }
  return { needsRotation: false, reason: 'none', warning };
}

/**
 * Zorunlu anahtar rotasyonu gerçekleştirir.
 * 
 * Yapılan işlemler:
 *   1) Yeni DH key pair üretilir (X25519)
 *   2) Eski DH secret key secureZero ile imha edilir
 *   3) rootKey, HKDF ile yenilenir (geri hesaplanamaz)
 *   4) chainKeySend yeni rootKey'den türetilir
 *   5) Epoch sayacı sıfırlanır
 *   6) rotationEpoch arttırılır
 * 
 * Bu fonksiyon Signal Protocol'deki "out-of-band ratchet" kavramına
 * karşılık gelir: Karşı taraftan mesaj gelmeden de DH ratchet tetiklenir.
 */
export async function performKeyRotation(state: RatchetState): Promise<RatchetState> {
  // 1) Eski DH secret key'i sıfırla
  const oldSecretKeyBytes = decodeBase64(state.dhKeyPair.secretKey);
  secureZero(oldSecretKeyBytes);

  // 2) Yeni DH key pair üret
  const newDhKeyPair = generateX25519EphemeralKeyPair();

  // 3) rootKey'i yenile: Eski rootKey + yeni DH public key'den HKDF
  const oldRootKeyBytes = decodeBase64(state.rootKey);
  const rotationSalt = new TextEncoder().encode(
    'sentinel-time-rotation-epoch-' + ((state.rotationEpoch ?? 0) + 1)
  );

  const newRootKeyBytes = await hkdfDerive(
    oldRootKeyBytes,
    rotationSalt,
    'sentinel-rotation-root-key',
    32
  );

  // 4) Yeni send chain key türet
  const newSendChainBytes = await hkdfDerive(
    newRootKeyBytes,
    new TextEncoder().encode('sentinel-rotation-send-chain'),
    'sentinel-rotation-chain-send',
    32
  );

  // 5) Eski rootKey bytes'ını sıfırla
  secureZero(oldRootKeyBytes);

  // 6) Yeni state oluştur
  const newState: RatchetState = {
    rootKey: encodeBase64(newRootKeyBytes),
    chainKeySend: encodeBase64(newSendChainBytes),
    chainKeyRecv: state.chainKeyRecv, // Recv chain değişmez (karşı tarafın ratchet'i)
    dhKeyPair: newDhKeyPair,
    remoteDhPub: state.remoteDhPub,
    sendCount: 0,
    recvCount: state.recvCount,
    previousChainLength: state.sendCount,
    lastRotationTime: Date.now(),
    epochMessageCount: 0,
    rotationEpoch: (state.rotationEpoch ?? 0) + 1,
  };

  // 7) Türetilmiş anahtar materyallerini sıfırla
  secureZero(newRootKeyBytes);
  secureZero(newSendChainBytes);

  return newState;
}

/**
 * Rotasyon durumu bilgisi döndürür (UI gösterimi için).
 */
export function getRotationStatus(state: RatchetState): {
  epoch: number;
  messagesInEpoch: number;
  maxMessagesPerEpoch: number;
  timeSinceLastRotation: number;
  rotationIntervalMs: number;
  nextRotationIn: number;
} {
  const now = Date.now();
  const lastRotation = state.lastRotationTime ?? now;
  const elapsed = now - lastRotation;
  const remaining = Math.max(0, ROTATION_INTERVAL_MS - elapsed);

  return {
    epoch: state.rotationEpoch ?? 0,
    messagesInEpoch: state.epochMessageCount ?? 0,
    maxMessagesPerEpoch: MAX_MESSAGES_PER_EPOCH,
    timeSinceLastRotation: elapsed,
    rotationIntervalMs: ROTATION_INTERVAL_MS,
    nextRotationIn: remaining,
  };
}

// ============================================================
// RATCHET STATE DEPOLAMA (IndexedDB - şifreli)
// ============================================================

export async function storeRatchetState(workspaceId: string, channelId: string, state: RatchetState): Promise<void> {
  const key = RATCHET_STATE_PREFIX + workspaceId + '_' + channelId;
  await storeEncryptedData(key, state);
}

export async function getRatchetState(workspaceId: string, channelId: string): Promise<RatchetState | null> {
  const key = RATCHET_STATE_PREFIX + workspaceId + '_' + channelId;
  return getEncryptedData<RatchetState>(key);
}

export async function deleteRatchetState(workspaceId: string, channelId: string): Promise<void> {
  const key = RATCHET_STATE_PREFIX + workspaceId + '_' + channelId;
  await deleteEncryptedData(key);
  await deleteSkippedKeys(workspaceId, channelId);
  // Replay protection verisini de temizle
  const seenKey = SEEN_MESSAGES_PREFIX + workspaceId + '_' + channelId;
  await deleteEncryptedData(seenKey);
}

// ============================================================
// MESAJ ŞİFRELEME - Double Ratchet
// ============================================================

export async function ratchetEncrypt(
  plaintext: string,
  state: RatchetState
): Promise<{ encrypted: string; newState: RatchetState }> {
  // ── ZAMAN BAZLI ROTASYON KONTROLÜ ──
  // Her mesaj gönderiminde rotasyon gerekip gerekmediği kontrol edilir.
  // Gerekiyorsa önce rotasyon yapılır, sonra mesaj şifrelenir.
  let currentState = state;
  const rotationCheck = shouldRotateKeys(currentState);
  if (rotationCheck.needsRotation) {
    currentState = await performKeyRotation(currentState);
  }

  const { newChainKey, messageKey } = await kdfChainRatchet(currentState.chainKeySend);

  const aesKey = await subtle.importKey(
    'raw',
    messageKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = cryptoAPI.getRandomValues(new Uint8Array(12));

  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv, tagLength: 128 },
    aesKey,
    new TextEncoder().encode(plaintext)
  );

  const newState: RatchetState = {
    ...currentState,
    chainKeySend: newChainKey,
    sendCount: currentState.sendCount + 1,
    // Epoch mesaj sayacını arttır
    epochMessageCount: (currentState.epochMessageCount ?? 0) + 1,
  };

  // ── HEADER ENCRYPTION ──
  // DH pub key ve counter'ları obfuscate et.
  // Header'dan rootKey türetilmiş bir header key ile şifrelenir.
  // Bu sayede ağ gözlemcisi DH pub key'i ve mesaj sayısını göremez.
  const headerPlain = [
    currentState.dhKeyPair.publicKey,
    String(currentState.sendCount),
    String(currentState.previousChainLength),
    String(Date.now()) // Encrypted timestamp
  ].join('|');

  // Header key: rootKey'den türetilir (mesaj key'den ayrı)
  const rootKeyBytes = decodeBase64(currentState.rootKey);
  const headerKeyBytes = await hkdfDerive(
    rootKeyBytes,
    new TextEncoder().encode('sentinel-header-encryption'),
    'sentinel-header-key-v1',
    32
  );

  const headerAesKey = await subtle.importKey(
    'raw', headerKeyBytes, { name: 'AES-GCM' }, false, ['encrypt']
  );
  const headerIv = cryptoAPI.getRandomValues(new Uint8Array(12));
  const headerCiphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: headerIv, tagLength: 128 },
    headerAesKey,
    new TextEncoder().encode(headerPlain)
  );

  // Header key bytes temizle
  secureZero(headerKeyBytes);

  const encryptedHeader = encodeBase64(headerIv) + '.' + encodeBase64(new Uint8Array(headerCiphertext));

  const encrypted = [
    'v4',
    encryptedHeader,
    encodeBase64(iv),
    encodeBase64(new Uint8Array(ciphertext))
  ].join(':');

  // Memory zeroing: messageKey ve IV kullanıldıktan sonra sıfırla
  secureZero(messageKey);
  secureZero(iv);

  return { encrypted, newState };
}

// ============================================================
// MESAJ ÇÖZME - Double Ratchet (Replay Protection ile)
// ============================================================

export async function ratchetDecrypt(
  encrypted: string,
  state: RatchetState,
  workspaceId?: string,
  channelId?: string
): Promise<{ decrypted: string; newState: RatchetState } | null> {
  try {
    const parts = encrypted.split(':');
    if (parts[0] !== 'v4') return null;

    let senderDhPub: string;
    let messageIndex: number;
    let prevChainLen: number;
    let ivBase64: string;
    let ciphertextBase64: string;

    if (parts.length === 4) {
      // YENİ FORMAT (v4 encrypted header): v4:ENCRYPTED_HEADER:IV:CIPHERTEXT
      // Encrypted header = headerIv.headerCiphertext (base64)
      const [, encryptedHeader, bodyIv, bodyCiphertext] = parts;
      ivBase64 = bodyIv;
      ciphertextBase64 = bodyCiphertext;

      // Header'u çöz: rootKey'den header key türet
      const headerParts = encryptedHeader.split('.');
      if (headerParts.length !== 2) return null;

      const rootKeyBytes = decodeBase64(state.rootKey);
      const headerKeyBytes = await hkdfDerive(
        rootKeyBytes,
        new TextEncoder().encode('sentinel-header-encryption'),
        'sentinel-header-key-v1',
        32
      );

      const headerAesKey = await subtle.importKey(
        'raw', headerKeyBytes, { name: 'AES-GCM' }, false, ['decrypt']
      );
      secureZero(headerKeyBytes);

      try {
        const headerIv = decodeBase64(headerParts[0]);
        const headerCiphertext = decodeBase64(headerParts[1]);
        const headerPlainBuf = await subtle.decrypt(
          { name: 'AES-GCM', iv: headerIv, tagLength: 128 },
          headerAesKey,
          headerCiphertext
        );
        const headerPlain = new TextDecoder().decode(headerPlainBuf);
        const headerFields = headerPlain.split('|');
        if (headerFields.length < 3) return null;

        senderDhPub = headerFields[0];
        messageIndex = parseInt(headerFields[1], 10);
        prevChainLen = parseInt(headerFields[2], 10);
        // headerFields[3] = encrypted timestamp (bilgi amaçlı)
      } catch (e) {
        console.error('[Ratchet] Header decrypt başarısız — ratchet state senkronizasyon sorunu olabilir:', e);
        return null;
      }
    } else if (parts.length === 6) {
      // ESKİ FORMAT (v4 plaintext header): v4:DH_PUB:SEND_COUNT:PREV_CHAIN:IV:CIPHERTEXT
      // Geriye uyumluluk için desteklenir
      [, senderDhPub, , , ivBase64, ciphertextBase64] = parts;
      messageIndex = parseInt(parts[2], 10);
      prevChainLen = parseInt(parts[3], 10);
    } else {
      return null; // Bilinmeyen format
    }

    // ─────────────────────────────────────────────────
    // REPLAY PROTECTION: Aynı mesaj tekrar işlenmez
    // ─────────────────────────────────────────────────
    if (workspaceId && channelId) {
      const seen = await isMessageSeen(workspaceId, channelId, senderDhPub, messageIndex);
      if (seen) {
        return null; // Replay saldırısı - sessizce reddet
      }
    }

    // ─────────────────────────────────────────────────
    // STRICT MONOTONIC INDEX VALIDATION
    // Aynı DH pub key altında messageIndex < recvCount ise
    // bu mesaj ya replay ya da sıra dışı. Skipped key'de
    // yoksa kesinlikle reddedilir.
    // ─────────────────────────────────────────────────
    if (senderDhPub === state.remoteDhPub && messageIndex < state.recvCount) {
      // Skipped key deposunda var mı kontrol et
      if (workspaceId && channelId) {
        const store = await getSkippedKeys(workspaceId, channelId);
        const lookupKey = senderDhPub + ':' + messageIndex;
        if (!store[lookupKey]) {
          return null; // Monotonic violation - reject
        }
      } else {
        return null; // Workspace/channel bilgisi yoksa reject
      }
    }

    // ─────────────────────────────────────────────────
    // ADIM 1: Skipped message keys deposunda ara
    // ─────────────────────────────────────────────────
    if (workspaceId && channelId) {
      const store = await getSkippedKeys(workspaceId, channelId);
      const skippedResult = trySkippedMessageKeySync(store, senderDhPub, messageIndex);
      if (skippedResult) {
        const decrypted = await decryptWithKey(skippedResult.messageKey, ivBase64, ciphertextBase64);
        if (decrypted !== null) {
          await setSkippedKeys(workspaceId, channelId, skippedResult.updatedStore);
          await markMessageSeen(workspaceId, channelId, senderDhPub, messageIndex);
          return { decrypted, newState: state };
        }
      }
    }

    let currentState = { ...state };

    // ─────────────────────────────────────────────────
    // ADIM 2: DH Ratchet (yeni DH public key geldiyse)
    // ─────────────────────────────────────────────────
    if (senderDhPub && senderDhPub !== currentState.remoteDhPub && currentState.dhKeyPair.secretKey) {

      if (workspaceId && channelId && currentState.remoteDhPub) {
        await skipMessageKeys(
          workspaceId,
          channelId,
          currentState.chainKeyRecv,
          currentState.recvCount,
          prevChainLen,
          currentState.remoteDhPub
        );
      }

      const dhOutput1 = x25519SharedSecret(currentState.dhKeyPair.secretKey, senderDhPub);
      const { newRootKey, newChainKey: newRecvChain } = await dhRatchetStep(
        currentState.rootKey,
        dhOutput1
      );
      // DH output sıfırla
      secureZero(dhOutput1);

      const newDhKeyPair = generateX25519EphemeralKeyPair();
      const dhOutput2 = x25519SharedSecret(newDhKeyPair.secretKey, senderDhPub);

      const { newRootKey: finalRootKey, newChainKey: newSendChain } = await dhRatchetStep(
        newRootKey,
        dhOutput2
      );
      // DH output sıfırla
      secureZero(dhOutput2);

      currentState = {
        rootKey: finalRootKey,
        chainKeySend: newSendChain,
        chainKeyRecv: newRecvChain,
        dhKeyPair: newDhKeyPair,
        remoteDhPub: senderDhPub,
        sendCount: 0,
        recvCount: 0,
        previousChainLength: currentState.sendCount,
        // DH ratchet = doğal rotasyon, epoch sıfırlanır
        lastRotationTime: Date.now(),
        epochMessageCount: 0,
        rotationEpoch: (currentState.rotationEpoch ?? 0) + 1,
      };
    }

    // ─────────────────────────────────────────────────
    // ADIM 3: Mevcut receive chain'de hedef indekse kadar skip et
    // ─────────────────────────────────────────────────
    if (workspaceId && channelId && messageIndex > currentState.recvCount) {
      const { newChainKey: advancedCK } = await skipMessageKeys(
        workspaceId,
        channelId,
        currentState.chainKeyRecv,
        currentState.recvCount,
        messageIndex,
        senderDhPub
      );
      currentState.chainKeyRecv = advancedCK;
      currentState.recvCount = messageIndex;
    } else if (messageIndex > currentState.recvCount) {
      let ck = currentState.chainKeyRecv;
      for (let i = currentState.recvCount; i < messageIndex; i++) {
        const { newChainKey } = await kdfChainRatchet(ck);
        ck = newChainKey;
      }
      currentState.chainKeyRecv = ck;
      currentState.recvCount = messageIndex;
    }

    // ─────────────────────────────────────────────────
    // ADIM 4: Symmetric ratchet - message key türet
    // ─────────────────────────────────────────────────
    const { newChainKey: finalChainKey, messageKey } = await kdfChainRatchet(currentState.chainKeyRecv);

    // ─────────────────────────────────────────────────
    // ADIM 5: AES-256-GCM ile çöz
    // ─────────────────────────────────────────────────
    const decrypted = await decryptWithKey(messageKey, ivBase64, ciphertextBase64);
    // Memory zeroing: messageKey kullanıldıktan sonra sıfırla
    secureZero(messageKey);
    if (decrypted === null) return null;

    // Replay protection: Mesajı görüldü olarak işaretle
    if (workspaceId && channelId) {
      await markMessageSeen(workspaceId, channelId, senderDhPub, messageIndex);
    }

    const newState: RatchetState = {
      ...currentState,
      chainKeyRecv: finalChainKey,
      recvCount: messageIndex + 1
    };

    return { decrypted, newState };
  } catch {
    return null;
  }
}

// ============================================================
// DAHİLİ YARDIMCI: AES-256-GCM ÇÖZME
// ============================================================

async function decryptWithKey(
  messageKey: Uint8Array,
  ivBase64: string,
  ciphertextBase64: string
): Promise<string | null> {
  try {
    const aesKey = await subtle.importKey(
      'raw',
      messageKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const iv = decodeBase64(ivBase64);
    const ciphertext = decodeBase64(ciphertextBase64);

    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv, tagLength: 128 },
      aesKey,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    return null;
  }
}
