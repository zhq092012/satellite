/** 作战方案报告 OpenAPI 类型（与 `openapi-snapshot.json` 中 report 相关 schema 对齐） */

/** 作战方案生成结果（阶段 × 档位矩阵 + 兼容扁平 schemes） */
export interface ReportGenerateResp {
  /** 任务 id */
  taskId?: string
  /** 任务名称 */
  taskName?: string
  /** 战役名称（配置项 report.campaign） */
  campaign?: string
  /** 兼容旧前端的扁平方案列表（阶段 × 档位逐格，每格一条） */
  schemes?: SchemeResult[]
  /** 阶段结构（含三档对比、升级性价比与归因） */
  stages?: ReportStageResult[]
  /** 全局告警（数据缺口、口径偏差、配额不足等） */
  warnings?: ReportWarning[]
  /** 指标口径表 */
  caliber?: ReportCaliber
  /** 一致性自检结果 */
  selfCheck?: ReportSelfCheck
  /** 报告生成时间 */
  generatedAt?: string
}

/**
 * 单个方案格子（兼容旧前端的扁平结构）。
 * 与历史「用途类型」方案并列展示时以 `code` / `name` 区分。
 */
export interface SchemeResult {
  /** 格子编码，格式 阶段-档位 */
  code?: string
  /** 格子名称 */
  name?: string
  /** 该阶段合成后的作战预期文本 */
  objective?: string
  /** 档位名（兼容旧字段名 scale，现表示档位） */
  scale?: string
  /** 阶段编码 */
  stageCode?: string
  /** 阶段名称 */
  stageName?: string
  /** 对手方国家 */
  country?: string
  /** 档位序号，从 1 开始 */
  tierIndex?: number
  /** 本档目标总数（强制集 + 选择集） */
  targetSize?: number
  /** selected 是否因上限被截断（大档完整明细见 stages） */
  selectedTruncated?: boolean
  /** 强制集数量 */
  forcedSize?: number
  /** 配额选择集数量 */
  chosenSize?: number
  /** 入选卫星明细（可能被截断） */
  selected?: ReportCandidateSatellite[]
  /** 入选卫星评分：key 一般为 NORAD 编号 */
  selectedScores?: Record<string, number>
  /** 入选理由：key 与 selectedScores 对齐 */
  selectedReasons?: Record<string, string>
  /** 落选理由 */
  unselectedReasons?: Record<string, string>
  /** 收益与风险指标 */
  metrics?: ReportMetrics
  /** 达成度 B(S)/B(I_p)，0~1 */
  attainment?: number
  /** 求解口径：EXACT / PRUNED_EXACT / GREEDY_SWAP / DIRECT */
  solverCaliber?: string
  /** 配额执行明细 */
  quota?: ReportQuotaLine[]
}

/** 选星候选卫星（扁平格子 selected 项） */
export interface ReportCandidateSatellite {
  /** 卫星记录 id */
  satelliteId?: string
  /** NORAD 编号 */
  noradId?: string
  /** 卫星名称 */
  name?: string
  /** 所属国家 */
  country?: string
  /** 阵营编码 A/B/C；未映射为 null */
  camp?: string | null
  /** 体系：侦察/通信/中继 */
  system?: string
  /** 系列 */
  series?: string
  /** 用途：军用/商用 */
  usage?: string
  /** 配额角色：forced / chosen / runner-up */
  quotaRole?: string
  /** 前序阶段已受扰次数 */
  usedTimes?: number
  /** 威胁度 */
  threat?: number
  /** 覆盖收益 */
  coverGain?: number
  /** 过境收益 */
  transitGain?: number
  /** 中继杠杆收益 */
  relayLeverage?: number
  /** 作战时间窗起 */
  timeWindowStart?: string
  /** 作战时间窗止 */
  timeWindowEnd?: string
  /** 是否落在本次作战时间窗内 */
  inTimeWindow?: boolean
}

/** 阶段结果（含三档对比与归因） */
export interface ReportStageResult {
  /** 阶段编码 */
  code?: string
  /** 阶段名称 */
  name?: string
  /** 对手方国家 */
  country?: string
  /** 混合作战预期文本 */
  expectation?: string
  /** 空间覆盖收益权重 θ_cov */
  thetaCover?: number
  /** 持续断链收益权重 θ_pers */
  thetaPersist?: number
  /** 体系能力收益权重 θ_sos */
  thetaSos?: number
  /** 风险基准 λ */
  lambdaRisk?: number
  /** 阶段池大小 */
  poolSize?: number
  /** 阶段池按体系桶计数 */
  poolByBucket?: Record<string, number>
  /** 对手国全库按体系桶计数（诊断用） */
  catalogByBucket?: Record<string, number>
  /** 阶段池全量收益指标 */
  ceiling?: ReportMetrics
  /** 阶段池全量的达成度，基准为 1.0 */
  ceilingAttainment?: number
  /** 可达上限收益指标 */
  reachableCeiling?: ReportMetrics
  /** 三档详情 */
  tiers?: ReportTierResult[]
  /** 相邻档升级性价比 */
  upgrades?: ReportUpgradeEconomics[]
  /** 推荐档序号，从 1 开始 */
  recommendedTier?: number
  /** 推荐结论文本 */
  recommendation?: string
  /** 跨阶段命中的已干扰目标数 */
  reusedTargets?: number
  /** 本阶段告警 */
  warnings?: ReportWarning[]
}

/** 单个档位结果 */
export interface ReportTierResult {
  /** 档位序号，从 1 开始 */
  index?: number
  /** 档位名称 */
  name?: string
  /** 决心里这一档的原始描述 */
  intent?: string
  /** 本档目标总数 */
  targetSize?: number
  /** 强制集数量 */
  forcedSize?: number
  /** 配额选择集数量 */
  chosenSize?: number
  /** 逐星明细是否被截断 */
  detailTruncated?: boolean
  /** 强制集目标 */
  forced?: ReportTargetLine[]
  /** 配额选择集目标 */
  chosen?: ReportTargetLine[]
  /** 同桶落选替补 */
  runnerUps?: ReportTargetLine[]
  /** 按系列聚合的归因 */
  seriesGroups?: ReportSeriesGroup[]
  /** 配额明细 */
  quota?: ReportQuotaLine[]
  /** 收益与风险指标 */
  metrics?: ReportMetrics
  /** 达成度 0~1 */
  attainment?: number
  /** 求解口径信息 */
  solver?: ReportSolver
  /** 方案内冗余度 0~1 */
  redundancy?: number
  /** 两两交互项 */
  interactions?: ReportInteraction[]
  /** 剩余能力曲线 */
  residualCurve?: ReportResidualPoint[]
  /** 反事实分析 */
  counterfactual?: ReportCounterfactual
  /** 蒙特卡洛稳定性评估 */
  stability?: ReportStability
  /** 起步档 / 升档建议 */
  advice?: string
}

/** 逐目标归因行 */
export interface ReportTargetLine {
  /** NORAD 编号 */
  noradId?: string
  /** 卫星名称 */
  name?: string
  /** 所属国家 */
  country?: string
  /** 体系 */
  system?: string
  /** 系列 */
  series?: string
  /** 用途 */
  usage?: string
  /** 配额角色 */
  quotaRole?: string
  /** 前序阶段已受扰次数 */
  usedTimes?: number
  /** 收益折扣因子 */
  benefitFactor?: number
  /** 风险累进因子 */
  riskFactor?: number
  /** 威胁度 */
  threat?: number
  /** 覆盖贡献 */
  coverage?: number
  /** 持续断链贡献 */
  persistence?: number
  /** 体系桶内权重 */
  sosWeight?: number
  /** 目标风险明细 */
  risk?: ReportRiskBreakdown
  /** 边际贡献 */
  marginal?: number
  /** 边际贡献占比 */
  marginalShare?: number
  /** 证据链文本 */
  evidence?: string
}

/** 收益与风险指标 */
export interface ReportMetrics {
  /** 空间覆盖收益 B_cov，0~1 */
  benefitCover?: number
  /** 持续断链收益 B_pers，0~1 */
  benefitPersist?: number
  /** 体系能力收益 B_sos，0~1 */
  benefitSos?: number
  /** 综合收益 B */
  benefit?: number
  /** 风险扣分 */
  risk?: number
  /** 综合分 Score */
  score?: number
}

/** 配额执行明细 */
export interface ReportQuotaLine {
  /** 体系桶；* 表示全部体系 */
  system?: string
  /** 配额模式：COUNT / RATIO / ALL */
  mode?: string
  /** 决心配置原值 */
  declared?: number
  /** 比例配额基数：AVAILABLE_POOL / CATALOG */
  base?: string
  /** 桶内可选目标数 */
  bucketSize?: number
  /** 本档要求数量 */
  required?: number
  /** 实际选中数量 */
  selected?: number
  /** 是否因「全部」进入强制集 */
  forced?: boolean
  /** 配额是否满足 */
  satisfied?: boolean
}

/** 告警 */
export interface ReportWarning {
  /** 告警编码 */
  code?: string
  /** 告警级别：INFO / WARN / ERROR */
  level?: string
  /** 告警内容 */
  text?: string
}

/** 指标口径表 */
export interface ReportCaliber {
  /** 口径行列表 */
  lines?: ReportCaliberLine[]
}

/** 单项指标口径说明 */
export interface ReportCaliberLine {
  /** 指标名称 */
  metric?: string
  /** 定义/公式 */
  formula?: string
  /** 取数来源 */
  source?: string
  /** 值域 */
  range?: string
}

/** 一致性自检结果 */
export interface ReportSelfCheck {
  /** 是否全部检查通过 */
  passed?: boolean
  /** 检查项明细 */
  checks?: ReportCheckLine[]
}

/** 单项自检结果 */
export interface ReportCheckLine {
  /** 检查项名称 */
  name?: string
  /** 是否通过 */
  passed?: boolean
  /** 详情（不通过时含原因） */
  detail?: string
}

/** 相邻档位升级性价比 */
export interface ReportUpgradeEconomics {
  /** 起始档位序号 */
  fromTier?: number
  /** 目标档位序号 */
  toTier?: number
  /** 达成度增量 */
  deltaAttainment?: number
  /** 风险增量 */
  deltaRisk?: number
  /** 升级性价比 */
  costEffectiveness?: number
  /** 风险临界值 λ* */
  lambdaBreakEven?: number | null
  /** 结论文本 */
  conclusion?: string
}

/** 配额级反事实 */
export interface ReportQuotaShift {
  /** 体系桶 */
  system?: string
  /** 原配额数量 */
  required?: number
  /** 调整后的配额数量 */
  shifted?: number
  /** 调整后达成度 */
  attainment?: number
  /** 调整后风险 */
  risk?: number
  /** 结论文本 */
  conclusion?: string
}

/** 目标风险明细 */
export interface ReportRiskBreakdown {
  /** 防护强度风险 */
  protection?: number
  /** 升级风险 */
  escalation?: number
  /** 附带损伤风险 */
  collateral?: number
  /** 风险合计 */
  total?: number
}

/** 按系列聚合的归因 */
export interface ReportSeriesGroup {
  /** 系列名称 */
  series?: string
  /** 体系 */
  system?: string
  /** 该系列入选数量 */
  count?: number
  /** 威胁度之和 */
  sumThreat?: number
  /** 边际贡献之和 */
  sumMarginal?: number
  /** 组内代表卫星名称 */
  topNames?: string[]
}

/** 求解口径信息 */
export interface ReportSolver {
  /** 求解口径 */
  caliber?: string
  /** 参与比较的组合数 */
  combinations?: number
  /** 剪枝宽度 M */
  topM?: number
  /** 是否执行 swap 优化 */
  swapApplied?: boolean
  /** 口径含义说明 */
  meaning?: string
}

/** 两个目标之间的交互项 */
export interface ReportInteraction {
  /** 目标 A 的 NORAD */
  a?: string
  /** 目标 B 的 NORAD */
  b?: string
  /** 交互值 */
  value?: number
  /** 类型：redundant / complementary */
  kind?: string
}

/** 剩余能力曲线点 */
export interface ReportResidualPoint {
  /** 干扰顺序步数 */
  step?: number
  /** 该步干扰的目标 */
  target?: string
  /** 该步后的剩余能力 */
  residualCapability?: number
  /** 该步后的覆盖收益 */
  benefitCover?: number
}

/** 反事实分析 */
export interface ReportCounterfactual {
  /** 目标级反事实 */
  targetDrops?: ReportTargetDrop[]
  /** 配额级反事实 */
  quotaShifts?: ReportQuotaShift[]
}

/** 目标级反事实 */
export interface ReportTargetDrop {
  /** 被剔除目标的 NORAD */
  noradId?: string
  /** 被剔除目标名称 */
  name?: string
  /** 剔除后达成度损失 */
  attainmentLoss?: number
  /** 推荐替补 */
  replacement?: string
  /** 结论文本 */
  conclusion?: string
}

/** 蒙特卡洛稳定性评估 */
export interface ReportStability {
  /** 状态：OK / SKIPPED(规模) / SKIPPED(配置关闭) */
  status?: string
  /** 扰动重解次数 */
  samples?: number
  /** 达成度 P10 */
  attainmentP10?: number
  /** 达成度 P90 */
  attainmentP90?: number
  /** 目标集保留率 0~1 */
  setRetention?: number
  /** 说明 */
  note?: string
}