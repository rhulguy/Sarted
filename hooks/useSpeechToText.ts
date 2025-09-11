import { useState, useEffect, useRef, useCallback } from 'react';

// --- Type Definitions for Web Speech API ---
// These are added to provide type safety for the browser-specific APIs.

interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    readonly [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: SpeechRecognitionErrorCode;
  readonly message: string;
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
  onError?: (error: string) => void;
}

export const useSpeechToText = ({ onTranscriptFinalized, onError }: UseSpeechToTextOptions) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(''); // For UI display of the current phrase
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const lastProcessedTranscriptRef = useRef(''); // Tracks what has already been submitted

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      // The onend handler will be triggered, which finalizes the transcript.
    }
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current || isListening) return;

    if (!SpeechRecognition) {
      if (onError) onError("Speech recognition is not supported in this browser. Please try Chrome or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let fullTranscript = '';
      // Rebuild the full transcript from all results every time.
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }

      // Determine what content is new since the last time we processed a "next" command.
      const newContentToProcess = fullTranscript.substring(lastProcessedTranscriptRef.current.length);
      const parts = newContentToProcess.split(/\snext\b/i);
      
      // Update UI to show only the currently-being-dictated part.
      setTranscript(parts.length > 0 ? parts[parts.length - 1] : '');

      if (parts.length > 1) {
        // Process all parts that are now considered "complete" because they are followed by "next".
        for (let i = 0; i < parts.length - 1; i++) {
          const taskName = parts[i].trim();
          if (taskName) {
            onTranscriptFinalized(taskName);
          }
          // Update the cursor to include the part we just processed and the "next" keyword.
          lastProcessedTranscriptRef.current += parts[i] + 'next ';
        }
      }
    };

    recognition.onend = () => {
      // The `transcript` state holds the final, unprocessed part of the speech.
      setTranscript(remainingTranscript => {
          const finalTask = remainingTranscript.trim();
          
          if (finalTask) {
              const cleanedFinalTask = finalTask.replace(/\snext\s*$/i, '').trim();
              if (cleanedFinalTask) {
                onTranscriptFinalized(cleanedFinalTask);
              }
          }
          return ''; // Reset UI transcript
      });
      
      setIsListening(false);
      lastProcessedTranscriptRef.current = '';
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
                // This can fire if the user stops talking, so we handle it silently.
                break;
            case 'audio-capture':
                errorMessage = 'Could not capture audio. Please check your microphone.';
                break;
            case 'aborted':
                // User-initiated stop, not an error.
                break;
            default:
                if (onError) onError(errorMessage);
                break;
        }
        
        if (event.error !== 'no-speech' && event.error !== 'aborted' && onError) {
            onError(errorMessage);
        }

        // Ensure cleanup happens on error too
        setIsListening(false);
        lastProcessedTranscriptRef.current = '';
        recognitionRef.current = null;
    };

    recognition.start();
    setIsListening(true);
    lastProcessedTranscriptRef.current = '';
  }, [isListening, onTranscriptFinalized, onError]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  return { isListening, transcript, startListening, stopListening };
};