'use client';

import { useState } from 'react';
import WalletConnect from '../../components/WalletConnect';
import AdminDashboard from '../../components/AdminDashboard';

export default function AdminPage() {
  const [address, setAddress] = useState<string | null>(null);

  const ownerAddress = (process.env.NEXT_PUBLIC_OWNER_ADDRESS || '0x0000000000000000000000000000000000000000').toLowerCase();
  
  const isOwner = address?.toLowerCase() === ownerAddress;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
          Admin Control Center
        </h1>
        <p className="text-sm text-[#8E9BB0]">
          Manage draw rounds, trigger emergency overrides, and monitor hot wallet health.
        </p>
      </div>

      {!address ? (
        <div className="bg-[#16213E] border border-[#2c3a5f] p-8 rounded-2xl text-center max-w-md mx-auto space-y-4">
          <p className="text-sm text-[#8E9BB0]">
            Please connect the administrator cold wallet to access dashboard controls.
          </p>
          <div className="flex justify-center">
            <WalletConnect onAddressChange={setAddress} />
          </div>
        </div>
      ) : !isOwner ? (
        <div className="bg-red-950/20 border border-red-900/40 p-8 rounded-2xl text-center max-w-md mx-auto space-y-4">
          <span className="text-4xl">🚫</span>
          <h2 className="text-lg font-bold text-[#ef4444] uppercase tracking-wide">
            Access Denied
          </h2>
          <p className="text-sm text-[#8E9BB0]">
            Connected wallet address is not authorized to access these administration tools.
          </p>
          <div className="text-xs bg-[#1a1a2e] border border-[#2c3a5f] p-3 rounded font-mono text-left space-y-1 text-gray-300">
            <p><span className="text-gray-400">Connected:</span> {address}</p>
            <p><span className="text-gray-400">Authorized:</span> {ownerAddress}</p>
          </div>
          <div className="flex justify-center pt-2">
            <WalletConnect onAddressChange={setAddress} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <WalletConnect onAddressChange={setAddress} />
          </div>
          <AdminDashboard address={address} />
        </div>
      )}
    </div>
  );
}
