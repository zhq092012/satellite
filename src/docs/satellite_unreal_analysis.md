# SatelliteUnReal 核心组件架构与业务代码分析报告

`SatelliteUnReal.vue` 是一个基于 Cesium 的 3D/4D 卫星战场态势仿真与打击方案推演的核心组件。它通过集成高精度的卫星轨道计算、打击方案加载、多视图对比和战场实体渲染，为用户提供了一个全方位的空天战场可视化与决策平台。

本报告对该组件的业务逻辑、UI 结构、所依赖的组合式函数（Composables）及核心工具函数进行了详细的拆解与分析。

---

## 1. 核心业务逻辑概览

组件的业务主要围绕 **“打击方案（Kill Chain/Strike Plan）的仿真推演”** 展开，其核心工作流如下：
1. **场景数据初始化**：加载当前任务下的卫星、红方武器、基站、导弹基地，并解析卫星的 TLE（两行轨道数据）以用于后续的轨道与实时位置计算。
2. **方案选择与加载**：支持加载“历史打击方案”和不同烈度的“杀伤链方案（低、中、高）”。用户可依据“威胁优先”或“数量优先”模式加载方案。
3. **推演控制与时间轴同步**：利用 Cesium 的时钟（Clock）进行时间推演。根据任务的时间窗口，动态计算各个打击窗口的启动、执行和结束，驱动UI面板上的进度条及指标状态更新。
4. **战场态势渲染**：根据当前选中的图层（如：常规视图、方案对比、对比视图、关系卫星等），在地球上绘制卫星、轨道、武器包络圈、激光/导弹打击链路以及爆炸效果。
5. **多视图对比**：在方案对比模式下，实例化多个轻量级的 Cesium Viewer，实现不同方案或“打击前/打击后”态势的并行可视化。

---

## 2. 组合式函数 (Composables) 详细剖析

组件采用了现代 Vue 3 的 Composition API 架构，将庞大复杂的业务逻辑拆分到了多个专责的 `useXXX.ts` 中。

### 2.1 `useSceneData.ts` (场景数据与 TLE 管理)
- **职责**：负责所有基础空间域和地面资产数据的加载与维护，包括蓝方卫星、红方武器、基站、导弹基地及历史方案。
- **核心逻辑**：
  - **TLE 缓存优化**：由于 TLE 计算开销大，内部维护了 `satelliteTleCache` 和 `satelliteSatrecCache` 字典，避免重复解析。
  - **位置计算**：封装了 `getSatellitePositionAtDate` 和 `getSatellitePositionAtTime`，结合 `satellite.js` 库，通过 `satellitejs.propagate` 等方法，根据时间实时推演卫星三维坐标。
  - **轨道构建**：提供 `buildSatelliteOrbitPositions`，通过计算卫星运行周期（分钟），采样生成整个轨道的连续坐标点数组，用于渲染环绕地球的轨道线。

### 2.2 `useStrikePlan.ts` (打击方案与杀伤链状态)
- **职责**：负责所有的打击方案选型、过滤、加载和适配逻辑。
- **核心逻辑**：
  - **状态管理**：维护当前加载的方案（`loadedKillChainPlan`）、对比选中的方案集合以及各项过滤条件（按名称、烈度、目标类型、模式筛选）。
  - **杀伤链适配**：对接后端接口，将杀伤链数据（低烈度/中烈度/高烈度）分组，并通过 `killChainAdapter` 的 `buildHistoricalPlanFromKillChainPlan` 函数将其适配转换为统一的历史方案格式（`StrikePlanV2Extended`）。
  - **派生计算**：通过 `computed` 提取出方案的总体信息（如任务窗口 `mission_windows`、输入卫星数、使用的武器数等），供 UI 面板展示。

### 2.3 `useSimulationPlayback.ts` (仿真播放与时钟控制)
- **职责**：调度 Cesium 时钟（Clock），处理仿真播放的播放、暂停、倍速，以及实时同步UI进度。
- **核心逻辑**：
  - **时钟控制**：基于任务的起止时间设定 `clockWindow`，并提供 `applyClockWindow` 初始化 Cesium 时钟范围和限制模式（`Cesium.ClockRange.CLAMPED`）。
  - **运行时状态检测**：在时钟的每一帧，调用 `syncStrikeRuntimeFromClock` 函数。遍历 `mission_windows`，对比当前时间和窗口起止时间，将打击任务分类为**待执行**、**执行中（Active）**和**已完成（Completed）**。
  - **进度条映射**：通过 `syncTaskProgressFromClock` 和 `syncPlaybackCursorFromClock`，在 0% - 100% 之间双向绑定进度条和 Cesium 时间。
  - **核心指标产出**：通过运行时检测，派生出 `metricCards`，动态反映当前的 **武器利用率**、**剩余威胁**和**效果覆盖率**。

### 2.4 `useBattleEntities.ts` (战场实体与可视化特效)
- **职责**：最核心的渲染层逻辑，负责管理 Cesium 的 `Viewer.entities` API，绘制各种 3D/2D 元素。
- **核心逻辑**：
  - **响应式渲染**：暴露 `renderBattleEntities`，在方案切换或图层改变时触发。为了性能优化，它维护了一个 `renderedBattleEntityIds` 集合，仅进行增量更新或状态变更，而不是全部销毁重建。
  - **特效与样式（Property Callback）**：充分利用 Cesium 的 `CallbackProperty`：
    - **卫星图标与颜色**：随打击状态（idle, active, fading, done）实时变化。
    - **打击链路（Polyline）**：从武器飞向卫星的连线，执行时通过动态透明度和高亮（`PolylineGlowMaterialProperty`）模拟攻击波束，完成后执行淡出（Fade Out）。
    - **打击特效（Billboard/Point）**：在卫星命中时显示爆炸图形。
  - **相机跟随机制**：内部监听 `viewer.clock.onTick`，判断当前是否有打击事件发生；如果有，自动使用 `camera.flyToBoundingSphere` 将视角拉近到能够同时包含武器与受击卫星的最佳视角。

### 2.5 `useCompareViewers.ts` (多视图分屏对比)
- **职责**：当图层模式切换到“方案对比”或“对比视图”时，创建轻量级的辅助 Cesium 视图实例。
- **核心逻辑**：
  - **按需实例化**：通过 `waitForCompareContainersReady` 等待 DOM 生成，随后使用 `new Cesium.Viewer(...)` 构造无控件的纯净视图。
  - **静态状态渲染**：在对比视图中，时钟被冻结（`shouldAnimate = false`），只负责静态渲染出各个方案下的打击结果覆盖图（靶标图例），为指挥官提供宏观的方案评估。

### 2.6 `useSatelliteRelation.ts` (空间卫星拓扑关系)
- **职责**：当开启“关系卫星”图层时，获取并绘制卫星间的空间关系（如共面、共轨、相位稳定、抵近）。
- **核心逻辑**：
  - 计算关系优先级及特定样式的连线，使用大圆弧线（`ArcType.GEODESIC`）在地球上连接主卫星和相关卫星。

---

## 3. UI 与模板结构 (`<template>`)

组件的视图结构采用了典型的 **“左、中、右”战术控制台布局**：

1. **左侧控制面板 (`<aside class="panel panel--left">`)**：
   - **场景总览 (Overview)**：展示当前执行的任务ID、起止时间等基础信息。提供切换“威胁优先 / 数量优先”策略的按钮。
   - **阶段编排 (Stage)**：基于任务的步骤（TaskSteps），用时间轴样式展示推演所处的各个阶段（如：预警、打击、评估等）。

2. **中部仿真视窗 (`<main class="map-stage">`)**：
   - **顶栏交互**：包含图层选择器（常规视图、杀伤链、方案对比等），控制底层的渲染策略。
   - **3D地球承载区**：
     - 单一主视图：默认渲染 Cesium 场景。
     - 网格分屏（`compare-viewer-grid`）：在对比模式下，分割为 2 个或 4 个子视图，每个容器挂载独立的轻量 Cesium 实例。
   - **图例面板 (Legend)**：展示当前出现的武器类型及其图例颜色。

3. **右侧指标面板 (`<aside class="panel panel--right">`)**：
   - **实时指标与百分比卡片**：展示推演过程中的“任务进度”、“剩余威胁”、“效果覆盖率”等。
   - **打击队列 (Strike List)**：实时滚动展示当前的打击动作（例如：“激光武器 - 某卫星”，状态分为“待执行”、“打击中”、“已完成”）。

4. **全屏弹窗区 (`<el-dialog>`)**：
   - **历史方案选择器**：包含各种高级筛选（按名字、烈度、目标类型），支持单选加载或多选进入对比模式。
   - **杀伤链推演弹窗**：按低、中、高烈度分类，以卡片形式罗列系统推演出的新杀伤链方案（含打击度、拦截率、成本预估等信息），点击可加载并直接在 3D 视图中呈现。

---

## 4. 核心工具与数据适配 (`helpers/`)

该组件引入了多个纯函数辅助处理复杂的业务数据：
- **`killChainAdapter.ts`**：极其重要的适配层。后端的低、中、高烈度杀伤链返回的数据结构不尽相同，该适配器通过 `buildHistoricalPlanFromKillChainPlan` 函数，将其归一化为标准的“历史方案”结构（`StrikePlanV2Extended`），屏蔽了组件渲染层对后端异构数据的感知。
- **`functionTool.ts`**：提供 `formatTimeLineAndAnimation` 用于初始化 Cesium 的时间轴组件和动画速率；提供 `markBattleArea` 绘制区域边界。
- **`dateFormat.ts`**：提供 `parseMissionWindowDate` 和 `parseLatLonToCoords`，将后端的非标准时间字符串和经纬度字符串转换为标准 Date 对象和结构化坐标。
- **`strikeStyle.ts` / `svgIcons.ts`**：根据武器类型（如激光、导弹、电磁干扰）和打击阶段返回对应的主题色、线宽和 base64 编码的图标（如红方武器 SVG、命中特效 SVG）。

---

## 5. 总结

`SatelliteUnReal.vue` 不仅是一个简单的页面组件，而是一个**重客户端逻辑的微型 GIS 应用**。
它通过 Vue 3 的 Composition API 完美地将数据获取、业务推演（时间轴）、视图控制与 3D 图形渲染进行了解耦；通过 Cesium 的 `CallbackProperty` 机制，优雅地实现了复杂的动态特效渲染而不阻塞主线程。整个架构具备高度的模块化和扩展性。
