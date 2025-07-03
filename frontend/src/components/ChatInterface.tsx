'use client';

import { useState, useRef, useEffect } from 'react';
import MessageInput from './MessageInput';
import MessageDisplay from './MessageDisplay';
import { useVoiceRecorder } from './useVoiceRecorder';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  done?: boolean;
}

interface ChatInterfaceProps {
  apiKey: string;
  model: string;
}

export default function ChatInterface({ apiKey, model }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfSessionId, setPdfSessionId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle PDF file selection and upload
  const handlePdfButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    try {
      const res = await fetch('/api/upload_pdf', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to upload PDF');
      const data = await res.json();
      setPdfSessionId(data.session_id);
    } catch (err) {
      setUploadError('Failed to upload or index PDF.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Clear PDF session
  const handleClearPdf = () => {
    setPdfSessionId(null);
    setUploadError(null);
  };

  // Handle sending a message (normal or PDF RAG)
  const handleSendMessage = async (userMessage: string, deepDive: boolean) => {
    if (!userMessage.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    try {
      let response;
      if (pdfSessionId) {
        // PDF RAG chat
        response = await fetch('/api/pdf_chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: pdfSessionId,
            query: userMessage,
            model,
            api_key: apiKey,
            k: 4
          }),
        });
        if (!response.ok) throw new Error('Failed to get PDF chat response');
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer, done: true }]);
        return;
      }
      // Normal chat
      response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          api_key: apiKey,
          model: model,
          deep_dive: deepDive,
        }),
      });
      if (!response.ok) throw new Error('Failed to get response');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');
      let assistantMessage = '';
      let firstChunk = true;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        assistantMessage += text;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage?.role === 'assistant') {
            lastMessage.content = assistantMessage;
            lastMessage.done = false;
          } else {
            newMessages.push({ role: 'assistant', content: assistantMessage, done: false });
          }
          return newMessages;
        });
        firstChunk = false;
      }
      // Mark the last assistant message as done
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          lastMessage.done = true;
        }
        return newMessages;
      });
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, there was an error processing your message.',
        done: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Voice recorder integration
  const { isRecording, error: voiceError } = useVoiceRecorder((transcribedText) => {
    if (transcribedText && transcribedText.trim()) {
      handleSendMessage(transcribedText, false); // deepDive false by default for voice
    }
  });

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      <div className="h-[600px] flex flex-col">
        <div className="border-b px-4 py-2 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">AI Model:</span>
            <span className="text-sm font-medium text-gray-800 bg-blue-100 px-2 py-1 rounded">
              {model}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <MessageDisplay messages={messages} />
          <div ref={messagesEndRef} />
        </div>
        {/* PDF Active Badge */}
        {pdfSessionId && (
          <div className="flex items-center gap-2 px-4 pb-1">
            <span className="inline-flex items-center bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">
              PDF Active
              <button onClick={handleClearPdf} className="ml-2 text-green-700 hover:text-red-600 focus:outline-none">✕</button>
            </span>
          </div>
        )}
        {/* Upload Error */}
        {uploadError && (
          <div className="px-4 pb-1 text-xs text-red-600">{uploadError}</div>
        )}
        {/* Voice Recording Indicator & Error */}
        <div className="px-4 pb-1">
          {isRecording && (
            <div className="text-blue-700 text-sm font-semibold">Recording... Release spacebar to send</div>
          )}
          {voiceError && (
            <div className="text-red-600 text-xs">{voiceError}</div>
          )}
        </div>
        <div className="border-t p-4 flex items-center gap-2">
          {/* PDF Upload Button */}
          <button
            type="button"
            onClick={handlePdfButtonClick}
            disabled={uploading}
            title="Upload PDF"
            className="p-2 rounded-full bg-gray-200 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
          <input
            type="file"
            name="pdf"
            accept="application/pdf"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex-1">
            <MessageInput onSendMessage={handleSendMessage} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
} 