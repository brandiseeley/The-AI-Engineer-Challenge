'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  done?: boolean;
}

interface MessageDisplayProps {
  messages: Message[];
}

export default function MessageDisplay({ messages }: MessageDisplayProps) {
  const lastSpokenIndex = useRef<number | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    console.log('[TTS] useEffect triggered. Messages:', messages);
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      console.warn('[TTS] SpeechSynthesis API not available in this browser.');
      return;
    }
    // Find the last assistant message that is done
    const lastAssistantIndex = [...messages].reverse().findIndex(m => m.role === 'assistant' && m.done === true);
    if (lastAssistantIndex === -1) {
      console.log('[TTS] No completed assistant message found.');
      return;
    }
    const actualIndex = messages.length - 1 - lastAssistantIndex;
    if (lastSpokenIndex.current === actualIndex) {
      console.log('[TTS] Already spoken for index', actualIndex);
      return; // Already spoken
    }
    const lastAssistantMessage = messages[actualIndex];
    if (!lastAssistantMessage) {
      console.log('[TTS] No last assistant message at index', actualIndex);
      return;
    }
    if (!lastAssistantMessage.content.trim()) {
      console.log('[TTS] Assistant message is empty or whitespace.');
      return;
    }

    // Stop any ongoing speech
    if (window.speechSynthesis.speaking) {
      console.log('[TTS] Cancelling ongoing speech.');
      window.speechSynthesis.cancel();
    }

    // Speak the message
    console.log('[TTS] Speaking:', lastAssistantMessage.content);
    const utterance = new window.SpeechSynthesisUtterance(lastAssistantMessage.content);
    utterance.lang = 'en-US'; // You can make this configurable
    utteranceRef.current = utterance; // Keep reference so it isn't GC'd
    utterance.onend = () => {
      utteranceRef.current = null; // Clean up after speaking
    };
    window.speechSynthesis.speak(utterance);
    lastSpokenIndex.current = actualIndex;
  }, [messages]);

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {message.role === 'assistant' ? (
              <div className="whitespace-pre-wrap text-gray-800">
                <ReactMarkdown>
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="whitespace-pre-wrap">{message.content}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
} 