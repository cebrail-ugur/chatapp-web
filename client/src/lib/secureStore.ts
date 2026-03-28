/**
 * ChatApp Ultra - Güvenli Anahtar Deposu (secureStore.ts)
 * ──────────────────────────────────────────────────────────
 * IndexedDB tabanlı güvenli anahtar saklama katmanı.
 * 
 * GÜVENLİK İLKELERİ:
 * 1. Tüm anahtarlar IndexedDB'de saklanır (localStorage YASAK)
 * 2. CryptoKey nesneleri doğrudan saklanır (extractable: false)
 * 3. Serialize edilmesi gereken veriler (ratchet state vb.) 
 *    device-bound AES-GCM ile şifrelenerek saklanır
 * 4. Private key'ler asla plaintext olarak dışarı çıkmaz
 * 
 * YAPISI:
 * - DB adı: "sentinel_secure_store"
 * - Object Store'lar:
 *   - "keys"       → CryptoKey nesneleri (extractable: false)
 *   - "data"       → Şifrelenmiş veri blob'ları (ratchet state, session vb.)
 *   - "metadata"   → Şifrelenmemiş metadata (device_id, timestamps)
 * 
 * Standartlar: IndexedDB API, Web Crypto API (CryptoKey structured clone)
 */

// ============================================================
// SABİTLER
// ============================================================

const DB_NAME = 'sentinel_secure_store';
const DB_VERSION = 2;

/** State schema version - versioned state için */
const STATE_SCHEMA_VERSION = 1;

const STORE_KEYS = 'keys';
const STORE_DATA = 'data';
const STORE_METADATA = 'metadata';

// Device-bound encryption için sabit salt (cihaz kimliğiyle birleşir)
const DEVICE_WRAP_SALT = 'sentinel-device-wrap-key-v1';
const DEVICE_WRAP_INFO = 'sentinel-indexeddb-protection';

// ============================================================
// IndexedDB BAĞLANTI YÖNETİMİ
// ============================================================

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * IndexedDB veritabanını açar veya oluşturur.
 * Singleton pattern ile tek bağlantı kullanılır.
 */
function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // CryptoKey nesneleri için store
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS);
      }

      // Şifrelenmiş veri blob'ları için store
      if (!db.objectStoreNames.contains(STORE_DATA)) {
        db.createObjectStore(STORE_DATA);
      }

      // Metadata (device_id, timestamps) için store
      if (!db.objectStoreNames.contains(STORE_METADATA)) {
        db.createObjectStore(STORE_METADATA);
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Bağlantı kapanırsa tekrar aç
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };

      resolve(dbInstance);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(new Error(`[SecureStore] IndexedDB açılamadı: ${request.error?.message}`));
    };
  });

  return dbPromise;
}

// ============================================================
// DÜŞÜK SEVİYE IndexedDB İŞLEMLERİ
// ============================================================

/**
 * IndexedDB'ye veri yazar.
 */
async function idbPut(storeName: string, key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`[SecureStore] Put hatası: ${request.error?.message}`));
  });
}

/**
 * IndexedDB'den veri okur.
 */
async function idbGet<T = unknown>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(new Error(`[SecureStore] Get hatası: ${request.error?.message}`));
  });
}

/**
 * IndexedDB'den veri siler.
 */
async function idbDelete(storeName: string, key: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`[SecureStore] Delete hatası: ${request.error?.message}`));
  });
}

/**
 * Belirli bir prefix ile başlayan tüm key'leri bulur.
 */
async function idbGetAllKeys(storeName: string, prefix?: string): Promise<string[]> {
  const db = await openDB();
  return new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      const allKeys = (request.result as IDBValidKey[]).map(k => String(k));
      if (prefix) {
        resolve(allKeys.filter(k => k.startsWith(prefix)));
      } else {
        resolve(allKeys);
      }
    };
    request.onerror = () => reject(new Error(`[SecureStore] GetAllKeys hatası: ${request.error?.message}`));
  });
}

/**
 * Belirli bir prefix ile başlayan tüm key'leri siler.
 */
async function idbDeleteByPrefix(storeName: string, prefix: string): Promise<number> {
  const keys = await idbGetAllKeys(storeName, prefix);
  for (const key of keys) {
    await idbDelete(storeName, key);
  }
  return keys.length;
}

// ============================================================
// DEVICE-BOUND ŞİFRELEME (Veri koruma katmanı)
// ============================================================

/**
 * Cihaz kimliğinden AES-GCM koruma anahtarı türetir.
 * Bu anahtar IndexedDB'deki hassas verileri şifrelemek için kullanılır.
 * extractable: false → anahtar asla dışarı çıkamaz.
 */
async function getDeviceWrapKey(): Promise<CryptoKey> {
  // Önce IndexedDB'de saklı wrap key var mı kontrol et
  const existingKey = await idbGet<CryptoKey>(STORE_KEYS, '__device_wrap_key__');
  if (existingKey) return existingKey;

  // Device ID'yi al
  const deviceId = await getDeviceId();

  // Device ID'den HKDF ile wrap key türet
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(deviceId + DEVICE_WRAP_SALT),
    'HKDF',
    false,
    ['deriveKey']
  );

  const wrapKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(DEVICE_WRAP_SALT),
      info: new TextEncoder().encode(DEVICE_WRAP_INFO),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // extractable: false
    ['encrypt', 'decrypt']
  );

  // Wrap key'i IndexedDB'ye kaydet (CryptoKey structured clone)
  await idbPut(STORE_KEYS, '__device_wrap_key__', wrapKey);
  return wrapKey;
}

/**
 * HMAC key türetir - tamper detection için.
 * Device wrap key'den ayrı bir HMAC key türetilir.
 */
async function getHmacKey(): Promise<CryptoKey> {
  const existingKey = await idbGet<CryptoKey>(STORE_KEYS, '__hmac_integrity_key__');
  if (existingKey) return existingKey;

  const deviceId = await getDeviceId();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(deviceId + '-hmac-integrity-v1'),
    'HKDF',
    false,
    ['deriveKey']
  );

  const hmacKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('sentinel-hmac-tamper-detect'),
      info: new TextEncoder().encode('sentinel-integrity-key'),
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify']
  );

  await idbPut(STORE_KEYS, '__hmac_integrity_key__', hmacKey);
  return hmacKey;
}

/**
 * Veriyi device-bound AES-GCM ile şifreler + HMAC tamper detection.
 * Format: [1 byte version][12 byte IV][ciphertext + auth tag][32 byte HMAC]
 */
async function deviceEncrypt(plaintext: string): Promise<ArrayBuffer> {
  const wrapKey = await getDeviceWrapKey();
  const hmacKey = await getHmacKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    wrapKey,
    encoded
  );

  // Format: [1 byte version][12 byte IV][ciphertext + auth tag]
  const payload = new Uint8Array(1 + 12 + ciphertext.byteLength);
  payload[0] = STATE_SCHEMA_VERSION; // Versioned state
  payload.set(iv, 1);
  payload.set(new Uint8Array(ciphertext), 13);

  // HMAC tamper detection: payload üzerine HMAC hesapla
  const hmac = await crypto.subtle.sign('HMAC', hmacKey, payload);

  // Final: [payload][32 byte HMAC]
  const result = new Uint8Array(payload.length + hmac.byteLength);
  result.set(payload, 0);
  result.set(new Uint8Array(hmac), payload.length);
  return result.buffer;
}

/**
 * Device-bound AES-GCM ile şifrelenmiş veriyi çözer + HMAC doğrulama.
 * Hem yeni format (version + HMAC) hem eski format (sadece IV + ciphertext) desteklenir.
 */
async function deviceDecrypt(encrypted: ArrayBuffer): Promise<string> {
  const wrapKey = await getDeviceWrapKey();
  const data = new Uint8Array(encrypted);

  // Yeni format tespiti: version byte + HMAC
  // Eski format: [12 byte IV][ciphertext] (minimum 13 byte)
  // Yeni format: [1 byte version][12 byte IV][ciphertext][32 byte HMAC] (minimum 46 byte)
  if (data.length >= 46 && data[0] === STATE_SCHEMA_VERSION) {
    // Yeni format: HMAC doğrulama yap
    const hmacKey = await getHmacKey();
    const payload = data.slice(0, data.length - 32);
    const hmacValue = data.slice(data.length - 32);

    const isValid = await crypto.subtle.verify('HMAC', hmacKey, hmacValue, payload);
    if (!isValid) {
      throw new Error('[SecureStore] HMAC tamper detection: Veri bütünlüğü bozulmuş!');
    }

    const iv = payload.slice(1, 13);
    const ciphertext = payload.slice(13);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      wrapKey,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  // Eski format (geriye uyumluluk): HMAC yok
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    wrapKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// ============================================================
// AES-KW WRAPPING LAYER (Ek Koruma Katmanı)
// ============================================================

/** AES-KW wrapping salt */
const AES_KW_SALT = 'sentinel-aes-kw-wrap-v1';
const AES_KW_INFO = 'sentinel-key-wrapping-layer';

/**
 * AES-KW wrapping key türetir.
 * Device-bound wrap key'den ayrı bir AES-KW key türetilir.
 * Bu key, workspace key gibi hassas anahtarları sarmak için kullanılır.
 * extractable: false → asla dışarı çıkamaz.
 */
async function getAESKWKey(): Promise<CryptoKey> {
  const existingKey = await idbGet<CryptoKey>(STORE_KEYS, '__aes_kw_key__');
  if (existingKey) return existingKey;

  const deviceId = await getDeviceId();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(deviceId + AES_KW_SALT),
    'HKDF',
    false,
    ['deriveKey']
  );

  const kwKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(AES_KW_SALT),
      info: new TextEncoder().encode(AES_KW_INFO),
    },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false, // extractable: false
    ['wrapKey', 'unwrapKey']
  );

  await idbPut(STORE_KEYS, '__aes_kw_key__', kwKey);
  return kwKey;
}

/**
 * AES-KW ile bir CryptoKey'i sarar (wrap).
 * Sonuç: Sarılmış anahtarın ArrayBuffer'i.
 */
export async function wrapKeyWithAESKW(keyToWrap: CryptoKey): Promise<ArrayBuffer> {
  const kwKey = await getAESKWKey();
  return crypto.subtle.wrapKey('raw', keyToWrap, kwKey, 'AES-KW');
}

/**
 * AES-KW ile sarılmış bir anahtarı açar (unwrap).
 * Sonuç: extractable: false CryptoKey.
 */
export async function unwrapKeyWithAESKW(
  wrappedKey: ArrayBuffer,
  algorithm: AesKeyGenParams,
  usages: KeyUsage[]
): Promise<CryptoKey> {
  const kwKey = await getAESKWKey();
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    kwKey,
    'AES-KW',
    algorithm,
    false, // extractable: false
    usages
  );
}

// ============================================================
// PUBLIC API: CryptoKey SAKLAMA
// ============================================================

/**
 * CryptoKey nesnesini IndexedDB'ye saklar.
 * CryptoKey structured clone ile doğrudan saklanır.
 * extractable: false olan key'ler bile saklanabilir.
 */
export async function storeCryptoKey(keyId: string, key: CryptoKey): Promise<void> {
  await idbPut(STORE_KEYS, keyId, key);
}

/**
 * CryptoKey nesnesini IndexedDB'den okur.
 */
export async function getCryptoKey(keyId: string): Promise<CryptoKey | null> {
  const key = await idbGet<CryptoKey>(STORE_KEYS, keyId);
  return key ?? null;
}

/**
 * CryptoKey nesnesini IndexedDB'den siler.
 */
export async function deleteCryptoKey(keyId: string): Promise<void> {
  await idbDelete(STORE_KEYS, keyId);
}

// ============================================================
// PUBLIC API: ŞİFRELİ VERİ SAKLAMA
// ============================================================

/**
 * Hassas veriyi device-bound şifreleme ile IndexedDB'ye saklar.
 * Ratchet state, session bilgileri, workspace key gibi veriler için.
 */
export async function storeEncryptedData(dataId: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data);
  const encrypted = await deviceEncrypt(json);
  await idbPut(STORE_DATA, dataId, encrypted);
}

/**
 * Device-bound şifrelenmiş veriyi IndexedDB'den okur ve çözer.
 */
export async function getEncryptedData<T = unknown>(dataId: string): Promise<T | null> {
  const encrypted = await idbGet<ArrayBuffer>(STORE_DATA, dataId);
  if (!encrypted) return null;

  try {
    const json = await deviceDecrypt(encrypted);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Şifrelenmiş veriyi IndexedDB'den güvenli siler.
 * Önce rastgele veri ile üzerine yazar (overwrite), sonra siler.
 * Bu sayede disk üzerinde kalıntı veri kalma riski azaltılır.
 */
export async function deleteEncryptedData(dataId: string): Promise<void> {
  // Secure overwrite: Önce rastgele veri ile üzerine yaz
  const randomOverwrite = crypto.getRandomValues(new Uint8Array(64));
  await idbPut(STORE_DATA, dataId, randomOverwrite.buffer);
  // Sonra sil
  await idbDelete(STORE_DATA, dataId);
}

/**
 * Belirli prefix ile başlayan tüm şifrelenmiş verileri siler.
 */
export async function deleteEncryptedDataByPrefix(prefix: string): Promise<number> {
  return idbDeleteByPrefix(STORE_DATA, prefix);
}

// ============================================================
// PUBLIC API: METADATA SAKLAMA (Şifrelenmemiş)
// ============================================================

/**
 * Metadata saklar (device_id, timestamps gibi hassas olmayan veriler).
 */
export async function storeMetadata(key: string, value: unknown): Promise<void> {
  await idbPut(STORE_METADATA, key, value);
}

/**
 * Metadata okur.
 */
export async function getMetadata<T = unknown>(key: string): Promise<T | null> {
  const value = await idbGet<T>(STORE_METADATA, key);
  return value ?? null;
}

/**
 * Metadata siler.
 */
export async function deleteMetadata(key: string): Promise<void> {
  await idbDelete(STORE_METADATA, key);
}

// ============================================================
// PUBLIC API: CİHAZ KİMLİĞİ
// ============================================================

/**
 * Cihaz kimliğini alır veya oluşturur.
 * IndexedDB'de saklanır (localStorage'dan taşınır).
 */
export async function getDeviceId(): Promise<string> {
  // IndexedDB'den oku
  const stored = await getMetadata<string>('device_id');
  if (stored) return stored;

  // localStorage'dan migration (geriye uyumluluk - tek seferlik)
  const legacyId = localStorage.getItem('sentinel_device_id');
  if (legacyId) {
    await storeMetadata('device_id', legacyId);
    localStorage.removeItem('sentinel_device_id');
    return legacyId;
  }

  // Yeni cihaz kimliği üret
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const id = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32);

  await storeMetadata('device_id', id);
  return id;
}

// ============================================================
// PUBLIC API: TOPLU TEMİZLİK
// ============================================================

/**
 * Belirli bir workspace'e ait tüm verileri siler.
 */
export async function clearWorkspaceData(workspaceId: string): Promise<void> {
  await idbDeleteByPrefix(STORE_KEYS, workspaceId);
  await idbDeleteByPrefix(STORE_DATA, workspaceId);
  await idbDeleteByPrefix(STORE_METADATA, workspaceId);
}

/**
 * Tüm güvenli depoyu temizler (fabrika ayarlarına döndürme).
 */
export async function clearAllSecureData(): Promise<void> {
  const db = await openDB();

  const tx = db.transaction([STORE_KEYS, STORE_DATA, STORE_METADATA], 'readwrite');
  tx.objectStore(STORE_KEYS).clear();
  tx.objectStore(STORE_DATA).clear();
  tx.objectStore(STORE_METADATA).clear();

  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('[SecureStore] Clear hatası'));
  });
}

// ============================================================
// PUBLIC API: localStorage → IndexedDB MİGRASYON
// ============================================================

/**
 * localStorage'daki eski anahtarları IndexedDB'ye taşır.
 * Tek seferlik migration - taşınan veriler localStorage'dan silinir.
 */
export async function migrateFromLocalStorage(): Promise<number> {
  let migratedCount = 0;

  const prefixes = [
    'sentinel_e2ee_key_v3_',
    'sentinel_ecdh_',
    'sentinel_x25519_id_',
    'sentinel_ratchet_',
    'sentinel_x3dh_spk_',
    'sentinel_x3dh_opk_',
    'sentinel_x3dh_bundle_',
    'sentinel_x3dh_session_',
    'sentinel_e2ee_key_',
    'sentinel_skipped_mk_',
  ];

  const keysToMigrate: { key: string; value: string }[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    for (const prefix of prefixes) {
      if (key.startsWith(prefix)) {
        const value = localStorage.getItem(key);
        if (value) {
          keysToMigrate.push({ key, value });
        }
        break;
      }
    }
  }

  for (const { key, value } of keysToMigrate) {
    try {
      await storeEncryptedData(key, value);
      localStorage.removeItem(key);
      migratedCount++;
    } catch {
      // Migration hatası - veri kaybını önlemek için localStorage'da bırak
    }
  }

  // Device ID migration
  const deviceId = localStorage.getItem('sentinel_device_id');
  if (deviceId) {
    await storeMetadata('device_id', deviceId);
    localStorage.removeItem('sentinel_device_id');
    migratedCount++;
  }

  return migratedCount;
}

// ============================================================
// EXPORT: Veritabanı hazırlık
// ============================================================

/**
 * Güvenli depoyu başlatır. Uygulama açılışında çağrılmalı.
 * Migration varsa otomatik yapar.
 */
export async function initSecureStore(): Promise<void> {
  await openDB();
  const migrated = await migrateFromLocalStorage();
  if (migrated > 0) {
    // Migration tamamlandı - ${migrated} anahtar taşındı
  }
}
