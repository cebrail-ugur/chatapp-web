/**
 * Sidebar - ChatApp Ultra Kanal Listesi
 * WhatsApp tarzı sidebar, online durumu, güvenlik göstergeleri
 */

import { useState } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Shield, Search, Settings, LogOut, Hash, Lock, Bot,
  Users, ChevronRight, ShieldCheck, Bell, BellOff, BellRing
} from 'lucide-react';
import type { Channel } from '@/contexts/ChatContext';

interface SidebarProps {
  onSelectChannel: () => void;
  onOpenAdmin: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

export default function Sidebar({ onSelectChannel, onOpenAdmin, onOpenSearch, onOpenSettings }: SidebarProps) {
  const {
    workspace, currentUser, users, channels, activeChannel,
    selectChannel, isAdmin, logout,
    notificationPermission, requestNotifications, unreadCount
  } = useChatContext();
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const filteredChannels = channels.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = users.filter(u => u.is_online).length;

  const handleSelectChannel = (channel: Channel) => {
    selectChannel(channel);
    onSelectChannel();
  };

  const getChannelIcon = (channel: Channel) => {
    if (channel.name === 'Sistem Botu') return <Bot className="w-4 h-4 text-[#00a884]" />;
    if (channel.is_private) return <Lock className="w-4 h-4 text-[#8696a0]" />;
    return <Hash className="w-4 h-4 text-[#8696a0]" />;
  };

  const getChannelAvatar = (channel: Channel) => {
    if (channel.name === 'Sistem Botu') {
      return (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00a884] to-[#025144] flex items-center justify-center shrink-0">
          <Bot className="w-6 h-6 text-white" />
        </div>
      );
    }
    if (channel.is_private) {
      const assignedUser = users.find(u => u.device_id === channel.assigned_device_id);
      return (
        <Avatar className="w-12 h-12 shrink-0">
          <AvatarImage src={assignedUser?.avatar_url || ''} />
          <AvatarFallback className="bg-[#2a3942] text-[#8696a0] text-lg">
            {channel.name.replace('Özel: ', '').charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      );
    }
    return (
      <div className="w-12 h-12 rounded-full bg-[#2a3942] flex items-center justify-center shrink-0">
        <Hash className="w-6 h-6 text-[#8696a0]" />
      </div>
    );
  };

  const getChannelSubtext = (channel: Channel) => {
    if (channel.name === 'Sistem Botu') return t.aiAssistant;
    if (channel.is_private) return t.privateMessages;
    return `${users.length} ${t.members}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#111b21]">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 bg-[#202c33] border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00a884] to-[#025144] flex items-center justify-center relative">
            <Shield className="w-5 h-5 text-white" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#00a884] rounded-full border-2 border-[#202c33] flex items-center justify-center">
              <ShieldCheck className="w-2 h-2 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm font-[Noto_Sans]">{workspace?.name || t.appName}</h2>
            <p className="text-[#8696a0] text-xs flex items-center gap-1">
              <Users className="w-3 h-3" />
              {onlineCount} {t.online.toLowerCase()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Bildirim Butonu */}
          <Button
            variant="ghost" size="icon" aria-label="Bildirimler"
            onClick={notificationPermission !== 'granted' ? requestNotifications : undefined}
            className={`relative rounded-full ${
              notificationPermission === 'granted'
                ? 'text-[#00a884] hover:bg-white/5'
                : 'text-[#8696a0] hover:text-white hover:bg-white/5'
            }`}
            title={notificationPermission === 'granted' ? 'Bildirimler aktif' : 'Bildirimleri aç'}
          >
            {notificationPermission === 'granted' ? (
              unreadCount > 0 ? <BellRing className="w-5 h-5 animate-pulse" /> : <Bell className="w-5 h-5" />
            ) : (
              <BellOff className="w-5 h-5" />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#00a884] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
          <Button
            variant="ghost" size="icon" aria-label={isAdmin ? 'Yönetici paneli' : 'Ayarlar'}
            onClick={isAdmin ? onOpenAdmin : onOpenSettings}
            className="text-[#8696a0] hover:text-white hover:bg-white/5 rounded-full"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 bg-[#111b21]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => { e.target.blur(); onOpenSearch(); }}
            placeholder={t.searchPlaceholder}
            className="bg-[#202c33] border-none text-white placeholder:text-[#8696a0]/60 h-9 rounded-lg pl-10 text-sm focus-visible:ring-0 cursor-pointer"
            readOnly
          />
        </div>
      </div>

      {/* Channel List */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-white/5">
          {filteredChannels.map(channel => (
            <button
              key={channel.id}
              onClick={() => handleSelectChannel(channel)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors duration-150 text-left
                ${activeChannel?.id === channel.id ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'}`}
            >
              {getChannelAvatar(channel)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {getChannelIcon(channel)}
                  <span className="text-white text-sm font-medium truncate">{channel.name}</span>
                </div>
                <p className="text-[#8696a0] text-xs mt-0.5 truncate">
                  {getChannelSubtext(channel)}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8696a0]/50 shrink-0" />
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Bottom Profile */}
      <div className="h-16 flex items-center justify-between px-4 bg-[#202c33] border-t border-white/5" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9 relative">
            <AvatarImage src={currentUser?.avatar_url || ''} />
            <AvatarFallback className="bg-[#00a884]/20 text-[#00a884] text-sm font-semibold">
              {currentUser?.username?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white text-sm font-medium">{currentUser?.username}</p>
            <p className="text-[#8696a0] text-xs flex items-center gap-1">
              {isAdmin ? (
                <><Shield className="w-3 h-3 text-yellow-400" /> Admin</>
              ) : (
                <><Users className="w-3 h-3" /> {t.rolePersonnel}</>
              )}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} aria-label="Çıkış yap"
          className="text-[#8696a0] hover:text-red-400 hover:bg-red-400/10 rounded-full">
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
