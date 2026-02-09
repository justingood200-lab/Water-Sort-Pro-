
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ColorKey, ColorInfo, Move, SaveData } from './types';
import { DEFAULT_PALETTE, INITIAL_TUBES, SLOT_COUNT } from './constants';
import Tube from './components/Tube';
import Palette from './components/Palette';
import { solve } from './solver';

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SAVES, JSON.stringify(saves));
  }, [saves]);

  const handleSave = (index: number) => {
    const newSaves = [...saves];
    newSaves[index] = { tubes, palette, timestamp: Date.now() };
    setSaves(newSaves);
    alert(`存檔 ${index + 1} 已成功儲存於本地。`);
  };

  const handleLoad = (index: number) => {
    const saveData = saves[index];
    if (saveData) {
      setTubes(saveData.tubes);
      setPalette(saveData.palette);
      setSolutionSteps([]);
      setCurrentStepIdx(-1);
      setIsSavesOpen(false);
      alert(`已載入存檔 ${index + 1}`);
    }
  };

  const generateSyncCode = () => {
    try {
      const currentData = { tubes, palette, timestamp: Date.now() };
      const jsonStr = JSON.stringify(currentData);
      const encoder = new TextEncoder();
      const data = encoder.encode(jsonStr);
      let binString = "";
      for (let i = 0; i < data.length; i++) {
        binString += String.fromCharCode(data[i]);
      }
      const code = btoa(binString);
      setSyncCodeInput(code);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
          alert('同步代碼已複製！');
        });
      }
    } catch (e) {
      alert('產生同步碼失敗。');
    }
  };

  const loadFromSyncCode = () => {
    let input = syncCodeInput.replace(/貼上了/g, '').replace(/\s/g, '').trim();
    if (!input) {
      alert('請輸入代碼');
      return;
    }

    const tryParse = (str: string) => {
      try {
        const searchStr = str.includes('%22tubes%22') ? decodeURIComponent(str) : str;
        const start = searchStr.indexOf('{"tubes":');
        const end = searchStr.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          const json = searchStr.substring(start, end + 1);
          const obj = JSON.parse(json);
          if (obj && obj.tubes) return obj;
        }
      } catch (e) {}
      return null;
    };

    let result = null;
    result = tryParse(input) || tryParse(decodeURIComponent(input));

    if (!result) {
      try {
        let b64 = input.replace(/[^A-Za-z0-9+/=]/g, '');
        for (let pad = 0; pad < 3; pad++) {
          try {
            const bin = atob(b64 + "=".repeat(pad));
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const decoded = new TextDecoder().decode(bytes);
            result = tryParse(decoded) || tryParse(decodeURIComponent(decoded));
            if (result) break;
          } catch (e) {}
        }
      } catch (e) {}
    }

    if (result) {
      setTubes(result.tubes);
      if (result.palette) setPalette(result.palette);
      const coloredCount = result.tubes.flat().filter((c: string) => c !== 'UNKNOWN').length;
      const tubeCount = result.tubes.length;
      if (coloredCount === 0) {
        alert(`✅ 數據還原成功！\n\n狀態：已載入 ${tubeCount} 根試管。\n提醒：目前的試管內「全是問號」，代表您備份時尚未填入顏色水。`);
      } else {
        alert(`🎉 數據恢復成功！\n\n已成功找回 ${tubeCount} 根試管與顏色挖掘進度。`);
      }
      setIsSavesOpen(false);
      setSyncCodeInput('');
      setSolutionSteps([]);
      setCurrentStepIdx(-1);
    } else {
      alert('❌ 代碼解析失敗。請確認是否複製完整。');
    }
  };

  const resetCurrentTubes = useCallback(() => {
    if (confirm('確定要清除目前的試管資料嗎？')) {
      setTubes(INITIAL_TUBES);
      setSolutionSteps([]);
      setCurrentStepIdx(-1);
      setSourceTubeIndex(null);
    }
  }, []);

  const handleAutoSolve = () => {
    const isAllUnknown = tubes.flat().every(c => c === 'UNKNOWN');
    if (isAllUnknown) {
      alert('目前的試管全是空的，請先選擇顏色填入試管後再讓 AI 解題！');
      return;
    }

    setIsSolving(true);
    setTimeout(() => {
      try {
        const result = solve(tubes);
        setIsSolving(false);
        if (result.error && result.steps.length === 0) {
          alert(result.error);
        } else {
          if (result.warning) alert(result.warning);
          setSolutionSteps(result.steps);
          setCurrentStepIdx(0);
          setIsSimulationMode(true);
        }
      } catch (e) {
        setIsSolving(false);
        alert('計算過程發生錯誤。');
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
      alert('解題步驟執行完畢！');
    } else {
      setCurrentStepIdx(prev => prev + 1);
    }
  };

  const colorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    palette.forEach(c => counts[c.key] = 0);
    tubes.flat().forEach(color => {
      if (color !== 'UNKNOWN' && counts[color] !== undefined) {
        counts[color] = (counts[color] || 0) + 1;
      }
    });
    return counts;
  }, [tubes, palette]);

  const handleTubeClick = (tubeIdx: number) => {
    if (!isSimulationMode || solutionSteps.length > 0) return;
    
    if (sourceTubeIndex === null) {
      const topColorIdx = tubes[tubeIdx].findIndex(c => c !== 'UNKNOWN');
      if (topColorIdx === -1) return;
      setSourceTubeIndex(tubeIdx);
    } else {
      if (sourceTubeIndex === tubeIdx) {
        setSourceTubeIndex(null);
        return;
      }
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
  const isExcavationMove = useMemo(() => {
      if (!currentMove) return false;
      const sourceTube = tubes[currentMove.from];
      return sourceTube.includes('UNKNOWN');
  }, [currentMove, tubes]);

  return (
    <div className="min-h-screen flex flex-col p-4 pb-80 md:pb-64 lg:p-8">
      <header className="flex flex-wrap justify-between items-center gap-4 mb-6 sticky top-0 bg-slate-900/95 backdrop-blur-md py-3 z-40 border-b border-slate-700/50 -mx-4 px-4 lg:mx-0 lg:rounded-b-2xl">
        <div className="flex flex-col">
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 leading-tight">
            Water Sort Pro
          </h1>
          <div className="flex gap-2 items-center">
            <span className={`w-2 h-2 rounded-full ${isSolving ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
            <p className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">{isSolving ? 'Solving...' : 'Ready'}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => setIsSavesOpen(true)} className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 active:bg-slate-700 transition-transform active:scale-95">📂 存檔</button>
          <button onClick={handleAutoSolve} disabled={isSolving} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black shadow-lg active:scale-95 disabled:opacity-50">AI 解題</button>
          <button onClick={() => { setIsSimulationMode(!isSimulationMode); setSolutionSteps([]); setSourceTubeIndex(null); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isSimulationMode ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
            {isSimulationMode ? '模擬' : '編輯'}
          </button>
        </div>
      </header>

      {isSavesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSavesOpen(false)}></div>
          <div className="relative w-80 bg-slate-800 h-full p-6 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">存檔與同步</h2>
              <button onClick={() => setIsSavesOpen(false)} className="text-slate-400 p-1 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">本地存檔 (無需登入)</p>
              {saves.map((s, i) => (
                <div key={i} className="p-3 bg-slate-900 rounded-xl border border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-400">槽位 {i+1}</span>
                    <span className="text-[9px] text-slate-500">{s ? new Date(s.timestamp).toLocaleTimeString() : '空'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(i)} className="flex-1 py-1.5 text-[10px] bg-emerald-900/40 text-emerald-400 rounded hover:bg-emerald-900/60 active:scale-95 transition-all">儲存</button>
                    {s && <button onClick={() => handleLoad(i)} className="flex-1 py-1.5 text-[10px] bg-indigo-900/40 text-indigo-400 rounded hover:bg-indigo-900/60 active:scale-95 transition-all">載入</button>}
                  </div>
                </div>
              ))}
              <div className="pt-4 space-y-3">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">跨裝置同步</p>
                <textarea 
                  value={syncCodeInput}
                  onChange={(e) => setSyncCodeInput(e.target.value)}
                  placeholder="在此貼上同步代碼..."
                  className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-2 text-[10px] font-mono text-slate-300 focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={generateSyncCode} className="flex-1 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 text-[10px] font-bold rounded-lg active:scale-95 transition-all">📤 複製代碼</button>
                  <button onClick={loadFromSyncCode} className="flex-1 py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg active:scale-95 transition-all shadow-lg">📥 數據還原</button>
                </div>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-700">
              <button onClick={resetCurrentTubes} className="w-full py-2 bg-red-900/20 text-red-400 text-xs font-bold rounded-lg hover:bg-red-900/30 transition-all">🗑️ 清除當前盤面</button>
            </div>
          </div>
        </div>
      )}

      <main className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-x-4 gap-y-12 justify-items-center mb-8">
        {tubes.map((tubeData, idx) => (
          <Tube 
            key={idx} 
            index={idx}
            data={tubeData} 
            palette={palette}
            isSource={sourceTubeIndex === idx || currentMove?.from === idx}
            isTarget={currentMove?.to === idx}
            isExcavationTarget={isExcavationMove && currentMove?.from === idx}
            onSlotClick={(slotIdx) => handleSlotClick(idx, slotIdx)}
          />
        ))}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] z-40">
        <div className="max-w-5xl mx-auto">
          {solutionSteps.length > 0 ? (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between bg-indigo-900/30 p-4 rounded-2xl border border-indigo-500/20 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shadow-lg transition-colors ${isExcavationMove ? 'bg-orange-600 animate-pulse text-white' : 'bg-indigo-600 text-white'}`}>
                    {isExcavationMove ? '🔍' : currentStepIdx + 1}
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
                        {isExcavationMove ? '挖掘路徑：揭開問號' : '排序路徑'}
                    </p>
                    <p className="text-base font-black text-white">
                      #{currentMove.from + 1} ➔ #{currentMove.to + 1}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setSolutionSteps([]); setCurrentStepIdx(-1); }} className="px-3 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold active:bg-slate-700">放棄</button>
                  <button onClick={executeCurrentStep} className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-lg active:scale-95 hover:bg-indigo-500 transition-all">下一步</button>
                </div>
              </div>
              <div className="flex items-center gap-4 px-2">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${((currentStepIdx + 1) / solutionSteps.length) * 100}%` }}></div>
                </div>
                <p className="text-[10px] text-slate-500 font-mono whitespace-nowrap">{currentStepIdx + 1} / {solutionSteps.length}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {isEditPaletteMode ? '調色盤編輯模式' : '點擊色球後填入試管'}
                </span>
                <button 
                  onClick={() => setIsEditPaletteMode(!isEditPaletteMode)}
                  className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${isEditPaletteMode ? 'bg-indigo-600 text-white' : 'text-indigo-400'}`}
                >
                  {isEditPaletteMode ? '完成編輯' : '修改顏色名稱'}
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
