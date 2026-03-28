/*
 * ChatApp Ultra - Home Page
 * Design: "WhatsApp Evolved" - Modern dark theme with teal accents
 * Typography: Noto Sans (headings 600) + system UI (body 400)
 * Colors: Deep dark bg (#111b21), teal accent (#00a884), panels (#202c33)
 */

import { useChatContext } from '@/contexts/ChatContext';
import LoginScreen from '@/components/LoginScreen';
import ChatScreen from '@/components/ChatScreen';
import { Shield, Loader2 } from 'lucide-react';

export default function Home() {
  const { screen } = useChatContext();

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#111b21]">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-[#00a884]/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-[#00a884]" />
          </div>
          <h1 className="text-xl font-semibold text-white font-[Noto_Sans]">ChatApp Ultra</h1>
          <Loader2 className="w-5 h-5 text-[#00a884] animate-spin" />
        </div>
      </div>
    );
  }

  if (screen === 'login') {
    return <LoginScreen />;
  }

  return <ChatScreen />;
}
