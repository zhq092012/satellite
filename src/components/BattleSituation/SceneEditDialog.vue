<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '修改场景' : '添加场景'"
    width="680px"
    append-to-body
    destroy-on-close
    align-center
    class="scene-edit-dialog"
    modal-class="scene-edit-dialog-modal"
    @closed="handleClosed"
  >
    <el-form ref="formRef" :model="sceneForm" :rules="formRules" label-width="96px" class="scene-edit-form">
      <el-form-item label="场景名称" prop="name">
        <el-input v-model="sceneForm.name" maxlength="80" show-word-limit placeholder="请输入场景名称" />
      </el-form-item>
      <el-form-item label="场景概述" prop="description">
        <el-input
          v-model="sceneForm.description"
          type="textarea"
          :rows="3"
          maxlength="400"
          show-word-limit
          placeholder="请输入场景概述"
        />
      </el-form-item>
      <el-form-item label="作战区域">
        <el-button type="primary" size="small" @click="addPolygonArea">新增区域</el-button>
      </el-form-item>
      <div v-for="[idx, area] in store.battlePolygonMap" :key="idx" class="polygon-area-item">
        <el-form-item label="区域名称">
          <div class="area-name-row">
            <el-input v-model="area.name" placeholder="区域名称" />
            <el-button type="primary" size="small" round @click="chooseArea(idx)">选择区域</el-button>
            <el-button type="danger" size="small" round @click="removeArea(idx)">删除区域</el-button>
          </div>
        </el-form-item>
        <el-form-item label="区域坐标">
          <div v-for="(lonlat, lIdx) in area.lonlats" :key="lIdx" class="lonlat-row">
            <div class="coord-field">
              <span>经度：</span>
              <el-input v-model="lonlat.lon" type="number" />
            </div>
            <div class="coord-field">
              <span>纬度：</span>
              <el-input v-model="lonlat.lat" type="number" />
            </div>
          </div>
          <div v-if="!area.lonlats.length" class="coord-empty">尚未绘制坐标，请点击「选择区域」</div>
        </el-form-item>
      </div>
    </el-form>
    <template #footer>
      <el-button class="scene-edit-btn scene-edit-btn--ghost" @click="visible = false">取 消</el-button>
      <el-button
        class="scene-edit-btn scene-edit-btn--primary"
        type="primary"
        :loading="submitting"
        @click="handleSubmit"
      >
        保 存
      </el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="showPolygonMap" title="场景区域选择" width="1100px" append-to-body destroy-on-close>
    <PolygonMap ref="polygonRef" />
    <template #footer>
      <el-button @click="clearMap">取 消</el-button>
      <el-button type="primary" @click="confirmPolygonMap">确 定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { getBattleList, saveBattle, updateBattle } from '@/api/dashboard'
import type { BattleForm } from '@/types/dashboard'
import { useLayoutStore } from '@/store/modules/layout'
import PolygonMap from '@/components/cesium/BattleArea.vue'

/** 多边形区域坐标点。 */
type PolygonLonLat = { lon: number; lat: number }
/** 多边形区域。 */
type PolygonArea = { name: string; lonlats: PolygonLonLat[] }

const props = defineProps<{
  /** 对话框是否可见。 */
  modelValue: boolean
  /** 是否为修改当前场景；false 表示添加新场景。 */
  isEdit: boolean
  /** 当前正在编辑的场景（战场）；添加模式可为 null。 */
  scene: BattleForm | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  /** 保存成功后回传最新场景数据。 */
  (e: 'saved', scene: BattleForm): void
}>()

/** 布局 Store，多边形绘制结果写入 battlePolygonMap。 */
const store = useLayoutStore()
/** 表单实例。 */
const formRef = ref<FormInstance>()
/** 区域绘制组件实例。 */
const polygonRef = ref<InstanceType<typeof PolygonMap> | null>(null)
/** 提交中状态。 */
const submitting = ref(false)
/** 区域地图弹窗显隐。 */
const showPolygonMap = ref(false)
/** 本次是否已成功提交，关闭时据此决定是否还原多边形缓存。 */
const committed = ref(false)
/** 打开弹窗前的多边形缓存快照，取消编辑时还原。 */
const polygonSnapshot = ref<Map<number, PolygonArea>>(new Map())
/** 打开弹窗前的当前多边形下标快照。 */
const polygonIdxSnapshot = ref(0)

/** 场景（战场）表单。 */
const sceneForm = reactive<BattleForm>({
  name: '',
  description: '',
  createAreaMode: '多边形',
  area: '',
  beginDate: '',
  endDate: '',
  dataRefreshRate: '',
  tasks: [],
})

/** 场景名称与概述必填。 */
const formRules = reactive<FormRules<BattleForm>>({
  name: [{ required: true, message: '请输入场景名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入场景概述', trigger: 'blur' }],
})

/** 对话框显隐双向绑定。 */
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

/**
 * 将 lonlats 原始数据规范为 `{ lon, lat }[]`。
 *
 * @param raw 接口或表单中的坐标数组
 * @returns 可编辑的坐标点列表
 */
const normalizeLonlats = (raw: unknown): PolygonLonLat[] => {
  if (!Array.isArray(raw)) return []
  const points: PolygonLonLat[] = []
  raw.forEach((pt) => {
    if (Array.isArray(pt) && pt.length >= 2) {
      points.push({ lon: Number(pt[0]), lat: Number(pt[1]) })
      return
    }
    if (pt && typeof pt === 'object') {
      const item = pt as { lon?: number; lng?: number; lat?: number }
      const lon = typeof item.lon === 'number' ? item.lon : item.lng
      const lat = item.lat
      if (typeof lon === 'number' && typeof lat === 'number') {
        points.push({ lon, lat })
      }
    }
  })
  return points
}

/**
 * 把当前 Store 中的多边形 Map 拷贝一份快照。
 *
 * @returns 快照 Map
 */
const clonePolygonMap = (): Map<number, PolygonArea> => {
  const cloned = new Map<number, PolygonArea>()
  store.battlePolygonMap.forEach((area, idx) => {
    cloned.set(idx, {
      name: area.name,
      lonlats: (area.lonlats || []).map((pt) => ({ lon: Number(pt.lon), lat: Number(pt.lat) })),
    })
  })
  return cloned
}

/**
 * 用快照覆盖 Store 中的多边形缓存。
 *
 * @param snapshot 打开弹窗前保存的区域数据
 * @param currentIdx 打开弹窗前的当前区域下标
 */
const restorePolygonMap = (snapshot: Map<number, PolygonArea>, currentIdx: number) => {
  store.battlePolygonMap.clear()
  snapshot.forEach((area, idx) => {
    store.battlePolygonMap.set(idx, area)
  })
  store.currentPolygonIdx = currentIdx
}

/**
 * 将场景 area JSON 灌入 Store 多边形 Map，供表单编辑。
 *
 * @param scene 当前场景
 */
const hydratePolygonMap = (scene: BattleForm | null) => {
  store.battlePolygonMap.clear()
  store.currentPolygonIdx = 0
  if (!scene?.area) return
  try {
    let areaData = typeof scene.area === 'string' ? JSON.parse(scene.area) : scene.area
    if (!Array.isArray(areaData)) areaData = [areaData]
    areaData.forEach((item: { name?: string; lonlats?: unknown }, idx: number) => {
      store.battlePolygonMap.set(idx, {
        name: item?.name || '',
        lonlats: normalizeLonlats(item?.lonlats),
      })
    })
    store.currentPolygonIdx = store.battlePolygonMap.size
  } catch (error) {
    console.error('解析场景区域失败:', error)
  }
}

/**
 * 用当前场景填充表单；添加模式则重置为空表单。
 */
const fillForm = () => {
  committed.value = false
  polygonSnapshot.value = clonePolygonMap()
  polygonIdxSnapshot.value = store.currentPolygonIdx

  if (props.isEdit && props.scene) {
    Object.assign(sceneForm, {
      ...props.scene,
      createAreaMode: '多边形',
      tasks: props.scene.tasks || [],
    })
    hydratePolygonMap(props.scene)
    return
  }

  sceneForm.id = undefined
  sceneForm.name = ''
  sceneForm.description = ''
  sceneForm.createAreaMode = '多边形'
  sceneForm.area = ''
  sceneForm.beginDate = ''
  sceneForm.endDate = ''
  sceneForm.dataRefreshRate = ''
  sceneForm.tasks = []
  sceneForm.circleJSON = ''
  store.battlePolygonMap.clear()
  store.currentPolygonIdx = 0
}

/**
 * 新增一块空白作战区域。
 */
const addPolygonArea = () => {
  const nextIdx =
    store.battlePolygonMap.size === 0 ? 0 : Math.max(...Array.from(store.battlePolygonMap.keys())) + 1
  store.battlePolygonMap.set(nextIdx, { name: '', lonlats: [] })
  store.currentPolygonIdx = nextIdx
}

/**
 * 打开地图绘制指定区域。
 *
 * @param idx 区域下标
 */
const chooseArea = (idx: number) => {
  store.currentPolygonIdx = idx
  showPolygonMap.value = true
  nextTick(() => {
    polygonRef.value?.clearAll()
  })
}

/**
 * 删除指定作战区域。
 *
 * @param idx 区域下标
 */
const removeArea = (idx: number) => {
  store.removePolygon(idx)
}

/**
 * 确认地图绘制并关闭区域选择弹窗。
 */
const confirmPolygonMap = () => {
  showPolygonMap.value = false
}

/**
 * 取消地图绘制。
 */
const clearMap = () => {
  showPolygonMap.value = false
  polygonRef.value?.clearAll()
}

/**
 * 从战场列表中解析刚保存的场景（优先按返回 ID，其次按名称匹配最新一条）。
 *
 * @param payload 本次提交的表单
 * @param responseData 保存接口返回的 data
 * @returns 列表中的完整场景对象；找不到时回退为 payload
 */
const resolveSavedScene = async (payload: BattleForm, responseData: unknown): Promise<BattleForm> => {
  try {
    const listRes = await getBattleList()
    const list = listRes.code === 200 && Array.isArray(listRes.data) ? listRes.data : []
    const newId = Number(responseData)
    if (Number.isFinite(newId) && newId > 0) {
      const byId = list.find((item) => item.id === newId)
      if (byId) return byId
    }
    const matched = [...list].reverse().find((item) => item.name === payload.name)
    return matched || payload
  } catch (error) {
    console.error('刷新场景列表失败:', error)
    return payload
  }
}

/**
 * 校验并提交场景新增 / 修改。
 */
const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.warning('请填写完整的场景信息')
      return
    }
    submitting.value = true
    try {
      const payload: BattleForm = {
        ...sceneForm,
        createAreaMode: '多边形',
        area: JSON.stringify(Array.from(store.battlePolygonMap.values())),
        circleJSON: JSON.stringify(Array.from(store.battleCircleMap.values())),
      }
      const res = payload.id ? await updateBattle(payload) : await saveBattle(payload)
      if (res.code === 200) {
        const saved = payload.id ? payload : await resolveSavedScene(payload, res.data)
        committed.value = true
        polygonSnapshot.value = clonePolygonMap()
        polygonIdxSnapshot.value = store.currentPolygonIdx
        ElMessage.success(payload.id ? '修改场景成功' : '添加场景成功')
        visible.value = false
        emit('saved', saved)
      } else {
        ElMessage.error(res.msg || (payload.id ? '修改场景失败' : '添加场景失败'))
      }
    } catch (error) {
      console.error('保存场景失败:', error)
      ElMessage.error('保存场景失败')
    } finally {
      submitting.value = false
    }
  })
}

/**
 * 关闭弹窗：未保存则还原多边形缓存，并重置表单。
 */
const handleClosed = () => {
  formRef.value?.resetFields()
  showPolygonMap.value = false
  if (!committed.value) {
    restorePolygonMap(polygonSnapshot.value, polygonIdxSnapshot.value)
  }
  committed.value = false
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) fillForm()
  }
)
</script>

<style lang="scss">
.scene-edit-dialog-modal.atlas-app-overlay,
.atlas-app-overlay.scene-edit-dialog-modal {
  background-color: rgba(4, 10, 20, 0.72) !important;
}

.atlas-app-dialog.scene-edit-dialog,
.scene-edit-dialog .atlas-app-dialog {
  --el-dialog-bg-color: rgba(8, 15, 26, 0.96);
  --el-color-primary: #00e1ff;
  background: rgba(8, 15, 26, 0.96) !important;
  border: 1px solid rgba(0, 225, 255, 0.28) !important;
  border-radius: 10px !important;
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.55),
    0 0 18px rgba(0, 225, 255, 0.12) !important;

  .atlas-app-dialog__header {
    margin-right: 0;
    padding: 14px 20px 12px;
    background: linear-gradient(90deg, rgba(0, 225, 255, 0.12) 0%, rgba(8, 15, 26, 0) 100%);
    border-bottom: 1px solid rgba(0, 225, 255, 0.18);
  }

  .atlas-app-dialog__title {
    color: #40f2ff !important;
    font-size: 15px;
    font-weight: 700;
    text-shadow: 0 0 8px rgba(64, 242, 255, 0.4);
  }

  .atlas-app-dialog__headerbtn .atlas-app-dialog__close {
    color: #94a3b8 !important;

    &:hover {
      color: #00e1ff !important;
    }
  }

  .atlas-app-dialog__body {
    padding: 16px 20px 8px;
    background: rgba(12, 22, 38, 0.72);
    color: #e2efff;
    max-height: 62vh;
    overflow-y: auto;
  }

  .atlas-app-dialog__footer {
    padding: 12px 20px 16px;
    background: rgba(8, 15, 26, 0.92);
    border-top: 1px solid rgba(0, 225, 255, 0.18);
  }

  .atlas-app-form-item__label {
    color: #7dd3fc !important;
    font-size: 13px;
  }

  .atlas-app-input__wrapper,
  .atlas-app-textarea__wrapper {
    background-color: rgba(8, 20, 36, 0.9) !important;
    box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.32) inset !important;
  }

  .atlas-app-textarea__inner,
  .atlas-app-input__inner {
    color: #e2efff !important;
    background-color: transparent !important;
  }

  .scene-edit-btn--ghost.atlas-app-button {
    color: #cbd5e1 !important;
    background: rgba(15, 23, 42, 0.85) !important;
    border: 1px solid rgba(148, 163, 184, 0.4) !important;
  }

  .scene-edit-btn--primary.atlas-app-button {
    color: #08202c !important;
    background: linear-gradient(135deg, #40f2ff, #00b8d4) !important;
    border: 1px solid #00e1ff !important;
  }
}

.polygon-area-item {
  margin-bottom: 8px;
  padding: 8px 10px;
  border: 1px dashed rgba(0, 225, 255, 0.22);
  border-radius: 6px;
  background: rgba(8, 20, 36, 0.45);
}

.area-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.lonlat-row {
  display: flex;
  gap: 12px;
  margin-bottom: 6px;
}

.coord-field {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  color: #94a3b8;
  font-size: 12px;
}

.coord-empty {
  font-size: 12px;
  color: #64748b;
}
</style>
