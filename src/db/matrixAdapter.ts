import type { MatrixResult, RelationMap, Weapon } from '@/api/electronic';
import type { BattleAreaBounds } from './seeder';

/**
 * 解析经纬度字符串 "lat,lng" (例如 "68.350,133.500")
 */
export const parseLatLon = (latLonStr?: string): { lat: number; lng: number } => {
  if (!latLonStr) return { lat: 0, lng: 0 };
  const parts = latLonStr.split(',');
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    return {
      lat: isNaN(lat) ? 0 : lat,
      lng: isNaN(lng) ? 0 : lng
    };
  }
  return { lat: 0, lng: 0 };
};

/**
 * 解析时间窗字符串 (例: "10:00:00" 或 "2026-07-28 10:00:00") 为秒级 Unix 时间戳
 */
export const parseWindowTimestamp = (winStr: string, defaultTs: number): number => {
  if (!winStr) return defaultTs;
  // 1. 尝试直接作为完整 Date 解析
  const d = new Date(winStr);
  if (!isNaN(d.getTime())) {
    return Math.floor(d.getTime() / 1000);
  }
  // 2. 尝试作为 HH:mm:ss 或 HH:mm 时分秒解析
  const parts = winStr.split(':').map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const baseDate = new Date(defaultTs * 1000);
    baseDate.setHours(parts[0], parts[1], parts[2] || 0, 0);
    return Math.floor(baseDate.getTime() / 1000);
  }
  return defaultTs;
};

/**
 * 归一化 usage_type，确保符合数据库 CHECK 约束 ('MILITARY' | 'CIVIL_COMMERCIAL')
 */
export const normalizeUsageType = (typeStr?: string): 'MILITARY' | 'CIVIL_COMMERCIAL' => {
  if (!typeStr) return 'MILITARY';
  const upper = String(typeStr).toUpperCase();
  if (upper.includes('CIVIL') || upper.includes('COMMERCIAL') || upper.includes('民用') || upper.includes('商用')) {
    return 'CIVIL_COMMERCIAL';
  }
  return 'MILITARY';
};

/**
 * 归一化 func_type，确保符合数据库 CHECK 约束 ('RECON' | 'COMM' | 'RELAY' | 'OTHER')
 */
export const normalizeFuncType = (typeStr?: string): 'RECON' | 'COMM' | 'RELAY' | 'OTHER' => {
  if (!typeStr) return 'COMM';
  const upper = String(typeStr).toUpperCase();
  if (upper.includes('RECON') || upper.includes('侦察') || upper.includes('遥感')) return 'RECON';
  if (upper.includes('RELAY') || upper.includes('中继')) return 'RELAY';
  if (upper.includes('COMM') || upper.includes('通信')) return 'COMM';
  return 'OTHER';
};

/**
 * 归一化 weapon category，确保符合数据库 CHECK 约束 ('EW' | 'CYBER' | 'KINETIC' | 'DEW')
 */
export const normalizeWeaponCategory = (typeStr?: string): 'EW' | 'CYBER' | 'KINETIC' | 'DEW' => {
  if (!typeStr) return 'EW';
  const upper = String(typeStr).toUpperCase();
  if (upper.includes('CYBER') || upper.includes('网络') || upper.includes('木马') || upper.includes('协议')) {
    return 'CYBER';
  }
  if (upper.includes('KINETIC') || upper.includes('MISSILE') || upper.includes('导弹') || upper.includes('拦截') || upper.includes('动能') || upper.includes('火炮')) {
    return 'KINETIC';
  }
  if (upper.includes('DEW') || upper.includes('LASER') || upper.includes('MICROWAVE') || upper.includes('激光') || upper.includes('微波') || upper.includes('脉冲')) {
    return 'DEW';
  }
  return 'EW';
};

/**
 * 归一化 weapon kill_type，确保符合数据库 CHECK 约束 ('SOFT' | 'HARD')
 */
export const normalizeKillType = (typeStr?: string, category?: string): 'SOFT' | 'HARD' => {
  if (category === 'KINETIC') return 'HARD';
  if (!typeStr) return 'SOFT';
  const upper = String(typeStr).toUpperCase();
  if (upper.includes('HARD') || upper.includes('硬') || upper.includes('摧毁') || upper.includes('物理')) {
    return 'HARD';
  }
  return 'SOFT';
};

/**
 * 基于后端 API 返回的 MatrixResult 动态解析生成实体与链路，注入 SQLite 数据库
 */
export const seedFromApiData = async (
  sqliteClient: any,
  matrixData: MatrixResult,
  durationMinutes: number = 50,
  startTime: number = 1781683200,
  areaBounds?: BattleAreaBounds | null,
  taskId?: string | number,
  taskName?: string
): Promise<void> => {
  console.log('开始基于 API 矩阵数据执行兵棋推演场景播种...');
  const sid = String(taskId ?? 'scen-001');

  // 1. 清理当前推演场景相关的旧数据
  await sqliteClient.execute(`DELETE FROM engagements WHERE plan_id IN (SELECT id FROM tactical_plans WHERE scenario_id = '${sid}')`);
  await sqliteClient.execute(`DELETE FROM tactical_plans WHERE id = 'plan-001' OR scenario_id = '${sid}'`);
  await sqliteClient.execute(`DELETE FROM communication_windows WHERE id LIKE 'link-%' OR scenario_id = '${sid}'`);
  await sqliteClient.execute('DELETE FROM weapons');
  await sqliteClient.execute('DELETE FROM assets');

  // 2. 插入战役场景记录 (scenarios)
  const endTime = startTime + durationMinutes * 60;
  const minLat = areaBounds?.min_lat ?? 22.0;
  const maxLat = areaBounds?.max_lat ?? 26.0;
  const minLng = areaBounds?.min_lng ?? 119.0;
  const maxLng = areaBounds?.max_lng ?? 123.0;

  await sqliteClient.execute(`
    INSERT OR REPLACE INTO scenarios (id, name, min_lat, max_lat, min_lng, max_lng, start_time, end_time, max_budget, time_step_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    sid, taskName ?? `战役任务 [${sid}]`,
    minLat, maxLat, minLng, maxLng,
    startTime, endTime,
    600000.0, 60
  ]);

  // 3. 动态提取并插入蓝方立体物理资产 (assets 表)
  // A. Layer 2 卫星资产 (从 initMatrixList / satelliteMatrixList 提取)
  const satMap = new Map<string, any>();

  const initMatrices = matrixData.initMatrixList || [];
  initMatrices.forEach(item => {
    const satId = `sat-${item.norad}`;
    const tleData = (item.line1 && item.line2) ? `${item.line1}\n${item.line2}` : null;
    satMap.set(satId, {
      id: satId,
      name: item.name || satId,
      side: 'BLUE',
      layer: 2,
      asset_class: 'SATELLITE',
      func_type: normalizeFuncType(item.satType),
      usage_type: normalizeUsageType(item.satType),
      lat: null,
      lng: null,
      alt: 550.0,
      tle_data: tleData,
      terrain_mask_angle: 10.0,
      anti_jam_level: 70,
      base_priority: 80,
      is_detected_by_red: 1
    });
  });

  const satMatrices = matrixData.satelliteMatrixList || [];
  satMatrices.forEach(item => {
    const satId = `sat-${item.norad}`;
    const existing = satMap.get(satId);
    const antiJam = item.satelliteStatus === 1 ? 0 : 70;
    if (existing) {
      existing.anti_jam_level = antiJam;
    } else {
      satMap.set(satId, {
        id: satId,
        name: item.name || satId,
        side: 'BLUE',
        layer: 2,
        asset_class: 'SATELLITE',
        func_type: normalizeFuncType(item.satType),
        usage_type: normalizeUsageType(item.satType),
        lat: null,
        lng: null,
        alt: 550.0,
        tle_data: null,
        terrain_mask_angle: 10.0,
        anti_jam_level: antiJam,
        base_priority: 80,
        is_detected_by_red: 1
      });
    }
  });

  // B. Layer 1 接收站资产 (从 initRelationList / stationRelationList 提取)
  const receiveMap = new Map<string, any>();
  const relationLists = [matrixData.initRelationList, matrixData.stationRelationList].filter(Boolean);

  relationLists.forEach(relList => {
    (relList.receiveObjList || []).forEach(rec => {
      if (!receiveMap.has(rec.receiveId)) {
        const coord = parseLatLon(rec.receiveLatLon);
        receiveMap.set(rec.receiveId, {
          id: rec.receiveId,
          name: rec.receiveName || rec.receiveId,
          side: 'BLUE',
          layer: 1,
          asset_class: 'STATION',
          func_type: 'COMM',
          usage_type: 'CIVIL_COMMERCIAL',
          lat: coord.lat,
          lng: coord.lng,
          alt: 0.05,
          tle_data: null,
          terrain_mask_angle: 10.0,
          anti_jam_level: rec.receiveStatus === 1 ? 0 : 60,
          base_priority: 50,
          is_detected_by_red: 1
        });
      }
    });
  });

  // C. Layer 0 中心云站 / 指挥中心 (从 stationObjList 提取)
  const stationMap = new Map<string, any>();
  relationLists.forEach(relList => {
    (relList.stationObjList || []).forEach(st => {
      if (!stationMap.has(st.stationId)) {
        const coord = parseLatLon(st.stationLatLon);
        stationMap.set(st.stationId, {
          id: st.stationId,
          name: st.stationName || st.stationId,
          side: 'BLUE',
          layer: 0,
          asset_class: 'COMMAND_CENTER',
          func_type: 'OTHER',
          usage_type: 'MILITARY',
          lat: coord.lat,
          lng: coord.lng,
          alt: 0.02,
          tle_data: null,
          terrain_mask_angle: 0.0,
          anti_jam_level: st.stationStatus === 1 ? 0 : 80,
          base_priority: 90,
          is_detected_by_red: 1
        });
      }
    });
  });

  // 执行 assets 批量插入
  const allAssets = [...Array.from(satMap.values()), ...Array.from(receiveMap.values()), ...Array.from(stationMap.values())];
  for (const a of allAssets) {
    await sqliteClient.execute(`
      INSERT OR REPLACE INTO assets (id, side, layer, asset_class, func_type, usage_type, lat, lng, alt, tle_data, terrain_mask_angle, anti_jam_level, base_priority, is_detected_by_red)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      a.id, a.side, a.layer, a.asset_class, a.func_type, a.usage_type,
      a.lat, a.lng, a.alt, a.tle_data, a.terrain_mask_angle, a.anti_jam_level, a.base_priority, a.is_detected_by_red
    ]);
  }

  // 4. 动态提取并插入红方武器实体 (weapons 表)
  const weaponMap = new Map<string, Weapon>();

  const collectWeapons = (weaponList?: Weapon[]) => {
    if (!weaponList) return;
    weaponList.forEach(w => {
      if (w && w.id && !weaponMap.has(w.id)) {
        weaponMap.set(w.id, w);
      }
    });
  };

  satMatrices.forEach(sm => {
    collectWeapons(sm.weapons);
    (sm.stationWindows || []).forEach(sw => collectWeapons(sw.weapons));
  });

  const allWeapons = Array.from(weaponMap.values());
  for (const w of allWeapons) {
    const category = normalizeWeaponCategory(w.type || w.name);
    const killType = normalizeKillType(w.type, category);
    await sqliteClient.execute(`
      INSERT OR REPLACE INTO weapons (id, name, category, kill_type, base_lat, base_lng, max_range, inventory, action_cost, political_risk)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      w.id, w.name || w.id, category, killType,
      w.latitude || 24.4, w.longitude || 118.2, w.range || 500.0,
      10, 12000.0, 0.5
    ]);
  }

  // 5. 插入初始作战计划 (tactical_plans 表)
  await sqliteClient.execute(`
    INSERT OR REPLACE INTO tactical_plans (id, scenario_id, name, intensity_level, total_cost, total_delay_achieved, nodes_destroyed, final_score)
    VALUES ('plan-001', ?, '当前实时推演方案', 'MEDIUM', 0.0, 0, 0, 0.0)
  `, [sid]);

  // 6. 动态插入通信链路窗口 (communication_windows 表)
  // A. 地地骨干静态链路 (Layer 1 ReceiveObj ➔ Layer 0 StationObj)
  const relationMaps: RelationMap[] = [];
  relationLists.forEach(relList => {
    if (relList.relations) {
      relationMaps.push(...relList.relations);
    }
  });

  const processedLinks = new Set<string>();
  for (const rel of relationMaps) {
    const linkKey = `${rel.from}::${rel.to}`;
    if (!processedLinks.has(linkKey)) {
      processedLinks.add(linkKey);
      const linkId = `link-static-${rel.from}-${rel.to}`;
      await sqliteClient.execute(`
        INSERT OR REPLACE INTO communication_windows (id, scenario_id, source_id, target_id, window_start, window_end, routing_converge_delay, link_status)
        VALUES (?, ?, ?, ?, 0, 9999999999, 30, 'TRANSMITTING')
      `, [linkId, sid, rel.from, rel.to]);
    }
  }

  // B. 星地动态通信窗口 (Layer 2 ➔ Layer 1)
  let windowIdx = 0;
  for (const sm of satMatrices) {
    const satId = `sat-${sm.norad}`;
    const windows = sm.stationWindows || [];
    for (const sw of windows) {
      const windowStart = parseWindowTimestamp(sw.peakWindow, startTime);
      const windowEnd = parseWindowTimestamp(sw.endWindow, startTime + durationMinutes * 60);
      const status = sw.strikeStatus === 1 ? 'JAMMED' : 'TRANSMITTING';
      const windowId = `win-${satId}-${sw.receiveId}-${windowIdx++}`;

      if (windowEnd > windowStart) {
        await sqliteClient.execute(`
          INSERT OR REPLACE INTO communication_windows (id, scenario_id, source_id, target_id, window_start, window_end, routing_converge_delay, link_status)
          VALUES (?, ?, ?, ?, ?, ?, 30, ?)
        `, [windowId, sid, satId, sw.receiveId, windowStart, windowEnd, status]);
      }
    }
  }

  console.log('基于 API 矩阵数据的兵棋推演资产、武器与拓扑链路加载解算完成！');
};
