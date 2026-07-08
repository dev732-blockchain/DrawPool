'use client';

interface RoundProgressProps {
  entriesSold: number;
  maxEntries: number;
}

export default function RoundProgress({ entriesSold, maxEntries }: RoundProgressProps) {
  const percentage = Math.min(100, (entriesSold / maxEntries) * 100);
  const entriesRemaining = Math.max(0, maxEntries - entriesSold);

  // Dynamic status styling based on round full status
  let barGradient = 'from-cyan-500 to-blue-500 shadow-neon-blue';
  let pulseClass = '';
  let statusText = '🔋 Accumulating Power';
  let energyPulseSpeed = 'duration-1000';

  if (percentage >= 30 && percentage < 70) {
    barGradient = 'from-amber-400 to-[#E6A817] shadow-neon-gold';
    statusText = '⚡ System Charged';
    energyPulseSpeed = 'duration-500';
  } else if (percentage >= 70) {
    barGradient = 'from-orange-500 via-red-500 to-[#E6A817] shadow-neon-red';
    pulseClass = 'neon-pulse-red';
    statusText = '🔥 VOLTAGE CRITICAL - DRAW IMMINENT!';
    energyPulseSpeed = 'duration-200';
  }

  return (
    <div className="bg-[#12122b]/85 border border-[#1f2042] rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md space-y-6">
      
      {/* Background HUD tech accents */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-radial-gradient from-white/5 to-transparent pointer-events-none rounded-bl-full" />
      <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-[#E6A817]/5 rounded-full blur-xl pointer-events-none" />

      <div className="flex justify-between items-center relative z-10">
        <div className="text-left space-y-1">
          <span className="text-[10px] text-[#8E9BB0] uppercase tracking-widest block font-bold">STATUS</span>
          <span className={`text-xs font-black uppercase tracking-wide px-2.5 py-1 rounded-md bg-[#0A0A16] border border-[#1f2042] text-white flex items-center gap-1.5 ${percentage >= 70 ? 'text-red-400 border-red-500/30' : 'text-[#E6A817] border-amber-500/20'}`}>
            <span className={`w-2 h-2 rounded-full bg-current ${percentage >= 70 ? 'animate-ping' : 'animate-pulse'}`}></span>
            {statusText}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-[#8E9BB0] uppercase tracking-widest block font-bold">VACANCIES REMAINING</span>
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-3xl md:text-4xl font-black text-[#E6A817] font-mono tracking-tight glow-text shadow-sm">
              {entriesRemaining.toLocaleString()}
            </span>
            <span className="text-xs text-[#8E9BB0] font-mono">/ {maxEntries}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar Container with notch marks and retro grid */}
      <div className="relative space-y-2">
        <div className="w-full bg-[#0A0A16] rounded-2xl h-7 p-1.5 border border-[#1f2042] relative overflow-hidden flex items-center shadow-inner">
          
          {/* Animated Energy Bar */}
          <div
            className={`bg-gradient-to-r ${barGradient} h-full rounded-xl transition-all duration-500 ease-out relative energy-flow-bg flex items-center justify-end pr-2 overflow-hidden ${pulseClass}`}
            style={{ width: `${percentage}%` }}
          >
            {percentage > 10 && (
              <span className="text-[9px] font-black text-[#0A0A16] tracking-tighter uppercase font-mono animate-pulse">
                {Math.round(percentage)}%
              </span>
            )}
          </div>
          
          {/* Grid notches markers at 25%, 50%, 75% */}
          <div className="absolute inset-0 flex justify-between px-6 pointer-events-none">
            <span className="w-0.5 h-full bg-[#1f2042]/50" />
            <span className="w-0.5 h-full bg-[#1f2042]/50" />
            <span className="w-0.5 h-full bg-[#1f2042]/50" />
          </div>
        </div>
        
        {/* Tick labels */}
        <div className="flex justify-between text-[9px] text-[#8E9BB0] font-bold uppercase tracking-wider px-1">
          <span>🔋 Initialization</span>
          <span>⚡ 50% Charged</span>
          <span>🚀 Terminal Velocity</span>
        </div>
      </div>
    </div>
  );
}
