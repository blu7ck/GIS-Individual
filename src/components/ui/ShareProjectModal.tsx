import React, { useState, useEffect, useMemo } from 'react';
import { Share2, X, Clock, Lock, Mail, CheckSquare, FileBox, LayoutTemplate, MessageCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { Project, AssetLayer } from '../../types';

interface Props {
  project: Project;
  assets: AssetLayer[]; // Projedeki tüm asset'ler (dosyalar)
  measurements: AssetLayer[]; // Projedeki tüm ölçümler
  onClose: () => void;
  onShare: (email: string, pin: string, hours: number, selectedAssetIds: string[]) => Promise<string>;
}

export const ShareProjectModal: React.FC<Props> = ({
  project,
  assets,
  measurements,
  onClose,
  onShare
}) => {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [duration, setDuration] = useState(7); // 7 days default
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  // İlk yüklemede tüm asset'leri otomatik seç (kullanıcı isterse kaldırabilir)
  useEffect(() => {
    const allIds = [...assets, ...measurements].map(a => a.id);
    setSelectedAssets(new Set(allIds));
  }, [assets, measurements]);

  const toggleAsset = (id: string) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = [...assets, ...measurements].map(a => a.id);
    setSelectedAssets(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedAssets(new Set());
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedAssets.size === 0) {
      alert('Please select at least one asset or measurement to share');
      return;
    }

    if (!email || !pin) {
      alert('Please fill in email and PIN');
      return;
    }

    setIsLoading(true);
    try {
      const link = await onShare(email, pin, duration * 24, Array.from(selectedAssets)); // Convert days to hours
      setGeneratedLink(link);
    } catch (error) {
      console.error('Share error:', error);
      alert("Sharing failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const allSelected = useMemo(() => {
    const totalCount = assets.length + measurements.length;
    return totalCount > 0 && selectedAssets.size === totalCount;
  }, [assets.length, measurements.length, selectedAssets.size]);

  // Detect if mobile device for WhatsApp URL
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // WhatsApp share function
  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(
      `Check out this shared project: ${project.name}\n\n` +
      `Secure Link: ${generatedLink}\n` +
      `PIN: ${pin}\n\n` +
      `Expires in ${duration} day${duration !== 1 ? 's' : ''}.`
    );

    // Mobile için wa.me, Desktop için web.whatsapp.com
    const whatsappUrl = isMobile
      ? `https://wa.me/?text=${message}`
      : `https://web.whatsapp.com/send?text=${message}`;

    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-carta-deep-800/40 backdrop-blur-xl w-full max-w-3xl max-h-[90vh] rounded-xl border border-carta-mist-700/30 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-carta-deep-700/60 backdrop-blur-sm p-4 flex justify-between items-center border-b border-carta-mist-700/30 flex-shrink-0">
          <div className="flex items-center text-carta-mist-400">
            <Share2 className="mr-2" size={20} />
            <h3 className="font-bold">Share Project: {project.name}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!generatedLink ? (
            <form onSubmit={handleShare} className="space-y-4">
              {/* Info Banner */}
              <div className="bg-carta-deep-700/40 backdrop-blur-sm border border-carta-mist-700/30 rounded-lg p-3 mb-4">
                <p className="text-xs text-carta-mist-300">
                  You are sharing <strong>{project.name}</strong>. Select which files and measurements to include.
                  The recipient will receive a secure viewer link with PIN protection.
                </p>
              </div>

              {/* Email & PIN Section */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Recipient Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 text-gray-500" size={16} />
                    <input
                      type="email"
                      required
                      className="w-full bg-carta-deep-900/50 backdrop-blur-sm border border-carta-mist-700/30 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-carta-gold-500 focus:ring-1 focus:ring-carta-gold-500 outline-none transition"
                      placeholder="client@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Access PIN *</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 text-gray-500" size={16} />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      className="w-full bg-carta-deep-900/50 backdrop-blur-sm border border-carta-mist-700/30 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-carta-gold-500 focus:ring-1 focus:ring-carta-gold-500 outline-none font-mono transition"
                      placeholder="123456"
                      value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Expiration (Days)</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 text-gray-500" size={16} />
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                    value={duration}
                    onChange={e => setDuration(Math.max(1, Math.min(30, parseInt(e.target.value) || 7)))}
                  />
                </div>
              </div>

              {/* Asset Selection */}
              <div className="border-t border-gray-700 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-xs font-medium text-gray-400">
                    Select Assets to Share ({selectedAssets.size} selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      disabled={allSelected}
                      className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAll}
                      disabled={selectedAssets.size === 0}
                      className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Files Section */}
                {assets.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileBox size={14} className="text-gray-500" />
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Files ({assets.length})</h4>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto bg-gray-800/30 rounded-lg p-2">
                      {assets.map(asset => (
                        <label
                          key={asset.id}
                          className="flex items-center p-2 bg-gray-800/50 rounded hover:bg-gray-800 cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={selectedAssets.has(asset.id)}
                            onChange={() => toggleAsset(asset.id)}
                            className="mr-2 w-4 h-4 text-carta-gold-500 bg-carta-deep-700 border-carta-mist-700/30 rounded focus:ring-carta-gold-500"
                          />
                          <span className="text-sm text-gray-300 flex-1">{asset.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Measurements Section */}
                {measurements.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <LayoutTemplate size={14} className="text-gray-500" />
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Measurements ({measurements.length})</h4>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto bg-gray-800/30 rounded-lg p-2">
                      {measurements.map(measurement => (
                        <label
                          key={measurement.id}
                          className="flex items-center p-2 bg-gray-800/50 rounded hover:bg-gray-800 cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={selectedAssets.has(measurement.id)}
                            onChange={() => toggleAsset(measurement.id)}
                            className="mr-2 w-4 h-4 text-carta-gold-500 bg-carta-deep-700 border-carta-mist-700/30 rounded focus:ring-carta-gold-500"
                          />
                          <span className="text-sm text-gray-300 flex-1">{measurement.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {assets.length === 0 && measurements.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No assets or measurements in this project.
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-4"
                disabled={isLoading || selectedAssets.size === 0}
              >
                {isLoading ? 'Creating Share Link...' : `Create Share Link & Send Email (${selectedAssets.size} items)`}
              </Button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-400">
                <CheckSquare size={32} />
              </div>
              <h4 className="text-xl font-bold text-white">Share Link Created Successfully!</h4>
              <p className="text-sm text-gray-400">
                A secure link has been generated and sent to <strong>{email}</strong>.
                The recipient must use PIN <strong className="font-mono text-carta-gold-400">{pin}</strong> to access the shared project.
              </p>

              <div className="bg-carta-deep-900/50 backdrop-blur-sm p-4 rounded-lg border border-carta-mist-700/30 break-all font-mono text-xs text-carta-mist-300 select-all">
                {generatedLink}
              </div>

              <p className="text-xs text-gray-500">
                This link expires in {duration} day{duration !== 1 ? 's' : ''}.
              </p>

              {/* WhatsApp Share Button */}
              <button
                onClick={handleWhatsAppShare}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-lg transition-colors font-medium shadow-lg"
              >
                <MessageCircle size={20} />
                Share via WhatsApp
              </button>

              <Button onClick={onClose} variant="secondary" className="w-full">Done</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

