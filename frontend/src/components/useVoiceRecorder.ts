import { useEffect, useRef, useState } from 'react';

/**
 * useVoiceRecorder (Speech-to-Text)
 * Handles speech recognition via Web Speech API, global spacebar event handling, and beep feedback.
 *
 * @param onTranscription Callback when speech recognition finishes (transcribed text)
 * @returns { isRecording, error }
 */
export function useVoiceRecorder(onTranscription: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textareaFocusedRef = useRef(false);
  const recordingFromTextareaRef = useRef(false);

  // Play a short beep sound
  const playBeep = () => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.1;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 120);
  };

  // Start speech recognition
  const startRecognition = () => {
    setError(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }
    playBeep();
    setTimeout(() => {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onTranscription(transcript);
      };
      recognition.onerror = (event: any) => {
        setError('Speech recognition error: ' + event.error);
      };
      recognition.onend = () => {
        setIsRecording(false);
        playBeep();
        recordingFromTextareaRef.current = false;
      };
      recognition.start();
      setIsRecording(true);
    }, 150); // Delay to allow beep to play first
  };

  // Stop speech recognition
  const stopRecognition = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  };

  // Global spacebar event handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isRecording) {
        // If textarea is focused, only override for long-press
        if (document.activeElement && document.activeElement.tagName === 'TEXTAREA') {
          textareaFocusedRef.current = true;
        } else {
          textareaFocusedRef.current = false;
        }
        pressTimerRef.current = setTimeout(() => {
          // Long press detected
          e.preventDefault();
          if (textareaFocusedRef.current) {
            recordingFromTextareaRef.current = true;
          } else {
            recordingFromTextareaRef.current = false;
          }
          startRecognition();
        }, 300); // 300ms threshold for long-press
      }
      // While recording from textarea, prevent spacebar default
      if (isRecording && recordingFromTextareaRef.current && e.code === 'Space' && document.activeElement && document.activeElement.tagName === 'TEXTAREA') {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (pressTimerRef.current) {
          clearTimeout(pressTimerRef.current);
          pressTimerRef.current = null;
        }
        // If recording, stop
        if (isRecording) {
          e.preventDefault();
          stopRecognition();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
    // eslint-disable-next-line
  }, [isRecording]);

  return { isRecording, error };
} 