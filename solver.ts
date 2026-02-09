
import { ColorKey, Move, SolverResult } from './types';
import { SLOT_COUNT } from './constants';

type Board = ColorKey[][];

function boardToString(board: Board): string {
  return board.map(tube => tube.join(',')).join('|');
}

// 判定是否達成最終勝利條件或挖掘目標
function isSolved(board: Board): boolean {
  return board.every(tube => {
    const nonUnknown = tube.filter(c => c !== 'UNKNOWN');
    if (nonUnknown.length === 0) return true;
    
    // 如果還有問號，但問號上方壓著顏色，視為未挖掘完成
    const firstUnknownIdx = tube.indexOf('UNKNOWN');
    let lastColorIdx = -1;
    for (let i = tube.length - 1; i >= 0; i--) {
      if (tube[i] !== 'UNKNOWN') {
        lastColorIdx = i;
        break;
      }
    }
    if (firstUnknownIdx !== -1 && lastColorIdx > firstUnknownIdx) return false;
    
    // 如果已知顏色未湊滿 4 個且還有剩餘顏色在別處，不算解開
    if (nonUnknown.length > 0 && nonUnknown.length < SLOT_COUNT) return false;
    
    return nonUnknown.every(c => c === nonUnknown[0]);
  });
}

// 挖掘權重計算：計算有多少問號被壓在非問號色塊下方
function getExcavationScore(board: Board): number {
  let score = 0;
  board.forEach(tube => {
    const firstUnknownIdx = tube.indexOf('UNKNOWN');
    if (firstUnknownIdx !== -1) {
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
        // 剪枝優化：不要無謂地將整管同色的液體移向空管（除非下方有問號需要挖掘）
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
  const queue: { board: Board; path: Move[]; score: number }[] = [
    { board: initialTubes, path: [], score: getExcavationScore(initialTubes) }
  ];
  const visited = new Set<string>();
  visited.add(boardToString(initialTubes));

  let iterations = 0;
  const MAX_ITERATIONS = 15000;
  let bestExcavationPath: Move[] = [];
  let minExcavationScore = getExcavationScore(initialTubes);

  while (queue.length > 0) {
    iterations++;
    const current = queue.shift()!;

    if (isSolved(current.board)) return { steps: current.path };

    // 紀錄挖掘效果最好的路徑
    if (current.score < minExcavationScore) {
        minExcavationScore = current.score;
        bestExcavationPath = current.path;
    }

    if (iterations > MAX_ITERATIONS) {
        if (bestExcavationPath.length > 0) {
            return { steps: bestExcavationPath, warning: "已達運算上限，為您提供挖掘效率最高的建議路徑。" };
        }
        return { steps: [], error: "搜尋空間過大，請先手動執行幾步後再試。" };
    }

    const moves = getPossibleMoves(current.board);
    for (const move of moves) {
      const nextBoard = applyMove(current.board, move);
      const boardStr = boardToString(nextBoard);
      if (!visited.has(boardStr)) {
        visited.add(boardStr);
        queue.push({ 
            board: nextBoard, 
            path: [...current.path, move], 
            score: getExcavationScore(nextBoard) 
        });
      }
    }
  }

  if (bestExcavationPath.length > 0) {
      return { steps: bestExcavationPath, warning: "無法直接達成最終全解，提供挖掘優先路徑。" };
  }

  return { steps: [], error: "目前盤面無解，請檢查顏色是否填寫正確。" };
}
