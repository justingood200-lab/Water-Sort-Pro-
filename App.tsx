
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [sourceTubeIndex, setSourceTubeIndex] = useState<number | null>(null);

  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [solutionSteps, setSolutionSteps] = useState<Move[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [isSolving, setIsSolving] = useState(false);

  // 初始化加載
  useEffect(() => {
    const savedSaves = localStorage.getItem(STORAGE_KEY_SAVES);
    if (savedSaves) {
      try {
        const parsed = JSON.parse(savedSaves);
        setSaves(parsed);
        const lastActive = parsed.find((s: any) => s !== null);
        if (lastActive) {
          setTubes(lastActive.tubes);
          setPalette(lastActive.palette);
        }
      } catch (e) {
        console.error("Failed to load local saves", e);
      }
    }
  }, []);

  // 存檔同步至本地
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
    // 稍微延遲讓 UI 顯示 Loading 狀態
    setTimeout(() => {
      try {
        const result = solve(tubes);
        setIsSolving(false);
        if (result.error && result.steps.length === 0) {
          alert(result.error);
        } else {
          if (result.warning) console.warn(result.warning);
          setSolutionSteps(result.steps);
          setCurrentStepIdx(0);
          setIsSimulationMode(true);
        }
      } catch (e) {
        setIsSolving(false);
        alert('解題發生錯誤。');
      }
    }, 100);
  };

  const executeCurrentStep = () => {
    if (currentStepIdx < 0 || currentStepIdx >= solutionSteps.length) return;
    const move = solutionSteps[currentStepIdx];
    const newTubes = [...tubes];
    const sourceTube = [...newTubes[move.from]];
    const destTube = [...newTubes[move.to]];
    
    const sTopIdx = sourceTube.findIndex(c => c !== 'UNKNOWN');
    const dTopIdx = destTube.findIndex(c => c !== 'UNKNOWN');
    const targetDIdx = dTopIdx === -1 ? SLOT_COUNT : dTopIdx;

    for (let i = 0; i < move.count; i++) {
      sourceTube[sTopIdx + i] = 'UNKNOWN';
      destTube[targetDIdx - 1 - i] = move.color;
    }

    newTubes[move.from] = sourceTube;
    newTubes[move.to] = destTube;
    setTubes(newTubes);
    
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

  const handleTubeClick = (tubeIdx: number) => {
    if (!isSimulationMode) return;
    
    if (sourceTubeIndex === null) {
      const topColorIdx = tubes[tubeIdx].findIndex(c => c !== 'UNKNOWN');
      if (topColorIdx === -1) return;
      setSourceTubeIndex(tubeIdx);
    } else {
      if (sourceTubeIndex === tubeIdx) {
        setSourceTubeIndex(null);
        return;
      }
      // 手動模擬移動邏輯
      const sourceTube = [...tubes[sourceTubeIndex]];
      const destTube = [...tubes[tubeIdx]];
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
        const newTubes = [...tubes];
        const newSource = [...sourceTube];
        const newDest = [...destTube];
        for (let i = 0; i < actualMoveCount; i++) {
          newSource[sTopIdx + i] = 'UNKNOWN';
          newDest[(dTopIdx === -1 ? SLOT_COUNT : dTopIdx) - 1 - i] = sourceColor;
        }
        newTubes[sourceTubeIndex] = newSource;
        newTubes[tubeIdx] = newDest;
        setTubes(newTubes);
      }
      setSourceTubeIndex(null);
    }
  };

  const handleSlotClick = (tubeIdx: number, slotIdx: number) => {
    if (isSimulationMode) {
      handleTubeClick(tubeIdx);
      return;
    }
    const newTubes = [...tubes];
    newTubes[tubeIdx] = [...newTubes[tubeIdx]];
    newTubes[tubeIdx][slotIdx] = selectedColor;
    setTubes(newTubes);
  };

  const currentMove = solutionSteps[currentStepIdx];

  return (
    <div className="min-h-screen flex flex-col p-4 pb-80 md:pb-64 lg:p-8 max-w-7xl mx-auto w-full">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-6 sticky top-0 bg-slate-900/90 backdrop-blur-md py-4 z-40 border-b border-slate-700/50 -mx-4 px-4 lg:mx-0 lg:rounded-b-2xl shadow-xl">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 leading-none">
            Water Sort Pro
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1">Professional Game Assistant</p>
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => setIsSavesOpen(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 active:scale-95 transition-all">📂 存檔與同步</button>
          <button onClick={handleAutoSolve} disabled={isSolving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-[0_0_20px_rgba(79,70,229,0.4)] active:scale-95 disabled:opacity-50 transition-all">
            {isSolving ? '計算中...' : 'AI 智慧解題'}
          </button>
          <button 
            onClick={() => { setIsSimulationMode(!isSimulationMode); setSolutionSteps([]); setSourceTubeIndex(null); }} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isSimulationMode ? 'bg-orange-500 border-orange-400 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-slate-700 border-slate-600 text-slate-300'}`}
          >
            {isSimulationMode ? '🎮 模擬中' : '✍️ 編輯中'}
          </button>
        </div>
      </header>

      {/* 側邊存檔選單 */}
      {isSavesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSavesOpen(false)}></div>
          <div className="relative w-85 bg-slate-900 h-full p-8 shadow-2xl flex flex-col gap-6 animate-in slide-in-from-right duration-300 border-l border-slate-800">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-white italic">ARCHIVES</h2>
              <button onClick={() => setIsSavesOpen(false)} className="text-slate-500 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
              <p className="text-[10px] text-slate-600 uppercase font-black tracking-[0.2em]">Local Save Slots</p>
              {saves.map((s, i) => (
                <div key={i} className={`p-4 rounded-2xl border transition-all ${s ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-900 border-slate-800 border-dashed opacity-50'}`}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black text-indigo-400">SLOT {i+1}</span>
                    <span className="text-[9px] text-slate-500 font-mono">{s ? new Date(s.timestamp).toLocaleString() : 'EMPTY'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { handleSave(i); alert('已存檔'); }} className="flex-1 py-2 text-[10px] bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 rounded-lg font-bold hover:bg-emerald-600/20 transition-all">SAVE</button>
                    {s && <button onClick={() => handleLoad(i)} className="flex-1 py-2 text-[10px] bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20">LOAD</button>}
                  </div>
                </div>
              ))}
              
              <div className="pt-6 space-y-4">
                <p className="text-[10px] text-slate-600 uppercase font-black tracking-[0.2em]">Cross-Device Sync</p>
                <textarea 
                  value={syncCodeInput}
                  onChange={(e) => setSyncCodeInput(e.target.value)}
                  placeholder="Paste sync code here..."
                  className="w-full h-28 bg-black/40 border border-slate-800 rounded-2xl p-4 text-[11px] font-mono text-indigo-300 focus:border-indigo-500 focus:outline-none transition-all resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={generateSyncCode} className="flex-1 py-3 bg-slate-800 text-slate-300 text-[10px] font-black rounded-xl active:scale-95 transition-all">COPY CODE</button>
                  <button onClick={loadFromSyncCode} className="flex-1 py-3 bg-indigo-600 text-white text-[10px] font-black rounded-xl active:scale-95 transition-all shadow-lg shadow-indigo-600/30">RESTORE DATA</button>
                </div>
              </div>
            </div>

            <button onClick={() => { if(confirm('確定清除？')) setTubes(INITIAL_TUBES); }} className="w-full py-4 bg-red-900/10 text-red-500 text-xs font-black rounded-2xl border border-red-900/20 hover:bg-red-900/20 transition-all">RESET CURRENT BOARD</button>
          </div>
        </div>
      )}

      {/* 試管容器 */}
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

      {/* 底部導覽面板 */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-2xl border-t border-slate-800 p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] z-40 shadow-[0_-20px_40px_rgba(0,0,0,0.4)]">
        <div className="max-w-5xl mx-auto">
          {solutionSteps.length > 0 ? (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="flex items-center justify-between bg-indigo-600/10 p-5 rounded-3xl border border-indigo-500/20 shadow-inner">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex flex-col items-center justify-center shadow-2xl shadow-indigo-600/40">
                    <span className="text-[10px] font-black opacity-60">STEP</span>
                    <span className="text-2xl font-black leading-none">{currentStepIdx + 1}</span>
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">MOVING PROTOCOL</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-white">#{currentMove.from + 1}</span>
                      <span className="text-indigo-500 text-lg">➔</span>
                      <span className="text-xl font-black text-white">#{currentMove.to + 1}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setSolutionSteps([]); setCurrentStepIdx(-1); }} className="px-5 py-4 bg-slate-800 text-slate-400 rounded-2xl text-xs font-black hover:text-white transition-all">EXIT</button>
                  <button onClick={executeCurrentStep} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-xl shadow-indigo-600/30 active:scale-95 transition-all">NEXT STEP</button>
                </div>
              </div>
              <div className="px-2">
                <div className="flex justify-between text-[9px] font-black text-slate-600 mb-2 tracking-tighter">
                  <span>PROGRESS</span>
                  <span>{Math.round(((currentStepIdx + 1) / solutionSteps.length) * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-indigo-600 to-blue-400 transition-all duration-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${((currentStepIdx + 1) / solutionSteps.length) * 100}%` }}></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-end px-1 mb-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Color Matrix Controller</span>
                <button 
                  onClick={() => setIsEditPaletteMode(!isEditPaletteMode)}
                  className={`text-[10px] font-black px-4 py-1.5 rounded-full transition-all border ${isEditPaletteMode ? 'bg-indigo-600 border-indigo-400 text-white' : 'text-slate-400 border-slate-800'}`}
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
