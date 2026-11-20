import type {
  SatelliteAssembleTreeNode,
  SatelliteTreeCountryNode,
  SatelliteTreeSatelliteLeaf,
} from '@/types/satellite/satellite'
import type { TaskResourceItem } from '@/types/task/task'

/** 卫星装配树叶子节点的业务上下文 */
export interface SatelliteTreeLeafContext {
  /** 国家 */
  country: string
  /** 体系 */
  system: string
  /** 系列 */
  series: string
}

/**
 * 将树叶子转为任务 `satellites` 挂载项。
 *
 * @param leaf 接口叶子
 * @param ctx 国家 / 体系 / 系列
 */
export const mapTreeLeafToTaskResource = (
  leaf: SatelliteTreeSatelliteLeaf,
  ctx: SatelliteTreeLeafContext,
): TaskResourceItem => {
  const norad = String(leaf.noradId ?? leaf.norad ?? '').trim()
  const resourceId = String(leaf.resourceId ?? leaf.id ?? norad).trim()
  if (!resourceId) {
    throw new Error(`卫星树叶子缺少 resourceId/NORAD：${JSON.stringify(leaf)}`)
  }
  const name = leaf.name?.trim() || resourceId
  const code = (leaf.code?.trim() || leaf.norad || norad || ctx.series).trim()
  return { resourceId, name, code }
}

const buildNodeId = (
  nodeType: SatelliteAssembleTreeNode['nodeType'],
  parts: string[],
): string => [nodeType, ...parts].join('::')

/**
 * 将卫星资源树 API 数据转为装配页 `el-tree` 节点。
 *
 * @param roots 国家根节点列表
 * @param allowedSystems 允许的体系（如任务勾选的侦察/通信）；空则不过滤
 */
export const buildSatelliteAssembleTreeNodes = (
  roots: SatelliteTreeCountryNode[],
  allowedSystems: string[],
): SatelliteAssembleTreeNode[] => {
  const allow = new Set(allowedSystems.map((item) => item.trim()).filter(Boolean))
  const filterSystem = allow.size > 0

  return roots
    .map((countryNode) => {
      const country = countryNode.country?.trim() || '未知国家'
      const systemChildren: SatelliteAssembleTreeNode[] = []

      for (const systemNode of countryNode.systems ?? []) {
        const system = systemNode.system?.trim() || '--'
        if (filterSystem && !allow.has(system)) continue

        const seriesChildren: SatelliteAssembleTreeNode[] = []
        for (const seriesNode of systemNode.series ?? []) {
          const series = seriesNode.series?.trim()
          if (!series) continue

          const satelliteChildren = (seriesNode.satellites ?? [])
            .map((leaf) => {
              try {
                const resource = mapTreeLeafToTaskResource(leaf, { country, system, series })
                return {
                  id: buildNodeId('satellite', [country, system, series, resource.resourceId]),
                  label: resource.name,
                  nodeType: 'satellite' as const,
                  resource,
                  country,
                  system,
                  series,
                }
              } catch {
                return null
              }
            })
            .filter(Boolean) as SatelliteAssembleTreeNode[]

          if (!satelliteChildren.length) continue

          seriesChildren.push({
            id: buildNodeId('series', [country, system, series]),
            label: series,
            nodeType: 'series',
            country,
            system,
            series,
            children: satelliteChildren,
          })
        }

        if (!seriesChildren.length) continue
        systemChildren.push({
          id: buildNodeId('system', [country, system]),
          label: system,
          nodeType: 'system',
          country,
          system,
          children: seriesChildren,
        })
      }

      if (!systemChildren.length) return null
      return {
        id: buildNodeId('country', [country]),
        label: country,
        nodeType: 'country',
        country,
        children: systemChildren,
      }
    })
    .filter(Boolean) as SatelliteAssembleTreeNode[]
}

/**
 * 遍历树，按 resourceId 建立索引。
 *
 * @param nodes 树根
 */
export const indexSatelliteTreeResources = (
  nodes: SatelliteAssembleTreeNode[],
): Map<string, { resource: TaskResourceItem; country: string; system: string; series: string }> => {
  const map = new Map<string, { resource: TaskResourceItem; country: string; system: string; series: string }>()

  const walk = (list: SatelliteAssembleTreeNode[]) => {
    for (const node of list) {
      if (node.nodeType === 'satellite' && node.resource) {
        map.set(node.resource.resourceId, {
          resource: node.resource,
          country: node.country ?? '',
          system: node.system ?? '',
          series: node.series ?? '',
        })
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return map
}

/**
 * 收集所有卫星叶子节点的 tree id。
 *
 * @param nodes 树根
 */
export const collectSatelliteTreeLeafIds = (nodes: SatelliteAssembleTreeNode[]): string[] => {
  const ids: string[] = []
  const walk = (list: SatelliteAssembleTreeNode[]) => {
    for (const node of list) {
      if (node.nodeType === 'satellite') ids.push(node.id)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return ids
}