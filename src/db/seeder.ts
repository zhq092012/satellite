/**
 * 战术数据初始化脚本 (Seed Data for Sprint 3)
 */

export interface BattleAreaBounds {
  min_lat: number
  max_lat: number
  min_lng: number
  max_lng: number
}

export const seedMockData = async (
  sqliteClient: any,
  durationMinutes: number = 50,
  startTime: number = 1781683200,
  areaBounds?: BattleAreaBounds | null
): Promise<void> => {
  console.log('开始执行兵棋推演数据初始化...');

  // 1. 清空当前推演相关的表和数据 (不删除 scenarios 和用户保存的 tactical_plans)
  await sqliteClient.execute("DELETE FROM engagements WHERE plan_id = 'plan-001'");
  await sqliteClient.execute("DELETE FROM tactical_plans WHERE id = 'plan-001'");
  await sqliteClient.execute('DELETE FROM communication_windows');
  await sqliteClient.execute('DELETE FROM weapons');
  await sqliteClient.execute('DELETE FROM assets');

  // 2. 插入战役场景记录 (scen-001, 动态压制时长与动态开始时间及动态经纬度边界)
  const endTime = startTime + durationMinutes * 60;
  const minLat = areaBounds?.min_lat ?? 22.0;
  const maxLat = areaBounds?.max_lat ?? 26.0;
  const minLng = areaBounds?.min_lng ?? 119.0;
  const maxLng = areaBounds?.max_lng ?? 123.0;

  await sqliteClient.execute(`
    INSERT OR REPLACE INTO scenarios (id, name, min_lat, max_lat, min_lng, max_lng, start_time, end_time, max_budget, time_step_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'scen-001', '海峡东部多域对空电磁对抗演练 (Sprint 3)',
    minLat, maxLat, minLng, maxLng,
    startTime, endTime,
    600000.0, 60
  ]);

  // 3. 静态插入 26 条蓝方立体物理资产 (13 卫星 + 11 接收站 + 2 指挥中心)
  await sqliteClient.execute(`
    INSERT INTO assets (id, side, layer, asset_class, func_type, usage_type, lat, lng, alt, tle_data, terrain_mask_angle, anti_jam_level, base_priority, is_detected_by_red)
    VALUES 
    -- 蓝方低轨通信与侦察卫星 (Layer = 2)
    ('sat-starlink-01', 'BLUE', 2, 'SATELLITE', 'COMM', 'MILITARY', NULL, NULL, 550.0, 
     '1 56834U 23079A   26198.54238426  .00008425  00000-0  57685-3 0  9997\\n2 56834  43.0012 300.1245 0001423  95.4215 264.8912 15.02451290123456', 
     10.0, 65, 80, 1),
    ('sat-starlink-02', 'BLUE', 2, 'SATELLITE', 'COMM', 'MILITARY', NULL, NULL, 552.0, 
     '1 56835U 23079B   26198.55349537  .00008536  00000-0  58491-3 0  9998\\n2 56835  43.0023 300.2356 0001534  96.5326 265.9023 15.02562391123457', 
     10.0, 60, 80, 1),
    ('sat-starlink-03', 'BLUE', 2, 'SATELLITE', 'COMM', 'CIVIL_COMMERCIAL', NULL, NULL, 548.0, 
     '1 56839U 23079F   26198.59793979  .00008979  00000-0  61715-3 0  9999\\n2 56839  43.0067 300.6789 0001978  99.9767 269.3467 15.03016795123461', 
     10.0, 55, 75, 1),
    ('sat-starlink-04', 'BLUE', 2, 'SATELLITE', 'COMM', 'MILITARY', NULL, NULL, 555.0, 
     '1 56842U 23079J   26198.63127202  .00009312  00000-0  63992-3 0  9990\\n2 56842  43.0098 301.0123 0002201 102.3098 271.6789 15.03358901123464', 
     10.0, 70, 85, 1),
    ('sat-starlink-05', 'BLUE', 2, 'SATELLITE', 'COMM', 'CIVIL_COMMERCIAL', NULL, NULL, 545.0, 
     '1 56848U 23079P   26198.69793979  .00009979  00000-0  68991-3 0  9991\\n2 56848  43.0167 301.7123 0002712 107.8123 277.1234 15.04012308123470', 
     10.0, 50, 70, 1),
    ('sat-wv-1', 'BLUE', 2, 'SATELLITE', 'RECON', 'CIVIL_COMMERCIAL', NULL, NULL, 496.0, 
     '1 32258U 07041A   26204.42157832  .00002148  00000-0  10834-3 0  9997\\n2 32258  97.4125 284.1458 0001247  85.4124 274.7412 15.21478952985123', 
     10.0, 60, 65, 1),
    ('sat-wv-2', 'BLUE', 2, 'SATELLITE', 'RECON', 'CIVIL_COMMERCIAL', NULL, NULL, 770.0, 
     '1 35946U 09055A   26204.43254189  .00000214  00000-0  34125-4 0  9991\\n2 35946  98.5412 295.4125 0001478  92.1458 268.1245 14.36547892874123', 
     10.0, 60, 65, 1),
    ('sat-wv-3', 'BLUE', 2, 'SATELLITE', 'RECON', 'CIVIL_COMMERCIAL', NULL, NULL, 617.0, 
     '1 40115U 14047A   26204.45124785  .00000841  00000-0  54128-4 0  9993\\n2 40115  97.9845 301.2458 0001142 104.2415 255.8412 14.85412574632145', 
     10.0, 65, 70, 1),
    ('sat-legion-1', 'BLUE', 2, 'SATELLITE', 'RECON', 'CIVIL_COMMERCIAL', NULL, NULL, 510.0, 
     '1 59612U 24041A   26204.41025412  .00001542  00000-0  85412-4 0  9992\\n2 59612  97.4512 270.1425 0001250  78.4512 281.6547 15.18451274351246', 
     10.0, 70, 75, 1),
    ('sat-legion-2', 'BLUE', 2, 'SATELLITE', 'RECON', 'CIVIL_COMMERCIAL', NULL, NULL, 510.0, 
     '1 59613U 24041B   26204.41254123  .00001548  00000-0  85654-4 0  9998\\n2 59613  97.4515 270.8541 0001248  79.1245 280.9845 15.18456985351247', 
     10.0, 70, 75, 1),
    ('sat-skysat-c3', 'BLUE', 2, 'SATELLITE', 'RECON', 'CIVIL_COMMERCIAL', NULL, NULL, 500.0, 
     '1 41548U 16035A   26204.48412541  .00002451  00000-0  12458-3 0  9994\\n2 41548  97.4854 265.1245 0001541  88.4512 271.6542 15.24157894125463', 
     10.0, 55, 60, 1),
    ('sat-kh-12', 'BLUE', 2, 'SATELLITE', 'RECON', 'MILITARY', NULL, NULL, 390.0, 
     '1 47541U 21014A   26204.12458712  .00004512  00000-0  21458-3 0  9991\\n2 47541  97.8541 185.4125 0008451  45.1245 315.6542 15.54125789642154', 
     10.0, 85, 95, 1),
    ('sat-fia-r-1', 'BLUE', 2, 'SATELLITE', 'RECON', 'MILITARY', NULL, NULL, 1100.0, 
     '1 37152U 10046A   26204.25412896  .00000102  00000-0  12451-4 0  9996\\n2 37152 123.0145  45.1248 0002145 120.4512 240.1548 12.18451247954123', 
     10.0, 80, 90, 1),

    -- 海峡战区与全球同盟地基接收站 (Layer = 0, 1)
    ('station-hualien', 'BLUE', 1, 'STATION', 'COMM', 'CIVIL_COMMERCIAL', 24.0, 121.6, 0.05, NULL, 10.0, 50, 45, 1),
    ('station-hengchun', 'BLUE', 1, 'STATION', 'COMM', 'MILITARY', 22.0, 120.7, 0.08, NULL, 10.0, 60, 50, 1),
    ('station-keelung', 'BLUE', 1, 'STATION', 'COMM', 'CIVIL_COMMERCIAL', 25.1, 121.7, 0.03, NULL, 10.0, 45, 40, 1),
    ('station-taitung', 'BLUE', 1, 'STATION', 'COMM', 'MILITARY', 22.8, 121.1, 0.12, NULL, 10.0, 70, 55, 1),
    ('station-penghu', 'BLUE', 1, 'STATION', 'COMM', 'CIVIL_COMMERCIAL', 23.6, 119.6, 0.04, NULL, 10.0, 50, 65, 1),
    ('station-dulles', 'BLUE', 1, 'STATION', 'COMM', 'CIVIL_COMMERCIAL', 38.947, -77.443, 0.1, NULL, 10.0, 70, 80, 1),
    ('station-fairbanks', 'BLUE', 1, 'STATION', 'RELAY', 'CIVIL_COMMERCIAL', 64.900, -147.300, 0.15, NULL, 8.0, 65, 70, 1),
    ('station-munich', 'BLUE', 1, 'STATION', 'COMM', 'CIVIL_COMMERCIAL', 48.0736, 11.2639, 0.6, NULL, 10.0, 70, 75, 1),
    ('station-adf-east', 'BLUE', 1, 'COMMAND_CENTER', 'COMM', 'MILITARY', 38.736, -77.164, 0.08, NULL, 12.0, 90, 95, 1),
    ('station-adf-southwest', 'BLUE', 1, 'STATION', 'COMM', 'MILITARY', 32.330, -106.610, 1.2, NULL, 5.0, 85, 90, 1),
    ('station-pine-gap', 'BLUE', 1, 'STATION', 'RELAY', 'MILITARY', -23.797, 133.738, 0.6, NULL, 10.0, 85, 85, 1),

    -- 2 个战术联合指挥控制中心 (Layer = 0)
    ('cmd-taipei', 'BLUE', 0, 'COMMAND_CENTER', 'OTHER', 'MILITARY', 25.0, 121.5, 0.04, NULL, 0.0, 80, 95, 1),
    ('cmd-zuoying', 'BLUE', 0, 'COMMAND_CENTER', 'OTHER', 'MILITARY', 22.7, 120.3, 0.02, NULL, 0.0, 75, 90, 1)
  `);

  // 4. 静态插入 8 种红方跨域武器 (EMP, 网络黑客, 电磁干扰车, 反卫星导弹, 高能激光, 脉冲微波, 射频天线阵列, 特种网络木马)
  await sqliteClient.execute(`
    INSERT INTO weapons (id, name, category, kill_type, base_lat, base_lng, max_range, inventory, action_cost, political_risk)
    VALUES 
    ('weapon-emp', 'HPM-500高功率微波电磁脉冲波武器', 'DEW', 'SOFT', 24.4, 118.2, 500.0, 10, 12000.0, 0.5),
    ('weapon-hacker', '“特洛伊-2.0”协议劫持木马', 'CYBER', 'SOFT', 0.0, 0.0, -1.0, -1, 2500.0, 0.1),
    ('weapon-jammer', '雷霆-600车载型超宽带定向干扰车', 'EW', 'SOFT', 24.1, 118.8, 800.0, -1, 1500.0, 0.2),
    ('weapon-hq19', 'HQ-19直升式反卫星拦截导弹', 'KINETIC', 'HARD', 23.5, 117.0, 2500.0, 4, 120000.0, 0.9),
    ('weapon-laser-korla', '地基高能激光反卫星系统', 'DEW', 'HARD', 25.5, 119.5, 2500.0, 6, 150000.0, 0.8),
    ('weapon-microwave-机动', '百吉瓦级脉冲微波作战系统', 'DEW', 'SOFT', 24.8, 118.6, 2000.0, -1, 30000.0, 0.4),
    ('weapon-ew-fixed', '大型分布式地基射频压制干扰天线阵列', 'EW', 'SOFT', 25.8, 119.8, 2500.0, -1, 5000.0, 0.2),
    ('weapon-cyber-trojan', '控制面协议阻断特种网络木马', 'CYBER', 'SOFT', 39.904, 116.407, -1.0, 5, 80000.0, 0.5)
  `);

  // 5. 插入初始作战计划
  await sqliteClient.execute(`
    INSERT INTO tactical_plans (id, scenario_id, name, intensity_level, total_cost, total_delay_achieved, nodes_destroyed, final_score)
    VALUES ('plan-001', 'scen-001', '当前实时推演方案', 'MEDIUM', 0.0, 0, 0, 0.0)
  `);

  // 6. 静态插入骨干链路 (静态网状连线)
  await sqliteClient.execute(`
    INSERT INTO communication_windows (id, scenario_id, source_id, target_id, window_start, window_end, routing_converge_delay, link_status)
    VALUES 
    -- 本地雷达接收站 (Layer 1) -> 本地战术指挥中心 (Layer 0)
    ('link-static-1', 'scen-001', 'station-hualien', 'cmd-taipei', 0, 9999999999, 30, 'TRANSMITTING'),
    ('link-static-2', 'scen-001', 'station-keelung', 'cmd-taipei', 0, 9999999999, 30, 'TRANSMITTING'),
    ('link-static-3', 'scen-001', 'station-taitung', 'cmd-zuoying', 0, 9999999999, 30, 'TRANSMITTING'),
    ('link-static-4', 'scen-001', 'station-hengchun', 'cmd-zuoying', 0, 9999999999, 30, 'TRANSMITTING'),
    ('link-static-5', 'scen-001', 'station-penghu', 'cmd-zuoying', 0, 9999999999, 30, 'TRANSMITTING'),

    -- 海外/同盟核心站 -> ADF 涉密核心主站 (station-adf-east)
    ('link-static-6', 'scen-001', 'station-dulles', 'station-adf-east', 0, 9999999999, 30, 'TRANSMITTING'),
    ('link-static-7', 'scen-001', 'station-fairbanks', 'station-adf-east', 0, 9999999999, 30, 'TRANSMITTING'),
    ('link-static-8', 'scen-001', 'station-munich', 'station-adf-east', 0, 9999999999, 30, 'TRANSMITTING'),
    ('link-static-9', 'scen-001', 'station-adf-southwest', 'station-adf-east', 0, 9999999999, 30, 'TRANSMITTING'),
    ('link-static-10', 'scen-001', 'station-pine-gap', 'station-adf-east', 0, 9999999999, 30, 'TRANSMITTING'),

    -- 跨域指挥通信骨干: ADF 涉密核心主站 -> 战区联合指挥中心
    ('link-static-11', 'scen-001', 'station-adf-east', 'cmd-taipei', 0, 9999999999, 30, 'TRANSMITTING'),
    ('link-static-12', 'scen-001', 'station-adf-east', 'cmd-zuoying', 0, 9999999999, 30, 'TRANSMITTING')
  `);

  console.log('兵棋推演基础资产与武器数据加载完成！');
};


