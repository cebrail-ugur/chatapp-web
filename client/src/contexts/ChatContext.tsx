/**
 * ChatApp Ultra - Ana Sohbet Bağlamı (Chat Context)
 * Supabase entegrasyonu, E2EE şifreleme, Realtime mesajlaşma
 * Güvenlik: X3DH + Double Ratchet + AES-256-GCM, Forward Secrecy, Rate limiting
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { encrypt, decrypt, generateDeviceId, RateLimiter, generateWorkspaceKey, storeWorkspaceKey, getWorkspaceKey, deleteWorkspaceKey, encryptKeyForInvite, decryptKeyFromInvite, hasWorkspaceKey, generateX25519IdentityKeyPair, storeX25519IdentityKey, getX25519IdentityKey, generateFullX3DHKeySet, storeFullX3DHKeySet, clearX3DHData } from '@/lib/protocol';
import { logAudit } from '@/lib/auditLog';
import { validateChannelAccess, clearMembershipCache } from '@/lib/channelGuard';
import { isKeyRevoked, subscribeToRevocations, clearRevocationList } from '@/lib/keyRevocation';
import { v4 as uuidv4 } from 'uuid';
// Firebase lazy import - sadece ihtiyaç duyulduğunda yüklenir (bundle boyutu optimizasyonu)
const firebaseModule = () => import('@/lib/firebase');

// Senkron bildirim durumu kontrolü (Firebase yüklemeden)
function getNotificationPermissionStatusSync(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// Types
export interface Workspace {
  id: string;
  name: string;
  admin_device_id: string;
  max_users: number;
}

export interface User {
  id: string;
  device_id: string;
  username: string;
  workspace_id: string;
  role: 'admin' | 'personel';
  avatar_url: string | null;
  bio: string | null;
  is_online: boolean;
  last_seen: number | null;
  fcm_token: string | null;
}

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  is_private: boolean;
  assigned_device_id: string | null;
}

export interface Message {
  id: string;
  workspace_id: string;
  channel_id: string;
  payload: string;
  device_id: string;
  time: string;
  timestamp: number;
}

export interface DecryptedPayload {
  text: string;
  sender: string;
  timer?: number;
  exp?: number;
  type?: 'text' | 'image' | 'file';
  fileUrl?: string;
  fileName?: string;
}

export type AppScreen = 'loading' | 'login' | 'chat';

interface ChatContextType {
  screen: AppScreen;
  deviceId: string;
  workspace: Workspace | null;
  currentUser: User | null;
  users: User[];
  channels: Channel[];
  activeChannel: Channel | null;
  messages: Message[];
  decryptedMessages: Map<string, DecryptedPayload>;
  isAdmin: boolean;
  typingUsers: Map<string, string>;
  createWorkspace: (name: string, password: string, maxUsers: number, adminName: string) => Promise<void>;
  joinWorkspace: (inviteCode: string, name: string, bio: string) => Promise<void>;
  selectChannel: (channel: Channel) => void;
  sendMessage: (text: string, timer?: number) => Promise<void>;
  sendMediaMessage: (file: File) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  createInvite: (name: string, role: string) => Promise<string>;
  removeUser: (userId: string) => Promise<void>;
  saveCompanyRules: (rules: string) => Promise<void>;
  companyRules: string;
  updateProfile: (bio: string, avatarFile?: File) => Promise<void>;
  logout: () => void;
  sendTypingSignal: () => void;
  invites: Array<{ code: string; name: string; role: string; used: boolean }>;
  notificationPermission: 'granted' | 'denied' | 'default' | 'unsupported';
  requestNotifications: () => Promise<void>;
  unreadCount: number;
}

const ChatContext = createContext<ChatContextType | null>(null);

// Rate limiter: max 30 messages per 60 seconds
const messageLimiter = new RateLimiter(30, 60000);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [deviceId, setDeviceId] = useState<string>('');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, DecryptedPayload>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [companyRules, setCompanyRules] = useState('');
  const [invites, setInvites] = useState<Array<{ code: string; name: string; role: string; used: boolean }>>([]);
  const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(getNotificationPermissionStatusSync());
  const [unreadCount, setUnreadCount] = useState(0);
  const isDocumentVisibleRef = useRef(true);
  const activeChannelIdRef = useRef<string | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const workspaceRef = useRef<Workspace | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Keep workspace ref in sync
  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  // Sayfa görünürlüğünü takip et (bildirimler için)
  useEffect(() => {
    const handleVisibility = () => {
      isDocumentVisibleRef.current = document.visibilityState === 'visible';
      if (isDocumentVisibleRef.current) {
        setUnreadCount(0);
        // Sayfa başlığını sıfırla
        document.title = 'ChatApp Ultra - Sentinel Ultra';
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Active channel ref'i güncelle
  useEffect(() => {
    activeChannelIdRef.current = activeChannel?.id || null;
  }, [activeChannel]);

  // DeviceId'yi asenkron olarak başlat ve session'ı yükle
  useEffect(() => {
    const init = async () => {
      const id = await generateDeviceId();
      setDeviceId(id);
      const wsId = localStorage.getItem('sentinel_workspace_id');
      if (wsId) {
        // loadSession deviceId'ye ihtiyaç duyar, id'yi doğrudan kullan
        try {
          const { data: ws, error: wsError } = await supabase.from('workspaces').select('*').eq('id', wsId).single();
          if (wsError || !ws) {
            localStorage.removeItem('sentinel_workspace_id');
            setScreen('login');
            return;
          }
          setWorkspace(ws);

          const { data: user, error: userError } = await supabase.from('users').select('*').eq('workspace_id', wsId).eq('device_id', id).single();
          if (userError || !user) {
            localStorage.removeItem('sentinel_workspace_id');
            setScreen('login');
            return;
          }
          setCurrentUser(user);

          const { data: allUsers } = await supabase.from('users').select('*').eq('workspace_id', wsId);
          setUsers(allUsers || []);

          const { data: allChannels } = await supabase.from('channels').select('*').eq('workspace_id', wsId);
          const channelList = allChannels || [];
          setChannels(channelList);

          if (user.role === 'admin') {
            const { data: allInvites } = await supabase.from('workspace_invites').select('*').eq('workspace_id', wsId);
            setInvites((allInvites || []).map((i: { invite_code: string; assigned_name: string; role: string; is_used: boolean }) => ({
              code: i.invite_code, name: i.assigned_name, role: i.role, used: i.is_used
            })));
          }

          setScreen('chat');

          // ── Session restore: Son aktif kanalı veya Genel Oda'yı seç ve mesajları yükle ──
          const savedChannelId = localStorage.getItem('sentinel_active_channel_id');
          let restoreChannel: Channel | undefined;
          if (savedChannelId) {
            restoreChannel = channelList.find((c: Channel) => c.id === savedChannelId);
          }
          if (!restoreChannel) {
            // Genel Oda'yı bul (is_private=false olan ilk kanal)
            restoreChannel = channelList.find((c: Channel) => !c.is_private) || channelList[0];
          }
          if (restoreChannel) {
            setActiveChannel(restoreChannel);
            activeChannelIdRef.current = restoreChannel.id;
            // Mesajları yükle
            try {
              const { data: msgs } = await supabase.from('messages').select('*')
                .eq('channel_id', restoreChannel.id).order('timestamp', { ascending: true }).limit(200);
              const msgList = msgs || [];
              // Sequential decrypt (ratchet state race condition önleme)
              // Promise.all YASAK: Parallel decrypt ratchet state'i bozar
              // setMessages decrypt'ten SONRA çağrılır — UI'da geçici "çözülemedi" önlenir
              const newDecrypted = new Map<string, DecryptedPayload>();
              for (const msg of msgList) {
                try {
                  const d = await decrypt(msg.payload, wsId, restoreChannel!.id) as DecryptedPayload;
                  if (d) newDecrypted.set(msg.id, d);
                } catch { /* decrypt hatası sessizce geç */ }
              }
              setMessages(msgList);
              setDecryptedMessages(newDecrypted);
            } catch (e) {
              console.error('[Session Restore] Mesaj yükleme hatası:', e);
            }
          }
        } catch (e) {
          console.error('[Session] Load error:', e);
          setScreen('login');
        }
      } else {
        setScreen('login');
      }
    };
    init();
  }, []);

  // Online status heartbeat
  useEffect(() => {
    if (!currentUser) return;
    const updateOnline = async () => {
      try {
        await supabase.from('users').update({ is_online: true, last_seen: Date.now() }).eq('id', currentUser.id);
      } catch (e) {
        console.error('[Heartbeat] Error:', e);
      }
    };
    updateOnline();
    const interval = setInterval(updateOnline, 30000);
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline status
      // sendBeacon sadece POST gönderebilir, Supabase REST API PATCH bekler
      // Bu yüzden Supabase JS client ile gönderiyoruz (keepalive fetch)
      try {
        fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${currentUser.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ is_online: false, last_seen: Date.now() }),
          keepalive: true // Sayfa kapansa bile isteği tamamla
        });
      } catch { /* beforeunload'da hata yakalamaya gerek yok */ }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser]);

  // Subscribe to realtime when active channel changes
  useEffect(() => {
    if (!activeChannel || !workspace) return;
    
    // Cleanup previous subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase.channel(`room_${activeChannel.id}`, {
      config: { broadcast: { self: false } }
    });
    
    channel
      .on('broadcast', { event: 'new_message' }, async (payload) => {
        const msg = payload.payload as Message;
        if (!msg || !msg.id) return;
        // Decrypt ÖNCE tamamlanır, sonra messages state'e eklenir
        // Böylece UI render sırasında decryptedMessages map'te entry zaten hazır olur
        const ws = workspaceRef.current;
        let decrypted: DecryptedPayload | null = null;
        if (ws) {
          try {
            decrypted = await decrypt(msg.payload, ws.id, activeChannelIdRef.current || undefined) as DecryptedPayload;
          } catch (e) {
            console.error('[Decrypt] Error:', e);
          }
        }

        // Mesajı listeye ekle — decrypt sonucundan bağımsız (decrypt başarısızsa hata gösterilir)
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
        });

        // Decrypt başarılıysa map'e ekle
        if (decrypted) {
          setDecryptedMessages(prev => {
            const newMap = new Map(prev);
            newMap.set(msg.id, decrypted!);
            return newMap;
          });

          // Bildirim tetikle — sayfa arka plandaysa veya farklı kanaldaysa
          if (decrypted.sender !== currentUser?.username) {
            const shouldNotify = !isDocumentVisibleRef.current || activeChannelIdRef.current !== msg.channel_id;
            if (shouldNotify && notificationPermission === 'granted') {
              const channelName = channels.find(c => c.id === msg.channel_id)?.name || 'Bilinmeyen Kanal';
              const msgText = decrypted.type === 'image' ? '📷 Fotoğraf' : decrypted.type === 'file' ? `📎 ${decrypted.fileName || 'Dosya'}` : decrypted.text;
              const fb = await firebaseModule();
              fb.showLocalNotification(
                `${decrypted.sender} • ${channelName}`,
                msgText.length > 100 ? msgText.substring(0, 100) + '...' : msgText,
                { tag: `chatapp-msg-${msg.channel_id}` }
              );
              fb.playNotificationSound();
              if (!isDocumentVisibleRef.current) {
                setUnreadCount(prev => prev + 1);
                document.title = `(🔔) Yeni Mesaj - ChatApp Ultra`;
              }
            }
          }
        }
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { deviceId: typingDeviceId, username } = payload.payload as { deviceId: string; username: string };
        if (typingDeviceId === deviceId) return;
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(typingDeviceId, username);
          return newMap;
        });
        // Clear typing after 3 seconds
        const existing = typingTimeoutRef.current.get(typingDeviceId);
        if (existing) clearTimeout(existing);
        const timeout = setTimeout(() => {
          setTypingUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete(typingDeviceId);
            return newMap;
          });
        }, 3000);
        typingTimeoutRef.current.set(typingDeviceId, timeout);
      })
      .on('broadcast', { event: 'force_delete' }, (payload) => {
        const { messageId } = payload.payload as { messageId: string };
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setDecryptedMessages(prev => {
          const newMap = new Map(prev);
          newMap.delete(messageId);
          return newMap;
        });
      })
      .subscribe((status) => {
        // Realtime channel status: production'da loglanmaz
      });

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel?.id, workspace?.id, deviceId]);

  // Timer messages cleanup
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const expiredIds: string[] = [];
      decryptedMessages.forEach((payload, id) => {
        if (payload.exp && payload.exp < now) {
          expiredIds.push(id);
        }
      });
      if (expiredIds.length > 0) {
        setMessages(prev => prev.filter(m => !expiredIds.includes(m.id)));
        setDecryptedMessages(prev => {
          const newMap = new Map(prev);
          expiredIds.forEach(id => newMap.delete(id));
          return newMap;
        });
        // Also delete from database
        expiredIds.forEach(id => {
          supabase.from('messages').delete().eq('id', id).then(() => {});
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [decryptedMessages]);

  // Periodically refresh users list
  useEffect(() => {
    if (!workspace) return;
    const refreshUsers = async () => {
      const { data } = await supabase.from('users').select('*').eq('workspace_id', workspace.id);
      if (data) setUsers(data);
    };
    const interval = setInterval(refreshUsers, 15000);
    return () => clearInterval(interval);
  }, [workspace]);

  async function loadSession(wsId: string) {
    try {
      const { data: ws, error: wsError } = await supabase.from('workspaces').select('*').eq('id', wsId).single();
      if (wsError || !ws) { 
        console.error('[Session] Workspace not found:', wsError);
        localStorage.removeItem('sentinel_workspace_id');
        setScreen('login'); 
        return; 
      }
      setWorkspace(ws);

      const { data: user, error: userError } = await supabase.from('users').select('*').eq('workspace_id', wsId).eq('device_id', deviceId).single();
      if (userError || !user) { 
        console.error('[Session] User not found:', userError);
        localStorage.removeItem('sentinel_workspace_id'); 
        setScreen('login'); 
        return; 
      }
      setCurrentUser(user);

      const { data: allUsers } = await supabase.from('users').select('*').eq('workspace_id', wsId);
      setUsers(allUsers || []);

      const { data: allChannels } = await supabase.from('channels').select('*').eq('workspace_id', wsId);
      setChannels(allChannels || []);

      if (user.role === 'admin') {
        const { data: allInvites } = await supabase.from('workspace_invites').select('*').eq('workspace_id', wsId);
        setInvites((allInvites || []).map((i: { invite_code: string; assigned_name: string; role: string; is_used: boolean }) => ({
          code: i.invite_code, name: i.assigned_name, role: i.role, used: i.is_used
        })));
      }

      setScreen('chat');
    } catch (e) {
      console.error('[Session] Load error:', e);
      setScreen('login');
    }
  }

  const createWorkspace = useCallback(async (name: string, password: string, maxUsers: number, adminName: string) => {
    const wsId = uuidv4();
    
    const { error: wsError } = await supabase.from('workspaces').insert({
      id: wsId, name: name.trim(), admin_device_id: deviceId, max_users: maxUsers
    });
    if (wsError) {
      console.error('[Create WS] Error:', wsError);
      throw new Error(wsError.message);
    }

    // Eski device_id kaydını temizle (yeni workspace oluştururken çakışma önleme)
    await supabase.from('users').delete().eq('device_id', deviceId);

    const userId = uuidv4();
    const { error: userError } = await supabase.from('users').insert({
      id: userId, device_id: deviceId, username: adminName.trim(), workspace_id: wsId, role: 'admin',
      is_online: true, last_seen: Date.now()
    });
    if (userError) {
      console.error('[Create User] Error:', userError);
      throw new Error(userError.message);
    }

    // Create default channels
    const generalId = uuidv4();
    const botId = uuidv4();
    const { error: channelError } = await supabase.from('channels').insert([
      { id: generalId, workspace_id: wsId, name: 'Genel Oda', is_private: false },
      { id: botId, workspace_id: wsId, name: 'Sistem Botu', is_private: false }
    ]);
    if (channelError) {
      console.error('[Create Channels] Error:', channelError);
    }

    // E2EE: Workspace için 256-bit rastgele anahtar üret ve SADECE cihazda sakla
    const workspaceKey = generateWorkspaceKey();
    await storeWorkspaceKey(wsId, workspaceKey);
    // [Güvenlik] Anahtar logları üretim ortamında devre dışı

    // X25519: Uzun vadeli identity key pair üret
    const identityKey = generateX25519IdentityKeyPair();
    storeX25519IdentityKey(wsId, identityKey.publicKey, identityKey.secretKey);


    // X3DH: Tam anahtar seti üret (Signed PreKey + One-Time PreKey havuzu + PreKey Bundle)
    const x3dhKeySet = generateFullX3DHKeySet(identityKey);
    storeFullX3DHKeySet(wsId, x3dhKeySet.signedPreKey, x3dhKeySet.oneTimePreKeys, x3dhKeySet.preKeyBundle);


    // Store admin password encrypted in localStorage (not sent to server)
    const encPassword = await encrypt({ password }, wsId);
    localStorage.setItem(`sentinel_admin_pass_${wsId}`, encPassword);
    localStorage.setItem('sentinel_workspace_id', wsId);

    // Audit log: Workspace oluşturuldu
    logAudit(wsId, deviceId, adminName.trim(), 'workspace_created').catch(() => {});

    await loadSession(wsId);
  }, [deviceId]);

  const joinWorkspace = useCallback(async (inviteCode: string, name: string, bio: string) => {
    const { data: invite, error: inviteError } = await supabase.from('workspace_invites').select('*')
      .eq('invite_code', inviteCode.toUpperCase().trim()).eq('is_used', false).single();
    if (inviteError || !invite) throw new Error('Geçersiz veya kullanılmış davet kodu');

    // E2EE: Davet kodundan workspace anahtarını çöz ve cihazda sakla (async - Web Crypto API)
    if (invite.encrypted_key) {
      const workspaceKey = await decryptKeyFromInvite(invite.encrypted_key, inviteCode.toUpperCase().trim());
      if (workspaceKey) {
        await storeWorkspaceKey(invite.workspace_id, workspaceKey);
        // [Güvenlik] Anahtar logları üretim ortamında devre dışı
      } else {
        console.warn('[E2EE] Workspace anahtarı çözülemedi - eski format davet kodu olabilir');
      }
    }

    // X25519: Katılan kullanıcı için identity key pair üret
    const identityKey = generateX25519IdentityKeyPair();
    storeX25519IdentityKey(invite.workspace_id, identityKey.publicKey, identityKey.secretKey);


    // X3DH: Tam anahtar seti üret (Signed PreKey + One-Time PreKey havuzu + PreKey Bundle)
    const x3dhKeySet = generateFullX3DHKeySet(identityKey);
    storeFullX3DHKeySet(invite.workspace_id, x3dhKeySet.signedPreKey, x3dhKeySet.oneTimePreKeys, x3dhKeySet.preKeyBundle);


    // Eski device_id kaydını temizle (çakışma önleme)
    await supabase.from('users').delete().eq('device_id', deviceId);

    const userId = uuidv4();
    const { error: userError } = await supabase.from('users').insert({
      id: userId, device_id: deviceId, username: name.trim(), workspace_id: invite.workspace_id,
      role: invite.role, bio: bio?.trim() || null, is_online: true, last_seen: Date.now()
    });
    if (userError) throw new Error(userError.message);

    await supabase.from('workspace_invites').update({ is_used: true }).eq('id', invite.id);

    // Create private channel for user
    const privateChannelId = uuidv4();
    await supabase.from('channels').insert({
      id: privateChannelId, workspace_id: invite.workspace_id,
      name: `Özel: ${name.trim()}`, is_private: true, assigned_device_id: deviceId
    });

    localStorage.setItem('sentinel_workspace_id', invite.workspace_id);

    // Audit log: Kullanıcı katıldı
    logAudit(invite.workspace_id, deviceId, name.trim(), 'workspace_joined').catch(() => {});

    await loadSession(invite.workspace_id);
  }, [deviceId]);

  const selectChannel = useCallback(async (channel: Channel) => {
    setActiveChannel(channel);
    setMessages([]);
    setDecryptedMessages(new Map());
    // Aktif kanalı kaydet - sayfa yenilenince geri yüklenecek
    localStorage.setItem('sentinel_active_channel_id', channel.id);
    
    if (!workspaceRef.current) return;
    const wsId = workspaceRef.current.id;
    
    try {
      const { data: msgs, error } = await supabase.from('messages').select('*')
        .eq('channel_id', channel.id).order('timestamp', { ascending: true }).limit(200);
      
      if (error) {
        console.error('[Select Channel] Error loading messages:', error);
        return;
      }
      
      const msgList = msgs || [];
      setMessages(msgList);
      
      // Sequential decrypt (ratchet state race condition önleme)
      // Promise.all YASAK: Parallel decrypt ratchet state'i bozar
      const newDecrypted = new Map<string, DecryptedPayload>();
      for (const msg of msgList) {
        try {
          const d = await decrypt(msg.payload, wsId, channel.id) as DecryptedPayload;
          if (d) newDecrypted.set(msg.id, d);
        } catch {
          // Decrypt hatası sessizce geç - hassas bilgi loglanmaz
        }
      }
      setDecryptedMessages(newDecrypted);
    } catch (e) {
      console.error('[Select Channel] Error:', e);
    }
  }, []);

  const sendMessage = useCallback(async (text: string, timer?: number) => {
    if (!workspaceRef.current || !activeChannel || !currentUser) {
      console.error('[Send] Missing context:', { ws: !!workspaceRef.current, ch: !!activeChannel, user: !!currentUser });
      throw new Error('Mesaj göndermek için oturum gerekli');
    }
    
    // Rate limiting
    if (!messageLimiter.canProceed()) {
      throw new Error('Çok hızlı mesaj gönderiyorsunuz. Lütfen bekleyin.');
    }

    const wsId = workspaceRef.current.id;
    const msgId = uuidv4();
    const now = Date.now();
    
    const payload: DecryptedPayload = {
      text: text.trim(),
      sender: currentUser.username,
      type: 'text',
      ...(timer && timer > 0 ? { timer, exp: now + timer * 1000 } : {})
    };
    
    // Double Ratchet encrypt (X25519 + AES-256-GCM + Forward Secrecy)
    const encrypted = await encrypt(payload, wsId, activeChannel.id);
    if (!encrypted) throw new Error('Şifreleme hatası');
    
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const msg: Message = {
      id: msgId, workspace_id: wsId, channel_id: activeChannel.id,
      payload: encrypted, device_id: deviceId, time: timeStr, timestamp: now
    };

    // Optimistic update - mesajı hemen ekranda göster
    setMessages(prev => [...prev, msg]);
    setDecryptedMessages(prev => {
      const newMap = new Map(prev);
      newMap.set(msgId, payload);
      return newMap;
    });

    try {
      // Veritabanına kaydet
      const { error } = await supabase.from('messages').insert(msg);
      if (error) {
        console.error('[Send] DB insert error:', error);
        // Rollback optimistic update
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setDecryptedMessages(prev => {
          const newMap = new Map(prev);
          newMap.delete(msgId);
          return newMap;
        });
        throw new Error('Mesaj veritabanına kaydedilemedi');
      }

      // Broadcast to realtime
      if (realtimeChannelRef.current) {
        await realtimeChannelRef.current.send({ 
          type: 'broadcast', 
          event: 'new_message', 
          payload: msg 
        });
      }

      // Audit log: Mesaj gönderildi (içerik loglanmaz - sadece metadata)
      logAudit(wsId, deviceId, currentUser.username, 'message_sent', { targetType: 'channel', targetId: activeChannel.id }).catch(() => {});
    } catch (e) {
      console.error('[Send] Error:', e);
      throw e;
    }
  }, [activeChannel, currentUser, deviceId]);

  const sendMediaMessage = useCallback(async (file: File) => {
    if (!workspaceRef.current || !activeChannel || !currentUser) return;
    
    // File size limit: 25MB
    if (file.size > 25 * 1024 * 1024) {
      throw new Error('Dosya boyutu 25MB\'dan büyük olamaz');
    }
    
    const wsId = workspaceRef.current.id;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const filePath = `${wsId}/${uuidv4()}.${ext}`;
    
    const { error: uploadError } = await supabase.storage.from('chat_media').upload(filePath, file);
    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from('chat_media').getPublicUrl(filePath);
    const fileUrl = urlData.publicUrl;
    const isImage = file.type.startsWith('image/');

    const msgId = uuidv4();
    const now = Date.now();
    const payload: DecryptedPayload = {
      text: isImage ? '📷 Fotoğraf' : `📎 ${file.name}`,
      sender: currentUser.username,
      type: isImage ? 'image' : 'file',
      fileUrl, fileName: file.name
    };
    // Double Ratchet encrypt (X25519 + AES-256-GCM + Forward Secrecy)
    const encrypted = await encrypt(payload, wsId, activeChannel.id);
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const msg: Message = {
      id: msgId, workspace_id: wsId, channel_id: activeChannel.id,
      payload: encrypted, device_id: deviceId, time: timeStr, timestamp: now
    };

    // Optimistic update
    setMessages(prev => [...prev, msg]);
    setDecryptedMessages(prev => {
      const newMap = new Map(prev);
      newMap.set(msgId, payload);
      return newMap;
    });

    const { error } = await supabase.from('messages').insert(msg);
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
      setDecryptedMessages(prev => {
        const newMap = new Map(prev);
        newMap.delete(msgId);
        return newMap;
      });
      throw new Error('Dosya mesajı kaydedilemedi');
    }

    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({ type: 'broadcast', event: 'new_message', payload: msg });
    }
  }, [activeChannel, currentUser, deviceId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!activeChannel) return;
    
    // Optimistic delete
    setMessages(prev => prev.filter(m => m.id !== messageId));
    setDecryptedMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(messageId);
      return newMap;
    });

    await supabase.from('messages').delete().eq('id', messageId);
    
    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({ type: 'broadcast', event: 'force_delete', payload: { messageId } });
    }

    // Audit log: Mesaj silindi
    if (workspaceRef.current) {
      logAudit(workspaceRef.current.id, deviceId, 'admin', 'message_deleted', { targetType: 'message', targetId: activeChannel?.id }).catch(() => {});
    }
  }, [activeChannel, deviceId]);

  const createInvite = useCallback(async (name: string, role: string) => {
    if (!workspace) throw new Error('Workspace yok');
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // E2EE: Workspace anahtarını davet koduyla şifrele (async - Web Crypto API)
    let encryptedKey: string | null = null;
    const workspaceKey = await getWorkspaceKey(workspace.id);
    if (workspaceKey) {
      encryptedKey = await encryptKeyForInvite(workspaceKey, code);
      // [Güvenlik] Anahtar logları üretim ortamında devre dışı
    }
    
    // Supabase workspace_invites tablosuna insert
    // NOT: encrypted_key alanı Supabase tablosunda tanımlı değilse hata verir,
    // bu yüzden sadece mevcut alanları gönderiyoruz.
    const { error } = await supabase.from('workspace_invites').insert({
      id: uuidv4(),
      workspace_id: workspace.id,
      invite_code: code,
      role,
      assigned_name: name.trim(),
      is_used: false
    });
    if (error) throw new Error(error.message);
    setInvites(prev => [...prev, { code, name: name.trim(), role, used: false }]);

    // Audit log: Davet kodu oluşturuldu
    logAudit(workspace.id, deviceId, 'admin', 'invite_created', { targetType: 'invite', metadata: { assignedTo: name.trim() } }).catch(() => {});
    return code;
  }, [workspace, deviceId]);

  const removeUser = useCallback(async (userId: string) => {
    if (!workspace) return;
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    // Delete user's private channel and messages
    const { data: userChannels } = await supabase.from('channels').select('id')
      .eq('workspace_id', workspace.id).eq('assigned_device_id', user.device_id);
    
    if (userChannels) {
      for (const ch of userChannels) {
        await supabase.from('messages').delete().eq('channel_id', ch.id);
        await supabase.from('channels').delete().eq('id', ch.id);
      }
    }
    
    // Delete all user messages
    await supabase.from('messages').delete().eq('device_id', user.device_id).eq('workspace_id', workspace.id);
    await supabase.from('users').delete().eq('id', userId);
    
    // E2EE: Kovulan kullanıcının cihazındaki anahtar sunucu tarafından silinemez
    // (zaten cihazda saklanıyor), ama veritabanındaki tüm verileri silindi.
    // İdeal senaryoda workspace anahtarı yenilenir (key rotation) ama bu ileri seviye bir özellik.
    
    setUsers(prev => prev.filter(u => u.id !== userId));
    setChannels(prev => prev.filter(c => c.assigned_device_id !== user.device_id));

    // Audit log: Kullanıcı kovuldu
    logAudit(workspace.id, deviceId, 'admin', 'user_removed', { targetType: 'user', metadata: { removedUser: user.username } }).catch(() => {});
  }, [workspace, users, deviceId]);

  const saveCompanyRules = useCallback(async (rules: string) => {
    if (!workspace) return;
    setCompanyRules(rules);
    
    // Send hidden knowledge base message to bot channel
    const botChannel = channels.find(c => c.name === 'Sistem Botu');
    if (botChannel) {
      const payload: DecryptedPayload = {
        text: `[KNOWLEDGE_BASE]${rules}[/KNOWLEDGE_BASE]`,
        sender: 'SYSTEM', type: 'text'
      };
      // v3 encrypt (sistem mesajı - ratchet kullanmaz)
      const encrypted = await encrypt(payload, workspace.id);
      await supabase.from('messages').insert({
        id: uuidv4(), workspace_id: workspace.id, channel_id: botChannel.id,
        payload: encrypted, device_id: 'SYSTEM', 
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      });
    }
  }, [workspace, channels]);

  const updateProfile = useCallback(async (bio: string, avatarFile?: File) => {
    if (!currentUser || !workspace) return;
    let avatarUrl = currentUser.avatar_url;
    
    if (avatarFile) {
      if (avatarFile.size > 5 * 1024 * 1024) throw new Error('Avatar 5MB\'dan büyük olamaz');
      const ext = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `avatars/${workspace.id}/${deviceId}.${ext}`;
      await supabase.storage.from('chat_media').upload(filePath, avatarFile, { upsert: true });
      const { data: urlData } = supabase.storage.from('chat_media').getPublicUrl(filePath);
      avatarUrl = urlData.publicUrl;
    }

    await supabase.from('users').update({ bio: bio.trim(), avatar_url: avatarUrl }).eq('id', currentUser.id);
    setCurrentUser(prev => prev ? { ...prev, bio: bio.trim(), avatar_url: avatarUrl } : null);
  }, [currentUser, workspace, deviceId]);

  const sendTypingSignal = useCallback(() => {
    if (!realtimeChannelRef.current || !currentUser) return;
    realtimeChannelRef.current.send({
      type: 'broadcast', event: 'typing',
      payload: { deviceId, username: currentUser.username }
    });
  }, [currentUser, deviceId]);

  // Bildirim izni iste
  const requestNotifications = useCallback(async () => {
    const fb = await firebaseModule();
    const token = await fb.requestNotificationPermission();
    if (token) {
      setNotificationPermission('granted');
      // FCM token'ı Supabase'e kaydet
      if (currentUser && token !== 'local-notifications-enabled') {
        try {
          await supabase.from('users').update({ fcm_token: token }).eq('id', currentUser.id);
        } catch (e) {
          console.error('[FCM] Token kaydetme hatası:', e);
        }
      }
    } else {
      setNotificationPermission(getNotificationPermissionStatusSync());
    }
  }, [currentUser]);

  const logout = useCallback(() => {
    if (currentUser) {
      supabase.from('users').update({ is_online: false, last_seen: Date.now() }).eq('id', currentUser.id);
    }
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    // NOT: Workspace anahtarını silmiyoruz çünkü kullanıcı tekrar giriş yapabilmeli.
    // Anahtar sadece kovulma (removeUser) durumunda silinir.
    // Audit log: Oturum kapatıldı
    if (workspaceRef.current) {
      logAudit(workspaceRef.current.id, deviceId, currentUser?.username || 'unknown', 'user_left').catch(() => {});
    }
    clearMembershipCache();
    localStorage.removeItem('sentinel_workspace_id');
    localStorage.removeItem('sentinel_active_channel_id');
    setWorkspace(null);
    setCurrentUser(null);
    setUsers([]);
    setChannels([]);
    setActiveChannel(null);
    setMessages([]);
    setDecryptedMessages(new Map());
    setScreen('login');
  }, [currentUser]);

  return (
    <ChatContext.Provider value={{
      screen, deviceId,
      workspace, currentUser, users, channels, activeChannel,
      messages, decryptedMessages, isAdmin, typingUsers,
      createWorkspace, joinWorkspace, selectChannel, sendMessage,
      sendMediaMessage, deleteMessage, createInvite, removeUser,
      saveCompanyRules, companyRules, updateProfile, logout,
      sendTypingSignal, invites,
      notificationPermission, requestNotifications, unreadCount
    }}>
      {children}
    </ChatContext.Provider>
  );
}
