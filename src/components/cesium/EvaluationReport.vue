<template>
  <div class="ev-container">
    <form class="weapon-selection">
      <div class="search-item-label">打击烈度选择：</div>
      <div class="search-item-flex">
        <el-radio-group v-model="searchForm.intensity">
          <el-radio value="高烈度" size="small" border>高烈度</el-radio>
          <el-radio value="中烈度" size="small" border>中烈度</el-radio>
          <el-radio value="低烈度" size="small" border>低烈度</el-radio>
        </el-radio-group>
      </div>
      <div class="search-item-label">卫星分类选择：</div>
      <div class="search-item-flex">
        <el-checkbox-group v-model="searchForm.types">
          <el-checkbox v-for="type in satelliteTypes" :key="type" :value="type">{{ type }}</el-checkbox>
        </el-checkbox-group>
      </div>
      <div class="search-item-label">评估参数版本：</div>
      <div class="search-item-flex">
        <div>
          <el-select v-model="searchForm.schemaVersion" placeholder="请选择" style="width: 150px">
            <el-option
              v-for="schema in schemaList"
              :key="schema.version"
              :label="schema.version"
              :value="schema.version"
            ></el-option>
          </el-select>
        </div>
      </div>
      <div class="search-item-label">打击武器选择：</div>
      <div class="grid-box">
        <div class="search-item">
          <div class="search-item-label">
            <el-checkbox v-model="checkedKinetic" size="large" @change="toggleKinetic">全选</el-checkbox>
            <span>【动能武器】</span>
          </div>
          <div class="checkbox-group">
            <el-checkbox-group v-model="kineticWeapons" class="content">
              <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '动能')">{{
                w.name
              }}</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>
        <div class="search-item">
          <div class="search-item-label">
            <el-checkbox v-model="checkedDirectedEnergy" size="large" @change="toggleDirectedEnergy">全选</el-checkbox>
            <span>【定向能武器】</span>
          </div>
          <div class="checkbox-group">
            <el-checkbox-group v-model="directedEnergyWeapons" class="content">
              <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '定向能')">{{
                w.name
              }}</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>
        <div class="search-item">
          <div class="search-item-label">
            <el-checkbox v-model="checkedElectronicJamming" size="large" @change="toggleElectronicJamming"
              >全选</el-checkbox
            >
            <span>【电子干扰武器】</span>
          </div>

          <div class="checkbox-group">
            <el-checkbox-group v-model="electronicJammingWeapons" class="content">
              <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '电子干扰')">{{
                w.name
              }}</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>
        <div class="search-item">
          <div class="search-item-label">
            <el-checkbox v-model="checkedSpaceBased" size="large" @change="toggleSpaceBased">全选</el-checkbox>
            <span>【天基武器】</span>
          </div>
          <div class="checkbox-group">
            <el-checkbox-group v-model="spaceBasedWeapons" class="content">
              <el-checkbox :value="w.name" v-for="w in weapons.filter((s) => s.type === '天基武器')">{{
                w.name
              }}</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>
      </div>

      <div class="btn-actions">
        <el-button type="primary" @click="drawer = !drawer" round> 评估参数配置 </el-button>
        <el-button type="success" round @click="selectAllWeapons"> 选择全部武器</el-button>
        <el-button type="danger" round @click="clearAllWeapons">清空选择武器</el-button>
        <el-button type="primary" round @click="generatePlan">生成打击方案</el-button>
        <el-button type="primary" @click="savePlan" round>保存打击方案</el-button>
        <el-button type="primary" @click="evaluatePlan" round>生成方案评估</el-button>
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
          <p class="report-header__eyebrow">方案评估</p>
          <h2>双方案评估对比</h2>
          <p class="report-header__desc">
            左右并排展示威胁优先与数量优先两种评估方案，便于直接对照核心指标、校验结果和分析结论。
          </p>
        </div>
      </div>

      <div class="evaluation-grid">
        <article v-for="card in evaluationPlanCards" :key="card.key" class="evaluation-card panel-card">
          <div class="evaluation-card__header">
            <div>
              <p class="evaluation-card__eyebrow">评估方案</p>
              <h3>{{ card.planName }}</h3>
              <p class="evaluation-card__meta">
                请求编号 {{ card.report.request_id }} · 版本 {{ card.report.schema_version }} · 时间
                {{ formatDateTime(card.report.timestamp) }}
              </p>
            </div>
            <div class="report-header__status">
              <span class="report-header__status-label">总体状态</span>
              <strong>{{ formatOverallStatus(card.report.data.analysis.overall_status) }}</strong>
            </div>
          </div>

          <section class="report-section">
            <h3>核心指标</h3>
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
                <strong>{{ card.report.data.summary.is_feasible ? '可行' : '不可行' }}</strong>
              </div>
            </div>
          </section>

          <section class="report-section">
            <h3>详细指标</h3>
            <div class="detail-grid">
              <div class="detail-card">
                <span>任务支撑度 D 值</span>
                <strong>
                  通信 {{ card.report.data.details.D_values.communication }} · 空间监测
                  {{ card.report.data.details.D_values.space_monitor }} · 导航
                  {{ card.report.data.details.D_values.navigation }} · 侦察
                  {{ card.report.data.details.D_values.reconnaissance }} · 导弹预警
                  {{ card.report.data.details.D_values.missile_warning }}
                </strong>
              </div>
              <div class="detail-card">
                <span>任务完成度 T 值</span>
                <strong>
                  通信 {{ card.report.data.details.T_values.communication }} · 空间监测
                  {{ card.report.data.details.T_values.space_monitor }} · 导航
                  {{ card.report.data.details.T_values.navigation }} · 侦察
                  {{ card.report.data.details.T_values.reconnaissance }} · 导弹预警
                  {{ card.report.data.details.T_values.missile_warning }}
                </strong>
              </div>
            </div>
          </section>

          <section class="report-section">
            <h3>校验结果</h3>
            <div class="detail-grid">
              <div class="detail-card">
                <span>是否通过校验</span>
                <strong>{{ card.report.data.validation.is_valid ? '通过' : '不通过' }}</strong>
              </div>
              <div class="detail-card detail-card--list">
                <span>警告信息</span>
                <ul>
                  <li v-for="(w, i) in card.report.data.validation.warnings" :key="`${card.key}-w-${i}`">{{ w }}</li>
                </ul>
              </div>
              <div class="detail-card detail-card--list">
                <span>错误信息</span>
                <ul>
                  <li v-for="(e, i) in card.report.data.validation.errors" :key="`${card.key}-e-${i}`">{{ e }}</li>
                </ul>
              </div>
            </div>
          </section>

          <section class="report-section">
            <h3>分析结论</h3>
            <div class="detail-grid">
              <div class="detail-card">
                <span>一句话总结</span>
                <strong>{{ card.report.data.analysis.summary }}</strong>
              </div>
              <div class="detail-card">
                <span>总体状态</span>
                <strong>{{ formatOverallStatus(card.report.data.analysis.overall_status) }}</strong>
              </div>
              <div class="detail-card detail-card--list">
                <span>分析细节</span>
                <ul>
                  <li v-for="(d, i) in card.report.data.analysis.details" :key="`${card.key}-ad-${i}`">{{ d }}</li>
                </ul>
              </div>
              <div class="detail-card detail-card--list">
                <span>优化建议</span>
                <ul>
                  <li v-for="(s, i) in card.report.data.analysis.suggestions" :key="`${card.key}-as-${i}`">{{ s }}</li>
                </ul>
              </div>
              <div class="detail-card detail-card--list">
                <span>风险提示</span>
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
    gap: 10px;
    border-radius: 6px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
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
      display: flex;
      gap: 10px;
      align-items: center;
      font-size: 12px;
      font-weight: bold;
      color: #8fb9c7;
    }

    .grid-box {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;

      .search-item {
        display: grid;
        box-shadow: 0 4px 14px rgba(3, 18, 25, 0.6);
        border-radius: 6px;
        padding: 10px 12px;

        .search-item-label {
          display: flex;
          gap: 10px;
          align-items: center;
          padding-bottom: 10px;
          font-size: 12px;
          width: 100%;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
        }

        .checkbox-group {
          display: flex;
          justify-content: flex-start;

          .content {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
        }
      }
    }

    .btn-actions {
      margin: 10px 0;
      display: flex;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }
  }

  .strike-plan-results {
    margin-top: 18px;
    padding: 18px;
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
      margin-top: 14px;
      padding: 16px;
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
    .asset-list,
    .mission-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
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
    .asset-item,
    .mission-item {
      padding: 14px 16px;
      border-radius: 16px;
      background: linear-gradient(180deg, rgba(20, 55, 94, 0.86), rgba(14, 39, 69, 0.9));
      border: 1px solid rgba(108, 165, 232, 0.1);
    }

    .summary-item {
      display: flex;
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
    }

    .mission-item__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
  }

  .drawer-box {
    .upload-schema {
      display: flex;
      gap: 10px;
      padding: 10px 0;
    }

    .schema-box {
      margin-bottom: 10px;

      .schema-list {
        border: 1px solid rgba(255, 255, 255, 0.04);
        border-radius: 6px;
        height: 300px;
        background: #04141a;
        padding: 10px;
        text-align: left;

        .schema-list-item {
          display: block;
          padding: 10px;
          margin-bottom: 6px;
          cursor: pointer;
          border-radius: 4px;
          color: #dff6ff;
          font-size: 14px;

          div {
            display: block;
            gap: 6px;
            margin-bottom: 6px;
          }
        }
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
  padding: 18px;
  margin-top: 18px;
  border-radius: 20px;
  background:
    radial-gradient(circle at top left, rgba(46, 111, 206, 0.2), transparent 24%),
    radial-gradient(circle at right center, rgba(19, 68, 133, 0.18), transparent 26%),
    linear-gradient(180deg, #06111f 0%, #0a1830 55%, #0b1d37 100%);
  border: 1px solid rgba(112, 170, 255, 0.16);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
  text-align: left;

  h2 {
    margin: 0;
    color: #f2f7ff;
    font-size: 34px;
    font-weight: 800;
  }
}

.report-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px;
  border-radius: 24px;
  margin-top: 14px;
}

.report-header__eyebrow {
  display: inline-flex;
  margin: 0 0 10px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(65, 125, 223, 0.18);
  color: #8dc3ff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.report-header__desc {
  margin: 12px 0 0;
  color: #b7c9e7;
  line-height: 1.8;
}

.report-header__status {
  min-width: 220px;
  padding: 16px 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(13, 35, 66, 0.92), rgba(8, 24, 47, 0.92));
  border: 1px solid rgba(116, 169, 245, 0.16);
}

.report-header__status-label {
  display: block;
  margin-bottom: 10px;
  color: #8eafd8;
  font-size: 13px;
}

.report-header__status strong {
  color: #f1f7ff;
  font-size: 22px;
  font-weight: 800;
}

.evaluation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 18px;
}

.evaluation-card {
  padding: 22px 24px;
}

.evaluation-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.evaluation-card__eyebrow {
  display: inline-flex;
  margin: 0 0 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(65, 125, 223, 0.18);
  color: #8dc3ff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.evaluation-card__header h3 {
  margin: 0;
  color: #f2f7ff;
  font-size: 24px;
  font-weight: 800;
}

.evaluation-card__meta {
  margin: 10px 0 0;
  color: #b7c9e7;
  font-size: 13px;
  line-height: 1.8;
}

.evalute-report .panel-card {
  background: linear-gradient(180deg, rgba(12, 28, 52, 0.94) 0%, rgba(8, 20, 38, 0.96) 100%);
  border: 1px solid rgba(112, 170, 255, 0.16);
  border-radius: 24px;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
}

.evalute-report .report-section {
  padding: 22px 24px;
}

.evalute-report .report-section h3 {
  margin: 0 0 16px;
  color: #f0f6ff;
  font-size: 22px;
  font-weight: 800;
}

.metric-grid--report {
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  margin: 0;
}

.metric-card--report {
  min-height: 30px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-card {
  padding: 16px 18px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(13, 35, 66, 0.92), rgba(8, 24, 47, 0.92));
  border: 1px solid rgba(116, 169, 245, 0.16);
}

.detail-card span {
  display: block;
  margin-bottom: 10px;
  color: #8eafd8;
  font-size: 13px;
}

.detail-card strong {
  color: #f1f7ff;
  font-size: 15px;
  line-height: 1.7;
  font-weight: 700;
}

.detail-card--list ul {
  margin: 0;
  padding-left: 18px;
  color: #d7e6fa;
  line-height: 1.8;
}

.evalute-report ul {
  list-style: none;
  margin: 0;
  padding-left: 0;
}

.evalute-report .p-label {
  width: 110px;
  display: inline-block;
  color: #8fd0ea;
}

.evalute-report .p-val {
  color: #dff6ff;
}

@media (max-width: 1200px) {
  .report-header {
    flex-direction: column;
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
