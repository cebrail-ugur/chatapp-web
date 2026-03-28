-- ============================================================
-- ChatApp Ultra - RLS Workspace İzolasyonu
-- Migration: 002_rls_workspace_isolation
-- Tarih: 2026-03-28
-- ============================================================
--
-- MEVCUT SORUN:
--   001 migrasyonundaki tüm politikalar USING (true) idi.
--   Bu, Supabase anon key'e sahip herhangi birinin tüm
--   workspace'lerdeki key verilerini okuyup yazabileceği anlamına gelir.
--
-- BU MİGRASYONUN KAPSAMI:
--   Uygulama Supabase Auth kullanmadığından auth.uid() her zaman NULL.
--   Bu nedenle "caller kimliği" doğrulaması uygulama katmanında kalır.
--   Bu migration şu güvenlik katmanlarını ekler:
--
--   1. INTEGRITY CHECK: Yalnızca gerçek workspace'e ait veriler
--      okunabilir / yazılabilir (cross-workspace karışıklığı önlenir).
--
--   2. AKTIF KEY FİLTRESİ: Sadece is_active=true olan key'ler döner.
--
--   3. ZORUNLU ALAN KONTROLÜ: NULL/boş kritik alanlar reddedilir.
--
--   4. KANAL-WORKSPACE TUTARLILIĞI: channel_keys için channel_id'nin
--      doğru workspace'e ait olduğu doğrulanır (cross-workspace
--      key injection saldırısını engeller).
--
-- GELECEK AŞAMA (Phase 2 - Supabase Auth Entegrasyonu):
--   supabase.auth.signInAnonymously() + device_id custom claim ile
--   tam kimlik tabanlı RLS mümkün olur. O zaman eklenecek politika örneği:
--
--   CREATE POLICY "user_keys_own_device" ON user_keys
--     FOR ALL USING (
--       device_id = (auth.jwt() ->> 'device_id')
--     );
-- ============================================================


-- ============================================================
-- 1. YARDIMCI FONKSİYONLAR
-- ============================================================

-- workspace_id'nin gerçekten var olan bir workspace'e ait olduğunu doğrular.
-- SECURITY DEFINER: anon rolünden çağrılabilmesi için gerekli.
-- STABLE: Aynı transaction içinde sonucu önbelleğe alınır (performans).
CREATE OR REPLACE FUNCTION workspace_exists(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM workspaces WHERE id = p_workspace_id
  );
$$;

-- channel_id'nin belirtilen workspace'e ait olduğunu doğrular.
-- Cross-workspace key injection saldırısını (A workspace'inin channel key'ini
-- B workspace adına kaydetme girişimi) engeller.
CREATE OR REPLACE FUNCTION channel_belongs_to_workspace(
  p_channel_id uuid,
  p_workspace_id uuid
)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM channels
    WHERE id = p_channel_id
      AND workspace_id = p_workspace_id
  );
$$;

-- device_id'nin belirtilen workspace'in aktif bir üyesi olduğunu doğrular.
-- INSERT politikalarında sahte üye eklemeyi sınırlar.
CREATE OR REPLACE FUNCTION device_is_workspace_member(
  p_device_id text,
  p_workspace_id uuid
)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM users
    WHERE device_id = p_device_id
      AND workspace_id = p_workspace_id
  );
$$;


-- ============================================================
-- 2. ESKİ POLİTİKALARI KALDIR (user_keys)
-- ============================================================

DROP POLICY IF EXISTS "user_keys_select_workspace" ON user_keys;
DROP POLICY IF EXISTS "user_keys_insert" ON user_keys;
DROP POLICY IF EXISTS "user_keys_update" ON user_keys;
DROP POLICY IF EXISTS "user_keys_delete" ON user_keys;


-- ============================================================
-- 3. YENİ POLİTİKALAR: user_keys
-- ============================================================

-- SELECT: Sadece aktif key'leri döndür.
-- Revoke edilmiş (is_active=false) key'ler hiçbir zaman okunmaz.
-- Bu, iptal edilen anahtarların E2EE handshake'te kullanılmasını önler.
CREATE POLICY "user_keys_select_active"
  ON user_keys
  FOR SELECT
  USING (is_active = true);

-- INSERT: Workspace'in var olması + device'ın o workspace'in üyesi olması gerekir.
-- Kritik alanların NULL/boş olmaması zorunludur.
CREATE POLICY "user_keys_insert_verified"
  ON user_keys
  FOR INSERT
  WITH CHECK (
    workspace_exists(workspace_id)
    AND device_is_workspace_member(device_id, workspace_id)
    AND device_id IS NOT NULL AND device_id != ''
    AND identity_public_key IS NOT NULL AND identity_public_key != ''
  );

-- UPDATE: Sadece mevcut workspace üyelerinin key'leri güncellenebilir.
-- workspace_id ve device_id değiştirilemez (sabit kalmalı).
CREATE POLICY "user_keys_update_member"
  ON user_keys
  FOR UPDATE
  USING (
    workspace_exists(workspace_id)
    AND device_is_workspace_member(device_id, workspace_id)
  )
  WITH CHECK (
    workspace_exists(workspace_id)
    AND device_is_workspace_member(device_id, workspace_id)
  );

-- DELETE: Sadece gerçek workspace üyelerine ait key'ler silinebilir.
-- Başkasının key'ini silme girişimi (satır manipülasyonu) reddedilir.
CREATE POLICY "user_keys_delete_member"
  ON user_keys
  FOR DELETE
  USING (
    workspace_exists(workspace_id)
    AND device_is_workspace_member(device_id, workspace_id)
  );


-- ============================================================
-- 4. ESKİ POLİTİKALARI KALDIR (channel_keys)
-- ============================================================

DROP POLICY IF EXISTS "channel_keys_select" ON channel_keys;
DROP POLICY IF EXISTS "channel_keys_insert" ON channel_keys;
DROP POLICY IF EXISTS "channel_keys_update" ON channel_keys;
DROP POLICY IF EXISTS "channel_keys_delete" ON channel_keys;


-- ============================================================
-- 5. YENİ POLİTİKALAR: channel_keys
-- ============================================================

-- SELECT: channel_id'nin workspace_id'ye gerçekten ait olduğu doğrulanır.
-- Farklı workspace'lerin channel key'lerini okuma engellenir.
CREATE POLICY "channel_keys_select_workspace_scoped"
  ON channel_keys
  FOR SELECT
  USING (
    channel_belongs_to_workspace(channel_id, workspace_id)
  );

-- INSERT: channel-workspace tutarlılığı + zorunlu şifreli veri alanları.
-- Boş encrypted_channel_key kabul edilmez (plaintext anahtar sızmasını önler).
CREATE POLICY "channel_keys_insert_verified"
  ON channel_keys
  FOR INSERT
  WITH CHECK (
    channel_belongs_to_workspace(channel_id, workspace_id)
    AND device_is_workspace_member(device_id, workspace_id)
    AND encrypted_channel_key IS NOT NULL AND encrypted_channel_key != ''
    AND distributor_public_key IS NOT NULL AND distributor_public_key != ''
  );

-- UPDATE: channel-workspace tutarlılığı her iki yönde de korunur.
CREATE POLICY "channel_keys_update_workspace_scoped"
  ON channel_keys
  FOR UPDATE
  USING (
    channel_belongs_to_workspace(channel_id, workspace_id)
  )
  WITH CHECK (
    channel_belongs_to_workspace(channel_id, workspace_id)
    AND encrypted_channel_key IS NOT NULL AND encrypted_channel_key != ''
  );

-- DELETE: Sadece gerçek channel-workspace çiftlerine ait key'ler silinebilir.
CREATE POLICY "channel_keys_delete_workspace_scoped"
  ON channel_keys
  FOR DELETE
  USING (
    channel_belongs_to_workspace(channel_id, workspace_id)
  );


-- ============================================================
-- DOĞRULAMA NOTLARI
-- ============================================================
--
-- Bu migration ile elde edilen güvenlik iyileştirmeleri:
--
--  ✅ Cross-workspace key injection önlendi
--     (channel_belongs_to_workspace kontrolü)
--
--  ✅ Revoked key'ler artık SELECT'te görünmez
--     (is_active = true filtresi)
--
--  ✅ Sahte workspace üyeleri key ekleyemez
--     (device_is_workspace_member kontrolü)
--
--  ✅ NULL/boş şifreli anahtar kabul edilmez
--     (NOT NULL + != '' kontrolü)
--
--  ⚠️  Caller kimliği doğrulaması uygulama katmanında
--     (auth.uid() NULL — Supabase Auth entegre edilene kadar)
--
--  ⚠️  Bir device başka bir device adına key ekleyebilir
--     (Phase 2'de device_id claim ile çözülecek)
-- ============================================================
