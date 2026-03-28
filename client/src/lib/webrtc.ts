/**
 * ChatApp Ultra - WebRTC P2P Sesli/Görüntülü Arama
 * DTLS-SRTP zorunlu, server medyayı asla görmez
 * Signaling: Supabase Realtime Broadcast
 */

import { supabase } from './supabase';

// ── WebRTC Yapılandırma ──
function buildRtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    iceServers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USERNAME ?? '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL ?? '',
    });
  }

  return { iceServers };
}

// ── Call State ──
export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended' | 'failed';
export type CallType = 'audio' | 'video';

export interface CallInfo {
  callId: string;
  callType: CallType;
  callerDeviceId: string;
  callerUsername: string;
  calleeDeviceId: string;
  calleeUsername: string;
  state: CallState;
  startTime?: number;
  endTime?: number;
}

// ── Signaling Messages ──
interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-request' | 'call-accept' | 'call-reject' | 'call-end' | 'call-busy';
  callId: string;
  from: string;
  fromUsername: string;
  to: string;
  payload?: unknown;
}

// ── WebRTC Manager ──
export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private signalingChannel: ReturnType<typeof supabase.channel> | null = null;
  private callInfo: CallInfo | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];

  // Callbacks
  private onStateChange?: (state: CallState, info: CallInfo) => void;
  private onRemoteStream?: (stream: MediaStream) => void;
  private onIncomingCall?: (info: CallInfo) => void;
  private onCallEnded?: (info: CallInfo) => void;

  private deviceId: string;
  private username: string;
  private workspaceId: string;

  constructor(deviceId: string, username: string, workspaceId: string) {
    this.deviceId = deviceId;
    this.username = username;
    this.workspaceId = workspaceId;
  }

  // ── Event Handlers ──
  setOnStateChange(cb: (state: CallState, info: CallInfo) => void): void {
    this.onStateChange = cb;
  }

  setOnRemoteStream(cb: (stream: MediaStream) => void): void {
    this.onRemoteStream = cb;
  }

  setOnIncomingCall(cb: (info: CallInfo) => void): void {
    this.onIncomingCall = cb;
  }

  setOnCallEnded(cb: (info: CallInfo) => void): void {
    this.onCallEnded = cb;
  }

  // ── Signaling Kanalını Başlat ──
  startSignaling(): void {
    if (this.signalingChannel) return;

    this.signalingChannel = supabase
      .channel(`call_${this.workspaceId}_${this.deviceId}`)
      .on('broadcast', { event: 'signaling' }, (payload) => {
        const msg = payload.payload as SignalingMessage;
        if (msg.to === this.deviceId) {
          this.handleSignalingMessage(msg);
        }
      })
      .subscribe();
  }

  // ── Signaling Mesajı Gönder ──
  private async sendSignaling(msg: SignalingMessage): Promise<void> {
    // Hedef kullanıcının kanalına gönder
    const channel = supabase.channel(`call_${this.workspaceId}_${msg.to}`);
    await channel.send({
      type: 'broadcast',
      event: 'signaling',
      payload: msg,
    });
    supabase.removeChannel(channel);
  }

  // ── Signaling Mesajı İşle ──
  private async handleSignalingMessage(msg: SignalingMessage): Promise<void> {
    switch (msg.type) {
      case 'call-request':
        this.handleIncomingCallRequest(msg);
        break;
      case 'call-accept':
        await this.handleCallAccepted(msg);
        break;
      case 'call-reject':
        this.handleCallRejected();
        break;
      case 'call-busy':
        this.handleCallBusy();
        break;
      case 'offer':
        await this.handleOffer(msg);
        break;
      case 'answer':
        await this.handleAnswer(msg);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(msg);
        break;
      case 'call-end':
        this.handleRemoteCallEnd();
        break;
    }
  }

  // ── Arama Başlat ──
  async startCall(
    calleeDeviceId: string,
    calleeUsername: string,
    callType: CallType
  ): Promise<boolean> {
    if (this.callInfo && this.callInfo.state !== 'idle' && this.callInfo.state !== 'ended') {
      return false; // Zaten aramada
    }

    const callId = crypto.randomUUID();

    this.callInfo = {
      callId,
      callType,
      callerDeviceId: this.deviceId,
      callerUsername: this.username,
      calleeDeviceId,
      calleeUsername,
      state: 'calling',
    };

    this.updateState('calling');

    // Karşı tarafa arama isteği gönder
    await this.sendSignaling({
      type: 'call-request',
      callId,
      from: this.deviceId,
      fromUsername: this.username,
      to: calleeDeviceId,
      payload: { callType },
    });

    // 30 saniye timeout
    setTimeout(() => {
      if (this.callInfo?.state === 'calling') {
        this.endCall();
      }
    }, 30_000);

    return true;
  }

  // ── Gelen Arama İsteği ──
  private handleIncomingCallRequest(msg: SignalingMessage): void {
    if (this.callInfo && this.callInfo.state !== 'idle' && this.callInfo.state !== 'ended') {
      // Meşgulüz
      this.sendSignaling({
        type: 'call-busy',
        callId: msg.callId,
        from: this.deviceId,
        fromUsername: this.username,
        to: msg.from,
      });
      return;
    }

    const payload = msg.payload as { callType: CallType };

    this.callInfo = {
      callId: msg.callId,
      callType: payload.callType,
      callerDeviceId: msg.from,
      callerUsername: msg.fromUsername,
      calleeDeviceId: this.deviceId,
      calleeUsername: this.username,
      state: 'ringing',
    };

    this.updateState('ringing');
    this.onIncomingCall?.(this.callInfo);
  }

  // ── Aramayı Kabul Et ──
  async acceptCall(): Promise<void> {
    if (!this.callInfo || this.callInfo.state !== 'ringing') return;

    // Kabul sinyali gönder
    await this.sendSignaling({
      type: 'call-accept',
      callId: this.callInfo.callId,
      from: this.deviceId,
      fromUsername: this.username,
      to: this.callInfo.callerDeviceId,
    });

    // Medya akışını başlat ve offer bekle
    await this.setupLocalMedia();
  }

  // ── Aramayı Reddet ──
  async rejectCall(): Promise<void> {
    if (!this.callInfo) return;

    await this.sendSignaling({
      type: 'call-reject',
      callId: this.callInfo.callId,
      from: this.deviceId,
      fromUsername: this.username,
      to: this.callInfo.callerDeviceId,
    });

    this.cleanup();
  }

  // ── Arama Kabul Edildi ──
  private async handleCallAccepted(msg: SignalingMessage): Promise<void> {
    if (!this.callInfo || this.callInfo.callId !== msg.callId) return;

    // Medya akışını başlat
    await this.setupLocalMedia();

    // PeerConnection oluştur ve offer gönder
    this.createPeerConnection();

    if (this.localStream && this.peerConnection) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      await this.sendSignaling({
        type: 'offer',
        callId: this.callInfo.callId,
        from: this.deviceId,
        fromUsername: this.username,
        to: this.callInfo.calleeDeviceId,
        payload: { sdp: offer.sdp, type: offer.type },
      });
    }
  }

  // ── Offer İşle ──
  private async handleOffer(msg: SignalingMessage): Promise<void> {
    if (!this.callInfo) return;

    this.createPeerConnection();

    const offerPayload = msg.payload as RTCSessionDescriptionInit;
    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offerPayload));

    // Kuyruktaki ICE candidate'leri ekle
    for (const candidate of this.iceCandidateQueue) {
      await this.peerConnection!.addIceCandidate(new RTCIceCandidate(candidate));
    }
    this.iceCandidateQueue = [];

    // Local stream'i ekle
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Answer oluştur ve gönder
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    await this.sendSignaling({
      type: 'answer',
      callId: this.callInfo.callId,
      from: this.deviceId,
      fromUsername: this.username,
      to: msg.from,
      payload: { sdp: answer.sdp, type: answer.type },
    });
  }

  // ── Answer İşle ──
  private async handleAnswer(msg: SignalingMessage): Promise<void> {
    if (!this.peerConnection) return;

    const answerPayload = msg.payload as RTCSessionDescriptionInit;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerPayload));

    // Kuyruktaki ICE candidate'leri ekle
    for (const candidate of this.iceCandidateQueue) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
    this.iceCandidateQueue = [];
  }

  // ── ICE Candidate İşle ──
  private async handleIceCandidate(msg: SignalingMessage): Promise<void> {
    const candidatePayload = msg.payload as RTCIceCandidateInit;

    if (this.peerConnection && this.peerConnection.remoteDescription) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidatePayload));
    } else {
      // Remote description henüz set edilmedi, kuyruğa ekle
      this.iceCandidateQueue.push(candidatePayload);
    }
  }

  // ── PeerConnection Oluştur ──
  private createPeerConnection(): void {
    if (this.peerConnection) return;

    this.peerConnection = new RTCPeerConnection(buildRtcConfig());

    // ICE Candidate
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.callInfo) {
        const targetDeviceId = this.callInfo.callerDeviceId === this.deviceId
          ? this.callInfo.calleeDeviceId
          : this.callInfo.callerDeviceId;

        this.sendSignaling({
          type: 'ice-candidate',
          callId: this.callInfo.callId,
          from: this.deviceId,
          fromUsername: this.username,
          to: targetDeviceId,
          payload: event.candidate.toJSON(),
        });
      }
    };

    // Remote Stream
    this.peerConnection.ontrack = (event) => {
      if (event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onRemoteStream?.(this.remoteStream);
      }
    };

    // Connection State
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'connected' && this.callInfo) {
        this.callInfo.startTime = Date.now();
        this.updateState('connected');
      } else if (state === 'failed' || state === 'disconnected') {
        this.updateState('failed');
        this.cleanup();
      }
    };

    // ICE Connection State
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      if (state === 'failed') {
        // ICE restart dene
        this.peerConnection?.restartIce();
      }
    };
  }

  // ── Medya Akışını Başlat ──
  private async setupLocalMedia(): Promise<void> {
    if (this.localStream) return;

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: this.callInfo?.callType === 'video',
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.error('[WebRTC] Medya erişimi reddedildi:', err);
      this.updateState('failed');
      this.cleanup();
    }
  }

  // ── Aramayı Sonlandır ──
  async endCall(): Promise<void> {
    if (!this.callInfo) return;

    const targetDeviceId = this.callInfo.callerDeviceId === this.deviceId
      ? this.callInfo.calleeDeviceId
      : this.callInfo.callerDeviceId;

    await this.sendSignaling({
      type: 'call-end',
      callId: this.callInfo.callId,
      from: this.deviceId,
      fromUsername: this.username,
      to: targetDeviceId,
    });

    this.callInfo.endTime = Date.now();
    this.updateState('ended');
    this.onCallEnded?.(this.callInfo);
    this.cleanup();
  }

  // ── Uzaktan Arama Sonlandırma ──
  private handleRemoteCallEnd(): void {
    if (this.callInfo) {
      this.callInfo.endTime = Date.now();
      this.updateState('ended');
      this.onCallEnded?.(this.callInfo);
    }
    this.cleanup();
  }

  // ── Reddedildi / Meşgul ──
  private handleCallRejected(): void {
    this.updateState('ended');
    this.cleanup();
  }

  private handleCallBusy(): void {
    this.updateState('ended');
    this.cleanup();
  }

  // ── Mikrofonu Aç/Kapat ──
  toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  // ── Kamerayı Aç/Kapat ──
  toggleVideo(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  // ── Local Stream'i Al ──
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // ── Remote Stream'i Al ──
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // ── Mevcut Arama Bilgisi ──
  getCallInfo(): CallInfo | null {
    return this.callInfo;
  }

  // ── State Güncelle ──
  private updateState(state: CallState): void {
    if (this.callInfo) {
      this.callInfo.state = state;
      this.onStateChange?.(state, this.callInfo);
    }
  }

  // ── Temizlik ──
  private cleanup(): void {
    // Local stream'i durdur
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Remote stream
    this.remoteStream = null;

    // PeerConnection kapat
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // ICE queue temizle
    this.iceCandidateQueue = [];

    // Call info sıfırla
    if (this.callInfo) {
      this.callInfo.state = 'idle';
    }
  }

  // ── Tam Temizlik (Unmount) ──
  destroy(): void {
    this.cleanup();
    if (this.signalingChannel) {
      supabase.removeChannel(this.signalingChannel);
      this.signalingChannel = null;
    }
  }
}
