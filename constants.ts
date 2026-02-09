
import { ColorInfo, ColorKey } from './types.ts';

export const TUBE_COUNT = 14;
export const SLOT_COUNT = 4;

export const DEFAULT_PALETTE: ColorInfo[] = [
  { key: 'YELLOW', name: '黃色', hex: '#F1C40F', label: '黃' },
  { key: 'L_GREEN', name: '草綠', hex: '#2ECC71', label: '草' },
  { key: 'SKIN', name: '膚色', hex: '#E91E63', label: '膚' },
  { key: 'D_PURPLE', name: '深紫', hex: '#4A235A', label: '深紫' },
  { key: 'D_GREEN', name: '深綠', hex: '#276221', label: '深綠' },
  { key: 'GRAY', name: '灰色', hex: '#95A5A6', label: '灰' },
  { key: 'D_BLUE', name: '深藍', hex: '#154360', label: '深藍' },
  { key: 'L_BLUE', name: '水藍', hex: '#70A1FF', label: '水藍' },
  { key: 'ORANGE', name: '橘色', hex: '#E67E22', label: '橘' },
  { key: 'CYAN', name: '蒂芬妮綠', hex: '#00FDDC', label: '芬' },
  { key: 'PURPLE', name: '紫色', hex: '#9B59B6', label: '紫' },
  { key: 'D_RED', name: '鮮紅', hex: '#FF0000', label: '鮮紅' },
  { key: 'UNKNOWN', name: '未知', hex: '#111827', label: '？' },
];

export const INITIAL_TUBES: ColorKey[][] = Array(TUBE_COUNT).fill(null).map(() => 
  Array(SLOT_COUNT).fill('UNKNOWN') as ColorKey[]
);
