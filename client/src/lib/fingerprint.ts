/**
 * ChatApp Ultra - Fingerprint & Safety Number (fingerprint.ts)
 * ─────────────────────────────────────────────────────────────
 * Signal Protocol Safety Number implementasyonu.
 * 
 * SAFETY NUMBER:
 * - İki kullanıcı arasındaki şifreleme oturumunun bütünlüğünü doğrular
 * - MITM saldırısı tespiti için kullanılır
 * - 60 haneli, 12x5 gruplu insan okunabilir format
 * - QR kod formatı desteği
 * 
 * FINGERPRINT:
 * - identity_public_key → SHA-256 → hex string
 * - Kısa format: 16 hex karakter (4x4 gruplu)
 * - Tam format: 64 hex karakter (16x4 gruplu)
 * 
 * MITM TESPİT MEKANİZMASI:
 * - Key consistency check: Bilinen fingerprint ile karşılaştırma
 * - Key change alert: Fingerprint değişikliği uyarısı
 * - Trust-on-first-use (TOFU): İlk görülen key güvenilir kabul edilir
 * - Verified contacts: Manuel doğrulanmış kişiler listesi
 * 
 * Standartlar: Signal Protocol Safety Number (Section 4), SHA-256 (FIPS 180-4)
 */

import { decodeBase64 } from 'tweetnacl-util';
import {
  subtle,
  arrayBufferToHex,
  stringToArrayBuffer,
} from './keyManager';
import {
  storeEncryptedData,
  getEncryptedData,
  deleteEncryptedDataByPrefix,
} from './secureStore';

// ============================================================
// SABİTLER
// ============================================================

const KNOWN_FINGERPRINTS_PREFIX = 'sentinel_known_fp_';
const VERIFIED_CONTACTS_PREFIX = 'sentinel_verified_';

/** Safety number versiyonu (format değişikliğinde arttırılır) */
const SAFETY_NUMBER_VERSION = 2;

/** Safety number iterasyon sayısı (brute force'u zorlaştırır) */
const SAFETY_NUMBER_ITERATIONS = 5200;

/** Safety number segment uzunluğu */
const SEGMENT_LENGTH = 5;

/** Toplam segment sayısı */
const SEGMENT_COUNT = 12;

// ============================================================
// TİP TANIMLARI
// ============================================================

export interface SafetyNumberResult {
  /** 60 haneli safety number (12x5 gruplu, boşluklu) */
  displayNumber: string;
  /** Raw bytes (QR kod için) */
  rawBytes: Uint8Array;
  /** QR kod data URL'i (opsiyonel, generateQRData ile üretilir) */
  qrData?: string;
}

export interface FingerprintInfo {
  /** Tam fingerprint (64 hex karakter) */
  full: string;
  /** Kısa fingerprint (16 hex karakter, 4x4 gruplu) */
  short: string;
  /** Görsel fingerprint (emoji dizisi) */
  visual: string;
}

interface KnownFingerprint {
  deviceId: string;
  fingerprint: string;
  firstSeen: number;
  lastSeen: number;
  verified: boolean;
  verifiedAt?: number;
}

export type KeyChangeStatus = 'new' | 'unchanged' | 'changed' | 'verified';

// ============================================================
// FINGERPRINT ÜRETİMİ
// ============================================================

/**
 * Identity public key'den tam fingerprint bilgisi üretir.
 */
export async function generateFingerprintInfo(identityPublicKey: string): Promise<FingerprintInfo> {
  const keyBytes = decodeBase64(identityPublicKey);
  const hash = await subtle.digest('SHA-256', keyBytes);
  const fullHex = arrayBufferToHex(hash).toUpperCase();

  // Kısa format: İlk 16 hex karakter, 4'lü gruplara böl
  const shortHex = fullHex.substring(0, 16);
  const shortFormatted = shortHex.match(/.{1,4}/g)?.join(' ') || shortHex;

  // Görsel fingerprint: Her 4 byte'ı bir emoji'ye map et
  const visual = generateVisualFingerprint(new Uint8Array(hash));

  return {
    full: fullHex,
    short: shortFormatted,
    visual,
  };
}

/**
 * Görsel fingerprint üretir (emoji dizisi).
 * Her 2 byte'ı bir emoji'ye map eder → 16 emoji.
 * İnsanlar için karşılaştırması kolay.
 */
function generateVisualFingerprint(hashBytes: Uint8Array): string {
  // Güvenlik odaklı emoji seti (karışıklık yaratmayan, farklı görünen emojiler)
  const emojiSet = [
    '🔒', '🛡️', '⚡', '🔑', '🏰', '🌐', '🔥', '💎',
    '🚀', '⭐', '🌙', '🎯', '🔔', '🏆', '🎪', '🌊',
    '🌲', '🌸', '🍀', '🦅', '🐺', '🦁', '🐉', '🦊',
    '🎵', '🎨', '📡', '🔮', '⚓', '🗝️', '🏔️', '🌋',
  ];

  const emojis: string[] = [];
  for (let i = 0; i < 16 && i * 2 + 1 < hashBytes.length; i++) {
    const value = (hashBytes[i * 2] << 8) | hashBytes[i * 2 + 1];
    const index = value % emojiSet.length;
    emojis.push(emojiSet[index]);
  }

  return emojis.join('');
}

// ============================================================
// SAFETY NUMBER ÜRETİMİ
// ============================================================

/**
 * İki kullanıcı arasındaki safety number'ı hesaplar.
 * 
 * Algoritma:
 * 1. İki identity key'i deterministic sırala (küçük hex önce)
 * 2. hash_input = version || key_A || key_B || workspace_id
 * 3. 5200 iterasyon SHA-256 (brute force'u zorlaştır)
 * 4. İlk 30 byte'ı 5'li gruplara böl → 60 haneli sayı
 * 
 * Bu sayı her iki tarafta da AYNI olmalıdır.
 * Farklıysa MITM saldırısı var demektir.
 * 
 * @param myIdentityKey - Benim identity public key'im (base64)
 * @param theirIdentityKey - Karşı tarafın identity public key'i (base64)
 * @param workspaceId - Workspace UUID (domain separation)
 */
export async function generateSafetyNumber(
  myIdentityKey: string,
  theirIdentityKey: string,
  workspaceId: string
): Promise<SafetyNumberResult> {
  // 1. Key'leri decode et
  const myKeyBytes = decodeBase64(myIdentityKey);
  const theirKeyBytes = decodeBase64(theirIdentityKey);

  // 2. Deterministic sıralama
  const myHex = Array.from(myKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const theirHex = Array.from(theirKeyBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const [firstKey, secondKey] = myHex < theirHex
    ? [myKeyBytes, theirKeyBytes]
    : [theirKeyBytes, myKeyBytes];

  // 3. Hash input oluştur
  const versionByte = new Uint8Array([SAFETY_NUMBER_VERSION]);
  const workspaceBytes = new Uint8Array(stringToArrayBuffer(workspaceId));

  const hashInput = new Uint8Array(
    1 + firstKey.length + secondKey.length + workspaceBytes.length
  );
  let offset = 0;
  hashInput.set(versionByte, offset); offset += 1;
  hashInput.set(firstKey, offset); offset += firstKey.length;
  hashInput.set(secondKey, offset); offset += secondKey.length;
  hashInput.set(workspaceBytes, offset);

  // 4. İteratif SHA-256
  let hash: ArrayBuffer = hashInput.buffer;
  for (let i = 0; i < SAFETY_NUMBER_ITERATIONS; i++) {
    hash = await subtle.digest('SHA-256', hash);
  }

  const hashBytes = new Uint8Array(hash);

  // 5. 60 haneli sayı üret
  const digits: number[] = [];
  for (let i = 0; i < 30; i++) {
    // Her byte'ı 0-99 arasında iki haneye map et
    const value = hashBytes[i % hashBytes.length];
    digits.push(Math.floor(value / 2.56)); // 0-99
  }

  // 5'li gruplara böl
  const digitStr = digits.map(d => d.toString().padStart(2, '0')).join('');
  const segments: string[] = [];
  for (let i = 0; i < SEGMENT_COUNT * SEGMENT_LENGTH; i += SEGMENT_LENGTH) {
    segments.push(digitStr.substring(i, i + SEGMENT_LENGTH));
  }

  const displayNumber = segments.join(' ');

  return {
    displayNumber,
    rawBytes: hashBytes,
  };
}

/**
 * İki safety number'ın eşleşip eşleşmediğini kontrol eder.
 */
export function verifySafetyNumbers(myNumber: string, theirNumber: string): boolean {
  const normalize = (n: string) => n.replace(/\s+/g, '').trim();
  return normalize(myNumber) === normalize(theirNumber);
}

// ============================================================
// QR KOD DESTEĞİ
// ============================================================

/**
 * Safety number'ı QR kod data formatına dönüştürür.
 * QR kod kütüphanesi ile render edilebilir.
 * 
 * Format: "SENTINEL-SN:v2:{raw_hex}"
 */
export function generateQRData(safetyNumber: SafetyNumberResult): string {
  const rawHex = Array.from(safetyNumber.rawBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `SENTINEL-SN:v${SAFETY_NUMBER_VERSION}:${rawHex}`;
}

/**
 * QR kod data'sından safety number'ı parse eder.
 */
export function parseQRData(qrData: string): { version: number; rawHex: string } | null {
  const match = qrData.match(/^SENTINEL-SN:v(\d+):([0-9a-f]+)$/i);
  if (!match) return null;

  return {
    version: parseInt(match[1], 10),
    rawHex: match[2],
  };
}

// ============================================================
// MITM TESPİT MEKANİZMASI
// ============================================================

/**
 * Bir kullanıcının fingerprint'ini bilinen listesiyle karşılaştırır.
 * Trust-On-First-Use (TOFU) modeli:
 * - İlk görülen key güvenilir kabul edilir
 * - Sonraki değişiklikler uyarı tetikler
 */
export async function checkKeyChange(
  deviceId: string,
  workspaceId: string,
  currentFingerprint: string
): Promise<{
  status: KeyChangeStatus;
  previousFingerprint?: string;
  firstSeen?: number;
  warning?: string;
}> {
  const key = KNOWN_FINGERPRINTS_PREFIX + workspaceId + '_' + deviceId;
  const known = await getEncryptedData<KnownFingerprint>(key);

  if (!known) {
    // İlk kez görülen key → TOFU: Güvenilir kabul et ve kaydet
    await storeEncryptedData(key, {
      deviceId,
      fingerprint: currentFingerprint,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      verified: false,
    });

    return { status: 'new' };
  }

  // Fingerprint değişti mi?
  if (known.fingerprint === currentFingerprint) {
    // Değişmedi → lastSeen güncelle
    known.lastSeen = Date.now();
    await storeEncryptedData(key, known);

    return {
      status: known.verified ? 'verified' : 'unchanged',
      firstSeen: known.firstSeen,
    };
  }

  // FINGERPRINT DEĞİŞTİ → UYARI!
  const previousFingerprint = known.fingerprint;

  // Eski kaydı güncelle (yeni fingerprint ile)
  await storeEncryptedData(key, {
    deviceId,
    fingerprint: currentFingerprint,
    firstSeen: known.firstSeen,
    lastSeen: Date.now(),
    verified: false, // Yeni key doğrulanmamış
  });

  return {
    status: 'changed',
    previousFingerprint,
    firstSeen: known.firstSeen,
    warning: '⚠️ Bu kullanıcının güvenlik anahtarı değişti! ' +
             'Bu durum cihaz değişikliği veya olası bir MITM saldırısı anlamına gelebilir. ' +
             'Güvenliğiniz için karşı tarafla safety number\'ınızı doğrulayın.',
  };
}

/**
 * Bir kişiyi "doğrulanmış" olarak işaretler.
 * Safety number karşılaştırması yapıldıktan sonra çağrılır.
 */
export async function markContactVerified(
  deviceId: string,
  workspaceId: string
): Promise<void> {
  const key = KNOWN_FINGERPRINTS_PREFIX + workspaceId + '_' + deviceId;
  const known = await getEncryptedData<KnownFingerprint>(key);

  if (known) {
    known.verified = true;
    known.verifiedAt = Date.now();
    await storeEncryptedData(key, known);
  }

  // Verified contacts listesine ekle
  const vcKey = VERIFIED_CONTACTS_PREFIX + workspaceId;
  const verified = await getEncryptedData<string[]>(vcKey) || [];
  if (!verified.includes(deviceId)) {
    verified.push(deviceId);
    await storeEncryptedData(vcKey, verified);
  }
}

/**
 * Bir kişinin doğrulanmış olup olmadığını kontrol eder.
 */
export async function isContactVerified(
  deviceId: string,
  workspaceId: string
): Promise<boolean> {
  const key = KNOWN_FINGERPRINTS_PREFIX + workspaceId + '_' + deviceId;
  const known = await getEncryptedData<KnownFingerprint>(key);
  return known?.verified === true;
}

/**
 * Doğrulanmış kişiler listesini döndürür.
 */
export async function getVerifiedContacts(workspaceId: string): Promise<string[]> {
  const vcKey = VERIFIED_CONTACTS_PREFIX + workspaceId;
  return await getEncryptedData<string[]>(vcKey) || [];
}

/**
 * Bir kişinin doğrulamasını kaldırır.
 */
export async function unverifyContact(
  deviceId: string,
  workspaceId: string
): Promise<void> {
  const key = KNOWN_FINGERPRINTS_PREFIX + workspaceId + '_' + deviceId;
  const known = await getEncryptedData<KnownFingerprint>(key);

  if (known) {
    known.verified = false;
    known.verifiedAt = undefined;
    await storeEncryptedData(key, known);
  }

  const vcKey = VERIFIED_CONTACTS_PREFIX + workspaceId;
  const verified = await getEncryptedData<string[]>(vcKey) || [];
  const filtered = verified.filter(id => id !== deviceId);
  await storeEncryptedData(vcKey, filtered);
}

// ============================================================
// TEMİZLİK
// ============================================================

/**
 * Bir workspace'e ait tüm fingerprint verilerini temizler.
 */
export async function clearFingerprintData(workspaceId: string): Promise<void> {
  await deleteEncryptedDataByPrefix(KNOWN_FINGERPRINTS_PREFIX + workspaceId);
  await deleteEncryptedDataByPrefix(VERIFIED_CONTACTS_PREFIX + workspaceId);
}
