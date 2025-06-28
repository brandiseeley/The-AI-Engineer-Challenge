'use client';

import { useState } from 'react';

interface ConfigPanelProps {
  onSubmit: (apiKey: string, model: string) => void;
}

// Available OpenAI models with descriptions
const AVAILABLE_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o', description: 'Latest GPT-4 model with improved performance' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Faster and more cost-effective GPT-4 model' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Previous generation GPT-4 with good performance' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fast and cost-effective for most tasks' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', description: 'Current default model' },
];

export default function ConfigPanel({ onSubmit }: ConfigPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4.1-mini');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(apiKey, selectedModel);
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Configuration</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
            OpenAI API Key
          </label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400"
            placeholder="Enter your OpenAI API key"
            required
          />
        </div>
        
        <div>
          <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
            AI Model
          </label>
          <select
            id="model"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
          >
            {AVAILABLE_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label} - {model.description}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Choose the AI model that best fits your needs. Different models have varying capabilities and costs.
          </p>
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Start Chatting
        </button>
      </form>
    </div>
  );
} 