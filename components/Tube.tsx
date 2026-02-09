
import React from 'react';
import { ColorKey, ColorInfo } from '../types.ts';

interface TubeProps {
  index: number;
  data: ColorKey[];
  palette: ColorInfo[];
  onSlotClick: (slotIdx: number) => void;
  isSource: boolean;
  isTarget?: boolean;
  isExcavationTarget?: boolean;
}

const Tube: React.FC<TubeProps> = ({ index, data, palette, onSlotClick, isSource, isTarget, isExcavationTarget }) => {
  return (
    <div className="relative group">
       <div className={`absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono transition-colors flex flex-col items-center ${
         isSource ? 'text-orange-400 animate-pulse font-bold' : 
         isTarget ? 'text-indigo-400 animate-pulse font-bold' : 'text-slate-500'
       }`}>
        <span>#{index + 1}</span>
      </div>

      <div 
        className={`w-14 h-44 rounded-b-2xl border-2 tube-gradient flex flex-col justify-end overflow-hidden cursor-pointer transition-all duration-200 relative ${
          isSource ? 'border-orange-500 scale-110 shadow-xl z-20' : 
          isTarget ? 'border-indigo-500 scale-110 shadow-xl z-20' : 
          'border-slate-600'
        } ${isExcavationTarget ? 'ring-4 ring-orange-500 ring-opacity-50 animate-pulse' : ''}`}
        onClick={() => onSlotClick(-1)}
      >
        {data.map((colorKey, slotIdx) => {
          const colorInfo = palette.find(c => c.key === colorKey) || palette.find(c => c.key === 'UNKNOWN')!;
          return (
            <div 
              key={slotIdx}
              onClick={(e) => {
                e.stopPropagation();
                onSlotClick(slotIdx);
              }}
              className="h-1/4 w-full flex items-center justify-center border-t border-slate-700/30 slot-animation relative"
              style={{ backgroundColor: colorInfo.hex }}
            >
              {colorKey === 'UNKNOWN' && (
                  <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)] opacity-50"></div>
              )}
              <span className={`text-[9px] font-bold select-none transition-opacity ${
                colorKey === 'UNKNOWN' ? 'opacity-40 text-slate-400' : 'text-white drop-shadow-md brightness-125'
              }`} style={{ mixBlendMode: 'difference' }}>
                {colorInfo.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Tube;
