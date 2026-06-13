'use client';

interface RoundProgressProps {
  entriesSold: number;
  maxEntries: number;
}

export default function RoundProgress({ entriesSold, maxEntries }: RoundProgressProps) {
  const percentage = Math.min(100, (entriesSold / maxEntries) * 100);
  const entriesRemaining = Math.max(0, maxEntries - entriesSold);

  return (
    <div className="bg-[#16213E] border border-[#2c3a5f] rounded-2xl p-6 md:p-8 shadow-xl text-center space-y-6">
      <div className="flex justify-between items-end">
        <div className="text-left">
          <span className="text-xs text-[#8E9BB0] uppercase tracking-wide block font-semibold">Entries Remaining</span>
          <span className="text-3xl md:text-4xl font-extrabold text-[#E6A817] font-mono">
            {entriesRemaining.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="w-full bg-[#1a1a2e] rounded-full h-5 p-1 border border-[#2c3a5f]">
        <div
          className="bg-gradient-to-r from-[#E6A817] to-[#ffd043] h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-[#8E9BB0] font-medium">
        <span>Round Start</span>
        <span>Round End</span>
      </div>
    </div>
  );
}
