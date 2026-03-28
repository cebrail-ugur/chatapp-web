/**
 * ChatApp Ultra - Header Encryption Modülü (headerEncryption.ts)
 * ──────────────────────────────────────────────────────────────
 * DEVLET SEVİYESİ SERTLEŞTİRME:
 * - Double Ratchet mesaj header'ları şifrelenir
 * - DH public key, mesaj indeksi ve previous chain length gizlenir
 * - Sunucu veya gözlemci hangi ratchet adımında olduğumuzu bilemez
 * 
 * Signal Protocol: Encrypted Message Headers (Section 3.4)
 * 
 * Header Format (şifresiz):
 *   DH_PUB | SEND_COUNT | PREV_CHAIN_LEN
 * 
 * Header Format (şifreli):
 *   v4e:ENCRYPTED_HEADER:IV:CIPHERTEXT
 * 
 * Header key, root key'den HKDF ile türetilir.
 * Her DH ratchet adımında yeni header key üretilir.
 */

import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import {
  subtle,
  cryptoAPI,
  hkdfDerive,
} from './keyManager';

// ============================================================
// SABİTLER
// ============================================================

/** Header encryption HKDF info string (domain separation) */
const HEADER_KEY_INFO = 'sentinel-ultra-header-encryption-v1';

/** Header HKDF salt */
const HEADER_KEY_SALT = 'sentinel-header-salt-v1';

// ============================================================
// HEADER KEY TÜRETME
// ============================================================

/**
 * Root key'den header encryption key türetir.
 * Her DH ratchet adımında yeni header key üretilir.
 * 
 * headerKey = HKDF(rootKey, salt="sentinel-header-salt-v1", info="sentinel-ultra-header-encryption-v1")
 */
export async function deriveHeaderKey(rootKey: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  
  // Root key'i HKDF base key olarak import et
  const baseKey = await subtle.importKey(
    'raw',
    rootKey,
    'HKDF',
    false,
    ['deriveKey']
  );
  
  // Header key türet
  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(HEADER_KEY_SALT),
      info: encoder.encode(HEADER_KEY_INFO),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true, // exportable: state'te saklamak için exportHeaderKey() ile dışa aktarılır
    ['encrypt', 'decrypt']
  );
}

// ============================================================
// HEADER ŞİFRELEME
// ============================================================

/**
 * Mesaj header'ını şifreler.
 * 
 * Header içeriği:
 * - dhPub: DH public key (base64)
 * - sendCount: Mesaj indeksi
 * - prevChainLen: Önceki chain uzunluğu
 * 
 * Çıktı: encryptedHeader (base64) + iv (base64)
 */
export async function encryptHeader(
  dhPub: string,
  sendCount: number,
  prevChainLen: number,
  headerKey: CryptoKey
): Promise<{ encryptedHeader: string; headerIv: string }> {
  const encoder = new TextEncoder();
  
  // Header payload'u oluştur
  const headerPayload = JSON.stringify({
    dh: dhPub,
    n: sendCount,
    pn: prevChainLen,
  });
  
  const iv = cryptoAPI.getRandomValues(new Uint8Array(12));
  
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    headerKey,
    encoder.encode(headerPayload)
  );
  
  return {
    encryptedHeader: encodeBase64(new Uint8Array(encrypted)),
    headerIv: encodeBase64(iv),
  };
}

/**
 * Şifreli header'ı çözer.
 * 
 * Çıktı: { dhPub, sendCount, prevChainLen } veya null (çözülemezse)
 */
export async function decryptHeader(
  encryptedHeader: string,
  headerIv: string,
  headerKey: CryptoKey
): Promise<{ dhPub: string; sendCount: number; prevChainLen: number } | null> {
  try {
    const iv = decodeBase64(headerIv);
    const ciphertext = decodeBase64(encryptedHeader);
    
    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      headerKey,
      ciphertext
    );
    
    const payload = JSON.parse(new TextDecoder().decode(decrypted));
    
    return {
      dhPub: payload.dh,
      sendCount: payload.n,
      prevChainLen: payload.pn,
    };
  } catch {
    return null;
  }
}

/**
 * Header key'i Uint8Array olarak export eder (ratchet state'te saklamak için).
 * NOT: Bu key sadece header şifreleme için kullanılır, private key değildir.
 */
export async function exportHeaderKey(headerKey: CryptoKey): Promise<Uint8Array> {
  const exported = await subtle.exportKey('raw', headerKey);
  return new Uint8Array(exported);
}

/**
 * Uint8Array'den header key import eder (ratchet state'ten okumak için).
 */
export async function importHeaderKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    true, // exportable - state'te saklamak için
    ['encrypt', 'decrypt']
  );
}
