前端现在的问答不请求大模型。真实接入时，后端要提供一套按任务 ID 取数的 AI 服务，并补上攻击度这条还没有正式结果的数据。威胁度明细、打击方案明细不要让前端在提问时再传一份。

## 后端已经有、AI 服务直接读的数据

AI 服务拿 `taskId` 后自己查这些接口，不要让前端把整份矩阵贴进提问请求。

| 用途 | 现有接口 | AI 要使用的字段 |
| --- | --- | --- |
| 当前任务 | 任务查询，结果对应前端 `activedTask` | `id`、`name`、`beginDate`、`endDate`、`description`、`meCountryShow`、`enemyCountryShow` |
| 威胁度与打击记录 | `POST /api/algorithm/taskMatrix` | `satNum`、`stationNum`、`beforeAvgCoverage`、`afterAvgCoverage`、`beforeFirstFeedbackTime`、`afterFirstFeedbackTime`、`levelSeriesEntities` |
| 打击方案 | `POST /api/algorithm/zhchPlanV3` | `intensityLevel`、`summary`、`beforeResult`、`afterResult`、`beforeAvgCoverage`、`afterAvgCoverage`、`satNum`、`visibleWindowNum`、`visibleWindowStrikeNum`、`levelSeriesEntities` |

`taskMatrix` 里每颗威胁卫星是 `threatSats[]`：`norad`、`name`、`satType`、`threatScore`（打击前）、`afterThreatScore`（打击后）。打击记录是 `attackPlanList[]`：`weaponName`、`weaponType`、`beginTime`、`endTime`、`angle`、`windows`、`target`、`targetId`、`targetType`。

方案接口还要能按现在前端的筛选条件查询：`taskId`、用途 `type`（如军用）、`sysType`、`intensityLevel`。用户正在看哪一个用途，由前端上下文里的 `activeUsageType` 传给 AI，AI 再去查对应方案。

这些数据有三类合法空态，必须原样告诉用户，不能补卫星、补分数或补方案结论：

- 任务不存在，或任务没有数字 ID。
- `taskMatrix` 还没算完，或 `levelSeriesEntities` 为空。
- 当前任务、当前用途下没有 `zhchPlanV3` 结果。

字段在类型里有、接口却没返回时，回答里写「接口未返回该项」。不要把缺失写成 `0`、空数组或一段编出来的优缺点。

## 后端还没有、必须新做的业务数据

攻击度是当前最大的缺口。页面和 Mock 用的都不是算法结果，而是 `0.55 + (序号 % 7) × 0.06`。正式 AI 不能再返回这个数。

需要一条按目标给出的攻击度，而不是任务级一个总分。现有 `GET /api/battle/targetStrike?taskId=` 只返回 `{ strikeDegree, threatDegree, days }`，对不上表格里的每一条打击记录，而且前端没有把它接到分析页。

建议每个打击目标返回：

- `target`、`targetId`、`targetType`
- `weaponName`、`weaponType`
- `beginTime`、`endTime`，以及窗口列表
- `attackDegree`：正式分数，并说明计算口径
- `attackDegreeHint`：该分数由哪些条件得出
- 若仍有「综合可攻击条件」，单独给字段和公式，不要乘进 `attackDegree`

威胁度的原始分后端已经有。前端现在自己算动态威胁 `afterThreatScore / threatScore`，综合威胁是两者相乘，动态值缺失时综合值等于静态值。如果这个口径要改成服务端权威结果，请在 `threatSats` 上直接给 `dynamicThreat`、`compositeThreat`，并写明空值规则。在此之前，AI 应沿用上述口径，并在回答里说明。

`GET /api/battle/threatSuggestion?taskId=` 现在只返回一段字符串，AI 助手没有使用。若方案优缺点要以它为准，请改成结构化字段，至少包含概述、优势、不足、建议，并标明每条结论来自哪次方案结果。不要只给一段无法拆成表格和指标的长文本。

## 提问时前端只会传的上下文

明细留在服务端。提问请求只带当前画面定位：

```ts
interface AiAskRequest {
  question: string
  conversationId?: string
  context: {
    taskId?: number
    taskName?: string
    pagePath?: string
    pageLabel?: string
    activeUsageType?: string
    selectedSatellite?: { norad: number; name: string }
  }
}
```

`pagePath` 目前对应 `/home`、`/home/threat`、`/home/attack`、`/home/strike-plan`、`/situation`。`selectedSatellite` 只存在于浏览器，地图点击和分析页选中是前端状态，后端无法自己得知，必须由前端传入。没有选中卫星时不要省略成全任务卫星列表来冒充「当前选中」。

## 新增 AI 接口

统一走现有登录态 `Authorization: Bearer <token>`。错误保留 HTTP 状态码和业务 `msg`，不要返回一份看起来正常的空回答。

### 1. 提问

`POST /api/ai/ask`

请求体就是上面的 `AiAskRequest`。`question` 去掉空白后为空时返回 400。

成功时 `data` 为内容块数组，顺序就是界面从上到下的展示顺序。前端入口现在是 `askAi(question): Promise<AiContentBlock[]>`，换真实接口时只替换这个函数。

内容块类型如下。

Markdown：

```ts
{ type: 'markdown', content: string }
```

用 Markdown 写说明、列表和结论。需要排序、分页的表不要写进 Markdown 表格，改用下面的 `table`。

表格：

```ts
{
  type: 'table',
  title?: string,
  columns: { prop: string; label: string }[],
  data: Record<string, string | number | null>[]
}
```

`columns[].prop` 必须是 `data` 每一行里的字段名。没有的单元格用 `null`，不要用 `0` 或 `"--"` 伪装成后端算出的数。`data` 为空数组时前端显示「暂无数据」。

柱状图和折线图：

```ts
{
  type: 'chart',
  chartType: 'bar' | 'line',
  title: string,
  data: {
    categories: string[],
    series: { name: string; values: number[] }[]
  }
}
```

每个 `series.values.length` 必须等于 `categories.length`。对不上时前端会拒绝绘制。

饼图：

```ts
{
  type: 'chart',
  chartType: 'pie',
  title: string,
  data: { items: { name: string; value: number }[] }
}
```

指标卡片：

```ts
{ type: 'metric', title: string, value: string | number, unit?: string }
```

`unit` 例：`%`、`颗`、`个`。不是有限数字就不要塞进 `value`，改在 Markdown 里写未返回。

文件：

```ts
{ type: 'file', name: string, url: string, format: string }
```

第一版只展示文件名、格式和地址，不会发起下载。`url` 需要是已授权可访问的地址，并说明过期时间。若文件要鉴权下载，请另给下载接口，不要把一次性 token 写进永久 URL。

### 2. 流式输出与停止

类型里已经预留 `status: 'streaming'`。若要做流式，请用 SSE，前端依赖里已有 `@microsoft/fetch-event-source`。

约束：

- 先推 Markdown 文本增量。
- 表格、图表、指标、文件必须等该块 JSON 完整后再推一个独立事件。不要推半截 JSON。
- 用户停止时，`POST /api/ai/ask/{messageId}/stop`。服务端停止后续生成，并保留已经推送的完整内容块。
- 停止后的消息状态为 `completed`，不要再补一块新的表格或图表。

不做流式时，一次性返回完整 `AiContentBlock[]` 即可。前端现在的加载态就是在等这一个响应。

### 3. 提示词

`GET /api/ai/prompts`

返回 `AiPrompt[]`：

```ts
{
  id: string
  title: string
  description?: string
  prompt: string
  category?: string
}
```

`title` 是卡片标题，`prompt` 是点击后真正发送的问题。现在前端写死了 7 条，分类是任务分析、威胁度分析、攻击度分析、方案分析、综合分析。接口就绪后可按任务或页面返回不同问题，字段保持一致即可。

### 4. 会话

第一版只在浏览器内存里留一条会话，刷新就没了。若要保留，按 `AiConversation` 提供：

- `POST /api/ai/conversations`：新建，返回 `id`、`title`、`createTime`
- `GET /api/ai/conversations`：当前用户的会话列表
- `GET /api/ai/conversations/{id}`：消息列表
- `DELETE /api/ai/conversations/{id}`：删除
- 清空可以是删除全部消息但保留 `id`

消息结构：

```ts
{
  id: string
  role: 'user' | 'assistant'
  content: AiContentBlock[]
  status: 'loading' | 'streaming' | 'completed' | 'error'
  createTime: string
}
```

用户消息的 `content` 用一个 markdown 块保存原文。助手消息的 `content` 使用上面的内容块。时间建议 `YYYY-MM-DD HH:mm:ss`。会话之间的消息必须隔离。

## 回答必须能处理的问题

服务端不要只做关键词匹配，但至少要覆盖现在 Mock 已支持的这几类，并且数字全部来自上面的任务数据：

- 任务整体情况：任务名称、时间、作战双方；有矩阵和方案时带上数量和覆盖率，缺哪一类就单独说明。
- 威胁度最高的卫星：按综合威胁度降序，给出国家、卫星、类型、打击前、打击后、综合值。没有分数的卫星不要补 `0`。
- 威胁度分布：按国家计数，可用饼图。国家字段为空时标成「未标注国家」，不要猜国家。
- 攻击能力：目标、武器、类型、时间窗，以及正式攻击度。在正式分数出来之前，接口应明确返回「攻击度尚未计算」，而不是返回演示小数。
- 方案优缺点和可优化点：只转述 `summary`、`beforeResult`、`afterResult` 以及覆盖率、窗口数。接口没写的优缺点不要生成。
- 指定卫星：按 NORAD 或完整名称精确查找。找不到就说明未找到，不要返回名称相近的其他卫星。
- 当前选中卫星：只使用请求里的 `selectedSatellite`。没有该字段就回答当前没有选中卫星。

无法识别的问题，返回一段 Markdown，说明当前只能分析任务、威胁、攻击、方案和指定卫星，并带上当前任务名。
