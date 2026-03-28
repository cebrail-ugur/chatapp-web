/**
 * LoginScreen - ChatApp Ultra Güvenli Giriş Ekranı
 * WhatsApp Evolved dark theme, glassmorphism card
 * Uluslararası dil desteği, güvenlik göstergeleri
 */

import { useState } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Plus, LogIn, Lock, Users, Loader2, Globe, ShieldCheck, Fingerprint } from 'lucide-react';
import { toast } from 'sonner';
import { type Language, languageNames } from '@/lib/i18n';
import { validateUsername, validatePassword, validateInviteCode, loginTracker } from '@/lib/security';
import { requireSecureContext } from '@/lib/keyManager';

const LOGIN_BG = 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80';

export default function LoginScreen() {
  const { createWorkspace, joinWorkspace } = useChatContext();
  const { t, language, changeLanguage } = useLanguage();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create form
  const [wsName, setWsName] = useState('');
  const [wsPassword, setWsPassword] = useState('');
  const [wsMaxUsers, setWsMaxUsers] = useState(50);
  const [adminName, setAdminName] = useState('');

  // Join form
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinBio, setJoinBio] = useState('');

  const handleCreate = async () => {
    if (!wsName.trim() || !wsPassword.trim() || !adminName.trim()) {
      toast.error(t.fillAllFields);
      return;
    }
    const nameCheck = validateUsername(adminName);
    if (!nameCheck.valid) {
      toast.error(nameCheck.reason);
      return;
    }
    const passCheck = validatePassword(wsPassword);
    if (!passCheck.valid) {
      toast.error(passCheck.reason);
      return;
    }
    if (passCheck.strength === 'weak') {
      toast.warning('Şifreniz zayıf. Daha güçlü bir şifre önerilir.');
    }
    setLoading(true);
    try {
      requireSecureContext();
      await createWorkspace(wsName, wsPassword, wsMaxUsers, adminName);
      toast.success(t.workspaceCreated);
      setShowCreate(false);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !joinName.trim()) {
      toast.error(t.fillAllFields);
      return;
    }
    if (!validateInviteCode(joinCode)) {
      toast.error('Davet kodu 6 haneli olmalıdır');
      return;
    }
    const nameCheck = validateUsername(joinName);
    if (!nameCheck.valid) {
      toast.error(nameCheck.reason);
      return;
    }
    if (!loginTracker.canAttempt('join')) {
      const remaining = Math.ceil(loginTracker.getRemainingTime('join') / 60000);
      toast.error(`Çok fazla deneme. ${remaining} dakika bekleyin.`);
      return;
    }
    setLoading(true);
    try {
      requireSecureContext();
      await joinWorkspace(joinCode, joinName, joinBio);
      toast.success(t.joinedWorkspace);
      setShowJoin(false);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b141a] via-[#111b21] to-[#0d1f2d]" />
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: `url(${LOGIN_BG})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00a884]/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#00a884]/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <Select value={language} onValueChange={(v) => changeLanguage(v as Language)}>
          <SelectTrigger className="w-36 bg-white/5 border-white/10 text-white/80 h-9 rounded-lg text-xs backdrop-blur-sm">
            <Globe className="w-3.5 h-3.5 mr-1.5 text-[#00a884]" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1f2c34] border-white/10 text-white">
            {(Object.keys(languageNames) as Language[]).map(lang => (
              <SelectItem key={lang} value={lang}>{languageNames[lang]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-[#1f2c34]/80 backdrop-blur-xl rounded-2xl border border-white/5 p-8 shadow-2xl shadow-black/40">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00a884] to-[#008f72] flex items-center justify-center mb-4 shadow-lg shadow-[#00a884]/20 relative">
              <Shield className="w-10 h-10 text-white" />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#00a884] rounded-full flex items-center justify-center border-2 border-[#1f2c34]">
                <ShieldCheck className="w-3 h-3 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white font-[Noto_Sans]">{t.appName}</h1>
            <p className="text-[#8696a0] text-sm mt-1 text-center">{t.appSubtitle}</p>
          </div>

          {/* Security Badges */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex items-center gap-1.5 bg-[#00a884]/10 text-[#00a884] px-3 py-1.5 rounded-full text-[10px] font-medium">
              <Lock className="w-3 h-3" />
              <span>AES-256</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#00a884]/10 text-[#00a884] px-3 py-1.5 rounded-full text-[10px] font-medium">
              <ShieldCheck className="w-3 h-3" />
              <span>E2EE</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#00a884]/10 text-[#00a884] px-3 py-1.5 rounded-full text-[10px] font-medium">
              <Fingerprint className="w-3 h-3" />
              <span>HMAC</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => setShowCreate(true)}
              className="w-full h-12 bg-[#00a884] hover:bg-[#00a884]/90 text-white font-semibold rounded-xl text-base transition-all duration-200 hover:shadow-lg hover:shadow-[#00a884]/20 hover:scale-[1.01]"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t.createWorkspace}
            </Button>
            <Button
              onClick={() => setShowJoin(true)}
              variant="outline"
              className="w-full h-12 border-[#00a884]/30 text-[#00a884] hover:bg-[#00a884]/10 rounded-xl text-base transition-all duration-200 hover:scale-[1.01]"
            >
              <LogIn className="w-5 h-5 mr-2" />
              {t.joinWorkspace}
            </Button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-4 mt-8 text-[#8696a0] text-xs">
            <div className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>{t.e2eEncrypted}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-[#8696a0]/30" />
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>{t.ultraSecure}</span>
            </div>
          </div>

          {/* GDPR/KVKK Notice */}
          <p className="text-center text-[#8696a0]/50 text-[10px] mt-4">
            GDPR / KVKK Uyumlu • {t.privacyPolicy}
          </p>
        </div>
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#1f2c34] border-white/5 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#00a884]" />
              {t.createWorkspace}
            </DialogTitle>
            <DialogDescription className="text-[#8696a0] text-sm">
              Yeni bir güvenli workspace oluşturun. Tüm mesajlar AES-256 ile şifrelenir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-[#8696a0] text-xs uppercase tracking-wider mb-2 block">{t.workspaceName}</Label>
              <Input value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder={t.workspaceNamePlaceholder}
                className="bg-[#2a3942] border-none text-white placeholder:text-[#8696a0]/50 h-11 rounded-xl focus-visible:ring-[#00a884]" />
            </div>
            <div>
              <Label className="text-[#8696a0] text-xs uppercase tracking-wider mb-2 block">{t.adminPassword}</Label>
              <Input type="password" value={wsPassword} onChange={(e) => setWsPassword(e.target.value)} placeholder={t.adminPasswordPlaceholder}
                className="bg-[#2a3942] border-none text-white placeholder:text-[#8696a0]/50 h-11 rounded-xl focus-visible:ring-[#00a884]" />
            </div>
            <div>
              <Label className="text-[#8696a0] text-xs uppercase tracking-wider mb-2 block">{t.maxUsers}</Label>
              <Input type="number" value={wsMaxUsers} onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (isNaN(val)) { setWsMaxUsers(2); return; }
                setWsMaxUsers(Math.min(500, Math.max(2, val)));
              }} min={2} max={500}
                className="bg-[#2a3942] border-none text-white placeholder:text-[#8696a0]/50 h-11 rounded-xl focus-visible:ring-[#00a884]" />
            </div>
            <div>
              <Label className="text-[#8696a0] text-xs uppercase tracking-wider mb-2 block">{t.adminName}</Label>
              <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder={t.adminNamePlaceholder}
                className="bg-[#2a3942] border-none text-white placeholder:text-[#8696a0]/50 h-11 rounded-xl focus-visible:ring-[#00a884]" />
            </div>
            <Button onClick={handleCreate} disabled={loading}
              className="w-full h-12 bg-[#00a884] hover:bg-[#00a884]/90 text-white font-semibold rounded-xl text-base mt-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.createWorkspace}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Workspace Dialog */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="bg-[#1f2c34] border-white/5 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <LogIn className="w-5 h-5 text-[#00a884]" />
              {t.joinWorkspace}
            </DialogTitle>
            <DialogDescription className="text-[#8696a0] text-sm">
              Davet kodu ile mevcut bir workspace'e katılın.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-[#8696a0] text-xs uppercase tracking-wider mb-2 block">{t.inviteCode}</Label>
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder={t.inviteCodePlaceholder}
                className="bg-[#2a3942] border-none text-white placeholder:text-[#8696a0]/50 h-11 rounded-xl focus-visible:ring-[#00a884] uppercase tracking-widest text-center text-lg font-mono" 
                maxLength={6} />
            </div>
            <div>
              <Label className="text-[#8696a0] text-xs uppercase tracking-wider mb-2 block">{t.yourName}</Label>
              <Input value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder={t.yourNamePlaceholder}
                className="bg-[#2a3942] border-none text-white placeholder:text-[#8696a0]/50 h-11 rounded-xl focus-visible:ring-[#00a884]" />
            </div>
            <div>
              <Label className="text-[#8696a0] text-xs uppercase tracking-wider mb-2 block">{t.aboutMe} (Opsiyonel)</Label>
              <Input value={joinBio} onChange={(e) => setJoinBio(e.target.value)} placeholder={t.aboutMePlaceholder}
                className="bg-[#2a3942] border-none text-white placeholder:text-[#8696a0]/50 h-11 rounded-xl focus-visible:ring-[#00a884]" />
            </div>
            <Button onClick={handleJoin} disabled={loading}
              className="w-full h-12 bg-[#00a884] hover:bg-[#00a884]/90 text-white font-semibold rounded-xl text-base mt-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.join}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
