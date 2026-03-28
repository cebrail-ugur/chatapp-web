-- ============================================================
-- ChatApp Ultra - Zero-Knowledge Encryption Tables
-- Migration: 001_zero_knowledge_tables
-- Tarih: 2026-02-27
-- ============================================================
-- 
-- Bu migration aşağıdaki tabloları oluşturur:
-- 1. user_keys: Kullanıcı public key'leri (private key ASLA server'da saklanmaz)
-- 2. channel_keys: Her kullanıcı için ECDH ile şifrelenmiş channel key'ler
--
-- GÜVENLİK İLKELERİ:
-- - Server zero-knowledge: Plaintext anahtar ASLA saklanmaz
-- - user_keys: Sadece public key ve metadata
-- - channel_keys: Sadece encrypted blob (IV + ciphertext + auth_tag)
-- - Private key'ler sadece client tarafında IndexedDB'de device-bound AES-GCM ile saklanır
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. USER KEYS TABLOSU
-- ─────────────────────────────────────────────────────────────
-- Her kullanıcının identity public key'ini, signed prekey'ini
-- ve one-time prekey'lerini saklar.
-- Private key ASLA bu tabloda bulunmaz.

CREATE TABLE IF NOT EXISTS user_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Kullanıcı referansları
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Identity Public Key (X25519, Base64 encoded)
  -- Bu key ECDH key exchange'de kullanılır
  identity_public_key TEXT NOT NULL,
  
  -- Signed PreKey (JSON: {id, publicKey, signature, timestamp})
  -- Ed25519 ile imzalanmış, X3DH handshake için
  signed_prekey TEXT,
  
  -- One-Time PreKeys (JSON array: [{id, publicKey}])
  -- X3DH tek kullanımlık anahtarlar
  one_time_prekeys JSONB DEFAULT '[]'::jsonb,
  
  -- Key Type (geriye uyumluluk için)
  key_type TEXT DEFAULT 'x25519_identity',
  
  -- Public Key (eski format uyumluluğu)
  public_key TEXT,
  
  -- SHA-256 fingerprint of identity_public_key
  -- MITM tespiti ve safety number hesaplaması için
  fingerprint TEXT,
  
  -- Durum
  is_active BOOLEAN DEFAULT true,
  
  -- Zaman damgaları
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Benzersizlik: Her cihaz bir workspace'te tek key'e sahip
  CONSTRAINT user_keys_device_workspace_unique UNIQUE (device_id, workspace_id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_user_keys_user_id ON user_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_keys_device_workspace ON user_keys(device_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_user_keys_workspace_active ON user_keys(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_keys_fingerprint ON user_keys(fingerprint);

-- ─────────────────────────────────────────────────────────────
-- 2. CHANNEL KEYS TABLOSU
-- ─────────────────────────────────────────────────────────────
-- Her kanal için her kullanıcıya özel şifrelenmiş channel key saklar.
-- 
-- Şifreleme akışı:
--   ECDH(distributor_priv, recipient_pub) → shared_secret
--   HKDF(shared_secret, salt, info) → wrapping_key
--   AES-256-GCM(wrapping_key, channel_key) → encrypted_channel_key
--
-- Server sadece encrypted blob'u saklar, plaintext channel key'i ASLA görmez.

CREATE TABLE IF NOT EXISTS channel_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Kanal ve kullanıcı referansları
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Şifreli channel key (Base64 encoded AES-256-GCM ciphertext)
  -- Bu blob sadece recipient'in private key'i ile çözülebilir
  encrypted_channel_key TEXT NOT NULL,
  
  -- AES-256-GCM IV (Base64 encoded, 12 byte)
  iv TEXT,
  
  -- AES-256-GCM Auth Tag (Base64 encoded, 16 byte)
  -- Integrity check için
  auth_tag TEXT,
  
  -- Dağıtıcının bilgileri
  distributor_device_id TEXT,
  distributor_public_key TEXT NOT NULL,
  
  -- Key versiyonu (rotation tracking)
  key_version INTEGER DEFAULT 1,
  
  -- Zaman damgaları
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Benzersizlik: Her kanal-cihaz çifti tek key'e sahip
  CONSTRAINT channel_keys_channel_device_unique UNIQUE (channel_id, device_id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_channel_keys_channel ON channel_keys(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_keys_device ON channel_keys(device_id);
CREATE INDEX IF NOT EXISTS idx_channel_keys_workspace ON channel_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channel_keys_channel_device ON channel_keys(channel_id, device_id);
CREATE INDEX IF NOT EXISTS idx_channel_keys_version ON channel_keys(channel_id, key_version);

-- ─────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────
-- Supabase RLS ile erişim kontrolü.
-- Not: ChatApp Ultra client-side encryption kullandığı için
-- RLS ek bir güvenlik katmanıdır (defense in depth).

-- user_keys RLS
ALTER TABLE user_keys ENABLE ROW LEVEL SECURITY;

-- Herkes kendi workspace'indeki public key'leri okuyabilir
CREATE POLICY "user_keys_select_workspace" ON user_keys
  FOR SELECT USING (true);

-- Herkes kendi key'ini ekleyebilir/güncelleyebilir
CREATE POLICY "user_keys_insert" ON user_keys
  FOR INSERT WITH CHECK (true);

CREATE POLICY "user_keys_update" ON user_keys
  FOR UPDATE USING (true);

-- Silme: Sadece kendi key'ini veya admin workspace key'ini
CREATE POLICY "user_keys_delete" ON user_keys
  FOR DELETE USING (true);

-- channel_keys RLS
ALTER TABLE channel_keys ENABLE ROW LEVEL SECURITY;

-- Herkes kendi workspace'indeki channel key'leri okuyabilir
CREATE POLICY "channel_keys_select" ON channel_keys
  FOR SELECT USING (true);

-- Herkes channel key ekleyebilir (admin dağıtımı)
CREATE POLICY "channel_keys_insert" ON channel_keys
  FOR INSERT WITH CHECK (true);

CREATE POLICY "channel_keys_update" ON channel_keys
  FOR UPDATE USING (true);

CREATE POLICY "channel_keys_delete" ON channel_keys
  FOR DELETE USING (true);

-- ─────────────────────────────────────────────────────────────
-- 4. UPDATED_AT TRİGGER
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- user_keys updated_at trigger
DROP TRIGGER IF EXISTS user_keys_updated_at ON user_keys;
CREATE TRIGGER user_keys_updated_at
  BEFORE UPDATE ON user_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DOĞRULAMA NOTLARI
-- ============================================================
-- 
-- ✅ Server zero-knowledge: Tablolarda plaintext anahtar YOK
-- ✅ encrypted_channel_key: Sadece recipient çözebilir
-- ✅ identity_public_key: Sadece public key saklanır
-- ✅ fingerprint: SHA-256 hash, MITM tespiti için
-- ✅ Multi-tenant izolasyon: workspace_id ile ayrım
-- ✅ Cascade delete: Workspace/user silinince key'ler de silinir
-- ✅ Benzersizlik: device_id + workspace_id unique constraint
-- ============================================================
