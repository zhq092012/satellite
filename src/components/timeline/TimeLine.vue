<template>
  <section class="time-player">
    <!-- 控制条 -->
    <div class="ctrl">
      <el-button-group>
        <el-button :icon="DArrowLeft" circle @click="step(-1)" />
        <el-button :icon="isPlay ? VideoPause : VideoPlay" circle @click="toggle" />
        <el-button :icon="DArrowRight" circle @click="step(1)" />
      </el-button-group>

      <span class="time-txt">{{ fmt(current) }}</span>
    </div>

    <!-- 时间轴 -->
    <div class="line">
      <el-slider v-model="range" range :min="0" :max="total" :step="1" :show-tooltip="false" @change="onDrag" />
    </div>

    <!-- 刻度 -->
    <div class="marks">
      <span v-for="(l, i) in labels" :key="i" :style="{ left: `${(i / total) * 100}%` }">
        {{ l }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VideoPlay, VideoPause, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
interface Props {
  list: Array<string>
  modelValue: string
}
// ********  以下 4 个 Props 由父组件传入  ********
const props = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

// ********  内部状态  ********
const isPlay = ref(false)
const speed = ref(1000) // 毫秒
const timer = ref(0)
const total = computed(() => props.list.length - 1)
const range = ref([0, total.value]) // 双滑块区间 [startIdx, endIdx]

// 当前播放索引
const idx = ref(props.list.findIndex((v) => v === props.modelValue))
watch(
  () => props.modelValue,
  (v) => {
    idx.value = props.list.indexOf(v)
  }
)

// 当前时间
const current = computed(() => props.list[idx.value] || props.list[0])

// 格式化
const fmt = (t: string) => (t && t.length === 19 ? t.slice(-8) : t)

// 播放
const next = () => {
  if (idx.value < range.value[1]) {
    idx.value++
  } else {
    // 到结尾自动回到开头
    idx.value = range.value[0]
  }
  emit('update:modelValue', props.list[idx.value])
}
const toggle = () => {
  isPlay.value = !isPlay.value
  if (isPlay.value) {
    timer.value = setInterval(next, speed.value)
  } else {
    clearInterval(timer.value)
  }
}

// 步进
const step = (dir: number) => {
  const target = idx.value + dir
  if (target >= range.value[0] && target <= range.value[1]) {
    idx.value = target
    emit('update:modelValue', props.list[idx.value])
  }
}

// 拖拽区间
const onDrag = (val: Array<number>) => {
  range.value = val
  // 把当前播放点限制到新区间内
  if (idx.value < val[0]) {
    idx.value = val[0]
  }
  if (idx.value > val[1]) {
    idx.value = val[1]
  }
  emit('update:modelValue', props.list[idx.value])
}

// 刻度文字
const labels = computed(() => {
  const len = range.value[1] - range.value[0] + 1
  const step = Math.ceil(len / 8) // 最多 8 个
  return Array.from({ length: Math.ceil(len / step) }, (_, i) => {
    const t = props.list[range.value[0] + i * step]
    return fmt(t)
  })
})

// 键盘左右箭头
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') {
    step(-1)
  }
  if (e.key === 'ArrowRight') {
    step(1)
  }
})
</script>

<style scoped lang="scss">
.time-player {
  position: absolute;
  bottom: 0;
  --h: 52px;
  width: 100%;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  position: relative;
  .ctrl {
    display: flex;
    align-items: center;
    height: var(--h);
    .time-txt {
      margin-left: auto;
      font-size: 15px;
      font-weight: 600;
      color: var(--el-color-primary);
      letter-spacing: 1px;
    }
  }
  .line {
    height: 6px;
    position: relative;
    margin: 8px 0;
    :deep(.el-slider) {
      height: 100%;
      .el-slider__runway {
        height: 6px;
        background: var(--surface-border-color);
        border-radius: 3px;
      }
      .el-slider__bar {
        height: 6px;
        background: transparent; // 我们自定义渐变
      }
      .el-slider__button {
        width: 14px;
        height: 14px;
        border: 2px solid var(--el-color-primary);
      }
    }
    .progress {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
      pointer-events: none;
      border-radius: 3px;
    }
  }
  .marks {
    position: relative;
    height: 20px;
    span {
      position: absolute;
      font-size: 12px;
      color: var(--text-color-secondary);
      transform: translateX(-50%);
    }
  }
}
</style>
