/**
 * UserSettingsSheet - Normal kullanıcı ayar paneli
 * Admin olmayanlar için: profil düzenleme + çıkış
 * shadcn Sheet kullanır — mevcut AdminPanel'e dokunmaz
 */

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useChatContext } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  onClose: () => void;
}

export default function UserSettingsSheet({ onClose }: Props) {
  const { currentUser, updateProfile, logout } = useChatContext();
  const { t } = useLanguage();
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(bio);
      toast.success(t.profileUpdated);
      onClose();
    } catch {
      toast.error('Profil güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <Sheet open onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent
        side="left"
        className="w-[320px] bg-[#111b21] border-r border-white/5 text-white p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-6 pb-4 border-b border-white/5">
          <SheetTitle className="text-white text-base font-semibold font-[Noto_Sans]">
            {t.settings}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Profil özeti */}
          <div className="flex items-center gap-3">
            <Avatar className="w-14 h-14 shrink-0">
              <AvatarImage src={currentUser?.avatar_url ?? ''} />
              <AvatarFallback className="bg-[#2a3942] text-[#8696a0] text-xl">
                {currentUser?.username?.charAt(0).toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-white font-medium text-sm truncate">{currentUser?.username}</p>
              <p className="text-[#8696a0] text-xs capitalize">{currentUser?.role}</p>
            </div>
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-2">
            <label className="text-[#8696a0] text-xs font-medium uppercase tracking-wide">
              {t.profile}
            </label>
            <Textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Kendinizi tanıtın..."
              maxLength={200}
              rows={3}
              className="bg-[#2a3942] border-none text-white placeholder:text-[#8696a0]/50 text-sm resize-none focus-visible:ring-1 focus-visible:ring-[#00a884] rounded-lg"
            />
            <p className="text-[#8696a0]/50 text-xs text-right">{bio.length}/200</p>
          </div>

          {/* Kaydet */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#00a884] hover:bg-[#00a884]/80 text-white rounded-xl h-10"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Kaydediliyor...' : t.cancel === 'İptal' ? 'Kaydet' : 'Save'}
          </Button>
        </div>

        {/* Çıkış — en alta sabit */}
        <div className="px-5 py-4 border-t border-white/5">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl h-10"
          >
            <LogOut className="w-4 h-4" />
            {t.logout}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
