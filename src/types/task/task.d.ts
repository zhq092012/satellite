/** 经纬度点（任务区域顶点 / 圆心） */
export interface TaskLngLat {
    /** 经度 */
    lng: number
    /** 纬度 */
    lat: number
}

/**
 * 任务挂载的资源项（前端统一结构；提交写接口时仅需 NORAD / 站 id / 武器代号）。
 */
export interface TaskResourceItem {
    /** 资源主键（卫星一般为 NORAD；接收站为站 id；武器为代号） */
    resourceId: string
    /** 资源名称 */
    name: string
    /** 资源编码（卫星 NORAD、武器代号等） */
    code: string
}

/**
 * 任务挂载卫星（OpenAPI `SatelliteItem`；`GET /command-task/{id}` 与 `.../resources` 一致）。
 */
export interface TaskResourceSatelliteItem extends TaskResourceItem {
    /** NORAD 编号 */
    noradId?: string
    /** 所属国家/地区 */
    country?: string
    /** 卫星类型（体系：侦察/通信/中继） */
    satelliteType?: string
    /** 卫星系列 */
    series?: string
    /** TLE 第 1 行；无 TLE 时为空 */
    tleLine1?: string
    /** TLE 第 2 行；无 TLE 时为空 */
    tleLine2?: string
}

/** 任务挂载地面接收站（OpenAPI `StationItem`） */
export interface TaskResourceStationItem extends TaskResourceItem {
    /** 经度 */
    longitude?: number
    /** 纬度 */
    latitude?: number
}

/** 任务挂载武器（OpenAPI `WeaponItem`） */
export interface TaskResourceWeaponItem extends TaskResourceItem {
    /** 武器类型 */
    weaponType?: string
    /** 所属国家/地区 */
    country?: string
}

/** 指定任务下的挂载资源汇总（OpenAPI `CommandTaskResourceResp`） */
export interface BattleTaskResourceResp {
    /** 任务 id */
    taskId?: string
    /** 挂载卫星（含 TLE） */
    satellites?: TaskResourceSatelliteItem[]
    /** 挂载接收站（含经纬度） */
    receiveStations?: TaskResourceStationItem[]
    /** 挂载武器 */
    weapons?: TaskResourceWeaponItem[]
    /** 资源总数 */
    total?: number
}



/** 任务区域（接口 `areas` 元素） */
export interface TaskArea {
    /** 区域标识（新增可为空，保存后由后端生成） */
    id?: string
    /** 区域名称 */
    name: string
    /** POLYGON 多边形 / CIRCLE 圆 */
    type: string
    /** 多边形顶点（type=POLYGON） */
    points: TaskLngLat[]
    /** 圆心（type=CIRCLE 必填；多边形接口常为空） */
    center?: TaskLngLat | null
    /** 圆半径（km，type=CIRCLE 时使用） */
    radius: number
    /** 是否启用 */
    enabled: boolean
}

/**
 * 目标任务关系种类。
 * - `satellite_station`：卫星 → 地面站
 * - `satellite_relay`：卫星 → 中继卫星
 * - `relay_station`：中继卫星 → 地面站
 */
export type TaskTargetRelationKind =
    /** 卫星-地面站 */
    | 'satellite_station'
    /** 卫星-中继卫星 */
    | 'satellite_relay'
    /** 中继卫星-地面站 */
    | 'relay_station'

/** 一条目标任务关系配置 */
export interface TaskTargetRelation {
    /** 关系种类 */
    kind: TaskTargetRelationKind
    /** 起点 ID（系列名或地面站 ID） */
    fromId: string
    /** 起点展示名称 */
    fromLabel: string
    /** 终点 ID */
    toId: string
    /** 终点展示名称 */
    toLabel: string
    /** 是否启用 */
    enabled: boolean
}

/** 关系配置端点选项（下拉用） */
export interface TaskRelationEndpointOption {
    /** 端点 ID */
    id: string
    /** 展示名称 */
    label: string
}

/** 任务级圆形作战区域（C2 面板与地图展示） */
export interface TaskCombatArea {
    /** 区域中心经度（度，WGS84） */
    centerLon: number
    /** 区域中心纬度（度，WGS84） */
    centerLat: number
    /** 区域半径（千米） */
    radiusKm: number
    /** 是否在地图上显示该区域 */
    enabled: boolean
}

/**
 * 作战命令下的任务（OpenAPI `CommandTaskResp`；写接口为 `CommandTaskReq`）。
 * 与作战命令通过 `commandId` 关联。
 */
export interface TaskForm {
    /** 任务 id */
    id?: string
    /** 所属作战命令 id */
    commandId: string
    /** 任务名称 */
    name: string
    /** 描述 */
    description: string
    /** 开始日期 yyyy-MM-dd HH:mm */
    beginDate: string
    /** 结束日期 yyyy-MM-dd HH:mm */
    endDate: string
    /** @deprecated 改由所属作战命令 `source` 提供，任务接口不再下发 */
    taskSource?: string
    /** @deprecated 改由作战命令 `backGround` 提供 */
    background?: string
    /** @deprecated 改由作战命令 `expectation` 提供 */
    expectation?: string
    /** @deprecated 改由作战命令 `expectationOption` 提供 */
    expectationCases?: string[]
    /** 预报小时 */
    forecastHour: number
    /**
     * 作战对象（历史字段）。
     * 现从所属命令 `enemyCountry` 读取；提交任务接口时不传。
     */
    country: string
    /** 作战阶段信息（JSON 字符串） */
    steps?: string
    /** 关注状态 */
    focusStatus?: number
    /** 覆盖度 */
    coverage: number
    /** 延迟（分钟） */
    delayMin: number
    /** 任务区域集合 */
    areas: TaskArea[]
    /** 挂载的卫星（含国家/类型/系列/TLE） */
    satellites: TaskResourceSatelliteItem[]
    /** 挂载的接收站 */
    receiveStations: TaskResourceStationItem[]
    /** 挂载的武器 */
    weapons: TaskResourceWeaponItem[]
    /**
     * C2 左侧面板资源树筛选：任务卫星类型（侦察 / 通信等）。
     * 仅面板本地编辑态使用，提交任务接口时可省略。
     */
    targetTypeShow?: string[]
    /** 创建时间 */
    createTime?: string
    /** 更新时间 */
    updateTime?: string
}






