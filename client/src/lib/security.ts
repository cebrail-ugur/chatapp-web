/**
 * ChatApp Ultra - Güvenlik Modülü
 * XSS koruması, input doğrulama, session güvenliği
 * OWASP standartlarına uygun güvenlik katmanları
 */

/**
 * XSS koruması - HTML etiketlerini temizle
 * Kullanıcı girdilerinde zararlı HTML/JS kodlarını engeller
 */
export function sanitizeHTML(input: string): string {
  if (!input) return '';
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * URL doğrulama - sadece güvenli protokollere izin ver
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['https:', 'http:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Dosya türü doğrulama
 * İzin verilen MIME türleri ve uzantılar
 */
const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  // NOT: image/svg+xml kaldırıldı - SVG içinde JS çalıştırılabilir (XSS riski)
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'application/x-zip-compressed'
];

const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.vbs', '.js',
  '.ws', '.wsf', '.wsc', '.wsh', '.ps1', '.ps2', '.psc1', '.psc2',
  '.reg', '.inf', '.lnk', '.dll', '.sys'
];

export function isAllowedFile(file: File): { allowed: boolean; reason?: string } {
  // Check extension
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { allowed: false, reason: `${ext} dosya uzantısı güvenlik nedeniyle engellendi` };
  }
  
  // Check MIME type
  if (!ALLOWED_FILE_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    return { allowed: false, reason: 'Bu dosya türü desteklenmiyor' };
  }

  // SVG dosyalarını engelle (içinde JS çalıştırılabilir)
  if (file.type === 'image/svg+xml' || ext === '.svg') {
    return { allowed: false, reason: 'SVG dosyaları güvenlik nedeniyle desteklenmiyor' };
  }

  // MIME type spoofing kontrolü: uzantı ile MIME type uyumlu mu?
  const mimeExtMap: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
  };
  const expectedExts = mimeExtMap[file.type];
  if (expectedExts && !expectedExts.includes(ext)) {
    return { allowed: false, reason: 'Dosya uzantısı ile türü uyuşmuyor' };
  }
  
  // Check file size (25MB max)
  if (file.size > 25 * 1024 * 1024) {
    return { allowed: false, reason: 'Dosya boyutu 25MB\'dan büyük olamaz' };
  }
  
  return { allowed: true };
}

/**
 * Mesaj uzunluğu doğrulama
 */
export function validateMessage(text: string): { valid: boolean; reason?: string } {
  if (!text || !text.trim()) {
    return { valid: false, reason: 'Mesaj boş olamaz' };
  }
  if (text.length > 5000) {
    return { valid: false, reason: 'Mesaj 5000 karakterden uzun olamaz' };
  }
  return { valid: true };
}

/**
 * Davet kodu doğrulama
 */
export function validateInviteCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code.toUpperCase().trim());
}

/**
 * Kullanıcı adı doğrulama
 */
export function validateUsername(name: string): { valid: boolean; reason?: string } {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, reason: 'İsim en az 2 karakter olmalıdır' };
  }
  if (trimmed.length > 30) {
    return { valid: false, reason: 'İsim 30 karakterden uzun olamaz' };
  }
  // No HTML/script injection
  if (/<[^>]*>/.test(trimmed)) {
    return { valid: false, reason: 'İsimde HTML etiketleri kullanılamaz' };
  }
  return { valid: true };
}

/**
 * Şifre güçlülük kontrolü
 */
export function validatePassword(password: string): { valid: boolean; strength: 'weak' | 'medium' | 'strong'; reason?: string } {
  if (password.length < 4) {
    return { valid: false, strength: 'weak', reason: 'Şifre en az 4 karakter olmalıdır' };
  }
  
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  if (score <= 1) return { valid: true, strength: 'weak' };
  if (score <= 2) return { valid: true, strength: 'medium' };
  return { valid: true, strength: 'strong' };
}

/**
 * Zaman dilimi algılama
 */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Zaman formatlama - kullanıcının yerel saat dilimine göre
 */
export function formatTime(timestamp: number, locale: string = 'tr-TR'): string {
  try {
    return new Date(timestamp).toLocaleTimeString(locale, { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: detectTimezone()
    });
  } catch {
    return new Date(timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Son görülme formatlama
 */
export function formatLastSeen(timestamp: number, locale: string = 'tr-TR'): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return locale.startsWith('tr') ? 'Az önce' : 'Just now';
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return locale.startsWith('tr') ? `${mins} dk önce` : `${mins}m ago`;
  }
  if (diff < 86400000) {
    return new Date(timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  return new Date(timestamp).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/**
 * Brute force koruması - login denemelerini sınırla
 */
class LoginAttemptTracker {
  private attempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private maxAttempts = 5;
  private lockoutMs = 300000; // 5 dakika

  canAttempt(key: string): boolean {
    const record = this.attempts.get(key);
    if (!record) return true;
    
    if (Date.now() - record.lastAttempt > this.lockoutMs) {
      this.attempts.delete(key);
      return true;
    }
    
    return record.count < this.maxAttempts;
  }

  recordAttempt(key: string): void {
    const record = this.attempts.get(key);
    if (record) {
      record.count++;
      record.lastAttempt = Date.now();
    } else {
      this.attempts.set(key, { count: 1, lastAttempt: Date.now() });
    }
  }

  recordSuccess(key: string): void {
    this.attempts.delete(key);
  }

  getRemainingTime(key: string): number {
    const record = this.attempts.get(key);
    if (!record) return 0;
    const remaining = this.lockoutMs - (Date.now() - record.lastAttempt);
    return Math.max(0, remaining);
  }
}

export const loginTracker = new LoginAttemptTracker();
