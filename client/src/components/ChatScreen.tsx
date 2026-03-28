/**
 * ChatScreen - ChatApp Ultra Ana Sohbet Ekranı
 * WhatsApp tarzı split layout: Sidebar + ChatArea + GlobalSearch
 * WebRTC sesli/görüntülü arama entegrasyonu
 * Mobil responsive: tek panel gösterimi
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import AdminPanel from './AdminPanel';
import GlobalSearch from './GlobalSearch';
import UserSettingsSheet from './UserSettingsSheet';
import { CallScreen, IncomingCallOverlay } from './CallScreen';
import { useChatContext } from '@/contexts/ChatContext';
import { WebRTCManager, CallInfo, CallType } from '@/lib/webrtc';

export default function ChatScreen() {
  const [showChat, setShowChat] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const { channels, selectChannel, deviceId, currentUser, workspace } = useChatContext();

  // WebRTC State
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);
  const [showCallScreen, setShowCallScreen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallInfo | null>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);

  // WebRTC Manager başlat
  useEffect(() => {
    if (deviceId && currentUser && workspace) {
      const manager = new WebRTCManager(deviceId, currentUser.username, workspace.id);
      manager.startSignaling();

      // Gelen arama callback
      manager.setOnIncomingCall((info: CallInfo) => {
        setIncomingCall(info);
      });

      // Arama sonlandığında
      manager.setOnCallEnded(() => {
        setShowCallScreen(false);
        setIncomingCall(null);
      });

      webrtcRef.current = manager;
      setWebrtcManager(manager);

      return () => {
        manager.destroy();
        webrtcRef.current = null;
      };
    }
  }, [deviceId, currentUser, workspace]);

  // Arama başlat (ChatArea'dan çağrılır)
  const handleStartCall = useCallback(async (calleeDeviceId: string, calleeUsername: string, callType: CallType) => {
    if (!webrtcRef.current) return;
    const started = await webrtcRef.current.startCall(calleeDeviceId, calleeUsername, callType);
    if (started) {
      setShowCallScreen(true);
    }
  }, []);

  // Gelen aramayı kabul et
  const handleAcceptIncoming = useCallback(async () => {
    if (!webrtcRef.current) return;
    await webrtcRef.current.acceptCall();
    setIncomingCall(null);
    setShowCallScreen(true);
  }, []);

  // Gelen aramayı reddet
  const handleRejectIncoming = useCallback(async () => {
    if (!webrtcRef.current) return;
    await webrtcRef.current.rejectCall();
    setIncomingCall(null);
  }, []);

  // Arama sonucundan mesaja git
  const handleNavigateToMessage = useCallback((channelId: string, messageId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (channel) {
      selectChannel(channel);
      setShowChat(true);
      setHighlightMessageId(messageId);
      setTimeout(() => setHighlightMessageId(null), 3000);
    }
  }, [channels, selectChannel]);

  return (
    <div className="h-screen flex overflow-hidden bg-[#111b21]" style={{ height: '100dvh', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Sidebar */}
      <div className={`w-full md:w-[380px] lg:w-[420px] shrink-0 border-r border-white/5
        ${showChat ? 'hidden md:flex md:flex-col' : 'flex flex-col'}`}>
        <Sidebar
          onSelectChannel={() => setShowChat(true)}
          onOpenAdmin={() => setShowAdmin(true)}
          onOpenSearch={() => setShowSearch(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      {/* Chat Area */}
      <div className={`flex-1 min-w-0
        ${showChat ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
        <ChatArea
          onBack={() => setShowChat(false)}
          highlightMessageId={highlightMessageId}
          onStartCall={handleStartCall}
        />
      </div>

      {/* Admin Panel Modal */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {/* User Settings Sheet (admin olmayanlar) */}
      {showSettings && <UserSettingsSheet onClose={() => setShowSettings(false)} />}

      {/* Global Search Modal */}
      <GlobalSearch
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onNavigateToMessage={handleNavigateToMessage}
      />

      {/* Gelen Arama Bildirimi */}
      {incomingCall && !showCallScreen && (
        <IncomingCallOverlay
          callInfo={incomingCall}
          onAccept={handleAcceptIncoming}
          onReject={handleRejectIncoming}
        />
      )}

      {/* Arama Ekranı (Tam Ekran) */}
      {showCallScreen && webrtcManager && (
        <CallScreen
          webrtc={webrtcManager}
          onClose={() => setShowCallScreen(false)}
        />
      )}
    </div>
  );
}
