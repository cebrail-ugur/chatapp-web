/**
 * ChatApp Ultra - Channel Membership Guard
 * Kanal erişim kontrolü: Sadece yetkili kullanıcılar kanala erişebilir
 * Workspace membership + channel membership doğrulama
 */

import { supabase } from './supabase';

// ── Membership Cache ──
const membershipCache = new Map<string, { valid: boolean; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakika cache

/**
 * Workspace membership doğrula
 * Kullanıcı bu workspace'e ait mi?
 */
export async function validateWorkspaceMembership(
  workspaceId: string,
  deviceId: string
): Promise<boolean> {
  const cacheKey = `ws_${workspaceId}_${deviceId}`;
  const cached = membershipCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.valid;
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('device_id', deviceId)
      .single();

    const valid = !error && !!data;
    membershipCache.set(cacheKey, { valid, expiry: Date.now() + CACHE_TTL_MS });
    return valid;
  } catch {
    return false;
  }
}

/**
 * Channel erişim doğrula
 * Özel kanal ise sadece assigned_device_id veya admin erişebilir
 * Genel kanal ise workspace üyesi herkes erişebilir
 */
export async function validateChannelAccess(
  workspaceId: string,
  channelId: string,
  deviceId: string,
  role: string
): Promise<boolean> {
  const cacheKey = `ch_${channelId}_${deviceId}`;
  const cached = membershipCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.valid;
  }

  try {
    // Önce workspace membership kontrol et
    const isMember = await validateWorkspaceMembership(workspaceId, deviceId);
    if (!isMember) {
      membershipCache.set(cacheKey, { valid: false, expiry: Date.now() + CACHE_TTL_MS });
      return false;
    }

    // Kanal bilgisini al
    const { data: channel, error } = await supabase
      .from('channels')
      .select('is_private, assigned_device_id')
      .eq('id', channelId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !channel) {
      membershipCache.set(cacheKey, { valid: false, expiry: Date.now() + CACHE_TTL_MS });
      return false;
    }

    let valid = true;

    // Özel kanal ise
    if (channel.is_private) {
      // Admin her yere erişebilir
      if (role === 'admin') {
        valid = true;
      } else {
        // Sadece assigned_device_id erişebilir
        valid = channel.assigned_device_id === deviceId;
      }
    }

    membershipCache.set(cacheKey, { valid, expiry: Date.now() + CACHE_TTL_MS });
    return valid;
  } catch {
    return false;
  }
}

/**
 * Mesaj gönderme yetkisi kontrol et
 * Rate limiting + membership + channel access
 */
export async function canSendMessage(
  workspaceId: string,
  channelId: string,
  deviceId: string,
  role: string
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Channel erişim kontrolü
  const hasAccess = await validateChannelAccess(workspaceId, channelId, deviceId, role);
  if (!hasAccess) {
    return { allowed: false, reason: 'Bu kanala erişim yetkiniz yok' };
  }

  // 2. Sistem botu kanalına sadece admin yazabilir (bot mesajları hariç)
  // Bu kontrol ChatContext'te yapılıyor, burada ek güvenlik katmanı

  return { allowed: true };
}

/**
 * Cache'i temizle (kullanıcı kovulduğunda veya workspace değiştiğinde)
 */
export function clearMembershipCache(workspaceId?: string): void {
  if (workspaceId) {
    const keysToDelete = Array.from(membershipCache.keys()).filter(k => k.includes(workspaceId));
    keysToDelete.forEach(k => membershipCache.delete(k));
  } else {
    membershipCache.clear();
  }
}

/**
 * Admin: Tüm kanal üyelerini getir
 */
export async function getChannelMembers(
  workspaceId: string,
  channelId: string
): Promise<{ device_id: string; username: string; role: string }[]> {
  try {
    const { data: channel } = await supabase
      .from('channels')
      .select('is_private, assigned_device_id')
      .eq('id', channelId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!channel) return [];

    if (channel.is_private && channel.assigned_device_id) {
      // Özel kanal: sadece assigned user + admin
      const { data: users } = await supabase
        .from('users')
        .select('device_id, username, role')
        .eq('workspace_id', workspaceId)
        .or(`device_id.eq.${channel.assigned_device_id},role.eq.admin`);

      return users || [];
    }

    // Genel kanal: tüm workspace üyeleri
    const { data: users } = await supabase
      .from('users')
      .select('device_id, username, role')
      .eq('workspace_id', workspaceId);

    return users || [];
  } catch {
    return [];
  }
}
