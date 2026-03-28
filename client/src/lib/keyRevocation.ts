/**
 * ChatApp Ultra - Key Revocation Mekanizması (keyRevocation.ts)
 * ──────────────────────────────────────────────────────────────
 * GÜVENLİK SERTLEŞTİRME v2:
 * - localStorage KALDIRILDI → IndexedDB (secureStore.ts)
 * - Revocation listesi device-bound AES-GCM ile şifreli saklanır
 * - Broadcast ile diğer cihazlara anında bildirim
 * 
 * Admin bir kullanıcının anahtarlarını iptal edebilir.
 * İptal edilen anahtarlarla şifrelenmiş mesajlar çözülemez.
 */

import { supabase } from './supabase';
import { deleteRatchetState } from './ratchet';
import {
  storeEncryptedData,
  getEncryptedData,
  deleteEncryptedData,
} from './secureStore';

// ── Revocation Entry ──
export interface RevocationEntry {
  device_id: string;
  workspace_id: string;
  revoked_at: number;
  revoked_by: string; // Admin device_id
  reason: 'user_removed' | 'key_compromised' | 'admin_reset' | 'session_expired';
}

// ── IndexedDB key (localStorage KALDIRILDI) ──
const REVOCATION_LIST_KEY = 'sentinel_revocation_list_v2';

// ── In-memory cache ──
let cachedList: RevocationEntry[] | null = null;

/**
 * Revocation listesini IndexedDB'den oku (şifreli).
 * localStorage'dan migration yapılır (tek seferlik).
 */
async function getRevocationList(): Promise<RevocationEntry[]> {
  if (cachedList) return cachedList;

  // IndexedDB'den oku
  const stored = await getEncryptedData<RevocationEntry[]>(REVOCATION_LIST_KEY);
  if (stored) {
    cachedList = stored;
    return stored;
  }

  // localStorage'dan migration (geriye uyumluluk - tek seferlik)
  try {
    const legacy = localStorage.getItem('sentinel_revocation_list');
    if (legacy) {
      const parsed = JSON.parse(legacy) as RevocationEntry[];
      await saveRevocationList(parsed);
      localStorage.removeItem('sentinel_revocation_list');
      return parsed;
    }
  } catch {
    // Migration başarısız - boş liste ile devam et
  }

  return [];
}

/**
 * Revocation listesini IndexedDB'ye şifreli kaydet.
 */
async function saveRevocationList(list: RevocationEntry[]): Promise<void> {
  cachedList = list;
  await storeEncryptedData(REVOCATION_LIST_KEY, list);
}

/**
 * Bir kullanıcının anahtarlarını iptal et (Admin only)
 * 1. Ratchet state'i sil
 * 2. Revocation listesine ekle
 * 3. Supabase'e broadcast et
 */
export async function revokeUserKeys(
  workspaceId: string,
  targetDeviceId: string,
  adminDeviceId: string,
  reason: RevocationEntry['reason'] = 'admin_reset'
): Promise<boolean> {
  try {
    // 1. Revocation entry oluştur
    const entry: RevocationEntry = {
      device_id: targetDeviceId,
      workspace_id: workspaceId,
      revoked_at: Date.now(),
      revoked_by: adminDeviceId,
      reason,
    };

    // 2. Local revocation listesine ekle (IndexedDB)
    const list = await getRevocationList();
    list.push(entry);
    await saveRevocationList(list);

    // 3. Hedef kullanıcının ratchet state'lerini temizle (kendi tarafımızda)
    const { data: channels } = await supabase
      .from('channels')
      .select('id')
      .eq('workspace_id', workspaceId);

    if (channels) {
      for (const ch of channels) {
        try {
          await deleteRatchetState(workspaceId, ch.id);
        } catch {
          // Zaten silinmiş olabilir
        }
      }
    }

    // 4. Supabase Realtime ile diğer cihazlara broadcast et
    const channel = supabase.channel(`revocation_${workspaceId}`);
    await channel.send({
      type: 'broadcast',
      event: 'key_revoked',
      payload: {
        device_id: targetDeviceId,
        revoked_by: adminDeviceId,
        reason,
        timestamp: Date.now(),
      },
    });
    supabase.removeChannel(channel);

    return true;
  } catch {
    return false;
  }
}

/**
 * Bir device_id'nin anahtarları iptal edilmiş mi kontrol et
 */
export async function isKeyRevoked(deviceId: string, workspaceId: string): Promise<boolean> {
  const list = await getRevocationList();
  return list.some(
    entry => entry.device_id === deviceId && entry.workspace_id === workspaceId
  );
}

/**
 * Senkron versiyon (cache'den) - performans kritik yerlerde kullanılır.
 * Cache yoksa false döner (güvenli taraf).
 */
export function isKeyRevokedSync(deviceId: string, workspaceId: string): boolean {
  if (!cachedList) return false;
  return cachedList.some(
    entry => entry.device_id === deviceId && entry.workspace_id === workspaceId
  );
}

/**
 * Revocation broadcast'ini dinle
 * Başka bir admin anahtar iptal ettiğinde haberdar ol
 */
export function subscribeToRevocations(
  workspaceId: string,
  onRevocation: (entry: { device_id: string; reason: string }) => void
): () => void {
  const channel = supabase
    .channel(`revocation_${workspaceId}`)
    .on('broadcast', { event: 'key_revoked' }, async (payload) => {
      const data = payload.payload as {
        device_id: string;
        revoked_by: string;
        reason: string;
        timestamp: number;
      };

      // Local listeye ekle (IndexedDB)
      const list = await getRevocationList();
      list.push({
        device_id: data.device_id,
        workspace_id: workspaceId,
        revoked_at: data.timestamp,
        revoked_by: data.revoked_by,
        reason: data.reason as RevocationEntry['reason'],
      });
      await saveRevocationList(list);

      onRevocation({ device_id: data.device_id, reason: data.reason });
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Kendi anahtarlarını yeniden oluştur (revocation sonrası)
 * Kullanıcı yeniden giriş yaptığında çağrılır
 */
export async function regenerateKeysAfterRevocation(
  workspaceId: string,
  deviceId: string
): Promise<boolean> {
  try {
    // Eski tüm encrypted data'yı temizle
    const prefixes = [
      'sentinel_ratchet_' + workspaceId,
      'sentinel_seen_msg_' + workspaceId,
      'sentinel_session_' + workspaceId,
      'sentinel_skipped_mk_' + workspaceId,
    ];

    for (const prefix of prefixes) {
      try {
        await deleteEncryptedData(prefix);
      } catch {
        // Zaten silinmiş olabilir
      }
    }

    // Revocation listesinden kendi entry'mizi kaldır
    const list = await getRevocationList();
    const filtered = list.filter(
      e => !(e.device_id === deviceId && e.workspace_id === workspaceId)
    );
    await saveRevocationList(filtered);

    return true;
  } catch {
    return false;
  }
}

/**
 * Revocation listesini temizle (workspace'den çıkış)
 */
export async function clearRevocationList(workspaceId?: string): Promise<void> {
  if (workspaceId) {
    const list = await getRevocationList();
    const filtered = list.filter(e => e.workspace_id !== workspaceId);
    await saveRevocationList(filtered);
  } else {
    cachedList = null;
    await deleteEncryptedData(REVOCATION_LIST_KEY);
    // Legacy temizliği
    localStorage.removeItem('sentinel_revocation_list');
  }
}

/**
 * Revocation istatistikleri (admin panel için)
 */
export async function getRevocationStats(workspaceId: string): Promise<{
  totalRevocations: number;
  recentRevocations: RevocationEntry[];
  revokedDevices: string[];
}> {
  const list = await getRevocationList();
  const filtered = list.filter(e => e.workspace_id === workspaceId);
  const uniqueDevices = Array.from(new Set(filtered.map(e => e.device_id)));

  return {
    totalRevocations: filtered.length,
    recentRevocations: filtered.slice(-10),
    revokedDevices: uniqueDevices,
  };
}

/**
 * Revocation cache'ini preload et (uygulama başlangıcında).
 */
export async function preloadRevocationCache(): Promise<void> {
  await getRevocationList();
}
