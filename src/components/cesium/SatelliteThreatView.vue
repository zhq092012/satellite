<template>
  <div class="threat-container" id="thcontainer">
    <el-drawer v-model="drawer" :with-header="false" :direction="direction" :size="1100">
      <div class="header">
        <div class="config-item">
          <div class="config-item__title">综合权重配置</div>
          <div class="config-item__content">
            <div>
              <div class="item_title">
                <span>静态属性评估权重</span> <span>{{ config.weights.static }}%</span>
              </div>
              <el-slider v-model.number="config.weights.static" size="small" @change="calcWeight('static')" />
            </div>
            <div>
              <div class="item_title">
                <span>持续关系评估权重</span> <span>{{ config.weights.persistent }}%</span>
              </div>
              <el-slider v-model.number="config.weights.persistent" size="small" @change="calcWeight('persistent')" />
            </div>
            <div>
              <div class="item_title">
                <span>瞬时事件评估权重</span> <span>{{ config.weights.instant }}%</span>
              </div>
              <el-slider v-model.number="config.weights.instant" size="small" @change="calcWeight('instant')" />
            </div>
          </div>
        </div>
        <div class="config-item">
          <div class="config-item__title">静态属性评估配置</div>
          <div class="config-item__content">
            <div>
              <div class="item_title">
                <span>国家权重</span> <span>{{ config.static_weights.country }}%</span>
              </div>
              <el-slider v-model.number="config.static_weights.country" size="small" @change="calcWeight('country')" />
            </div>
            <div>
              <div class="item_title">
                <span>轨道类型权重</span> <span>{{ config.static_weights.orbit_type }}%</span>
              </div>
              <el-slider v-model.number="config.static_weights.orbit_type" size="small"
                @change="calcWeight('orbit_type')" />
            </div>
            <div>
              <div class="item_title">
                <span>卫星类型权重</span> <span>{{ config.static_weights.sat_type }}%</span>
              </div>
              <el-slider v-model.number="config.static_weights.sat_type" size="small"
                @change="calcWeight('sat_type')" />
            </div>
          </div>
        </div>
        <div class="config-item">
          <div class="config-item__title">持续关系评估配置</div>
          <div class="config-item__content">
            <div>
              <div class="item_title">
                <span>轨道相似权重</span> <span>{{ config.persistent_weights.orbit_similarity }}%</span>
              </div>
              <el-slider v-model.number="config.persistent_weights.orbit_similarity" size="small"
                @change="calcWeight('orbit_similarity')" />
            </div>
            <div>
              <div class="item_title">
                <span>轨道共面权重</span> <span>{{ config.persistent_weights.orbital_coplanarity }}%</span>
              </div>
              <el-slider v-model.number="config.persistent_weights.orbital_coplanarity" size="small"
                @change="calcWeight('orbital_coplanarity')" />
            </div>
            <div>
              <div class="item_title">
                <span>相位稳定权重</span> <span>{{ config.persistent_weights.phase_stability }}%</span>
              </div>
              <el-slider v-model.number="config.persistent_weights.phase_stability" size="small"
                @change="calcWeight('phase_stability')" />
            </div>
          </div>
        </div>
        <div class="config-item">
          <div class="config-item__title">国家威胁评分</div>
          <div class="config-item_score">
            <div>
              <span>美国</span>
              <el-input type="number" v-model.number="config.country_scores.美国" class="input-value"></el-input>
            </div>
            <div>
              <span>日本</span>
              <el-input type="number" v-model.number="config.country_scores.日本" class="input-value"></el-input>
            </div>
            <div>
              <span>俄罗斯</span>
              <el-input type="number" v-model.number="config.country_scores.俄罗斯" class="input-value"></el-input>
            </div>
            <div>
              <span>英国</span>
              <el-input type="number" v-model.number="config.country_scores.英国" class="input-value"></el-input>
            </div>
            <div>
              <span>法国</span>
              <el-input type="number" v-model.number="config.country_scores.法国" class="input-value"></el-input>
            </div>
            <div>
              <span>印度</span>
              <el-input type="number" v-model.number="config.country_scores.印度" class="input-value"></el-input>
            </div>
            <div>
              <span>其他</span>
              <el-input type="number" v-model.number="config.country_scores.其他" class="input-value"></el-input>
            </div>
          </div>
        </div>
        <div class="config-item">
          <div class="config-item__title">轨道类型评分</div>
          <div class="config-item_score">
            <div>
              <span>低轨</span>
              <el-input type="number" v-model.number="config.orbit_scores.低轨" class="input-value"></el-input>
            </div>
            <div>
              <span>中轨</span>
              <el-input type="number" v-model.number="config.orbit_scores.中轨" class="input-value"></el-input>
            </div>
            <div>
              <span>高轨</span>
              <el-input type="number" v-model.number="config.orbit_scores.高轨" class="input-value"></el-input>
            </div>
            <div>
              <span>大椭圆</span>
              <el-input type="number" v-model.number="config.orbit_scores.大椭圆" class="input-value"></el-input>
            </div>
            <div>
              <span>未知</span>
              <el-input type="number" v-model.number="config.orbit_scores.未知" class="input-value"></el-input>
            </div>
          </div>
        </div>
        <div class="config-item">
          <div class="config-item__title">卫星类型评分</div>
          <div class="config-item_score">
            <div>
              <span>侦察</span>
              <el-input type="number" v-model.number="config.sat_type_scores.侦察" class="input-value"></el-input>
            </div>
            <div>
              <span>导弹预警</span>
              <el-input type="number" v-model.number="config.sat_type_scores.导弹预警" class="input-value"></el-input>
            </div>
            <div>
              <span>导航</span>
              <el-input type="number" v-model.number="config.sat_type_scores.导航" class="input-value"></el-input>
            </div>
            <div>
              <span>空间域感知</span>
              <el-input type="number" v-model.number="config.sat_type_scores.空间域感知" class="input-value"></el-input>
            </div>
            <div>
              <span>通信</span>
              <el-input type="number" v-model.number="config.sat_type_scores.通信" class="input-value"></el-input>
            </div>
            <div>
              <span>其他</span>
              <el-input type="number" v-model.number="config.sat_type_scores.其他" class="input-value"></el-input>
            </div>
          </div>
        </div>
        <div class="config-item">
          <div class="config-item__title">持续关系分段规则</div>
          <div class="config-item_gx">
            <div class="config-item_cx">
              <div class="title-gd">轨道相似</div>
              <div class="config-item__cx">
                <div>
                  <span>半长轴差bins(km)</span>
                  <el-input v-model="config.persistent_scoring_rules.orbit_similarity.delta_sma_bins"
                    placeholder="请输入数字，多个用逗号分割" class="input-value"></el-input>
                </div>
                <div>
                  <span>半长轴差分段得分</span>
                  <el-input v-model="config.persistent_scoring_rules.orbit_similarity.delta_sma_scores"
                    placeholder="请输入数字，多个用逗号分割" class="input-value"></el-input>
                </div>
                <div>
                  <span>倾角差bins(rad)</span>
                  <el-input v-model="config.persistent_scoring_rules.orbit_similarity.delta_inc_bins"
                    placeholder="请输入数字，多个用逗号分割" class="input-value"></el-input>
                </div>
                <div>
                  <span>倾角差分段得分</span>
                  <el-input placeholder="请输入数字，多个用逗号分割"
                    v-model="config.persistent_scoring_rules.orbit_similarity.delta_inc_scores"
                    class="input-value"></el-input>
                </div>
                <div>
                  <span>偏心率差 bins</span>
                  <el-input placeholder="请输入数字，多个用逗号分割"
                    v-model="config.persistent_scoring_rules.orbit_similarity.delta_ecc_bins"
                    class="input-value"></el-input>
                </div>
                <div>
                  <span>偏心率差分段得分 bins</span>
                  <el-input placeholder="请输入数字，多个用逗号分割"
                    v-model="config.persistent_scoring_rules.orbit_similarity.delta_ecc_scores"
                    class="input-value"></el-input>
                </div>
              </div>
            </div>
            <div class="config-item_cx">
              <div class="title-gd">轨道共面性</div>
              <div class="config-item__cx">
                <div>
                  <span>轨道面距bins(deg)</span>
                  <el-input placeholder="请输入数字，多个用逗号分割"
                    v-model="config.persistent_scoring_rules.orbital_coplanarity.plane_distance_bins"
                    class="input-value"></el-input>
                </div>
                <div>
                  <span>轨道面距分段得分</span>
                  <el-input placeholder="请输入数字，多个用逗号分割"
                    v-model="config.persistent_scoring_rules.orbital_coplanarity.plane_distance_scores"
                    class="input-value"></el-input>
                </div>
              </div>
            </div>
            <div class="config-item_cx">
              <div class="title-gd">相位稳定</div>
              <div class="config-item__cx">
                <div>
                  <span>Δu标准差bins</span>
                  <el-input placeholder="请输入数字，多个用逗号分割"
                    v-model="config.persistent_scoring_rules.phase_stability.delta_u_bins"
                    class="input-value"></el-input>
                </div>
                <div>
                  <span>Δu分段得分</span>
                  <el-input placeholder="请输入数字，多个用逗号分割"
                    v-model="config.persistent_scoring_rules.phase_stability.delta_u_scores"
                    class="input-value"></el-input>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="config-item">
          <div class="config-item__title">抵近侦察分段规则</div>
          <div class="config-item_gx">
            <div class="config-item_cx">
              <div class="title-gd">抵近事件</div>
              <div class="config-item__cx">
                <div>
                  <span>距离bins(km)</span>
                  <el-input placeholder="请输入数字，多个用逗号分割"
                    v-model="config.instant_scoring_rules.close_encounter.distance_bins_km"
                    class="input-value"></el-input>
                </div>
                <div>
                  <span>距离分段得分</span>
                  <el-input placeholder="请输入数字，多个用逗号分割"
                    v-model="config.instant_scoring_rules.close_encounter.distance_scores"
                    class="input-value"></el-input>
                </div>
              </div>
            </div>
          </div>
        </div>

        <el-button type="primary" size="small" icon="CopyDocument" @click="saveConfig">保存权重配置</el-button>
      </div>
    </el-drawer>

    <div class="main">
      <div class="title">
        <el-radio-group v-model="timeMode">
          <el-radio value="乘积模型威胁度">乘积模型威胁度</el-radio>
          <el-radio value="历史时间计算">历史时间计算</el-radio>
          <el-radio value="按任务总时长计算">按任务总时长计算</el-radio>
          <el-radio value="按任务阶段时长计算">按任务阶段时长计算</el-radio>
        </el-radio-group>
        <div v-show="timeMode === '乘积模型威胁度'" class="product-query-bar">
          <div class="product-query-fields">
            <div class="product-query-item product-query-item--search">
              <span>搜索</span>
              <el-input v-model="productThreatForm.searchKeyword" size="small" placeholder="卫星名称 / NORAD / INT_ID / 国家"
                clearable />
            </div>
            <div class="product-query-item product-query-item--dataset">
              <span>数据集</span>
              <el-select v-model="searchForm.dataSet" class="select" size="small" @change="handleProductDatasetChange">
                <el-option v-for="item in productDatasetOptions" :key="item.value" :label="item.label"
                  :value="item.value" />
              </el-select>
            </div>
            <div class="product-query-item product-query-item--orbit">
              <span>轨道筛选</span>
              <el-select v-model="productThreatForm.orbitTypes" class="select" size="small" multiple collapse-tags
                collapse-tags-tooltip :max-collapse-tags="3">
                <el-option v-for="item in productOrbitOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </div>
            <div class="product-query-item product-query-item--countries">
              <span>重点国家 / 地区</span>
              <el-input v-model="productThreatForm.keyCountriesText" size="small" placeholder="多个国家用逗号分隔" />
            </div>

            <div class="product-query-item product-query-item--count">
              <span>显示条数</span>
              <el-input-number v-model="productThreatForm.displayCount" :min="1" :max="200" size="small" />
            </div>
            <div class="product-query-item product-query-item--longitude">
              <span>目标区域经度</span>
              <el-input-number v-model="productThreatForm.targetLongitudeDeg" :min="0" :max="360" :precision="2"
                size="small" />
            </div>

            <div class="product-query-item product-query-item--key-factor">
              <span>重点国家因子</span>
              <el-input-number v-model="productThreatForm.keyCountryFactor" :min="0" :max="2" :step="0.1" :precision="2"
                size="small" />
            </div>
            <div class="product-query-item product-query-item--other-factor">
              <span>其他国家因子</span>
              <el-input-number v-model="productThreatForm.otherCountryFactor" :min="0" :max="2" :step="0.1"
                :precision="2" size="small" />
            </div>

            <div class="product-query-item product-query-item--sort">
              <span>排序</span>
              <el-select v-model="productThreatForm.sortMode" class="select" size="small">
                <el-option label="默认" value="default" />
                <el-option label="威胁分数降序" value="score_desc" />
                <el-option label="发射年份降序" value="launch_desc" />
              </el-select>
            </div>

            <div class="product-query-item product-query-item--view">
              <span>视图</span>
              <div>
                <el-switch v-model="productThreatForm.viewMode" active-color="#13ce66" inactive-color="#ff4949"
                  :active-value="'keyword'" :inactive-value="'full'" :inactive-text="'关键字段'"></el-switch>
              </div>
            </div>

            <div class="product-query-item product-query-item--action">
              <span>操作</span>
              <el-button type="primary" :loading="productThreatLoading" @click="getCjModelThreatList" size="small">
                开始分析
              </el-button>
            </div>
          </div>
        </div>
        <div v-show="timeMode === '历史时间计算'" class="date-picker-btn">
          <el-date-picker v-model="defaultTime" type="daterange" range-separator="至" start-placeholder="开始日期"
            end-placeholder="结束日期" value-format="YYYY-MM-DD" disabled size="small" />
          <el-button type="primary" size="small" icon="Aim" @click="calc">计算威胁度</el-button>
          <el-button type="success" @click="drawer = !drawer" size="small">
            {{ drawer ? '隐藏' : '显示' }}权重配置
          </el-button>
        </div>
        <div v-show="timeMode === '按任务总时长计算'" class="date-picker-btn">
          <div style="font-size: 14px; display: flex; gap: 10px; align-items: center">
            <span>任务开始时间:</span>{{ store.activedTask?.beginDate }}<span>任务结束时间:</span>{{ store.activedTask?.endDate }}
          </div>

          <el-button type="primary" size="small" icon="Aim" @click="handleTaskTime">计算威胁度</el-button>
        </div>
        <div v-show="timeMode === '按任务阶段时长计算'" class="date-picker-btn">
          <div style="font-size: 14px; display: flex; gap: 10px; align-items: center" v-if="currentStep">
            <span>阶段开始时间:</span>{{ stepStartTime }}<span>阶段结束时间:</span>{{ stepEndTime }}
          </div>
          <el-button :type="currentStep === item ? 'primary' : 'info'" v-for="item in steps" :key="item" size="small"
            @click="handleStepTime(item)">{{ item }}</el-button>
        </div>
      </div>
      <div v-if="timeMode === '乘积模型威胁度'" class="product-mode">
        <div class="product-formula-panel">
          <div class="product-formula-panel__header">
            <div class="product-formula-panel__title">
              <span>指标与公式</span>
              <strong>当前数据集：{{ productDatasetLabel }}</strong>
            </div>
            <div class="product-formula-panel__note">
              综合威胁分按乘积模型计算，f(x)=Π(fᵢ(xᵢ))，0≤fᵢ(xᵢ)≤1，界面展示当前数据集在高轨 /
              非高轨下实际使用的因子与公式。
            </div>
            <div class="product-formula-panel__badge">五因素乘积模型</div>
          </div>

          <div class="product-formula-grid">
            <div class="product-formula-card">
              <div class="product-formula-card__title">非高轨公式</div>
              <div class="product-formula-card__orbit">低轨 / 中轨 / 大椭圆</div>
              <div class="product-formula-card__main">f = f1(x1) * f2(x2) * f3(x3) * f4(x4)</div>
              <div v-for="item in productFormulaDescription.nonGeo" :key="`non-${item.title}`"
                class="product-formula-item">
                <div class="product-formula-item__label">{{ item.title }}</div>
                <div class="product-formula-item__text">{{ item.text }}</div>
              </div>
            </div>
            <div class="product-formula-card">
              <div class="product-formula-card__title">高轨公式</div>
              <div class="product-formula-card__orbit">高轨</div>
              <div class="product-formula-card__main">f = f1(x1) * f2(x2) * f3(x3) * f4(x4)</div>
              <div v-for="item in productFormulaDescription.geo" :key="`geo-${item.title}`"
                class="product-formula-item">
                <div class="product-formula-item__label">{{ item.title }}</div>
                <div class="product-formula-item__text">{{ item.text }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- <div v-if="productWarnings.length" class="product-warning-list">
          <el-alert
            v-for="warning in productWarnings"
            :key="warning"
            :title="warning"
            type="warning"
            :closable="false"
            show-icon
          />
        </div> -->

        <div class="product-stat-grid">
          <div class="product-stat-card">
            <span>总条目</span>
            <strong>{{ productTotalCount }}</strong>
          </div>
          <div class="product-stat-card">
            <span>当前展示</span>
            <strong>{{ productDisplayedCount }}</strong>
          </div>
          <div class="product-stat-card">
            <span>数据集</span>
            <strong>{{ productDatasetLabel }}</strong>
          </div>
        </div>

        <div class="product-table-panel">
          <div v-if="productThreatError" class="product-request-error">{{ productThreatError }}</div>
          <el-table :data="productDisplayedRows" v-loading="productThreatLoading" empty-text="暂无乘积模型威胁数据">
            <el-table-column header-align="center" align="center" prop="全局排名" label="全局排名" width="90" />
            <el-table-column header-align="center" align="center" prop="norad" label="NORAD" min-width="90" />
            <el-table-column header-align="center" align="center" prop="int_id" label="INT_ID" min-width="110" />
            <el-table-column header-align="center" align="center" prop="orbit_type" label="轨道类型" min-width="100" />

            <el-table-column header-align="center" align="center" prop="name_en" label="英文名称" min-width="160"
              show-overflow-tooltip />
            <el-table-column header-align="center" align="center" prop="country" label="国家" min-width="100" />
            <el-table-column header-align="center" align="center" prop="sat_type" label="卫星类型" min-width="180"
              show-overflow-tooltip />
            <el-table-column header-align="center" align="center" label="综合威胁分数" min-width="120">
              <template #default="scope">{{ scope.row.综合威胁分数.toFixed(4) }}</template>
            </el-table-column>
            <el-table-column header-align="center" align="center" label="威胁等级" min-width="110">
              <template #default="scope">
                <el-tag :type="getProductThreatTagType(scope.row.威胁等级)" round>{{ scope.row.威胁等级 }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column v-if="productThreatForm.viewMode === 'full'" header-align="center" align="center"
              prop="target_type" label="TARGET_TYPE" min-width="110" show-overflow-tooltip />
            <el-table-column v-if="productThreatForm.viewMode === 'full'" header-align="center" align="center"
              prop="orbit_status" label="轨道状态" min-width="90" />
            <el-table-column v-if="productThreatForm.viewMode === 'full'" header-align="center" align="center"
              prop="payload_status" label="载荷状态" min-width="90" />
            <el-table-column v-if="productThreatForm.viewMode === 'full'" header-align="center" align="center"
              prop="国别因子" label="国别因子" min-width="90" />
            <el-table-column v-if="productThreatForm.viewMode === 'full'" header-align="center" align="center"
              prop="可见性因子" label="可见性因子" min-width="100" />
            <el-table-column v-if="productThreatForm.viewMode === 'full'" header-align="center" align="center"
              label="过境次数" min-width="100">
              <template #default="scope">{{ formatProductNullable(scope.row['Pass frequency']) }}</template>
            </el-table-column>
            <el-table-column v-if="productThreatForm.viewMode === 'full'" header-align="center" align="center"
              label="星下点经度" min-width="110">
              <template #default="scope">{{ formatProductNullable(scope.row['Subpoint longitude (deg)']) }}</template>
            </el-table-column>
            <el-table-column v-if="productThreatForm.viewMode === 'full'" header-align="center" align="center"
              prop="发射年份" label="发射年份" min-width="90" />
            <el-table-column v-if="productThreatForm.viewMode === 'full'" header-align="center" align="center"
              prop="发射时间因子" label="发射时间因子" min-width="110" />
            <el-table-column header-align="center" align="center" label="威胁指数" min-width="100">
              <template #default="scope">{{ scope.row['威胁指数(0-100)'].toFixed(2) }}</template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <div v-if="timeMode === '历史时间计算'">
        <div class="main-title">
          <el-icon>
            <DataAnalysis />
          </el-icon>卫星整体威胁度分析
        </div>
        <div class="count">
          <div>
            <span>{{ statistics.days }}</span><span>分析天数</span>
          </div>
          <div>
            <span>{{ statistics.unitCount }}</span><span>分析单位数量</span>
          </div>
          <div>
            <span>{{ statistics.highThreatCount }}</span><span>极高威胁目标</span>
          </div>
          <div>
            <span>{{ statistics.avgScore.toFixed(2) }}</span><span>平均威胁分数</span>
          </div>
        </div>
        <div class="graph-container">
          <div class="graph-title">
            <el-icon>
              <Search />
            </el-icon>单个卫星/关键词卫星威胁度分析
          </div>
          <div class="search-bar">
            <el-input class="search-input" v-model="searchInput" placeholder="请输入卫星编号/国家名称" clearable />
            <el-button type="primary" icon="Aim" @click="handleSingleAnalysis">单星分析</el-button>
            <el-button type="primary" icon="PriceTag" @click="handleCountyAnalysis">关键词分析</el-button>
            <el-button type="primary" icon="Refresh" @click="handleReset">重置全部</el-button>
          </div>
          <div class="graph-desc">
            威胁分析的时间演变趋势。可以观察到威胁水平在分析期间保持相对稳定，但在特定时间段出现了显著的威胁集中现象，这与地缘政治事件和卫星的活动模式高度相关。
          </div>
          <div class="graph-title">
            <el-icon>
              <Comment />
            </el-icon>发现与建议措施
          </div>
          <div class="graph-desc">
            {{ suggestion }}
          </div>
          <div class="graph-grid" :class="{ 'three-in-row': !notSingle }">
            <div id="charts1" />
            <div id="charts2" v-if="notSingle" />
            <div id="charts3" />
            <div id="charts4" />
            <!-- <div id="charts7" /> -->
          </div>

          <div class="graph-title">
            <el-icon>
              <List />
            </el-icon>卫星威胁度列表
          </div>
          <div class="graph-desc">
            <el-table style="width: 100%" :data="threatList">
              <el-table-column prop="satellite_id" label="卫星编号" />
              <el-table-column prop="name_en" label="卫星名称" />
              <el-table-column prop="country" label="国家" width="180" />
              <el-table-column prop="orbit_type" label="轨道类型" />
              <el-table-column prop="sat_type" label="卫星类型" />
              <el-table-column prop="threat_score" label="威胁度" sortable />
              <el-table-column prop="threat_level" label="威胁等级" />

              <el-table-column prop="preDate" label="预测日期" />
              <el-table-column label="操作">
                <template #default="scope">
                  <el-button type="primary" link @click="detail(scope.row.satellite_id)">详情</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="page">
              <el-pagination layout="prev, pager, next" :total="total" @current-change="handleCurrentPageChange">
              </el-pagination>
            </div>
          </div>
        </div>
      </div>
      <div v-if="timeMode === '按任务总时长计算' || timeMode === '按任务阶段时长计算'">
        <div class="search">
          <div v-show="timeMode === '按任务阶段时长计算'">
            <span>阶段：</span>
            <span>
              <el-select class="select" v-model="searchForm.step" placeholder="" size="small">
                <el-option v-for="item in steps" :key="item" :label="item" :value="item"> </el-option>
              </el-select>
            </span>
          </div>
          <span>数据集：</span>
          <span>
            <el-select class="select" v-model="searchForm.dataSet" placeholder="" size="small"
              @change="getConfigOfTask">
              <el-option v-for="item in dataSetoptions" :key="item.value" :label="item.label" :value="item.value">
              </el-option>
            </el-select>
          </span>
          <span>轨道筛选：</span>
          <span>
            <el-select class="select" v-model="searchForm.orbit" placeholder="" size="small">
              <el-option v-for="item in orbitOptions" :key="item.value" :label="item.label" :value="item.value">
              </el-option>
            </el-select>
          </span>

          <span>搜索：</span>
          <span>
            <el-input v-model="searchForm.searchInput" size="small"></el-input>
          </span>
          <span>视图：</span>

          <el-button type="primary" size="small" @click="refresh(1, 10)">查询</el-button>
        </div>
        <div class="weight-panel">
          <div class="wt">
            <div class="wl">
              <span>指标与权重</span>
              <span>当前数据集: 【{{ searchForm.dataSetLabel }}】</span>
            </div>
            <div class="wc">
              <el-button type="primary" size="small" round @click="save">保存权重</el-button>
              <el-button type="primary" size="small" round @click="resetCurrent">重置当前</el-button>
              <el-button type="primary" size="small" round @click="resetAll">重置全部</el-button>
            </div>
            <div class="tip">
              <span> 阶段排序中，过境次数/时长为阶段内统计。综合威胁分=∑(指标归一分×权重) </span>
            </div>
          </div>
          <div class="wb">
            <div class="wb-l">
              <span>非高轨权重</span>
              <span class="orbit-label">低轨/大椭圆</span>
              <div v-for="field in threatWeightMeta[currentThreatDataset].non_geo" :key="`non-${field.key}`"
                class="weight-item">
                <el-checkbox v-model="threatWeightLocks[currentThreatDataset].non_geo[field.key]" size="small"
                  @change="handleWeightLockChange(currentThreatDataset, 'non_geo')">
                  锁定
                </el-checkbox>
                <span>{{ field.label }}</span>
                <div class="score-slider">
                  <el-slider v-model="threatWeightGroups[currentThreatDataset].non_geo[field.key]" :min="0" :max="1"
                    :step="0.01" :disabled="threatWeightLocks[currentThreatDataset].non_geo[field.key]" />
                  <span>{{ threatWeightGroups[currentThreatDataset].non_geo[field.key] }}</span>
                </div>
              </div>
            </div>
            <div class="wb-r">
              <span>高轨权重</span>
              <span class="orbit-label">高轨</span>
              <div v-for="field in threatWeightMeta[currentThreatDataset].geo" :key="`geo-${field.key}`"
                class="weight-item">
                <el-checkbox v-model="threatWeightLocks[currentThreatDataset].geo[field.key]" size="small"
                  @change="handleWeightLockChange(currentThreatDataset, 'geo')">
                  锁定
                </el-checkbox>
                <span>{{ field.label }}</span>
                <div class="score-slider">
                  <el-slider v-model="threatWeightGroups[currentThreatDataset].geo[field.key]" :min="0" :max="1"
                    :step="0.01" :disabled="threatWeightLocks[currentThreatDataset].geo[field.key]" />
                  <span>{{ threatWeightGroups[currentThreatDataset].geo[field.key] }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="count-panel">
          <div>
            <span>总条目</span>
            <span>{{ countTotal }}</span>
          </div>
          <div>
            <span>当前展示</span> <span>{{ countCurrent }}</span>
          </div>
          <div>
            <span>数据集</span> <span>【{{ searchForm.dataSetLabel }}】</span>
          </div>
        </div>

        <div class="table-panel">
          <TableWithPageNoCard :table-data="tableData" :count="countTotal" @load-page-data="refresh">
            <el-table-column header-align="center" align="center" prop="全局排名" label="全局排名"> </el-table-column>
            <!-- <el-table-column header-align="center" align="center" prop="组内排名" label="组内排名"> </el-table-column> -->
            <el-table-column header-align="center" align="center" prop="orbit_type" label="轨道类型"> </el-table-column>
            <el-table-column header-align="center" align="center" prop="norad" label="NORAD"> </el-table-column>
            <el-table-column header-align="center" align="center" prop="int_id" label="INT_ID"> </el-table-column>
            <el-table-column header-align="center" align="center" prop="name_en" label="英文名"> </el-table-column>
            <el-table-column header-align="center" align="center" prop="country" label="所属国家"> </el-table-column>
            <el-table-column header-align="center" align="center" prop="sat_type" label="卫星类型"> </el-table-column>
            <el-table-column header-align="center" align="center" label="威胁指数">
              <template #default="scope">{{ Number(scope.row.综合威胁分数).toFixed(4) }}</template>
            </el-table-column>
            <el-table-column header-align="center" align="center" prop="威胁等级" label="威胁等级"> </el-table-column>
            <el-table-column label="操作">
              <template #default="scope">
                <el-button type="primary" link @click="detail(scope.row.norad)">详情</el-button>
              </template>
            </el-table-column>
          </TableWithPageNoCard>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import * as echarts from 'echarts'
import {
  avgThreatAnalysis,
  calThreatAnalysis,
  calThreatAnalysisOfTask,
  calThreatAnalysisOfTaskStep,
  getAllThreatList,
  getCurrentThreatList,
  getSatelliteThreatList,
  getSceneConfig,
  getSuggestionOfTask,
  getThreatByProductModel,
  highThreatAnalysis,
  queryTaskThreatWeight,
  resetAllThreatWeights,
  resetCurrentThreatWeights,
  saveSceneConfig,
  saveTaskThreatWeight,
  threatLevelAnalysis,
  threatStatisticsCount,
  variationThreatAnalysis,
} from '@/api/dashboard'
import type { ProductThreatModelResponse, ProductThreatModelRow } from '@/api/dashboard'
import { useLayoutStore } from '@/store/modules/layout'
import { ElMessage, type DrawerProps } from 'element-plus'
import TableWithPageNoCard from '../table/TableWithPageNoCard.vue'
import type { ThreatTaskWeightsResponse, ThreatWeight } from '@/types/threat'
import { formatDate, getDaysAgo } from '@/utils/func/funcs'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
defineOptions({
  name: 'ThreatAnalysis',
})
const store = useLayoutStore()
const { openSatelliteProfile } = useSatelliteProfileDialog()
const drawer = ref(false)
const direction = ref<DrawerProps['direction']>('ltr')
const detail = (norad: number) => {
  openSatelliteProfile(norad)
}
const searchForm = reactive({
  step: '集结',
  dataSet: 'reconnaissance',
  dataSetLabel: '侦察',
  orbit: '全部',
  count: 0,
  searchInput: '',
  viewType: '',
})

type ProductThreatDatasetKey = keyof ProductThreatModelResponse['results']

const threatDatasetLabelMap: Record<string, string> = {
  reconnaissance: '侦察',
  missile_early_warning: '导弹预警',
  navigation: '导航',
  communication: '通信',
  space_domain_awareness: '空间域感知',
}

const getThreatDatasetLabel = (key: string) => threatDatasetLabelMap[key] || key

const productDatasetKeys: ProductThreatDatasetKey[] = [
  'reconnaissance',
  'missile_early_warning',
  'navigation',
  'communication',
]

const productDatasetOptions = [
  { label: '侦察', value: 'reconnaissance' },
  { label: '导弹预警', value: 'missile_early_warning' },
  { label: '导航', value: 'navigation' },
  { label: '通信', value: 'communication' },
] as Array<{ label: string; value: ProductThreatDatasetKey }>

const productOrbitOptions = ['低轨', '中轨', '高轨', '大椭圆']

const productThreatForm = reactive({
  orbitTypes: [...productOrbitOptions],
  displayCount: 60,
  targetLongitudeDeg: 120,
  keyCountriesText: store.activedTask?.enemyCountry || '',
  keyCountryFactor: 1,
  otherCountryFactor: 0.2,
  searchKeyword: '',
  viewMode: 'keyword' as 'keyword' | 'full',
  sortMode: 'default' as 'default' | 'score_desc' | 'launch_desc',
})

const productThreatLoading = ref(false)
const productThreatError = ref('')
const productThreatResponse = ref<ProductThreatModelResponse | null>(null)

const currentProductDataset = computed<ProductThreatDatasetKey>(() => {
  return productDatasetKeys.includes(searchForm.dataSet as ProductThreatDatasetKey)
    ? (searchForm.dataSet as ProductThreatDatasetKey)
    : 'reconnaissance'
})

const productDatasetLabel = computed(() => getThreatDatasetLabel(currentProductDataset.value))

const productParsedKeyCountries = computed(() => {
  return productThreatForm.keyCountriesText
    .split(/,|，/)
    .map((item) => item.trim())
    .filter(Boolean)
})

const currentProductDatasetPayload = computed(
  () => productThreatResponse.value?.results[currentProductDataset.value] ?? null
)
const productTotalCount = computed(() => currentProductDatasetPayload.value?.count ?? 0)
const productRows = computed<ProductThreatModelRow[]>(() => currentProductDatasetPayload.value?.rows ?? [])
const productDisplayedRows = computed<ProductThreatModelRow[]>(() => {
  const keyword = productThreatForm.searchKeyword.trim().toLowerCase()
  let rows = productRows.value.filter((row) => {
    const orbitMatched =
      productThreatForm.orbitTypes.length === 0 || productThreatForm.orbitTypes.includes(row.orbit_type)
    if (!orbitMatched) return false
    if (!keyword) return true
    const haystack = [row.name_en, row.norad, row.int_id, row.country, row.sat_type].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })

  if (productThreatForm.sortMode === 'score_desc') {
    rows = [...rows].sort((a, b) => b.综合威胁分数 - a.综合威胁分数)
  } else if (productThreatForm.sortMode === 'launch_desc') {
    rows = [...rows].sort((a, b) => b.发射年份 - a.发射年份)
  } else {
    rows = [...rows].sort((a, b) => a.全局排名 - b.全局排名)
  }

  return rows.slice(0, productThreatForm.displayCount)
})

const productDisplayedCount = computed(() => productDisplayedRows.value.length)
const productCurrentYear = computed(() => productThreatResponse.value?.current_year ?? new Date().getFullYear())

const productPayloadDescriptionMap: Record<ProductThreatDatasetKey, string> = {
  reconnaissance: '光学 / 雷达成像：f3(x3) = (1 / 2)^x3；电子侦察 / 海洋监视：f3(x3) = 1 / 2。',
  missile_early_warning: '预警 / 红外探测载荷按能力等级折减，专用预警平台取更高因子。',
  navigation: '导航 / 授时平台按定位精度与授时性能分层，增强型平台取更高因子。',
  communication: '通信 / 中继平台按吞吐能力与抗干扰能力分层，高通量平台取更高因子。',
}

const productFormulaDescription = computed(() => {
  const keyCountriesText = productParsedKeyCountries.value.join(' / ') || '未设置'
  const year = productCurrentYear.value
  const payloadText = productPayloadDescriptionMap[currentProductDataset.value]
  return {
    nonGeo: [
      {
        title: '国别',
        text: `f1(x1) = ${productThreatForm.keyCountryFactor}（重点国家 / 地区），${productThreatForm.otherCountryFactor}（其他）。当前重点国家 / 地区：${keyCountriesText}。`,
      },
      {
        title: '过境频次',
        text: 'f2(x2) = 1（x2 > 6）；(1 / 2)^(6 - x2)（x2 ≤ 6）。',
      },
      {
        title: '载荷性能',
        text: payloadText,
      },
      {
        title: '发射时间',
        text: `f4(x4) = (1 / 2)^((T0 - x4) / (T0 - 1957))，T0 = ${year}。`,
      },
    ],
    geo: [
      {
        title: '国别',
        text: `f1(x1) = ${productThreatForm.keyCountryFactor}（重点国家 / 地区），${productThreatForm.otherCountryFactor}（其他）。当前重点国家 / 地区：${keyCountriesText}。`,
      },
      {
        title: '星下点经度',
        text: `f2(x2) = (${productThreatForm.targetLongitudeDeg} - |L - x2|) / ${productThreatForm.targetLongitudeDeg}，|L - x2| ≤ ${productThreatForm.targetLongitudeDeg}；否则为 0。`,
      },
      {
        title: '载荷性能',
        text: payloadText,
      },
      {
        title: '发射时间',
        text: `f4(x4) = (1 / 2)^((T0 - x4) / (T0 - 1957))，T0 = ${year}。`,
      },
    ],
  }
})

const currentThreatDataset = computed(() => searchForm.dataSet as ThreatDatasetKey)
const dataSetoptions = ref([
  {
    label: '侦察',
    value: 'reconnaissance',
  },

  {
    label: '导弹预警',
    value: 'missile_early_warning',
  },
  {
    label: '导航',
    value: 'navigation',
  },
  {
    label: '空间域感知',
    value: 'space_domain_awareness',
  },
  {
    label: '通信',
    value: 'communication',
  },
])
const orbitOptions = ref([
  {
    label: '全部',
    value: '全部',
  },
  {
    label: '低轨',
    value: '低轨',
  },
  {
    label: '中轨',
    value: '中轨',
  },
  {
    label: '大椭圆',
    value: '大椭圆',
  },
  {
    label: '高轨',
    value: '高轨',
  },
])

// 保存权重
const save = async () => {
  if (timeMode.value === '历史时间计算') {
    ElMessage.warning('历史时间计算模式不支持保存权重')
    return
  }
  if (timeMode.value === '按任务阶段时长计算') {
    if (!searchForm.step) {
      ElMessage.warning('请选择任务阶段')
      return
    } else {
      await saveTaskThreatWeight({
        scene_id: String(store.activedTask?.id),
        weights: {
          communication,
          missile_early_warning,
          navigation,
          reconnaissance,
          space_domain_awareness,
        },
        scope: 'stage',
        stage: searchForm.step,
      })
    }
  }
  if (timeMode.value === '按任务总时长计算') {
    await saveTaskThreatWeight({
      scene_id: String(store.activedTask?.id),
      weights: {
        communication,
        missile_early_warning,
        navigation,
        reconnaissance,
        space_domain_awareness,
      },
      scope: 'task',
    })
  }

  ElMessage.success('已保存权重')
}
// 重置当前权重
const resetCurrent = async () => {
  if (timeMode.value === '按任务阶段时长计算') {
    await resetCurrentThreatWeights(store.activedTask?.id!, searchForm.dataSet, currentStep.value!)
    ElMessage.success('已重置当前权重')
    // 任务权重
    getConfigOfTask()
  } else if (timeMode.value === '按任务总时长计算') {
    await resetCurrentThreatWeights(store.activedTask?.id!, searchForm.dataSet)
    ElMessage.success('已重置当前权重')
    // 任务权重
    getConfigOfTask()
  } else {
    ElMessage.warning('历史时间计算模式不支持重置权重')
  }
}
const resetAll = async () => {
  if (timeMode.value === '按任务阶段时长计算') {
    await resetAllThreatWeights(store.activedTask?.id!, currentStep.value ?? '')
  } else if (timeMode.value === '按任务总时长计算') {
    await resetAllThreatWeights(store.activedTask?.id!)
  }

  ElMessage.success('已重置全部权重')
  // 任务权重
  getConfigOfTask()
}
const steps = computed(() => {
  if (!store.activedTask) return []
  const stepJSON = JSON.parse(store.activedTask.steps || '[]') as TaskSteps[]
  if (stepJSON.length === 0) return []
  return stepJSON.map((item) => item.name)
})
// 选择任务阶段时，设置阶段时间
const currentStep = ref<string | null>('集结')
// 选择任务阶段时，阶段开始时间和结束时间
const stepStartTime = ref('')
const stepEndTime = ref('')
// 设置当前阶段时间
const handleStepTime = (stepName: string) => {
  if (!stepName) return
  currentStep.value = stepName
  searchForm.step = stepName
  if (!store.activedTask) return
  const stepJSON = JSON.parse(store.activedTask.steps || '[]') as TaskSteps[]
  const step = stepJSON.find((item) => item.name === stepName)
  //  切换阶段重新获取权重
  getConfigOfTask()
  if (step) {
    stepStartTime.value = step.startTime
    stepEndTime.value = step.endTime
    selectDate.value = [step.startTime, step.endTime]
    calcOfTaskStep()
    getThreatListOfTaskStep(1, 10)
  }
}
const handleTaskTime = () => {
  if (!store.activedTask) return
  selectDate.value = [store.activedTask.beginDate, store.activedTask.endDate]
  calcOfTask()
}
const timeMode = ref('乘积模型威胁度')
const countTotal = ref(0)
const countCurrent = ref(0)
const tableData = ref<ThreatTaskWeightsResponse[]>([])
async function getThreatListOfTask(pageNum = 1, pageSize = 10) {
  const res = await getAllThreatList(
    store.activedTask?.id!,
    pageNum,
    pageSize,
    searchForm.dataSetLabel,
    searchForm.orbit,
    searchForm.searchInput ? Number(searchForm.searchInput) : undefined
  )
  if (res.code === 200) {
    tableData.value = res.data.content
    countCurrent.value = res.data.content.length
    countTotal.value = res.data.totalElements
  } else {
    ElMessage.warning(res.msg)
  }
}
async function getThreatListOfTaskStep(pageNum = 1, pageSize = 10) {
  const res = await getCurrentThreatList(
    store.activedTask?.id!,
    searchForm.step,
    searchForm.dataSetLabel,
    searchForm.orbit,
    searchForm.searchInput ? Number(searchForm.searchInput) : undefined,
    pageNum,
    pageSize
  )
  if (res.code === 200) {
    tableData.value = res.data.content
    countCurrent.value = res.data.content.length
    countTotal.value = res.data.totalElements
  } else {
    ElMessage.warning(res.msg)
  }
}
function refresh(pageNum = 1, pageSize = 10) {
  switch (timeMode.value) {
    case '按任务总时长计算':
      getThreatListOfTask(pageNum, pageSize)
      break
    case '按任务阶段时长计算':
      getThreatListOfTaskStep(pageNum, pageSize)
      break
    default:
      break
  }
}

const handleProductDatasetChange = (value: ProductThreatDatasetKey) => {
  searchForm.dataSet = value
  searchForm.dataSetLabel = getThreatDatasetLabel(value)
}

const getProductThreatTagType = (level: string) => {
  if (level.includes('极高')) return 'danger'
  if (level.includes('高')) return 'warning'
  if (level.includes('中')) return 'primary'
  if (level.includes('低')) return 'success'
  return 'info'
}

const formatProductNullable = (value: number | string | null) => {
  if (value == null || value === '') return '--'
  return value
}

async function getCjModelThreatList() {
  if (!store.activedTask?.id) {
    productThreatError.value = '当前未选择任务'
    return
  }

  productThreatLoading.value = true
  productThreatError.value = ''

  try {
    const res = await getThreatByProductModel({
      taskId: store.activedTask.id,
      key_countries: productParsedKeyCountries.value,
      key_country_factor: productThreatForm.keyCountryFactor,
      other_country_factor: productThreatForm.otherCountryFactor,
      target_longitude_deg: productThreatForm.targetLongitudeDeg,
    })

    if (res.code === 200) {
      productThreatResponse.value = res.data
      searchForm.dataSetLabel = getThreatDatasetLabel(currentProductDataset.value)
    } else {
      productThreatResponse.value = null
      productThreatError.value = res.msg || '乘积模型威胁度获取失败'
      ElMessage.warning(productThreatError.value)
    }
  } catch (error) {
    console.error(error)
    productThreatResponse.value = null
    productThreatError.value = '乘积模型威胁度获取失败'
    ElMessage.warning(productThreatError.value)
  } finally {
    productThreatLoading.value = false
  }
}
watch(
  () => timeMode.value,
  async (newVal) => {
    if (newVal === '乘积模型威胁度') {
      if (!productDatasetKeys.includes(searchForm.dataSet as ProductThreatDatasetKey)) {
        handleProductDatasetChange('reconnaissance')
      } else {
        searchForm.dataSetLabel = getThreatDatasetLabel(searchForm.dataSet)
      }
      await getCjModelThreatList()
    } else if (newVal === '历史时间计算') {
      calculateThreatLevel()
    } else if (newVal === '按任务总时长计算') {
      getConfigOfTask()
      getThreatListOfTask()
      registerWeightWatchers()
    } else if (newVal === '按任务阶段时长计算') {
      handleStepTime(currentStep.value ?? '')
      getConfigOfTask()
      getThreatListOfTaskStep()
      registerWeightWatchers()
    }
  }
)
const calcWeight = (str: string) => {
  switch (str) {
    case 'static':
      config.value.weights.persistent = (100 - config.value.weights.static) / 2
      config.value.weights.instant = (100 - config.value.weights.static) / 2
      break
    case 'persistent':
      if (config.value.weights.persistent > 100 - config.value.weights.static) {
        config.value.weights.persistent = 100 - config.value.weights.static
        config.value.weights.instant = 0
      } else {
        config.value.weights.instant = 100 - config.value.weights.persistent - config.value.weights.static
      }
      break
    case 'instant':
      break
    case 'country':
      config.value.static_weights.orbit_type = (100 - config.value.static_weights.country) / 2
      config.value.static_weights.sat_type = (100 - config.value.static_weights.country) / 2
      break
    case 'orbit_type':
      if (config.value.static_weights.orbit_type > 100 - config.value.static_weights.country) {
        config.value.static_weights.orbit_type = 100 - config.value.static_weights.country
        config.value.static_weights.sat_type = 0
      } else {
        config.value.static_weights.sat_type =
          100 - config.value.static_weights.orbit_type - config.value.static_weights.country
      }

      break
    case 'sat_type':
      break
    case 'orbit_similarity':
      config.value.persistent_weights.phase_stability = (100 - config.value.persistent_weights.orbit_similarity) / 2
      config.value.persistent_weights.orbital_coplanarity = (100 - config.value.persistent_weights.orbit_similarity) / 2
      break
    case 'orbital_coplanarity':
      if (
        config.value.persistent_weights.orbital_coplanarity >
        100 - config.value.persistent_weights.orbit_similarity
      ) {
        config.value.persistent_weights.orbital_coplanarity = 100 - config.value.persistent_weights.orbit_similarity
        config.value.persistent_weights.phase_stability = 0
      } else {
        config.value.persistent_weights.phase_stability =
          100 - config.value.persistent_weights.orbit_similarity - config.value.persistent_weights.orbital_coplanarity
      }
      break
    case 'phase_stability':
      break
    default:
      break
  }
}

const selectDate = ref<[string, string]>(['2025-07-03', '2025-09-29'])

const fromDT = new Date(store.activedTask?.beginDate!)
const startDT = getDaysAgo(7, fromDT)
const endDT = getDaysAgo(1, fromDT)
const defaultTime = ref<[string, string]>([formatDate(startDT), formatDate(endDT)])

//计算自定义时间威胁度
const calc = async () => {
  const res = await calThreatAnalysis(store.activedTask?.id!, defaultTime.value[0], defaultTime.value[1])
  if (res.code === 200) {
    ElMessage.success('威胁度计算成功')
    refresh(1, 10)
  } else {
    ElMessage.warning(res.msg)
  }
}
//计算任务整体威胁度
const calcOfTask = async () => {
  const res = await calThreatAnalysisOfTask(store.activedTask?.id!)
  if (res.code === 200) {
    ElMessage.success('威胁度计算成功')
    refresh(1, 10)
  } else {
    ElMessage.warning(res.msg)
  }
}
//计算任务某个阶段威胁度
const calcOfTaskStep = async () => {
  const res = await calThreatAnalysisOfTaskStep(
    store.activedTask?.id!,
    stepStartTime.value,
    stepEndTime.value,
    currentStep.value ?? ''
  )
  if (res.code === 200) {
    ElMessage.success('威胁度计算成功')
    refresh(1, 10)
  } else {
    ElMessage.warning(res.msg)
  }
}

const searchInput = ref<string | number>(store.selectedSatellite?.norad ?? '')

let config = ref<SceneConfig>({
  taskId: store.activedTask?.id!,
  weights: {
    static: 0,
    persistent: 0,
    instant: 0,
  },
  persistent_weights: {
    orbit_similarity: 0,
    orbital_coplanarity: 0,
    phase_stability: 0,
  },
  static_weights: {
    country: 0,
    orbit_type: 0,
    sat_type: 0,
  },
  country_scores: {
    美国: 0,
    日本: 0,
    英国: 0,
    法国: 0,
    印度: 0,
    俄罗斯: 0,
    其他: 0,
  },
  orbit_scores: {
    低轨: 0,
    大椭圆: 0,
    中轨: 0,
    高轨: 0,
    未知: 0,
  },
  sat_type_scores: {
    侦察: 0,
    导弹预警: 0,
    导航: 0,
    空间域感知: 0,
    通信: 0,
    其他: 0,
    科研教育类: 0,
  },
  persistent_scoring_rules: {
    orbit_similarity: {
      delta_sma_bins: '',
      delta_sma_scores: '',
      delta_inc_bins: '',
      delta_inc_scores: '',
      delta_ecc_bins: '',
      delta_ecc_scores: '',
    },
    orbital_coplanarity: {
      plane_distance_bins: '',
      plane_distance_scores: '',
    },
    phase_stability: {
      delta_u_bins: '',
      delta_u_scores: '',
    },
  },
  instant_scoring_rules: {
    close_encounter: {
      distance_bins_km: '',
      distance_scores: '',
    },
  },
})

const saveConfig = async () => {
  config.value.weights.static = Math.round(config.value.weights.static * 100) / 10000
  config.value.weights.persistent = Math.round(config.value.weights.persistent * 100) / 10000
  config.value.weights.instant = Math.round(config.value.weights.instant * 100) / 10000
  config.value.persistent_weights.orbit_similarity =
    Math.round(config.value.persistent_weights.orbit_similarity * 100) / 10000
  config.value.persistent_weights.orbital_coplanarity =
    Math.round(config.value.persistent_weights.orbital_coplanarity * 100) / 10000
  config.value.persistent_weights.phase_stability =
    Math.round(config.value.persistent_weights.phase_stability * 100) / 10000
  config.value.static_weights.country = Math.round(config.value.static_weights.country * 100) / 10000
  config.value.static_weights.orbit_type = Math.round(config.value.static_weights.orbit_type * 100) / 10000
  config.value.static_weights.sat_type = Math.round(config.value.static_weights.sat_type * 100) / 10000

  config.value.persistent_scoring_rules.orbit_similarity.delta_sma_bins = String(
    config.value.persistent_scoring_rules.orbit_similarity.delta_sma_bins
  ).split(',') as unknown as number[]
  config.value.persistent_scoring_rules.orbit_similarity.delta_sma_scores = String(
    config.value.persistent_scoring_rules.orbit_similarity.delta_sma_scores
  ).split(',') as unknown as number[]
  config.value.persistent_scoring_rules.orbit_similarity.delta_inc_bins = String(
    config.value.persistent_scoring_rules.orbit_similarity.delta_inc_bins
  ).split(',') as unknown as number[]
  config.value.persistent_scoring_rules.orbit_similarity.delta_inc_scores = String(
    config.value.persistent_scoring_rules.orbit_similarity.delta_inc_scores
  ).split(',') as unknown as number[]
  config.value.persistent_scoring_rules.orbit_similarity.delta_ecc_bins = String(
    config.value.persistent_scoring_rules.orbit_similarity.delta_ecc_bins
  ).split(',') as unknown as number[]
  config.value.persistent_scoring_rules.orbit_similarity.delta_ecc_scores = String(
    config.value.persistent_scoring_rules.orbit_similarity.delta_ecc_scores
  ).split(',') as unknown as number[]
  config.value.persistent_scoring_rules.orbital_coplanarity.plane_distance_bins = String(
    config.value.persistent_scoring_rules.orbital_coplanarity.plane_distance_bins
  ).split(',') as unknown as number[]
  config.value.persistent_scoring_rules.orbital_coplanarity.plane_distance_scores = String(
    config.value.persistent_scoring_rules.orbital_coplanarity.plane_distance_scores
  ).split(',') as unknown as number[]
  config.value.persistent_scoring_rules.phase_stability.delta_u_bins = String(
    config.value.persistent_scoring_rules.phase_stability.delta_u_bins
  ).split(',') as unknown as number[]
  config.value.persistent_scoring_rules.phase_stability.delta_u_scores = String(
    config.value.persistent_scoring_rules.phase_stability.delta_u_scores
  ).split(',') as unknown as number[]
  config.value.instant_scoring_rules.close_encounter.distance_bins_km = String(
    config.value.instant_scoring_rules.close_encounter.distance_bins_km
  ).split(',') as unknown as number[]
  config.value.instant_scoring_rules.close_encounter.distance_scores = String(
    config.value.instant_scoring_rules.close_encounter.distance_scores
  ).split(',') as unknown as number[]
  config.value.taskId = store.activedTask?.id!
  const res = await saveSceneConfig(config.value)
  if (res.code === 200) {
    getConfig()
    ElMessage.success('保存成功')
  }
}
let charts1: echarts.ECharts, charts2: echarts.ECharts, charts3: echarts.ECharts, charts4: echarts.ECharts
const getThemeColor = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}
const chartTextColor = getThemeColor('--text-color-primary', '#d9e9fb')
const chartLineBlue = getThemeColor('--accent-color', '#4f93dd')
const lineYAxisBase = {
  type: 'value',
  scale: true,
  splitNumber: 3,
  min: (value: { min: number }) => Number((value.min - 0.05).toFixed(2)),
  max: (value: { max: number }) => Number((value.max + 0.05).toFixed(2)),
  axisLabel: {
    formatter: '{value}',
  },
  axisLine: {
    lineStyle: {
      color: chartTextColor,
    },
  },
  axisTick: {
    lineStyle: {
      color: chartTextColor,
    },
  },
}
function initGraph1(optData: { date: string; avgThreatScore: number }[]) {
  if (charts1) charts1.dispose()
  const chartDom = document.getElementById('charts1')
  charts1 = echarts.init(chartDom)
  const option = {
    title: {
      text: '每日平均威胁分数趋势',
      textStyle: {
        color: chartTextColor,
        fontSize: 12,
      },
    },
    xAxis: {
      type: 'category',
      data: optData.map((s) => s.date),
      axisLine: {
        lineStyle: {
          color: chartTextColor, // X轴颜色
        },
      },
      axisTick: {
        lineStyle: {
          color: chartTextColor,
        },
      },
      axisLabel: {
        color: chartTextColor,
      },
    },
    yAxis: {
      ...lineYAxisBase,
      axisLabel: {
        ...lineYAxisBase.axisLabel,
        color: chartTextColor,
      },
    },
    series: [
      {
        data: optData.map((s) => s.avgThreatScore),
        type: 'line',
        lineStyle: {
          color: '#bd2424', // 折线颜色
          width: 2,
        },
        symbol: 'none', // ← 去掉拐点
      },
    ],
  }
  option && charts1.setOption(option)
}
function initGraph2(optData: { date: string; variation: number }[]) {
  if (charts2) charts2.dispose()
  const chartDom = document.getElementById('charts2')
  charts2 = echarts.init(chartDom)
  const option = {
    title: {
      text: '威胁分数波动性分析',
      textStyle: {
        color: chartTextColor,
        fontSize: 12,
      },
    },
    xAxis: {
      type: 'category',
      data: optData.map((s) => s.date),
      axisLine: {
        lineStyle: {
          color: chartTextColor, // X轴颜色
        },
      },
      axisTick: {
        lineStyle: {
          color: chartTextColor,
        },
      },
      axisLabel: {
        color: chartTextColor,
      },
    },
    yAxis: {
      ...lineYAxisBase,
      axisLabel: {
        ...lineYAxisBase.axisLabel,
        color: chartTextColor,
      },
    },
    series: [
      {
        data: optData.map((s) => s.variation),
        type: 'line',
        lineStyle: {
          color: chartLineBlue, // 折线颜色
          width: 2,
        },
        symbol: 'none', // ← 去掉拐点
      },
    ],
  }
  option && charts2.setOption(option)
}
function initGraph3(optData: { date: string; count: number }[]) {
  if (charts3) charts3.dispose()
  const chartDom = document.getElementById('charts3')
  charts3 = echarts.init(chartDom)
  const option = {
    title: {
      text: '高威胁卫星数量变化',
      textStyle: {
        color: chartTextColor,
        fontSize: 12,
      },
    },
    xAxis: {
      type: 'category',
      data: optData.map((s) => s.date),
      axisLine: {
        lineStyle: {
          color: chartTextColor, // X轴颜色
        },
      },
      axisTick: {
        lineStyle: {
          color: chartTextColor,
        },
      },
      axisLabel: {
        color: chartTextColor,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: chartTextColor, // Y轴颜色
        },
      },
      axisTick: {
        lineStyle: {
          color: chartTextColor,
        },
      },
      axisLabel: {
        color: chartTextColor,
      },
    },
    series: [
      {
        data: optData.map((s) => s.count),
        type: 'line',
        lineStyle: {
          color: '#67C23A', // 折线颜色
          width: 2,
        },
        symbol: 'none', // ← 去掉拐点
      },
    ],
  }
  option && charts3.setOption(option)
}
function initGraph4(optData: Record<string, number>) {
  if (charts4) charts4.dispose()
  const chartDom = document.getElementById('charts4')
  charts4 = echarts.init(chartDom)
  const option = {
    title: {
      text: '威胁等级分布演变',
      textStyle: {
        color: chartTextColor,
        fontSize: 12,
      },
    },
    tooltip: {
      trigger: 'item',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      bottom: 15,
      textStyle: {
        color: chartTextColor,
      },
    },
    series: [
      {
        name: '威胁等级',
        type: 'pie',
        radius: '50%',
        data: Object.entries(optData).map(([key, value]) => ({ value, name: key })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  }
  option && charts4.setOption(option)
}
function handleSingleAnalysis() {
  if (searchInput.value.toString().trim() === '') {
    ElMessage.warning('请输入卫星编号')
    return
  }
  if (isNaN(Number(searchInput.value))) {
    ElMessage.warning('请输入正确的卫星编号')
    return
  }
  notSingle.value = false
  initGraphs('1')
  getThreatList(1, Number(searchInput.value))
}
function handleCountyAnalysis() {
  if (searchInput.value.toString().trim() === '') {
    ElMessage.warning('请输入国家名称')
    return
  }
  notSingle.value = true
  initGraphs('2')
  getThreatList(1, undefined, String(searchInput.value))
}
function handleReset() {
  notSingle.value = true
  loadDataAll()
  getThreatList()
}
function initGraphs(searchType: string) {
  if (searchType && searchType === '1') {
    loadDataBySatelliteId()
  } else if (searchType && searchType === '2') {
    loadDataBySateCountry()
  } else {
    loadDataAll()
  }
}
// 所有星分析威胁度
async function loadDataAll() {
  if (timeMode.value !== '历史时间计算') return
  searchInput.value = ''
  store.setSelectedSatellite(null)
  const avg = await avgThreatAnalysis(store.activedTask?.id!)
  if (avg.code === 200) {
    initGraph1(avg.data)
  }
  const variation = await variationThreatAnalysis(store.activedTask?.id!)
  if (variation.code === 200) {
    initGraph2(variation.data)
  }
  const high = await highThreatAnalysis(store.activedTask?.id!)
  if (high.code === 200) {
    initGraph3(high.data)
  }
  const imp = await threatLevelAnalysis(store.activedTask?.id!)
  if (imp.code === 200) {
    initGraph4(imp.data)
  }
}
// 单星分析威胁度
async function loadDataBySatelliteId() {
  if (timeMode.value !== '历史时间计算') return
  const avg = await avgThreatAnalysis(store.activedTask?.id!, Number(searchInput.value))
  if (avg.code === 200) {
    initGraph1(avg.data)
  }

  const high = await highThreatAnalysis(store.activedTask?.id!, Number(searchInput.value))
  if (high.code === 200) {
    initGraph3(high.data)
  }
  const imp = await threatLevelAnalysis(store.activedTask?.id!, Number(searchInput.value))
  if (imp.code === 200) {
    initGraph4(imp.data)
  }
}
// 根据国家分析威胁度
async function loadDataBySateCountry() {
  if (timeMode.value !== '历史时间计算') return
  const avg = await avgThreatAnalysis(store.activedTask?.id!, undefined, String(searchInput.value))
  if (avg.code === 200) {
    initGraph1(avg.data)
  }
  const variation = await variationThreatAnalysis(store.activedTask?.id!, String(searchInput.value))
  if (variation.code === 200) {
    initGraph2(variation.data)
  }
  const high = await highThreatAnalysis(store.activedTask?.id!, undefined, String(searchInput.value))
  if (high.code === 200) {
    initGraph3(high.data)
  }
  const imp = await threatLevelAnalysis(store.activedTask?.id!, undefined, String(searchInput.value))
  if (imp.code === 200) {
    initGraph4(imp.data)
  }
}
const statistics = reactive({
  days: 0,
  unitCount: 0,
  highThreatCount: 0,
  avgScore: 0,
})
const suggestion = ref('')
async function getSuggestion() {
  if (store.activedTask?.id) {
    const res = await getSuggestionOfTask(store.activedTask?.id)
    if (res.code === 200) suggestion.value = res.data
  }
}
const getConfig = async () => {
  const r = await getSceneConfig(store.activedTask?.id!)
  if (r.code === 200) {
    if (r.data.user_overrides && r.data.user_overrides.weights) {
      r.data.user_overrides.weights.static = r.data.user_overrides.weights.static * 100
      r.data.user_overrides.weights.persistent = r.data.user_overrides.weights.persistent * 100
      r.data.user_overrides.weights.instant = r.data.user_overrides.weights.instant * 100
      r.data.user_overrides.persistent_weights.orbit_similarity =
        r.data.user_overrides.persistent_weights.orbit_similarity * 100
      r.data.user_overrides.persistent_weights.orbital_coplanarity =
        r.data.user_overrides.persistent_weights.orbital_coplanarity * 100
      r.data.user_overrides.persistent_weights.phase_stability =
        r.data.user_overrides.persistent_weights.phase_stability * 100
      r.data.user_overrides.static_weights.country = r.data.user_overrides.static_weights.country * 100
      r.data.user_overrides.static_weights.orbit_type = r.data.user_overrides.static_weights.orbit_type * 100
      r.data.user_overrides.static_weights.sat_type = r.data.user_overrides.static_weights.sat_type * 100
      config.value = r.data.user_overrides
    }
  }
}
const threatList = ref<SatelliteThreat[]>([])
const getThreatList = async (page: number = 1, satelliteId?: number, country?: string) => {
  if (store.activedTask?.id) {
    let res
    if (satelliteId) {
      res = await getSatelliteThreatList(store.activedTask?.id, page, 10, satelliteId)
    } else if (country) {
      res = await getSatelliteThreatList(store.activedTask?.id, page, 10, undefined, country)
    } else {
      res = await getSatelliteThreatList(store.activedTask?.id, page, 10)
    }

    if (res.code === 200) {
      threatList.value = res.data.content.map((item) => {
        if (item.threat_score) {
          // 保留三位小数
          item.threat_score = Math.round(item.threat_score * 1000) / 1000
        }
        return item
      })
      total.value = res.data.totalElements
    }
  }
}
const total = ref(0)
const handleCurrentPageChange = (page: number) => {
  getThreatList(page)
}

// 计算威胁度
function calculateThreatLevel() {
  if (store.selectedSatellite) {
    searchInput.value = store.selectedSatellite.norad
    notSingle.value = false
    initGraphs('1')
  } else {
    notSingle.value = true
    initGraphs('')
  }

  // 建议
  getSuggestion()

  // 威胁度
  getThreatList(1, store.selectedSatellite?.norad)
}

const notSingle = ref(true)
onMounted(() => {
  nextTick(async () => {
    const resC = await threatStatisticsCount(store.activedTask?.id!)
    if (resC.code === 200) {
      const { avgScore, days, highThreatCount, unitCount } = resC.data
      statistics.avgScore = avgScore
      statistics.days = days
      statistics.highThreatCount = highThreatCount
      statistics.unitCount = unitCount
    }
    if (timeMode.value === '乘积模型威胁度') {
      getCjModelThreatList()
    }
    // 回显参数
    getConfig()
    // 任务权重
    getConfigOfTask()
    // 计算威胁度
    calculateThreatLevel()
  })
})

const taskThreatWeight = ref<ThreatWeight | null>(null)

//侦察卫星权重默认值
const reconnaissance = reactive<{
  non_geo: {
    代际威胁分: number
    分辨率威胁分: number
    定位威胁分: number
    次数威胁分: number
    时长威胁分: number
  }
  geo: {
    代际威胁分: number
    分辨率威胁分: number
    定位威胁分: number
    距离威胁分: number
  }
}>({
  non_geo: {
    代际威胁分: 0.3,
    分辨率威胁分: 0.2,
    定位威胁分: 0.2,
    次数威胁分: 0.15,
    时长威胁分: 0.15,
  },
  geo: {
    代际威胁分: 0.25,
    分辨率威胁分: 0.25,
    定位威胁分: 0.25,
    距离威胁分: 0.25,
  },
})
//通信卫星权重默认值
const communication = reactive<{
  non_geo: {
    代际威胁分: number
    吞吐量威胁分: number
    延迟威胁分: number
    次数威胁分: number
    时长威胁分: number
  }
  geo: {
    代际威胁分: number
    吞吐量威胁分: number
    延迟威胁分: number
    距离威胁分: number
  }
}>({
  non_geo: {
    代际威胁分: 0.2,
    吞吐量威胁分: 0.25,
    延迟威胁分: 0.2,
    次数威胁分: 0.15,
    时长威胁分: 0.2,
  },
  geo: {
    代际威胁分: 0.25,
    吞吐量威胁分: 0.25,
    延迟威胁分: 0.25,
    距离威胁分: 0.25,
  },
})
//导弹预警卫星权重默认值
const missile_early_warning = reactive<{
  non_geo: {
    代际威胁分: number
    定位威胁分: number
    首报威胁分: number
    次数威胁分: number
    时长威胁分: number
  }
  geo: {
    代际威胁分: number
    定位威胁分: number
    首报威胁分: number
    距离威胁分: number
  }
}>({
  non_geo: {
    代际威胁分: 0.2,
    定位威胁分: 0.3,
    首报威胁分: 0.3,
    次数威胁分: 0.1,
    时长威胁分: 0.1,
  },
  geo: {
    代际威胁分: 0.25,
    定位威胁分: 0.25,
    首报威胁分: 0.25,
    距离威胁分: 0.25,
  },
})
//导航卫星权重默认值
const navigation = reactive<{
  non_geo: {
    代际威胁分: number
    精度威胁分: number
    授时威胁分: number
    次数威胁分: number
    时长威胁分: number
  }
  geo: {
    代际威胁分: number
    精度威胁分: number
    授时威胁分: number
    距离威胁分: number
  }
}>({
  non_geo: {
    代际威胁分: 0.2,
    精度威胁分: 0.35,
    授时威胁分: 0.35,
    次数威胁分: 0.05,
    时长威胁分: 0.05,
  },
  geo: {
    代际威胁分: 0.25,
    精度威胁分: 0.25,
    授时威胁分: 0.25,
    距离威胁分: 0.25,
  },
})
//空间域感知卫星权重默认值
const space_domain_awareness = reactive<{
  non_geo: {
    代际威胁分: number
    监视威胁分: number
    次数威胁分: number
    时长威胁分: number
  }
  geo: {
    代际威胁分: number
    监视威胁分: number
    距离威胁分: number
  }
}>({
  non_geo: {
    代际威胁分: 0.2,
    监视威胁分: 0.5,
    次数威胁分: 0.15,
    时长威胁分: 0.15,
  },
  geo: {
    代际威胁分: 0.3,
    监视威胁分: 0.3,
    距离威胁分: 0.4,
  },
})

type ThreatWeightFieldMeta = { key: string; label: string }

type ThreatDatasetKey =
  | 'communication'
  | 'missile_early_warning'
  | 'navigation'
  | 'space_domain_awareness'
  | 'reconnaissance'
type ThreatOrbitKey = 'non_geo' | 'geo'

const threatWeightMeta: Record<ThreatDatasetKey, Record<ThreatOrbitKey, ThreatWeightFieldMeta[]>> = {
  communication: {
    non_geo: [
      { key: '代际威胁分', label: '代际威胁分' },
      { key: '吞吐量威胁分', label: '吞吐量威胁分' },
      { key: '延迟威胁分', label: '延迟威胁分' },
      { key: '次数威胁分', label: '次数威胁分' },
      { key: '时长威胁分', label: '时长威胁分' },
    ],
    geo: [
      { key: '代际威胁分', label: '代际威胁分' },
      { key: '吞吐量威胁分', label: '吞吐量威胁分' },
      { key: '延迟威胁分', label: '延迟威胁分' },
      { key: '距离威胁分', label: '距离威胁分' },
    ],
  },
  missile_early_warning: {
    non_geo: [
      { key: '代际威胁分', label: '代际威胁分' },
      { key: '定位威胁分', label: '定位威胁分' },
      { key: '首报威胁分', label: '首报威胁分' },
      { key: '次数威胁分', label: '次数威胁分' },
      { key: '时长威胁分', label: '时长威胁分' },
    ],
    geo: [
      { key: '代际威胁分', label: '代际威胁分' },
      { key: '定位威胁分', label: '定位威胁分' },
      { key: '首报威胁分', label: '首报威胁分' },
      { key: '距离威胁分', label: '距离威胁分' },
    ],
  },
  navigation: {
    non_geo: [
      { key: '代际威胁分', label: '代际威胁分' },
      { key: '精度威胁分', label: '精度威胁分' },
      { key: '授时威胁分', label: '授时威胁分' },
      { key: '次数威胁分', label: '次数威胁分' },
      { key: '时长威胁分', label: '时长威胁分' },
    ],
    geo: [
      { key: '代际威胁分', label: '代际威胁分' },
      { key: '精度威胁分', label: '精度威胁分' },
      { key: '授时威胁分', label: '授时威胁分' },
      { key: '距离威胁分', label: '距离威胁分' },
    ],
  },
  space_domain_awareness: {
    non_geo: [
      { key: '代际威胁分', label: '代际威胁分' },
      { key: '监视威胁分', label: '监视威胁分' },
      { key: '次数威胁分', label: '次数威胁分' },
      { key: '时长威胁分', label: '时长威胁分' },
    ],
    geo: [
      { key: '代际威胁分', label: '代际威胁分' },
      { key: '监视威胁分', label: '监视威胁分' },
      { key: '距离威胁分', label: '距离威胁分' },
    ],
  },
  reconnaissance: {
    non_geo: [
      { key: '代际威胁分', label: '代际威胁分' },
      { key: '分辨率威胁分', label: '分辨率威胁分' },
      { key: '定位威胁分', label: '定位威胁分' },
      { key: '次数威胁分', label: '次数威胁分' },
      { key: '时长威胁分', label: '时长威胁分' },
    ],
    geo: [
      { key: '代际威胁分', label: '代际威胁分' },
      { key: '定位威胁分', label: '定位威胁分' },
      { key: '分辨率威胁分', label: '分辨率威胁分' },
      { key: '距离威胁分', label: '距离威胁分' },
    ],
  },
}

const threatWeightLocks = reactive({
  communication: {
    non_geo: {
      代际威胁分: false,
      吞吐量威胁分: false,
      延迟威胁分: false,
      次数威胁分: false,
      时长威胁分: false,
    },
    geo: {
      代际威胁分: false,
      吞吐量威胁分: false,
      延迟威胁分: false,
      距离威胁分: false,
    },
  },
  missile_early_warning: {
    non_geo: {
      代际威胁分: false,
      定位威胁分: false,
      首报威胁分: false,
      次数威胁分: false,
      时长威胁分: false,
    },
    geo: {
      代际威胁分: false,
      定位威胁分: false,
      首报威胁分: false,
      距离威胁分: false,
    },
  },
  navigation: {
    non_geo: {
      代际威胁分: false,
      精度威胁分: false,
      授时威胁分: false,
      次数威胁分: false,
      时长威胁分: false,
    },
    geo: {
      代际威胁分: false,
      精度威胁分: false,
      授时威胁分: false,
      距离威胁分: false,
    },
  },
  space_domain_awareness: {
    non_geo: {
      代际威胁分: false,
      监视威胁分: false,
      次数威胁分: false,
      时长威胁分: false,
    },
    geo: {
      代际威胁分: false,
      监视威胁分: false,
      距离威胁分: false,
    },
  },
  reconnaissance: {
    non_geo: {
      代际威胁分: false,
      分辨率威胁分: false,
      定位威胁分: false,
      次数威胁分: false,
      时长威胁分: false,
    },
    geo: {
      代际威胁分: false,
      定位威胁分: false,
      分辨率威胁分: false,
      距离威胁分: false,
    },
  },
}) as Record<ThreatDatasetKey, Record<ThreatOrbitKey, Record<string, boolean>>>

const threatWeightGroups = {
  communication: communication,
  missile_early_warning: missile_early_warning,
  navigation: navigation,
  space_domain_awareness: space_domain_awareness,
  reconnaissance: reconnaissance,
} as Record<ThreatDatasetKey, Record<ThreatOrbitKey, Record<string, number>>>

// 确保同一分组内权重之和恒为 1 的工具逻辑
const rebalancingGroups = new WeakSet<Record<string, number>>()
const findChangedKey = (current: Record<string, number>, previous?: Record<string, number>) => {
  const keys = Object.keys(current)
  if (!previous) return keys[0]
  return keys.find((k) => Math.abs(current[k] - (previous?.[k] ?? 0)) > 1e-6) || keys[0]
}
const redistributeGroupWeights = (
  group: Record<string, number>,
  changedKey: string,
  locks?: Record<string, boolean>
) => {
  const keys = Object.keys(group)
  if (keys.length === 0) return
  const unlockedKeys = locks ? keys.filter((k) => !locks[k]) : keys
  if (unlockedKeys.length === 0) return

  const lockedSum = locks ? keys.filter((k) => locks[k]).reduce((sum, k) => sum + (group[k] ?? 0), 0) : 0
  const budget = Math.max(0, 1 - lockedSum)
  const activeKey = unlockedKeys.includes(changedKey) ? changedKey : unlockedKeys[0]
  const clamped = Math.min(budget, Math.max(0, group[activeKey]))
  const otherKeys = unlockedKeys.filter((k) => k !== activeKey)
  const remaining = budget - clamped

  group[activeKey] = clamped
  if (otherKeys.length === 0) return
  if (remaining <= 0) {
    otherKeys.forEach((k) => (group[k] = 0))
    group[activeKey] = budget
    return
  }

  const otherSum = otherKeys.reduce((sum, k) => sum + group[k], 0)
  if (otherSum === 0) {
    const share = remaining / otherKeys.length
    otherKeys.forEach((k) => (group[k] = parseFloat(share.toFixed(4))))
  } else {
    const scale = remaining / otherSum
    otherKeys.forEach((k) => (group[k] = parseFloat((group[k] * scale).toFixed(4))))
  }

  const total = otherKeys.reduce((sum, k) => sum + group[k], group[activeKey])
  const diff = budget - total
  const lastKey = otherKeys[otherKeys.length - 1]
  group[lastKey] = parseFloat((group[lastKey] + diff).toFixed(4))
}
const normalizeGroup = (
  group: Record<string, number>,
  previous?: Record<string, number>,
  locks?: Record<string, boolean>
) => {
  if (rebalancingGroups.has(group)) return
  const changedKey = findChangedKey(group, previous)
  rebalancingGroups.add(group)
  redistributeGroupWeights(group, changedKey, locks)
  rebalancingGroups.delete(group)
}
const registerWeightWatchers = () => {
  const weightGroups: Array<[Record<string, number>, Record<string, boolean>]> = [
    [communication.non_geo, threatWeightLocks.communication.non_geo],
    [communication.geo, threatWeightLocks.communication.geo],
    [missile_early_warning.non_geo, threatWeightLocks.missile_early_warning.non_geo],
    [missile_early_warning.geo, threatWeightLocks.missile_early_warning.geo],
    [navigation.non_geo, threatWeightLocks.navigation.non_geo],
    [navigation.geo, threatWeightLocks.navigation.geo],
    [reconnaissance.non_geo, threatWeightLocks.reconnaissance.non_geo],
    [reconnaissance.geo, threatWeightLocks.reconnaissance.geo],
    [space_domain_awareness.non_geo, threatWeightLocks.space_domain_awareness.non_geo],
    [space_domain_awareness.geo, threatWeightLocks.space_domain_awareness.geo],
  ]
  weightGroups.forEach(([group, locks]) => {
    watch(
      () => ({ ...group }),
      (_val, prev) => normalizeGroup(group, prev as Record<string, number> | undefined, locks),
      { deep: true, flush: 'sync' }
    )
  })
}

const handleWeightLockChange = (dataset: ThreatDatasetKey, orbit: ThreatOrbitKey) => {
  normalizeGroup(
    threatWeightGroups[dataset][orbit] as Record<string, number>,
    undefined,
    threatWeightLocks[dataset][orbit] as Record<string, boolean>
  )
}

// 获取任务威胁权重配置
const getConfigOfTask = async () => {
  let res =
    timeMode.value === '按任务总时长计算'
      ? await queryTaskThreatWeight(store.activedTask?.id!)
      : await queryTaskThreatWeight(store.activedTask?.id!, currentStep.value)
  if (res.code === 200) {
    const resWeight = JSON.parse(res.data) as ThreatWeight
    if (!resWeight) {
      ElMessage.warning('未找到对应的权重配置，使用默认值')
      return
    }
    taskThreatWeight.value = resWeight

    switch (searchForm.dataSet) {
      case 'communication':
        searchForm.dataSetLabel = '通信'
        Object.assign(communication, taskThreatWeight.value.communication)
        break
      case 'missile_early_warning':
        searchForm.dataSetLabel = '导弹预警'
        Object.assign(missile_early_warning, taskThreatWeight.value.missile_early_warning)
        break
      case 'navigation':
        searchForm.dataSetLabel = '导航'
        Object.assign(navigation, taskThreatWeight.value.navigation)
        break
      case 'reconnaissance':
        searchForm.dataSetLabel = '侦察'
        Object.assign(reconnaissance, taskThreatWeight.value.reconnaissance)
        break
      case 'space_domain_awareness':
        searchForm.dataSetLabel = '空间域感知'
        Object.assign(space_domain_awareness, taskThreatWeight.value.space_domain_awareness)
        break
      default:
        searchForm.dataSetLabel = ''
        break
    }
  }
  registerWeightWatchers()
  refresh(1, 10)
}

onUnmounted(() => {
  dispose()
})
function dispose() {
  charts1 && charts1.dispose()
  charts2 && charts2.dispose()
  charts3 && charts3.dispose()
  charts4 && charts4.dispose()
}
</script>
<style lang="scss" scoped>
.threat-container {
  --stv-surface-main: var(--surface-bg-color-strong);
  --stv-surface-soft: var(--surface-bg-color-soft);
  --stv-surface-base: var(--surface-bg-color);
  --stv-border: var(--surface-border-color);
  --stv-text-main: var(--text-color-primary);
  --stv-text-strong: var(--text-color-strong);
  --stv-text-muted: var(--text-color-secondary);
  --stv-accent: var(--accent-color);
  --stv-accent-soft: var(--accent-color-active);

  .header {
    width: 100%;
    padding: 10px;
    display: flex;
    flex-direction: column;

    .config-item {
      .input-value {
        width: 220px;
      }

      display: flex;
      flex-direction: column;
      padding: 5px 0;

      .config-item__title {
        text-align: left;
        font-weight: bold;
        color: var(--stv-accent);
        font-size: 16px;
      }

      .config-item_gx {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;

        .config-item_cx {
          display: flex;
          flex-direction: column;

          .title-gd {
            padding-bottom: 10px;
            font-weight: bold;
            color: #408340;
          }

          &>div {
            display: flex;
          }

          .config-item__cx {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;

            div {
              display: flex;
              flex-direction: column;

              span {
                text-align: left;
              }
            }
          }
        }
      }

      .config-item_score {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;

        &>div {
          display: flex;
          flex-direction: column;

          span {
            text-align: left;
          }
        }
      }

      .config-item__content {
        display: flex;
        align-items: center;
        justify-content: start;
        gap: 30px;

        div {
          width: 300px;
        }

        .item_title {
          display: flex;
          justify-content: space-between;
        }

        :deep(.atlas-app-slider) {
          padding: 0 10px;
        }
      }
    }
  }

  .main {
    .title {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: start;

      .date-picker-btn {
        display: flex;
        gap: 10px;
        align-items: center;
      }
    }

    padding: 10px;

    .main-title {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 10px 0;
      color: var(--stv-text-muted);
      font-weight: bold;
    }

    .count {
      display: flex;
      gap: 10px;
      justify-content: space-between;

      &>div {
        background: var(--stv-surface-main);
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        padding: 5px;

        &>span:first-child {
          font-size: 18px;
          font-weight: bold;
        }
      }
    }

    .graph-container {
      .graph-title {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 10px 0;
        color: var(--stv-text-muted);
        font-weight: bold;
      }

      .search-bar {
        display: flex;
        gap: 10px;
        padding: 10px 20%;
        justify-content: center;

        .search-input {
          padding-right: 10px;
          width: 200px;
        }
      }

      .graph-desc {
        padding: 5px;
        text-align: left;
        margin-bottom: 5px;
      }

      .graph-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-auto-rows: minmax(220px, auto);
        gap: 16px 12px;

        &>div {
          background: var(--stv-surface-main);
        }

        &.three-in-row {
          grid-template-columns: repeat(3, 1fr);
          grid-auto-rows: minmax(220px, auto);
          gap: 16px 12px;
        }
      }
    }

    .product-query-bar {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 18px 20px 20px;
      border-radius: 22px;
      background: linear-gradient(180deg, var(--stv-surface-soft), var(--stv-surface-base));
      border: 1px solid var(--stv-border);
      box-shadow: 0 14px 30px rgba(8, 24, 47, 0.3);
      align-items: stretch;
      box-sizing: border-box;

      .product-query-fields {
        display: flex;
        gap: 16px;
      }

      :deep(.atlas-app-switch) {
        align-items: flex-start;
      }

      .product-query-item {
        display: flex;
        flex-direction: column;
        gap: 7px;
        justify-content: flex-start;
        text-align: left;
        color: var(--stv-text-main);
        font-size: 13px;
        min-width: 0;

        &.product-query-item--dataset,
        &.product-query-item--count,
        &.product-query-item--longitude,
        &.product-query-item--key-factor,
        &.product-query-item--other-factor,
        &.product-query-item--sort {
          grid-column: span 2;
        }

        &.product-query-item--orbit,
        &.product-query-item--countries,
        &.product-query-item--search,
        &.product-query-item--view,
        &.product-query-item--action {
          grid-column: span 4;
        }

        &.product-query-item--action {
          align-self: stretch;
        }

        >span:first-child {
          display: inline-flex;
          align-items: center;
          min-height: 18px;
          color: var(--stv-text-strong);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        :deep(.el-select__wrapper),
        :deep(.el-input__wrapper),
        :deep(.el-input-number),
        :deep(.el-input-number__decrease),
        :deep(.el-input-number__increase) {
          height: 46px;
          min-height: 46px;
        }

        :deep(.el-select__wrapper),
        :deep(.el-input__wrapper) {
          background: linear-gradient(180deg, var(--stv-surface-soft), var(--stv-surface-base));
          box-shadow: inset 0 0 0 1px rgba(115, 170, 230, 0.22);
          border-radius: 14px;
        }

        :deep(.el-select),
        :deep(.el-input),
        :deep(.el-input-number) {
          width: 100% !important;
        }

        :deep(.el-input__inner),
        :deep(.el-select__placeholder),
        :deep(.el-select__selected-item),
        :deep(.el-input-number__decrease),
        :deep(.el-input-number__increase) {
          color: var(--stv-text-strong);
        }

        :deep(.el-input__inner::placeholder) {
          color: rgba(220, 235, 255, 0.65);
        }

        :deep(.el-select__wrapper:hover),
        :deep(.el-input__wrapper:hover),
        :deep(.el-input-number:hover) {
          box-shadow: inset 0 0 0 1px rgba(141, 189, 255, 0.32);
        }

        :deep(.el-tag.el-tag--info) {
          background: rgba(125, 172, 232, 0.18);
          border-color: rgba(125, 172, 232, 0.24);
          color: var(--stv-text-strong);
          height: 22px;
          line-height: 20px;
          border-radius: 999px;
        }

        :deep(.el-input-number) {
          display: flex;
          align-items: stretch;
          background: linear-gradient(180deg, var(--stv-surface-soft), var(--stv-surface-base));
          border-radius: 14px;
          box-shadow: inset 0 0 0 1px rgba(115, 170, 230, 0.22);
        }

        :deep(.el-input-number .el-input) {
          flex: 1;
          width: auto;
        }

        :deep(.el-input-number .el-input__wrapper) {
          background: transparent;
          box-shadow: none;
        }

        :deep(.el-input-number__decrease),
        :deep(.el-input-number__increase) {
          width: 34px;
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(115, 170, 230, 0.16);
        }

        .select,
        :deep(.el-input),
        :deep(.el-input-number) {
          width: 100%;
          min-width: 200px;
        }

        :deep(.el-button) {
          min-height: 46px;
        }
      }

      .product-refresh-btn {
        width: 100%;
        height: 46px;
        min-height: 46px;
        border-radius: 14px;
        border: none;
        background: var(--header-bg-gradient);
        font-weight: 700;
      }
    }

    .product-view-switch {
      display: flex;
      width: 100%;
      padding: 4px;
      height: 46px;
      min-height: 46px;
      background: linear-gradient(180deg, var(--stv-surface-soft), var(--stv-surface-base));
      border-radius: 14px;
      gap: 4px;
      align-items: center;
      box-shadow: inset 0 0 0 1px rgba(115, 170, 230, 0.22);

      .product-view-switch__btn {
        flex: 1;
        height: 38px;
        min-height: 38px;
        border: 0;
        background: transparent;
        color: var(--stv-text-main);
        padding: 8px 14px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 700;
        transition:
          background-color 0.2s ease,
          color 0.2s ease,
          box-shadow 0.2s ease;

        &.active {
          background: var(--header-bg-gradient);
          color: var(--stv-text-strong);
          box-shadow: 0 6px 12px rgba(31, 74, 118, 0.2);
        }
      }
    }

    .product-mode {
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin-top: 20px;
      color: var(--stv-text-main);
    }

    .product-formula-panel,
    .product-table-panel {
      background: linear-gradient(180deg, var(--stv-surface-soft), var(--stv-surface-base));
      border: 1px solid var(--stv-border);
      border-radius: 20px;
      padding: 18px 20px;
      box-shadow: 0 12px 28px rgba(8, 24, 47, 0.28);
    }

    .product-formula-panel__header {
      display: grid;
      grid-template-columns: 1.2fr 1fr auto;
      gap: 16px;
      align-items: start;
      margin-bottom: 16px;
    }

    .product-formula-panel__title {
      display: flex;
      flex-direction: column;
      gap: 8px;
      text-align: left;

      span {
        color: var(--stv-accent-soft);
        font-size: 13px;
        font-weight: 700;
      }

      strong {
        font-size: 18px;
        color: var(--stv-text-strong);
      }
    }

    .product-formula-panel__note {
      padding: 14px 18px;
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(79, 147, 221, 0.14), rgba(79, 147, 221, 0.08));
      color: var(--stv-text-main);
      line-height: 1.7;
      text-align: left;
      border: 1px solid rgba(132, 187, 238, 0.16);
    }

    .product-formula-panel__badge {
      align-self: center;
      color: var(--stv-text-strong);
      font-weight: 700;
      border: 1px solid rgba(79, 147, 221, 0.3);
      background: rgba(79, 147, 221, 0.32);
      padding: 10px 16px;
      border-radius: 999px;
      white-space: nowrap;
    }

    .product-formula-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .product-formula-card {
      background: linear-gradient(180deg, rgba(12, 38, 64, 0.78), rgba(9, 30, 51, 0.88));
      border: 1px solid var(--stv-border);
      border-radius: 16px;
      padding: 18px;
      text-align: left;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .product-formula-card__title {
      font-size: 16px;
      font-weight: 700;
      color: var(--stv-text-strong);
    }

    .product-formula-card__orbit {
      margin-top: 8px;
      color: var(--stv-accent-soft);
      font-weight: 600;
    }

    .product-formula-card__main {
      margin: 12px 0 16px;
      color: var(--stv-accent-soft);
      font-weight: 700;
      font-size: 16px;
    }

    .product-formula-item {
      margin-bottom: 14px;
    }

    .product-formula-item__label {
      margin-bottom: 4px;
      font-weight: 700;
      color: var(--stv-text-strong);
    }

    .product-formula-item__text {
      color: var(--stv-text-main);
      line-height: 1.7;
    }

    .product-warning-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .product-stat-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }

    .product-stat-card {
      background: linear-gradient(180deg, var(--stv-surface-soft), var(--stv-surface-base));
      border: 1px solid var(--stv-border);
      border-radius: 18px;
      padding: 20px 24px;
      box-shadow: 0 12px 24px rgba(8, 24, 47, 0.2);
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: 10px;

      span {
        color: var(--stv-accent-soft);
        font-size: 13px;
        font-weight: 700;
      }

      strong {
        font-size: 20px;
        color: var(--stv-text-strong);
      }
    }

    .product-request-error {
      margin-bottom: 12px;
      color: #ff9ead;
      text-align: left;
      font-weight: 600;
    }

    .product-table-panel {
      :deep(.el-table) {
        --el-table-header-bg-color: var(--surface-bg-color-strong);
        --el-table-tr-bg-color: var(--surface-bg-color);
        --el-table-row-hover-bg-color: rgba(79, 138, 209, 0.16);
        --el-table-border-color: var(--stv-border);
        --el-text-color-regular: var(--stv-text-main);
        --el-text-color-primary: var(--stv-text-strong);
        --el-fill-color-lighter: rgba(66, 116, 181, 0.16);
        border-radius: 12px;
        overflow: hidden;
      }

      :deep(.el-table th.el-table__cell) {
        color: var(--stv-accent-soft);
        font-weight: 700;
      }

      :deep(.el-table td.el-table__cell),
      :deep(.el-table__empty-block) {
        background: var(--surface-bg-color);
        color: var(--stv-text-main);
      }

      :deep(.el-table__inner-wrapper::before) {
        background-color: rgba(100, 149, 209, 0.16);
      }

      :deep(.el-tag) {
        border: none;
      }
    }

    .search {
      background: var(--stv-surface-main);
      border-radius: 5px;
      padding: 10px;
      margin: 10px 0;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;

      .select {
        width: 200px;
      }
    }

    .weight-panel {
      background: var(--stv-surface-main);
      border-radius: 5px;
      padding: 10px;
      margin: 10px 0;

      .wt {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .wl {
          display: flex;
          flex-direction: column;
          align-items: start;

          &> :first-child {
            font-size: 10px;
            color: #42a9ac;
          }
        }

        .tip {
          background: #42a9ac;
          border-radius: 5px;
          padding: 10px;
        }
      }

      .wb {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;

        .wb-l,
        .wb-r {
          background: var(--stv-surface-base);
          border-radius: 5px;
          box-shadow: 0 0 5px rgba(79, 147, 221, 0.4);
          padding: 20px;
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          align-items: start;

          div {
            width: 95%;
            padding: 0px 10px;
          }

          .orbit-label {
            font-size: 10px;
            color: #42a9ac;
          }

          .weight-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 10px;
          }

          .score-slider {
            display: flex;
            align-items: center;
            gap: 10px;
          }
        }
      }
    }

    .count-panel {
      background: var(--stv-surface-main);
      border-radius: 5px;
      padding: 10px;
      margin: 10px 0;
      display: grid;
      grid-template-columns: repeat(3, 1fr);

      div {
        display: flex;
        flex-direction: column;
        align-items: center;

        &>span:first-child {
          font-size: 10px;
          color: #42a9ac;
        }
      }
    }

    .table-panel {
      background: var(--stv-surface-main);
      border-radius: 5px;
      padding: 10px;
      margin: 10px 0;
    }
  }

  @media (max-width: 1400px) {
    .main {
      .product-query-bar {
        .product-query-fields {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }

        .product-query-item {

          &.product-query-item--dataset,
          &.product-query-item--count,
          &.product-query-item--longitude,
          &.product-query-item--key-factor,
          &.product-query-item--other-factor,
          &.product-query-item--sort {
            grid-column: span 2;
          }

          &.product-query-item--orbit,
          &.product-query-item--countries,
          &.product-query-item--search,
          &.product-query-item--view,
          &.product-query-item--action {
            grid-column: span 3;
          }
        }
      }

      .product-formula-panel__header {
        grid-template-columns: 1fr;
      }
    }
  }

  @media (max-width: 960px) {
    .main {

      .product-formula-grid,
      .product-stat-grid {
        grid-template-columns: 1fr;
      }

      .product-query-bar {
        .product-query-fields {
          grid-template-columns: 1fr;
        }

        .product-query-item {

          &.product-query-item--dataset,
          &.product-query-item--count,
          &.product-query-item--longitude,
          &.product-query-item--key-factor,
          &.product-query-item--other-factor,
          &.product-query-item--sort,
          &.product-query-item--orbit,
          &.product-query-item--countries,
          &.product-query-item--search,
          &.product-query-item--view,
          &.product-query-item--action {
            grid-column: span 1;
          }
        }
      }
    }
  }
}
</style>
