'use client';

export default function TestnetBanner() {
  const isTestnet = process.env.NEXT_PUBLIC_IS_TESTNET === 'true';

  if (!isTestnet) return null;

  return (
    <div className="bg-[#E6A817] text-[#1A1A2E] py-2 px-4 text-center font-bold text-sm shadow-md flex items-center justify-center gap-2 select-none">
      <span>🧪</span>
      <span>TESTNET MODE — Polygon Amoy Testnet — No Real Money — Test Only</span>
    </div>
  );
}
