/**
 * ChatApp Ultra - Local Speech-to-Text (Zero Knowledge)
 * Ses verileri ASLA sunucuya gönderilmez
 * Web Speech API (tarayıcı yerel motoru) kullanılır
 * 
 * ❌ Yasak: Google Speech API, Azure Speech, OpenAI Whisper API (cloud)
 * ✔ Doğru: Tarayıcıda yerel STT → AES ile şifreleme → sunucuya encrypted gönderim
 */

// ── STT State ──
export type STTState = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';

export interface STTResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  language: string;
}

// ── Web Speech API Type Definitions ──
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

// ── Browser Compatibility Check ──
function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  if (w.SpeechRecognition) return w.SpeechRecognition as new () => SpeechRecognitionInstance;
  if (w.webkitSpeechRecognition) return w.webkitSpeechRecognition as new () => SpeechRecognitionInstance;
  return null;
}

/**
 * STT desteği var mı kontrol et
 */
export function isSTTSupported(): boolean {
  return getSpeechRecognition() !== null;
}

/**
 * Desteklenen dilleri döndür
 */
export function getSupportedLanguages(): { code: string; name: string }[] {
  return [
    { code: 'tr-TR', name: 'Türkçe' },
    { code: 'en-US', name: 'English' },
    { code: 'de-DE', name: 'Deutsch' },
    { code: 'fr-FR', name: 'Français' },
    { code: 'es-ES', name: 'Español' },
    { code: 'ar-SA', name: 'العربية' },
    { code: 'ru-RU', name: 'Русский' },
    { code: 'zh-CN', name: '中文' },
    { code: 'ja-JP', name: '日本語' },
    { code: 'ko-KR', name: '한국어' },
  ];
}

// ── Speech-to-Text Manager ──
export class SpeechToTextManager {
  private recognition: SpeechRecognitionInstance | null = null;
  private state: STTState = 'idle';
  private language: string = 'tr-TR';
  private fullTranscript: string = '';

  // Callbacks
  private onStateChange?: (state: STTState) => void;
  private onResult?: (result: STTResult) => void;
  private onFinalResult?: (text: string) => void;
  private onError?: (error: string) => void;

  constructor(language: string = 'tr-TR') {
    this.language = language;
    this.initRecognition();
  }

  // ── Event Handlers ──
  setOnStateChange(cb: (state: STTState) => void): void {
    this.onStateChange = cb;
  }

  setOnResult(cb: (result: STTResult) => void): void {
    this.onResult = cb;
  }

  setOnFinalResult(cb: (text: string) => void): void {
    this.onFinalResult = cb;
  }

  setOnError(cb: (error: string) => void): void {
    this.onError = cb;
  }

  // ── Recognition Başlat ──
  private initRecognition(): void {
    const SpeechRecognitionClass = getSpeechRecognition();

    if (!SpeechRecognitionClass) {
      this.state = 'unsupported';
      return;
    }

    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.language;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.updateState('listening');
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalTranscript += transcript;
          this.onResult?.({
            text: transcript,
            confidence,
            isFinal: true,
            language: this.language,
          });
        } else {
          interimTranscript += transcript;
          this.onResult?.({
            text: transcript,
            confidence,
            isFinal: false,
            language: this.language,
          });
        }
      }

      if (finalTranscript) {
        this.fullTranscript += (this.fullTranscript ? ' ' : '') + finalTranscript;
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessages: Record<string, string> = {
        'no-speech': 'Ses algılanamadı. Lütfen tekrar deneyin.',
        'audio-capture': 'Mikrofon erişimi reddedildi.',
        'not-allowed': 'Mikrofon izni verilmedi.',
        'network': 'Ağ hatası (yerel STT kullanılıyor).',
        'aborted': 'Dinleme iptal edildi.',
        'language-not-supported': 'Bu dil desteklenmiyor.',
      };

      const message = errorMessages[event.error] || `STT hatası: ${event.error}`;
      this.updateState('error');
      this.onError?.(message);
    };

    this.recognition.onend = () => {
      if (this.state === 'listening') {
        // Otomatik durdu, final result gönder
        if (this.fullTranscript) {
          this.onFinalResult?.(this.fullTranscript.trim());
        }
        this.updateState('idle');
      }
    };

    this.recognition.onspeechend = () => {
      this.updateState('processing');
    };
  }

  // ── Dinlemeyi Başlat ──
  start(): boolean {
    if (this.state === 'unsupported') {
      this.onError?.('Tarayıcınız sesli yazmayı desteklemiyor.');
      return false;
    }

    if (this.state === 'listening') {
      return false; // Zaten dinliyor
    }

    this.fullTranscript = '';

    try {
      this.recognition?.start();
      return true;
    } catch {
      this.onError?.('Sesli yazma başlatılamadı.');
      return false;
    }
  }

  // ── Dinlemeyi Durdur ──
  stop(): string {
    if (this.recognition && this.state === 'listening') {
      this.recognition.stop();
    }
    this.updateState('idle');

    const result = this.fullTranscript.trim();
    this.fullTranscript = '';
    return result;
  }

  // ── Dili Değiştir ──
  setLanguage(lang: string): void {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  // ── Mevcut Durumu Al ──
  getState(): STTState {
    return this.state;
  }

  // ── State Güncelle ──
  private updateState(state: STTState): void {
    this.state = state;
    this.onStateChange?.(state);
  }

  // ── Temizlik ──
  destroy(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Zaten durdurulmuş olabilir
      }
      this.recognition = null;
    }
    this.state = 'idle';
    this.fullTranscript = '';
  }
}
