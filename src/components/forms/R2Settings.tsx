import React, { useState } from 'react';
import { Settings, Save, X, ShieldCheck } from 'lucide-react';
import { Button } from '../common/Button';
import { StorageConfig } from '../../types';

interface Props {
  config: StorageConfig | null;
  onSave: (config: StorageConfig) => void;
  onClose: () => void;
}

export const R2Settings: React.FC<Props> = ({ config, onSave, onClose }) => {
  // Use config if provided, otherwise try environment variables, otherwise empty
  const getInitialConfig = (): StorageConfig => {
    if (config) return config;

    // Try to get from environment variables (Production)
    const envConfig: StorageConfig = {
      workerUrl: import.meta.env.VITE_WORKER_URL || '',
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
      supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    };

    // Return env config if at least one is set, otherwise empty
    if (envConfig.workerUrl || envConfig.supabaseUrl || envConfig.supabaseKey) {
      return envConfig;
    }

    return {
      workerUrl: '',
      supabaseUrl: '',
      supabaseKey: ''
    };
  };

  const [formData, setFormData] = useState<StorageConfig>(getInitialConfig());

  const handleChange = (field: keyof StorageConfig, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 w-full max-w-md rounded-xl border border-gray-700 shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center text-emerald-400">
            <Settings className="mr-2" size={24} />
            <h2 className="text-xl font-bold">Storage Connection</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="bg-emerald-900/20 border border-emerald-700/50 p-3 rounded mb-4 flex items-start">
          <ShieldCheck size={16} className="text-emerald-500 mt-1 mr-2 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-emerald-200/80 mb-1">
              Secure Connection: Your files are uploaded via a secure backend worker. No secret keys are stored in this browser.
            </p>
            {(import.meta.env.VITE_WORKER_URL || import.meta.env.VITE_SUPABASE_URL) && (
              <p className="text-xs text-emerald-300/60 mt-1">
                ℹ️ Production environment variables detected. These values override manual settings.
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Backend Worker URL</label>
            <input
              required
              type="url"
              value={formData.workerUrl || ''}
              onChange={e => handleChange('workerUrl', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none"
              placeholder="https://my-worker.user.workers.dev"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Deploy the provided <code>worker.js</code> to Cloudflare and paste the URL here.
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Supabase URL</label>
            <input
              required
              type="url"
              value={formData.supabaseUrl || ''}
              onChange={e => handleChange('supabaseUrl', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none"
              placeholder="https://xxxxx.supabase.co"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Your Supabase project URL (from Project Settings &gt; API).
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Supabase Anon Key</label>
            <input
              required
              type="password"
              value={formData.supabaseKey || ''}
              onChange={e => handleChange('supabaseKey', e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white focus:border-emerald-500 outline-none"
              placeholder="eyJhbGci..."
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Your Supabase anon public key (from Project Settings &gt; API).
            </p>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" variant="primary">
              <Save size={16} className="mr-2" /> Connect
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};