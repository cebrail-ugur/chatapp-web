/**
 * GlobalSearch - Tüm kanallardaki şifreli mesajlarda arama
 * Mesajlar client-side'da çözümlenip aranır (E2EE korunur)
 * Arama sonuçları kanal adı, gönderen, tarih ile gösterilir
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { decrypt } from '@/lib/protocol';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Search, X, Hash, Lock, Bot, Clock, ArrowRight,
  MessageSquare, Shield, Loader2, SearchX, Filter
} from 'lucide-react';
import type { Channel, DecryptedPayload } from '@/contexts/ChatContext';

interface SearchResult {
  messageId: string;
  channelId: string;
  channelName: string;
  channelType: 'public' | 'private' | 'bot';
  sender: string;
  text: string;
  time: string;
  timestamp: number;
  matchIndices: [number, number][]; // Eşleşen kısımların başlangıç-bitiş indeksleri
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMessage: (channelId: string, messageId: string) => void;
}

export default function GlobalSearch({ isOpen, onClose, onNavigateToMessage }: GlobalSearchProps) {
  const { workspace, channels, users } = useChatContext();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'public' | 'private' | 'bot'>('all');
  const [totalMessagesScanned, setTotalMessagesScanned] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Panel açıldığında input'a fokusla
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setTotalMessagesScanned(0);
    }
  }, [isOpen]);

  // Kanal tipini belirle
  const getChannelType = (channel: Channel): 'public' | 'private' | 'bot' => {
    if (channel.name === 'Sistem Botu') return 'bot';
    if (channel.is_private) return 'private';
    return 'public';
  };

  // Eşleşen kısımları bul (case-insensitive)
  const findMatchIndices = (text: string, searchQuery: string): [number, number][] => {
    const indices: [number, number][] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = searchQuery.toLowerCase();
    let startIndex = 0;

    while (startIndex < lowerText.length) {
      const foundIndex = lowerText.indexOf(lowerQuery, startIndex);
      if (foundIndex === -1) break;
      indices.push([foundIndex, foundIndex + lowerQuery.length]);
      startIndex = foundIndex + 1;
    }

    return indices;
  };

  // Global arama fonksiyonu - tüm kanallardaki mesajları çözümle ve ara
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!workspace || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    const searchResults: SearchResult[] = [];
    let scannedCount = 0;

    try {
      // Filtreye göre kanalları belirle
      const searchChannels = channels.filter(ch => {
        if (selectedFilter === 'all') return true;
        return getChannelType(ch) === selectedFilter;
      });

      // Her kanalın mesajlarını Supabase'den çek ve çözümle
      for (const channel of searchChannels) {
        try {
          const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('channel_id', channel.id)
            .order('timestamp', { ascending: false })
            .limit(500); // Her kanaldan max 500 mesaj

          if (error || !messages) continue;

          scannedCount += messages.length;

          for (const msg of messages) {
            try {
              const decrypted = await decrypt(msg.payload, workspace.id, channel.id) as DecryptedPayload;
              if (!decrypted || !decrypted.text) continue;

              const lowerText = decrypted.text.toLowerCase();
              const lowerQuery = searchQuery.toLowerCase().trim();

              // Metin içinde arama yap
              if (lowerText.includes(lowerQuery) || decrypted.sender?.toLowerCase().includes(lowerQuery)) {
                const matchIndices = findMatchIndices(decrypted.text, searchQuery.trim());
                
                searchResults.push({
                  messageId: msg.id,
                  channelId: channel.id,
                  channelName: channel.name,
                  channelType: getChannelType(channel),
                  sender: decrypted.sender || 'Bilinmeyen',
                  text: decrypted.text,
                  time: msg.time || '',
                  timestamp: msg.timestamp,
                  matchIndices
                });
              }
            } catch {
              // Çözümlenemeyen mesajları atla
              continue;
            }
          }
        } catch {
          continue;
        }
      }

      // Sonuçları tarihe göre sırala (en yeni önce)
      searchResults.sort((a, b) => b.timestamp - a.timestamp);
      setResults(searchResults);
      setTotalMessagesScanned(scannedCount);
    } catch (e) {
      console.error('[GlobalSearch] Arama hatası:', e);
    } finally {
      setIsSearching(false);
    }
  }, [workspace, channels, selectedFilter]);

  // Debounced arama - kullanıcı yazmayı bıraktıktan 500ms sonra ara
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(value);
      }, 500);
    } else {
      setResults([]);
      setHasSearched(false);
    }
  };

  // Enter tuşu ile anında arama
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim().length >= 2) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      performSearch(query);
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Sonuç metnini highlight ile göster
  const renderHighlightedText = (text: string, indices: [number, number][]) => {
    if (indices.length === 0) {
      return <span>{text.length > 120 ? text.substring(0, 120) + '...' : text}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Eşleşen ilk kısma göre metin kırp
    const firstMatchStart = indices[0][0];
    const contextStart = Math.max(0, firstMatchStart - 40);
    const contextEnd = Math.min(text.length, firstMatchStart + 100);
    const displayText = text.substring(contextStart, contextEnd);
    const adjustedIndices = indices
      .filter(([s]) => s >= contextStart && s < contextEnd)
      .map(([s, e]): [number, number] => [s - contextStart, Math.min(e - contextStart, displayText.length)]);

    lastIndex = 0;
    for (const [start, end] of adjustedIndices) {
      if (start > lastIndex) {
        parts.push(<span key={`t-${lastIndex}`}>{displayText.substring(lastIndex, start)}</span>);
      }
      parts.push(
        <span key={`h-${start}`} className="bg-[#00a884]/30 text-[#00a884] font-semibold rounded px-0.5">
          {displayText.substring(start, end)}
        </span>
      );
      lastIndex = end;
    }
    if (lastIndex < displayText.length) {
      parts.push(<span key={`t-${lastIndex}`}>{displayText.substring(lastIndex)}</span>);
    }

    return (
      <span>
        {contextStart > 0 && <span className="text-[#8696a0]">...</span>}
        {parts}
        {contextEnd < text.length && <span className="text-[#8696a0]">...</span>}
      </span>
    );
  };

  // Kanal ikonu
  const getChannelIcon = (type: 'public' | 'private' | 'bot') => {
    switch (type) {
      case 'bot': return <Bot className="w-3.5 h-3.5 text-[#00a884]" />;
      case 'private': return <Lock className="w-3.5 h-3.5 text-[#8696a0]" />;
      default: return <Hash className="w-3.5 h-3.5 text-[#8696a0]" />;
    }
  };

  // Filtre butonları
  const filterOptions = [
    { key: 'all' as const, label: 'Tümü', icon: MessageSquare },
    { key: 'public' as const, label: 'Genel', icon: Hash },
    { key: 'private' as const, label: 'Özel', icon: Lock },
    { key: 'bot' as const, label: 'Bot', icon: Bot },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] sm:pt-[10vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Search Panel */}
      <div className="relative w-full max-w-2xl mx-4 bg-[#111b21] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33] border-b border-white/5">
          <Search className="w-5 h-5 text-[#00a884] shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tüm kanallarda mesaj ara... (min. 2 karakter)"
            className="bg-transparent border-none text-white placeholder:text-[#8696a0]/60 h-10 text-base focus-visible:ring-0 px-0"
          />
          {query && (
            <Button
              variant="ghost" size="icon" aria-label="Aramayı temizle"
              onClick={() => { setQuery(''); setResults([]); setHasSearched(false); inputRef.current?.focus(); }}
              className="text-[#8696a0] hover:text-white hover:bg-white/5 rounded-full shrink-0 w-8 h-8"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost" size="icon" aria-label="Aramayı kapat"
            onClick={onClose}
            className="text-[#8696a0] hover:text-white hover:bg-white/5 rounded-full shrink-0 w-8 h-8"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Filtreler */}
        <div className="flex items-center gap-2 px-4 py-2 bg-[#0b141a] border-b border-white/5 overflow-x-auto">
          <Filter className="w-3.5 h-3.5 text-[#8696a0] shrink-0" />
          {filterOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => {
                setSelectedFilter(opt.key);
                if (query.trim().length >= 2) {
                  setTimeout(() => performSearch(query), 100);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                selectedFilter === opt.key
                  ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30'
                  : 'bg-[#202c33] text-[#8696a0] border border-transparent hover:bg-[#2a3942] hover:text-white'
              }`}
            >
              <opt.icon className="w-3 h-3" />
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sonuçlar */}
        <ScrollArea className="max-h-[60vh]">
          {/* Yükleniyor */}
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
              <p className="text-[#8696a0] text-sm">Şifreli mesajlar çözümleniyor ve aranıyor...</p>
              <p className="text-[#8696a0]/60 text-xs flex items-center gap-1">
                <Shield className="w-3 h-3" /> Arama cihazınızda yapılır, sunucuya gönderilmez
              </p>
            </div>
          )}

          {/* Sonuç yok */}
          {!isSearching && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <SearchX className="w-12 h-12 text-[#8696a0]/40" />
              <p className="text-[#8696a0] text-sm">
                "<span className="text-white font-medium">{query}</span>" için sonuç bulunamadı
              </p>
              <p className="text-[#8696a0]/60 text-xs">
                {totalMessagesScanned} mesaj tarandı • Farklı anahtar kelimeler deneyin
              </p>
            </div>
          )}

          {/* Başlangıç durumu */}
          {!isSearching && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-16 h-16 rounded-full bg-[#202c33] flex items-center justify-center">
                <Search className="w-8 h-8 text-[#8696a0]/40" />
              </div>
              <p className="text-[#8696a0] text-sm text-center px-8">
                Tüm kanallardaki mesajlar içinde arama yapın
              </p>
              <div className="flex items-center gap-4 text-[#8696a0]/50 text-xs">
                <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> E2EE Korumalı</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Anlık Sonuç</span>
              </div>
            </div>
          )}

          {/* Sonuç listesi */}
          {!isSearching && results.length > 0 && (
            <div>
              {/* Sonuç sayısı */}
              <div className="px-4 py-2 bg-[#0b141a] border-b border-white/5">
                <p className="text-[#8696a0] text-xs">
                  <span className="text-white font-semibold">{results.length}</span> sonuç bulundu
                  <span className="text-[#8696a0]/50 ml-2">• {totalMessagesScanned} mesaj tarandı</span>
                </p>
              </div>

              {/* Sonuçlar */}
              <div className="divide-y divide-white/5">
                {results.map((result) => (
                  <button
                    key={result.messageId}
                    onClick={() => {
                      onNavigateToMessage(result.channelId, result.messageId);
                      onClose();
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[#202c33] transition-colors text-left group"
                  >
                    {/* Avatar */}
                    <Avatar className="w-10 h-10 shrink-0 mt-0.5">
                      <AvatarFallback className={`text-sm font-semibold ${
                        result.channelType === 'bot'
                          ? 'bg-[#00a884]/20 text-[#00a884]'
                          : 'bg-[#2a3942] text-[#8696a0]'
                      }`}>
                        {result.sender.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* İçerik */}
                    <div className="flex-1 min-w-0">
                      {/* Üst satır: Gönderen + Kanal + Zaman */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white text-sm font-medium truncate">{result.sender}</span>
                        <span className="text-[#8696a0]/40">•</span>
                        <span className="flex items-center gap-1 text-[#8696a0] text-xs shrink-0">
                          {getChannelIcon(result.channelType)}
                          <span className="truncate max-w-[120px]">{result.channelName}</span>
                        </span>
                        <span className="text-[#8696a0]/40 ml-auto shrink-0 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {result.time}
                        </span>
                      </div>

                      {/* Mesaj metni (highlight ile) */}
                      <p className="text-[#8696a0] text-sm leading-relaxed line-clamp-2">
                        {renderHighlightedText(result.text, result.matchIndices)}
                      </p>
                    </div>

                    {/* Git ikonu */}
                    <ArrowRight className="w-4 h-4 text-[#8696a0]/30 group-hover:text-[#00a884] transition-colors shrink-0 mt-2" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer - Güvenlik notu */}
        <div className="px-4 py-2 bg-[#0b141a] border-t border-white/5 flex items-center justify-center gap-2">
          <Shield className="w-3 h-3 text-[#00a884]/60" />
          <p className="text-[#8696a0]/50 text-[10px]">
            Arama tamamen cihazınızda yapılır. Mesajlar sunucuya çözümlenmeden gönderilmez.
          </p>
        </div>
      </div>
    </div>
  );
}
