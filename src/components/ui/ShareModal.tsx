import React, { useState } from 'react';
import { Share2, X, Clock, Lock, Mail, Link as LinkIcon } from 'lucide-react';
import { Button } from '../common/Button';
import { AssetLayer } from '../../types';

interface Props {
  asset: AssetLayer;
  onClose: () => void;
  onShare: (email: string, pin: string, hours: number) => Promise<string>; // Returns the link
}

export const ShareModal: React.FC<Props> = ({ asset, onClose, onShare }) => {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [duration, setDuration] = useState(24); // Hours
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const link = await onShare(email, pin, duration);
      setGeneratedLink(link);
    } catch (error) {
      console.error(error);
      alert("Sharing failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 w-full max-w-md rounded-xl border border-gray-700 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
          <div className="flex items-center text-blue-400">
            <Share2 className="mr-2" size={20} />
            <h3 className="font-bold">Secure Share Asset</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6">
          {!generatedLink ? (
            <form onSubmit={handleShare} className="space-y-4">
              <div className="bg-blue-900/20 border border-blue-800 rounded p-3 mb-4">
                <p className="text-xs text-blue-200">
                  You are sharing <strong>{asset.name}</strong>. The recipient will receive a restricted viewer link. They must enter the PIN below to access the data.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Recipient Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-gray-500" size={16} />
                  <input
                    type="email"
                    required
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-9 p-2 text-sm text-white focus:border-blue-500 outline-none"
                    placeholder="client@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Set Access PIN</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 text-gray-500" size={16} />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-9 p-2 text-sm text-white focus:border-blue-500 outline-none font-mono"
                      placeholder="123456"
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Expiration (Hours)</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-2.5 text-gray-500" size={16} />
                    <input
                      type="number"
                      min={1}
                      max={72}
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-9 p-2 text-sm text-white focus:border-blue-500 outline-none"
                      value={duration}
                      onChange={e => setDuration(parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" variant="primary" className="w-full mt-2" disabled={isLoading}>
                {isLoading ? 'Generating Security Link...' : 'Create Secure Link & Send'}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-400">
                <LinkIcon size={24} />
              </div>
              <h4 className="text-lg font-bold text-white">Link Ready</h4>
              <p className="text-sm text-gray-400">
                The secure link has been generated. Ensure you share the PIN <strong>{pin}</strong> with the recipient separately (or via the automated email).
              </p>

              <div className="bg-black/50 p-3 rounded border border-gray-700 break-all font-mono text-xs text-blue-300 select-all">
                {generatedLink}
              </div>

              <Button onClick={onClose} variant="secondary" className="w-full">Done</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};