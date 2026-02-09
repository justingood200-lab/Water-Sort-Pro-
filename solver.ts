
import { ColorKey, Move, SolverResult } from './types';
import { SLOT_COUNT } from './constants';

type Board = ColorKey[][];

function boardToString(board: Board): string {
  return board.map(tube => tube.join(',')).join('|');
}

// 判斷是否全解或階段性全解（已知顏色都歸類且沒有問號被壓住）
function isSolved(board: Board): boolean {
  return board.every(tube => {
    const nonUnknown = tube.filter(c => c !== 'UNKNOWN');
    if (nonUnknown.length === 0) return true;
    // 如果還有問號，但問號上方還有顏色，不算解開
    const firstUnknownIdx = tube.indexOf('UNKNOWN');
    
    // Fix: Replace findLastIndex with a manual search to support older ES targets (e.g., pre-ES2023)
    let lastColorIdx = -1;
    for (let i = tube.length - 1; i >= 0; i--) {
      if (tube[i] !== 'UNKNOWN') {
        lastColorIdx = i;
        break;
      }
    }
    
    if (firstUnknownIdx !== -1 && lastColorIdx > firstUnknownIdx) return false;
    
    // 如果已知顏色未滿且不一致，不算解開
    if (nonUnknown.length > 0 && nonUnknown.length < SLOT_COUNT) {
        // 除非全場已經沒有該顏色了
        return false;
    }
    return nonUnknown.every(c => c === nonUnknown[0]);
  });
}

// 計算當前盤面有多少問號被壓住（挖掘深度總和）
function getUnknownBlockedScore(board: Board): number {
  let score = 0;
  board.forEach(tube => {
    const firstUnknownIdx = tube.indexOf('UNKNOWN');
    if (firstUnknownIdx !== -1) {
      // 計算問號上方有多少個非 UNKNOWN 的格子
      for (let i = 0; i < firstUnknownIdx; i++) {
        if (tube[i] !== 'UNKNOWN') score++;
      }
    }
  });
  return score;
}

function getPossibleMoves(board: Board): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < board.length; i++) {
    const sourceTube = board[i];
    const sTopIdx = sourceTube.findIndex(c => c !== 'UNKNOWN');
    if (sTopIdx === -1) continue;

    const sourceColor = sourceTube[sTopIdx];
    let blocksToMove = 0;
    for (let k = sTopIdx; k < SLOT_COUNT; k++) {
      if (sourceTube[k] === sourceColor) blocksToMove++;
      else break;
    }

    for (let j = 0; j < board.length; j++) {
      if (i === j) continue;
      const destTube = board[j];
      const dTopIdx = destTube.findIndex(c => c !== 'UNKNOWN');
      
      const destAvailable = dTopIdx === -1 ? SLOT_COUNT : dTopIdx;
      if (destAvailable === 0) continue;

      const isColorMatch = dTopIdx === -1 || destTube[dTopIdx] === sourceColor;
      if (isColorMatch) {
        // 策略：不把純色瓶移向另一個空瓶
        if (dTopIdx === -1 && blocksToMove === (SLOT_COUNT - sTopIdx)) {
            const isPure = sourceTube.slice(sTopIdx).every(c => c === sourceColor);
            const hasUnknownBelow = sourceTube.slice(sTopIdx).includes('UNKNOWN');
            if (isPure && !hasUnknownBelow) continue; 
        }

        moves.push({
          from: i,
          to: j,
          color: sourceColor,
          count: Math.min(blocksToMove, destAvailable)
        });
      }
    }
  }
  return moves;
}

function applyMove(board: Board, move: Move): Board {
  const newBoard = board.map(tube => [...tube]);
  const sourceTube = newBoard[move.from];
  const destTube = newBoard[move.to];
  const sTopIdx = sourceTube.findIndex(c => c !== 'UNKNOWN');
  const dTopIdx = destTube.findIndex(c => c !== 'UNKNOWN');
  const targetDIdx = dTopIdx === -1 ? SLOT_COUNT : dTopIdx;

  for (let i = 0; i < move.count; i++) {
    sourceTube[sTopIdx + i] = 'UNKNOWN';
    destTube[targetDIdx - 1 - i] = move.color;
  }
  return newBoard;
}

export function solve(initialTubes: Board): SolverResult {
  const counts: Record<string, number> = {};
  initialTubes.flat().forEach(c => {
    if (c !== 'UNKNOWN') counts[c] = (counts[c] || 0) + 1;
  });
  
  let warning = "";
  const oddColors = Object.entries(counts).filter(([_, count]) => count % SLOT_COUNT !== 0);
  if (oddColors.length > 0) {
    warning = `發現 ${oddColors.length} 種顏色數量非 4 的倍數，將優先尋找「挖掘路徑」。`;
  }

  // BFS 搜尋，優先權：解開問號 > 完成排序
  const queue: { board: Board; path: Move[]; score: number }[] = [
    { board: initialTubes, path: [], score: getUnknownBlockedScore(initialTubes) }
  ];
  const visited = new Set<string>();
  visited.add(boardToString(initialTubes));

  let iterations = 0;
  const MAX_ITERATIONS = 12000;
  let best挖掘Path: Move[] = [];
  let minBlockedScore = getUnknownBlockedScore(initialTubes);

  while (queue.length > 0) {
    iterations++;
    const { board, path, score } = queue.shift()!;

    // 如果所有問號都被揭開了，且這是一個合法的排序狀態
    if (isSolved(board)) return { steps: path, warning };

    // 紀錄目前為止能揭開最多問號的路徑（作為後備方案）
    if (score < minBlockedScore) {
        minBlockedScore = score;
        best挖掘Path = path;
    }

    if (iterations > MAX_ITERATIONS) {
        if (best挖掘Path.length > 0) {
            return { steps: best挖掘Path, warning: "已達運算上限，為您提供目前的「最佳挖掘路徑」。" };
        }
        return { steps: [], error: "搜尋分支過多，建議手動移動幾步後再試。", warning };
    }

    const moves = getPossibleMoves(board);
    for (const move of moves) {
      const nextBoard = applyMove(board, move);
      const boardStr = boardToString(nextBoard);
      if (!visited.has(boardStr)) {
        visited.add(boardStr);
        const nextScore = getUnknownBlockedScore(nextBoard);
        queue.push({ board: nextBoard, path: [...path, move], score: nextScore });
      }
    }
  }

  if (best挖掘Path.length > 0) {
      return { steps: best挖掘Path, warning: "找不到完全分類解，為您提供「挖掘路徑」。" };
  }

  return { steps: [], error: "目前盤面無解，請檢查顏色是否輸入錯誤。", warning };
}
