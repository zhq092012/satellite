/**
 * 战术数据播种与场景初始化入口 (整合动态 API 算法矩阵)
 */
import { seedFromApiData } from './matrixAdapter';
import type { MatrixResult } from '@/api/electronic';

export interface BattleAreaBounds {
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
}

/**
 * 通用场景播种入口（优先使用 API 接口数据）
 */
export const seedMockData = async (
  sqliteClient: any,
  durationMinutes: number = 50,
  startTime: number = 1781683200,
  areaBounds?: BattleAreaBounds | null,
  taskId?: string | number,
  taskName?: string,
  matrixResult?: MatrixResult | null
): Promise<void> => {
  if (matrixResult) {
    await seedFromApiData(sqliteClient, matrixResult, durationMinutes, startTime, areaBounds, taskId, taskName);
    return;
  }
  console.warn('未接收到后端 API 算法矩阵数据，无法进行物理节点构建。');
};
