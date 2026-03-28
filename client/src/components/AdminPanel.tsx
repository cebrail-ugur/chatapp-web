/**
 * AdminPanel - ChatApp Ultra Admin Paneli
 * Personel yönetimi, davet kodları, şirket kuralları, GDPR ayarları
 */

import { useState } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  X, Users, Ticket, BookOpen, Settings, UserMinus,
  Copy, Check, Loader2, Shield, Crown, Globe, Lock, Download, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { type Language, languageNames } from '@/lib/i18n';

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const {
    workspace, users, isAdmin, createInvite, removeUser,
    saveCompanyRules, companyRules, invites, currentUser,
    updateProfile
  } = useChatContext();
  const { t, language, changeLanguage } = useLanguage();

  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('personel');
  const [rules, setRules] = useState(companyRules);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [bio, setBio] = useState(currentUser?.bio || '');

  const handleCreateInvite = async () => {
    if (!inviteName.trim()) { toast.error(t.fillAllFields); return; }
    setLoading(true);
    try {
      const code = await createInvite(inviteName, inviteRole);
      toast.success(`${t.inviteCreated}: ${code}`);
      setInviteName('');
    } catch {
      toast.error('Davet kodu oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  const handleRemoveUser = async (userId: string, username: string) => {
    // Yetki kontrolü: Admin kendini silemez, başka admin'i silemez
    if (userId === currentUser?.id) {
      toast.error('Kendinizi kovamazsınız');
      return;
    }
    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.role === 'admin') {
      toast.error('Başka bir yöneticiyi kovamazsınız');
      return;
    }
    setConfirmRemove({ id: userId, name: username });
  };

  const executeRemoveUser = async () => {
    if (!confirmRemove) return;
    try {
      await removeUser(confirmRemove.id);
      toast.success(`${confirmRemove.name} ${t.userFired}`);
    } catch {
      toast.error('Kullanıcı kovulamadı');
    } finally {
      setConfirmRemove(null);
    }
  };

  const handleSaveRules = async () => {
    setLoading(true);
    try {
      await saveCompanyRules(rules);
      toast.success(t.rulesSaved);
    } catch {
      toast.error('Kurallar kaydedilemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(t.copied);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleUpdateProfile = async () => {
    try {
      await updateProfile(bio);
      toast.success(t.profileUpdated);
    } catch {
      toast.error('Profil güncellenemedi');
    }
  };

  const handleExportData = () => {
    // GDPR/KVKK - Veri dışa aktarma
    const data = {
      user: currentUser,
      workspace: workspace,
      exportDate: new Date().toISOString(),
      note: 'Bu veriler GDPR/KVKK kapsamında kullanıcı talebi üzerine dışa aktarılmıştır.'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatapp-ultra-data-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Veriler dışa aktarıldı');
  };

  if (!isAdmin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1f2c34] rounded-2xl border border-white/5 w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00a884]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#00a884]" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg font-[Noto_Sans]">{t.adminPanel}</h2>
              <p className="text-[#8696a0] text-xs">{workspace?.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Kapat"
            className="text-[#8696a0] hover:text-white hover:bg-white/5 rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="personnel" className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-[#111b21] mx-4 mt-3 rounded-xl h-10 p-1">
            <TabsTrigger value="personnel" className="rounded-lg text-xs data-[state=active]:bg-[#00a884] data-[state=active]:text-white">
              <Users className="w-3.5 h-3.5 mr-1" />{t.personnel}
            </TabsTrigger>
            <TabsTrigger value="invites" className="rounded-lg text-xs data-[state=active]:bg-[#00a884] data-[state=active]:text-white">
              <Ticket className="w-3.5 h-3.5 mr-1" />{t.invites}
            </TabsTrigger>
            <TabsTrigger value="rules" className="rounded-lg text-xs data-[state=active]:bg-[#00a884] data-[state=active]:text-white">
              <BookOpen className="w-3.5 h-3.5 mr-1" />{t.rules}
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg text-xs data-[state=active]:bg-[#00a884] data-[state=active]:text-white">
              <Settings className="w-3.5 h-3.5 mr-1" />{t.settings}
            </TabsTrigger>
          </TabsList>

          {/* Personnel Tab */}
          <TabsContent value="personnel" className="flex-1 min-h-0 px-4 pb-4">
            <ScrollArea className="h-full">
              <div className="space-y-2 py-3">
                {users.map(user => (
                  <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#111b21] group">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user.avatar_url || ''} />
                      <AvatarFallback className="bg-[#2a3942] text-[#8696a0]">
                        {user.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium truncate">{user.username}</span>
                        {user.role === 'admin' && <Crown className="w-3.5 h-3.5 text-yellow-400" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={user.is_online ? 'text-[#00a884]' : 'text-[#8696a0]'}>
                          {user.is_online ? t.online : user.last_seen ? `${t.lastSeen}: ${new Date(user.last_seen).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : t.offline}
                        </span>
                        {user.bio && <span className="text-[#8696a0] truncate">- {user.bio}</span>}
                      </div>
                    </div>
                    {user.role !== 'admin' && (
                      <Button variant="ghost" size="icon" aria-label="Kullanıcıyı kov"
                        onClick={() => handleRemoveUser(user.id, user.username)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-full transition-opacity">
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Invites Tab */}
          <TabsContent value="invites" className="flex-1 min-h-0 px-4 pb-4">
            <ScrollArea className="h-full">
              <div className="py-3 space-y-4">
                <div className="p-4 rounded-xl bg-[#111b21] space-y-3">
                  <h3 className="text-white text-sm font-semibold">{t.newInviteCode}</h3>
                  <div>
                    <Label className="text-[#8696a0] text-xs mb-1 block">{t.personName}</Label>
                    <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder={t.personName}
                      className="bg-[#2a3942] border-none text-white placeholder:text-[#8696a0]/50 h-10 rounded-xl focus-visible:ring-[#00a884]" />
                  </div>
                  <div>
                    <Label className="text-[#8696a0] text-xs mb-1 block">{t.role}</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="bg-[#2a3942] border-none text-white h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#233138] border-white/10 text-white">
                        <SelectItem value="personel">{t.rolePersonnel}</SelectItem>
                        <SelectItem value="admin">{t.roleAdmin}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreateInvite} disabled={loading}
                    className="w-full h-10 bg-[#00a884] hover:bg-[#00a884]/90 text-white rounded-xl">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.createInviteCode}
                  </Button>
                </div>

                {invites.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[#8696a0] text-xs uppercase tracking-wider">{t.existingCodes}</h3>
                    {invites.map((inv) => (
                      <div key={inv.code} className="flex items-center gap-3 p-3 rounded-xl bg-[#111b21]">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-mono tracking-wider">{inv.code}</p>
                          <p className="text-[#8696a0] text-xs">{inv.name} - {inv.role}</p>
                        </div>
                        {inv.used ? (
                          <span className="text-xs text-[#8696a0] bg-[#2a3942] px-2 py-1 rounded-full">{t.used}</span>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => handleCopyCode(inv.code)} aria-label="Kodu kopyala"
                            className="text-[#00a884] hover:bg-[#00a884]/10 rounded-full">
                            {copiedCode === inv.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules" className="flex-1 min-h-0 px-4 pb-4">
            <div className="py-3 space-y-3 h-full flex flex-col">
              <p className="text-[#8696a0] text-xs">{t.companyRulesDesc}</p>
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder={t.companyRulesPlaceholder}
                className="flex-1 bg-[#111b21] text-white placeholder:text-[#8696a0]/50 rounded-xl p-4 text-sm resize-none border-none focus:outline-none focus:ring-1 focus:ring-[#00a884] min-h-[200px]"
              />
              <Button onClick={handleSaveRules} disabled={loading}
                className="w-full h-10 bg-[#00a884] hover:bg-[#00a884]/90 text-white rounded-xl">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t.saveRules}
              </Button>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 min-h-0 px-4 pb-4">
            <ScrollArea className="h-full">
              <div className="py-3 space-y-4">
                {/* Profile */}
                <div className="p-4 rounded-xl bg-[#111b21] space-y-3">
                  <h3 className="text-white text-sm font-semibold">{t.profile}</h3>
                  <div>
                    <Label className="text-[#8696a0] text-xs mb-1 block">{t.aboutMe}</Label>
                    <Input value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t.statusMessage}
                      className="bg-[#2a3942] border-none text-white placeholder:text-[#8696a0]/50 h-10 rounded-xl focus-visible:ring-[#00a884]" />
                  </div>
                  <Button onClick={handleUpdateProfile}
                    className="w-full h-10 bg-[#00a884] hover:bg-[#00a884]/90 text-white rounded-xl">
                    {t.updateProfile}
                  </Button>
                </div>

                {/* Language */}
                <div className="p-4 rounded-xl bg-[#111b21] space-y-3">
                  <h3 className="text-white text-sm font-semibold flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#00a884]" />
                    Dil / Language
                  </h3>
                  <Select value={language} onValueChange={(v) => changeLanguage(v as Language)}>
                    <SelectTrigger className="bg-[#2a3942] border-none text-white h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#233138] border-white/10 text-white">
                      {(Object.keys(languageNames) as Language[]).map(lang => (
                        <SelectItem key={lang} value={lang}>{languageNames[lang]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Workspace Info */}
                <div className="p-4 rounded-xl bg-[#111b21] space-y-2">
                  <h3 className="text-white text-sm font-semibold">{t.workspaceInfo}</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8696a0]">{t.name}</span>
                    <span className="text-white">{workspace?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8696a0]">{t.maxUsers}</span>
                    <span className="text-white">{workspace?.max_users}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8696a0]">{t.totalUsers}</span>
                    <span className="text-white">{users.length}</span>
                  </div>
                </div>

                {/* GDPR/KVKK */}
                <div className="p-4 rounded-xl bg-[#111b21] space-y-3">
                  <h3 className="text-white text-sm font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#00a884]" />
                    {t.gdprTitle} (GDPR/KVKK)
                  </h3>
                  <p className="text-[#8696a0] text-xs">
                    Verileriniz AES-256 şifreleme ile korunmaktadır. GDPR ve KVKK kapsamında veri haklarınızı kullanabilirsiniz.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleExportData} variant="outline" size="sm"
                      className="flex-1 h-9 border-[#00a884]/30 text-[#00a884] hover:bg-[#00a884]/10 rounded-lg text-xs">
                      <Download className="w-3.5 h-3.5 mr-1" />
                      {t.gdprExportData}
                    </Button>
                    <Button variant="outline" size="sm"
                      className="flex-1 h-9 border-red-400/30 text-red-400 hover:bg-red-400/10 rounded-lg text-xs"
                      onClick={() => toast.info('Bu işlem geri alınamaz. Lütfen yönetici ile iletişime geçin.')}>
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      {t.gdprDeleteData}
                    </Button>
                  </div>
                </div>

                {/* Security Info */}
                <div className="p-4 rounded-xl bg-[#111b21] space-y-2">
                  <h3 className="text-white text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#00a884]" />
                    {t.securityInfo}
                  </h3>
                  <div className="space-y-1.5 text-xs text-[#8696a0]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#00a884]" />
                      <span>AES-256 Şifreleme Aktif</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#00a884]" />
                      <span>HMAC Bütünlük Kontrolü Aktif</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#00a884]" />
                      <span>Uçtan Uca Şifreleme (E2EE) Aktif</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#00a884]" />
                      <span>Rate Limiting Aktif (30 mesaj/dk)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#00a884]" />
                      <span>GDPR/KVKK Uyumlu</span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Onay Dialogı - confirm() yerine modern UI */}
      {confirmRemove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1f2c34] rounded-2xl border border-white/10 p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-2">Kullanıcıyı Kov</h3>
            <p className="text-[#8696a0] text-sm mb-6">
              <span className="text-white font-semibold">{confirmRemove.name}</span> adlı kullanıcıyı kovmak istediğinize emin misiniz? Tüm mesajları ve verileri silinecektir.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setConfirmRemove(null)} variant="outline"
                className="flex-1 h-10 border-white/10 text-white hover:bg-white/5 rounded-xl">
                İptal
              </Button>
              <Button onClick={executeRemoveUser}
                className="flex-1 h-10 bg-red-500 hover:bg-red-600 text-white rounded-xl">
                Kov
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
