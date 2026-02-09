
import React, { useRef } from 'react';
import { ColorKey, ColorInfo } from '../types.ts';

interface PaletteProps {
  palette: ColorInfo[];
  selectedColor: ColorKey;
  counts: Record<string, number>;
  isEditing: boolean;
  onSelect: (key: ColorKey) => void;
  onUpdate: (key: ColorKey, updates: Partial<ColorInfo>) => void;
  onReorder: (from: number, to: number) => void;
  disabled: boolean;
}

const Palette: React.FC<PaletteProps> = ({ 
  palette, 
  selectedColor, 
  counts, 
  isEditing, 
  onSelect, 
  onUpdate, 
  onReorder,
  disabled 
}) => {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleSort = () => {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      onReorder(dragItem.current, dragOverItem.current);
      dragItem.current = null;
      dragOverItem.current = null;
    }
  };

  return (
    <div className={`transition-all duration-300 ${disabled && !isEditing ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
      <div className="flex flex-wrap justify-center sm:justify-start gap-3 min-w-max pb-2">
        {palette.map((color, idx) => {
          const count = counts[color.key];
          const isFull = count === 4;
          const isOver = count > 4;
          const isSelected = selectedColor === color.key;

          return (
            <div 
              key={color.key} 
              draggable={isEditing}
              onDragStart={() => (dragItem.current = idx)}
              onDragEnter={() => (dragOverItem.current = idx)}
              onDragEnd={handleSort}
              onDragOver={(e) => e.preventDefault()}
              className={`flex flex-col items-center gap-1.5 transition-all p-1 rounded-lg ${
                isEditing ? 'bg-slate-700/50 border border-slate-600 border-dashed cursor-move' : ''
              } ${isSelected && !isEditing ? 'bg-blue-500/10' : ''}`}
            >
              {/* Color Ring (Picker) / Button */}
              <div className="relative group">
                {isEditing ? (
                  <input 
                    type="color"
                    value={color.hex}
                    onChange={(e) => onUpdate(color.key, { hex: e.target.value })}
                    className="w-10 h-10 rounded-full cursor-pointer border-2 border-slate-500 overflow-hidden"
                    style={{ backgroundColor: color.hex }}
                  />
                ) : (
                  <button
                    onClick={() => onSelect(color.key)}
                    className={`w-10 h-10 rounded-full border-2 transition-all active:scale-90 shadow-md ${
                      isSelected ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                )}
                
                {isEditing && (
                  <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5 text-[8px] text-white">
                    ✎
                  </div>
                )}
              </div>

              {/* Label & Name Editing */}
              <div className="flex flex-col items-center">
                {isEditing ? (
                  <div className="flex flex-col gap-1">
                     <input 
                      type="text" 
                      value={color.label} 
                      maxLength={2}
                      onChange={(e) => onUpdate(color.key, { label: e.target.value })}
                      className="w-10 bg-slate-900 text-[10px] text-center border border-slate-500 rounded text-white"
                      placeholder="簡寫"
                    />
                    <input 
                      type="text" 
                      value={color.name} 
                      onChange={(e) => onUpdate(color.key, { name: e.target.value })}
                      className="w-10 bg-slate-900 text-[8px] text-center border border-slate-500 rounded text-slate-400"
                      placeholder="名稱"
                    />
                  </div>
                ) : (
                  <>
                    <span className="text-[10px] font-bold text-slate-200">{color.label}</span>
                    {color.key !== 'UNKNOWN' && (
                      <span className={`text-[10px] font-mono font-black ${
                        isOver ? 'text-red-500 animate-bounce' : isFull ? 'text-green-400' : 'text-slate-500'
                      }`}>
                        {count}/4
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {disabled && !isEditing && (
        <div className="mt-2 text-center text-orange-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">
          — Simulation Mode Active —
        </div>
      )}
      
      {isEditing && (
        <div className="mt-2 text-center text-indigo-400 text-[10px] font-medium">
          提示：拖曳色球可更換順序 • 點擊色球開啟調色盤 • 修改文字即時儲存
        </div>
      )}
    </div>
  );
};

export default Palette;
