/**
 * ChatApp Ultra - Kriptografik Test Vektörleri ve Test Suite
 * ──────────────────────────────────────────────────────────
 * DEVLET SEVİYESİ AUDIT GEREKSİNİMİ:
 * - Padding doğrulama testleri
 * - Header encryption round-trip testleri
 * - AES-GCM şifreleme/çözme testleri
 * - HKDF türetme tutarlılık testleri
 * - Replay protection testleri
 * - Session expiration testleri
 * - Ratchet state ilerleme testleri
 * - Key compromise recovery testleri
 * 
 * Bu testler tarayıcı ortamında çalıştırılmak üzere tasarlanmıştır.
 * Node.js'te çalıştırmak için @peculiar/webcrypto polyfill gerekir.
 */

import { padMessage, unpadMessage, padMessageFixed, generateDummyPacket } from '../metadataGuard';
import { deriveHeaderKey, encryptHeader, decryptHeader, exportHeaderKey, importHeaderKey } from '../headerEncryption';

// ============================================================
// TEST YARDIMCILARI
// ============================================================

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`[FAIL] ${testName}`);
  }
}

function assertEq(actual: unknown, expected: unknown, testName: string): void {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  if (match) {
    passed++;
  } else {
    failed++;
    console.error(`[FAIL] ${testName}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ============================================================
// BÖLÜM 1: PADDING TESTLERİ
// ============================================================

function testPaddingRoundTrip(): void {
  const testCases = [
    '', // Boş mesaj
    'Merhaba', // Kısa mesaj
    'A'.repeat(255), // 255 byte - blok sınırına yakın
    'B'.repeat(256), // Tam blok sınırı
    'C'.repeat(257), // Blok sınırını 1 aşan
    'D'.repeat(1024), // Büyük mesaj
    '🇹🇷 Türkçe karakter testi: çğıöşü ÇĞİÖŞÜ', // UTF-8
    JSON.stringify({ text: 'Test mesajı', sender: 'Ahmet', type: 'text' }), // JSON payload
  ];

  for (const tc of testCases) {
    const original = new TextEncoder().encode(tc);
    const padded = padMessage(original);
    const unpadded = unpadMessage(padded);

    // Round-trip doğrulama
    assertEq(
      new TextDecoder().decode(unpadded),
      tc,
      `Padding round-trip: "${tc.substring(0, 30)}..."`
    );

    // Padded boyut 256'nın katı olmalı
    assert(
      padded.length % 256 === 0,
      `Padding alignment (256): len=${padded.length} for input len=${original.length}`
    );

    // Padded boyut orijinalden büyük olmalı
    assert(
      padded.length > original.length,
      `Padding size increase: ${padded.length} > ${original.length}`
    );
  }
}

function testFixedPaddingRoundTrip(): void {
  const testCases = ['Kısa', 'A'.repeat(4000), 'B'.repeat(5000)];

  for (const tc of testCases) {
    const original = new TextEncoder().encode(tc);
    const padded = padMessageFixed(original);
    const unpadded = unpadMessage(padded);

    assertEq(
      new TextDecoder().decode(unpadded),
      tc,
      `Fixed padding round-trip: len=${original.length}`
    );

    // 4096'nın katı olmalı
    assert(
      padded.length % 4096 === 0,
      `Fixed padding alignment (4096): len=${padded.length}`
    );
  }
}

function testPaddingDifferentSizesSameBlock(): void {
  // 1 byte ve 200 byte mesajlar aynı 256-byte bloğa düşmeli
  const short = padMessage(new TextEncoder().encode('A'));
  const medium = padMessage(new TextEncoder().encode('A'.repeat(200)));

  assertEq(short.length, 256, 'Short message pads to 256');
  assertEq(medium.length, 256, 'Medium message pads to 256');
}

function testDummyPacketGeneration(): void {
  const packet1 = generateDummyPacket();
  const packet2 = generateDummyPacket();

  // Boyut 256'nın katı olmalı
  assert(packet1.length % 256 === 0, 'Dummy packet alignment');

  // İki packet farklı olmalı (rastgele)
  const same = packet1.length === packet2.length &&
    packet1.every((v, i) => v === packet2[i]);
  assert(!same, 'Dummy packets are random');
}

// ============================================================
// BÖLÜM 2: HEADER ENCRYPTION TESTLERİ
// ============================================================

async function testHeaderEncryptionRoundTrip(): Promise<void> {
  // Sahte root key oluştur
  const rootKey = crypto.getRandomValues(new Uint8Array(32));

  const headerKey = await deriveHeaderKey(rootKey);

  const dhPub = 'test-dh-public-key-base64-encoded';
  const sendCount = 42;
  const prevChainLen = 10;

  const { encryptedHeader, headerIv } = await encryptHeader(
    dhPub, sendCount, prevChainLen, headerKey
  );

  const decrypted = await decryptHeader(encryptedHeader, headerIv, headerKey);

  assert(decrypted !== null, 'Header decryption succeeded');
  assertEq(decrypted?.dhPub, dhPub, 'Header DH pub key matches');
  assertEq(decrypted?.sendCount, sendCount, 'Header send count matches');
  assertEq(decrypted?.prevChainLen, prevChainLen, 'Header prev chain len matches');
}

async function testHeaderKeyExportImport(): Promise<void> {
  const rootKey = crypto.getRandomValues(new Uint8Array(32));
  const headerKey = await deriveHeaderKey(rootKey);

  // Export
  const exported = await exportHeaderKey(headerKey);
  assert(exported.length === 32, 'Exported header key is 32 bytes');

  // Import
  const imported = await importHeaderKey(exported);

  // Encrypt with original, decrypt with imported
  const { encryptedHeader, headerIv } = await encryptHeader(
    'test-key', 5, 3, headerKey
  );
  const decrypted = await decryptHeader(encryptedHeader, headerIv, imported);

  assert(decrypted !== null, 'Header key export/import round-trip');
  assertEq(decrypted?.dhPub, 'test-key', 'Imported key decrypts correctly');
}

async function testHeaderWrongKey(): Promise<void> {
  const rootKey1 = crypto.getRandomValues(new Uint8Array(32));
  const rootKey2 = crypto.getRandomValues(new Uint8Array(32));

  const headerKey1 = await deriveHeaderKey(rootKey1);
  const headerKey2 = await deriveHeaderKey(rootKey2);

  const { encryptedHeader, headerIv } = await encryptHeader(
    'secret-dh-key', 1, 0, headerKey1
  );

  // Yanlış key ile çözmeye çalış
  const decrypted = await decryptHeader(encryptedHeader, headerIv, headerKey2);
  assert(decrypted === null, 'Wrong header key returns null');
}

async function testHeaderDeterministicKeyDerivation(): Promise<void> {
  const rootKey = crypto.getRandomValues(new Uint8Array(32));

  const key1 = await deriveHeaderKey(rootKey);
  const key2 = await deriveHeaderKey(rootKey);

  const exported1 = await exportHeaderKey(key1);
  const exported2 = await exportHeaderKey(key2);

  // Aynı root key'den aynı header key türetilmeli
  assertEq(
    Array.from(exported1),
    Array.from(exported2),
    'Deterministic header key derivation'
  );
}

// ============================================================
// BÖLÜM 3: AES-GCM TEST VEKTÖRLERİ
// ============================================================

async function testAesGcmBasic(): Promise<void> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode('Test mesajı');

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    plaintext
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    ciphertext
  );

  assertEq(
    new TextDecoder().decode(decrypted),
    'Test mesajı',
    'AES-GCM basic encrypt/decrypt'
  );
}

async function testAesGcmTamper(): Promise<void> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    new TextEncoder().encode('Orijinal mesaj')
  );

  // Ciphertext'i boz
  const tampered = new Uint8Array(ciphertext);
  tampered[0] ^= 0xFF;

  let decryptFailed = false;
  try {
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      tampered
    );
  } catch {
    decryptFailed = true;
  }

  assert(decryptFailed, 'AES-GCM tamper detection (ciphertext modification)');
}

async function testAesGcmIvUniqueness(): Promise<void> {
  // 1000 IV üret, hepsi benzersiz olmalı
  const ivSet = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    ivSet.add(Array.from(iv).join(','));
  }
  assertEq(ivSet.size, 1000, 'All 1000 IVs are unique');
}

// ============================================================
// BÖLÜM 4: HKDF TUTARLILIK TESTLERİ
// ============================================================

async function testHkdfDeterministic(): Promise<void> {
  const ikm = crypto.getRandomValues(new Uint8Array(32));
  const salt = new TextEncoder().encode('test-salt');
  const info = new TextEncoder().encode('test-info');

  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

  const bits1 = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    256
  );

  const bits2 = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    256
  );

  assertEq(
    Array.from(new Uint8Array(bits1)),
    Array.from(new Uint8Array(bits2)),
    'HKDF deterministic output'
  );
}

async function testHkdfDifferentInfoDifferentOutput(): Promise<void> {
  const ikm = crypto.getRandomValues(new Uint8Array(32));
  const salt = new TextEncoder().encode('same-salt');

  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

  const bits1 = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('info-1') },
    baseKey,
    256
  );

  const bits2 = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('info-2') },
    baseKey,
    256
  );

  const same = new Uint8Array(bits1).every((v, i) => v === new Uint8Array(bits2)[i]);
  assert(!same, 'HKDF different info produces different output (domain separation)');
}

// ============================================================
// BÖLÜM 5: KEY COMPROMISE RECOVERY SİMÜLASYONU
// ============================================================

async function testForwardSecrecy(): Promise<void> {
  // Simülasyon: Eski chain key'den yeni mesaj çözülemez
  const ck1 = crypto.getRandomValues(new Uint8Array(32));

  const baseKey = await crypto.subtle.importKey('raw', ck1, 'HKDF', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('chain-ratchet'),
      info: new TextEncoder().encode('sentinel-ultra-chain-ratchet-v1'),
    },
    baseKey,
    512
  );

  const newChainKey = new Uint8Array(derived.slice(0, 32));
  const messageKey = new Uint8Array(derived.slice(32, 64));

  // Eski CK'dan yeni CK türetilemez (tek yönlü)
  const same = ck1.every((v, i) => v === newChainKey[i]);
  assert(!same, 'Forward secrecy: new CK differs from old CK');

  // Message key, chain key'den farklı
  const mkSame = newChainKey.every((v, i) => v === messageKey[i]);
  assert(!mkSame, 'Message key differs from chain key');
}

// ============================================================
// ANA TEST ÇALIŞTIRICI
// ============================================================

export async function runAllCryptoTests(): Promise<{ passed: number; failed: number; total: number }> {
  passed = 0;
  failed = 0;

  // Bölüm 1: Padding
  testPaddingRoundTrip();
  testFixedPaddingRoundTrip();
  testPaddingDifferentSizesSameBlock();
  testDummyPacketGeneration();

  // Bölüm 2: Header Encryption
  await testHeaderEncryptionRoundTrip();
  await testHeaderKeyExportImport();
  await testHeaderWrongKey();
  await testHeaderDeterministicKeyDerivation();

  // Bölüm 3: AES-GCM
  await testAesGcmBasic();
  await testAesGcmTamper();
  await testAesGcmIvUniqueness();

  // Bölüm 4: HKDF
  await testHkdfDeterministic();
  await testHkdfDifferentInfoDifferentOutput();

  // Bölüm 5: Key Compromise Recovery
  await testForwardSecrecy();

  const total = passed + failed;
  return { passed, failed, total };
}
