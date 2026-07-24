export const assetsSeeder = [
  // ==================== 天基层资产 (SATELLITE) ====================
  // --- WorldView 系列卫星 ---
  {
    id: "sat-wv-1",
    side: "BLUE",
    layer: 2,
    asset_class: "SATELLITE",
    func_type: "RECON",
    usage_type: "CIVIL_COMMERCIAL",
    lat: null,
    lng: null,
    alt: 496.0,
    tle_data: "1 32258U 07041A   26204.42157832  .00002148  00000-0  10834-3 0  9997\n2 32258  97.4125 284.1458 0001247  85.4124 274.7412 15.21478952985123",
    anti_jam_level: 60,
    base_priority: 65,
    is_detected_by_red: 1
  },
  {
    id: "sat-wv-2",
    side: "BLUE",
    layer: 2,
    asset_class: "SATELLITE",
    func_type: "RECON",
    usage_type: "CIVIL_COMMERCIAL",
    lat: null,
    lng: null,
    alt: 770.0,
    tle_data: "1 35946U 09055A   26204.43254189  .00000214  00000-0  34125-4 0  9991\n2 35946  98.5412 295.4125 0001478  92.1458 268.1245 14.36547892874123",
    anti_jam_level: 60,
    base_priority: 65,
    is_detected_by_red: 1
  },
  {
    id: "sat-wv-3",
    side: "BLUE",
    layer: 2,
    asset_class: "SATELLITE",
    func_type: "RECON",
    usage_type: "CIVIL_COMMERCIAL",
    lat: null,
    lng: null,
    alt: 617.0,
    tle_data: "1 40115U 14047A   26204.45124785  .00000841  00000-0  54128-4 0  9993\n2 40115  97.9845 301.2458 0001142 104.2415 255.8412 14.85412574632145",
    anti_jam_level: 65,
    base_priority: 70,
    is_detected_by_red: 1
  },
  // --- WorldView Legion 星座 ---
  {
    id: "sat-legion-1",
    side: "BLUE",
    layer: 2,
    asset_class: "SATELLITE",
    func_type: "RECON",
    usage_type: "CIVIL_COMMERCIAL",
    lat: null,
    lng: null,
    alt: 510.0,
    tle_data: "1 59612U 24041A   26204.41025412  .00001542  00000-0  85412-4 0  9992\n2 59612  97.4512 270.1425 0001250  78.4512 281.6547 15.18451274351246",
    anti_jam_level: 70,
    base_priority: 75,
    is_detected_by_red: 1
  },
  {
    id: "sat-legion-2",
    side: "BLUE",
    layer: 2,
    asset_class: "SATELLITE",
    func_type: "RECON",
    usage_type: "CIVIL_COMMERCIAL",
    lat: null,
    lng: null,
    alt: 510.0,
    tle_data: "1 59613U 24041B   26204.41254123  .00001548  00000-0  85654-4 0  9998\n2 59613  97.4515 270.8541 0001248  79.1245 280.9845 15.18456985351247",
    anti_jam_level: 70,
    base_priority: 75,
    is_detected_by_red: 1
  },
  // --- SkySat 主力星 (SSO 轨道示例) ---
  {
    id: "sat-skysat-c3",
    side: "BLUE",
    layer: 2,
    asset_class: "SATELLITE",
    func_type: "RECON",
    usage_type: "CIVIL_COMMERCIAL",
    lat: null,
    lng: null,
    alt: 500.0,
    tle_data: "1 41548U 16035A   26204.48412541  .00002451  00000-0  12458-3 0  9994\n2 41548  97.4854 265.1245 0001541  88.4512 271.6542 15.24157894125463",
    anti_jam_level: 55,
    base_priority: 60,
    is_detected_by_red: 1
  },
  // --- 美国军用顶尖光学间谍卫星 KH-12 ---
  {
    id: "sat-kh-12",
    side: "BLUE",
    layer: 2,
    asset_class: "SATELLITE",
    func_type: "RECON",
    usage_type: "MILITARY",
    lat: null,
    lng: null,
    alt: 390.0,
    tle_data: "1 47541U 21014A   26204.12458712  .00004512  00000-0  21458-3 0  9991\n2 47541  97.8541 185.4125 0008451  45.1245 315.6542 15.54125789642154",
    anti_jam_level: 85,
    base_priority: 95,
    is_detected_by_red: 1
  },
  // --- 军用 SAR 雷达成像卫星 FIA-R (USA-215) ---
  {
    id: "sat-fia-r-1",
    side: "BLUE",
    layer: 2,
    asset_class: "SATELLITE",
    func_type: "RECON",
    usage_type: "MILITARY",
    lat: null,
    lng: null,
    alt: 1100.0,
    tle_data: "1 37152U 10046A   26204.25412896  .00000102  00000-0  12451-4 0  9996\n2 37152 123.0145  45.1248 0002145 120.4512 240.1548 12.18451247954123",
    anti_jam_level: 80,
    base_priority: 90,
    is_detected_by_red: 1
  },

  // ==================== 地基层资产 (STATION) ====================
  // --- 北美总控及核心枢纽 ---
  {
    id: "station-dulles",
    side: "BLUE",
    layer: 0,
    asset_class: "STATION",
    func_type: "COMM",
    usage_type: "CIVIL_COMMERCIAL",
    lat: 38.947,
    lng: -77.443,
    alt: 0.1,
    tle_data: null,
    terrain_mask_angle: 10.0,
    anti_jam_level: 70,
    base_priority: 80,
    is_detected_by_red: 1
  },
  {
    id: "station-fairbanks",
    side: "BLUE",
    layer: 0,
    asset_class: "STATION",
    func_type: "RELAY",
    usage_type: "CIVIL_COMMERCIAL",
    lat: 64.900,
    lng: -147.300,
    alt: 0.15,
    tle_data: null,
    terrain_mask_angle: 8.0,
    anti_jam_level: 65,
    base_priority: 70,
    is_detected_by_red: 1
  },
  // --- 欧洲区域独家代理核心接收站 ---
  {
    id: "station-munich",
    side: "BLUE",
    layer: 0,
    asset_class: "STATION",
    func_type: "COMM",
    usage_type: "CIVIL_COMMERCIAL",
    lat: 48.0736,
    lng: 11.2639,
    alt: 0.6,
    tle_data: null,
    terrain_mask_angle: 10.0,
    anti_jam_level: 70,
    base_priority: 75,
    is_detected_by_red: 1
  },
  // --- 军用涉密 ADF 核心主站 (NRO 锁眼/FIA-R 专用) ---
  {
    id: "station-adf-east",
    side: "BLUE",
    layer: 0,
    asset_class: "COMMAND_CENTER",
    func_type: "COMM",
    usage_type: "MILITARY",
    lat: 38.736,
    lng: -77.164,
    alt: 0.08,
    tle_data: null,
    terrain_mask_angle: 12.0,
    anti_jam_level: 90,
    base_priority: 95,
    is_detected_by_red: 1
  },
  {
    id: "station-adf-southwest",
    side: "BLUE",
    layer: 0,
    asset_class: "STATION",
    func_type: "COMM",
    usage_type: "MILITARY",
    lat: 32.330,
    lng: -106.610,
    alt: 1.2,
    tle_data: null,
    terrain_mask_angle: 5.0,
    anti_jam_level: 85,
    base_priority: 90,
    is_detected_by_red: 1
  },
  // --- 海外同盟联合防御设施 ---
  {
    id: "station-pine-gap",
    side: "BLUE",
    layer: 0,
    asset_class: "STATION",
    func_type: "RELAY",
    usage_type: "MILITARY",
    lat: -23.797,
    lng: 133.738,
    alt: 0.6,
    tle_data: null,
    terrain_mask_angle: 10.0,
    anti_jam_level: 85,
    base_priority: 85,
    is_detected_by_red: 1
  }
];

export const weaponsSeeder = [
  // ==================== 红方多域战打击体系武器 ====================
  // --- 定向能/电子战软杀伤与硬摧毁武器 ---
  {
    id: "wpn-laser-korla",
    name: "地基高能激光反卫星系统 (新疆库尔勒阵地)",
    category: "DEW",
    kill_type: "HARD",
    base_lat: 41.725, // 依据库尔勒东部试验场范围补充
    base_lng: 86.142,
    max_range: 2000.0, // 天基低轨道射程覆盖
    inventory: 5,      // 储能限制或拦截批次
    action_cost: 150000.0,
    political_risk: 0.8  // 硬杀伤，政治升级风险高
  },
  {
    id: "wpn-microwave-机动",
    name: "百吉瓦级脉冲微波作战系统 (强力克制低轨星座)",
    category: "DEW",
    kill_type: "SOFT",
    base_lat: 39.741, // 依据甘肃酒泉72号靶场周边补充
    base_lng: 98.495,
    max_range: 800.0,  // 针对近地低轨重创元器件
    inventory: -1,     // 电力供应，无限开火权
    action_cost: 30000.0,
    political_risk: 0.4
  },
  // --- 传统电磁频谱电子战干扰车/阵列 ---
  {
    id: "wpn-ew-fixed",
    name: "大型分布式地基射频压制干扰天线阵列",
    category: "EW",
    kill_type: "SOFT",
    base_lat: 36.251, // 青海茶卡戈壁阵地补全
    base_lng: 99.124,
    max_range: 1500.0,
    inventory: -1,
    action_cost: 5000.0,
    political_risk: 0.2  // 纯软干扰，政治风险较低
  },
  // --- 全局网络战突击武器 ---
  {
    id: "wpn-cyber-trojan",
    name: "控制面协议阻断特种网络木马",
    category: "CYBER",
    kill_type: "SOFT",
    base_lat: 39.904, // 指挥中心基准经纬度
    base_lng: 116.407,
    max_range: -1.0,   // 按照约束，网络武器设为 -1 表示无距离限制
    inventory: 3,      // 漏洞触发次数
    action_cost: 80000.0,
    political_risk: 0.5
  }
];