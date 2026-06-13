'use client';

import { useState } from 'react';

interface KillSwitchProps {
  onStop: () => Promise<void>;
  platformActive: boolean;
}

export default function KillSwitch({ onStop, platformActive }: KillSwitchProps) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStopClick = async () => {
    if (confirmText !== 'STOP') return;
    setError(null);
    setLoading(true);

    try {
      await onStop();
      setConfirmText('');
    } catch (err: any) {
      console.error('[KillSwitch] Failed to stop platform:', err);
      setError(err.message || 'Failed to trigger kill switch.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-red-950/20 border border-red-900/40 p-6 rounded-2xl space-y-4">
      <h3 className="text-lg font-bold text-[#ef4444] uppercase tracking-wide">
        Emergency Kill Switch
      </h3>
      
      {platformActive ? (
        <>
          <p className="text-sm text-red-200/80 leading-relaxed">
            Stopping the platform sets <code className="bg-red-950/80 px-1 py-0.5 rounded">PLATFORM_ACTIVE = false</code> globally.
            This will reject all future incoming webhooks immediately and stop new entries. 
            <strong>Note:</strong> Current round entries will NOT be auto-refunded, you must refund them manually.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#8E9BB0] uppercase tracking-wider mb-1 font-semibold">
                Type <span className="text-[#ef4444] font-bold">STOP</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="STOP"
                className="w-full bg-[#1a1a2e] border border-red-900/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ef4444] text-center font-bold tracking-widest placeholder:tracking-normal placeholder:font-normal"
              />
            </div>

            <button
              onClick={handleStopClick}
              disabled={confirmText !== 'STOP' || loading}
              className="w-full bg-[#ef4444] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg cursor-pointer"
            >
              {loading ? 'Stopping...' : 'Deactivate Platform'}
            </button>
          </div>
        </>
      ) : (
        <div className="bg-red-950/50 border border-red-800/40 p-4 rounded-xl text-center text-red-200 font-semibold text-sm">
          🚨 PLATFORM IS STOPPED. Webhook entry receipts are deactivated.
        </div>
      )}

      {error && (
        <p className="text-xs text-[#ef4444] font-medium text-center">{error}</p>
      )}
    </div>
  );
}
