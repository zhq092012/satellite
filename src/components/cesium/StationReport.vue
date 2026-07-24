el-checkbox<template>
  <div class="ev-container">
    <form class="weapon-selection">
      <el-row :gutter="5">
        <el-col :span="2">
          <div class="search-item-label">打击烈度：</div>
        </el-col>
        <el-col :span="22">
          <div class="search-item-flex">
            <el-radio-group v-model="searchForm.intensity" @change="handleRadioChange">
              <el-radio v-for="item in intensityOptions" :key="item" :value="item" size="small" border>{{ item
              }}</el-radio>
            </el-radio-group>
          </div>
        </el-col>
      </el-row>
      <div v-if="searchForm.intensity === '高烈度'">
        <el-row :gutter="5">
          <el-col :span="2">
            <div class="search-item-label">卫星分类选择：</div>
          </el-col>
          <el-col :span="22">
            <div class="search-item-flex">
              <el-checkbox-group v-model="searchForm.types">
                <el-checkbox v-for="type in satelliteTypes" :key="type" :value="type">{{ type }}</el-checkbox>
              </el-checkbox-group>
            </div>
          </el-col>
        </el-row>
        <el-row :gutter="5">
          <el-col :span="2">
            <div class="search-item-label">打击武器选择：</div>
          </el-col>
          <el-col :span="11">
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox v-model="checkedKinetic" size="large" @change="toggleKinetic">全选</el-checkbox>
                  <span>【动能武器】</span>
                </div>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox-group v-model="kineticWeapons" class="content">
                    <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '动能')">{{ w.name
                    }}</el-checkbox>
                  </el-checkbox-group>
                </div>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox v-model="checkedSpaceBased" size="large" @change="toggleSpaceBased">全选</el-checkbox>
                  <span>【天基武器】</span>
                </div>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox-group v-model="spaceBasedWeapons" class="content">
                    <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '天基武器')">{{ w.name
                    }}</el-checkbox>
                  </el-checkbox-group>
                </div>
              </el-col>
            </el-row>
          </el-col>

        </el-row>
      </div>
      <div v-if="searchForm.intensity === '中烈度'">
        <el-row :gutter="5">
          <el-col :span="2">
            <div class="search-item-label">导弹阵地选择：</div>
          </el-col>
          <el-col :span="22">
            <div class="search-item-flex">
              <el-checkbox-group v-model="searchForm.missileBaseId">
                <el-checkbox v-for="(missileBase, index) in missileBaseEntity" :key="missileBase._id"
                  :value="missileBase._id">{{ missileBase.name }}</el-checkbox>
              </el-checkbox-group>
            </div>
          </el-col>
        </el-row>
        <el-row :gutter="5">
          <el-col :span="2">
            <div class="search-item-label">军事基地选择：</div>
          </el-col>
          <el-col :span="11">
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox v-model="checkedRadar" size="large" @change="toggleRadar">全选</el-checkbox>
                  <span>【雷达站】</span>
                </div>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox-group v-model="radarBase" class="content">
                    <el-checkbox :value="w.stationId"
                      v-for="w in stationDistances.filter((s) => s.stationType === '接收站')">{{ w.stationName
                      }}</el-checkbox>
                  </el-checkbox-group>
                </div>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox v-model="checkedDataCenter" size="large" @change="toggleDataCenter">全选</el-checkbox>
                  <span>【数据中心】</span>
                </div>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox-group v-model="dataCenter" class="content">
                    <el-checkbox :value="w.stationId"
                      v-for="w in stationDistances.filter((s) => s.stationType === '数据中心')">{{ w.stationName
                      }}</el-checkbox>
                  </el-checkbox-group>
                </div>
              </el-col>
            </el-row>
          </el-col>
          <el-col :span="11">
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox v-model="checkedLead" size="large" @change="toggleLead">全选</el-checkbox>
                  <span>【指挥中心】</span>
                </div>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox-group v-model="leadCenter" class="content">
                    <el-checkbox :value="w.stationId"
                      v-for="w in stationDistances.filter((s) => s.stationType === '指挥中心')">{{ w.stationName
                      }}</el-checkbox>
                  </el-checkbox-group>
                </div>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox v-model="checkedDirectedEnergy" size="large"
                    @change="toggleDirectedEnergy">全选</el-checkbox>
                  <span>【定向能武器】</span>
                </div>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox-group v-model="directedEnergyWeapons" class="content">
                    <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '定向能')">{{ w.name
                    }}</el-checkbox>
                  </el-checkbox-group>
                </div>
              </el-col>
            </el-row>
          </el-col>

        </el-row>
      </div>
      <div v-if="searchForm.intensity === '低烈度'">
        <el-row :gutter="5">
          <el-col :span="2">
            <div class="search-item-label">电磁武器选择：</div>
          </el-col>
          <el-col :span="22">
            <el-row>
              <el-col :span="24">
                <div class="search-item-flex">
                  <el-checkbox v-model="checkedElectronicJamming" size="large"
                    @change="toggleElectronicJamming">全选</el-checkbox>
                </div>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox-group v-model="electronicJammingWeapons" class="content">
                    <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '电子干扰')">{{ w.name
                    }}</el-checkbox>
                  </el-checkbox-group>
                </div>
              </el-col>
            </el-row>
          </el-col>
        </el-row>
        <el-row :gutter="5">
          <el-col :span="2">
            <div class="search-item-label">雷达站选择：</div>
          </el-col>
          <el-col :span="22">
            <el-row>
              <el-col :span="24">
                <div class="search-item-flex">
                  <el-checkbox v-model="checkedRadar" size="large" @change="toggleRadar">全选</el-checkbox>
                </div>
              </el-col>
            </el-row>
            <el-row>
              <el-col :span="24">
                <div class="search-item-label">
                  <el-checkbox-group v-model="radarBase" class="content">
                    <el-checkbox :label="w.stationName" :value="w.stationId"
                      v-for="w in stationDistances.filter((s) => s.stationType === '接收站')"></el-checkbox>
                  </el-checkbox-group>
                </div>
              </el-col>
            </el-row>
          </el-col>
        </el-row>
      </div>
      <div class="btn-actions">
        <el-button type="primary" round @click="generateStationPlan">生成打击方案</el-button>
        <el-button type="success" round @click="saveStationPlan">保存打击方案</el-button>
      </div>
    </form>
    <div class="strike-plan-results" v-if="highIntensityStrikePlan">
      <div class="strike-plan-header">
        <div>
          <h2>{{ strikePlanTitle }} </h2>
          <p>
            <span class="item-label">阶段名称：</span> {{ highIntensityStrikePlan.stepName }}
          </p>
          <p>
            <span class="item-label">阶段目标：</span> {{ highIntensityStrikePlan.stepTarget }}
          </p>
          <p>
            <span class="item-label">方案摘要：</span>{{ highIntensityStrikePlan.planSummary }}
          </p>
          <p>同一批输入下的不同生成策略，结果基于新打击方案接口实时填充。</p>
        </div>
        <div class="strike-plan-overview-grid">
          <div v-for="card in strikeSummaryCards" :key="card.label" class="overview-chip">
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
          </div>
        </div>
      </div>

      <div class="plan-grid">
        <article v-for="card in strikeComparisonCards" :key="card.key" class="result-section"
          :class="[`result-section--${card.accent}`]">
          <div class="result-section__header">
            <div>
              <h3>{{ card.plan.plan_name }}</h3>
              <p>{{ card.plan.plan_summary.strategy.plan_type_hint }}</p>
              <p>{{ card.plan.plan_summary.strategy.intensity_hint }}</p>
            </div>
            <span class="result-section__badge">{{ card.badge }}</span>
          </div>

          <div class="result-section__stats">
            <div class="stat-box">
              <span>输入卫星总数</span>
              <strong>{{ card.plan.plan_summary.overview.input_count }}</strong>
              <small>本次输入 targets 的总数量</small>
            </div>
            <div class="stat-box">
              <span>实际打击目标</span>
              <strong>{{ card.plan.plan_summary.overview.targets_count }}</strong>
              <small>该方案实际纳入时间窗的卫星数量</small>
            </div>
            <div class="stat-box">
              <span>输入总威胁</span>
              <strong>{{ formatDecimal(card.plan.metrics.total_score) }}</strong>
              <small>本次输入目标的威胁总和</small>
            </div>
            <div class="stat-box">
              <span>威胁削减</span>
              <strong>{{ formatDecimal(card.plan.metrics.total_threat_reduced) }}</strong>
              <small>该方案实际覆盖目标的威胁总和</small>
            </div>
          </div>

          <section class="result-block">
            <h4>方案概要</h4>

            <div class="summary-stack">
              <div class="summary-item">
                <span>时间范围</span>
                <strong>{{ card.plan.plan_summary.time_window.range }}</strong>
              </div>
              <div class="summary-item">
                <span>平均指标</span>
                <strong>
                  平均威胁 {{ formatDecimal(card.plan.plan_summary.overview.avg_threat) }} · 平均打击
                  {{ formatDecimal(card.plan.plan_summary.overview.avg_strike) }} · 调用武器
                  {{ card.plan.plan_summary.overview.assets_count }}
                </strong>
              </div>
            </div>
          </section>

          <section class="result-block">
            <h4>武器类型分布</h4>
            <div v-if="buildWeaponDistributionRows(card.plan.metrics.weapon_type_distribution).length"
              class="distribution-grid">
              <div v-for="group in buildWeaponDistributionRows(card.plan.metrics.weapon_type_distribution)"
                :key="`${card.key}-${group.weaponType}`" class="distribution-card">
                <strong>{{ group.weaponType }}</strong>
                <div class="distribution-card__items">
                  <span v-for="item in group.items" :key="item.name" class="distribution-tag">
                    {{ item.name }} × {{ item.count }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="empty-placeholder">--</div>
          </section>

          <section class="result-block">
            <h4>重点目标</h4>
            <div class="focus-list">
              <div v-for="target in card.plan.plan_summary.target_analysis" :key="`${card.key}-${target.norad_id}`"
                class="focus-item">
                <div class="focus-item__title">#{{ target.index }} NORAD {{ target.norad_id }}</div>
                <div class="focus-item__meta">
                  {{ target.satellite_country }} · {{ target.satellite_type }} · {{ target.orbit_type }} · 威胁
                  {{ formatDecimal(target.threat) }}
                </div>
              </div>
            </div>
          </section>

          <section class="result-block">
            <h4>武器配置</h4>
            <div class="asset-list">
              <div v-for="asset in card.plan.plan_summary.asset_config" :key="`${card.key}-${asset.weapon_id}`"
                class="asset-item">
                <strong>{{ asset.weapon_name }}</strong>
                <span>武器编号：{{ asset.weapon_id }} · 类型：{{ asset.weapon_type }}</span>
              </div>
            </div>
          </section>

          <section class="result-block">
            <h4>任务时间窗</h4>
            <div class="mission-list">
              <el-scrollbar v-if="card.missionPreview.length > 3" class="mission-scroll">
                <div v-for="mission in card.missionPreview"
                  :key="`${card.key}-${mission.index}-${mission.satellite_id}`" class="mission-item">
                  <div class="mission-item__header">
                    <strong>任务 {{ mission.index }} · {{ mission.weapon_name }} 打击 NORAD
                      {{ mission.satellite_id }}</strong>
                  </div>
                  <div class="mission-item__time">
                    {{ formatDateTime(mission.window_start) }} 至 {{ formatDateTime(mission.window_end) }}
                  </div>
                  <div class="mission-item__meta">
                    {{ mission.satellite_country }} · {{ mission.satellite_type }} · {{ mission.orbit_type }} · 威胁
                    {{ formatDecimal(mission.threat) }}
                  </div>
                </div>
              </el-scrollbar>
            </div>
          </section>
        </article>
      </div>
    </div>
    <div class="strike-plan-results" v-if="middleIntensityStrikePlan && middleIntensityStrikePlan.length > 0">
      <div class="plan-grid-three">
        <article v-for="item in middleIntensityPlans" :key="item.key" class="result-section"
          :class="[`result-section--${item.accent}`]">
          <div class="result-section__header">
            <div>
              <h3>{{ item.badge }}</h3>
              <p>中烈度打击策略方案</p>
              <div class="summary-header">

              </div>
              <p>
              <div class="item-title"> 阶段名称：{{ item.plan.stepName }}</div>
              <div class="item-title"> 阶段目标：{{ item.plan.stepTarget }}</div>
              <div class="item-title" v-for="(sm, key) in item.plan.planSummary"><span class="item-label">{{ key
                  }}：</span>{{ sm }}
              </div>

              </p>
            </div>
            <span class="result-section__badge">{{ item.badge }}</span>
          </div>

          <div class="result-section__stats">
            <div class="stat-box">
              <span>军事基地目标数量</span>
              <strong>{{ item.plan.targetStationNum }}</strong>
              <small>战场3000KM内的目标数</small>
            </div>
            <div class="stat-box">
              <span>实际打击数量</span>
              <strong>{{ item.plan.actualStationNum }}</strong>
              <small>实际打击基地数量</small>
            </div>
            <div class="stat-box">
              <span>最大打击度</span>
              <strong>{{ item.plan.maxStrike }}</strong>
              <small>最大打击度指标</small>
            </div>
            <div class="stat-box">
              <span>平均打击度</span>
              <strong>{{ item.plan.avgStrike }}</strong>
              <small>平均打击度指标</small>
            </div>
            <div class="stat-box" style="grid-column: span 2;">
              <span>成本消耗</span>
              <strong style="color: #ff9f43; font-size: 24px;">{{ item.plan.totalPrice }} <small
                  style="font-size: 13px; color: #ff9f43; font-weight: normal;">万美元</small></strong>
              <small>打击成本消耗金额</small>
            </div>
          </div>
          <section class="result-block" style="margin-top: 12px;">
            <h4>导弹阵地</h4>
            <div class="asset-list" style="max-height: 150px; overflow-y: auto;">
              <div class="asset-item" v-for="base in item.plan.missileBases" :key="base.missileBaseId"
                style="padding: 10px;">
                <strong style="font-size: 14px;">{{ base.missileBaseName }}</strong>
                <div style="font-size: 12px; color: #97b7d8; margin-top: 4px;">
                  地区（{{ base.country }}） · 部署导弹（
                  <span v-for="(missile, idx) in base.deployMissiles" :key="idx">
                    {{ missile.missileName }}<template v-if="idx < base.deployMissiles.length - 1">、</template>
                  </span>）
                </div>
              </div>
            </div>
          </section>

          <section class="result-block" style="margin-top: 12px;">
            <h4>军事基地目标</h4>
            <div class="asset-list" style="max-height: 150px; overflow-y: auto;">
              <div class="asset-item" v-for="station in item.plan.stationDetails" :key="station.stationId"
                style="padding: 10px;">
                <strong style="font-size: 14px;">{{ station.stationName }}</strong>
                <div style="font-size: 12px; color: #97b7d8; margin-top: 4px;">
                  地区（{{ station.country }}） · 类型（{{ station.type }}） · 位置（{{ station.location }}）
                </div>
              </div>
            </div>
          </section>

          <section class="result-block" style="margin-top: 12px;">
            <h4>武器配置</h4>
            <div class="asset-list">
              <el-collapse accordion>
                <el-collapse-item v-for="(missiles, typeKey) in item.plan.missileTypes" :key="typeKey"
                  :title="String(typeKey)">
                  <div style="display: flex; flex-direction: column; gap: 8px;">
                    <el-descriptions :column="1" border v-for="(missile, index) in missiles" :key="index" size="small"
                      style="margin-bottom: 4px;">
                      <el-descriptions-item label="名称">{{ missile.missileName }}</el-descriptions-item>
                      <el-descriptions-item label="国家/地区">{{ missile.country }}</el-descriptions-item>
                      <el-descriptions-item label="射程">{{ missile.range }}</el-descriptions-item>
                      <el-descriptions-item label="成本（万美金）">{{ missile.price }}</el-descriptions-item>
                      <el-descriptions-item label="部署方式">{{ missile.basing }}</el-descriptions-item>
                    </el-descriptions>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </section>

          <section class="result-block" style="margin-top: 12px;">
            <h4>导弹打击军事基地任务</h4>
            <div class="mission-list">
              <el-scrollbar class="mission-scroll" style="max-height: 300px;">
                <div v-for="(strike, index) in item.plan.strikeList" :key="strike.id" class="mission-item"
                  style="margin-bottom: 10px; padding: 10px;">
                  <div class="mission-item__header">
                    <strong style="font-size: 14px;">任务{{ index + 1 }} · {{ strike.missileBaseName }} → {{
                      strike.stationName
                    }}</strong>
                  </div>
                  <div class="mission-item__time" style="font-size: 12px; color: #97b7d8; margin-top: 4px;">
                    导弹：{{ strike.missileName }} ({{ strike.missileType }})
                  </div>
                  <div style="font-size: 12px; color: #8bb8ea; margin-top: 4px;">
                    打击度：{{ strike.strike }} · 距离：{{ strike.distance }} · 射程：{{ strike.range }}
                  </div>
                  <div class="mission-item__meta" style="font-size: 11px; color: #7f9dbd; margin-top: 4px;">
                    总体窗口：{{ strike.totalWindowStart }} 至 {{ strike.totalWindowEnd }}
                  </div>
                  <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">
                    <el-tag size="small" type="primary" v-for="(win, wIdx) in strike.windows" :key="wIdx">
                      {{ win.windowStart }} 至 {{ win.windowEnd }}
                    </el-tag>
                  </div>
                </div>
              </el-scrollbar>
            </div>
          </section>

          <!-- 中烈度-定向能打击窗口列表 -->
          <section class="result-block" style="margin-top: 12px;">
            <h4>定向能打击窗口</h4>
            <div class="mission-list">
              <el-scrollbar class="mission-scroll" style="max-height: 300px;">
                <div v-for="(strike, index) in item.plan.directedWindows"
                  :key="`${strike.weapon_id}-${strike.satellite_id}-${index}`" class="mission-item"
                  style="margin-bottom: 10px; padding: 10px;">
                  <div class="mission-item__header">
                    <strong style="font-size: 14px;">任务{{ strike.index || index + 1 }} · {{ strike.weapon_name }} 打击 卫星
                      {{
                        strike.satellite_id
                      }}</strong>
                  </div>
                  <div class="mission-item__time" style="font-size: 12px; color: #97b7d8; margin-top: 4px;">
                    武器类型：{{ strike.weapon_name }}
                  </div>
                  <div class="mission-item__time" style="font-size: 12px; color: #97b7d8; margin-top: 4px;">
                    卫星类型：{{ strike.satellite_type }} ({{ strike.orbit_type }})
                  </div>
                  <div style="font-size: 12px; color: #8bb8ea; margin-top: 4px;">
                    卫星国籍：{{ strike.satellite_country }} · 威胁度：{{ formatDecimal(strike.threat) }}
                  </div>
                  <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px;">
                    <el-tag size="small" type="primary">
                      打击窗口：{{ formatDateTime(strike.window_start) }} 至 {{ formatDateTime(strike.window_end) }}
                    </el-tag>
                  </div>
                </div>
              </el-scrollbar>
            </div>
          </section>
        </article>
      </div>
    </div>
    <div class="strike-plan-results" v-if="lowIntensityStrikePlan">
      <el-row>
        <el-col :span="24">
          <section class="result-block">
            <h4>低烈度方案概要</h4>
            <div class="summary-header">
              <div class="summary-item">
                <div class="item-title"><span class="item-label">阶段名称：</span> {{ lowIntensityStrikePlan.stepName }}
                </div>
                <div class="item-title"><span class="item-label">阶段目标：</span> {{ lowIntensityStrikePlan.stepTarget }}
                </div>

                <div class="item-title" v-for="(sm, key) in lowIntensityStrikePlan.planSummary"><span
                    class="item-label">{{
                      key }}：</span>{{ sm }}
                </div>
              </div>
            </div>
            <!-- <div class="summary-item">
              <div class="summary-item">
                <strong>打击完成率： 计划电磁干扰战场3000KM内的蓝方雷达接收站共{{
                  lowIntensityStrikePlan.targetStationNum
                }}个，实际干扰雷达接收站数量共{{ lowIntensityStrikePlan.actualStationNum }}个，打击完成率{{
                    lowIntensityStrikePlan.targetStationNum && lowIntensityStrikePlan.actualStationNum !== null
                      ? ((lowIntensityStrikePlan.actualStationNum / lowIntensityStrikePlan.targetStationNum) *
                        100).toFixed(0) +
                      '%'
                      : '0%'
                  }}</strong>
                <strong>打击目标分布： 共干扰打击{{ lowIntensityStrikePlan.actualStationNum }}个雷达接收站，涉及{{
                  lowIntensityStrikePlan.actualSatelliteNum
                }}颗通信卫星、{{ lowIntensityStrikePlan.actualChainNum }}个接收站与卫星的通信链路</strong>
                <strong>打击时间窗口： {{ lowIntensityStrikePlan.planWindowStart }} 至
                  {{ lowIntensityStrikePlan.planWindowEnd }}</strong>
              </div>
            </div> -->
          </section>
        </el-col>
      </el-row>
      <el-row :gutter="10">
        <el-col :span="6">
          <div class="stat-box">
            <span>雷达站目标数量</span>
            <strong>{{ lowIntensityStrikePlan.targetStationNum }}</strong>
            <small>战场3000KM内的蓝方雷达站目标数量</small>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-box">
            <span>实际干扰雷达站数量</span>
            <strong>{{ lowIntensityStrikePlan.actualStationNum }}</strong>
            <small>战场3000KM内的蓝方雷达站实际干扰数量</small>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-box">
            <span>实际干扰通信卫星数量</span>
            <strong> {{ lowIntensityStrikePlan.actualSatelliteNum }}</strong>
            <small>实际干扰的蓝方通信卫星数量</small>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-box">
            <span>实际干扰链路数量</span>
            <strong>{{ lowIntensityStrikePlan.actualChainNum }}</strong>
            <small>实际干扰的蓝方通信卫星与雷达站的通信链路数量</small>
          </div>
        </el-col>
      </el-row>
      <el-row :gutter="10">
        <el-col :span="12">
          <section class="result-block">
            <h4>电磁干扰武器阵地</h4>
            <div class="asset-list">
              <div class="asset-item" v-for="base in lowIntensityStrikePlan.elecWeapons" :key="base.id">
                <strong>{{ base.name }}</strong>
                <span style="padding-left: 20px">地区（{{ base.country }}）* 打击距离（{{ base.range }}KM） </span>
              </div>
            </div>
          </section>
        </el-col>
        <el-col :span="12">
          <section class="result-block">
            <h4>雷达站目标</h4>
            <div class="asset-list">
              <div class="asset-item" v-for="station in lowIntensityStrikePlan.stationDetails" :key="station.stationId">
                <strong>{{ station.stationName }}</strong>
                <span style="padding-left: 20px">地区({{ station.country }}) * 类型({{ station.type }}) * 位置（{{
                  station.location
                }}）</span>
              </div>
            </div>
          </section>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <section class="result-block">
            <h4>电磁干扰通信卫星传输链路任务</h4>
            <div class="mission-list">
              <el-scrollbar class="mission-scroll">
                <el-row :gutter="5" v-for="(strike, index) in lowIntensityStrikePlan.strikeList" :key="index"
                  style="overflow-x: hidden; width: 100%">
                  <el-col :span="12">
                    <div class="mission-item" style="height: 85px">
                      <div class="mission-item__header">
                        <strong>任务{{ index + 1 }} * {{ strike.weaponName }}->链路（卫星编号：{{ strike.norad }}->{{
                          strike.stationName
                        }}）</strong>
                      </div>
                      <div class="mission-item__time">打击度：{{ strike.strike }}</div>
                      <div class="mission-item__meta">
                        总体时间窗口：{{ strike.totalWindowStart }} 至 {{ strike.totalWindowEnd }}
                      </div>
                    </div>
                  </el-col>
                  <el-col :span="12">
                    <el-scrollbar>
                      <div class="mission-item-row" style="height: 85px">
                        <div v-for="(win, i) in strike.windows" :key="i">
                          <el-tag type="primary">{{ win.windowStart }} 至 {{ win.windowEnd }}</el-tag>
                        </div>
                      </div>
                    </el-scrollbar>
                  </el-col>
                </el-row>
              </el-scrollbar>
            </div>
          </section>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLayoutStore } from '@/store/modules/layout'
import { dayjs, ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import {
  type ElacStrikePlanResp,
  type MissileBaseEntity,
  missileBaseQuery,
  saveKillChainStrikePlan,
  type StationDistanceResp,
  stationQuery,
  stationStrikePlan,
  type StationStrikePlanResp,
  type StrikePlanV2,
  type StrikePlanV2Metrics,
  type StrikePlanV2MissionWindowItem,
  type StrikePlanV2PlanDetail,
} from '@/api/strikePlan/satellite-strikeplan-api.ts'
import { getTaskStageIntensityOptions, getTaskWeapons } from '@/api/dashboard'

defineOptions({
  name: 'StationReport',
})
const searchForm = ref({
  intensity: '',
  types: [] as string[],
  missileBaseId: [] as string[],
})
const store = useLayoutStore()
// 动能武器
const kineticWeapons = ref<string[]>([])
// 定向能武器
const directedEnergyWeapons = ref<string[]>([])
// 天基武器
const spaceBasedWeapons = ref<string[]>([])
// 电子干扰武器
const electronicJammingWeapons = ref<string[]>([])
const weapons = ref<Weapon[]>([])
const weaponCacheByTaskId = new Map<number, Weapon[]>()
const ourCountries = computed(() => store.activedTask?.meCountry?.split(',') || [])
const loadWeaponList = async () => {
  const taskId = store.activedTask?.id
  if (!taskId) {
    weapons.value = []
    return
  }

  const cachedWeapons = weaponCacheByTaskId.get(taskId)
  if (cachedWeapons) {
    weapons.value = [...cachedWeapons]
    return
  }

  const res = await getTaskWeapons(taskId)
  if (res.code === 200) {
    const filteredWeapons = res.data.weapons.filter((w: Weapon) => ourCountries.value.includes(w.country))
    weaponCacheByTaskId.set(taskId, filteredWeapons)
    weapons.value = [...filteredWeapons]
  }
}
watch(
  () => store.activedTask?.id,
  () => {
    loadWeaponList()
  },
  { immediate: true }
)
/**
 * 查询军事基地
 */
const stationDistanceQuery = async () => {
  const res = await stationQuery(Number(store.activedTask?.id))
  if (res.code === 200) {
    stationDistances.value = res.data
  }
}
/**
 * 查询导弹阵地
 */
const missileBaseQuerys = async () => {
  const res = await missileBaseQuery(Number(store.activedTask?.id))
  if (res.code === 200) {
    missileBaseEntity.value = res.data
  }
}

const intensityOptions = ref<string[]>([])

const loadTaskIndensity = async () => {
  const res = await getTaskStageIntensityOptions(Number(store.activedTask?.id))
  if (res.code === 200) {
    intensityOptions.value = res.data.map(s => s.intensityLevel)
    searchForm.value.intensity = intensityOptions.value[0]
  }
}
onMounted(() => {
  stationDistanceQuery()
  missileBaseQuerys()

  // 判断当前任务有几种打击烈度
  loadTaskIndensity()
})
const selectAll = (type: string) => {
  let targetArray: any
  switch (type) {
    case '动能':
      targetArray = kineticWeapons
      break
    case '定向能':
      targetArray = directedEnergyWeapons
      break
    case '天基武器':
      targetArray = spaceBasedWeapons
      break
    case '电子干扰':
      targetArray = electronicJammingWeapons
      break
  }
  const allWeapons = weapons.value.filter((w) => w.type === type).map((w) => w.name)
  targetArray.value = allWeapons
}
//雷达接收站
const radarBase = ref<string[]>([])
//数据中心
const dataCenter = ref<string[]>([])
//指挥中心
const leadCenter = ref<string[]>([])
const stationDistances = ref<StationDistanceResp[]>([])
const missileBaseEntity = ref<MissileBaseEntity[]>([])
const selectMilitaryBaseAll = (type: string) => {
  let targetArray: any
  switch (type) {
    case '接收站':
      targetArray = radarBase
      break
    case '数据中心':
      targetArray = dataCenter
      break
    case '指挥中心':
      targetArray = leadCenter
      break
  }
  const allMilitaryBases = stationDistances.value.filter((w) => w.stationType === type).map((w) => w.stationId)
  targetArray.value = allMilitaryBases
}
const clearAll = (type: string) => {
  let targetArray: any
  switch (type) {
    case '动能':
      targetArray = kineticWeapons
      break
    case '定向能':
      targetArray = directedEnergyWeapons
      break
    case '天基武器':
      targetArray = spaceBasedWeapons
      break
    case '电子干扰':
      targetArray = electronicJammingWeapons
      break
  }
  targetArray.value = []
}
const clearMilitaryBaseAll = (type: string) => {
  let targetArray: any
  switch (type) {
    case '接收站':
      targetArray = radarBase
      break
    case '数据中心':
      targetArray = dataCenter
      break
    case '指挥中心':
      targetArray = leadCenter
      break
  }
  targetArray.value = []
}
const checkedKinetic = ref(false)
const toggleKinetic = () => {
  if (checkedKinetic.value) {
    selectAll('动能')
  } else {
    clearAll('动能')
  }
}
const checkedDirectedEnergy = ref(false)
const toggleDirectedEnergy = () => {
  if (checkedDirectedEnergy.value) {
    selectAll('定向能')
  } else {
    clearAll('定向能')
  }
}
const checkedElectronicJamming = ref(false)
const toggleElectronicJamming = () => {
  if (checkedElectronicJamming.value) {
    selectAll('电子干扰')
  } else {
    clearAll('电子干扰')
  }
}
const checkedSpaceBased = ref(false)
const toggleSpaceBased = () => {
  if (checkedSpaceBased.value) {
    selectAll('天基武器')
  } else {
    clearAll('天基武器')
  }
}
const checkedRadar = ref(false)
const toggleRadar = () => {
  if (checkedRadar.value) {
    selectMilitaryBaseAll('接收站')
  } else {
    clearMilitaryBaseAll('接收站')
  }
}
const checkedDataCenter = ref(false)
const toggleDataCenter = () => {
  if (checkedDataCenter.value) {
    selectMilitaryBaseAll('数据中心')
  } else {
    clearMilitaryBaseAll('数据中心')
  }
}
const checkedLead = ref(false)
const toggleLead = () => {
  if (checkedLead.value) {
    selectMilitaryBaseAll('指挥中心')
  } else {
    clearMilitaryBaseAll('指挥中心')
  }
}
//中低烈度打击方案(饱和式打击、成本最低、突防最强)
const middleIntensityStrikePlan = ref<StationStrikePlanResp[]>([])
const sSaturationStrikePlan = computed(() => middleIntensityStrikePlan.value.find(s => s.planType === '饱和式打击'))
const lowestCostStrikePlan = computed(() => middleIntensityStrikePlan.value.find(s => s.planType === '成本最低'))
const strongestPenetrationStrikePlan = computed(() => middleIntensityStrikePlan.value.find(s => s.planType === '突防最强'))

const middleIntensityPlans = computed(() => {
  const list = []
  if (sSaturationStrikePlan.value) {
    list.push({
      key: 'saturation',
      badge: '饱和式打击',
      accent: 'saturation',
      plan: sSaturationStrikePlan.value,
    })
  }
  if (lowestCostStrikePlan.value) {
    list.push({
      key: 'lowest-cost',
      badge: '成本最低',
      accent: 'lowest-cost',
      plan: lowestCostStrikePlan.value,
    })
  }
  if (strongestPenetrationStrikePlan.value) {
    list.push({
      key: 'strongest',
      badge: '突防最强',
      accent: 'strongest',
      plan: strongestPenetrationStrikePlan.value,
    })
  }
  return list
})

//高烈度打击方案
const highIntensityStrikePlan = ref<StrikePlanV2 | null>(null)
//低烈度打击方案
const lowIntensityStrikePlan = ref<ElacStrikePlanResp | null>(null)
const formatDecimal = (value: number | undefined, digits = 2) => {
  return typeof value === 'number' ? value.toFixed(digits) : '--'
}

const formatDateTime = (value: string | undefined) => {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'
}
const normalizeStrikePlanPayload = (payload: any): StrikePlanV2 | null => {
  if (!payload || typeof payload !== 'object') return null
  if (!payload.plans || typeof payload.plans !== 'object') return null

  const normalizedPlans = Object.fromEntries(
    Object.entries(payload.plans).map(([level, plan]: [string, any]) => [
      level,
      {
        threat_first: normalizePlanDetail(plan?.threat_first),
        max_targets: normalizePlanDetail(plan?.max_targets),
      },
    ])
  )

  return {
    feasible_count: Number(payload.feasible_count ?? 0),
    max_window_duration_min: Number(payload.max_window_duration_min ?? 0),
    intensity_levels: Array.isArray(payload.intensity_levels) ? payload.intensity_levels : Object.keys(normalizedPlans),
    plans: normalizedPlans,
    stepName: payload.stepName ?? '',
    stepTarget: payload.stepTarget ?? '',
    planSummary: payload.planSummary ?? '',
  }
}
const normalizePlanDetail = (detail: any) => {
  return {
    plan_name: detail?.plan_name ?? '--',
    intensity: detail?.intensity ?? '--',
    plan_summary: normalizePlanSummary(detail?.plan_summary),
    metrics: {
      total_score: Number(detail?.metrics?.total_score ?? 0),
      total_threat_reduced: Number(detail?.metrics?.total_threat_reduced ?? 0),
      targets_count: Number(detail?.metrics?.targets_count ?? 0),
      weapon_type_distribution: detail?.metrics?.weapon_type_distribution ?? {},
      time_range: detail?.metrics?.time_range ?? '',
    },
  }
}
const normalizePlanSummary = (summary: unknown) => {
  let parsedSummary: any = summary
  if (typeof summary === 'string') {
    try {
      parsedSummary = JSON.parse(summary)
    } catch {
      parsedSummary = {}
    }
  }

  return {
    overview: {
      input_count: Number(parsedSummary?.overview?.input_count ?? 0),
      targets_count: Number(parsedSummary?.overview?.targets_count ?? 0),
      assets_count: Number(parsedSummary?.overview?.assets_count ?? 0),
      avg_threat: Number(parsedSummary?.overview?.avg_threat ?? 0),
      avg_strike: Number(parsedSummary?.overview?.avg_strike ?? 0),
    },
    target_analysis: Array.isArray(parsedSummary?.target_analysis) ? parsedSummary.target_analysis : [],
    asset_config: Array.isArray(parsedSummary?.asset_config) ? parsedSummary.asset_config : [],
    mission_windows: Array.isArray(parsedSummary?.mission_windows) ? parsedSummary.mission_windows : [],
    time_window: {
      start: parsedSummary?.time_window?.start ?? '',
      end: parsedSummary?.time_window?.end ?? '',
      range: parsedSummary?.time_window?.range ?? '',
    },
    strategy: {
      plan_type_hint: parsedSummary?.strategy?.plan_type_hint ?? '暂无策略说明',
      intensity_hint: parsedSummary?.strategy?.intensity_hint ?? '暂无烈度提示',
    },
    generated_at: parsedSummary?.generated_at ?? '',
  }
}
const strikePlanLevelEntry = computed(() => {
  if (!highIntensityStrikePlan.value) return null
  const [level, plans] = Object.entries(highIntensityStrikePlan.value.plans)[0] || []
  if (!level || !plans) return null
  return { level, plans }
})
const createPlanCard = (key: string, badge: string, accent: string, plan: StrikePlanV2PlanDetail) => ({
  key,
  badge,
  accent,
  plan,
  missionPreview: plan.plan_summary.mission_windows as StrikePlanV2MissionWindowItem[],
})
const strikeComparisonCards = computed(() => {
  const plans = strikePlanLevelEntry.value?.plans
  if (!plans) return []
  return [
    createPlanCard('threat_first', '威胁优先', 'threat', plans.threat_first),
    createPlanCard('max_targets', '数量优先', 'count', plans.max_targets),
  ]
})
const strikePlanTitle = computed(() => {
  const level = strikePlanLevelEntry.value?.level || highIntensityStrikePlan.value?.intensity_levels[0] || ''
  return level ? `${level}烈度方案对比` : '打击方案对比'
})
const strikeSummaryCards = computed(() => {
  if (!highIntensityStrikePlan.value) return []
  return [
    { label: '可行时间窗', value: `${highIntensityStrikePlan.value.feasible_count}` },
    { label: '最大窗口时长', value: `${formatDecimal(highIntensityStrikePlan.value.max_window_duration_min)} 分钟` },
    { label: '烈度层级', value: highIntensityStrikePlan.value.intensity_levels.join(' / ') || '--' },
  ]
})
const satelliteTypes = computed(() => ['导弹预警', '侦察', '通信', '导航', '太空目标监视与攻防'])
const buildWeaponDistributionRows = (distribution: StrikePlanV2Metrics['weapon_type_distribution'] | undefined) => {
  return Object.entries(distribution || {}).map(([weaponType, satelliteCounts]) => ({
    weaponType,
    items: Object.entries(satelliteCounts || {}).map(([name, count]) => ({
      name,
      count,
    })),
  }))
}
const handleRadioChange = () => {
  if (searchForm.value.intensity != '中烈度') {
    middleIntensityStrikePlan.value = []
  }
  if (searchForm.value.intensity != '低烈度') {
    lowIntensityStrikePlan.value = null
  }
  if (searchForm.value.intensity != '高烈度') {
    highIntensityStrikePlan.value = null
  }
}

const generateStationPlan = async () => {
  try {
    if (
      searchForm.value.intensity === '高烈度' &&
      kineticWeapons.value.length === 0 &&
      directedEnergyWeapons.value.length === 0 &&
      spaceBasedWeapons.value.length === 0
    ) {
      ElMessage.warning('请至少选择一种武器类型来生成打击方案')
      return
    }
    if (
      searchForm.value.intensity === '低烈度' &&
      (electronicJammingWeapons.value.length === 0 || radarBase.value.length === 0)
    ) {
      ElMessage.warning('请选择电磁武器和雷达站')
      return
    }
    if (
      searchForm.value.intensity === '中烈度' &&
      ((radarBase.value.length === 0 && dataCenter.value.length === 0 && leadCenter.value.length === 0) ||
        searchForm.value.missileBaseId.length === 0)
    ) {
      ElMessage.warning('请选择军事基地和导弹阵地')
      return
    }
    const plan = await stationStrikePlan({
      taskId: store.activedTask?.id!,
      intensityLevel: searchForm.value.intensity,
      types: searchForm.value.types,
      weaponNames: [...kineticWeapons.value, ...directedEnergyWeapons.value, ...spaceBasedWeapons.value],
      weaponType: '',
      stationIds: [...radarBase.value, ...dataCenter.value, ...leadCenter.value],
      elacWeaponNames: [...electronicJammingWeapons.value],
      radarIds: [...radarBase.value],
      missileBaseIds: searchForm.value.missileBaseId,
      directedWeaponNames: [...directedEnergyWeapons.value],
    })
    if (plan.code !== 200) {
      ElMessage.warning('生成打击方案失败，请重试！')
      return
    }

    const rawPlanData: any = plan.data
    if (searchForm.value.intensity === '中烈度') {
      middleIntensityStrikePlan.value = rawPlanData
    } else if (searchForm.value.intensity === '低烈度') {
      lowIntensityStrikePlan.value = rawPlanData
    } else {
      const responsePayload = rawPlanData?.plans ? rawPlanData : rawPlanData?.data?.plans ? rawPlanData.data : null

      const normalizedPlan = normalizeStrikePlanPayload(responsePayload)
      if (!normalizedPlan) {
        ElMessage.warning('接口已返回，但数据结构未匹配，无法渲染页面')
        highIntensityStrikePlan.value = null
        return
      }
      highIntensityStrikePlan.value = normalizedPlan
    }
    ElMessage.success('生成打击方案成功！')
  } catch (error) {
    ElMessage.error('生成打击方案失败，请重试！')
    console.log(error)
  }
}

// 保存打击方案
const saveStationPlan = async () => {
  try {
    if (searchForm.value.intensity === '中烈度' && !middleIntensityStrikePlan.value) {
      ElMessage.warning('请先生成打击方案！')
      return
    }
    if (searchForm.value.intensity === '低烈度' && !lowIntensityStrikePlan.value) {
      ElMessage.warning('请先生成打击方案！')
      return
    }
    if (searchForm.value.intensity === '高烈度' && !highIntensityStrikePlan.value) {
      ElMessage.warning('请先生成打击方案！')
      return
    }
    // 弹出框输入方案名称
    const { value: planName } = await ElMessageBox.prompt('请输入打击方案名称', '保存打击方案', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputPattern: /.+/,
      inputErrorMessage: '请输入有效的打击方案名称',
    })
    const plan = await saveKillChainStrikePlan({
      taskId: store.activedTask?.id!,
      intensityLevel: searchForm.value.intensity,
      types: searchForm.value.types,
      weaponNames: [
        ...kineticWeapons.value,
        ...directedEnergyWeapons.value,
        ...spaceBasedWeapons.value,
        ...electronicJammingWeapons.value,
      ],
      side: 'our',
      missileBaseIds: searchForm.value.missileBaseId,
      stationIds: [...radarBase.value, ...dataCenter.value, ...leadCenter.value],
      directedWeaponNames: [...directedEnergyWeapons.value],
      elacWeaponNames: [...electronicJammingWeapons.value],
      radarIds: [...radarBase.value],
      planName: planName,
      planVersion: `v${dayjs().format('YYYYMMDDHHmmss')}`,
    })
    if (plan.code !== 200) {
      ElMessage.warning('保存打击方案失败，请重试！')
      return
    }
    ElMessage.success('保存打击方案成功！')
  } catch (error) {
    ElMessage.error('保存打击方案失败，请重试！')
    console.log(error)
  }
}
</script>
<style lang="scss" scoped>
.ev-container {
  .weapon-selection {
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-radius: 6px;
    padding: 12px;
    color: #dff6ff;
    text-align: left;
    border: 1px solid rgba(143, 208, 234, 0.16);

    .search-item-flex {
      box-shadow: 0 4px 14px rgba(3, 18, 25, 0.6);
      border-radius: 6px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 10px;
    }

    .search-item-label {
      padding: 12px;
      display: flex;
      gap: 10px;
      align-items: center;
      font-size: 15px;
      font-weight: bold;
      color: #8fb9c7;
    }
  }

  .btn-actions {
    margin: 10px 0;
    display: flex;
    justify-content: left;
    gap: 10px;
    flex-wrap: wrap;
  }

  .strike-plan-results {
    margin-top: 12px;
    padding: 10px;
    border-radius: 20px;
    background: linear-gradient(180deg, rgba(10, 32, 54, 0.96), rgba(8, 24, 42, 0.98));
    border: 1px solid rgba(92, 146, 214, 0.16);
    box-shadow: 0 16px 32px rgba(2, 10, 20, 0.35);

    .strike-plan-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      margin-bottom: 18px;
      text-align: left;

      h2 {
        margin: 0;
        font-size: 24px;
        color: #f2f8ff;
      }

      p {
        margin: 8px 0 0;
        color: #8fb9e5;
        font-size: 13px;
      }
    }

    .strike-plan-overview-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(130px, 1fr));
      gap: 12px;
      min-width: 420px;
    }

    .overview-chip {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 14px 16px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(24, 64, 108, 0.9), rgba(17, 45, 79, 0.94));
      border: 1px solid rgba(107, 164, 233, 0.18);

      span {
        color: #83b8f3;
        font-size: 12px;
      }

      strong {
        color: #f4f9ff;
        font-size: 18px;
      }
    }

    .plan-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(320px, 1fr));
      gap: 18px;
    }

    .plan-grid-three {
      display: grid;
      grid-template-columns: repeat(3, minmax(300px, 1fr));
      gap: 18px;
    }

    .result-section {
      position: relative;
      border: 1px solid rgba(114, 170, 235, 0.14);
      border-radius: 0 24px 24px 0;
      padding: 18px;
      text-align: left;
      background: linear-gradient(180deg, rgba(16, 45, 82, 0.95), rgba(12, 32, 58, 0.98));
      box-shadow: 0 16px 26px rgba(4, 14, 29, 0.28);

      &::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 4px;
        border-radius: 24px 0 0 24px;
        background: linear-gradient(180deg, rgba(96, 180, 255, 0.92), rgba(46, 109, 180, 0.92));
      }

      &.result-section--count::before {
        background: linear-gradient(180deg, rgba(106, 210, 190, 0.92), rgba(37, 123, 122, 0.92));
      }

      &.result-section--saturation::before {
        background: linear-gradient(180deg, rgba(255, 123, 122, 0.92), rgba(200, 50, 50, 0.92));
      }

      &.result-section--lowest-cost::before {
        background: linear-gradient(180deg, rgba(106, 210, 190, 0.92), rgba(37, 123, 122, 0.92));
      }

      &.result-section--strongest::before {
        background: linear-gradient(180deg, rgba(235, 170, 80, 0.92), rgba(180, 110, 30, 0.92));
      }
    }

    .result-section__header {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 18px;

      h3 {
        margin: 0;
        font-size: 22px;
        color: #f6fbff;
      }

      p {
        margin: 6px 0 0;
        color: #9dbfe2;
        line-height: 1.5;
        font-size: 13px;
      }
    }

    .result-section__badge {
      align-self: flex-start;
      padding: 8px 14px;
      border-radius: 999px;
      color: #f7fbff;
      background: linear-gradient(180deg, rgba(56, 123, 196, 0.95), rgba(34, 87, 146, 0.96));
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .result-section--count .result-section__badge {
      background: linear-gradient(180deg, rgba(46, 152, 143, 0.94), rgba(31, 112, 112, 0.96));
    }

    .result-section--saturation .result-section__badge {
      background: linear-gradient(180deg, rgba(196, 56, 56, 0.95), rgba(146, 34, 34, 0.96));
    }

    .result-section--lowest-cost .result-section__badge {
      background: linear-gradient(180deg, rgba(46, 152, 143, 0.94), rgba(31, 112, 112, 0.96));
    }

    .result-section--strongest .result-section__badge {
      background: linear-gradient(180deg, rgba(196, 123, 56, 0.95), rgba(146, 87, 34, 0.96));
    }

    .result-section__stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }

    .stat-box {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(20, 55, 94, 0.96), rgba(14, 39, 69, 0.98));
      border: 1px solid rgba(107, 164, 233, 0.12);

      span {
        color: #8bb8ea;
        font-size: 12px;
      }

      strong {
        color: #ffffff;
        font-size: 30px;
        line-height: 1;
      }

      small {
        color: #7f9dbd;
        line-height: 1.5;
      }
    }

    .result-block {
      margin-top: 7px;
      padding: 10px;
      border-radius: 18px;
      background: rgba(8, 24, 42, 0.5);
      border: 1px solid rgba(95, 150, 214, 0.1);

      h4 {
        margin: 0 0 14px;
        color: #edf6ff;
        font-size: 16px;
      }
    }

    .summary-stack,
    .focus-list,
    .asset-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .mission-list {
      display: flex;
      flex-direction: column;
      width: 100%;
      gap: 12px;
      overflow-x: hidden;
    }

    .mission-scroll {
      max-height: 600px;
      overflow-y: auto;
      padding-right: 10px;

      .mission-item {
        margin-bottom: 10px;
      }
    }

    .summary-item,
    .focus-item,
    .asset-item {
      padding: 14px 16px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(20, 55, 94, 0.86), rgba(14, 39, 69, 0.9));
      border: 1px solid rgba(108, 165, 232, 0.1);
    }

    .summary-header {
      padding-bottom: 10px;

      .summary-item {
        .item-title {
          display: flex;

          .item-label {
            min-width: 100px;
          }
        }
      }

    }


    .mission-item {
      padding: 14px 16px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(20, 55, 94, 0.86), rgba(14, 39, 69, 0.9));
      border: 1px solid rgba(108, 165, 232, 0.1);
    }

    .mission-item-horizon {
      display: flex;
      flex-direction: row;
      gap: 20px;
      margin-bottom: 10px;
      padding: 14px 16px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(20, 55, 94, 0.86), rgba(14, 39, 69, 0.9));
      border: 1px solid rgba(108, 165, 232, 0.1);
    }

    .mission-item-row {
      display: grid;
      //flex-wrap: wrap; /* 允许换行 */
      grid-template-columns: repeat(4, 1fr);
      /* 四列，每列等宽 */
      margin-bottom: 10px;
      padding: 14px 16px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(20, 55, 94, 0.86), rgba(14, 39, 69, 0.9));
      border: 1px solid rgba(108, 165, 232, 0.1);
    }

    .summary-item {
      display: flex;
      text-align: left;
      flex-direction: column;
      gap: 8px;

      span {
        color: #8bb8ea;
        font-size: 12px;
      }

      strong {
        color: #f2f8ff;
        font-weight: 600;
        line-height: 1.6;
      }
    }

    .distribution-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }

    .distribution-card {
      padding: 14px 16px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(20, 55, 94, 0.86), rgba(14, 39, 69, 0.9));
      border: 1px solid rgba(108, 165, 232, 0.1);

      strong {
        display: block;
        color: #f8fbff;
        font-size: 15px;
        margin-bottom: 10px;
      }
    }

    .distribution-card__items {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .distribution-tag {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(20, 88, 154, 0.24);
      color: #d9ebff;
      border: 1px solid rgba(120, 180, 245, 0.18);
      font-size: 12px;
    }

    .empty-placeholder {
      color: #8bb8ea;
      font-size: 13px;
    }

    .focus-item__title,
    .mission-item__header strong,
    .asset-item strong {
      color: #f8fbff;
      font-size: 16px;
    }

    .focus-item__meta,
    .mission-item__time,
    .mission-item__meta,
    .asset-item span {
      margin-top: 8px;
      color: #97b7d8;
      line-height: 1.6;
      font-size: 13px;
      display: flex;
    }

    .mission-item__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
  }
}
</style>
