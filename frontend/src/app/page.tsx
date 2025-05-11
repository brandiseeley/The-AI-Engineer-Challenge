'use client';

import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import ConfigPanel from '@/components/ConfigPanel';

export default function Home() {
  const [apiKey, setApiKey] = useState<string>('');
  const [isConfigured, setIsConfigured] = useState<boolean>(false);

  const handleConfigSubmit = (key: string) => {
    setApiKey(key);
    setIsConfigured(true);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          AI Chat Interface
        </h1>
        
        {!isConfigured ? (
          <ConfigPanel onSubmit={handleConfigSubmit} />
        ) : (
          <ChatInterface apiKey={apiKey} />
        )}
      </div>
    </main>
  );
}
