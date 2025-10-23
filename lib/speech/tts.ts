// lib/speech/tts.ts
export interface TTSOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export class TextToSpeech {
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    }
  }

  isSupported(): boolean {
    return this.synthesis !== null;
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  getItalianVoices(): SpeechSynthesisVoice[] {
    return this.getVoices().filter(voice => voice.lang.startsWith('it'));
  }

  speak(text: string, options: TTSOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      // Stop any ongoing speech
      this.stop();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set options with defaults
      utterance.lang = options.lang || 'it-IT';
      utterance.rate = options.rate || 1;
      utterance.pitch = options.pitch || 1;
      utterance.volume = options.volume || 1;

      // Try to use an Italian voice if available
      const italianVoices = this.getItalianVoices();
      if (italianVoices.length > 0) {
        utterance.voice = italianVoices[0];
      }

      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event) => {
        this.currentUtterance = null;
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      this.currentUtterance = utterance;
      this.synthesis.speak(utterance);
    });
  }

  stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.currentUtterance = null;
    }
  }

  pause(): void {
    if (this.synthesis) {
      this.synthesis.pause();
    }
  }

  resume(): void {
    if (this.synthesis) {
      this.synthesis.resume();
    }
  }

  isSpeaking(): boolean {
    return this.synthesis ? this.synthesis.speaking : false;
  }

  isPaused(): boolean {
    return this.synthesis ? this.synthesis.paused : false;
  }
}

// Singleton instance
let ttsInstance: TextToSpeech | null = null;

export function getTTS(): TextToSpeech {
  if (!ttsInstance) {
    ttsInstance = new TextToSpeech();
  }
  return ttsInstance;
}
