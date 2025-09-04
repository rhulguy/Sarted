import { useState, useEffect, useRef, useCallback } from 'react';

// --- Type Definitions for Web Speech API ---
// These are added to provide type safety for the browser-specific APIs.

// FIX: Define missing related types for the Web Speech API to ensure SpeechRecognitionEvent is valid.
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


// FIX: Define the SpeechRecognition instance type to be used in the component.
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

// FIX: Define the SpeechRecognition constructor type.
interface SpeechRecognitionStatic {
    new (): SpeechRecognition;
}

declare global {
  interface Window {
    // FIX: Use the constructor type to correctly type the window properties and break the circular reference error.
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
  // The ref is now correctly typed with the SpeechRecognition instance interface.
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // The onend event will handle cleanup
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

      // Check for the "next" keyword to finalize a task and continue
      if (fullTranscript.toLowerCase().endsWith('next')) {
        const taskName = fullTranscript.slice(0, -4).trim();
        if (taskName) {
          onTranscriptFinalized(taskName);
        }
        // Reset for the next utterance
        accumulatedTranscript = '';
        setTranscript('');
      }
    };

    recognition.onend = () => {
      // Finalize any remaining transcript when listening stops
      const finalTranscript = accumulatedTranscript.trim();
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
                // This can happen if the user stops it manually or due to no-speech timeout.
                // We'll provide a subtle log instead of an alert for a better UX.
                console.warn('Speech recognition aborted.');
                setIsListening(false);
                return; // Exit without showing a disruptive alert
        }
        alert(errorMessage);
        setIsListening(false);
    };

    recognition.start();
    setIsListening(true);
  }, [isListening, onTranscriptFinalized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return { isListening, transcript, startListening, stopListening };
};