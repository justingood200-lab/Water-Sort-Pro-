
export type ColorKey = 
  | 'YELLOW' | 'L_GREEN' | 'SKIN' | 'D_PURPLE' | 'D_GREEN' | 'GRAY' 
  | 'D_BLUE' | 'L_BLUE' | 'ORANGE' | 'CYAN' | 'PURPLE' | 'D_RED' | 'UNKNOWN';

export interface ColorInfo {
  key: ColorKey;
  name: string;
  hex: string;
  label: string;
}

export type TubeData = ColorKey[];

export interface Move {
  from: number;
  to: number;
  color: ColorKey;
  count: number;
}

export interface SolverResult {
  steps: Move[];
  error?: string;
  warning?: string;
}

export interface SaveData {
  tubes: ColorKey[][];
  palette: ColorInfo[];
  timestamp: number;
}
