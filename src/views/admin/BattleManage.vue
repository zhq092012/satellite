<template>
  <div class="battle-manage-container">
    <!-- 头部工具栏与操作区域 -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar-header">
        <div class="toolbar-title">
          <span class="icon">🌐</span>
          <span class="text">战场与作战任务统一管理</span>
        </div>
        <div class="toolbar-actions">
          <el-button type="primary" icon="Plus" round @click="handleCreateBattle"> 新建战场 </el-button>
          <el-button icon="Refresh" circle @click="loadBattleList" />
        </div>
      </div>
    </el-card>

    <!-- 战场列表与所属任务列表 -->
    <div class="battle-list-box">
      <el-empty v-if="battleList.length === 0" description="暂无战场数据，请点击右上角新建战场" />

      <div v-for="battle in battleList" :key="battle.id" class="battle-card">
        <!-- 战场卡片头部 -->
        <div class="battle-card-header" @click="toggleBattleExpand(battle.id)">
          <div class="header-left">
            <el-icon class="expand-icon" :class="{ 'is-expanded': isBattleExpanded(battle.id) }">
              <ArrowRight />
            </el-icon>
            <span class="battle-name">⚔️ {{ battle.name }}</span>
            <el-tag size="small" type="info" round class="battle-desc-tag">
              {{ battle.description || '无概述' }}
            </el-tag>
          </div>
          <div class="header-right" @click.stop>
            <el-button type="primary" icon="Plus" size="small" plain round @click.stop="handleCreateTask(battle)">
              新建任务
            </el-button>
            <el-button type="success" icon="Edit" size="small" circle @click.stop="handleEditBattle(battle)" />
            <el-button type="danger" icon="Delete" size="small" circle @click.stop="handleDeleteBattle(battle.id)" />
          </div>
        </div>

        <!-- 战场展开展示的任务列表 -->
        <div v-show="isBattleExpanded(battle.id)" class="battle-card-body">
          <div class="task-table-wrapper">
            <el-table :data="battle.tasks || []" border style="width: 100%" size="small">
              <el-table-column prop="name" label="任务名称" min-width="140" />
              <el-table-column prop="description" label="任务概述" min-width="180" show-overflow-tooltip />
              <el-table-column label="起止时间" width="300">
                <template #default="scope">
                  <span>{{ scope.row.beginDate || '--' }} ~ {{ scope.row.endDate || '--' }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="meCountry" label="红方" width="120" show-overflow-tooltip />
              <el-table-column prop="enemyCountry" label="蓝方" width="120" show-overflow-tooltip />
              <el-table-column label="关注状态" width="100" align="center">
                <template #default="scope">
                  <el-tag :type="scope.row.focusStatus === 1 ? 'danger' : 'info'" size="small">
                    {{ scope.row.focusStatus === 1 ? '已关注' : '未关注' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="算法计算进度" width="180">
                <template #default="scope">
                  <div v-if="getTaskProgress(scope.row)" class="progress-box">
                    <el-progress
                      :percentage="getTaskProgressPercent(getTaskProgress(scope.row))"
                      :status="isTaskProgressComplete(getTaskProgress(scope.row)) ? 'success' : ''"
                      :stroke-width="6"
                    />
                  </div>
                  <span v-else class="text-muted">未开始或未获取</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="scope">
                  <el-button
                    type="success"
                    icon="Edit"
                    size="small"
                    plain
                    round
                    @click="handleEditTask(scope.row, battle)"
                  >
                    修改
                  </el-button>
                  <el-button type="danger" icon="Delete" size="small" plain round @click="handleDeleteTask(scope.row)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建 / 编辑战场弹窗 -->
    <el-dialog :title="battleDialogTitle" v-model="battleDialogVisible" width="600px">
      <el-form :model="battleForm" ref="battleFormRef" :rules="createBattleRules" label-width="110px">
        <el-form-item label="战场名称" prop="name">
          <el-input v-model="battleForm.name" placeholder="请输入战场名称" />
        </el-form-item>
        <el-form-item label="战场概述" prop="description">
          <el-input v-model="battleForm.description" type="textarea" placeholder="请输入战场概述" />
        </el-form-item>
        <el-form-item label="" v-if="battleForm.createAreaMode === '多边形'">
          <el-button type="primary" @click="addPolygonArea" size="small"> 新增区域 </el-button>
        </el-form-item>
        <div
          v-show="battleForm.createAreaMode === '多边形'"
          v-for="[idx, area] in store.battlePolygonMap"
          :key="idx"
          class="polygon-area-item"
        >
          <el-form-item label="区域名称">
            <div class="area-name-row">
              <el-input v-model="area.name" placeholder="区域名称" />
              <el-button type="primary" @click="chooseArea(idx)" round size="small">选择区域</el-button>
              <el-button type="danger" @click="removeArea(idx)" round size="small">删除区域</el-button>
            </div>
          </el-form-item>
          <el-form-item label="区域坐标">
            <div v-for="(lonlat, lIdx) in area.lonlats" :key="lIdx" class="lonlat-row">
              <div class="coord-field"><span>经度：</span><el-input v-model="lonlat.lon" type="number" /></div>
              <div class="coord-field"><span>纬度：</span><el-input v-model="lonlat.lat" type="number" /></div>
            </div>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="cancelBattleForm(battleFormRef)">取 消</el-button>
        <el-button type="primary" @click="submitBattleForm(battleFormRef)">确 定</el-button>
      </template>
    </el-dialog>

    <!-- 新建 / 编辑任务弹窗 -->
    <el-dialog :title="taskDialogTitle" v-model="taskDialogVisible" width="950px" class="task-manage-dialog">
      <div class="section-dialog-title">作战任务属性</div>
      <el-form :model="taskForm" ref="taskFormRef" :rules="createTaskRules" label-width="110px">
        <el-form-item label="任务名称" prop="name">
          <el-input v-model="taskForm.name" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="任务概述" prop="description">
          <el-input v-model="taskForm.description" type="textarea" placeholder="请输入任务概述" />
        </el-form-item>

        <el-form-item label="时间限制" prop="beginDate">
          <el-date-picker
            v-model="taskDatePickValue"
            type="datetimerange"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm"
            format="YYYY-MM-DD HH:mm"
          />
        </el-form-item>

        <el-form-item label="红方" prop="meCountry">
          <el-select
            v-model="taskForm.meCountryShow"
            multiple
            placeholder="请选择红方国家"
            @change="taskForm.meCountry = taskForm.meCountryShow.join(',')"
          >
            <el-option v-for="item in taskCountrys" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="蓝方" prop="enemyCountry">
          <el-select
            v-model="taskForm.enemyCountryShow"
            multiple
            placeholder="请选择蓝方国家"
            @change="taskForm.enemyCountry = taskForm.enemyCountryShow.join(',')"
          >
            <el-option v-for="item in taskCountrys" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="设置关注">
          <el-switch v-model="taskForm.focusStatus" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>

      <div class="section-dialog-title">作战阶段流程配置</div>
      <div class="dialog-table-box">
        <div class="table-nav">
          <el-button type="primary" size="small" round @click="handleAddBattleSegment">新增作战阶段</el-button>
        </div>
        <el-table :data="tableData" style="width: 100%" border size="small">
          <el-table-column type="index" label="序号" width="60" />
          <el-table-column prop="name" label="阶段名称">
            <template #default="scope">
              <el-input v-model="scope.row.name" placeholder="阶段名称" />
            </template>
          </el-table-column>
          <el-table-column prop="startTime" label="开始时间" width="220">
            <template #default="scope">
              <el-date-picker
                v-model="scope.row.startTime"
                @change="validateStartTime(scope.row)"
                type="datetime"
                placeholder="开始时间"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DD HH:mm"
              />
            </template>
          </el-table-column>
          <el-table-column prop="endTime" label="结束时间" width="220">
            <template #default="scope">
              <el-date-picker
                v-model="scope.row.endTime"
                @change="validateEndTime(scope.row)"
                type="datetime"
                placeholder="结束时间"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DD HH:mm"
              />
            </template>
          </el-table-column>
          <el-table-column prop="sateType" label="卫星类型">
            <template #default="scope">
              <el-select v-model="scope.row.sateTypeShow" placeholder="选择类型" multiple>
                <el-option v-for="item in taskSateTypes" :key="item" :label="item" :value="item" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column prop="target" label="目标">
            <template #default="scope">
              <el-select v-model="scope.row.target" placeholder="选择目标">
                <el-option v-for="item in targetOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90">
            <template #default="scope">
              <el-button icon="Delete" type="danger" plain round size="small" @click="handleRemoveSegment(scope.row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="resetTaskForm(taskFormRef)">取 消</el-button>
        <el-button type="primary" @click="submitTaskForm(taskFormRef)">确 定</el-button>
      </template>
    </el-dialog>

    <!-- 战场区域地图绘制选择弹窗 -->
    <el-dialog title="战场区域选择" v-model="showPolygonMap" width="1100px">
      <div>
        <PolygonMap ref="polygonRef" />
      </div>
      <template #footer>
        <el-button @click="clearMap">取 消</el-button>
        <el-button type="primary" @click="confirmPolygonMap">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 导入 Vue 核心 API 及 Element Plus 类型定义
 */
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import PolygonMap from '@/components/cesium/BattleArea.vue'

/**
 * 导入后台仪表盘与战场/任务管理相关 API 函数与类型
 */
import {
  createTask,
  deleteBattle,
  deleteTask,
  getBattleCountrys,
  getBattleList,
  getTaskList,
  getTaskStageTargetOptions,
  queryTaskProgress,
  saveBattle,
  updateBattle,
  updateTask,
} from '@/api/dashboard'
import type { BattleForm, TaskForm } from '@/types/dashboard'
import { useLayoutStore } from '@/store/modules/layout'

/** Store 状态对象 */
const store = useLayoutStore()

/** 多边形绘制组件引用 */
const polygonRef = ref<InstanceType<typeof PolygonMap> | null>(null)

/** 战场与任务表单引用的 DOM 对象 */
const battleFormRef = ref<FormInstance>()
const taskFormRef = ref<FormInstance>()

/** 战场列表及卡片展开控制响应式变量 */
const battleList = ref<BattleForm[]>([])
const activeNames = ref<number[]>([])

/** 国家/地区和阶段配置下拉数据源 */
const taskCountrys = ref<string[]>([])
const taskSateTypes = ref<string[]>(['通信', '导航', '遥感', '侦察', '气象', '科学', '其他'])
const targetOptions = ref<string[]>([])

/** 弹窗状态及标题 */
const battleDialogTitle = ref('新建战场')
const battleDialogVisible = ref(false)
const taskDialogTitle = ref('新建任务')
const taskDialogVisible = ref(false)
const showPolygonMap = ref(false)

/** 战场表单绑定的数据结构 */
const battleForm = reactive<BattleForm>({
  name: '',
  description: '',
  createAreaMode: '多边形',
  area: '',
  beginDate: '',
  endDate: '',
  dataRefreshRate: '',
  tasks: [],
})

/** 任务表单绑定的数据结构 */
const taskForm = reactive<TaskForm>({
  battleId: -1,
  name: '',
  description: '',
  beginDate: '',
  endDate: '',
  targetType: '',
  targetTypeShow: [],
  meCountry: '',
  meCountryShow: [],
  enemyCountry: '',
  enemyCountryShow: [],
  steps: '',
  focusStatus: 0,
})

/** 日期范围选择器的底层中转变量 */
const battleDatePickValue = ref<[string, string]>(['2025-12-01 09:00', '2025-12-02 18:00'])
const taskDatePickValue = ref<[string, string]>(['2025-12-01 09:00', '2025-12-02 18:00'])

/** 作战阶段表单行接口定义 */
type BattleSegmentRow = TaskSteps & {
  autoGenerated?: boolean
}

/** 默认自动生成的阶段名称 */
const autoBattleSegmentNames = ['集结', '突防', '进攻', '撤退']

/** 作战阶段列表数据源及递增编号 */
const tableData = ref<BattleSegmentRow[]>([])
const minIdx = ref(0)

/** 战场表单表单校验规则 */
const createBattleRules = reactive<FormRules<BattleForm>>({
  name: [{ required: true, message: '请输入战场名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入战场概述', trigger: 'blur' }],
})

/** 任务表单校验规则 */
const createTaskRules = reactive<FormRules<TaskForm>>({
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入任务概述', trigger: 'blur' }],
  meCountry: [{ required: true, message: '请选择红方国家', trigger: 'change' }],
  enemyCountry: [{ required: true, message: '请选择蓝方国家', trigger: 'change' }],
  beginDate: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
})

/** 任务进度信息类型与轮询管理对象 */
type TaskProgressInfo = {
  totalStatus: string
  transitStatus: string
  threatAndStrikeStatus: string
  mes?: string
}

const taskProgressMap = reactive<Record<number, TaskProgressInfo>>({})
const taskProgressTimerMap = new Map<number, ReturnType<typeof setInterval>>()

/**
 * 判断指定战场 ID 的卡片是否展开
 * @param id 战场 ID
 */
const isBattleExpanded = (id?: number) => {
  return id !== undefined && activeNames.value.includes(id)
}

/**
 * 切换指定战场 ID 的卡片展开状态
 * @param id 战场 ID
 */
const toggleBattleExpand = (id?: number) => {
  if (id === undefined) return
  const index = activeNames.value.indexOf(id)
  if (index > -1) {
    activeNames.value.splice(index, 1)
  } else {
    activeNames.value.push(id)
  }
}

/**
 * 监视 activeNames 展开项并自动加载对应的任务列表
 */
watch(
  activeNames,
  () => {
    if (activeNames.value.length) {
      activeNames.value.forEach(async (battleId) => {
        const res = await getTaskList(Number(battleId))
        if (res.code === 200) {
          for (const task of res.data) {
            const progressRes = task.algorithmProgressEntity
            if (
              task.id &&
              progressRes &&
              (progressRes.totalStatus !== '完成' ||
                progressRes.transitStatus !== '完成' ||
                progressRes.threatAndStrikeStatus !== '完成')
            ) {
              await startTaskProgressPolling(task.id)
            }
          }
          const battle = battleList.value.find((s) => s.id === Number(battleId))
          if (battle) {
            battle.tasks = res.data
          }
        }
      })
    }
  },
  { deep: true }
)

/**
 * 监听 taskDatePickValue 变化并更新 taskForm 的起止日期
 */
watch(taskDatePickValue, (newVal) => {
  if (newVal) {
    taskForm.beginDate = String(newVal[0])
    taskForm.endDate = String(newVal[1])
  }
  if (taskForm.beginDate && taskForm.endDate) {
    syncBattleSegmentsWithTaskTime()
  } else {
    clearAutoGeneratedBattleSegments()
  }
})

/**
 * 验证阶段开始时间
 * @param row 行数据对象
 */
const validateStartTime = (row: BattleSegmentRow) => {
  if (row.endTime && new Date(row.startTime).getTime() >= new Date(row.endTime).getTime()) {
    ElMessage.warning('开始时间必须早于结束时间')
    row.startTime = ''
  }
  if (taskForm.beginDate && new Date(row.startTime).getTime() < new Date(taskForm.beginDate).getTime()) {
    ElMessage.warning('开始时间必须在任务时间范围内')
    row.startTime = ''
  }
}

/**
 * 验证阶段结束时间
 * @param row 行数据对象
 */
const validateEndTime = (row: BattleSegmentRow) => {
  if (row.startTime && new Date(row.endTime).getTime() <= new Date(row.startTime).getTime()) {
    ElMessage.warning('结束时间必须晚于开始时间')
    row.endTime = ''
  }
  if (taskForm.endDate && new Date(row.endTime).getTime() > new Date(taskForm.endDate).getTime()) {
    ElMessage.warning('结束时间必须在任务时间范围内')
    row.endTime = ''
  }
}

/**
 * 格式化日期对象为标准字符串
 * @param date 日期实例
 */
const formatDateTime = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`
}

/**
 * 解析日期字符串
 * @param value 时间文本
 */
const parseDateTime = (value: string) => {
  if (!value) return null
  const date = new Date(value.replace(/-/g, '/'))
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * 按阶段划分时间段
 * @param beginTime 开始时间
 * @param endTime 结束时间
 * @param count 数量
 */
const splitTaskTimeRange = (beginTime: string, endTime: string, count: number) => {
  const beginDate = parseDateTime(beginTime)
  const endDate = parseDateTime(endTime)
  if (!beginDate || !endDate || count <= 0) return [] as Array<[string, string]>

  const totalDuration = endDate.getTime() - beginDate.getTime()
  const stepDuration = totalDuration / count

  return Array.from({ length: count }, (_, index) => {
    const start = new Date(beginDate.getTime() + stepDuration * index)
    const end = index === count - 1 ? endDate : new Date(beginDate.getTime() + stepDuration * (index + 1))
    return [formatDateTime(start), formatDateTime(end)] as [string, string]
  })
}

/**
 * 平衡重新划定阶段的时间分配
 * @param segments 阶段集合
 */
const rebalanceBattleSegments = (segments: BattleSegmentRow[]) => {
  if (!taskForm.beginDate || !taskForm.endDate || !segments.length) return segments
  const ranges = splitTaskTimeRange(taskForm.beginDate, taskForm.endDate, segments.length)
  if (!ranges.length) return segments

  return segments.map((segment, index) => ({
    ...segment,
    startTime: ranges[index]?.[0] ?? taskForm.beginDate,
    endTime: ranges[index]?.[1] ?? taskForm.endDate,
    autoGenerated: true,
  }))
}

/** 清理自动生成的阶段 */
const clearAutoGeneratedBattleSegments = () => {
  tableData.value = tableData.value.filter((segment) => !segment.autoGenerated)
}

/** 判断是否有仅自动生成的阶段项 */
const hasOnlyRebalanceableRows = () =>
  tableData.value.length > 0 &&
  tableData.value.every(
    (segment) =>
      segment.autoGenerated ||
      (!segment.name &&
        !segment.startTime &&
        !segment.endTime &&
        !segment.sateType &&
        !segment.target &&
        segment.sateTypeShow.length === 0)
  )

/**
 * 同步任务阶段时间
 */
const syncBattleSegmentsWithTaskTime = () => {
  if (!taskForm.beginDate || !taskForm.endDate) {
    clearAutoGeneratedBattleSegments()
    return
  }

  const hasOnlyEmptyManualRows =
    tableData.value.length > 0 &&
    tableData.value.every(
      (segment) =>
        !segment.autoGenerated &&
        !segment.name &&
        !segment.startTime &&
        !segment.endTime &&
        !segment.sateType &&
        !segment.target &&
        segment.sateTypeShow.length === 0
    )

  if (hasOnlyEmptyManualRows || !tableData.value.length) {
    tableData.value = rebalanceBattleSegments(
      autoBattleSegmentNames.map((name, index) => ({
        id: index + 1,
        name,
        startTime: '',
        endTime: '',
        sateTypeShow: [],
        sateType: '',
        target: '',
        autoGenerated: true,
      }))
    )
    minIdx.value = autoBattleSegmentNames.length
    return
  }

  if (hasOnlyRebalanceableRows()) {
    tableData.value = rebalanceBattleSegments(
      tableData.value.map((segment) => ({
        ...segment,
        autoGenerated: true,
      }))
    )
  }
}

/** 新增作战阶段 */
const handleAddBattleSegment = () => {
  minIdx.value++
  tableData.value.push({
    id: minIdx.value,
    name: '',
    startTime: '',
    endTime: '',
    sateTypeShow: [],
    sateType: '',
    target: '',
    autoGenerated: false,
  })

  if (taskForm.beginDate && taskForm.endDate && hasOnlyRebalanceableRows()) {
    syncBattleSegmentsWithTaskTime()
  }
}

/** 删除作战阶段 */
const handleRemoveSegment = (row: BattleSegmentRow) => {
  const idx = tableData.value.findIndex((s) => s.id === row.id)
  if (idx < 0) return
  const removedRow = tableData.value[idx]
  tableData.value.splice(idx, 1)

  if (removedRow?.autoGenerated && taskForm.beginDate && taskForm.endDate && tableData.value.length) {
    if (tableData.value.length === 1 || tableData.value.every((segment) => segment.autoGenerated)) {
      tableData.value = rebalanceBattleSegments(tableData.value)
    }
  }
}

/**
 * 多边形区域绘制操作方法
 */
const chooseArea = (idx: number) => {
  store.currentPolygonIdx = idx
  showPolygonMap.value = true
  polygonRef.value?.clearAll()
}

const addPolygonArea = () => {
  store.setPolygon(store.currentPolygonIdx, { name: '', lonlats: [] })
  store.currentPolygonIdx++
}

const removeArea = (idx: number) => {
  store.removePolygon(idx)
}

const confirmPolygonMap = () => {
  showPolygonMap.value = false
}

const clearMap = () => {
  showPolygonMap.value = false
  polygonRef.value?.clearAll()
}

/**
 * 获取任务进度管理方法
 */
const isTaskProgressComplete = (progress?: TaskProgressInfo) => {
  if (!progress) return false
  return (
    progress.totalStatus === '完成' && progress.transitStatus === '完成' && progress.threatAndStrikeStatus === '完成'
  )
}

const getTaskProgress = (task: TaskForm) => {
  if (!task.id) return undefined
  return taskProgressMap[task.id]
}

const getTaskProgressPercent = (progress?: TaskProgressInfo) => {
  if (!progress) return 0
  const finishedCount = [progress.totalStatus, progress.transitStatus, progress.threatAndStrikeStatus].filter(
    (status) => status === '完成'
  ).length
  return Math.round((finishedCount / 3) * 100)
}

const stopTaskProgressPolling = (taskId: number) => {
  const timer = taskProgressTimerMap.get(taskId)
  if (timer) {
    clearInterval(timer)
    taskProgressTimerMap.delete(taskId)
  }
}

const updateTaskProgress = async (taskId: number) => {
  const res = await queryTaskProgress(taskId)
  if (res.code === 200) {
    taskProgressMap[taskId] = {
      totalStatus: res.data.totalStatus,
      transitStatus: res.data.transitStatus,
      threatAndStrikeStatus: res.data.threatAndStrikeStatus,
      mes: res.data.mes,
    }
    if (isTaskProgressComplete(taskProgressMap[taskId])) {
      stopTaskProgressPolling(taskId)
    }
  }
}

const startTaskProgressPolling = async (taskId: number) => {
  stopTaskProgressPolling(taskId)
  taskProgressMap[taskId] = {
    totalStatus: '进行中',
    transitStatus: '进行中',
    threatAndStrikeStatus: '进行中',
    mes: '任务后台计算中',
  }
  await updateTaskProgress(taskId)
  const timer = setInterval(() => {
    void updateTaskProgress(taskId)
  }, 3000)
  taskProgressTimerMap.set(taskId, timer)
}

/** 加载战场列表 */
const loadBattleList = async () => {
  const res = await getBattleList()
  if (res.code === 200) {
    battleList.value = res.data || []
    if (battleList.value.length > 0 && activeNames.value.length === 0) {
      nextTick(() => {
        activeNames.value = [battleList.value[0].id ?? 0]
      })
    }
  }
}

/** 打开新建战场弹窗 */
const handleCreateBattle = () => {
  battleForm.id = undefined
  battleForm.name = ''
  battleForm.description = ''
  battleForm.area = ''
  battleForm.beginDate = ''
  battleForm.endDate = ''
  battleForm.dataRefreshRate = ''
  battleDatePickValue.value = ['', '']
  battleForm.tasks = []
  battleDialogTitle.value = '新建战场'
  battleDialogVisible.value = true
  store.battleCircleMap.clear()
  store.battlePolygonMap.clear()
}

/** 打开编辑战场弹窗 */
const handleEditBattle = (battle: BattleForm) => {
  Object.assign(battleForm, battle)
  if (battle.createAreaMode === '圆' && battle.circleJSON) {
    const circles = JSON.parse(battle.circleJSON)
    store.battleCircleMap.clear()
    circles.forEach((circle: any, idx: number) => {
      store.setCircle(idx, circle)
    })
    store.currentCircleIdx = circles.length
  }
  battleDialogTitle.value = '修改战场'
  battleDialogVisible.value = true
}

/** 删除战场 */
const handleDeleteBattle = (battleId?: number) => {
  if (!battleId) return
  ElMessageBox.confirm('确定要删除该战场及其下属任务吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    const res = await deleteBattle(battleId)
    if (res.code === 200) {
      ElMessage.success('删除战场成功')
      await loadBattleList()
    } else {
      ElMessage.error(res.msg || '删除失败')
    }
  })
}

/** 取消战场表单 */
const cancelBattleForm = (formEl: FormInstance | undefined) => {
  if (!formEl) return
  formEl.resetFields()
  battleDialogVisible.value = false
}

/** 提交战场表单 */
const submitBattleForm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  await formEl.validate(async (valid) => {
    if (valid) {
      let res
      battleForm.area = JSON.stringify(Array.from(store.battlePolygonMap.values()))
      battleForm.circleJSON = JSON.stringify(Array.from(store.battleCircleMap.values()))
      if (battleForm.id) {
        res = await updateBattle(battleForm)
      } else {
        res = await saveBattle(battleForm)
      }
      if (res.code === 200) {
        await loadBattleList()
        cancelBattleForm(battleFormRef.value)
        ElMessage.success(battleForm.id ? '修改战场成功' : '新增战场成功')
      } else {
        ElMessage.warning(res.msg)
      }
    }
  })
}

/** 打开新建任务弹窗 */
const handleCreateTask = async (battle: BattleForm) => {
  store.setActivedBattle(battle)
  if (battle.id) {
    taskForm.battleId = battle.id
    taskForm.id = undefined
    taskForm.name = ''
    taskForm.description = ''
    taskForm.targetTypeShow = []
    taskForm.meCountry = ''
    taskForm.meCountryShow = []
    taskForm.enemyCountry = ''
    taskForm.enemyCountryShow = []
    taskForm.beginDate = ''
    taskForm.endDate = ''
    taskDatePickValue.value = ['', '']
    taskForm.targetType = ''
    taskDialogTitle.value = '新建任务'
    taskDialogVisible.value = true
    minIdx.value = 0
    tableData.value = []
  }
}

/** 编辑任务 */
const handleEditTask = async (task: TaskForm, battle: BattleForm) => {
  Object.assign(taskForm, task)
  if (task.beginDate && task.endDate) {
    taskDatePickValue.value = [task.beginDate, task.endDate]
  }
  taskForm.meCountryShow = taskForm.meCountry?.split(',') || []
  taskForm.enemyCountryShow = taskForm.enemyCountry?.split(',') || []
  taskForm.targetTypeShow = taskForm.targetType?.split(',') || []

  let jsonTable: TaskSteps[] = []
  if (taskForm.steps) {
    try {
      jsonTable = JSON.parse(taskForm.steps) as TaskSteps[]
    } catch {
      jsonTable = []
    }
  }

  if (jsonTable && jsonTable.length) {
    const isDefaultFourSteps =
      jsonTable.length === autoBattleSegmentNames.length &&
      jsonTable.every((step, index) => step.name === autoBattleSegmentNames[index])

    jsonTable.forEach((step) => {
      step.sateTypeShow = step.sateType ? step.sateType.split(',') : []
      ;(step as BattleSegmentRow).autoGenerated = jsonTable.length === 1 || isDefaultFourSteps
    })

    if (jsonTable.length === 1 && task.beginDate && task.endDate) {
      jsonTable[0].startTime = task.beginDate
      jsonTable[0].endTime = task.endDate
    }
  }

  minIdx.value = jsonTable.reduce((max, step) => Math.max(max, Number(step.id) || 0), 0)
  tableData.value = jsonTable
  if (task.beginDate && task.endDate) {
    syncBattleSegmentsWithTaskTime()
  }
  store.setActivedBattle(battle)
  taskDialogTitle.value = '修改任务'
  taskDialogVisible.value = true
}

/** 删除任务 */
const handleDeleteTask = (task: TaskForm) => {
  if (!task.id) return
  ElMessageBox.confirm('确定要删除该任务吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    const res = await deleteTask(task.id!)
    if (res.code === 200) {
      ElMessage.success('删除任务成功')
      await loadBattleList()
    } else {
      ElMessage.error(res.msg || '删除任务失败')
    }
  })
}

/** 重置任务表单 */
const resetTaskForm = (formEl: FormInstance | undefined) => {
  if (!formEl) return
  formEl.resetFields()
  taskDialogVisible.value = false
}

/** 构造提交任务的负载对象 */
const buildTaskPayload = () => {
  const steps = tableData.value.map((step) => ({
    ...step,
    sateType: step.sateTypeShow.join(','),
  }))

  return {
    ...taskForm,
    meCountry: taskForm.meCountryShow.join(','),
    enemyCountry: taskForm.enemyCountryShow.join(','),
    targetType: taskForm.targetTypeShow.join(','),
    steps: JSON.stringify(steps),
  } as TaskForm
}

/** 提交任务表单 */
const submitTaskForm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  await formEl.validate(async (valid) => {
    if (valid) {
      if (tableData.value && tableData.value.length) {
        for (const step of tableData.value) {
          if (!step.name.trim()) {
            ElMessage.warning('作战阶段的名称不能为空')
            return
          }
          if (!step.startTime) {
            ElMessage.warning('作战阶段的开始时间不能为空')
            return
          }
          if (!step.endTime) {
            ElMessage.warning('作战阶段的结束时间不能为空')
            return
          }
          if (step.sateTypeShow.length === 0) {
            ElMessage.warning('作战阶段的卫星类型不能为空')
            return
          }
        }
      } else {
        ElMessage.warning('请至少添加一个作战阶段')
        return
      }

      const taskPayload = buildTaskPayload()
      let res
      if (taskForm.id) {
        res = await updateTask(taskPayload)
      } else {
        res = await createTask(taskPayload)
      }
      if (res.code === 200) {
        if (!taskForm.id && res.data) {
          const newTaskId = Number(res.data)
          await startTaskProgressPolling(newTaskId)
        }
        resetTaskForm(taskFormRef.value)
        await loadBattleList()
        ElMessage.success(taskForm.id ? '修改任务成功' : '新增任务成功')
        taskDialogVisible.value = false
      } else {
        ElMessage.error(res.msg || '操作失败')
      }
    } else {
      ElMessage.warning('请填写完整的任务信息')
    }
  })
}

/** 页面挂载时数据初始化 */
onMounted(async () => {
  await loadBattleList()
  try {
    const countryRes = await getBattleCountrys()
    if (countryRes.code === 200) {
      taskCountrys.value = countryRes.data || []
    }
    const targetRes = await getTaskStageTargetOptions()
    if (targetRes.code === 200) {
      targetOptions.value = targetRes.data || []
    }
  } catch (err) {
    console.error('初始化下拉选择失败', err)
  }
})
</script>

<style scoped lang="scss">
.battle-manage-container {
  padding: 8px 0;

  .toolbar-card {
    margin-bottom: 16px;
    background: var(--surface-bg-color);
    border: 1px solid var(--surface-border-color);

    .toolbar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .toolbar-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: bold;
        color: var(--text-color-strong);
      }

      .toolbar-actions {
        display: flex;
        gap: 10px;
      }
    }
  }

  .battle-list-box {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .battle-card {
      background: var(--surface-bg-color);
      border: 1px solid var(--surface-border-color);
      border-radius: 8px;
      overflow: hidden;

      .battle-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: rgba(0, 225, 255, 0.04);
        cursor: pointer;

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;

          .expand-icon {
            transition: transform 0.25s ease;
            &.is-expanded {
              transform: rotate(90deg);
            }
          }

          .battle-name {
            font-size: 15px;
            font-weight: 700;
            color: #7dd3fc;
          }
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }

      .battle-card-body {
        padding: 16px;
        border-top: 1px solid var(--surface-border-color);
      }
    }
  }
}

.section-dialog-title {
  font-size: 14px;
  font-weight: bold;
  margin: 12px 0 16px;
  padding-left: 8px;
  border-left: 3px solid #00e1ff;
  color: #7dd3fc;
}

.polygon-area-item {
  margin: 10px 0;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;

  .area-name-row {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
  }

  .lonlat-row {
    display: flex;
    gap: 12px;
    margin-top: 8px;

    .coord-field {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }
}

.dialog-table-box {
  margin-top: 12px;
  .table-nav {
    margin-bottom: 8px;
  }
}

.text-muted {
  color: var(--text-color-secondary);
  font-size: 12px;
}
</style>
