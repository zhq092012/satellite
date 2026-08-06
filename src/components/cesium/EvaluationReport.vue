<template>
  <div class="ev-container">
    <form class="weapon-selection" @submit.prevent>
      <!-- 顶部配置三栏网格卡片 -->
      <div class="config-top-grid">
        <div class="config-card">
          <div class="config-card-header">
            <span class="card-icon">⚡</span>
            <span class="card-title">打击烈度选择</span>
          </div>
          <div class="config-card-body">
            <el-radio-group v-model="searchForm.intensity" class="custom-radio-group">
              <el-radio value="高烈度" border>高烈度</el-radio>
              <el-radio value="中烈度" border>中烈度</el-radio>
              <el-radio value="低烈度" border>低烈度</el-radio>
            </el-radio-group>
          </div>
        </div>

        <div class="config-card">
          <div class="config-card-header">
            <span class="card-icon">🛰️</span>
            <span class="card-title">卫星分类选择</span>
          </div>
          <div class="config-card-body">
            <el-checkbox-group v-model="searchForm.types" class="custom-checkbox-group">
              <el-checkbox v-for="type in satelliteTypes" :key="type" :value="type">{{ type }}</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>

        <div class="config-card config-card-sm">
          <div class="config-card-header">
            <span class="card-icon">⚙️</span>
            <span class="card-title">评估参数版本</span>
          </div>
          <div class="config-card-body">
            <el-select v-model="searchForm.schemaVersion" placeholder="请选择" class="custom-select">
              <el-option
                v-for="schema in schemaList"
                :key="schema.version"
                :label="schema.version"
                :value="schema.version"
              ></el-option>
            </el-select>
          </div>
        </div>
      </div>

      <!-- 打击武器分类选择区 -->
      <div class="weapon-section-header">
        <span class="section-icon">🎯</span>
        <span class="section-title">打击武器配置选型</span>
      </div>

      <div class="grid-box">
        <div class="search-item">
          <div class="weapon-category-header">
            <span class="cat-title">💥 动能武器</span>
            <el-checkbox v-model="checkedKinetic" size="default" @change="toggleKinetic">全选</el-checkbox>
          </div>
          <div class="checkbox-group">
            <el-checkbox-group v-model="kineticWeapons" class="content">
              <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '动能')" :key="w.id || w.name">{{
                w.name
              }}</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>

        <div class="search-item">
          <div class="weapon-category-header">
            <span class="cat-title">⚡ 定向能武器</span>
            <el-checkbox v-model="checkedDirectedEnergy" size="default" @change="toggleDirectedEnergy">全选</el-checkbox>
          </div>
          <div class="checkbox-group">
            <el-checkbox-group v-model="directedEnergyWeapons" class="content">
              <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '定向能')" :key="w.id || w.name">{{
                w.name
              }}</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>

        <div class="search-item">
          <div class="weapon-category-header">
            <span class="cat-title">📡 电子干扰武器</span>
            <el-checkbox v-model="checkedElectronicJamming" size="default" @change="toggleElectronicJamming">全选</el-checkbox>
          </div>
          <div class="checkbox-group">
            <el-checkbox-group v-model="electronicJammingWeapons" class="content">
              <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '电子干扰')" :key="w.id || w.name">{{
                w.name
              }}</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>

        <div class="search-item">
          <div class="weapon-category-header">
            <span class="cat-title">🌌 天基武器</span>
            <el-checkbox v-model="checkedSpaceBased" size="default" @change="toggleSpaceBased">全选</el-checkbox>
          </div>
          <div class="checkbox-group">
            <el-checkbox-group v-model="spaceBasedWeapons" class="content">
              <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '天基武器')" :key="w.id || w.name">{{
                w.name
              }}</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>
      </div>

      <!-- 操作按钮区域 -->
      <div class="btn-actions">
        <button type="button" class="sci-btn btn-config" @click="drawer = !drawer">
          <span class="btn-icon">⚙️</span>
          <span>评估参数配置</span>
        </button>
        <button type="button" class="sci-btn btn-select-all" @click="selectAllWeapons">
          <span class="btn-icon">✅</span>
          <span>选择全部武器</span>
        </button>
        <button type="button" class="sci-btn btn-clear" @click="clearAllWeapons">
          <span class="btn-icon">🧹</span>
          <span>清空选择武器</span>
        </button>

        <div class="action-divider"></div>

        <button type="button" class="sci-btn btn-primary btn-glow" @click="generatePlan">
          <span class="btn-icon">🚀</span>
          <span>生成打击方案</span>
        </button>
        <button type="button" class="sci-btn btn-primary" @click="savePlan">
          <span class="btn-icon">💾</span>
          <span>保存打击方案</span>
        </button>
        <button type="button" class="sci-btn btn-accent" @click="evaluatePlan">
          <span class="btn-icon">📊</span>
          <span>生成方案评估</span>
        </button>
      </div>
    </form>

    <div class="strike-plan-results" v-if="strikePlan && !evaluateReport">
      <div class="strike-plan-header">
        <div>
          <h2>{{ strikePlanTitle }}</h2>
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
        <article
          v-for="card in strikeComparisonCards"
          :key="card.key"
          class="result-section"
          :class="[`result-section--${card.accent}`]"
        >
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
            <div
              v-if="buildWeaponDistributionRows(card.plan.metrics.weapon_type_distribution).length"
              class="distribution-grid"
            >
              <div
                v-for="group in buildWeaponDistributionRows(card.plan.metrics.weapon_type_distribution)"
                :key="`${card.key}-${group.weaponType}`"
                class="distribution-card"
              >
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
              <div
                v-for="target in card.plan.plan_summary.target_analysis"
                :key="`${card.key}-${target.norad_id}`"
                class="focus-item"
              >
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
              <div
                v-for="asset in card.plan.plan_summary.asset_config"
                :key="`${card.key}-${asset.weapon_id}`"
                class="asset-item"
              >
                <strong>{{ asset.weapon_name }}</strong>
                <span>武器编号：{{ asset.weapon_id }} · 类型：{{ asset.weapon_type }}</span>
              </div>
            </div>
          </section>

          <section class="result-block">
            <h4>任务时间窗</h4>
            <div class="mission-list">
              <el-scrollbar v-if="card.missionPreview.length > 3" class="mission-scroll">
                <div
                  v-for="mission in card.missionPreview"
                  :key="`${card.key}-${mission.index}-${mission.satellite_id}`"
                  class="mission-item"
                >
                  <div class="mission-item__header">
                    <strong
                      >任务 {{ mission.index }} · {{ mission.weapon_name }} 打击 NORAD
                      {{ mission.satellite_id }}</strong
                    >
                    <el-button type="primary" link @click="detail(mission.satellite_id)">详情</el-button>
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

    <div class="evalute-report" v-if="evaluationPlanCards.length && !strikePlan">
      <div class="report-header panel-card">
        <div>
          <span class="report-header__eyebrow">📊 方案评估报告</span>
          <h2>双方案评估对比</h2>
          <p class="report-header__desc">
            左右并排展示【威胁优先】与【数量优先】两种评估方案，便于直接对照核心指标、校验结果和分析结论。
          </p>
        </div>
      </div>

      <div class="evaluation-grid">
        <article v-for="card in evaluationPlanCards" :key="card.key" class="evaluation-card panel-card">
          <div class="evaluation-card__header">
            <div>
              <span class="evaluation-card__eyebrow">评估方案</span>
              <h3>{{ card.planName }}</h3>
              <p class="evaluation-card__meta">
                请求编号 {{ card.report.request_id }} · 版本 {{ card.report.schema_version }} · 时间
                {{ formatDateTime(card.report.timestamp) }}
              </p>
            </div>
            <div class="report-header__status">
              <span class="report-header__status-label">总体状态</span>
              <strong class="status-tag" :class="{ 'status-pass': formatOverallStatus(card.report.data.analysis.overall_status) === '通过' }">
                {{ formatOverallStatus(card.report.data.analysis.overall_status) }}
              </strong>
            </div>
          </div>

          <section class="report-section">
            <h4 class="report-section-title">⚡ 核心指标</h4>
            <div class="metric-grid metric-grid--report">
              <div class="metric-card metric-card--report">
                <span>任务支撑度 MSI</span>
                <strong>{{ card.report.data.summary.MSI }}</strong>
              </div>
              <div class="metric-card metric-card--report">
                <span>投资损伤比 DPI</span>
                <strong>{{ card.report.data.summary.DPI }}</strong>
              </div>
              <div class="metric-card metric-card--report">
                <span>任务完成度 MCI</span>
                <strong>{{ card.report.data.summary.MCI }}</strong>
              </div>
              <div class="metric-card metric-card--report">
                <span>资源效能比 RER</span>
                <strong>{{ card.report.data.summary.RER }}</strong>
              </div>
              <div class="metric-card metric-card--report">
                <span>总成本</span>
                <strong>{{ card.report.data.summary.total_cost }}</strong>
              </div>
              <div class="metric-card metric-card--report">
                <span>任务可行性</span>
                <strong class="feasible-tag" :class="{ 'feasible-yes': card.report.data.summary.is_feasible }">
                  {{ card.report.data.summary.is_feasible ? '可行' : '不可行' }}
                </strong>
              </div>
            </div>
          </section>

          <section class="report-section">
            <h4 class="report-section-title">📡 详细指标</h4>
            <div class="detail-grid">
              <div class="detail-card">
                <span class="detail-card-label">任务支撑度 D 值</span>
                <div class="indicator-chips">
                  <div class="ind-chip">
                    <span class="ind-name">通信</span>
                    <strong class="ind-val">{{ card.report.data.details.D_values.communication }}</strong>
                  </div>
                  <div class="ind-chip">
                    <span class="ind-name">空间监测</span>
                    <strong class="ind-val">{{ card.report.data.details.D_values.space_monitor }}</strong>
                  </div>
                  <div class="ind-chip">
                    <span class="ind-name">导航</span>
                    <strong class="ind-val">{{ card.report.data.details.D_values.navigation }}</strong>
                  </div>
                  <div class="ind-chip">
                    <span class="ind-name">侦察</span>
                    <strong class="ind-val">{{ card.report.data.details.D_values.reconnaissance }}</strong>
                  </div>
                  <div class="ind-chip">
                    <span class="ind-name">导弹预警</span>
                    <strong class="ind-val">{{ card.report.data.details.D_values.missile_warning }}</strong>
                  </div>
                </div>
              </div>
              <div class="detail-card">
                <span class="detail-card-label">任务完成度 T 值</span>
                <div class="indicator-chips">
                  <div class="ind-chip">
                    <span class="ind-name">通信</span>
                    <strong class="ind-val">{{ card.report.data.details.T_values.communication }}</strong>
                  </div>
                  <div class="ind-chip">
                    <span class="ind-name">空间监测</span>
                    <strong class="ind-val">{{ card.report.data.details.T_values.space_monitor }}</strong>
                  </div>
                  <div class="ind-chip">
                    <span class="ind-name">导航</span>
                    <strong class="ind-val">{{ card.report.data.details.T_values.navigation }}</strong>
                  </div>
                  <div class="ind-chip">
                    <span class="ind-name">侦察</span>
                    <strong class="ind-val">{{ card.report.data.details.T_values.reconnaissance }}</strong>
                  </div>
                  <div class="ind-chip">
                    <span class="ind-name">导弹预警</span>
                    <strong class="ind-val">{{ card.report.data.details.T_values.missile_warning }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="report-section">
            <h4 class="report-section-title">🔍 校验结果</h4>
            <div class="detail-grid">
              <div class="detail-card">
                <span class="detail-card-label">是否通过校验</span>
                <strong class="feasible-tag" :class="{ 'feasible-yes': card.report.data.validation.is_valid }">
                  {{ card.report.data.validation.is_valid ? '通过' : '不通过' }}
                </strong>
              </div>
              <div class="detail-card detail-card--list" v-if="card.report.data.validation.warnings && card.report.data.validation.warnings.length">
                <span class="detail-card-label">⚠️ 警告信息</span>
                <ul>
                  <li v-for="(w, i) in card.report.data.validation.warnings" :key="`${card.key}-w-${i}`">{{ w }}</li>
                </ul>
              </div>
              <div class="detail-card detail-card--list" v-if="card.report.data.validation.errors && card.report.data.validation.errors.length">
                <span class="detail-card-label">❌ 错误信息</span>
                <ul>
                  <li v-for="(e, i) in card.report.data.validation.errors" :key="`${card.key}-e-${i}`">{{ e }}</li>
                </ul>
              </div>
            </div>
          </section>

          <section class="report-section">
            <h4 class="report-section-title">📌 分析结论</h4>
            <div class="detail-grid">
              <div class="detail-card">
                <span class="detail-card-label">一句话总结</span>
                <strong class="summary-text">{{ card.report.data.analysis.summary }}</strong>
              </div>
              <div class="detail-card detail-card--list" v-if="card.report.data.analysis.details && card.report.data.analysis.details.length">
                <span class="detail-card-label">💡 分析细节</span>
                <ul>
                  <li v-for="(d, i) in card.report.data.analysis.details" :key="`${card.key}-ad-${i}`">{{ d }}</li>
                </ul>
              </div>
              <div class="detail-card detail-card--list" v-if="card.report.data.analysis.suggestions && card.report.data.analysis.suggestions.length">
                <span class="detail-card-label">🚀 优化建议</span>
                <ul>
                  <li v-for="(s, i) in card.report.data.analysis.suggestions" :key="`${card.key}-as-${i}`">{{ s }}</li>
                </ul>
              </div>
              <div class="detail-card detail-card--list" v-if="card.report.data.analysis.risks && card.report.data.analysis.risks.length">
                <span class="detail-card-label">⚠️ 风险提示</span>
                <ul>
                  <li v-for="(r, i) in card.report.data.analysis.risks" :key="`${card.key}-ar-${i}`">{{ r }}</li>
                </ul>
              </div>
            </div>
          </section>
        </article>
      </div>
    </div>
    <el-drawer v-model="drawer" :with-header="false" :direction="direction" :size="800" class="drawer-box">
      <div class="upload-schema">
        <el-input v-model="evaluationForm.schemaVersion" placeholder="请输入schema版本"></el-input>
        <el-button type="primary" @click="handleUploadSchema">上传</el-button>
      </div>
      <div class="schema-box">
        <div class="schema-list">
          <h3>【schema】配置列表</h3>
          <div
            v-for="schema in schemaList"
            :key="schema.version"
            :class="['schema-list-item', { selected: schemaDetailData && schemaDetailData.version === schema.version }]"
            @click="schemaDetail(schema.version)"
          >
            <div>
              <span>名称:</span><span>{{ schema.version }}</span>
            </div>
            <div>
              <span>描述:</span><span>{{ schema.description }}</span>
            </div>
            <div>
              <span>创建时间:</span><span>{{ dayjs(schema.created_at).format('YYYY-MM-DD HH:mm:ss') }}</span>
            </div>
          </div>
        </div>
        <!-- <div class="schema-detail">
          <h3>评估方案详情</h3>
          <div v-if="schemaDetailData">
            <div class="detail-header">
              <div class="detail-title">版本</div>
              <div class="detail-value">{{ schemaDetailData.version }}</div>
            </div>
            <div class="detail-header">
              <div class="detail-title">描述</div>
              <div class="detail-value">{{ schemaDetailData.description || '-' }}</div>
            </div>

            <div class="section-block">
              <div class="section-title">卫星类型</div>
              <div class="section-content">
                <div
                  v-for="[key, val] in Object.entries(schemaDetailData.satellite_types || {})"
                  :key="key"
                  class="kv-row"
                >
                  <div class="kv-key">{{ key }}</div>
                  <div class="kv-val">
                    <div class="small">
                      {{ val.name }} <span class="muted">{{ val.name_en || '' }}</span>
                    </div>
                    <div class="muted">{{ val.description || '' }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="section-block">
              <div class="section-title">武器类型</div>
              <div class="section-content">
                <div
                  v-for="[key, val] in Object.entries(schemaDetailData.weapon_types || {})"
                  :key="key"
                  class="kv-row"
                >
                  <div class="kv-key">{{ key }}</div>
                  <div class="kv-val">
                    <div class="small">
                      {{ val.name }} <span class="muted">{{ val.name_en || '' }}</span>
                    </div>
                    <div class="muted">{{ val.description || '' }}</div>
                    <div class="muted">单位：{{ val.unit || '-' }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="section-block">
              <div class="section-title">校验规则</div>
              <div class="section-content">
                <pre class="json-pre">{{ JSON.stringify(schemaDetailData.validation_rules || {}, null, 2) }}</pre>
              </div>
            </div>
          </div>
          <div v-else class="empty-placeholder">请选择上方schema版本以查看详情</div>
        </div> -->
      </div>

      <!-- 配置参数 -->
      <div class="config-params">
        <h3>参数配置</h3>

        <el-form :model="paramForm" label-width="120px" size="small">
          <el-form-item label="Schema 版本">
            <el-input v-model="paramForm.schemaVersion" placeholder="schema 版本" />
          </el-form-item>
          <div class="sub-section">
            <div class="sub-title">任务配置</div>
            <div class="stage-config-block">
              <div class="stage-config-group">
                <div class="stage-config-title">卫星体系权重</div>
                <el-row :gutter="8">
                  <el-col :span="8">
                    <el-form-item label="通信">
                      <el-input-number v-model.number="stageConfigForm.weights.communication" :min="0" :step="0.01" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="导弹预警">
                      <el-input-number v-model.number="stageConfigForm.weights.missile_warning" :min="0" :step="0.01" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="导航">
                      <el-input-number v-model.number="stageConfigForm.weights.navigation" :min="0" :step="0.01" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="侦察">
                      <el-input-number v-model.number="stageConfigForm.weights.reconnaissance" :min="0" :step="0.01" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="空间监控">
                      <el-input-number v-model.number="stageConfigForm.weights.space_monitor" :min="0" :step="0.01" />
                    </el-form-item>
                  </el-col>
                </el-row>
              </div>

              <div class="stage-config-group">
                <div class="stage-config-title">目标需求</div>
                <el-row :gutter="8">
                  <el-col :span="8">
                    <el-form-item label="通信">
                      <el-input-number
                        v-model.number="stageConfigForm.requirements.communication"
                        :min="0"
                        :step="0.01"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="导弹预警">
                      <el-input-number
                        v-model.number="stageConfigForm.requirements.missile_warning"
                        :min="0"
                        :step="0.01"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="导航">
                      <el-input-number v-model.number="stageConfigForm.requirements.navigation" :min="0" :step="0.01" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="侦察">
                      <el-input-number
                        v-model.number="stageConfigForm.requirements.reconnaissance"
                        :min="0"
                        :step="0.01"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="8">
                    <el-form-item label="空间监控">
                      <el-input-number
                        v-model.number="stageConfigForm.requirements.space_monitor"
                        :min="0"
                        :step="0.01"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
              </div>
            </div>
          </div>
          <div class="sub-section">
            <div class="sub-title">武器成本</div>
            <el-row :gutter="8">
              <el-col :span="8">
                <el-form-item label="动能">
                  <el-input-number v-model.number="paramForm.weapon_costs.kinetic" :min="0" :step="1" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="定向能">
                  <el-input-number v-model.number="paramForm.weapon_costs.directed" :min="0" :step="1" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="电子干扰">
                  <el-input-number v-model.number="paramForm.weapon_costs.jammer" :min="0" :step="1" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="天基武器">
                  <el-input-number v-model.number="paramForm.weapon_costs.space_based" :min="0" :step="1" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>

          <div class="sub-section">
            <div class="sub-title">典型伤害（按卫星类型）</div>
            <div v-for="(damage, st) in paramForm.typical_damage" :key="st">
              <div class="muted">{{ typicalDamageLabelMap[st] || st }}</div>
              <el-row :gutter="8">
                <el-col :span="8">
                  <el-form-item label="动能">
                    <el-input-number v-model.number="damage.kinetic" :min="0" :step="1" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="定向能">
                    <el-input-number v-model.number="damage.directed" :min="0" :step="1" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="电子干扰">
                    <el-input-number v-model.number="damage.jammer" :min="0" :step="1" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="天基武器">
                    <el-input-number v-model.number="damage.space_based" :min="0" :step="1" />
                  </el-form-item>
                </el-col>
              </el-row>
            </div>
          </div>

          <div class="sub-section">
            <div class="sub-title">持续时长规则（分钟）</div>
            <el-row :gutter="8">
              <el-col :span="8">
                <el-form-item label="动能">
                  <el-input-number v-model.number="paramForm.duration_rules.kinetic" :min="0" :step="1" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="定向能">
                  <el-input-number v-model.number="paramForm.duration_rules.directed" :min="0" :step="1" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="电子干扰">
                  <el-input-number v-model.number="paramForm.duration_rules.jammer" :min="0" :step="1" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="天基武器">
                  <el-input-number v-model.number="paramForm.duration_rules.space_based" :min="0" :step="1" />
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </el-form>
      </div>
      <div style="margin-top: 8px">
        <el-button type="primary" @click="handleSetParams" size="small" round>保存配置参数</el-button>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { useLayoutStore } from '@/store/modules/layout'
import { dayjs, ElMessage, ElMessageBox, type DrawerProps } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
import {
  evaluateStrikePlan,
  generateStrikePlanV2,
  getEvaluationConfig,
  getSchemaDetail,
  listSchemas,
  saveStrikePlan,
  setEvaluationParameters,
  uploadSchema,
  type EvaluationParameters,
  type EvaluationResult,
  type EvaluationResultItem,
  type Schema,
  type SchemaDetail,
  type StageConfig,
  type StrikePlanV2,
  type StrikePlanV2Metrics,
  type StrikePlanV2MissionWindowItem,
  type StrikePlanV2PlanDetail,
} from '@/api/strikePlan/satellite-strikeplan-api'
import { getTaskWeapons } from '@/api/dashboard'
import type { Weapon } from '@/types/dashboard'
defineOptions({
  name: 'EvaluationReport',
})
const store = useLayoutStore()
const { openSatelliteProfile } = useSatelliteProfileDialog()

const typicalDamageLabelMap: Record<string, string> = {
  missile_warning: '导弹预警',
  navigation: '导航',
  communication: '通信',
  reconnaissance: '侦察',
  space_monitor: '空间监测',
}

// 打击方案评估面板
const drawer = ref(false)
const direction = ref<DrawerProps['direction']>('ltr')
const detail = (norad: number) => {
  openSatelliteProfile(norad)
}

// 打击方案评估form
const evaluationForm = reactive({
  schemaVersion: '',
  parameters: {
    intensityLevel: '高烈度',
    timeWindow: '24小时',
  },
})
const handleUploadSchema = async () => {
  const res = await uploadSchema({ taskId: store.activedTask?.id!, version: evaluationForm.schemaVersion })
  if (res.code === 200) {
    ElMessage.success('上传评估方案成功！')
  } else {
    ElMessage.error('上传评估方案失败，请重试！')
  }
}
// 获取评估方案列表
const schemaList = ref<Schema[]>([])
const getSchemaList = async () => {
  const res = await listSchemas()
  if (res.code === 200) {
    schemaList.value = res.data.items
  } else {
    ElMessage.error('获取评估方案列表失败，请重试！')
  }
}
const schemaDetailData = ref<SchemaDetail | null>(null)
// 获取schema 详情
const schemaDetail = async (version: string) => {
  const res = await getSchemaDetail(version)
  if (res.code === 200) {
    console.log('评估方案详情：', res.data)
    schemaDetailData.value = res.data
    ElMessage.success('获取评估方案详情成功！')
  } else {
    ElMessage.error('获取评估方案详情失败，请重试！')
  }
}

const createDefaultStageConfig = (): StageConfig => ({
  weights: {
    communication: 0,
    missile_warning: 0,
    navigation: 0,
    reconnaissance: 0,
    space_monitor: 0,
  },
  requirements: {
    communication: 0,
    missile_warning: 0,
    navigation: 0,
    reconnaissance: 0,
    space_monitor: 0,
  },
})

const stageConfigForm = reactive<StageConfig>(createDefaultStageConfig())

const applyStageConfig = (stageConfig?: StageConfig) => {
  Object.assign(stageConfigForm.weights, createDefaultStageConfig().weights, stageConfig?.weights)
  Object.assign(stageConfigForm.requirements, createDefaultStageConfig().requirements, stageConfig?.requirements)
}

const buildStageConfig = (): StageConfig => ({
  weights: { ...stageConfigForm.weights },
  requirements: { ...stageConfigForm.requirements },
})

// 使用 reactive 初始化表单，保证嵌套字段存在并响应
const paramForm = reactive<EvaluationParameters & { task_config: StageConfig | undefined }>({
  schemaVersion: schemaDetailData.value?.version || '',
  weapon_costs: { kinetic: 0, directed: 0, jammer: 0, space_based: 0 },
  typical_damage: {
    missile_warning: { kinetic: 0, directed: 0, jammer: 0, space_based: 0 },
    navigation: { kinetic: 0, directed: 0, jammer: 0, space_based: 0 },
    communication: { kinetic: 0, directed: 0, jammer: 0, space_based: 0 },
    reconnaissance: { kinetic: 0, directed: 0, jammer: 0, space_based: 0 },
    space_monitor: { kinetic: 0, directed: 0, jammer: 0, space_based: 0 },
  },
  duration_rules: { kinetic: 0, jammer: 0, directed: 0, space_based: 0 },
  task_config: undefined,
})

// 当选中 schema 时，自动填充 schemaVersion 和默认 stage_config（如果有）
watch(schemaDetailData, async (val) => {
  paramForm.schemaVersion = val?.version || ''
  if (paramForm.schemaVersion) {
    const res = await getEvaluationConfig(paramForm.schemaVersion)
    if (res.code === 200) {
      // 根据返回data 填充整个paramForm
      paramForm.weapon_costs = res.data.weapon_costs
      paramForm.typical_damage = res.data.typical_damage
      paramForm.duration_rules = res.data.duration_rules
      paramForm.task_config = res.data.task_config
      applyStageConfig(paramForm.task_config)
    } else {
      ElMessage.error('获取评估配置失败，请重试！')
    }
  } else {
    ElMessage.warning('当前选中的评估方案没有版本信息，无法加载默认阶段配置')
  }
})
// 保存配置参数
const handleSetParams = async () => {
  try {
    paramForm.task_config = buildStageConfig()
    const res = await setEvaluationParameters(paramForm as EvaluationParameters)
    if (res.code === 200) {
      ElMessage.success('配置评估参数成功！')
    } else {
      ElMessage.error('配置评估参数失败，请重试！')
    }
  } catch (err) {
    ElMessage.error('提交失败，请稍后重试')
    console.error(err)
  }
}

const evaluateReport = ref<EvaluationResult | null>(null)

const evaluationPlanCards = computed(() => {
  if (!evaluateReport.value) return []

  const orderedKeys = ['威胁优先', '数量优先']
  const orderedEntries: Array<[string, EvaluationResultItem]> = orderedKeys
    .map((key) => [key, evaluateReport.value?.[key]] as [string, EvaluationResultItem | undefined])
    .filter((entry): entry is [string, EvaluationResultItem] => Boolean(entry[1]))

  const extraEntries = Object.entries(evaluateReport.value).filter(([key]) => !orderedKeys.includes(key)) as Array<
    [string, EvaluationResultItem]
  >

  return [...orderedEntries, ...extraEntries].map(([planName, report], index) => ({
    key: `${planName}-${index}`,
    planName,
    report,
  }))
})
// 评估当前打击方案
const evaluatePlan = async () => {
  if (searchForm.value.schemaVersion === '') {
    ElMessage.warning('请先选择评估方案版本！')
    return
  }
  const res = await evaluateStrikePlan({
    taskId: store.activedTask?.id!,
    intensityLevel: searchForm.value.intensity,
    weaponNames: [
      ...kineticWeapons.value,
      ...directedEnergyWeapons.value,
      ...electronicJammingWeapons.value,
      ...spaceBasedWeapons.value,
    ],
    schemaVersion: searchForm.value.schemaVersion,
  })
  if (res.code === 200) {
    evaluateReport.value = res.data
    strikePlan.value = null
    ElMessage.success('评估打击方案成功！')
  } else {
    ElMessage.error('评估打击方案失败，请重试！')
  }
}

const searchForm = ref({
  intensity: '高烈度',
  stage: store.activedTask?.steps ? JSON.parse(store.activedTask.steps)[0]?.name : '',
  schemaVersion: '',
  types: [] as string[],
})

/**
 * 保存打击方案（弹出框输入方案名称，生成版本号）
 */
const savePlan = async () => {
  if (!strikePlan.value) {
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
  const res = await saveStrikePlan({
    taskId: store.activedTask?.id!,
    intensityLevel: searchForm.value.intensity,
    types: searchForm.value.types,
    weaponNames: [
      ...kineticWeapons.value,
      ...directedEnergyWeapons.value,
      ...electronicJammingWeapons.value,
      ...spaceBasedWeapons.value,
    ],
    planName: planName,
    planVersion: `v${dayjs().format('YYYYMMDDHHmmss')}`,
    side: 'our',
  })
  if (res.code === 200) {
    strikePlan.value = res.data
    ElMessage.success('保存打击方案成功！')
  } else {
    ElMessage.error('保存打击方案失败，请重试！')
  }
}

const strikePlan = ref<StrikePlanV2 | null>(null)
// 动能武器
const kineticWeapons = ref<string[]>([])
// 定向能武器
const directedEnergyWeapons = ref<string[]>([])
// 电子干扰武器
const electronicJammingWeapons = ref<string[]>([])
// 天基武器
const spaceBasedWeapons = ref<string[]>([])
const checkedKinetic = ref(false)
const toggleKinetic = () => {
  if (checkedKinetic.value) {
    selectAll('动能')
  } else {
    clearAll('动能')
  }
}
const satelliteTypes = computed(() => ['导弹预警', '侦察', '通信', '导航', '太空目标监视与攻防'])
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
const selectAll = (type: string) => {
  let targetArray: any
  switch (type) {
    case '动能':
      targetArray = kineticWeapons
      break
    case '定向能':
      targetArray = directedEnergyWeapons
      break
    case '电子干扰':
      targetArray = electronicJammingWeapons
      break
    case '天基武器':
      targetArray = spaceBasedWeapons
      break
  }
  const allWeapons = weapons.value.filter((w) => w.type === type).map((w) => w.name)
  targetArray.value = allWeapons
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
    case '电子干扰':
      targetArray = electronicJammingWeapons
      break
    case '天基武器':
      targetArray = spaceBasedWeapons
      break
  }
  targetArray.value = []
}

const weaponCacheByTaskId = new Map<number, Weapon[]>()

// 我方国家
const ourCountries = computed(() => store.activedTask?.meCountry?.split(',') || [])
const weapons = ref<Weapon[]>([])
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

const selectAllWeapons = () => {
  checkedKinetic.value = true
  checkedDirectedEnergy.value = true
  checkedElectronicJamming.value = true
  checkedSpaceBased.value = true
  kineticWeapons.value = weapons.value.filter((w) => w.type === '动能').map((w) => w.name)
  directedEnergyWeapons.value = weapons.value.filter((w) => w.type === '定向能').map((w) => w.name)
  electronicJammingWeapons.value = weapons.value.filter((w) => w.type === '电子干扰').map((w) => w.name)
  spaceBasedWeapons.value = weapons.value.filter((w) => w.type === '天基武器').map((w) => w.name)
}
const clearAllWeapons = () => {
  checkedKinetic.value = false
  checkedDirectedEnergy.value = false
  checkedElectronicJamming.value = false
  checkedSpaceBased.value = false
  kineticWeapons.value = []
  directedEnergyWeapons.value = []
  electronicJammingWeapons.value = []
  spaceBasedWeapons.value = []
}

const formatDecimal = (value: number | undefined, digits = 2) => {
  return typeof value === 'number' ? value.toFixed(digits) : '--'
}

const formatDateTime = (value: string | undefined) => {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'
}

const formatOverallStatus = (status: string | undefined) => {
  const statusMap: Record<string, string> = {
    over_complete: '超额完成',
    fully_satisfied: '完全满足需求',
    not_satisfied: '未满足需求',
    FAIL: '未达标',
    PASS: '通过',
    SUCCESS: '通过',
    OK: '通过',
    超额完成: '超额完成',
    完全满足需求: '完全满足需求',
    未满足需求: '未满足需求',
    未达标: '未达标',
    通过: '通过',
  }

  return (status && statusMap[status]) || status || '--'
}

const buildWeaponDistributionRows = (distribution: StrikePlanV2Metrics['weapon_type_distribution'] | undefined) => {
  return Object.entries(distribution || {}).map(([weaponType, satelliteCounts]) => ({
    weaponType,
    items: Object.entries(satelliteCounts || {}).map(([name, count]) => ({
      name,
      count,
    })),
  }))
}

const strikePlanLevelEntry = computed(() => {
  if (!strikePlan.value) return null
  const [level, plans] = Object.entries(strikePlan.value.plans)[0] || []
  if (!level || !plans) return null
  return { level, plans }
})

const strikePlanTitle = computed(() => {
  const level = strikePlanLevelEntry.value?.level || strikePlan.value?.intensity_levels[0] || ''
  return level ? `${level}烈度方案对比` : '打击方案对比'
})

const strikeSummaryCards = computed(() => {
  if (!strikePlan.value) return []
  return [
    { label: '可行时间窗', value: `${strikePlan.value.feasible_count}` },
    { label: '最大窗口时长', value: `${formatDecimal(strikePlan.value.max_window_duration_min)} 分钟` },
    { label: '烈度层级', value: strikePlan.value.intensity_levels.join(' / ') || '--' },
  ]
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
    planSummary: '',
    stepName: '',
    stepTarget: '',
  }
}

const generatePlan = async () => {
  try {
    if (
      kineticWeapons.value.length === 0 &&
      directedEnergyWeapons.value.length === 0 &&
      electronicJammingWeapons.value.length === 0 &&
      spaceBasedWeapons.value.length === 0
    ) {
      ElMessage.warning('请至少选择一种武器类型来生成打击方案')
      return
    }
    const plan = await generateStrikePlanV2({
      taskId: store.activedTask?.id!,
      intensityLevel: searchForm.value.intensity,
      types: searchForm.value.types,
      weaponNames: [
        ...kineticWeapons.value,
        ...directedEnergyWeapons.value,
        ...electronicJammingWeapons.value,
        ...spaceBasedWeapons.value,
      ],
    })
    if (plan.code !== 200) {
      ElMessage.warning('生成打击方案失败，请重试！')
      return
    }

    const rawPlanData: any = plan.data
    const responsePayload = rawPlanData?.plans ? rawPlanData : rawPlanData?.data?.plans ? rawPlanData.data : null

    const normalizedPlan = normalizeStrikePlanPayload(responsePayload)
    if (!normalizedPlan) {
      ElMessage.warning('接口已返回，但数据结构未匹配，无法渲染页面')
      strikePlan.value = null
      return
    }

    strikePlan.value = normalizedPlan
    evaluateReport.value = null // 切换方案时重置评估报告
    ElMessage.success('生成打击方案成功！')
  } catch (error) {
    ElMessage.error('生成打击方案失败，请重试！')
    console.log(error)
  }
}

onMounted(() => {
  getSchemaList()
})

watch(
  () => store.activedTask?.id,
  () => {
    clearAllWeapons()
    loadWeaponList()
  },
  { immediate: true }
)

watch(drawer, (open) => {
  if (open) {
    console.log('paramForm current:', JSON.parse(JSON.stringify(paramForm)))
    if (schemaDetailData.value && schemaDetailData.value.version) {
      paramForm.schemaVersion = schemaDetailData.value.version
      if (!paramForm.task_config || Object.keys(paramForm.task_config).length === 0) {
        paramForm.task_config = createDefaultStageConfig()
        applyStageConfig(paramForm.task_config)
      } else {
        applyStageConfig(paramForm.task_config)
      }
    }
  }
})
</script>

<style lang="scss" scoped>
.ev-container {
  .weapon-selection {
    display: flex;
    flex-direction: column;
    gap: 16px;
    border-radius: 12px;
    padding: 20px;
    background: linear-gradient(180deg, rgba(8, 20, 38, 0.85) 0%, rgba(12, 28, 52, 0.9) 100%);
    border: 1px solid rgba(0, 225, 255, 0.22);
    box-shadow:
      0 12px 32px rgba(0, 0, 0, 0.4),
      inset 0 0 20px rgba(0, 225, 255, 0.04);
    color: #dff6ff;
    text-align: left;
    backdrop-filter: blur(12px);

    /* 顶部 3 卡片配置网格 */
    .config-top-grid {
      display: grid;
      grid-template-columns: 1fr 1.6fr 0.8fr;
      gap: 14px;
    }

    .config-card {
      background: rgba(13, 27, 49, 0.7);
      border: 1px solid rgba(0, 225, 255, 0.18);
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: inset 0 0 10px rgba(0, 225, 255, 0.03);

      .config-card-header {
        display: flex;
        align-items: center;
        gap: 8px;

        .card-icon {
          font-size: 14px;
        }

        .card-title {
          font-size: 13px;
          font-weight: 700;
          color: #00e1ff;
          letter-spacing: 0.5px;
        }
      }

      .config-card-body {
        display: flex;
        align-items: center;
      }
    }

    /* 武器分类选型 Header */
    .weapon-section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 4px;
      border-top: 1px dashed rgba(0, 225, 255, 0.15);

      .section-icon {
        font-size: 16px;
      }

      .section-title {
        font-size: 14px;
        font-weight: 700;
        color: #00e1ff;
        letter-spacing: 0.5px;
      }
    }

    .grid-box {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;

      .search-item {
        display: flex;
        flex-direction: column;
        background: rgba(10, 22, 40, 0.65);
        border: 1px solid rgba(0, 225, 255, 0.15);
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 4px 14px rgba(3, 18, 25, 0.4);
        transition: border-color 0.25s ease;

        &:hover {
          border-color: rgba(0, 225, 255, 0.35);
        }

        .weapon-category-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 10px;
          margin-bottom: 10px;
          border-bottom: 1px solid rgba(0, 225, 255, 0.12);

          .cat-title {
            font-size: 13px;
            font-weight: 700;
            color: #f1f7ff;
          }
        }

        .checkbox-group {
          display: flex;

          .content {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
        }
      }
    }

    /* 按钮组 */
    .btn-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      padding-top: 10px;
      border-top: 1px solid rgba(0, 225, 255, 0.15);

      .action-divider {
        width: 1px;
        height: 28px;
        background: rgba(0, 225, 255, 0.25);
        margin: 0 6px;
      }

      .sci-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.25s ease;
        border: 1px solid transparent;
        user-select: none;

        .btn-icon {
          font-size: 14px;
        }

        &.btn-config {
          background: rgba(15, 38, 68, 0.8);
          border-color: rgba(0, 225, 255, 0.3);
          color: #38bdf8;

          &:hover {
            background: rgba(0, 225, 255, 0.2);
            color: #ffffff;
            box-shadow: 0 0 10px rgba(0, 225, 255, 0.3);
          }
        }

        &.btn-select-all {
          background: rgba(16, 185, 129, 0.18);
          border-color: rgba(16, 185, 129, 0.4);
          color: #34d399;

          &:hover {
            background: rgba(16, 185, 129, 0.35);
            color: #ffffff;
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
          }
        }

        &.btn-clear {
          background: rgba(239, 68, 68, 0.18);
          border-color: rgba(239, 68, 68, 0.4);
          color: #f87171;

          &:hover {
            background: rgba(239, 68, 68, 0.35);
            color: #ffffff;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);
          }
        }

        &.btn-primary {
          background: linear-gradient(135deg, rgba(0, 102, 255, 0.6), rgba(0, 225, 255, 0.4));
          border-color: rgba(0, 225, 255, 0.5);
          color: #ffffff;

          &:hover {
            background: linear-gradient(135deg, rgba(0, 102, 255, 0.8), rgba(0, 225, 255, 0.6));
            box-shadow: 0 0 14px rgba(0, 225, 255, 0.5);
          }
        }

        &.btn-accent {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.6), rgba(236, 72, 153, 0.5));
          border-color: rgba(216, 180, 254, 0.5);
          color: #ffffff;

          &:hover {
            background: linear-gradient(135deg, rgba(168, 85, 247, 0.8), rgba(236, 72, 153, 0.7));
            box-shadow: 0 0 14px rgba(216, 180, 254, 0.5);
          }
        }

        &.btn-glow {
          box-shadow: 0 0 12px rgba(0, 225, 255, 0.3);
        }
      }
    }
  }

  /* Element Plus 内部样式覆盖 */
  :deep(.custom-radio-group) {
    .el-radio {
      background: rgba(8, 18, 33, 0.6);
      border-color: rgba(0, 225, 255, 0.2);
      color: #94a3b8;
      border-radius: 4px;
      margin-right: 8px;

      &.is-checked {
        background: rgba(0, 225, 255, 0.15);
        border-color: #00e1ff;
        .el-radio__label {
          color: #00e1ff;
          font-weight: 600;
        }
      }
    }
  }

  :deep(.custom-checkbox-group) {
    .el-checkbox {
      color: #94a3b8;
      margin-right: 12px;
      &.is-checked .el-checkbox__label {
        color: #00e1ff;
        font-weight: 600;
      }
    }
  }

  :deep(.el-checkbox) {
    color: #cbd5e1;
    .el-checkbox__inner {
      background-color: rgba(15, 30, 52, 0.8);
      border-color: rgba(0, 225, 255, 0.3);
    }
    &.is-checked .el-checkbox__inner {
      background-color: #00e1ff;
      border-color: #00e1ff;
    }
    &.is-checked .el-checkbox__label {
      color: #38bdf8;
    }
  }

  :deep(.custom-select) {
    .el-input__wrapper {
      background-color: rgba(8, 18, 33, 0.8) !important;
      border-color: rgba(0, 225, 255, 0.2) !important;
      box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.2) inset !important;
      border-radius: 4px;
    }
    .el-input__inner {
      color: #00e1ff !important;
      font-weight: 600;
    }
  }

  .strike-plan-results {
    margin-top: 20px;
    padding: 22px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(8, 20, 38, 0.9) 0%, rgba(12, 28, 52, 0.95) 100%);
    border: 1px solid rgba(0, 225, 255, 0.22);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(12px);

    .strike-plan-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      margin-bottom: 20px;
      text-align: left;
      border-bottom: 1px dashed rgba(0, 225, 255, 0.15);
      padding-bottom: 14px;

      h2 {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        color: #f1f7ff;
        letter-spacing: 0.5px;
      }

      p {
        margin: 6px 0 0;
        color: #94a3b8;
        font-size: 13px;
      }
    }

    .strike-plan-overview-grid {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .overview-chip {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 16px;
      border-radius: 8px;
      background: rgba(13, 27, 49, 0.8);
      border: 1px solid rgba(0, 225, 255, 0.25);
      box-shadow: inset 0 0 10px rgba(0, 225, 255, 0.05);

      span {
        color: #94a3b8;
        font-size: 11px;
      }

      strong {
        color: #00e1ff;
        font-size: 18px;
        font-weight: 700;
        text-shadow: 0 0 8px rgba(0, 225, 255, 0.4);
      }
    }

    .plan-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(320px, 1fr));
      gap: 20px;
    }

    .result-section {
      position: relative;
      border: 1px solid rgba(0, 225, 255, 0.2);
      border-radius: 12px;
      padding: 20px;
      text-align: left;
      background: linear-gradient(180deg, rgba(10, 24, 46, 0.9) 0%, rgba(7, 18, 36, 0.95) 100%);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);

      &::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 4px;
        border-radius: 12px 0 0 12px;
        background: linear-gradient(180deg, #00e1ff 0%, #0066ff 100%);
      }

      &.result-section--count::before {
        background: linear-gradient(180deg, #10b981 0%, #059669 100%);
      }
    }

    .result-section__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 18px;
      border-bottom: 1px solid rgba(0, 225, 255, 0.12);
      padding-bottom: 12px;

      h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 700;
        color: #ffffff;
      }

      p {
        margin: 4px 0 0;
        color: #94a3b8;
        line-height: 1.5;
        font-size: 12px;
      }
    }

    .result-section__badge {
      align-self: flex-start;
      padding: 5px 14px;
      border-radius: 6px;
      color: #ffffff;
      background: linear-gradient(135deg, rgba(0, 102, 255, 0.4), rgba(0, 225, 255, 0.3));
      border: 1px solid rgba(0, 225, 255, 0.4);
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 0 10px rgba(0, 225, 255, 0.2);
    }

    .result-section--count .result-section__badge {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(52, 211, 153, 0.3));
      border-color: rgba(52, 211, 153, 0.4);
      box-shadow: 0 0 10px rgba(52, 211, 153, 0.2);
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
      gap: 6px;
      padding: 14px 16px;
      border-radius: 8px;
      background: rgba(13, 27, 49, 0.75);
      border: 1px solid rgba(0, 225, 255, 0.15);

      span {
        color: #94a3b8;
        font-size: 12px;
      }

      strong {
        color: #00e1ff;
        font-size: 28px;
        font-weight: 700;
        line-height: 1;
        text-shadow: 0 0 8px rgba(0, 225, 255, 0.35);
      }

      small {
        color: #64748b;
        font-size: 11px;
        line-height: 1.4;
      }
    }

    .result-block {
      margin-top: 14px;
      padding: 14px 16px;
      border-radius: 8px;
      background: rgba(10, 22, 40, 0.6);
      border: 1px solid rgba(0, 225, 255, 0.12);

      h4 {
        margin: 0 0 12px;
        color: #38bdf8;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.3px;
      }
    }

    .summary-stack,
    .focus-list,
    .asset-list,
    .mission-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .mission-scroll {
      max-height: 500px;
      overflow-y: auto;
      padding-right: 6px;

      .mission-item {
        margin-bottom: 10px;
      }
    }

    .summary-item,
    .focus-item,
    .asset-item,
    .mission-item {
      padding: 12px 14px;
      border-radius: 6px;
      background: rgba(13, 27, 49, 0.8);
      border: 1px solid rgba(0, 225, 255, 0.12);
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 6px;

      span {
        color: #94a3b8;
        font-size: 12px;
      }

      strong {
        color: #f1f7ff;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.6;
      }
    }

    .distribution-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
    }

    .distribution-card {
      padding: 12px 14px;
      border-radius: 6px;
      background: rgba(13, 27, 49, 0.8);
      border: 1px solid rgba(0, 225, 255, 0.12);

      strong {
        display: block;
        color: #f1f7ff;
        font-size: 13px;
        margin-bottom: 8px;
      }
    }

    .distribution-card__items {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .distribution-tag {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(0, 225, 255, 0.12);
      color: #7dd3fc;
      border: 1px solid rgba(0, 225, 255, 0.25);
      font-size: 12px;
    }

    .empty-placeholder {
      color: #64748b;
      font-size: 12px;
    }

    .focus-item__title,
    .mission-item__header strong,
    .asset-item strong {
      color: #f8fafc;
      font-size: 14px;
      font-weight: 600;
    }

    .focus-item__meta,
    .mission-item__time,
    .mission-item__meta,
    .asset-item span {
      margin-top: 6px;
      color: #94a3b8;
      line-height: 1.6;
      font-size: 12px;
    }

    .mission-item__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
  }

  /* 抽屉/参数配置面板 (.drawer-box & .config-params) 美化 */
  .drawer-box {
    :deep(.el-drawer) {
      background: linear-gradient(180deg, #08162a 0%, #0a1f38 100%) !important;
      color: #e2e8f0;
      border-left: 1px solid rgba(0, 225, 255, 0.25);
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.6);
    }

    :deep(.el-drawer__body) {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
    }

    .upload-schema {
      display: flex;
      gap: 10px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0, 225, 255, 0.15);

      :deep(.el-input__wrapper) {
        background-color: rgba(8, 18, 33, 0.8) !important;
        border-color: rgba(0, 225, 255, 0.2) !important;
        box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.2) inset !important;
      }

      :deep(.el-button) {
        background: linear-gradient(135deg, rgba(0, 102, 255, 0.6), rgba(0, 225, 255, 0.4)) !important;
        border-color: rgba(0, 225, 255, 0.5) !important;
        color: #ffffff !important;
      }
    }

    .schema-box {
      margin-bottom: 12px;

      .schema-list {
        border: 1px solid rgba(0, 225, 255, 0.2);
        border-radius: 8px;
        max-height: 240px;
        background: rgba(8, 18, 33, 0.7);
        padding: 12px;
        text-align: left;

        h3 {
          margin: 0 0 10px;
          font-size: 14px;
          color: #00e1ff;
        }

        .schema-list-item {
          display: block;
          padding: 10px;
          margin-bottom: 6px;
          cursor: pointer;
          border-radius: 6px;
          color: #cbd5e1;
          font-size: 13px;
          background: rgba(15, 30, 52, 0.5);
          border: 1px solid rgba(0, 225, 255, 0.1);
          transition: all 0.2s ease;

          &:hover {
            border-color: rgba(0, 225, 255, 0.3);
            background: rgba(0, 225, 255, 0.1);
          }

          &.selected {
            background: linear-gradient(135deg, rgba(0, 102, 255, 0.4), rgba(0, 225, 255, 0.25)) !important;
            border-color: #00e1ff !important;
            color: #ffffff !important;
            box-shadow: 0 0 10px rgba(0, 225, 255, 0.25);
          }
        }
      }
    }
  }

  .config-params {
    border: 1px solid rgba(0, 225, 255, 0.2);
    border-radius: 8px;
    padding: 16px;
    background: rgba(8, 18, 33, 0.85);
    color: #e2e8f0;
    box-shadow: inset 0 0 15px rgba(0, 225, 255, 0.03);
    text-align: left;

    h3 {
      margin: 0 0 14px;
      font-size: 16px;
      color: #00e1ff;
      border-bottom: 1px solid rgba(0, 225, 255, 0.15);
      padding-bottom: 8px;
    }

    .sub-section {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px dashed rgba(0, 225, 255, 0.12);
    }

    .sub-title {
      color: #38bdf8;
      font-weight: 700;
      font-size: 13px;
      margin-bottom: 10px;
    }

    :deep(.el-form-item__label) {
      color: #94a3b8 !important;
    }

    :deep(.el-input-number) {
      width: 100%;
      .el-input__wrapper {
        background-color: rgba(13, 27, 49, 0.8) !important;
        border-color: rgba(0, 225, 255, 0.2) !important;
        box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.2) inset !important;
      }
      .el-input__inner {
        color: #00e1ff !important;
      }
    }
  }
}

@media (max-width: 1200px) {
  .ev-container {
    .weapon-selection {
      .grid-box {
        grid-template-columns: 1fr;
      }
    }

    .strike-plan-results {
      .strike-plan-header {
        flex-direction: column;
      }

      .strike-plan-overview-grid,
      .plan-grid,
      .result-section__stats {
        grid-template-columns: 1fr;
        min-width: 0;
      }
    }
  }
}
</style>

<style scoped>
.evalute-report {
  padding: 22px;
  margin-top: 20px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(8, 20, 38, 0.95) 0%, rgba(12, 28, 52, 0.98) 100%);
  border: 1px solid rgba(0, 225, 255, 0.22);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  text-align: left;

  h2 {
    margin: 0;
    color: #f1f7ff;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
}

.report-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-radius: 10px;
  background: rgba(13, 27, 49, 0.7);
  border: 1px solid rgba(0, 225, 255, 0.18);
  margin-top: 10px;
}

.report-header__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 8px;
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(0, 225, 255, 0.15);
  color: #00e1ff;
  border: 1px solid rgba(0, 225, 255, 0.3);
  font-size: 12px;
  font-weight: 600;
}

.report-header__desc {
  margin: 8px 0 0;
  color: #94a3b8;
  line-height: 1.6;
  font-size: 13px;
}

.report-header__status {
  min-width: 140px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(10, 22, 40, 0.8);
  border: 1px solid rgba(0, 225, 255, 0.2);
  text-align: center;
}

.report-header__status-label {
  display: block;
  margin-bottom: 6px;
  color: #94a3b8;
  font-size: 11px;
}

.status-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 700;
  color: #38bdf8;
  background: rgba(0, 225, 255, 0.15);
  border: 1px solid rgba(0, 225, 255, 0.3);

  &.status-pass {
    color: #34d399;
    background: rgba(16, 185, 129, 0.18);
    border-color: rgba(16, 185, 129, 0.4);
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
  }
}

.evaluation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-top: 18px;
}

.evaluation-card {
  padding: 20px;
  background: linear-gradient(180deg, rgba(10, 24, 46, 0.9) 0%, rgba(7, 18, 36, 0.95) 100%);
  border: 1px solid rgba(0, 225, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
}

.evaluation-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.12);
  padding-bottom: 12px;
}

.evaluation-card__eyebrow {
  display: inline-flex;
  margin: 0 0 6px;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(0, 225, 255, 0.12);
  color: #38bdf8;
  font-size: 11px;
  font-weight: 600;
}

.evaluation-card__header h3 {
  margin: 4px 0 0;
  color: #ffffff;
  font-size: 20px;
  font-weight: 700;
}

.evaluation-card__meta {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.evalute-report .report-section {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(10, 22, 40, 0.65);
  border: 1px solid rgba(0, 225, 255, 0.12);
}

.report-section-title {
  margin: 0 0 12px;
  color: #00e1ff;
  font-size: 14px;
  font-weight: 700;
  border-bottom: 1px dashed rgba(0, 225, 255, 0.15);
  padding-bottom: 6px;
  letter-spacing: 0.3px;
}

.metric-grid--report {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.metric-card--report {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(13, 27, 49, 0.8);
  border: 1px solid rgba(0, 225, 255, 0.15);

  span {
    color: #94a3b8;
    font-size: 11px;
  }

  strong {
    color: #00e1ff;
    font-size: 22px;
    font-weight: 700;
    text-shadow: 0 0 8px rgba(0, 225, 255, 0.35);
  }
}

.feasible-tag {
  color: #f87171 !important;
  font-size: 16px !important;

  &.feasible-yes {
    color: #34d399 !important;
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.detail-card {
  padding: 12px 14px;
  border-radius: 6px;
  background: rgba(13, 27, 49, 0.8);
  border: 1px solid rgba(0, 225, 255, 0.12);
}

.detail-card-label {
  display: block;
  margin-bottom: 8px;
  color: #38bdf8;
  font-size: 12px;
  font-weight: 600;
}

.indicator-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ind-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: rgba(8, 18, 33, 0.7);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 4px;

  .ind-name {
    color: #94a3b8;
    font-size: 12px;
  }

  .ind-val {
    color: #00e1ff;
    font-weight: 700;
    font-size: 13px;
  }
}

.summary-text {
  color: #f1f7ff;
  font-size: 13px;
  line-height: 1.6;
  font-weight: 500;
}

.detail-card--list ul {
  margin: 0;
  padding-left: 16px;
  color: #cbd5e1;
  line-height: 1.7;
  font-size: 12px;

  li {
    margin-bottom: 4px;
  }
}

.evalute-report ul {
  list-style: square;
  margin: 0;
}

@media (max-width: 1200px) {
  .report-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .evaluation-grid,
  .detail-grid,
  .metric-grid--report {
    grid-template-columns: 1fr;
  }
}

.schema-list {
  overflow: auto;
  margin-bottom: 10px;
}

.schema-list-item.selected {
  background: linear-gradient(90deg, #154d64, #0a4474);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 14px rgba(3, 18, 25, 0.6);
}

.schema-detail {
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 12px;
  background: linear-gradient(180deg, #071a2a, #031216);
  color: #dff6ff;
  text-align: left;
  /* 确保文本左对齐 */
}

.detail-header {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
  align-items: center;
}

.detail-title {
  width: 70px;
  color: #8fd0ea;
}

.detail-value {
  flex: 1;
}

.section-block {
  margin-top: 12px;
}

.section-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: #9be7ff;
}

.section-content {
  background: rgba(255, 255, 255, 0.02);
  padding: 8px;
  border-radius: 4px;
  text-align: left;
}

.kv-row {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.03);
}

.kv-key {
  width: 150px;
  color: #c7f3ff;
}

.kv-val {
  flex: 1;
}

.muted {
  color: #9fbfcc;
  font-size: 12px;
}

.small {
  font-size: 13px;
}

.stage-row {
  display: flex;
  gap: 10px;
  padding: 6px 0;
}

.stage-key {
  width: 110px;
  color: #c7f3ff;
}

.stage-name {
  font-weight: 600;
}

.json-pre {
  background: transparent;
  color: #dceff6;
  max-height: 220px;
  overflow: auto;
  padding: 6px;
}

.empty-placeholder {
  color: #8fb9c7;
  padding: 12px;
}

.config-params {
  border: 1px solid rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  padding: 12px;
  background: linear-gradient(180deg, #031216, #011114);
  /* 更深的暗色 */
  color: #dff6ff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
  text-align: left;

  .sub-section {
    margin-top: 8px;
  }

  .sub-title {
    color: #9be7ff;
    font-weight: 600;
    margin-bottom: 6px;
  }
}
</style>
