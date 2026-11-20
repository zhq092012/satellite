/** 计算模块：因子得分明细 */
export interface FactorScore {
  /** 因子编码 */
  code?: string
  /** 因子名称 */
  name?: string
  /** 因子分值 */
  value?: number
  /** 补充说明 */
  detail?: string
}

/** 计算模块：已注册算法信息 */
export interface AlgorithmInfo {
  /** 算法种类编码 */
  kind?: string
  /** 算法种类名称 */
  kindLabel?: string
  /** 算法编码 */
  code?: string
  /** 算法名称 */
  name?: string
  /** 是否为当前默认生效算法 */
  active?: boolean
}

/** 计算模块：本次计算使用的算法编码 */
export interface AlgorithmSelection {
  /** 静态威胁度算法编码 */
  staticThreat?: string
  /** 动态威胁度算法编码 */
  dynamicThreat?: string
  /** 综合威胁度聚合算法编码 */
  aggregator?: string
  /** 打击度算法编码 */
  strike?: string
}

/** 计算模块：威胁度分析表格行 */
export interface ThreatRow {
  /** NORAD 编号 */
  noradId?: string
  /** 卫星名称 */
  satelliteName?: string
  /** 所属国家 */
  country?: string
  /** 卫星类型（体系/系列） */
  satelliteType?: string
  /** 静态威胁度 */
  staticThreat?: number
  /** 静态威胁度因子明细 */
  staticFactors?: FactorScore[]
  /** 首次回传时间 */
  firstReturnTime?: string
  /** 覆盖率 */
  coverageRate?: number
  /** 过境战场总时长（0~1） */
  passTotalDuration?: number
  /** 数据传输回传时效（0~1） */
  transmissionTimeliness?: number
  /** 动态威胁度 */
  dynamicThreat?: number
  /** 动态威胁度因子明细 */
  dynamicFactors?: FactorScore[]
  /** 综合威胁度 */
  comprehensiveThreat?: number
}

/** 计算模块：威胁度分析响应 */
export interface ThreatResp {
  /** 任务 id */
  taskId?: string
  /** 任务名称 */
  taskName?: string
  /** 计算时间 */
  generatedAt?: string
  /** 本次使用的算法 */
  algorithms?: AlgorithmSelection
  /** 各卫星威胁度 */
  rows?: ThreatRow[]
}

/** 威胁度分析可选查询参数 */
export interface ThreatAnalysisQuery {
  /** 静态威胁度算法编码 */
  staticThreat?: string
  /** 动态威胁度算法编码 */
  dynamicThreat?: string
  /** 综合聚合算法编码 */
  aggregator?: string
}

/** 旧版战场威胁权重配置（SatelliteProfile / dashboard 仍在使用） */
export interface ThreatWeight {
  reconnaissance: {
    non_geo: {
      代际威胁分: number
      分辨率威胁分: number
      定位威胁分: number
      次数威胁分: number
      时长威胁分: number
    }
    geo: {
      代际威胁分: number
      分辨率威胁分: number
      定位威胁分: number
      距离威胁分: number
    }
  }
  communication: {
    non_geo: {
      代际威胁分: number
      吞吐量威胁分: number
      延迟威胁分: number
      次数威胁分: number
      时长威胁分: number
    }
    geo: {
      代际威胁分: number
      吞吐量威胁分: number
      延迟威胁分: number
      距离威胁分: number
    }
  }
  missile_early_warning: {
    non_geo: {
      代际威胁分: number
      定位威胁分: number
      首报威胁分: number
      次数威胁分: number
      时长威胁分: number
    }
    geo: {
      代际威胁分: number
      定位威胁分: number
      首报威胁分: number
      距离威胁分: number
    }
  }
  navigation: {
    non_geo: {
      代际威胁分: number
      精度威胁分: number
      授时威胁分: number
      次数威胁分: number
      时长威胁分: number
    }
    geo: {
      代际威胁分: number
      精度威胁分: number
      授时威胁分: number
      距离威胁分: number
    }
  }
  space_domain_awareness: {
    non_geo: {
      代际威胁分: number
      监视威胁分: number
      次数威胁分: number
      时长威胁分: number
    }
    geo: {
      代际威胁分: number
      监视威胁分: number
      距离威胁分: number
    }
  }
}

export interface ThreatTaskWeight {
  name: string
  stage_weights: Record<string, ThreatWeight>
  weights: ThreatWeight
}
export interface ThreatTaskWeightsResponse {
  全局排名: number
  组内排名: number
  orbit_type: string
  norad: string
  int_id: string
  name_en: string
  country: string
  target_type: string
  orbit_status: string
  payload_status: string
  sat_type: string
  发射年份: number
  '代际(年)': number
  代际威胁分: string
  '分辨率(米)': string
  分辨率威胁分: string
  '定位精度(公里)': string
  定位威胁分: string
  过境次数: number
  次数威胁分: string
  '总过境时长(分钟)': string
  时长威胁分: string
  'Subpoint and distance to Taiwan Strait': string
  '台海距离(公里)': string
  距离威胁分: string
  综合威胁分数: string
  '威胁指数(0-100)': string
  威胁等级: string
}
