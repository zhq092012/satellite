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
