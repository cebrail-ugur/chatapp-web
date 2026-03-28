/**
 * ChatArea - ChatApp Ultra Mesaj Alanı
 * WhatsApp tarzı mesaj baloncukları, tik animasyonları
 * Güvenlik: XSS koruması, rate limiting göstergesi
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, Send, Paperclip, Timer, CheckCheck,
  Trash2, FileText, MoreVertical,
  Shield, Bot, MessageSquareText, Lock, AlertCircle,
  Phone, Video, Mic, MicOff
} from 'lucide-react';
import { toast } from 'sonner';
import type { DecryptedPayload } from '@/contexts/ChatContext';
import type { CallType } from '@/lib/webrtc';
import { validateMessage, isAllowedFile, formatLastSeen } from '@/lib/security';
import { SpeechToTextManager, isSTTSupported } from '@/lib/speechToText';

interface ChatAreaProps {
  onBack: () => void;
  highlightMessageId?: string | null;
  onStartCall?: (calleeDeviceId: string, calleeUsername: string, callType: CallType) => void;
}

export default function ChatArea({ onBack, highlightMessageId, onStartCall }: ChatAreaProps) {
  const {
    activeChannel, messages, decryptedMessages, deviceId,
    sendMessage, sendMediaMessage, deleteMessage, sendTypingSignal,
    typingUsers, users, isAdmin, currentUser
  } = useChatContext();
  const { t } = useLanguage();

  const [text, setText] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const sttRef = useRef<SpeechToTextManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  // STT (Sesli Yazma) başlat/durdur
  const handleToggleSTT = useCallback(() => {
    if (!isSTTSupported()) {
      toast.error('Tarayıcınız sesli yazmayı desteklemiyor');
      return;
    }

    if (isListening) {
      // Durdur ve metni al
      if (sttRef.current) {
        const result = sttRef.current.stop();
        if (result) {
          setText(prev => (prev ? prev + ' ' : '') + result);
        }
        sttRef.current.destroy();
        sttRef.current = null;
      }
      setIsListening(false);
    } else {
      // Başlat
      const stt = new SpeechToTextManager('tr-TR');
      stt.setOnResult((r) => {
        if (!r.isFinal) {
          // Geçici sonuç - placeholder olarak göster
        }
      });
      stt.setOnFinalResult((finalText) => {
        setText(prev => (prev ? prev + ' ' : '') + finalText);
      });
      stt.setOnError((err) => {
        toast.error(err);
        setIsListening(false);
      });
      sttRef.current = stt;
      stt.start();
      setIsListening(true);
    }
  }, [isListening]);

  // STT cleanup on unmount
  useEffect(() => {
    return () => {
      if (sttRef.current) {
        sttRef.current.destroy();
        sttRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    
    const validation = validateMessage(trimmed);
    if (!validation.valid) {
      toast.error(validation.reason);
      return;
    }
    
    setSending(true);
    try {
      await sendMessage(trimmed, timerSeconds > 0 ? timerSeconds : undefined);
      setText('');
      setTimerSeconds(0);
      setShowTimer(false);
    } catch (err) {
      toast.error((err as Error).message || t.messageFailed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = () => {
    sendTypingSignal();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      // Typing durdu sinyali: 2 saniye sonra typing göstergesini temizle
      // (Broadcast typing sinyali zaten timeout ile karşı tarafta temizlenir)
    }, 2000);
  };

  // Güvenli URL açma: sadece http/https protokollerine izin ver (XSS koruması)
  const safeOpenUrl = (url: string | undefined) => {
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      // Geçersiz URL - açma
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fileCheck = isAllowedFile(file);
    if (!fileCheck.allowed) {
      toast.error(fileCheck.reason);
      e.target.value = '';
      return;
    }
    try {
      await sendMediaMessage(file);
      toast.success(t.fileSent);
    } catch (err) {
      toast.error((err as Error).message || t.fileFailed);
    }
    e.target.value = '';
  };

  const getUserForMessage = (msgDeviceId: string) => {
    return users.find(u => u.device_id === msgDeviceId);
  };

  const typingText = Array.from(typingUsers.values()).join(', ');

  if (!activeChannel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0b141a]">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#00a884]/10 to-[#00a884]/5 flex items-center justify-center mb-6">
          <Shield className="w-16 h-16 text-[#00a884]/30" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white/80 font-[Noto_Sans] mb-2">{t.appName}</h2>
          <p className="text-[#8696a0] text-sm max-w-sm px-4">
            {t.e2eEncrypted}. Sol taraftan bir sohbet seçerek başlayın.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-[#00a884] text-xs">
            <Lock className="w-3.5 h-3.5" />
            <span>{t.messagesEncrypted}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0b141a]">
      {/* Header - Mobil optimizasyonlu */}
      <div className="h-14 sm:h-16 flex items-center gap-2 sm:gap-3 px-2 sm:px-4 bg-[#202c33] shrink-0 border-b border-white/5">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Geri" className="md:hidden text-[#8696a0] hover:text-white w-8 h-8 sm:w-10 sm:h-10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        {activeChannel.name === 'Sistem Botu' ? (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#00a884] to-[#025144] flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
        ) : (
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#2a3942] flex items-center justify-center shrink-0">
            <MessageSquareText className="w-4 h-4 sm:w-5 sm:h-5 text-[#8696a0]" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm truncate">{activeChannel.name}</h3>
          {typingText ? (
            <p className="text-[#00a884] text-xs animate-pulse">{typingText} {t.typing}</p>
          ) : (
            <p className="text-[#8696a0] text-xs">
              {activeChannel.name === 'Sistem Botu' ? t.aiAssistant + ' - Gemini' : 
               activeChannel.is_private ? t.privateMessages : `${users.length} ${t.members}`}
            </p>
          )}
        </div>

        {/* Arama Butonları - Sadece özel odalarda */}
        {activeChannel.is_private && activeChannel.name !== 'Sistem Botu' && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-[#8696a0] hover:text-white w-8 h-8"
              onClick={() => {
                if (onStartCall && activeChannel?.assigned_device_id) {
                  const callee = users.find(u => u.device_id === activeChannel.assigned_device_id);
                  if (callee) {
                    onStartCall(callee.device_id, callee.username, 'audio');
                  } else {
                    toast.error('Karşı taraf bulunamadı');
                  }
                } else {
                  toast.info('Sesli arama sadece özel odalarda kullanılabilir');
                }
              }}
              aria-label="Sesli Arama"
            >
              <Phone className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-[#8696a0] hover:text-white w-8 h-8"
              onClick={() => {
                if (onStartCall && activeChannel?.assigned_device_id) {
                  const callee = users.find(u => u.device_id === activeChannel.assigned_device_id);
                  if (callee) {
                    onStartCall(callee.device_id, callee.username, 'video');
                  } else {
                    toast.error('Karşı taraf bulunamadı');
                  }
                } else {
                  toast.info('Görüntülü arama sadece özel odalarda kullanılabilir');
                }
              }}
              aria-label="Görüntülü Arama"
            >
              <Video className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Security indicator */}
        <div className="flex items-center gap-1 bg-[#00a884]/10 px-2 py-1 rounded-full">
          <Lock className="w-3 h-3 text-[#00a884]" />
          <span className="text-[#00a884] text-[10px] font-medium hidden sm:inline">E2EE</span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-2 sm:px-4 py-2 sm:py-3">
        <div className="space-y-1 max-w-3xl mx-auto">
          {/* Encryption notice */}
          {messages.length === 0 && (
            <div className="flex justify-center my-4">
              <div className="bg-[#1a2730] text-[#8696a0] text-xs px-4 py-2 rounded-lg flex items-center gap-2">
                <Lock className="w-3 h-3 text-[#00a884]" />
                <span>Mesajlar uçtan uca şifrelidir. Sadece bu sohbetin üyeleri okuyabilir.</span>
              </div>
            </div>
          )}

          {messages.map(msg => {
            const payload = decryptedMessages.get(msg.id) as DecryptedPayload | undefined;
            if (!payload) {
              // Decrypt henüz tamamlanmadı veya başarısız — yükleniyor göster
              return (
                <div key={msg.id} className="flex justify-center my-1">
                  <div className="bg-[#1a2730] text-[#8696a0]/30 text-[10px] px-3 py-1 rounded-full flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>···</span>
                  </div>
                </div>
              );
            }
            if (payload.sender === 'SYSTEM') return null;

            const isMine = msg.device_id === deviceId;
            const user = getUserForMessage(msg.device_id);
            const isTimerMsg = payload.timer && payload.timer > 0;

            const isHighlighted = highlightMessageId === msg.id;

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                ref={isHighlighted ? (el) => { if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } : undefined}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'} group mb-1 transition-all duration-500 ${isHighlighted ? 'bg-[#00a884]/10 rounded-lg ring-1 ring-[#00a884]/30 py-1 px-1' : ''}`}
              >
                {/* Avatar for others */}
                {!isMine && (
                  <Avatar className="w-7 h-7 mr-2 mt-1 shrink-0">
                    <AvatarImage src={user?.avatar_url || ''} />
                    <AvatarFallback className="bg-[#2a3942] text-[#8696a0] text-xs">
                      {payload.sender?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className={`max-w-[85%] sm:max-w-[75%] relative ${isMine ? 'order-1' : ''}`}>
                  {/* Bubble */}
                  <div className={`rounded-lg px-3 py-2 shadow-sm ${
                    isMine
                      ? 'bg-[#005c4b] text-white rounded-tr-none'
                      : 'bg-[#202c33] text-white rounded-tl-none'
                  }`}>
                    {/* Sender name for group chats */}
                    {!isMine && !activeChannel.is_private && (
                      <p className="text-[#00a884] text-xs font-semibold mb-0.5">{payload.sender}</p>
                    )}

                    {/* Content */}
                    {payload.type === 'image' && payload.fileUrl ? (
                      <div>
                        <img src={payload.fileUrl} alt={t.photo} className="rounded-md max-w-full max-h-64 object-cover mb-1 cursor-pointer hover:opacity-90 transition-opacity" 
                          onClick={() => safeOpenUrl(payload.fileUrl)} />
                      </div>
                    ) : payload.type === 'file' && payload.fileUrl ? (
                      <a href={payload.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-white/5 rounded-md p-2 mb-1 hover:bg-white/10 transition-colors">
                        <FileText className="w-8 h-8 text-[#00a884]" />
                        <span className="text-sm truncate">{payload.fileName || t.file}</span>
                      </a>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{payload.text}</p>
                    )}

                    {/* Footer: time + ticks + timer */}
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      {isTimerMsg && (
                        <Timer className="w-3 h-3 text-yellow-400" />
                      )}
                      <span className="text-[10px] text-white/50">{msg.time}</span>
                      {isMine && (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      )}
                    </div>
                  </div>

                  {/* Delete button (admin or own message) */}
                  {(isAdmin || isMine) && (
                    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1 z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-6 h-6 bg-[#202c33] rounded-full shadow-md hover:bg-[#2a3942]">
                            <MoreVertical className="w-3 h-3 text-[#8696a0]" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-[#233138] border-white/10 text-white">
                          <DropdownMenuItem onClick={() => deleteMessage(msg.id)}
                            className="text-red-400 focus:text-red-400 focus:bg-red-400/10">
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Timer bar */}
      {showTimer && (
        <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-[#1a2730] border-t border-white/5 flex items-center gap-1.5 sm:gap-3 overflow-x-auto">
          <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 shrink-0" />
          <span className="text-[#8696a0] text-[10px] sm:text-xs shrink-0">{t.timedMessage}:</span>
          <div className="flex gap-1 sm:gap-2">
            {[5, 10, 30, 60, 300].map(sec => (
              <Button key={sec} size="sm" variant={timerSeconds === sec ? 'default' : 'ghost'}
                onClick={() => setTimerSeconds(sec)}
                className={`h-6 sm:h-7 text-[10px] sm:text-xs rounded-full px-2 sm:px-3 ${timerSeconds === sec ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:text-white'}`}>
                {sec < 60 ? `${sec}s` : `${sec / 60}dk`}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setShowTimer(false); setTimerSeconds(0); }}
            className="text-red-400 hover:text-red-300 text-[10px] sm:text-xs ml-auto shrink-0">
            {t.cancel}
          </Button>
        </div>
      )}

      {/* Input - Mobil optimizasyonlu */}
      <div className="px-2 sm:px-4 py-2 sm:py-3 bg-[#202c33] flex items-center gap-1.5 sm:gap-2 shrink-0 border-t border-white/5" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip" />
        
        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} aria-label="Dosya ekle"
          className="text-[#8696a0] hover:text-white hover:bg-white/5 rounded-full shrink-0 w-8 h-8 sm:w-10 sm:h-10">
          <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>

        <Button variant="ghost" size="icon" onClick={() => setShowTimer(!showTimer)} aria-label="Zamanlayıcı"
          className={`rounded-full shrink-0 w-8 h-8 sm:w-10 sm:h-10 ${showTimer || timerSeconds > 0 ? 'text-yellow-400' : 'text-[#8696a0] hover:text-white hover:bg-white/5'}`}>
          <Timer className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <Input
            value={text}
            onChange={(e) => { setText(e.target.value); handleTyping(); }}
            onKeyDown={handleKeyDown}
            placeholder={t.typeMessage}
            className="bg-[#2a3942] border-none text-white placeholder:text-[#8696a0]/50 h-9 sm:h-10 rounded-full px-3 sm:px-4 text-sm focus-visible:ring-0 w-full"
            disabled={sending}
          />
        </div>

        {/* Sesli Yazma Butonu */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggleSTT}
          aria-label={isListening ? 'Sesli yazmayı durdur' : 'Sesli yaz'}
          className={`rounded-full shrink-0 w-8 h-8 sm:w-10 sm:h-10 transition-all duration-200 ${
            isListening
              ? 'text-red-400 bg-red-500/20 hover:bg-red-500/30 animate-pulse'
              : 'text-[#8696a0] hover:text-white hover:bg-white/5'
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
        </Button>

        <Button onClick={handleSend} size="icon" disabled={!text.trim() || sending} aria-label="Mesaj gönder"
          className="bg-[#00a884] hover:bg-[#00a884]/90 text-white rounded-full w-9 h-9 sm:w-10 sm:h-10 shrink-0 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100">
          <Send className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
      </div>
    </div>
  );
}
