/**
 * ChatApp Ultra - Anahtar Yönetimi Modülü (keyManager.ts)
 * ──────────────────────────────────────────────────────────
 * GÜVENLİK SERTLEŞTİRME v2:
 * - localStorage KALDIRILDI → IndexedDB (secureStore.ts)
 * - extractable: true KALDIRILDI → extractable: false
 * - exportKey çağrıları KALDIRILDI
 * - Base64 private key saklama KALDIRILDI (X25519 hariç - TweetNaCl gerekliliği)
 * - Debug logları üretim ortamında devre dışı
 * 
 * Kullanılan Standartlar:
 * - X25519 (RFC 7748) via TweetNaCl
 * - ECDH P-256 (NIST) via Web Crypto API (extractable: false)
 * - SHA-256 (FIPS 180-4)
 * - HKDF (RFC 5869)
 */

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import {
  storeEncryptedData,
  getEncryptedData,
  storeCryptoKey,
  getCryptoKey,
  getDeviceId as secureGetDeviceId,
} from './secureStore';

// ============================================================
// SABİTLER (prefix'ler artık IndexedDB key'leri olarak kullanılır)
// ============================================================

export const KEY_STORAGE_PREFIX = 'sentinel_e2ee_key_v3_';
export const KEYPAIR_STORAGE_PREFIX = 'sentinel_ecdh_';
export const X25519_IDENTITY_PREFIX = 'sentinel_x25519_id_';
export const RATCHET_STATE_PREFIX = 'sentinel_ratchet_';
export const X3DH_SPK_PREFIX = 'sentinel_x3dh_spk_';
export const X3DH_OPK_PREFIX = 'sentinel_x3dh_opk_';
export const X3DH_BUNDLE_PREFIX = 'sentinel_x3dh_bundle_';
export const X3DH_SESSION_PREFIX = 'sentinel_x3dh_session_';
export const LEGACY_KEY_PREFIX = 'sentinel_e2ee_key_';

// ============================================================
// WEB CRYPTO API REFERANSLARI
// ============================================================

export const cryptoAPI = globalThis.crypto;
export const subtle = cryptoAPI?.subtle;

export function requireSecureContext(): void {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Güvenli bağlantı gerekli. Lütfen HTTPS veya localhost üzerinden erişin.'
    );
  }
}

// ============================================================
// YARDIMCI FONKSİYONLAR - ArrayBuffer ↔ String dönüşümleri
// ============================================================

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

export function stringToArrayBuffer(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer;
}

export function arrayBufferToString(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================================
// HKDF-SHA256 ANAHTAR TÜRETMESİ (RFC 5869)
// ============================================================

export async function hkdfDerive(
  inputKeyMaterial: Uint8Array,
  salt: Uint8Array,
  info: string,
  length: number
): Promise<Uint8Array> {
  const baseKey = await subtle.importKey(
    'raw',
    inputKeyMaterial,
    'HKDF',
    false,
    ['deriveBits']
  );

  const derived = await subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: new TextEncoder().encode(info)
    },
    baseKey,
    length * 8
  );

  return new Uint8Array(derived);
}

// ============================================================
// X25519 ANAHTAR YÖNETİMİ (Curve25519 - Signal Protocol)
// ============================================================

/**
 * X25519 Identity Key Pair üretir.
 * NOT: TweetNaCl X25519 anahtarları Web Crypto CryptoKey değildir.
 * Bu yüzden secret key IndexedDB'de şifreli saklanır (secureStore).
 */
export function generateX25519IdentityKeyPair(): {
  publicKey: string;
  secretKey: string;
} {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey)
  };
}

/**
 * X25519 Ephemeral Key Pair üretir.
 */
export function generateX25519EphemeralKeyPair(): {
  publicKey: string;
  secretKey: string;
} {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey)
  };
}

/**
 * X25519 Identity Key Pair'i IndexedDB'de şifreli saklar.
 * (localStorage KALDIRILDI)
 */
export async function storeX25519IdentityKey(workspaceId: string, publicKey: string, secretKey: string): Promise<void> {
  await storeEncryptedData(X25519_IDENTITY_PREFIX + workspaceId, {
    publicKey,
    secretKey
  });
}

/**
 * X25519 Identity Key Pair'i IndexedDB'den okur.
 */
export async function getX25519IdentityKey(workspaceId: string): Promise<{ publicKey: string; secretKey: string } | null> {
  return getEncryptedData<{ publicKey: string; secretKey: string }>(X25519_IDENTITY_PREFIX + workspaceId);
}

/**
 * X25519 ECDH: İki tarafın anahtarından shared secret üretir.
 */
export function x25519SharedSecret(mySecretKey: string, theirPublicKey: string): Uint8Array {
  const sk = decodeBase64(mySecretKey);
  const pk = decodeBase64(theirPublicKey);
  return nacl.box.before(pk, sk);
}

// ============================================================
// ECDH P-256 (Web Crypto API - extractable: false)
// ============================================================

/**
 * ECDH P-256 key pair üretir.
 * GÜVENLİK: extractable: false → private key asla dışarı çıkamaz.
 * CryptoKey doğrudan IndexedDB'ye saklanır (structured clone).
 * exportKey çağrısı KALDIRILDI.
 */
export async function generateECDHKeyPair(workspaceId?: string): Promise<{
  publicKey: string;
  keyPairId: string;
}> {
  const keyPair = await subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // extractable: FALSE - private key asla export edilemez
    ['deriveKey', 'deriveBits']
  );

  // Public key'i raw olarak al (sadece public key extractable)
  const publicKeyRaw = await subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(publicKeyRaw);

  // Key pair ID oluştur
  const keyPairId = workspaceId
    ? KEYPAIR_STORAGE_PREFIX + workspaceId
    : KEYPAIR_STORAGE_PREFIX + arrayBufferToHex(cryptoAPI.getRandomValues(new Uint8Array(8)).buffer);

  // CryptoKey nesnelerini doğrudan IndexedDB'ye sakla
  await storeCryptoKey(keyPairId + '_pub', keyPair.publicKey);
  await storeCryptoKey(keyPairId + '_priv', keyPair.privateKey);

  return {
    publicKey: publicKeyBase64,
    keyPairId
  };
}

/**
 * ECDH P-256 public key'i IndexedDB'den alır.
 */
export async function getECDHPublicKey(keyPairId: string): Promise<CryptoKey | null> {
  return getCryptoKey(keyPairId + '_pub');
}

/**
 * ECDH P-256 private key'i IndexedDB'den alır (CryptoKey olarak).
 * Private key asla export edilemez - sadece deriveBits/deriveKey için kullanılabilir.
 */
export async function getECDHPrivateKey(keyPairId: string): Promise<CryptoKey | null> {
  return getCryptoKey(keyPairId + '_priv');
}

/**
 * ECDH shared secret türetir (CryptoKey nesneleri ile).
 * Private key asla dışarı çıkmaz - deriveBits doğrudan CryptoKey üzerinde çalışır.
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKeyBase64: string
): Promise<ArrayBuffer> {
  const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
  const publicKey = await subtle.importKey(
    'raw',
    publicKeyBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  return subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
}

// ============================================================
// SHA-256 HASH
// ============================================================

export async function sha256Hash(data: string): Promise<string> {
  const buffer = stringToArrayBuffer(data);
  const hash = await subtle.digest('SHA-256', buffer);
  return arrayBufferToHex(hash);
}

// ============================================================
// CİHAZ KİMLİĞİ (IndexedDB tabanlı)
// ============================================================

/**
 * Cihaz kimliğini alır veya oluşturur.
 * Artık IndexedDB'de saklanır (secureStore.ts üzerinden).
 */
export async function generateDeviceId(): Promise<string> {
  return secureGetDeviceId();
}

/**
 * Senkron geriye uyumluluk wrapper.
 * Mevcut cihaz kimliğini döndürür (varsa localStorage'dan, yoksa boş string).
 * Asenkron versiyonu tercih edin: generateDeviceId()
 */
export function getOrCreateDeviceIdSync(): string {
  // Geçiş dönemi: localStorage'da hâlâ varsa oku ve SİL
  const stored = localStorage.getItem('sentinel_device_id');
  if (stored) {
    // Migration: localStorage'dan oku, IndexedDB'ye taşınacak, localStorage'dan sil
    try { localStorage.removeItem('sentinel_device_id'); } catch { /* ignore */ }
    return stored;
  }
  // Yoksa boş string - asenkron versiyonu kullanılmalı
  return '';
}

// ============================================================
// 256-BIT WORKSPACE ANAHTAR ÜRETİMİ
// ============================================================

export function generateWorkspaceKey(): string {
  const key = cryptoAPI.getRandomValues(new Uint8Array(32));
  return arrayBufferToBase64(key.buffer);
}

// ============================================================
// GÜVENLİK YARDIMCILARI
// ============================================================

export function sanitizeInput(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function unsanitizeForDisplay(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

export class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canProceed(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxRequests) return false;
    this.timestamps.push(now);
    return true;
  }
}
