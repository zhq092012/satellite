/** 作战方案报告 OpenAPI 类型（与 `.cursor-api-docs.json` / `openapi-snapshot.json` 对齐） */

/** 作战方案生成结果（当前接口以 strikePlans 为主；以下为 legacy 兼容字段） */
export interface ReportGenerateResp {
  /** 任务 id */
  taskId?: string
  /** 任务名称 */
  taskName?: string
  /**
   * 打击方案列表（含被打击卫星、体系统计与打击前后比对；页面方案 code 以此为主）。
   */
  strikePlans?: StrikePlan[]
  /** 报告生成时间 */
  generatedAt?: string

  warnings?: ReportWarning[]
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



/** 被打击卫星 */
export interface StruckSatellite {
  /** NORAD */
  noradId?: string
  /** 名称 */
  name?: string
  /** 体系 */
  system?: string
  /** 系列 */
  series?: string
  /** 国家 */
  country?: string
  /** 威胁度 */
  threat?: number
}


/** 侦察打击前后比对 */
export interface ReportReconComparison {
  satelliteCount: {
    beforeTotal: number
    afterTotal: number
    deltaTotal: number
  }
  transitWindows: {
    beforeWindows: number
    afterWindows: number
    deltaWindows: number
    beforeFirstTransit: string
    afterFirstTransit: string
    delayMinutes: number
  }
}

/** 通信打击前后比对 */
export interface ReportCommComparison {
  satelliteCount: {
    beforeTotal: number
    afterTotal: number
    deltaTotal: number
  }
  coverage: {
    beforeCoverage: number
    afterCoverage: number
    deltaCoverage: number
  }
}
/** 打击方案（与扁平 `schemes` 同 code） */
export interface StrikePlan {
  /** 方案编码，格式 阶段-规模方案 */
  code?: string
  /** 方案名称 */
  name?: string
  /** 阶段编码 */
  stageCode?: string
  /** 阶段名称 */
  stageName?: string
  /** 对手方国家 */
  country?: string
  /** 规模方案序号 */
  tierIndex?: number
  /** 被打击目标总数 */
  targetSize?: number
  /** 被打击卫星清单 */
  satellites?: StruckSatellite[]
  /** 侦察打击前后比对 */
  reconComparison?: ReportReconComparison
  /** 通信打击前后比对 */
  commComparison?: ReportCommComparison

}


