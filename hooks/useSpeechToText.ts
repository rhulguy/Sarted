import { useState, useEffect, useRef, useCallback } from 'react';

// --- Type Definitions for Web Speech API ---
// These are added to provide type safety for the browser-specific APIs.

interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: SpeechRecognitionErrorCode;
  message: string;
}

type SpeechRecognitionErrorCode =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported';


interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: SpeechRecognitionEvent) => void;
    onend: () => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    start: () => void;
    stop: () => void;
}

interface SpeechRecognitionStatic {
    new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

// Browser compatibility
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

interface UseSpeechToTextOptions {
  onTranscriptFinalized: (transcript: string) => void;
}

export const useSpeechToText = ({ onTranscriptFinalized }: UseSpeechToTextOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef(''); // Ref to hold the final transcript state reliably

  // Update ref whenever transcript state changes
  useEffect(() => {
    finalTranscriptRef.current = transcript;
  }, [transcript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // onend will handle finalization and cleanup
    }
  }, []);

  const startListening = useCallback(() => {
    if (isListening || !SpeechRecognition) {
      if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser. Please try Chrome or Safari.");
      }
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let accumulatedTranscript = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          accumulatedTranscript += transcriptPart;
        } else {
          interimTranscript += transcriptPart;
        }
      }

      const fullTranscript = accumulatedTranscript + interimTranscript;
      setTranscript(fullTranscript);

      if (fullTranscript.toLowerCase().endsWith('next')) {
        const taskName = fullTranscript.slice(0, -4).trim();
        if (taskName) {
          onTranscriptFinalized(taskName);
        }
        accumulatedTranscript = '';
        setTranscript('');
      }
    };

    recognition.onend = () => {
      // Use the ref to get the absolute latest transcript value, avoiding stale closures.
      const finalTranscript = finalTranscriptRef.current.trim();
      if (finalTranscript) {
        onTranscriptFinalized(finalTranscript);
      }
      setIsListening(false);
      setTranscript('');
      recognitionRef.current = null;
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error, event.message);
        let errorMessage = 'An unexpected speech recognition error occurred.';
        switch (event.error) {
            case 'not-allowed':
            case 'service-not-allowed':
                errorMessage = 'Microphone access was denied. Please allow microphone access in your browser settings to use this feature.';
                break;
            case 'network':
                errorMessage = 'Network error during speech recognition. Please check your internet connection and try again.';
                break;
            case 'no-speech':
                errorMessage = 'No speech was detected. Please try again.';
                break;
            case 'audio-capture':
                errorMessage = 'Could not capture audio. Please check your microphone.';
                break;
            case 'aborted':
                console.warn('Speech recognition aborted.');
                setIsListening(false);
                return;
        }
        alert(errorMessage);
        setIsListening(false);
    };

    recognition.start();
    setIsListening(true);
  }, [isListening, onTranscriptFinalized]);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return { isListening, transcript, startListening, stopListening };
};