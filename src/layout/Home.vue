<template>
  <div class="container">
    <main class="main">
      <!-- 左侧侧边栏 -->
      <Transition name="battleslide">
        <div class="left-panel" v-show="store.showAnalysisPanel">
          <div class="battle-box">
            <div class="title">
              <span class="header-text">🌐 全局战场</span>
              <el-button size="small" icon="Plus" type="primary" round @click="handleCreateBattle">
                新建战场
              </el-button>
            </div>
            <div class="battle-count">
              <div class="stat-card">
                <span>{{ store.satelliteTotal }}</span>
                <span>卫星总数</span>
              </div>
              <div class="stat-card">
                <span class="score-num">{{ healthScore }}</span>
                <span>态势健康分数</span>
              </div>
              <div class="stat-card">
                <span>{{ days }}天</span>
                <span>监测天数</span>
              </div>
            </div>
          </div>
          <!-- 自定义战场列表 -->
          <el-scrollbar class="left-panel-scroll">
            <div class="custom-battle-list">
              <div
                v-for="battle in battleList"
                :key="battle.id"
                class="battle-card-panel"
                :class="{ 'is-expanded': isBattleExpanded(battle.id) }"
              >
                <div class="battle-card-header" @click="toggleBattleExpand(battle.id)">
                  <span class="battle-name">⚔️ {{ battle.name }}</span>
                  <div class="battle-actions" @click.stop>
                    <el-tooltip effect="dark" content="编辑战场" placement="top">
                      <el-button
                        type="success"
                        icon="Edit"
                        size="small"
                        @click.stop="handleEditBattle(battle)"
                        circle
                      />
                    </el-tooltip>
                    <el-tooltip effect="dark" content="删除战场" placement="top">
                      <el-button
                        type="danger"
                        icon="Delete"
                        size="small"
                        @click.stop="handleDeleteBattle(battle.id)"
                        circle
                      />
                    </el-tooltip>
                  </div>
                </div>

                <div v-show="isBattleExpanded(battle.id)" class="battle-card-body">
                  <div class="task-title">
                    <span class="task-label">📋 任务列表</span>
                    <el-button type="primary" icon="Plus" size="small" @click="handleCreateTask(battle)" plain round>
                      新建任务
                    </el-button>
                  </div>

                  <div class="task-item" v-for="task in battle.tasks" :key="task.id ?? task.name">
                    <div class="task-item__main">
                      <div>
                        <div class="task-name">{{ task.name }}</div>
                        <div class="task-time">时间：{{ task.beginDate }} ~ {{ task.endDate }}</div>
                      </div>
                      <el-button
                        type="primary"
                        link
                        size="small"
                        :disabled="isTaskDetailDisabled(task)"
                        @click="showTaskDetail(battle, task)"
                      >
                        查看详情 <el-icon :size="12"><DArrowRight /></el-icon>
                      </el-button>
                    </div>

                    <div class="task-item__actions">
                      <el-button
                        type="success"
                        icon="Edit"
                        size="small"
                        @click="handleEditTask(task, battle)"
                        round
                        plain
                      >
                        修改
                      </el-button>
                      <el-button type="danger" icon="Delete" size="small" @click="handleDeleteTask(task)" round plain>
                        删除
                      </el-button>
                      <el-button
                        type="primary"
                        icon="Aim"
                        size="small"
                        @click="handleElectronicWarfare(task, battle)"
                        round
                      >
                        电子对抗
                      </el-button>
                    </div>

                    <div v-if="getTaskProgress(task)" class="task-item__progress">
                      <div class="task-item__progress-header">
                        <span>当前进度</span>
                        <el-tag
                          :type="isTaskProgressComplete(getTaskProgress(task)) ? 'success' : 'warning'"
                          size="small"
                          round
                        >
                          {{ isTaskProgressComplete(getTaskProgress(task)) ? '完成' : '进行中' }}
                        </el-tag>
                      </div>
                      <el-progress
                        :percentage="getTaskProgressPercent(getTaskProgress(task))"
                        :status="isTaskProgressComplete(getTaskProgress(task)) ? 'success' : ''"
                        :stroke-width="6"
                      />
                      <div class="task-item__progress-status">
                        <span>总任务：{{ getTaskProgress(task)?.totalStatus || '--' }}</span>
                        <span>过境：{{ getTaskProgress(task)?.transitStatus || '--' }}</span>
                        <span>威胁打击：{{ getTaskProgress(task)?.threatAndStrikeStatus || '--' }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </Transition>

      <!-- 地球可视化 -->
      <div class="map-box">
        <CesiumViewer ref="cesiumViewerRef" :show-animation="false" :show-time-line="false" />
      </div>
      <!-- 卫星列表和星座列表底部面板 -->
      <Transition name="satelliteslide">
        <div class="satellite-list-panel" v-show="store.showSatelliteList">
          <div class="tabs-bar" style="padding: 0 5px">
            <div class="tabs">
              <div :class="{ active: activetime === '卫星列表' }" @click="switchTime('卫星列表')">卫星列表</div>
              <div :class="{ active: activetime === '星座列表' }" @click="switchTime('星座列表')">星座列表</div>
            </div>
            <div style="font-size: 12px">
              <span v-if="activetime === '卫星列表'">共{{ satellite_loadnum }}/{{ satellite_total }}颗卫星</span>
              <span v-else>共{{ constellationList.length }}个星座</span>
            </div>
          </div>
          <div v-if="activetime === '卫星列表'" class="satellite-list">
            <section class="search-form">
              <el-form
                :model="satelliteListQueryForm"
                label-width="80px"
                inline
                style="display: inline-flex; flex-wrap: wrap; justify-content: start"
              >
                <el-form-item label="NOARD">
                  <el-input v-model="satelliteListQueryForm.norad" placeholder="请输入NOARD编号"></el-input>
                </el-form-item>
                <el-form-item label="英文名称">
                  <el-input v-model="satelliteListQueryForm.name_en" placeholder="请输入英文名称"></el-input>
                </el-form-item>
                <el-form-item label="国家/地区">
                  <el-input v-model="satelliteListQueryForm.country" placeholder="请输入国家/地区"></el-input>
                </el-form-item>
                <el-form-item label="轨道状态">
                  <el-select
                    v-model="satelliteListQueryForm.orbit_status"
                    placeholder="请选择轨道状态"
                    clearable
                    style="width: 150px"
                  >
                    <el-option :value="0" label="未知"></el-option>
                    <el-option :value="1" label="在轨"></el-option>
                    <el-option :value="2" label="离轨"></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="轨道类型">
                  <el-select
                    v-model="satelliteListQueryForm.orbit_type"
                    placeholder="请选择轨道类型"
                    clearable
                    style="width: 150px"
                  >
                    <el-option :value="0" label="未知"></el-option>
                    <el-option :value="1" label="低轨"></el-option>
                    <el-option :value="2" label="中轨"></el-option>
                    <el-option :value="3" label="高轨"></el-option>
                    <el-option :value="4" label="大椭圆"></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="载荷状态">
                  <el-select
                    v-model="satelliteListQueryForm.payload_status"
                    placeholder="请选择载荷状态"
                    clearable
                    style="width: 150px"
                  >
                    <el-option :value="0" label="未知"></el-option>
                    <el-option :value="1" label="堪用"></el-option>
                    <el-option :value="2" label="失效"></el-option>
                  </el-select>
                </el-form-item>
                <el-form-item label="卫星类型">
                  <el-input v-model="satelliteListQueryForm.sat_type" placeholder="请输入卫星类型"></el-input>
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="loadSatelliteList">查询</el-button>
                  <el-button @click="resetSatelliteListQueryForm">重置</el-button>
                </el-form-item>
              </el-form>
            </section>
            <el-table
              :data="satelliteList"
              style="width: 100%; flex: 1; overflow-y: auto"
              :cell-style="{ fontSize: '12px' }"
              @sort-change="handleSortChange"
            >
              <el-table-column prop="norad" label="NOARD" sortable> </el-table-column>
              <!-- <el-table-column prop="int_id" label="国际编号"> </el-table-column> -->
              <el-table-column prop="name_en" label="英文名称"> </el-table-column>
              <el-table-column prop="country" label="国家/地区"> </el-table-column>
              <el-table-column prop="sat_type" label="卫星类型" width="300"> </el-table-column>
              <el-table-column prop="orbit_status" label="轨道状态" sortable>
                <template #default="scope">
                  <span v-if="scope.row.orbit_status === 0">未知</span>
                  <span v-if="scope.row.orbit_status === 1">在轨</span>
                  <span v-if="scope.row.orbit_status === 2">离轨</span>
                </template>
              </el-table-column>
              <el-table-column prop="orbit_type" label="轨道类型" sortable>
                <template #default="scope">
                  <span v-if="scope.row.orbit_type === 0">未知</span>
                  <span v-if="scope.row.orbit_type === 1">低轨</span>
                  <span v-if="scope.row.orbit_type === 2">中轨</span>
                  <span v-if="scope.row.orbit_type === 3">高轨</span>
                  <span v-if="scope.row.orbit_type === 4">大椭圆</span>
                </template>
              </el-table-column>
              <el-table-column prop="payload_status" label="载荷状态" sortable>
                <template #default="scope">
                  <span v-if="scope.row.payload_status === 0">未知</span>
                  <span v-if="scope.row.payload_status === 1">堪用</span>
                  <span v-if="scope.row.payload_status === 2">失效</span>
                </template>
              </el-table-column>
              <el-table-column prop="contractors" label="制造商" width="300"> </el-table-column>
              <el-table-column label="操作">
                <template #default="scope">
                  <el-button type="primary" link @click="detail(scope.row.norad)">详情</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="page-box">
              <el-pagination
                :page-size="10"
                layout="total, prev, pager, next"
                :total="satellite_total"
                @current-change="handleCurrentChange"
              />
            </div>
          </div>
          <div v-else class="constellation-list">
            <el-table
              :data="constellationList"
              style="width: 100%; max-height: 600px; overflow-y: auto"
              fit
              highlight-current-row
              :cell-style="{ fontSize: '12px' }"
              :row-class-name="getConstellationRowClassName"
              @row-click="handleConstellationRowClick"
            >
              <el-table-column prop="name" label="星座名称"> </el-table-column>
              <el-table-column prop="chineseName" label="星座中文名称"> </el-table-column>
              <el-table-column prop="constellationConfig" label="星座配置"> </el-table-column>
              <el-table-column prop="constellationFunction" label="星座功能"> </el-table-column>
              <el-table-column prop="orbitType" label="轨道类型"> </el-table-column>
              <el-table-column prop="operator" label="运营商"> </el-table-column>
              <el-table-column prop="country" label="国家/地区"> </el-table-column>
              <el-table-column prop="constructionStatus" label="建设状态"> </el-table-column>
              <el-table-column prop="technicalCapability" label="技术能力"> </el-table-column>
              <el-table-column prop="economicSocialValue" label="经济社会价值" show-overflow-tooltip> </el-table-column>
              <el-table-column prop="netNameZh" label="网络名称"> </el-table-column>
              <el-table-column prop="description" label="备注" show-overflow-tooltip> </el-table-column>
              <el-table-column prop="satelliteCount" label="卫星数量"> </el-table-column>
            </el-table>
          </div>
        </div>
      </Transition>
      <!-- 卫星星座侧边栏面板 -->
      <Transition name="analysisslide">
        <div class="our-scroll constellation-sidebar" v-show="store.showAnalysisPanel">
          <!-- 1. 星座列表视图 -->
          <template v-if="!selectedConstellationDetail">
            <div class="sidebar-top">
              <div class="top-title">
                <span class="title-text">卫星星座库</span>
                <el-tag type="info" size="small" effect="dark" round>
                  {{ filteredConstellationList.length }} 个星座
                </el-tag>
              </div>
              <div class="search-box">
                <el-input
                  v-model="constellationSearchKeyword"
                  placeholder="搜索星座、中文名、运营商、国家..."
                  clearable
                  prefix-icon="Search"
                />
              </div>
            </div>

            <el-scrollbar class="constellation-scroll-list">
              <div
                v-for="constellation in filteredConstellationList"
                :key="constellation._id || constellation.id || constellation.name"
                class="constellation-card"
                :class="{ 'is-active': selectedConstellationName === constellation.name }"
                @click="handleSelectConstellation(constellation)"
              >
                <div class="card-header">
                  <div class="name-group">
                    <span class="chinese-name">{{ constellation.chineseName || constellation.name }}</span>
                  </div>
                  <el-tag size="small" type="primary" effect="plain" round>
                    {{ constellation.satelliteCount }} 颗卫星
                  </el-tag>
                </div>

                <div class="card-body">
                  <div class="info-item">
                    <span class="label">轨道类型：</span>
                    <span class="value">{{ constellation.orbitType || '未知' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">运营商：</span>
                    <span class="value">{{ constellation.operator || constellation.country || '未指定' }}</span>
                  </div>
                  <div class="info-item" v-if="constellation.constructionStatus">
                    <span class="label">建设状态：</span>
                    <span class="value">{{ constellation.constructionStatus }}</span>
                  </div>
                </div>

                <div class="card-footer">
                  <span class="action-hint">点击查看详情及地图展示</span>
                  <el-icon><ArrowRight /></el-icon>
                </div>
              </div>

              <el-empty
                v-if="filteredConstellationList.length === 0"
                description="未检索到匹配的卫星星座"
                :image-size="80"
              />
            </el-scrollbar>
          </template>

          <!-- 2. 星座详情视图 -->
          <template v-else>
            <div class="sidebar-top detail-top">
              <el-button icon="Back" size="small" plain round @click="handleBackToConstellationList">
                返回列表
              </el-button>
              <span class="top-title-text">星座详情</span>
            </div>

            <el-scrollbar class="constellation-detail-container">
              <!-- 基本资料 -->
              <div class="detail-section">
                <div class="section-header">
                  <span class="section-title">{{
                    selectedConstellationDetail.chineseName || selectedConstellationDetail.name
                  }}</span>
                  <el-tag type="success" size="small" round>
                    {{ selectedConstellationDetail.satelliteCount }} 颗卫星
                  </el-tag>
                </div>

                <div class="map-action-bar">
                  <el-button
                    v-if="selectedConstellationName === selectedConstellationDetail.name"
                    type="warning"
                    icon="Hide"
                    size="small"
                    plain
                    round
                    @click="handleClearMapConstellation"
                  >
                    取消地图高亮
                  </el-button>
                  <el-button
                    v-else
                    type="primary"
                    icon="Location"
                    size="small"
                    round
                    @click="handleSelectConstellation(selectedConstellationDetail)"
                  >
                    在地图展示星座卫星
                  </el-button>
                </div>

                <div class="detail-grid">
                  <div class="detail-cell">
                    <span class="field-label">英文名称</span>
                    <span class="field-value">{{ selectedConstellationDetail.name || '-' }}</span>
                  </div>
                  <div class="detail-cell">
                    <span class="field-label">网络名称</span>
                    <span class="field-value">{{
                      selectedConstellationDetail.netNameZh || selectedConstellationDetail.netName || '-'
                    }}</span>
                  </div>
                  <div class="detail-cell">
                    <span class="field-label">国家/地区</span>
                    <span class="field-value">{{ selectedConstellationDetail.country || '-' }}</span>
                  </div>
                  <div class="detail-cell">
                    <span class="field-label">运营商</span>
                    <span class="field-value">{{ selectedConstellationDetail.operator || '-' }}</span>
                  </div>
                  <div class="detail-cell">
                    <span class="field-label">建设状态</span>
                    <span class="field-value">{{ selectedConstellationDetail.constructionStatus || '-' }}</span>
                  </div>
                  <div class="detail-cell">
                    <span class="field-label">轨道类型</span>
                    <span class="field-value">{{ selectedConstellationDetail.orbitType || '-' }}</span>
                  </div>
                </div>
              </div>

              <!-- 能力与配置 -->
              <div
                class="detail-section"
                v-if="
                  selectedConstellationDetail.constellationConfig ||
                  selectedConstellationDetail.constellationFunction ||
                  selectedConstellationDetail.technicalCapability
                "
              >
                <div class="section-title-bar">系统参数与技术能力</div>
                <div class="detail-text-block" v-if="selectedConstellationDetail.constellationConfig">
                  <span class="block-label">星座配置：</span>
                  <span class="block-value">{{ selectedConstellationDetail.constellationConfig }}</span>
                </div>
                <div class="detail-text-block" v-if="selectedConstellationDetail.constellationFunction">
                  <span class="block-label">星座功能：</span>
                  <span class="block-value">{{ selectedConstellationDetail.constellationFunction }}</span>
                </div>
                <div class="detail-text-block" v-if="selectedConstellationDetail.technicalCapability">
                  <span class="block-label">技术能力：</span>
                  <span class="block-value">{{ selectedConstellationDetail.technicalCapability }}</span>
                </div>
                <div class="detail-text-block" v-if="selectedConstellationDetail.economicSocialValue">
                  <span class="block-label">经济社会价值：</span>
                  <span class="block-value">{{ selectedConstellationDetail.economicSocialValue }}</span>
                </div>
              </div>

              <!-- 卫星成员 -->
              <div
                class="detail-section"
                v-if="selectedConstellationDetail.noradIds && selectedConstellationDetail.noradIds.length"
              >
                <div class="section-title-bar">
                  <span>成员卫星 (NORAD 编号)</span>
                  <span class="sub-count">共 {{ selectedConstellationDetail.noradIds.length }} 颗</span>
                </div>
                <div class="norad-tags-box">
                  <el-tag
                    v-for="norad in selectedConstellationDetail.noradIds"
                    :key="norad"
                    class="norad-tag"
                    size="small"
                    effect="light"
                    @click="detail(Number(norad))"
                  >
                    {{ norad }}
                  </el-tag>
                </div>
                <span class="tag-tip">提示：点击 NORAD 编号可查看具体卫星档案</span>
              </div>

              <!-- 资源与描述 -->
              <div
                class="detail-section"
                v-if="selectedConstellationDetail.description || selectedConstellationDetail.dataSource"
              >
                <div class="section-title-bar">资源与描述</div>
                <div class="detail-text-block" v-if="selectedConstellationDetail.dataSource">
                  <span class="block-label">数据来源：</span>
                  <span class="block-value">{{ selectedConstellationDetail.dataSource }}</span>
                </div>
                <div class="detail-text-block" v-if="selectedConstellationDetail.description">
                  <span class="block-label">备注描述：</span>
                  <span class="block-value">{{ selectedConstellationDetail.description }}</span>
                </div>
              </div>
            </el-scrollbar>
          </template>
        </div>
      </Transition>
    </main>

    <!-- 新建/编辑战场弹窗 -->
    <el-dialog :title="battleDialogTitle" v-model="battleDialogVisible" width="600">
      <el-form :model="battleForm" ref="battleFormRef" :rules="createBattleRules" label-width="120">
        <el-form-item label="战场名称" prop="name">
          <el-input v-model="battleForm.name" placeholder="请输入战场名称"></el-input>
        </el-form-item>
        <el-form-item label="战场概述" prop="description">
          <el-input v-model="battleForm.description" type="textarea" placeholder="请输入战场概述"></el-input>
        </el-form-item>
        <el-form-item label="" v-if="battleForm.createAreaMode === '多边形'">
          <el-button type="primary" @click="addPolygonArea" size="small"> 新增区域</el-button>
        </el-form-item>
        <div
          v-show="battleForm.createAreaMode === '多边形'"
          v-for="[idx, area] in store.battlePolygonMap"
          :key="idx"
          style="margin: 10px 0px; padding: 10px 0px"
        >
          <el-form-item label="区域名称">
            <div style="width: 90%; display: flex; gap: 10px; align-items: center">
              <el-input v-model="area.name"></el-input>
              <el-button type="primary" @click="chooseArea(idx)" round size="small">选择区域</el-button>
              <el-button type="danger" @click="removeArea(idx)" round size="small">删除区域</el-button>
            </div>
          </el-form-item>
          <el-form-item label="区域坐标" prop="longitude">
            <div v-for="lonlat in area.lonlats" style="padding-bottom: 5px">
              <div style="display: flex; gap: 5px; align-items: center; padding-bottom: 5px">
                <span style="width: 100px">经度：</span> <el-input v-model="lonlat.lon" type="number"></el-input>
              </div>
              <div style="display: flex; gap: 5px; align-items: center">
                <span style="width: 100px">纬度：</span> <el-input v-model="lonlat.lat" type="number"></el-input>
              </div>
            </div>
          </el-form-item>
        </div>
      </el-form>
      <div slot="footer">
        <el-button @click="cancel(battleFormRef)">取 消</el-button>
        <el-button type="primary" @click="submit(battleFormRef)">确 定</el-button>
      </div>
    </el-dialog>
    <!-- 新建/编辑任务弹窗 -->
    <el-dialog :title="taskDialogTitle" v-model="taskDialogVisible" fullscreen class="task-dialog">
      <div class="title">作战任务</div>
      <el-form :model="taskForm" ref="taskFormRef" :rules="createTaskRules" label-width="120">
        <el-form-item label="任务名称" prop="name">
          <el-input v-model="taskForm.name"></el-input>
        </el-form-item>
        <el-form-item label="任务概述" prop="description">
          <el-input v-model="taskForm.description" type="textarea"></el-input>
        </el-form-item>

        <el-form-item label="时间限制" prop="beginDate">
          <el-date-picker
            v-model="taskDatePickValue"
            type="datetimerange"
            start-placeholder="开始时间"
            value-format="YYYY-MM-DD HH:mm"
            format="YYYY-MM-DD HH:mm"
            end-placeholder="结束时间"
          />
        </el-form-item>

        <el-form-item label="红方" prop="meCountry">
          <el-select
            v-model="taskForm.meCountryShow"
            multiple
            placeholder="请选择"
            @change="taskForm.meCountry = taskForm.meCountryShow.join(',')"
          >
            <el-option v-for="item in taskCountrys" :key="item" :label="item" :value="item"> </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="蓝方" prop="enemyCountry">
          <el-select
            v-model="taskForm.enemyCountryShow"
            multiple
            placeholder="请选择"
            @change="taskForm.enemyCountry = taskForm.enemyCountryShow.join(',')"
          >
            <el-option v-for="item in taskCountrys" :key="item" :label="item" :value="item"> </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="设置关注">
          <el-switch v-model="taskForm.focusStatus" :active-value="1" :inactive-value="0"></el-switch>
        </el-form-item>
      </el-form>
      <div class="title">作战阶段</div>
      <div class="dialog-table-box">
        <div class="table-nav">
          <el-button type="primary" size="small" round @click="handleAddBattleSegment">新增作战阶段</el-button>
        </div>
        <el-table :data="tableData" style="width: 100%" border>
          <el-table-column type="index" label="编号" :width="80"> </el-table-column>
          <el-table-column prop="name" label="名称">
            <template #default="scope">
              <el-input v-model="scope.row.name" placeholder=""></el-input>
            </template>
          </el-table-column>
          <el-table-column prop="startTime" label="开始时间" :width="255">
            <template #default="scope">
              <el-date-picker
                v-model="scope.row.startTime"
                @change="validateStartTime(scope.row)"
                type="datetime"
                placeholder="开始时间"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DD HH:mm"
              ></el-date-picker>
            </template>
          </el-table-column>
          <el-table-column prop="endTime" label="结束时间" :width="255">
            <template #default="scope">
              <el-date-picker
                v-model="scope.row.endTime"
                @change="validateEndTime(scope.row)"
                type="datetime"
                placeholder="结束时间"
                format="YYYY-MM-DD HH:mm"
                value-format="YYYY-MM-DD HH:mm"
              ></el-date-picker>
            </template>
          </el-table-column>
          <el-table-column prop="sateType" label="卫星类型">
            <template #default="scope">
              <el-select v-model="scope.row.sateTypeShow" placeholder="" multiple>
                <el-option v-for="item in taskSateTypes" :key="item" :label="item" :value="item"> </el-option>
              </el-select>
            </template>
          </el-table-column>
          <el-table-column prop="target" label="目标">
            <template #default="scope">
              <el-select v-model="scope.row.target">
                <el-option v-for="item in targetOptions" :key="item" :label="item" :value="item"></el-option>
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="scope">
              <el-button icon="Delete" type="danger" plain round size="small" @click="handleRemove(scope.row)"
                >删除</el-button
              >
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div slot="footer">
        <el-button @click="resetTaskForm(taskFormRef)">取 消</el-button>
        <el-button type="primary" @click="submitTaskForm(taskFormRef)">确 定</el-button>
      </div>
    </el-dialog>
    <!-- 战场区域选择弹窗 -->
    <el-dialog title="战场区域选择" v-model="showPolygonMap" width="1200">
      <div>
        <PolygonMap ref="polygonRef" />
      </div>
      <div slot="footer" style="padding: 10px">
        <el-button @click="clearMap">取 消</el-button>
        <el-button type="primary" @click="confirm">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch, onBeforeUnmount, onMounted } from 'vue'
import * as echarts from 'echarts'
import CesiumViewer from '@/components/cesium/CesiumViewer.vue'
import PolygonMap from '@/components/cesium/viewers/BattleArea.vue'
import {
  deleteBattle,
  deleteTask,
  getBattleCountrys,
  getBattleList,
  getHomeSatellite,
  getSatelliteConstellations,
  getSatelliteCount,
  getSatelliteDistribution,
  getSatelliteList,
  getTaskList,
  queryTaskProgress,
  saveBattle,
  createTask,
  updateBattle,
  updateTask,
  type SatelliteConstellation,
  type SatelliteDistribution,
  getTaskStageTargetOptions,
} from '@/api/dashboard'
import { ElMessage, type FormRules, type FormInstance, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { useLayoutStore } from '@/store/modules/layout'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
const polygonRef = ref<InstanceType<typeof PolygonMap> | null>(null)
defineOptions({ name: 'Home' }) // 对应 keep-alive 的 include

const validateStartTime = (row: any) => {
  if (row.endTime && new Date(row.startTime).getTime() >= new Date(row.endTime).getTime()) {
    ElMessage.warning('开始时间必须早于结束时间')
    row.startTime = ''
  }
  // 确保开始时间在任务时间范围内
  if (taskForm.beginDate && new Date(row.startTime).getTime() < new Date(taskForm.beginDate).getTime()) {
    ElMessage.warning('开始时间必须在任务时间范围内')
    row.startTime = ''
  }
}
const validateEndTime = (row: any) => {
  if (row.startTime && new Date(row.endTime).getTime() <= new Date(row.startTime).getTime()) {
    ElMessage.warning('结束时间必须晚于开始时间')
    row.endTime = ''
  }
  // 确保结束时间在任务时间范围内
  if (taskForm.endDate && new Date(row.endTime).getTime() > new Date(taskForm.endDate).getTime()) {
    ElMessage.warning('结束时间必须在任务时间范围内')
    row.endTime = ''
  }
}
const showPolygonMap = ref(false)
const confirm = () => {
  showPolygonMap.value = false
}
const clearMap = () => {
  showPolygonMap.value = false
  polygonRef.value && polygonRef.value.clearAll()
}
type BattleSegmentRow = TaskSteps & {
  autoGenerated?: boolean
}

const autoBattleSegmentNames = ['集结', '突防', '进攻', '撤退']

const tableData = ref<BattleSegmentRow[]>([])

// 初始化索引 默认选择第一行
const minIdx = ref(0)
const syncMinIdxFromSteps = (steps: TaskSteps[]) => {
  minIdx.value = steps.reduce((max, step) => Math.max(max, Number(step.id) || 0), 0)
}
const parseDateTime = (value: string) => {
  if (!value) return null
  const date = new Date(value.replace(/-/g, '/'))
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDateTime = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`
}

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

const clearAutoGeneratedBattleSegments = () => {
  tableData.value = tableData.value.filter((segment) => !segment.autoGenerated)
}

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

  if (hasOnlyEmptyManualRows) {
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

  if (tableData.value.length === 1) {
    tableData.value = rebalanceBattleSegments([
      {
        ...tableData.value[0],
        autoGenerated: true,
      },
    ])
    return
  }

  if (!tableData.value.length) {
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
// 计算当前最大步骤编号，供后续新增时继续递增
const calcMinIdx = () => {
  const stepsJSON = store.activedTask?.steps
  if (stepsJSON) {
    const steps = JSON.parse(stepsJSON) as TaskSteps[]
    if (steps && steps.length) {
      syncMinIdxFromSteps(steps)
    }
  }
  return 0
}
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

const handleRemove = (row: BattleSegmentRow) => {
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

const store = useLayoutStore()
const router = useRouter()
const { openSatelliteProfile } = useSatelliteProfileDialog()
const cesiumViewerRef = ref<{
  renderSatellitePathWithPrimitive: (satellites: SatelliteInfo[]) => void
  clearViewer: () => void
  focusConstellationByName: (constellationName?: string | null) => Promise<void>
}>()
const activeNames = ref<any[]>([])

/**
 * [功能说明]
 * 判断指定战场 ID 的卡片面板当前是否处于展开状态
 */
const isBattleExpanded = (id: any) => {
  return activeNames.value.includes(id)
}

/**
 * [功能说明]
 * 切换指定战场 ID 的卡片面板展开 / 折叠状态
 */
const toggleBattleExpand = (id: any) => {
  const index = activeNames.value.indexOf(id)
  if (index > -1) {
    activeNames.value.splice(index, 1)
  } else {
    activeNames.value.push(id)
  }
}

// 查询战场下的任务列表
watch(
  activeNames,
  () => {
    if (activeNames.value.length) {
      activeNames.value.forEach(async (battleId) => {
        const res = await getTaskList(Number(battleId))
        if (res.code === 200) {
          //  如果没完成则调用定时器继续查询任务进度
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
            battle.tasks = []
            battle.tasks = res.data
          }
        }
      })
    }
  },
  { deep: true }
)

const battleDialogTitle = ref('新建战场')
const battleDialogVisible = ref(false)
const taskDialogTitle = ref('新建任务')
const taskDialogVisible = ref(false)
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
const battleDatePickValue = ref(['2025-12-01 09:00', '2025-12-02 18:00'])
const taskDatePickValue = ref(['2025-12-01 09:00', '2025-12-02 18:00'])

watch(battleDatePickValue, (newVal) => {
  if (newVal) {
    battleForm.beginDate = String(newVal[0])
    battleForm.endDate = String(newVal[1])
  }
  console.log(newVal)
})
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
  console.log(newVal)
})
const battleFormRef = ref<FormInstance>()
const taskFormRef = ref<FormInstance>()
const createBattleRules = reactive<FormRules<BattleForm>>({
  name: [{ required: true, message: '请输入战场名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入战场概述', trigger: 'blur' }],
  beginDate: [{ required: true, message: '请选择日期', trigger: 'change' }],
  endDate: [{ required: true, message: '请选择日期', trigger: 'change' }],
})
const createTaskRules = reactive<FormRules<TaskForm>>({
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入任务概述', trigger: 'blur' }],
  meCountry: [{ required: true, message: '请选择红方国家', trigger: 'change' }],
  enemyCountry: [{ required: true, message: '请选择蓝方国家', trigger: 'change' }],
  beginDate: [{ required: true, message: '请选择日期', trigger: 'change' }],
  endDate: [{ required: true, message: '请选择日期', trigger: 'change' }],
  targetType: [{ required: true, message: '请选择目标类型', trigger: 'change' }],
})

type TaskProgressInfo = {
  totalStatus: string
  transitStatus: string
  threatAndStrikeStatus: string
  mes?: string
}

const taskProgressMap = reactive<Record<number, TaskProgressInfo>>({})
const taskProgressTimerMap = new Map<number, ReturnType<typeof setInterval>>()

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

const isTaskDetailDisabled = (task: TaskForm) => {
  const progress = getTaskProgress(task)
  return !!progress && !isTaskProgressComplete(progress)
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

const cancel = (formEl: FormInstance | undefined) => {
  if (!formEl) return
  formEl.resetFields()
  battleDialogVisible.value = false
}
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
const submit = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  await formEl.validate(async (valid, fields) => {
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
        loadBattleList()
        cancel(battleFormRef.value)
        ElMessage.success(battleForm.id ? '修改战场成功' : '新增战场成功')
      } else {
        ElMessage.warning(res.msg)
        return
      }
      battleDialogVisible.value = false
    } else {
      console.log('error submit!', fields)
    }
  })
}
const resetTaskForm = (formEl: FormInstance | undefined) => {
  if (!formEl) return
  formEl.resetFields()
  taskDialogVisible.value = false
}
const submitTaskForm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  await formEl.validate(async (valid) => {
    if (valid) {
      if (tableData.value && tableData.value.length) {
        for (const step of tableData.value) {
          if (step.name.trim() === '') {
            ElMessage.warning('作战阶段的名称不能为空')
            throw new Error('作战阶段的名称不能为空')
          }
          if (!step.startTime) {
            ElMessage.warning('作战阶段的开始时间不能为空')
            throw new Error('作战阶段的开始时间不能为空')
          }
          if (!step.endTime) {
            ElMessage.warning('作战阶段的结束时间不能为空')
            throw new Error('作战阶段的结束时间不能为空')
          }
          if (step.sateTypeShow.length === 0) {
            ElMessage.warning('作战阶段的卫星类型不能为空')
            throw new Error('作战阶段的卫星类型不能为空')
          }
        }
      } else {
        ElMessage.warning('请至少添加一个作战阶段')
        throw new Error('请至少添加一个作战阶段')
      }
      const taskPayload = buildTaskPayload()
      let res
      if (taskForm.id) {
        res = await updateTask(taskPayload)
      } else {
        res = await createTask(taskPayload)
      }
      if (res.code === 200) {
        // 需要后端返回创建的任务ID
        if (!taskForm.id) {
          if (res.code === 200) {
            const newTaskId = Number((res as any).data)
            await startTaskProgressPolling(newTaskId ?? 0)
          }
        }

        resetTaskForm(taskFormRef.value)
        loadBattleList()
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
const battleList = ref<BattleForm[]>([])
const loadBattleList = async () => {
  const res = await getBattleList()
  if (res.code === 200) {
    battleList.value = res.data.map((s) => {
      return s
    })
    nextTick(() => {
      activeNames.value = [res.data[0].id ?? 0]
    })
  }
}

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

    taskDialogVisible.value = true
    taskDialogTitle.value = '新建任务'
    // 重置任务索引
    minIdx.value = 0
    // 清空表格数据
    tableData.value = []
  }
}

/**
 * 修改任务
 * @param task
 * @param battle
 */
const handleEditTask = async (task: TaskForm, battle: BattleForm) => {
  Object.assign(taskForm, task)
  // 同步日期范围选择器，保证日期范围在弹窗中正确显示
  if (task.beginDate && task.endDate) {
    taskDatePickValue.value = [task.beginDate, task.endDate]
  } else {
    taskDatePickValue.value = ['2025-12-01 09:00', '2025-12-02 18:00']
  }
  taskForm.meCountryShow = taskForm.meCountry?.split(',')
  taskForm.enemyCountryShow = taskForm.enemyCountry?.split(',')
  taskForm.targetTypeShow = taskForm.targetType?.split(',')
  const jsonTable = JSON.parse(taskForm.steps) as TaskSteps[]
  if (jsonTable && jsonTable.length) {
    const isDefaultFourSteps =
      jsonTable.length === autoBattleSegmentNames.length &&
      jsonTable.every((step, index) => step.name === autoBattleSegmentNames[index])

    jsonTable.forEach((step) => {
      step.sateTypeShow = step.sateType.split(',')
      ;(step as BattleSegmentRow).autoGenerated = jsonTable.length === 1 || isDefaultFourSteps
    })

    if (jsonTable.length === 1 && task.beginDate && task.endDate) {
      jsonTable[0].startTime = task.beginDate
      jsonTable[0].endTime = task.endDate
    }
  }
  // 初始化任务索引 默认选中第一行
  syncMinIdxFromSteps(jsonTable)
  tableData.value = jsonTable
  // 同步任务时间
  if (task.beginDate && task.endDate) {
    syncBattleSegmentsWithTaskTime()
  }
  store.setActivedBattle(battle)
  taskDialogTitle.value = '修改任务'
  taskDialogVisible.value = true
}
const handleEditBattle = (battle: BattleForm) => {
  // 将列表/后端返回的对象字段浅拷贝到响应式的 `battleForm` 中，保留原引用以维持响应性
  Object.assign(battleForm, battle)
  if (battle.createAreaMode === '圆' && battle.circleJSON) {
    const circles = JSON.parse(battle.circleJSON)
    store.battleCircleMap.clear()
    circles.forEach((circle: any, idx: number) => {
      store.setCircle(idx, circle)
    })
    store.currentCircleIdx = circles.length
  }
  if (battle.createAreaMode === '多边形' && battle.area) {
    const areas = JSON.parse(battle.area)
    store.battlePolygonMap.clear()
    areas.forEach((area: any, idx: number) => {
      store.setPolygon(idx, area)
    })
    store.currentPolygonIdx = areas.length
  }

  store.setActivedBattle(battleForm)
  battleDialogTitle.value = '修改战场'
  battleDialogVisible.value = true
}
const handleDeleteBattle = async (battileId: number | undefined) => {
  ElMessageBox.confirm('战场删除后无法恢复，是否继续删除?', '警告！', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      if (battileId) {
        await deleteBattle(battileId)
        loadBattleList()
        ElMessage.success('删除战场成功')
      }
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '用户取消删除',
      })
    })
}
const handleDeleteTask = (task: TaskForm) => {
  ElMessageBox.confirm('任务删除后无法恢复，是否继续删除?', '警告！', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      if (task.id) {
        stopTaskProgressPolling(task.id)
        delete taskProgressMap[task.id]
        await deleteTask(task.id)

        const battle = battleList.value.find((s) => s.id === task.battleId)
        if (battle && battle.id) {
          const tasksRes = await getTaskList(battle.id)
          if (tasksRes.code === 200) {
            battle.tasks = tasksRes.data
          }
        }
        ElMessage.success('删除任务成功')
      }
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '用户取消删除',
      })
    })
}
/**
 * 电子对抗任务
 * @param task 任务信息
 */
const handleElectronicWarfare = (task: TaskForm, battle: BattleForm) => {
  if (isTaskDetailDisabled(task)) {
    return
  }
  // 保存当前TaskId
  store.setActivedTask(task)
  store.setActivedBattle(battle)
  store.activetab = '电子对抗分析'
  router.push({
    name: 'Situation',
  })
}

//查看任务详情
const showTaskDetail = async (battle: BattleForm, task: TaskForm) => {
  if (isTaskDetailDisabled(task)) {
    return
  }
  // 保存当前TaskId
  store.setActivedTask(task)
  store.setActivedBattle(battle)

  router.push({
    name: 'Situation',
  })
}

const activetime = ref('卫星列表')
const switchTime = (tab: string) => {
  activetime.value = tab
  if (tab === '卫星列表') {
    store.toggleShowSatelliteList(true)
    selectedConstellationName.value = ''
    void cesiumViewerRef.value?.focusConstellationByName(null)
    return
  }
}

const satelliteOrbitList = ref<SatelliteInfo[]>([])
/**
 * 获取卫星tle数据列表
 */
const loadSatelliteOrbit = async () => {
  const res = await getHomeSatellite(1, 1000000)
  if (res.code === 200) {
    satelliteOrbitList.value = res.data.content

    if (satelliteOrbitList.value.length) {
      cesiumViewerRef.value?.clearViewer()
      cesiumViewerRef.value?.renderSatellitePathWithPrimitive(satelliteOrbitList.value)
      if (selectedConstellationName.value) {
        await cesiumViewerRef.value?.focusConstellationByName(selectedConstellationName.value)
      }
    }
  }
}
type ConstellationListItem = SatelliteConstellation & { satelliteCount: number }
const constellationList = ref<ConstellationListItem[]>([])
const selectedConstellationName = ref<string>('')

// 选中的星座详情数据
// [变量用途] 保存侧边栏当前选中的星座对象，未选中时为 null
const selectedConstellationDetail = ref<ConstellationListItem | null>(null)

// 星座搜寻关键词
// [变量用途] 绑定侧边栏搜索框输入，用于对星座列表进行即时过滤
const constellationSearchKeyword = ref('')

// 过滤后的星座列表
// [变量用途] 根据搜寻关键词过滤出的星座列表数组
const filteredConstellationList = computed(() => {
  const kw = constellationSearchKeyword.value.trim().toLowerCase()
  if (!kw) return constellationList.value
  return constellationList.value.filter((item) => {
    return (
      (item.name && item.name.toLowerCase().includes(kw)) ||
      (item.chineseName && item.chineseName.toLowerCase().includes(kw)) ||
      (item.englishName && item.englishName.toLowerCase().includes(kw)) ||
      (item.operator && item.operator.toLowerCase().includes(kw)) ||
      (item.country && item.country.toLowerCase().includes(kw)) ||
      (item.orbitType && item.orbitType.toLowerCase().includes(kw))
    )
  })
})

/**
 * [功能]
 * 选择某个星座：展开/进入侧边栏星座详情，并在 3D 地图上高亮展示该星座的卫星、包络及星间链路
 *
 * @param constellation 选中的星座对象
 */
const handleSelectConstellation = async (constellation: ConstellationListItem) => {
  selectedConstellationDetail.value = constellation
  selectedConstellationName.value = constellation.name
  store.showAnalysisPanel = true

  // 如果尚未加载卫星 primitive 数据，则自动触发加载
  if (!satelliteOrbitList.value.length) {
    await loadSatelliteOrbit()
  }

  // 联动 Cesium Viewer 聚焦于该星座
  await cesiumViewerRef.value?.focusConstellationByName(constellation.name)
}

/**
 * [功能]
 * 从星座详情返回星座列表
 */
const handleBackToConstellationList = () => {
  selectedConstellationDetail.value = null
}

/**
 * [功能]
 * 清除地图上的星座高亮与聚焦
 */
const handleClearMapConstellation = async () => {
  selectedConstellationName.value = ''
  await cesiumViewerRef.value?.focusConstellationByName(null)
}

/**
 * 获取星座列表
 */
const loadConstellationList = async () => {
  const res = await getSatelliteConstellations()
  if (res.code === 200 && Array.isArray(res.data)) {
    constellationList.value = res.data
      .map((item) => ({
        ...item,
        satelliteCount: Array.isArray(item.noradIds) ? item.noradIds.length : 0,
      }))
      .sort((left, right) => right.satelliteCount - left.satelliteCount)
  }
}

const handleConstellationRowClick = async (row: ConstellationListItem) => {
  await handleSelectConstellation(row)
}

const getConstellationRowClassName = ({ row }: { row: ConstellationListItem }) => {
  return row.name === selectedConstellationName.value ? 'is-selected-constellation' : ''
}

const satelliteList = ref<Satellite[]>([])
const satellite_total = ref(0)
const satellite_loadnum = ref(0)
const handleSortChange = (column: any) => {
  if (column.order) {
    satelliteListQueryForm.orderField = column.prop
    satelliteListQueryForm.order = column.order === 'ascending' ? 'asc' : 'desc'
  } else {
    satelliteListQueryForm.orderField = undefined
    satelliteListQueryForm.order = undefined
  }
  loadSatelliteList()
}
//卫星列表数据
const loadSatelliteList = async () => {
  const res = await getSatelliteList(
    satelliteListQueryForm.pageNum,
    satelliteListQueryForm.pageSize,
    satelliteListQueryForm.norad,
    satelliteListQueryForm.taskId,
    satelliteListQueryForm.name_en,
    satelliteListQueryForm.country,
    satelliteListQueryForm.orbit_status,
    satelliteListQueryForm.orbit_type,
    satelliteListQueryForm.payload_status,
    satelliteListQueryForm.sat_type,
    satelliteListQueryForm.orderField,
    satelliteListQueryForm.order
  )
  if (res.code === 200) {
    satelliteList.value = res.data.content
    satellite_total.value = res.data.totalElements
    satellite_loadnum.value = res.data.numberOfElements
  }
}

// 重置卫星列表查询表单
const resetSatelliteListQueryForm = () => {
  satelliteListQueryForm.pageNum = 1
  satelliteListQueryForm.pageSize = 10
  satelliteListQueryForm.norad = undefined
  satelliteListQueryForm.taskId = undefined
  satelliteListQueryForm.name_en = undefined
  satelliteListQueryForm.country = undefined
  satelliteListQueryForm.orbit_status = undefined
  satelliteListQueryForm.orbit_type = undefined
  satelliteListQueryForm.payload_status = undefined
  satelliteListQueryForm.sat_type = undefined
  satelliteListQueryForm.orderField = undefined
  satelliteListQueryForm.order = 'asc'

  loadSatelliteList()
}

const satelliteListQueryForm = reactive({
  pageNum: 1,
  pageSize: 10,
  norad: undefined as number | undefined,
  taskId: undefined as number | undefined,
  name_en: undefined as string | undefined,
  country: undefined as string | undefined,
  orbit_status: undefined as number | undefined,
  orbit_type: undefined as number | undefined,
  payload_status: undefined as number | undefined,
  sat_type: undefined as string | undefined,
  orderField: undefined as string | undefined,
  order: 'asc' as 'asc' | 'desc' | undefined,
})

const handleCurrentChange = (num: number) => {
  satelliteListQueryForm.pageNum = num
  loadSatelliteList()
}
const detail = (norad: number) => {
  openSatelliteProfile(norad)
}

const healthScore = ref(0)
const days = ref(0)
const loadSatelliteCount = async () => {
  const res = await getSatelliteCount()
  if (res.code === 200) {
    store.satelliteTotal = res.data.count
    healthScore.value = res.data.healthScore
    days.value = res.data.days
  }
}
const taskSateTypes = ref<string[]>([])
const taskCountrys = ref<string[]>([])
async function loadTaskSatetypes() {
  taskSateTypes.value = ['导弹预警', '侦察', '通信', '导航', '太空目标监视与攻防']
}
async function loadTaskSateCountrys() {
  const res = await getBattleCountrys()
  if (res.code === 200) {
    taskCountrys.value = res.data
  }
}
watch(
  () => store.showSatelliteList,
  (show) => {
    if (show) {
      activetime.value = '卫星列表'
    }
  }
)

onBeforeUnmount(() => {
  taskProgressTimerMap.forEach((timer) => clearInterval(timer))
  taskProgressTimerMap.clear()
})

onMounted(() => {
  nextTick(() => {
    loadSatelliteOrbit()
  })

  loadSatelliteList()
  loadConstellationList()
  loadBattleList()
  loadSatelliteCount()
  loadTaskSatetypes()
  loadTaskSateCountrys()
  calcMinIdx()
  // loadStrikeList()
  // 清空任务相关
  store.$reset()

  // 获取任务阶段目标的下拉框选项
  getTaskTargetOptions()
})
const targetOptions = ref<string[]>([])
async function getTaskTargetOptions() {
  const res = await getTaskStageTargetOptions()
  if (res.code === 200) {
    targetOptions.value = res.data
  }
}
</script>
<style lang="scss" scoped>
.container {
  .task-dialog {
    .title {
      text-align: left;
      font-size: 16px;
      font-weight: bold;
      padding: 0 0 20px 20px;
    }

    .dialog-table-box {
      padding: 10px 20px;

      .table-nav {
        display: flex;
        padding-bottom: 10px;
      }
    }
  }

  /* 1. 进入前：藏在左边 */
  .battleslide-enter-from {
    transform: translateX(-100%);
  }

  /* 2. 进入过程 & 离开过程：做动画 */
  .battleslide-enter-active,
  .battleslide-leave-active {
    transition: transform 0.5s ease-in-out;
  }

  /* 3. 离开后：再滑回去 */
  .battleslide-leave-to {
    transform: translateX(-100%);
  }

  /* 1. 进入前：藏在左边 */
  .satelliteslide-enter-from {
    transform: translateY(100%);
  }

  /* 2. 进入过程 & 离开过程：做动画 */
  .satelliteslide-enter-active,
  .satelliteslide-leave-active {
    transition: transform 0.5s ease-in-out;
  }

  /* 3. 离开后：再滑回去 */
  .satelliteslide-leave-to {
    transform: translateY(100%);
  }

  .analysisslide-enter-from {
    transform: translateX(100%);
  }

  .analysisslide-enter-active,
  .analysisslide-leave-active {
    transition: transform 0.5s ease-in-out;
  }

  .analysisslide-leave-to {
    transform: translateX(100%);
  }

  .main {
    .nav-bar {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: start;
      gap: 10px;
    }

    .tabs-bar {
      height: 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px;

      .tabs {
        display: flex;
        gap: 15px;

        div {
          background: var(--surface-bg-color-strong);
          padding: 5px 0;
          border-radius: 3px;
          cursor: pointer;
        }

        & > div.active {
          background: var(--accent-color);
        }
      }

      .filter {
        display: flex;
        align-items: center;
        cursor: pointer;
        padding: 10px;

        &.active {
          background: var(--accent-color);
          border-radius: 3px;
        }
      }
    }

    .map-box {
      position: relative;
      height: calc(100vh - 60px);

      .filter-panel {
        height: 100%;
        width: 100%;
        position: absolute;
        top: 0;
        left: 0;
        font-size: 12px;
        z-index: 1;

        .nav-bar-filter {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px;
          background: var(--surface-bg-color-strong);
        }

        .filter-content {
          display: grid;
          grid-template-columns: 1fr 100px;
          background: var(--surface-bg-color-soft);

          .filter-list {
            padding: 10px;

            .filter-item {
              display: flex;
              align-items: center;
              gap: 20px;
              padding-top: 10px;

              .filter-type {
                color: var(--text-color-secondary);
              }

              .filter-condition {
                display: flex;
                gap: 10px;

                span {
                  cursor: pointer;

                  &.active {
                    border-bottom: 2px solid var(--accent-color);
                  }
                }
              }
            }
          }

          .show-all {
            color: var(--accent-color);
            padding: 20px 10px 10px 10px;
            display: flex;
            gap: 2px;
            cursor: pointer;
          }
        }
      }
    }

    .satellite-list-panel {
      background: var(--surface-bg-color-strong);

      width: 100%;
      position: absolute;
      bottom: 0;
      left: 0;
      z-index: 999;
      display: flex;
      flex-direction: column;

      .tabs {
        div {
          width: 80px;
          font-size: 14px;
          padding: 3px;
        }
      }

      .satellite-list {
        flex: 1;

        .search-form {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
        }

        .page-box {
          display: flex;
          justify-content: end;
        }
      }

      .constellation-list {
        flex: 1;

        :deep(.el-table__row.is-selected-constellation > td) {
          background: rgba(79, 147, 221, 0.18);
        }
      }
    }

    .our-scroll.constellation-sidebar {
      position: absolute;
      right: 0;
      top: 0;
      height: 100%;
      z-index: 996;
      width: 420px;
      font-size: 14px;
      background: var(--app-bg-color, #0b1528);
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      box-sizing: border-box;

      .sidebar-top {
        padding: 14px 16px;
        background: var(--surface-bg-color-strong, #132238);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        flex-direction: column;
        gap: 12px;

        .top-title {
          display: flex;
          align-items: center;
          justify-content: space-between;

          .title-text {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color-primary, #ffffff);
            letter-spacing: 0.5px;
          }
        }

        &.detail-top {
          flex-direction: row;
          align-items: center;
          gap: 12px;

          .top-title-text {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color-primary, #ffffff);
          }
        }
      }

      .constellation-scroll-list {
        flex: 1;
        padding: 12px 14px;

        .constellation-card:first-child {
          margin-top: 5px;
        }
        .constellation-card {
          background: var(--nav-bar-background, rgba(255, 255, 255, 0.04));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 12px 14px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.25s ease;

          &:hover {
            border-color: var(--accent-color, #4f93dd);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          }

          &.is-active {
            border-color: var(--accent-color, #4f93dd);
            background: rgba(79, 147, 221, 0.12);
          }

          .card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 8px;

            .name-group {
              display: flex;
              flex-direction: column;

              .chinese-name {
                font-size: 15px;
                font-weight: bold;
                color: var(--text-color-primary, #ffffff);
              }

              .english-name {
                font-size: 12px;
                color: var(--text-color-secondary, #909399);
                margin-top: 2px;
              }
            }
          }

          .card-body {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 10px;

            .info-item {
              font-size: 12px;
              display: flex;

              .label {
                color: var(--text-color-secondary, #909399);
                width: 70px;
                flex-shrink: 0;
                text-align: end;
              }

              .value {
                color: var(--text-color-primary, #dcdfe6);
                word-break: break-all;
              }
            }
          }

          .card-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 12px;
            color: var(--accent-color, #4f93dd);
            border-top: 1px dashed rgba(255, 255, 255, 0.08);
            padding-top: 8px;

            .action-hint {
              opacity: 0.85;
            }
          }
        }
      }

      .constellation-detail-container {
        flex: 1;
        padding: 12px 14px;
        text-align: left;

        .detail-section {
          background: var(--nav-bar-background, rgba(255, 255, 255, 0.04));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 14px;
          margin-bottom: 14px;
          text-align: left;

          .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            text-align: left;

            .section-title {
              font-size: 17px;
              font-weight: bold;
              color: var(--text-color-primary, #ffffff);
              text-align: left;
            }
          }

          .map-action-bar {
            margin-bottom: 14px;
            display: flex;
            justify-content: flex-end;
          }

          .section-title-bar {
            font-size: 14px;
            font-weight: 600;
            color: var(--accent-color, #4f93dd);
            padding-bottom: 8px;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
            text-align: left;

            .sub-count {
              font-size: 12px;
              color: var(--text-color-secondary, #909399);
              font-weight: normal;
            }
          }

          .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 12px;
            text-align: left;

            .detail-cell {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              text-align: left;

              .field-label {
                font-size: 11px;
                color: var(--text-color-secondary, #909399);
                margin-bottom: 2px;
                text-align: left;
              }

              .field-value {
                font-size: 13px;
                color: var(--text-color-primary, #ffffff);
                word-break: break-word;
                text-align: left;
              }
            }
          }

          .detail-text-block {
            margin-bottom: 8px;
            font-size: 13px;
            line-height: 1.5;
            text-align: left;

            .block-label {
              color: var(--text-color-secondary, #909399);
              font-weight: 500;
              text-align: left;
            }

            .block-value {
              color: var(--text-color-primary, #dcdfe6);
              text-align: left;
            }
          }

          .norad-tags-box {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            max-height: 180px;
            overflow-y: auto;
            text-align: left;

            .norad-tag {
              cursor: pointer;
              transition: transform 0.15s ease;

              &:hover {
                transform: scale(1.08);
                color: var(--accent-color, #4f93dd);
              }
            }
          }

          .tag-tip {
            display: block;
            margin-top: 8px;
            font-size: 11px;
            color: var(--text-color-secondary, #909399);
          }
        }
      }
    }

    .left-panel {
      // AI:
      // - 全局左侧面板美化：高质感暗黑毛玻璃悬浮科技风
      // - 层次分明的战场概览、态势指标大屏卡片与战场/任务层叠列表
      background: linear-gradient(180deg, rgba(8, 22, 40, 0.95) 0%, rgba(6, 17, 32, 0.98) 100%);
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 999;
      width: 440px;
      border-right: 1px solid rgba(79, 147, 221, 0.25);
      box-shadow: 8px 0 32px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      display: flex;
      flex-direction: column;
      overflow: hidden;

      .battle-box {
        padding: 14px 16px;
        background: rgba(12, 28, 48, 0.6);
        border-bottom: none;

        .title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;

          .header-text {
            font-size: 16px;
            font-weight: 700;
            color: #eaf3ff;
            display: flex;
            align-items: center;
            gap: 8px;
            letter-spacing: 0.5px;
          }
        }

        .battle-count {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;

          .stat-card {
            background: linear-gradient(180deg, rgba(16, 36, 62, 0.8) 0%, rgba(10, 24, 44, 0.9) 100%);
            border: 1px solid rgba(79, 147, 221, 0.2);
            border-radius: 10px;
            padding: 10px 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            transition: all 0.25s ease;

            &:hover {
              border-color: rgba(0, 225, 255, 0.45);
              box-shadow: 0 0 12px rgba(0, 225, 255, 0.2);
            }

            & > span:first-child {
              font-size: 20px;
              font-weight: 800;
              color: #00e1ff;
              font-family: inherit;
              margin-bottom: 4px;

              &.score-num {
                color: #52c41a;
              }
            }

            & > span:last-child {
              font-size: 11px;
              color: #8eb3d6;
            }
          }
        }
      }

      .left-panel-scroll {
        flex: 1;
        padding: 12px 14px;

        .custom-battle-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .battle-card-panel:first-child {
          margin-top: 5px;
        }
        .battle-card-panel {
          background: linear-gradient(180deg, rgba(14, 32, 56, 0.85) 0%, rgba(8, 20, 36, 0.92) 100%);
          border: 1px solid rgba(79, 147, 221, 0.25);
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
          transition: all 0.25s ease;

          &:hover {
            border-color: rgba(0, 225, 255, 0.45);
            box-shadow: 0 0 16px rgba(0, 225, 255, 0.2);
            transform: translateY(-1px);
          }

          &.is-expanded {
            border-color: rgba(0, 225, 255, 0.45);
            background: linear-gradient(180deg, rgba(16, 38, 66, 0.9) 0%, rgba(10, 24, 44, 0.95) 100%);

            .battle-card-header {
              border-bottom: 1px dashed rgba(79, 147, 221, 0.22);
            }
          }

          .battle-card-header {
            height: 48px;
            padding: 0 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            user-select: none;
            transition: background-color 0.2s ease;

            &:hover {
              background: rgba(0, 225, 255, 0.05);
            }

            .battle-name {
              font-size: 15px;
              font-weight: 700;
              color: #eaf3ff;
              letter-spacing: 0.3px;
            }

            .battle-actions {
              display: flex;
              align-items: center;
              gap: 6px;
            }
          }

          .battle-card-body {
            padding: 12px 14px 14px 14px;
          }
        }

        .battle-collapse-title {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-right: 8px;

          .battle-name {
            font-size: 15px;
            font-weight: 700;
            color: #eaf3ff;
            letter-spacing: 0.3px;
          }

          .battle-actions {
            display: flex;
            align-items: center;
            gap: 6px;
          }
        }

        .task-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0 10px 0;
          border-bottom: 1px dashed rgba(79, 147, 221, 0.2);
          margin-bottom: 10px;

          .task-label {
            font-size: 13px;
            font-weight: 700;
            color: #00e1ff;
            display: flex;
            align-items: center;
            gap: 4px;
          }
        }

        .task-item {
          background: linear-gradient(180deg, rgba(14, 32, 56, 0.85) 0%, rgba(8, 20, 36, 0.9) 100%);
          border: 1px solid rgba(79, 147, 221, 0.2);
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 10px;
          transition: all 0.25s ease;

          &:hover {
            border-color: rgba(0, 225, 255, 0.4);
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
          }

          .task-item__main {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 8px;
            margin-bottom: 10px;

            .task-name {
              font-size: 14px;
              font-weight: 700;
              color: #f0f6ff;
              margin-bottom: 4px;
              text-align: left;
            }

            .task-time {
              font-size: 11px;
              color: #8eb3d6;
              text-align: left;
            }
          }

          .task-item__actions {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 8px;
            padding-top: 8px;
            border-top: 1px solid rgba(79, 147, 221, 0.12);
          }

          .task-item__progress {
            margin-top: 10px;
            padding: 8px 10px;
            border-radius: 8px;
            background: rgba(6, 16, 28, 0.6);
            border: 1px solid rgba(79, 147, 221, 0.15);

            .task-item__progress-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              color: #94a3b8;
              font-size: 11px;
              margin-bottom: 6px;
            }

            .task-item__progress-status {
              display: flex;
              justify-content: space-between;
              gap: 6px;
              font-size: 10.5px;
              color: #8eb3d6;
              margin-top: 6px;

              span {
                background: rgba(79, 147, 221, 0.1);
                padding: 2px 6px;
                border-radius: 4px;
              }
            }
          }
        }
      }
    }

    .right-panel {
      background: var(--header-bg-gradient);
      position: absolute;
      right: 0;
      top: 0;
      z-index: 999;
      width: 450px;

      .right-panel-scroll {
        height: calc(100vh - 90px);
        padding-right: 10px;

        .focus-list {
          .focus-item {
            height: 220px;
            background: var(--nav-bar-background);
            margin: 5px 0;
            padding: 10px 0 10px 10px;
            font-size: 12px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 80px repeat(4, 28px);
            gap: 5px;

            .focus-item-1 {
              display: flex;
              flex-direction: column;
              align-items: start;
              justify-content: space-around;
            }

            .focus-item-flex {
              display: grid;
              grid-template-columns: 1.2fr 2fr;

              & > span:first-child {
                align-self: start;
                text-align: right;
                padding-right: 10px;
                color: var(--text-color-secondary);
              }

              & > span:last-child {
                text-align: left;
                align-self: start;
                white-space: normal;
                word-break: break-word;
                overflow-wrap: break-word;
              }
            }
          }
        }
      }
    }
  }
}
</style>
