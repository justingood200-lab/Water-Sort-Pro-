
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ColorKey, ColorInfo, Move, SaveData } from './types.ts';
import { DEFAULT_PALETTE, INITIAL_TUBES, SLOT_COUNT } from './constants.ts';
import Tube from './components/Tube.tsx';
import Palette from './components/Palette.tsx';
import { solve } from './solver.ts';

const STORAGE_KEY_SAVES = 'water-sort-saves-v3';

const App: React.FC = () => {
  const [tubes, setTubes] = useState<ColorKey[][]>(INITIAL_TUBES);
  const [palette, setPalette] = useState<ColorInfo[]>(DEFAULT_PALETTE);
  const [saves, setSaves] = useState<(SaveData | null)[]>(Array(5).fill(null));

  const [selectedColor, setSelectedColor] = useState<ColorKey>('YELLOW');
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [isEditPaletteMode, setIsEditPaletteMode] = useState(false);
  const [isSavesOpen, setIsSavesOpen] = useState(false);
  const [sourceTubeIndex, setSourceTubeIndex] = useState<number | null>(null);

  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [solutionSteps, setSolutionSteps] = useState<Move[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [isSolving, setIsSolving] = useState(false);

  // 初始化載入
  useEffect(() => {
    const savedSaves = localStorage.getItem(STORAGE_KEY_SAVES);
    if (savedSaves) {
      try {
        const parsed = JSON.parse(savedSaves);
        setSaves(parsed);
        // 自動載入最後一個非空的存檔
        const lastActive = [...parsed].reverse().find((s: any) => s !== null);
        if (lastActive) {
          setTubes(lastActive.tubes);
          setPalette(lastActive.palette);
        }
      } catch (e) {
        console.error("Failed to load local saves", e);
      }
    }
  }, []);

  // 自動存檔到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SAVES, JSON.stringify(saves));
  }, [saves]);

  const handleSave = (index: number) => {
    const newSaves = [...saves];
    newSaves[index] = { tubes, palette, timestamp: Date.now() };
    setSaves(newSaves);
  };

  const handleLoad = (index: number) => {
    const saveData = saves[index];
    if (saveData) {
      setTubes(saveData.tubes);
      setPalette(saveData.palette);
      setSolutionSteps([]);
      setCurrentStepIdx(-1);
      setIsSavesOpen(false);
    }
  };

  const generateSyncCode = () => {
    try {
      const currentData = { tubes, palette, timestamp: Date.now() };
      const jsonStr = JSON.stringify(currentData);
      const code = btoa(encodeURIComponent(jsonStr));
      setSyncCodeInput(code);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => alert('同步代碼已複製！'));
      }
    } catch (e) {
      alert('產生同步碼失敗。');
    }
  };

  const loadFromSyncCode = () => {
    try {
      const decoded = decodeURIComponent(atob(syncCodeInput.trim()));
      const result = JSON.parse(decoded);
      if (result && result.tubes) {
        setTubes(result.tubes);
        if (result.palette) setPalette(result.palette);
        setSolutionSteps([]);
        setCurrentStepIdx(-1);
        setIsSavesOpen(false);
        setSyncCodeInput('');
        alert('數據同步成功！');
      }
    } catch (e) {
      alert('無效的同步代碼。');
    }
  };

  const handleAutoSolve = () => {
    const isAllUnknown = tubes.flat().every(c => c === 'UNKNOWN');
    if (isAllUnknown) {
      alert('請先填入試管顏色再讓 AI 解題！');
      return;
    }

    setIsSolving(true);
    // 稍微延遲讓 UI 顯示「計算中」
    setTimeout(() => {
      try {
        const result = solve(tubes);
        setIsSolving(false);
        if (result.error && (!result.steps || result.steps.length === 0)) {
          alert(result.error);
        } else {
          setSolutionSteps(result.steps || []);
          setCurrentStepIdx(0);
          setIsSimulationMode(true);
          if (result.warning) console.warn(result.warning);
        }
      } catch (e) {
        setIsSolving(false);
        alert('解題發生錯誤。');
      }
    }, 50);
  };

  const executeCurrentStep = () => {
    if (currentStepIdx < 0 || currentStepIdx >= solutionSteps.length) return;
    const move = solutionSteps[currentStepIdx];
    
    setTubes(prevTubes => {
      const newTubes = prevTubes.map(t => [...t]);
      const sourceTube = [...newTubes[move.from]];
      const destTube = [...newTubes[move.to]];
      
      const sTopIdx = sourceTube.findIndex(c => c !== 'UNKNOWN');
      const dTopIdx = destTube.findIndex(c => c !== 'UNKNOWN');
      const targetDIdx = dTopIdx === -1 ? SLOT_COUNT : dTopIdx;

      for (let i = 0; i < move.count; i++) {
        if (sTopIdx + i < SLOT_COUNT) sourceTube[sTopIdx + i] = 'UNKNOWN';
        if (targetDIdx - 1 - i >= 0) destTube[targetDIdx - 1 - i] = move.color;
      }

      newTubes[move.from] = sourceTube;
      newTubes[move.to] = destTube;
      return newTubes;
    });
    
    if (currentStepIdx === solutionSteps.length - 1) {
      setSolutionSteps([]);
      setCurrentStepIdx(-1);
    } else {
      setCurrentStepIdx(prev => prev + 1);
    }
  };

  const colorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    palette.forEach(c => counts[c.key] = 0);
    tubes.flat().forEach(color => {
      if (color !== 'UNKNOWN' && counts[color] !== undefined) {
        counts[color]++;
      }
    });
    return counts;
  }, [tubes, palette]);

  const handleSlotClick = (tubeIdx: number, slotIdx: number) => {
    if (isSimulationMode) {
      if (sourceTubeIndex === null) {
        const topColorIdx = tubes[tubeIdx].findIndex(c => c !== 'UNKNOWN');
        if (topColorIdx === -1) return;
        setSourceTubeIndex(tubeIdx);
      } else {
        if (sourceTubeIndex === tubeIdx) {
          setSourceTubeIndex(null);
          return;
        }
        
        const sourceTube = tubes[sourceTubeIndex];
        const destTube = tubes[tubeIdx];
        const sTopIdx = sourceTube.findIndex(c => c !== 'UNKNOWN');
        const dTopIdx = destTube.findIndex(c => c !== 'UNKNOWN');
        const sourceColor = sourceTube[sTopIdx];
        
        let blocksToMove = 0;
        for (let i = sTopIdx; i < SLOT_COUNT; i++) {
          if (sourceTube[i] === sourceColor) blocksToMove++;
          else break;
        }
        
        const destAvailable = dTopIdx === -1 ? SLOT_COUNT : dTopIdx;
        const isColorMatch = dTopIdx === -1 || destTube[dTopIdx] === sourceColor;
        
        if (isColorMatch && destAvailable > 0) {
          const actualMoveCount = Math.min(blocksToMove, destAvailable);
          setTubes(prev => {
            const next = prev.map(t => [...t]);
            const nSource = [...next[sourceTubeIndex]];
            const nDest = [...next[tubeIdx]];
            for (let i = 0; i < actualMoveCount; i++) {
              nSource[sTopIdx + i] = 'UNKNOWN';
              nDest[(dTopIdx === -1 ? SLOT_COUNT : dTopIdx) - 1 - i] = sourceColor;
            }
            next[sourceTubeIndex] = nSource;
            next[tubeIdx] = nDest;
            return next;
          });
        }
        setSourceTubeIndex(null);
      }
      return;
    }
    
    // 編輯模式
    setTubes(prev => {
      const next = prev.map((t, idx) => idx === tubeIdx ? [...t] : t);
      if (slotIdx >= 0) {
        next[tubeIdx][slotIdx] = selectedColor;
      }
      return next;
    });
  };

  const currentMove = (currentStepIdx >= 0 && currentStepIdx < solutionSteps.length) ? solutionSteps[currentStepIdx] : null;

  return (
    <div className="min-h-screen flex flex-col p-4 pb-80 md:pb-64 lg:p-8 max-w-7xl mx-auto w-full">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-6 sticky top-0 bg-slate-900/90 backdrop-blur-md py-4 z-40 border-b border-slate-700/50 -mx-4 px-4 lg:mx-0 lg:rounded-b-2xl shadow-xl">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 leading-none">
            Water Sort Pro
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1">Professional Assistant</p>
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => setIsSavesOpen(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 active:scale-95 transition-all">📂 存檔</button>
          <button onClick={handleAutoSolve} disabled={isSolving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-[0_0_20px_rgba(79,70,229,0.4)] active:scale-95 disabled:opacity-50 transition-all">
            {isSolving ? '計算中...' : 'AI 解題'}
          </button>
          <button 
            onClick={() => { setIsSimulationMode(!isSimulationMode); setSolutionSteps([]); setSourceTubeIndex(null); }} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isSimulationMode ? 'bg-orange-500 border-orange-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-300'}`}
          >
            {isSimulationMode ? '🎮 模擬' : '✍️ 編輯'}
          </button>
        </div>
      </header>

      {isSavesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSavesOpen(false)}></div>
          <div className="relative w-80 bg-slate-900 h-full p-8 shadow-2xl flex flex-col gap-6 animate-in slide-in-from-right duration-300 border-l border-slate-800">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-white italic uppercase">Archives</h2>
              <button onClick={() => setIsSavesOpen(false)} className="text-slate-500 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
              {saves.map((s, i) => (
                <div key={i} className={`p-4 rounded-2xl border transition-all ${s ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-900 border-slate-800 border-dashed opacity-50'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black text-indigo-400">SLOT {i+1}</span>
                    <span className="text-[9px] text-slate-500 font-mono">{s ? new Date(s.timestamp).toLocaleTimeString() : 'EMPTY'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { handleSave(i); alert('已存入 SLOT ' + (i+1)); }} className="flex-1 py-2 text-[10px] bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 rounded-lg font-bold hover:bg-emerald-600/20 transition-all">SAVE</button>
                    {s && <button onClick={() => handleLoad(i)} className="flex-1 py-2 text-[10px] bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 transition-all">LOAD</button>}
                  </div>
                </div>
              ))}
              
              <div className="pt-6 space-y-4">
                <p className="text-[10px] text-slate-600 uppercase font-black tracking-[0.2em]">Sync Data</p>
                <textarea 
                  value={syncCodeInput}
                  onChange={(e) => setSyncCodeInput(e.target.value)}
                  placeholder="在此貼上代碼..."
                  className="w-full h-24 bg-black/40 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-indigo-300 resize-none outline-none focus:border-indigo-500 transition-colors"
                />
                <div className="flex gap-2">
                  <button onClick={generateSyncCode} className="flex-1 py-3 bg-slate-800 text-slate-300 text-[10px] font-black rounded-xl hover:bg-slate-700">COPY CODE</button>
                  <button onClick={loadFromSyncCode} className="flex-1 py-3 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-500">RESTORE</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-x-6 gap-y-14 justify-items-center mb-12 py-8">
        {tubes.map((tubeData, idx) => (
          <Tube 
            key={idx} 
            index={idx}
            data={tubeData} 
            palette={palette}
            isSource={sourceTubeIndex === idx || currentMove?.from === idx}
            isTarget={currentMove?.to === idx}
            onSlotClick={(slotIdx) => handleSlotClick(idx, slotIdx)}
          />
        ))}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-2xl border-t border-slate-800 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 shadow-[0_-20px_40px_rgba(0,0,0,0.4)]">
        <div className="max-w-5xl mx-auto">
          {solutionSteps.length > 0 && currentMove ? (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between bg-indigo-600/10 p-5 rounded-3xl border border-indigo-500/20">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black opacity-60">STEP</span>
                    <span className="text-2xl font-black leading-none">{currentStepIdx + 1}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">MOVING</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-white">#{currentMove.from + 1}</span>
                      <span className="text-indigo-500 text-lg">➔</span>
                      <span className="text-xl font-black text-white">#{currentMove.to + 1}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setSolutionSteps([]); setCurrentStepIdx(-1); }} className="px-5 py-4 bg-slate-800 text-slate-400 rounded-2xl text-xs font-black hover:text-white transition-colors">EXIT</button>
                  <button onClick={executeCurrentStep} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-xl hover:bg-indigo-500 active:scale-95 transition-all">NEXT STEP</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-end px-1 mb-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Color Matrix</span>
                <button 
                  onClick={() => setIsEditPaletteMode(!isEditPaletteMode)}
                  className={`text-[10px] font-black px-4 py-1.5 rounded-full transition-all border ${isEditPaletteMode ? 'bg-indigo-600 border-indigo-400 text-white' : 'text-slate-400 border-slate-800 hover:border-slate-600'}`}
                >
                  {isEditPaletteMode ? 'SAVE CONFIG' : 'EDIT COLORS'}
                </button>
              </div>
              <Palette 
                  palette={palette}
                  selectedColor={selectedColor} 
                  counts={colorCounts} 
                  isEditing={isEditPaletteMode}
                  onSelect={setSelectedColor}
                  onUpdate={(key, updates) => setPalette(prev => prev.map(c => c.key === key ? { ...c, ...updates } : c))}
                  onReorder={(from, to) => {
                    const newPalette = [...palette];
                    const [removed] = newPalette.splice(from, 1);
                    newPalette.splice(to, 0, removed);
                    setPalette(newPalette);
                  }}
                  disabled={isSimulationMode}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
