/**
 * ChatApp Ultra - Audit Log (Metadata Only)
 * Zero Knowledge uyumlu: İçerik loglanmaz, sadece metadata
 * Kim, ne zaman, hangi kanal, action type
 */

import { supabase } from './supabase';
import { storeEncryptedData, getEncryptedData } from './secureStore';

// ── Audit Action Types ──
export type AuditAction =
  | 'workspace_created'
  | 'workspace_joined'
  | 'user_removed'
  | 'user_left'
  | 'channel_created'
  | 'channel_deleted'
  | 'message_sent'
  | 'message_deleted'
  | 'file_uploaded'
  | 'key_rotated'
  | 'key_revoked'
  | 'session_started'
  | 'session_expired'
  | 'login_attempt'
  | 'login_success'
  | 'login_failed'
  | 'admin_action'
  | 'rules_updated'
  | 'invite_created'
  | 'invite_used'
  | 'call_started'
  | 'call_ended'
  | 'stt_used';

// ── Audit Log Entry ──
export interface AuditEntry {
  id: string;
  workspace_id: string;
  actor_device_id: string;
  actor_username: string;
  action: AuditAction;
  target_type?: 'user' | 'channel' | 'message' | 'key' | 'workspace' | 'invite';
  target_id?: string;
  metadata?: Record<string, string | number | boolean>; // Sadece non-sensitive metadata
  timestamp: number;
  ip_hash?: string; // IP'nin hash'i (gizlilik için)
}

// ── In-Memory Audit Buffer ──
// Performans için batch insert - her 10 entry veya 30 saniyede bir flush
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30_000;
let auditBuffer: Omit<AuditEntry, 'id'>[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

/**
 * IP adresini hash'le - gizlilik için
 * Gerçek IP saklanmaz, sadece hash'i
 */
async function hashIP(): Promise<string> {
  try {
    // Tarayıcıda gerçek IP'ye erişemeyiz, fingerprint olarak kullan
    const fingerprint = navigator.userAgent + screen.width + screen.height + new Date().getTimezoneOffset();
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprint);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'unknown';
  }
}

/**
 * Audit log entry ekle (buffer'a)
 * Zero Knowledge: İçerik asla loglanmaz
 */
export async function logAudit(
  workspaceId: string,
  actorDeviceId: string,
  actorUsername: string,
  action: AuditAction,
  options?: {
    targetType?: AuditEntry['target_type'];
    targetId?: string;
    metadata?: Record<string, string | number | boolean>;
  }
): Promise<void> {
  const ipHash = await hashIP();

  const entry: Omit<AuditEntry, 'id'> = {
    workspace_id: workspaceId,
    actor_device_id: actorDeviceId,
    actor_username: actorUsername,
    action,
    target_type: options?.targetType,
    target_id: options?.targetId,
    metadata: options?.metadata,
    timestamp: Date.now(),
    ip_hash: ipHash,
  };

  auditBuffer.push(entry);

  // Buffer doluysa flush et
  if (auditBuffer.length >= BATCH_SIZE) {
    await flushAuditBuffer();
  }

  // İlk entry'de timer başlat
  if (!flushTimer) {
    flushTimer = setInterval(flushAuditBuffer, FLUSH_INTERVAL_MS);
  }
}

const AUDIT_BACKUP_KEY = 'sentinel_audit_backup';
const AUDIT_BACKUP_MAX = 1000;

/**
 * Audit buffer'ı Supabase'e flush et
 * Hata durumunda buffer'ı IndexedDB'ye yedekle
 */
async function flushAuditBuffer(): Promise<void> {
  if (auditBuffer.length === 0) return;

  const batch = [...auditBuffer];
  auditBuffer = [];

  try {
    const { error } = await supabase.from('audit_logs').insert(
      batch.map(entry => ({
        workspace_id: entry.workspace_id,
        actor_device_id: entry.actor_device_id,
        actor_username: entry.actor_username,
        action: entry.action,
        target_type: entry.target_type || null,
        target_id: entry.target_id || null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        timestamp: entry.timestamp,
        ip_hash: entry.ip_hash || null,
      }))
    );

    if (error) {
      await backupToIndexedDB(batch);
    }
  } catch {
    await backupToIndexedDB(batch);
  }
}

/**
 * Audit log'ları IndexedDB'ye yedekle (device-bound şifreli)
 */
async function backupToIndexedDB(entries: Omit<AuditEntry, 'id'>[]): Promise<void> {
  try {
    const existing = await getEncryptedData<Omit<AuditEntry, 'id'>[]>(AUDIT_BACKUP_KEY) ?? [];
    const combined = [...existing, ...entries].slice(-AUDIT_BACKUP_MAX);
    await storeEncryptedData(AUDIT_BACKUP_KEY, combined);
  } catch {
    // IndexedDB erişilemiyorsa sessizce geç — audit kaybı kabul edilebilir
  }
}

/**
 * Audit log'ları getir (sadece admin)
 */
export async function getAuditLogs(
  workspaceId: string,
  options?: {
    limit?: number;
    offset?: number;
    action?: AuditAction;
    actorDeviceId?: string;
    startTime?: number;
    endTime?: number;
  }
): Promise<AuditEntry[]> {
  // Önce buffer'ı flush et
  await flushAuditBuffer();

  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('timestamp', { ascending: false });

  if (options?.action) {
    query = query.eq('action', options.action);
  }
  if (options?.actorDeviceId) {
    query = query.eq('actor_device_id', options.actorDeviceId);
  }
  if (options?.startTime) {
    query = query.gte('timestamp', options.startTime);
  }
  if (options?.endTime) {
    query = query.lte('timestamp', options.endTime);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    // Supabase'den alınamıyorsa IndexedDB backup'ından oku
    try {
      const backup = await getEncryptedData<Omit<AuditEntry, 'id'>[]>(AUDIT_BACKUP_KEY) ?? [];
      return backup
        .filter((e: Omit<AuditEntry, 'id'>) => e.workspace_id === workspaceId)
        .slice(0, options?.limit || 50)
        .map((e, i): AuditEntry => ({ ...e, id: `local-${e.timestamp}-${i}` }));
    } catch {
      return [];
    }
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    workspace_id: row.workspace_id as string,
    actor_device_id: row.actor_device_id as string,
    actor_username: row.actor_username as string,
    action: row.action as AuditAction,
    target_type: row.target_type as AuditEntry['target_type'],
    target_id: row.target_id as string | undefined,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    timestamp: row.timestamp as number,
    ip_hash: row.ip_hash as string | undefined,
  }));
}

/**
 * Audit log istatistikleri (admin dashboard için)
 */
export function getAuditStats(logs: AuditEntry[]): {
  totalActions: number;
  uniqueActors: number;
  actionBreakdown: Record<string, number>;
  recentActivity: AuditEntry[];
} {
  const actionBreakdown: Record<string, number> = {};
  const actors = new Set<string>();

  for (const log of logs) {
    actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
    actors.add(log.actor_device_id);
  }

  return {
    totalActions: logs.length,
    uniqueActors: actors.size,
    actionBreakdown,
    recentActivity: logs.slice(0, 10),
  };
}

/**
 * Cleanup: Timer'ı durdur ve buffer'ı flush et
 */
export async function cleanupAuditLog(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  await flushAuditBuffer();
}

/**
 * Audit action'ı Türkçe'ye çevir (UI için)
 */
export function getAuditActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    workspace_created: 'Ağ oluşturuldu',
    workspace_joined: 'Ağa katıldı',
    user_removed: 'Kullanıcı kovuldu',
    user_left: 'Kullanıcı ayrıldı',
    channel_created: 'Kanal oluşturuldu',
    channel_deleted: 'Kanal silindi',
    message_sent: 'Mesaj gönderildi',
    message_deleted: 'Mesaj silindi',
    file_uploaded: 'Dosya yüklendi',
    key_rotated: 'Anahtar yenilendi',
    key_revoked: 'Anahtar iptal edildi',
    session_started: 'Oturum başladı',
    session_expired: 'Oturum sona erdi',
    login_attempt: 'Giriş denemesi',
    login_success: 'Giriş başarılı',
    login_failed: 'Giriş başarısız',
    admin_action: 'Yönetici işlemi',
    rules_updated: 'Kurallar güncellendi',
    invite_created: 'Davet kodu oluşturuldu',
    invite_used: 'Davet kodu kullanıldı',
    call_started: 'Arama başladı',
    call_ended: 'Arama sonlandı',
    stt_used: 'Sesli yazma kullanıldı',
  };
  return labels[action] || action;
}
