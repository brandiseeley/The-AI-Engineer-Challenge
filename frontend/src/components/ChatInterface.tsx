'use client';

import { useState, useRef, useEffect } from 'react';
import MessageInput from './MessageInput';
import MessageDisplay from './MessageDisplay';
import React from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  apiKey: string;
  model: string;
}

export default function ChatInterface({ apiKey, model }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfSessionId, setPdfSessionId] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getSystemMessage = (deepDive: boolean) => {
    if (deepDive) {
      return "You are a helpful AI assistant. When responding, provide thorough, detailed explanations with comprehensive context, examples, and step-by-step breakdowns. Include relevant background information and explore multiple angles of the topic. Be exhaustive in your coverage while maintaining clarity and organization.";
    } else {
      return "You are a helpful AI assistant. Provide clear, concise, and direct responses. Focus on the key points without unnecessary elaboration. Keep explanations brief but informative.";
    }
  };

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setPdfName(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      const res = await fetch('http://localhost:8000/api/upload_pdf', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.session_id) {
        setPdfSessionId(data.session_id);
        setMessages([]); // Optionally clear chat on new PDF
      } else {
        throw new Error(data.error || 'Failed to upload PDF');
      }
    } catch (err) {
      alert('PDF upload failed.');
      setPdfName(null);
      setPdfSessionId(null);
    } finally {
      setUploading(false);
    }
  };

  const handleClearPdf = () => {
    setPdfSessionId(null);
    setPdfName(null);
    setMessages([]);
  };

  const handleSendMessage = async (userMessage: string, deepDive: boolean) => {
    if (!userMessage.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    try {
      let response;
      if (pdfSessionId) {
        // Chat with PDF (RAG)
        response = await fetch('http://localhost:8000/api/chat_pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: pdfSessionId,
            user_message: userMessage,
            api_key: apiKey,
            model: model,
          }),
        });
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.response || data.error || 'Error.' }]);
      } else {
        // Default chat
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_message: userMessage,
            developer_message: getSystemMessage(deepDive),
            api_key: apiKey,
            model: model,
          }),
        });
        if (!response.ok) throw new Error('Failed to get response');
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No reader available');
        let assistantMessage = '';
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
            } else {
              newMessages.push({ role: 'assistant', content: assistantMessage });
            }
            return newMessages;
          });
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, there was an error processing your message.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      <div className="h-[600px] flex flex-col">
        <div className="border-b px-4 py-2 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">AI Model:</span>
            <span className="text-sm font-medium text-gray-800 bg-blue-100 px-2 py-1 rounded">{model}</span>
            <label className="ml-4 cursor-pointer text-sm text-blue-700 hover:underline">
              {uploading ? 'Uploading...' : 'Upload PDF'}
              <input type="file" accept="application/pdf" className="hidden" onChange={handleUploadPdf} disabled={uploading} />
            </label>
            {pdfSessionId && pdfName && (
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Chatting with: {pdfName}
                <button onClick={handleClearPdf} className="ml-2 text-red-500 hover:underline">Clear</button>
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <MessageDisplay messages={messages} />
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t p-4">
          <MessageInput onSendMessage={handleSendMessage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
} 