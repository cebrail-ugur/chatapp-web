/**
 * ChatApp Ultra - Arama Ekranı (Sesli / Görüntülü)
 * WebRTC P2P - Server medyayı görmez
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X } from 'lucide-react';
import { WebRTCManager, CallState, CallInfo, CallType } from '../lib/webrtc';

interface CallScreenProps {
  webrtc: WebRTCManager;
  onClose: () => void;
}

export function CallScreen({ webrtc, onClose }: CallScreenProps) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callInfo, setCallInfo] = useState<CallInfo | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    webrtc.setOnStateChange((state: CallState, info: CallInfo) => {
      setCallState(state);
      setCallInfo(info);
    });

    webrtc.setOnRemoteStream((stream: MediaStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [webrtc]);

  // Local stream'i video element'e bağla
  useEffect(() => {
    if (callState === 'connected') {
      const localStream = webrtc.getLocalStream();
      if (localStream && localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      // Süre sayacı başlat
      durationTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (durationTimerRef.current && callState !== 'connected') {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [callState, webrtc]);

  const handleToggleMute = useCallback(() => {
    const newState = webrtc.toggleMute();
    setIsMuted(!newState);
  }, [webrtc]);

  const handleToggleVideo = useCallback(() => {
    const newState = webrtc.toggleVideo();
    setIsVideoOff(!newState);
  }, [webrtc]);

  const handleEndCall = useCallback(async () => {
    await webrtc.endCall();
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }
    onClose();
  }, [webrtc, onClose]);

  const handleAcceptCall = useCallback(async () => {
    await webrtc.acceptCall();
  }, [webrtc]);

  const handleRejectCall = useCallback(async () => {
    await webrtc.rejectCall();
    onClose();
  }, [webrtc, onClose]);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getStateText = (): string => {
    switch (callState) {
      case 'calling': return 'Aranıyor...';
      case 'ringing': return 'Gelen Arama';
      case 'connected': return formatDuration(callDuration);
      case 'ended': return 'Arama Sonlandı';
      case 'failed': return 'Bağlantı Başarısız';
      default: return '';
    }
  };

  const isVideoCall = callInfo?.callType === 'video';

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center">
      {/* Üst Bilgi */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          aria-label="Kapat"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white/60 text-sm">E2E Şifreli</span>
        </div>
      </div>

      {/* Video Alanı */}
      {isVideoCall && callState === 'connected' && (
        <>
          {/* Remote Video (Tam Ekran) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Local Video (Küçük PiP) */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute top-20 right-4 w-32 h-44 sm:w-40 sm:h-56 rounded-2xl object-cover border-2 border-white/20 shadow-2xl"
          />
        </>
      )}

      {/* Ses Araması veya Bağlantı Bekleniyor */}
      {(!isVideoCall || callState !== 'connected') && (
        <div className="flex flex-col items-center gap-6">
          {/* Avatar */}
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/20">
            <span className="text-4xl sm:text-5xl font-bold text-white">
              {(callInfo?.callerUsername || callInfo?.calleeUsername || '?')[0]?.toUpperCase()}
            </span>
          </div>

          {/* İsim */}
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {callState === 'ringing'
              ? callInfo?.callerUsername
              : callInfo?.calleeUsername || 'Bilinmeyen'}
          </h2>

          {/* Durum */}
          <p className="text-white/60 text-lg">{getStateText()}</p>

          {/* Arama Animasyonu */}
          {(callState === 'calling' || callState === 'ringing') && (
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-emerald-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alt Kontroller */}
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
        {/* Gelen Arama: Kabul / Reddet */}
        {callState === 'ringing' && (
          <div className="flex items-center justify-center gap-12">
            <button
              onClick={handleRejectCall}
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors active:scale-95"
              aria-label="Aramayı Reddet"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <button
              onClick={handleAcceptCall}
              className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-colors active:scale-95 animate-pulse"
              aria-label="Aramayı Kabul Et"
            >
              <Phone className="w-7 h-7 text-white" />
            </button>
          </div>
        )}

        {/* Aktif Arama: Mute / Video / Kapat */}
        {(callState === 'calling' || callState === 'connected') && (
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={handleToggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                isMuted ? 'bg-red-500/80' : 'bg-white/15 hover:bg-white/25'
              }`}
              aria-label={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}
            >
              {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </button>

            {isVideoCall && (
              <button
                onClick={handleToggleVideo}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                  isVideoOff ? 'bg-red-500/80' : 'bg-white/15 hover:bg-white/25'
                }`}
                aria-label={isVideoOff ? 'Kamerayı Aç' : 'Kamerayı Kapat'}
              >
                {isVideoOff ? <VideoOff className="w-6 h-6 text-white" /> : <Video className="w-6 h-6 text-white" />}
              </button>
            )}

            <button
              onClick={handleEndCall}
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors active:scale-95"
              aria-label="Aramayı Sonlandır"
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gelen Arama Bildirimi (Overlay) ──
interface IncomingCallProps {
  callInfo: CallInfo;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallOverlay({ callInfo, onAccept, onReject }: IncomingCallProps) {
  return (
    <div className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-sm animate-in slide-in-from-top">
      <div className="bg-gray-900/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-white/10">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-white">
              {callInfo.callerUsername[0]?.toUpperCase()}
            </span>
          </div>

          {/* Bilgi */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{callInfo.callerUsername}</p>
            <p className="text-white/50 text-sm">
              {callInfo.callType === 'video' ? '📹 Görüntülü Arama' : '📞 Sesli Arama'}
            </p>
          </div>

          {/* Butonlar */}
          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors active:scale-95"
              aria-label="Reddet"
            >
              <PhoneOff className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={onAccept}
              className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center hover:bg-emerald-600 transition-colors active:scale-95 animate-pulse"
              aria-label="Kabul Et"
            >
              <Phone className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
