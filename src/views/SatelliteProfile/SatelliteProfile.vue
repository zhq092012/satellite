<template>
  <el-dialog
    v-model="dialogVisible"
    fullscreen
    append-to-body
    class="satellite-profile-dialog"
    title="卫星本体详情"
    :close-on-click-modal="false"
  >
    <div class="container">
      <div class="left">
        <div class="left-1">
          <div class="left-1-1">
            <div>
              <span>{{ satellite?.name_en }} </span>
            </div>
            <div>
              <span>轨道状态：{{ orbitStatusMap.get(Number(satellite?.orbit_status)) }}</span>
            </div>
            <div>
              <span>卫星类型：{{ satellite?.sat_type }}</span>
            </div>
          </div>
          <div>
            <img
              :src="getImgServerPath(satellite?.img!)"
              alt=""
              style="width: 150px; height: 150px"
              @error="
                (e) => {
                  const t = e.target as any
                  if (t && t['src'] !== satelliteFallback) t['src'] = satelliteFallback
                }
              "
            />
          </div>
          <div>
            <div class="desc-item">
              <span>发射时间</span> <span>{{ satellite?.launch_date }}</span>
            </div>
            <div class="desc-item">
              <span>国际编号</span> <span>{{ satellite?.int_id }}</span>
            </div>
          </div>
          <div>
            <div class="desc-item">
              <span>研制单位</span> <span>{{ satellite?.contractors }}</span>
            </div>
            <div class="desc-item">
              <span>研制国家</span> <span>{{ satellite?.country }}</span>
            </div>
          </div>
        </div>
        <div class="left-2">
          <div class="left-2-1">
            <span>研制背景</span>
          </div>
          <div class="left-2-2">
            <div>
              {{ satellite?.description }}
            </div>
          </div>
        </div>
        <div class="left-3">
          <div class="left-3-item">
            <span>{{ satellite?.a.toFixed(4) }}</span>
            <span>半长轴（KM）</span>
          </div>
          <div class="left-3-item">
            <span>{{ satellite?.e.toFixed(4) }}</span>
            <span>偏心率</span>
          </div>
          <div class="left-3-item">
            <span>{{ satellite?.i.toFixed(4) }}</span>
            <span>倾角</span>
          </div>
          <div class="left-3-item">
            <span>{{ satellite?.cycle.toFixed(4) }}</span>
            <span>周期（分钟）</span>
          </div>
        </div>
        <div class="left-4">
          <div class="left-4-title">装备配置</div>
          <div class="left-4-1">
            <span>卫星配置</span><span>{{ satellite?.configuration }}</span>
          </div>
          <div class="left-4-1">
            <span>卫星燃料</span><span>{{ satellite?.propulsion }}</span>
          </div>
          <div class="left-4-1">
            <span>电力装置</span><span>{{ satellite?.power }}</span>
          </div>
          <div class="left-4-1">
            <span>卫星平台</span><span>{{ satellite?.equipment }}</span>
          </div>
        </div>
        <div class="left-5">
          <div class="left-5-title">基本参数</div>

          <div class="left-5-1">
            <span>质量</span><span>{{ satellite?.mass }}kg</span>
          </div>
          <div class="left-5-1">
            <span>使用寿命</span><span>{{ satellite?.lifetime }}</span>
          </div>
          <div class="left-5-1">
            <span>目标形状</span><span>{{ satellite?.shape }}</span>
          </div>
          <div class="left-5-1">
            <span>目标尺寸（米）</span><span>{{ satellite?.span }}</span>
          </div>
          <div class="left-5-1">
            <span>目标直径（米）</span><span>{{ satellite?.diameter }}</span>
          </div>
          <div class="left-5-1">
            <span>横截面最大值（平方米）</span><span>{{ satellite?.xsectmax }}</span>
          </div>
          <div class="left-5-1">
            <span>横截面最小值（平方米）</span><span>{{ satellite?.xsectmin }}</span>
          </div>
          <div class="left-5-1">
            <span>横截面均值（平方米）</span><span>{{ satellite?.xsectavg }}</span>
          </div>
        </div>
      </div>
      <div class="center">
        <div class="center-top">
          <div class="center-top-tabs">
            <span
              v-for="item in analysis"
              :key="item.id"
              @click="activeName = item.name"
              :class="{ 'tab-item': true, active: activeName === item.name }"
              >{{ item.name }}</span
            >
          </div>
          <div v-if="activeName === '卫星TLE分析'" class="tab-7 tab-content">
            <div class="tle-card" v-if="tleTotal > 0" v-loading="tleLoading">
              <div class="tle-card__header">
                <div>
                  <div class="tle-card__title">卫星 TLE 数据</div>
                  <div class="tle-card__desc">支持分页查看，切换页码时自动重新请求数据</div>
                </div>
                <div class="tle-card__meta">共 {{ tleTotal }} 条</div>
              </div>

              <div class="tle-table-wrap">
                <el-table
                  v-if="satelliteTle.length"
                  :data="satelliteTle"
                  class="tle-table"
                  size="small"
                  show-overflow-tooltip
                  fit
                  show-header
                  height="100%"
                >
                  <!-- <el-table-column label="下载时间" width="160">
                  <template #default="{ row }">{{ formatTime(row.retrieval_time) }}</template>
                </el-table-column> -->
                  <el-table-column label="历元(UTC)" width="160">
                    <template #default="{ row }">{{ formatEpoch(row.epoch) }}</template>
                  </el-table-column>
                  <!-- <el-table-column prop="name" label="名称" width="120"></el-table-column> -->
                  <el-table-column prop="inclination" label="倾角(°)" width="100"></el-table-column>
                  <el-table-column prop="raan" label="升交点赤经(°)" width="140"></el-table-column>
                  <el-table-column prop="eccentricity" label="偏心率" width="100"></el-table-column>
                  <el-table-column prop="arg_perigee" label="近地点幅角(°)" width="140"></el-table-column>
                  <el-table-column prop="mean_anomaly" label="平近点角(°)" width="140"></el-table-column>
                  <el-table-column prop="semi_major_axis" label="半长轴(km)" width="140"></el-table-column>
                  <el-table-column label="TLE">
                    <template #default="{ row }">
                      <div class="tle-content">
                        <!-- <div class="tle-line">{{ row.line1 }}</div>
                      <div class="tle-line">{{ row.line2 }}</div> -->
                        <el-button size="small" plain @click="copyTle(row)">复制</el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
                <el-empty v-else-if="!tleLoading" description="暂无 TLE 数据" />
              </div>

              <div class="tle-card__footer" v-if="tleTotal > 0">
                <el-pagination
                  background
                  layout="total, prev, pager, next, sizes, jumper"
                  :total="tleTotal"
                  :current-page="tlePageNum"
                  :page-size="tlePageSize"
                  :page-sizes="[5, 10, 20, 50]"
                  @current-change="handleTleCurrentChange"
                  @size-change="handleTleSizeChange"
                />
              </div>
            </div>
            <div v-else class="tle-empty">
              <el-empty description="暂无 TLE 数据" />
            </div>
          </div>
          <div v-if="activeName === '特殊行为分析'" class="tab-1 tab-content">
            <div class="tab-1__type">
              <div class="tab-1__type__btns">
                <el-button
                  :class="activeType === '1' ? 'active' : ''"
                  size="small"
                  effect="plain"
                  @click="activeType = '1'"
                  >USA-314(2021-04-26)</el-button
                >
                <el-button
                  :class="activeType === '2' ? 'active' : ''"
                  size="small"
                  effect="plain"
                  @click="activeType = '2'"
                  >USA-290(2019-01-19)</el-button
                >
                <el-button
                  :class="activeType === '3' ? 'active' : ''"
                  size="small"
                  effect="plain"
                  @click="activeType = '3'"
                  >USA-245(2013-08-28)</el-button
                >
                <el-button
                  :class="activeType === '4' ? 'active' : ''"
                  size="small"
                  effect="plain"
                  @click="activeType = '4'"
                  >USA-224(2011-01-20)</el-button
                >
                <el-button
                  :class="activeType === '5' ? 'active' : ''"
                  size="small"
                  effect="plain"
                  @click="activeType = '5'"
                  >USA-186(2005-10-19)</el-button
                >
              </div>
            </div>

            <div class="tab-1__bd">
              <div class="tab-1__bd_tabs">
                <span :class="activeBD === '行为与活动' ? 'active' : ''" @click="activeBD = '行为与活动'"
                  >行为与活动</span
                >
                <span :class="activeBD === '重点机动记录' ? 'active' : ''" @click="activeBD = '重点机动记录'"
                  >重点机动记录</span
                >
              </div>
            </div>
            <div class="tab-1_bd__content" v-if="activeBD === '行为与活动'">
              <div class="tab-1_bd__content__left">
                <img :src="wx_video" alt="" srcset="" style="height: auto; width: 100%" />
              </div>

              <div class="tab-1_bd__content__right">
                <div class="grid-title">
                  <div class="his">
                    <div>历史数据检测</div>
                    <div>最终对象数据(纪元：2025-05-08T05:04:59.966Z)</div>
                  </div>
                  <div class="time">
                    <div class="timetitle">时间范围</div>
                    <el-select v-model="selectedDay" placeholder="" class="select" size="small">
                      <el-option label="近30天" value="30"> </el-option>
                    </el-select>
                  </div>
                </div>
                <div class="grid-count">
                  <div>
                    <span>6,778km</span>
                    <span>半长轴</span>
                  </div>
                  <div><span>0.001</span> <span>偏心率</span></div>
                  <div><span>97.5度</span> <span>轨道倾角</span></div>
                  <div><span>12 小时</span> <span>升交点赤经</span></div>
                  <div><span>270 度</span> <span>近地点辐角</span></div>
                  <div><span>94度</span> <span>平近点角</span></div>
                </div>
                <div class="mod-tabs-box">
                  <div class="mod-tabs">
                    <span
                      :class="activeAction === '轨道机动行为' ? 'active' : ''"
                      @click="activeAction = '轨道机动行为'"
                      >轨道机动行为</span
                    >
                    <span
                      :class="activeAction === '姿态机动行为' ? 'active' : ''"
                      @click="activeAction = '姿态机动行为'"
                      >姿态机动行为</span
                    >
                    <span
                      :class="activeAction === '无线电异常行为' ? 'active' : ''"
                      @click="activeAction = '无线电异常行为'"
                      >无线电异常行为</span
                    >
                    <span :class="activeAction === '覆盖区域' ? 'active' : ''" @click="activeAction = '覆盖区域'"
                      >覆盖区域</span
                    >
                  </div>
                  <div class="mod-content" v-if="activeAction === '轨道机动行为'">
                    <div class="l-box">
                      <div>
                        <span>45/月</span>
                        <span>轨道机动频率</span>
                      </div>
                      <div>
                        <span>1888</span>
                        <span>轨道机动次数</span>
                      </div>
                    </div>
                    <div class="r-box">
                      <!-- 图表位置 -->
                      <div class="charts1" id="charts1" style="height: 100%; width: 100%"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="activeName === '装备载荷能力'" class="tab-2 tab-content">
            <div class="grid-zh">
              <div class="l-zh">
                <div class="title">基础通用纬度</div>
                <div class="grid-ty">
                  <div>
                    <span>载荷名称/型号</span><span>{{ satellite?.name_en }}KEN</span>
                  </div>
                  <div><span>设计寿命</span><span>5至10年</span></div>
                  <div><span>载荷类型</span><span>光学侦察传感器</span></div>
                  <div><span>安全密级</span><span>绝密</span></div>
                  <div class="span2">
                    <span>制造商</span>
                    <span>洛克希德·马丁公司、波音公司</span>
                  </div>
                  <div class="span2">
                    <span>尺寸</span>
                    <span>长约10米，宽约3米，高约3米（估算）</span>
                  </div>
                  <div><span>功耗</span><span>高（千瓦级别）</span></div>
                  <div><span>散热需求</span><span>高</span></div>
                  <div class="span2-col">
                    <span>通信载荷</span>
                    <span>高速数据传输载荷、安全通信载荷</span>
                  </div>
                  <div class="span2-col">
                    <span>生存性与加固</span>
                    <span>抗辐射：具备抗辐射能力，可抵御太空辐射环境</span>
                    <span>抗EMP：具备抗电磁脉冲能力，防止EMP攻击</span>
                    <span>热防护：采用高效的热防护系统，确保在极端温度下正常运行</span>
                  </div>
                  <div class="span2-col">
                    <span>指向需求</span>
                    <span>成像：需要精确的指向控制，确保成像的准确性</span>
                    <span>定向通信/干扰：支持定向通信和干扰能力，具体细节未公开</span>
                  </div>
                </div>
              </div>
              <div class="r-zh">
                <div class="cs-box">
                  <div class="mod-tabs-box">
                    <div class="mod-tabs">
                      <span :class="activeCs1 === '成像载荷参数' ? 'active' : ''" @click="activeCs1 = '成像载荷参数'"
                        >成像载荷参数</span
                      >
                      <span :class="activeCs1 === '成像载荷特点' ? 'active' : ''" @click="activeCs1 = '成像载荷特点'"
                        >成像载荷特点</span
                      >
                    </div>
                    <div class="cs-content" v-if="activeCs1 === '成像载荷参数'">
                      <div>传感器类型：金色传感器</div>
                      <div>工作谱段：可见光-近红外（VNIR）</div>
                      <div>频率：0.4至1.1微米</div>
                      <div>空间分辨率：亚米级（具体数值未公开）</div>
                      <div>地面采样距离：约0.5米</div>
                      <div>幅宽：宽，覆盖效率高（具体数值未公开）</div>
                      <div>视场角：广角，支持大范围成像</div>
                      <div>成像模式：推扫式成像、凝视成像</div>
                      <div>夜间成像能力：具备夜视能力，能够在低光照条件下成像</div>
                      <div>云雾传统能力：具备一定的云雾穿透能力，提高成像的可靠性</div>
                    </div>
                  </div>
                </div>
                <div class="cs-box">
                  <div class="mod-tabs-box">
                    <div class="mod-tabs">
                      <span :class="activeCs2 === '遥感载荷参数' ? 'active' : ''" @click="activeCs2 = '遥感载荷参数'"
                        >遥感载荷参数</span
                      >
                      <span :class="activeCs2 === '遥感载荷特点' ? 'active' : ''" @click="activeCs2 = '遥感载荷特点'"
                        >遥感载荷特点</span
                      >
                    </div>
                    <div class="cs-content" v-if="activeCs2 === '遥感载荷参数'">
                      <div>传感器类型：金色传感器</div>
                      <div>工作谱段：可见光-近红外（VNIR）</div>
                      <div>频率：0.4至1.1微米</div>
                      <div>空间分辨率：亚米级（具体数值未公开）</div>
                      <div>地面采样距离：约0.5米</div>
                      <div>幅宽：宽，覆盖效率高（具体数值未公开）</div>
                      <div>视场角：广角，支持大范围成像</div>
                      <div>成像模式：推扫式成像、凝视成像</div>
                      <div>夜间成像能力：具备夜视能力，能够在低光照条件下成像</div>
                      <div>云雾传统能力：具备一定的云雾穿透能力，提高成像的可靠性</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="activeName === '作战威胁分析'" class="tab-3 tab-content">
            <div class="threat-panel">
              <div class="threat-panel__title">作战威胁分析</div>
              <div class="threat-panel__summary" v-if="currentThreat">
                <div class="summary-item">
                  <span>卫星名称</span>
                  <strong>{{ currentThreat.name_en }}</strong>
                </div>
                <div class="summary-item">
                  <span>国家</span>
                  <strong>{{ currentThreat.country }}</strong>
                </div>
                <div class="summary-item">
                  <span>轨道类型</span>
                  <strong>{{ currentThreat.orbit_type }}</strong>
                </div>
                <div class="summary-item">
                  <span>卫星类型</span>
                  <strong>{{ currentThreat.sat_type }}</strong>
                </div>
                <div class="summary-item">
                  <span>综合威胁分数</span>
                  <strong>{{ Number(currentThreat['综合威胁分数']).toFixed(4) }}</strong>
                </div>
                <div class="summary-item">
                  <span>威胁指数</span>
                  <strong>{{ currentThreat['威胁指数(0-100)'] }}</strong>
                </div>
                <div class="summary-item">
                  <span>威胁等级</span>
                  <strong>{{ currentThreat['威胁等级'] }}</strong>
                </div>
              </div>
              <div v-if="!satelliteThreat.length" class="threat-empty">暂无卫星威胁度数据</div>
              <el-table
                v-if="satelliteThreat.length"
                :data="satelliteThreat"
                stripe
                size="small"
                style="width: 100%"
                show-header
                fit
              >
                <el-table-column prop="全局排名" label="全局排名" width="100" />
                <!-- <el-table-column prop="组内排名" label="组内排名" width="100" /> -->
                <el-table-column prop="name_en" label="卫星名称" width="140" />
                <el-table-column prop="country" label="国家" width="100" />
                <el-table-column prop="orbit_type" label="轨道类型" width="120" />
                <el-table-column prop="sat_type" label="卫星类型" width="120" />
                <el-table-column label="代际威胁分" width="120">
                  <template #default="{ row }">{{ Number(row['代际威胁分']).toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="分辨率威胁分" width="120">
                  <template #default="{ row }">{{ Number(row['分辨率威胁分']).toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="定位威胁分" width="120">
                  <template #default="{ row }">{{ Number(row['定位威胁分']).toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="次数威胁分" width="120">
                  <template #default="{ row }">{{ Number(row['次数威胁分']).toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="时长威胁分" width="120">
                  <template #default="{ row }">{{ Number(row['时长威胁分']).toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="距离威胁分" width="120">
                  <template #default="{ row }">{{ Number(row['距离威胁分']).toFixed(4) }}</template>
                </el-table-column>
                <el-table-column label="预测日期" width="140">
                  <template #default="{ row }">{{
                    row['Subpoint and distance to Taiwan Strait'] || row.preDate
                  }}</template>
                </el-table-column>
                <el-table-column label="威胁等级" width="120">
                  <template #default="{ row }">{{ row['威胁等级'] }}</template>
                </el-table-column>
              </el-table>
            </div>
          </div>
          <div v-if="activeName === '可打击度分析'" class="tab-3 tab-content">
            <div class="strike-panel" v-loading="strikeLoading">
              <div class="strike-panel__header">
                <div>
                  <div class="strike-panel__title">可打击度分析</div>
                  <div class="strike-panel__desc">基于当前任务的卫星-武器关系，展示可打击目标及对应窗口</div>
                </div>
                <div class="strike-panel__badge">{{ satelliteStrikeList.length }} 个目标</div>
              </div>

              <div class="strike-panel__summary">
                <div class="summary-item">
                  <span>目标总数</span>
                  <strong>{{ satelliteAttack?.num || satelliteStrikeList.length || 0 }}</strong>
                </div>
                <div class="summary-item">
                  <span>高可打击</span>
                  <strong>{{ satelliteAttack?.hightNum || 0 }}</strong>
                </div>
                <div class="summary-item">
                  <span>低可打击</span>
                  <strong>{{ satelliteAttack?.lowNum || 0 }}</strong>
                </div>
                <div class="summary-item">
                  <span>最高分</span>
                  <strong>{{ formatStrikeScore(satelliteAttack?.maxStrikeScore) }}</strong>
                </div>
                <div class="summary-item">
                  <span>最低分</span>
                  <strong>{{ formatStrikeScore(satelliteAttack?.minStrikeScore) }}</strong>
                </div>
              </div>

              <div v-if="!satelliteStrikeList.length && !strikeLoading" class="strike-empty">暂无可打击度数据</div>

              <el-table
                v-else
                :data="satelliteStrikeList"
                stripe
                size="small"
                style="width: 100%"
                show-header
                fit
                height="30%"
              >
                <el-table-column type="index" label="序号" width="70" />
                <el-table-column prop="name" label="卫星名称" width="160" show-overflow-tooltip />
                <el-table-column prop="country" label="国家" width="100" />
                <el-table-column prop="orbit_type" label="轨道类型" width="100" />
                <el-table-column prop="sat_type" label="卫星类型" width="120" />
                <el-table-column prop="orbit_altitude_km" label="轨道高度(km)" width="120">
                  <template #default="{ row }">{{ Number(row.orbit_altitude_km).toFixed(4) }} </template>
                </el-table-column>
                <el-table-column prop="strikeability_score" label="可打击度" width="110">
                  <template #default="{ row }">{{ formatStrikeScore(row.strikeability_score) }}</template>
                </el-table-column>
                <el-table-column label="武器数量" width="90">
                  <template #default="{ row }">{{ row.weapons_window?.length || 0 }}</template>
                </el-table-column>
                <el-table-column label="位置详情" min-width="260">
                  <template #default="{ row }">
                    <div class="strike-detail">
                      <div>方法：{{ row.x1_details?.method || '--' }}</div>
                      <div>
                        星下点：{{ formatStrikeNullable(row.x1_details?.subsatellite_latitude) }},
                        {{ formatStrikeNullable(row.x1_details?.subsatellite_longitude) }}
                      </div>
                      <div>高度：{{ formatStrikeNullable(row.x1_details?.subsatellite_height_km) }} km</div>
                    </div>
                  </template>
                </el-table-column>
              </el-table>

              <div class="strike-window-panel" v-if="satelliteStrikeWindowRows.length">
                <div class="strike-window-panel__title">武器窗口</div>

                <div v-for="item in satelliteStrikeWindowRows" :key="item.norad_id" class="strike-window-card">
                  <div class="strike-window-card__header">
                    <strong>{{ item.name }}</strong>
                    <span>{{ item.country }} / {{ item.sat_type }}</span>
                  </div>
                  <div class="strike-window-card__score">
                    可打击度：{{ formatStrikeScore(item.strikeability_score) }}
                  </div>
                  <div class="weapon-window-list">
                    <div
                      v-for="windowItem in item.weapons_window"
                      :key="windowItem.id"
                      class="strike-window-panel__grid"
                      size="small"
                    >
                      <div>{{ windowItem.name }}</div>

                      <div>{{ windowItem.strike_window }}</div>
                    </div>
                    <span v-if="!item.weapons_window.length" class="strike-muted">无可用窗口</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="activeName === '卫星网络分析'" class="tab-6 tab-content">
            <div v-if="graphData"><div ref="graphContainer" class="graph-container"></div></div>
            <div v-else class="graph-empty">
              <el-empty description="暂无卫星网络数据" />
            </div>
          </div>
          <div v-if="activeName === '技术特点分析'" class="tab-4 tab-content">
            <div class="tab-1__type">
              <div class="tab-1__type__btns">
                <el-button :class="jstdType === '1' ? 'active' : ''" size="small" effect="plain" @click="jstdType = '1'"
                  >光学系统</el-button
                >
                <el-button :class="jstdType === '2' ? 'active' : ''" size="small" effect="plain" @click="jstdType = '2'"
                  >传感器系统</el-button
                >
                <el-button :class="jstdType === '3' ? 'active' : ''" size="small" effect="plain" @click="jstdType = '3'"
                  >轨道设计</el-button
                >
                <el-button :class="jstdType === '4' ? 'active' : ''" size="small" effect="plain" @click="jstdType = '4'"
                  >数据处理及传输</el-button
                >
              </div>
              <div class="tab-1__time">
                <div class="tab-1__timetitle">时间范围</div>
                <el-select v-model="selectedDay" placeholder="" class="select" size="small">
                  <el-option label="近30天" value="30"> </el-option>
                </el-select>
              </div>
            </div>
            <div class="tab-4__content">
              <div class="l-box">
                <div class="l-box__title">光学系统设计特点</div>
                <div class="l-box__content">
                  <div>大口径反射镜</div>
                  <p>
                    {{
                      satellite?.name_en
                    }}采用了大口径的反射镜设计，能够捕获更多的光线，从而提高成像的分辨率和质量。这种设计使得{{
                      satellite?.name_en
                    }}能够在 远距离拍摄出清晰的图像，支持对地球表面的详细侦察。
                  </p>
                </div>
                <div>
                  <div>大口径反射镜</div>
                  <p>
                    {{
                      satellite?.name_en
                    }}采用了大口径的反射镜设计，能够捕获更多的光线，从而提高成像的分辨率和质量。这种设计使得{{
                      satellite?.name_en
                    }}能够在 远距离拍摄出清晰的图像，支持对地球表面的详细侦察。
                  </p>
                </div>
                <div>
                  <div>大口径反射镜</div>
                  <p>
                    {{
                      satellite?.name_en
                    }}采用了大口径的反射镜设计，能够捕获更多的光线，从而提高成像的分辨率和质量。这种设计使得{{
                      satellite?.name_en
                    }}能够在 远距离拍摄出清晰的图像，支持对地球表面的详细侦察。
                  </p>
                </div>
              </div>
              <div class="r-box">
                <div class="r-box__title">设计结构图</div>
                <div class="img-box">
                  <img :src="wxsjt" alt="" />
                </div>
              </div>
            </div>
          </div>
          <div v-if="activeName === '衍生型号分析'" class="tab-5 tab-content">
            <div class="tab-2__type">
              <div class="tab-2__time">
                <div class="tab-2__timetitle">时间范围</div>
                <el-select v-model="selectedDay" placeholder="" class="select" size="small">
                  <el-option label="近30天" value="30"> </el-option>
                </el-select>
              </div>
            </div>
            <div class="tab-5__content">
              <div class="l-box">
                <div class="title-box">型号列表</div>
                <div v-if="derivativeModels.length" class="img-box dynamic-model-list">
                  <div
                    v-for="(item, index) in derivativeModels"
                    :key="`${item.derivativeName || 'derivative'}-${index}`"
                    :class="[
                      'img-item',
                      {
                        active: selectedDerivativeIndex === index,
                        editing: editingDerivativeIndex === index,
                      },
                    ]"
                    @click="selectDerivative(index)"
                    @dblclick="startDerivativeEdit(index)"
                  >
                    <template v-if="editingDerivativeIndex === index">
                      <el-input
                        v-model="editableAdvantageOrDisadvantage.derivativeModels[index].derivativeName"
                        size="small"
                        placeholder="请输入型号名称"
                      />
                      <el-input
                        v-model="editableAdvantageOrDisadvantage.derivativeModels[index].derivativeImage"
                        size="small"
                        placeholder="请输入型号图片地址"
                      />
                    </template>
                    <template v-else>
                      <img
                        :src="resolveDerivativeImage(item.derivativeImage)"
                        alt=""
                        srcset=""
                        @error="handleDerivativeImageError"
                      />
                      <div>{{ item.derivativeName || `型号${index + 1}` }}</div>
                    </template>
                  </div>
                </div>
                <el-empty v-else description="暂无衍生型号数据" />
              </div>
              <div class="r-box">
                <div class="title-box title-box--editable">
                  <span>发展过程</span>
                  <div v-if="editingDerivativeIndex === selectedDerivativeIndex" class="profile-actions">
                    <el-button size="small" text @click.stop="cancelProfileEditing">取消</el-button>
                    <el-button size="small" type="primary" :loading="profileSaving" @click.stop="saveProfileData">
                      保存
                    </el-button>
                  </div>
                </div>
                <div
                  v-if="currentDerivativeModel"
                  class="content-box content-box--editable"
                  @dblclick="startDerivativeEdit(selectedDerivativeIndex)"
                >
                  <el-input
                    v-if="editingDerivativeIndex === selectedDerivativeIndex"
                    v-model="
                      editableAdvantageOrDisadvantage.derivativeModels[selectedDerivativeIndex].derivativeProcess
                    "
                    type="textarea"
                    :rows="14"
                    resize="none"
                    placeholder="请输入发展过程"
                  />
                  <div v-else class="content-box__text">
                    {{ currentDerivativeModel.derivativeProcess || '暂无发展过程数据' }}
                  </div>
                </div>
                <el-empty v-else description="暂无发展过程数据" />
              </div>
            </div>
          </div>
        </div>

        <div class="center-bottom">
          <div class="center-bottom_tabs">
            <span :class="activeSJ === '相关事件' ? 'active' : ''" @click="activeSJ = '相关事件'">相关事件</span>
            <span :class="activeSJ === '情报监测' ? 'active' : ''" @click="activeSJ = '情报监测'">情报监测</span>
            <span :class="activeSJ === '仿真情报' ? 'active' : ''" @click="activeSJ = '仿真情报'">仿真情报</span>
          </div>
          <div class="center-bottom_content" v-if="activeSJ === '相关事件'">
            <el-timeline style="width: 100%; padding: 10px">
              <el-timeline-item :color="timelineColor" v-for="(news, index) in satelliteNews" :key="index">
                <div class="grid-box">
                  <div class="grid-box_l">
                    <div>
                      <span>{{ news.pubTime }}</span>
                    </div>
                  </div>
                  <div class="grid-box_r">
                    <div class="news-title">{{ news.title }}</div>
                    <div class="news-content-row">
                      <span>{{ getNewsPreview(news.content) }}</span>
                      <el-button class="news-more-btn" link type="primary" @click="openNewsDetail(news)">
                        更多
                      </el-button>
                    </div>
                    <div class="news-tags">
                      <el-tag v-for="(tag, tagIndex) in news.abstracts" :key="`${index}-${tagIndex}`" size="small">
                        {{ tag }}
                      </el-tag>
                    </div>
                  </div>
                </div>
              </el-timeline-item>
            </el-timeline>
          </div>
          <div class="center-bottom_content" v-if="activeSJ === '情报监测'">
            <div class="qbjc-search">
              <span>情报类型</span>
              <span
                ><el-select
                  v-model="intelligenceType"
                  placeholder="请选择"
                  size="small"
                  style="width: 100px"
                  @change="loadSatelliteIntelligence"
                >
                  <el-option v-for="type in IntelligenceTypeArr" :label="type" :value="type" /> </el-select
              ></span>
              <span>情报来源</span>
              <span
                ><el-select
                  v-model="intelligenceSourceType"
                  placeholder="请选择"
                  size="small"
                  style="width: 100px"
                  @change="loadSatelliteIntelligence"
                >
                  <el-option v-for="source in IntelligenceSourceTypeArr" :label="source" :value="source" /> </el-select
              ></span>
              <span>时间范围</span>
              <span
                ><el-select
                  v-model="dateRange"
                  placeholder="请选择"
                  size="small"
                  style="width: 100px"
                  @change="loadSatelliteIntelligence"
                >
                  <el-option
                    v-for="option in dateRangeOptions"
                    :label="option.label"
                    :value="option.value"
                  /> </el-select
              ></span>

              <el-button type="primary" size="small" @click="openIntelligenceNew('情报监测')">添加情报监测</el-button>
            </div>
            <div class="qbjc-content">
              <div class="qbjc-item" v-for="item in qbjcList" :key="item.id" @dblclick="openIntelligenceEditor(item)">
                <div class="qbjc-img">
                  <template v-if="isImageMedia(item.mediaUrl)">
                    <img :src="item.mediaUrl" alt="" style="width: 100%; height: 250px; object-fit: cover" />
                  </template>
                  <template v-else-if="isVideoMedia(item.mediaUrl)">
                    <video controls :src="item.mediaUrl" style="width: 100%; height: 250px"></video>
                  </template>
                  <template v-else-if="isAudioMedia(item.mediaUrl)">
                    <audio controls :src="item.mediaUrl" style="width: 100%; height: 250px"></audio>
                  </template>
                </div>
                <div class="qbjc-title">{{ item.title }}</div>
                <div class="qbjc-source">
                  <span>情报来源</span> <span>{{ item.source }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="center-bottom_content" v-if="activeSJ === '仿真情报'">
            <div class="qbjc-search">
              <span>情报类型</span>
              <span
                ><el-select
                  v-model="intelligenceType"
                  placeholder="请选择"
                  size="small"
                  style="width: 100px"
                  @change="loadSatelliteIntelligence"
                >
                  <el-option v-for="type in IntelligenceTypeArr" :label="type" :value="type" /> </el-select
              ></span>
              <span>情报来源</span>
              <span
                ><el-select
                  v-model="intelligenceSourceType"
                  placeholder="请选择"
                  size="small"
                  style="width: 100px"
                  @change="loadSatelliteIntelligence"
                >
                  <el-option v-for="source in IntelligenceSourceTypeArr" :label="source" :value="source" /> </el-select
              ></span>
              <span>时间范围</span>
              <span
                ><el-select
                  v-model="dateRange"
                  placeholder="请选择"
                  size="small"
                  style="width: 100px"
                  @change="loadSatelliteIntelligence"
                >
                  <el-option
                    v-for="option in dateRangeOptions"
                    :label="option.label"
                    :value="option.value"
                  /> </el-select
              ></span>

              <el-button type="primary" size="small" @click="openIntelligenceNew('仿真情报')">添加仿真情报</el-button>
            </div>
            <div class="fzqb-content">
              <div class="fzqb-item" v-for="item in fzqbList" :key="item.id" @dblclick="openIntelligenceEditor(item)">
                <div class="fzqb-title">{{ item.title }}</div>
                <div class="fzqb-article">{{ item.content }}</div>
                <div class="fzqb-source">
                  <span>来源：</span> <span>{{ item.source }}</span> <span>时间：</span> <span>{{ item.time }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="right">
        <div class="right_tabs">
          <span :class="activeZB === '装备优势' ? 'active' : ''" @click="activeZB = '装备优势'">装备优势</span>
          <span :class="activeZB === '装备弱点' ? 'active' : ''" @click="activeZB = '装备弱点'">装备弱点</span>
        </div>
        <div class="right_tabs_content">
          <template v-if="currentCognitionList.length">
            <div
              v-for="(item, index) in currentCognitionList"
              :key="`${currentCognitionKey}-${index}`"
              class="right_tabs_content_item"
              @dblclick="startCognitionEdit(index)"
            >
              <template v-if="isEditingCognitionItem(index)">
                <el-input v-model="item.title" size="small" placeholder="请输入标题" />
                <div class="item item--editing">
                  <el-input v-model="item.content" type="textarea" :rows="4" resize="none" placeholder="请输入内容" />
                  <div class="son">
                    <div class="son-tag">{{ activeZB === '装备优势' ? '优势特征' : '弱点特征' }}</div>
                    <div v-for="(feature, featureIndex) in item.keyFeatures" :key="featureIndex" class="son-editor">
                      <el-input v-model="feature.featureName" size="small" placeholder="请输入特征名称" />
                      <el-input
                        v-model="feature.featureContent"
                        type="textarea"
                        :rows="2"
                        resize="none"
                        placeholder="请输入特征内容"
                      />
                    </div>
                  </div>
                  <div class="profile-actions profile-actions--right">
                    <el-button size="small" text @click.stop="cancelProfileEditing">取消</el-button>
                    <el-button size="small" type="primary" :loading="profileSaving" @click.stop="saveProfileData">
                      保存
                    </el-button>
                  </div>
                </div>
              </template>
              <template v-else>
                <span class="title">{{ item.title || '未命名条目' }}</span>
                <div class="item">
                  <div class="item-title">{{ item.content || '暂无内容' }}</div>
                  <div class="son">
                    <div class="son-tag">{{ activeZB === '装备优势' ? '优势特征' : '弱点特征' }}</div>
                    <div v-for="(feature, featureIndex) in item.keyFeatures" :key="featureIndex" class="son-item">
                      <strong>{{ feature.featureName || `特征${featureIndex + 1}` }}</strong>
                      <span>{{ feature.featureContent || '暂无描述' }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </template>
          <el-empty v-else :description="activeZB === '装备优势' ? '暂无装备优势数据' : '暂无装备弱点数据'" />
        </div>
      </div>
    </div>
  </el-dialog>

  <el-dialog v-model="newsDetailVisible" title="新闻详情" width="720px" append-to-body>
    <div v-if="selectedNews" class="news-detail">
      <div class="news-detail__title">{{ selectedNews.title || '未命名新闻' }}</div>
      <div class="news-detail__meta">发布时间：{{ selectedNews.pubTime || '--' }}</div>
      <div class="news-detail__content">{{ selectedNews.content || '暂无内容' }}</div>
    </div>
    <template #footer>
      <el-button type="primary" @click="newsDetailVisible = false">关闭</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="intelligenceEditorVisible" title="编辑情报信息" width="680px" append-to-body>
    <div class="intelligence-editor">
      <div class="intelligence-editor__meta">
        <span>情报类型：{{ intelligenceDraft.type || '--' }}</span>
        <span>来源类型：{{ intelligenceDraft.sourceType || '--' }}</span>
      </div>
      <el-form label-width="88px">
        <el-form-item label="标题">
          <el-input v-model="intelligenceDraft.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="来源">
          <el-input v-model="intelligenceDraft.source" placeholder="请输入来源" />
        </el-form-item>
        <el-form-item label="来源类型">
          <el-select v-model="intelligenceDraft.sourceType" placeholder="请选择来源类型" style="width: 100%">
            <el-option v-for="source in IntelligenceSourceTypeArr" :key="source" :label="source" :value="source" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="intelligenceDraft.content"
            type="textarea"
            :rows="8"
            resize="none"
            placeholder="请输入内容"
          />
        </el-form-item>
        <el-form-item v-if="isMediaIntelligenceType(intelligenceDraft.type)" label="上传文件">
          <div class="intelligence-editor__upload">
            <input :accept="intelligenceFileAccept" type="file" @change="handleIntelligenceFileChange" />
            <span class="intelligence-editor__file-name">{{
              intelligenceSelectedFileName || '未选择新文件，将保留原文件'
            }}</span>
          </div>
        </el-form-item>
        <el-form-item
          v-if="isMediaIntelligenceType(intelligenceDraft.type) && currentIntelligenceMediaUrl"
          label="当前文件"
        >
          <div class="intelligence-editor__preview">
            <img
              v-if="intelligenceDraft.type === '图片'"
              :src="currentIntelligenceMediaUrl"
              alt=""
              style="max-width: 100%; max-height: 200px"
            />
            <video
              v-else-if="intelligenceDraft.type === '视频'"
              controls
              :src="currentIntelligenceMediaUrl"
              style="max-width: 100%; max-height: 200px"
            ></video>
            <audio
              v-else-if="intelligenceDraft.type === '音频'"
              controls
              :src="currentIntelligenceMediaUrl"
              style="max-width: 100%; max-height: 200px"
            ></audio>
          </div>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <div class="profile-actions">
        <el-button @click="cancelIntelligenceEditing">取消</el-button>
        <el-button type="primary" :loading="intelligenceSaving" @click="saveIntelligenceEditing">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch, computed } from 'vue'
import * as echarts from 'echarts'
import satelliteFallback from '@/assets/img/satellite.png'
import wx_video from '@/assets/img/profile/wx_video.png'
import wxsjt from '@/assets/img/profile/wxsjt.png'
import {
  getAllThreatList,
  getSatelliteDetail,
  getSatelliteRelationsBySatellite,
  getSatelliteTlePages,
  updateStrikeOfTaskV2,
} from '@/api/dashboard'
import { getImgServerPath, getMediaServerPath } from '@/utils/tools/funcs'
import type { EdgeConfig, Graph, NodeConfig } from '@antv/g6'
import G6 from '@antv/g6'
import { useLayoutStore } from '@/store/modules/layout'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import type { ThreatTaskWeightsResponse } from '@/types/threat'
import type { StrikeV2 } from '@/types/strike'
import {
  getSatelliteProfileAdvantageOrDisadvantage,
  IntelligenceTypeArr,
  IntelligenceSourceTypeArr,
  uploadSatelliteProfileIntelligence,
  saveSatelliteProfileAdvantageOrDisadvantage,
  type SatelliteAdvantageOrDisadvantage,
  getSatelliteProfileIntelligenceList,
  type SatelliteProfileIntelligence,
  getSatelliteProfileNewsList,
} from '@/api/profile/satellite-profile-api'
import type { SatelliteNode, SatelliteRelation } from '@/types/dashboard'

const props = withDefaults(
  defineProps<{
    modelValue?: boolean
    norad?: number | string | null
  }>(),
  {
    modelValue: false,
    norad: null,
  }
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const norad = computed(() => {
  const rawNorad = props.norad
  if (rawNorad === null || rawNorad === undefined || rawNorad === '') return NaN
  const normalizedNorad = Number(rawNorad)
  return Number.isFinite(normalizedNorad) ? normalizedNorad : NaN
})

const store = useLayoutStore()
const satellite = ref<SatelliteDetail>()
// 卫星网络视图
let graph: Graph
const graphContainer = ref<HTMLElement | null>(null)
const getThemeColor = (token: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return value || fallback
}
const themePalette = {
  accent: getThemeColor('--accent-color', '#4f93dd'),
  accentStrong: getThemeColor('--accent-color-active', '#7ec4ff'),
  text: getThemeColor('--text-color-primary', '#dbe9ff'),
  textStrong: getThemeColor('--text-color-strong', '#eef6ff'),
  textMuted: getThemeColor('--text-color-secondary', '#9fb3c8'),
  line: getThemeColor('--surface-border-color', 'rgba(143, 176, 207, 0.55)'),
  chartGrid: 'rgba(171, 205, 234, 0.22)',
  danger: '#f56c6c',
}
const timelineColor = themePalette.accent

const aggregateRelationships = (relations: any[]) => {
  const edgeMap = new Map<
    string,
    {
      source: number
      target: number
      relation: string
      count: number
      latestTimestamp: string | null
    }
  >()

  relations.forEach((item) => {
    const source = Number(item.source)
    const target = Number(item.target)
    if (!Number.isFinite(source) || !Number.isFinite(target)) return
    const relation = String(item.relation || '未知关系')
    const timestamp = item.timestamp ? String(item.timestamp) : null
    const a = Math.min(source, target)
    const b = Math.max(source, target)
    const key = `${a}-${b}-${relation}`

    const existing = edgeMap.get(key)
    if (!existing) {
      edgeMap.set(key, {
        source,
        target,
        relation,
        count: 1,
        latestTimestamp: timestamp,
      })
      return
    }

    existing.count += 1
    if (timestamp && (!existing.latestTimestamp || timestamp > existing.latestTimestamp)) {
      existing.latestTimestamp = timestamp
    }
  })

  return Array.from(edgeMap.values())
}

const graphData = ref<{ nodes: SatelliteNode[]; relationships: SatelliteRelation[] } | null>(null)

async function initGraph() {
  await nextTick()
  const container = graphContainer.value
  let graphWidth = 800
  let graphHeight = 600
  if (container) {
    const width = container.clientWidth || container.scrollWidth || 800
    const height = container.clientHeight || container.scrollHeight || 600
    graphWidth = width
    graphHeight = height
    const graphDestroyed = !!(graph as any)?.get?.('destroyed')
    const graphContainerEl = (graph as any)?.get?.('container') as HTMLElement | undefined
    const containerChanged = !!graph && !!graphContainerEl && graphContainerEl !== container

    // tab 使用 v-if 切换时，DOM 会被重建。旧 graph 若仍绑定旧容器，会出现“有数据但不显示”。
    if (containerChanged && graph && !graphDestroyed) {
      graph.destroy()
      ;(graph as any) = undefined
    }

    if (!graph || graphDestroyed || containerChanged) {
      graph = new G6.Graph({
        container,
        width,
        height,
        minZoom: 0.25,
        maxZoom: 4,
        fitViewPadding: 40,
        defaultNode: {
          size: 2,
          style: {
            fill: themePalette.accentStrong,
            stroke: themePalette.accent,
            lineWidth: 0.3,
          },
          labelCfg: {
            position: 'bottom',
            offset: 1,
            style: {
              fill: themePalette.text,
              fontSize: 20,
            },
          },
        },
        defaultEdge: {
          size: 1,
          style: {
            lineWidth: 1,
            endArrow: {
              path: G6.Arrow.triangle(1.2, 2, 0.2),
              d: 0,
            },
            stroke: themePalette.line,
          },
          type: 'line',
          labelCfg: {
            autoRotate: true,
            refY: 1.5,
            offset: 1,
            style: {
              fill: themePalette.text,
              fontSize: 5,
            },
          },
        },
        nodeStateStyles: {
          selected: {
            fill: themePalette.accentStrong,
            stroke: themePalette.accent,
            lineWidth: 1,
          },
          highlight: {
            fill: themePalette.danger,
            lineWidth: 1,
            stroke: themePalette.danger,
          },
        },
        edgeStateStyles: {
          selected: {
            fill: themePalette.accentStrong,
            stroke: themePalette.accent,
            lineWidth: 1,
          },
        },
        modes: {
          default: [
            {
              type: 'zoom-canvas',
              enableOptimize: false,
              sensitivity: 0.75,
            },
            {
              type: 'drag-canvas',
              enableOptimize: false,
            },
            'drag-node',
            'brush-select',
          ],
        },
        layout: {
          type: 'fruchterman',
          gravity: 0.35,
          speed: 5,
          maxIteration: 500,
          gpuEnabled: false,
        },
        animate: false,
      })
    } else {
      graph.changeSize(width, height)
    }
  }

  // 加载数据
  if (norad.value) {
    const res = await getSatelliteRelationsBySatellite(norad.value, store.activedTask?.id)
    if (
      res.code === 200 &&
      res.data.nodes &&
      res.data.relationships &&
      res.data.nodes.length > 0 &&
      res.data.relationships.length > 0
    ) {
      // 表示有数据
      graphData.value = res.data

      const totalNodes = res.data.nodes.length
      const baseRadius = Math.max(120, Math.min(graphWidth, graphHeight) * 0.32)
      const centerX = graphWidth / 2
      const centerY = graphHeight / 2
      const nodes: NodeConfig[] = res.data.nodes.map((node, idx) => {
        const angle = (Math.PI * 2 * idx) / Math.max(1, totalNodes)
        return {
          id: `Satellite-${node.norad}`,
          label: node.name_en,
          country: node.country,
          launch_place: node.launch_place,
          rocket: node.rocket,
          contractors: node.contractors,
          sat_type: node.sat_type,
          operator: node.operator,
          norad: node.norad,
          // 提供初始环形坐标，避免首次布局全部挤在中心点。
          x: centerX + Math.cos(angle) * baseRadius,
          y: centerY + Math.sin(angle) * baseRadius,
          style: {
            fill: node.side === '红方' ? themePalette.danger : themePalette.accent,
            stroke: node.side === '红方' ? themePalette.danger : themePalette.accent,
          },
        }
      })

      const mergedRelations = aggregateRelationships(res.data.relationships)
      const hideEdgeLabel = mergedRelations.length > 180

      const edges: EdgeConfig[] = mergedRelations.map((edge, idx) => ({
        id: `Satellite-Relation-${idx}`,
        source: `Satellite-${edge.source}`,
        target: `Satellite-${edge.target}`,
        label: hideEdgeLabel
          ? ''
          : `${edge.relation}${edge.count > 1 ? ` x${edge.count}` : ''}${
              edge.latestTimestamp ? ` ${dayjs(edge.latestTimestamp).format('YYYY-MM-DD')}` : ''
            }`,
        time: edge.latestTimestamp,
      }))

      nodes.forEach((node: any) => {
        if (!node.labelCfg) {
          node.labelCfg = {}
        }
        node.labelCfg.style = {
          fill: themePalette.text,
          fontSize: 5,
        }
        node.degree = 0
        edges.forEach((edge) => {
          if (edge.source === node.id || edge.target === node.id) {
            node.degree++
          }
        })
      })
      mapNodeSize(nodes, 'degree', [8, 20])
      const offsetDiff = 10
      const multiEdgeType = 'quadratic'
      const singleEdgeType = 'line'
      const loopEdgeType = 'loop'
      G6.Util.processParallelEdges(edges, offsetDiff, multiEdgeType, singleEdgeType, loopEdgeType)
      graph.changeData({
        nodes,
        edges,
      })

      // 切换 tab 或弹窗后强制适配容器，避免“有数据但画布不显示”。
      await nextTick()
      requestAnimationFrame(() => {
        const target = graphContainer.value
        if (!target) return
        const graphWidth = target.clientWidth || target.scrollWidth || 800
        const graphHeight = target.clientHeight || target.scrollHeight || 600
        graph.changeSize(graphWidth, graphHeight)
        graph.fitView(40)
        graph.fitCenter()
        const currentZoom = graph.getZoom()
        if (!Number.isFinite(currentZoom) || currentZoom <= 0) {
          graph.zoomTo(1)
          return
        }
        if (currentZoom > 1.1) {
          graph.zoomTo(1.1)
        } else if (currentZoom < 0.7) {
          graph.zoomTo(0.7)
        }
      })
    } else {
      console.error('卫星关系数据异常', res)
    }
  }
}

onBeforeUnmount(() => {
  if (graph) {
    graph.destroy()
  }
  // 释放echarts 图表
  charts1 && charts1.dispose()
})
const mapNodeSize = (nodes: any, propertyName: any, visualRange: any) => {
  let minp = 9999999999
  let maxp = -9999999999
  nodes.forEach((node: any) => {
    const raw = Number(node[propertyName])
    node[propertyName] = Number.isFinite(raw) ? Math.pow(raw, 1 / 3) : 0
    minp = node[propertyName] < minp ? node[propertyName] : minp
    maxp = node[propertyName] > maxp ? node[propertyName] : maxp
  })
  const rangepLength = maxp - minp
  const rangevLength = visualRange[1] - visualRange[0]
  if (!Number.isFinite(rangepLength) || rangepLength === 0) {
    const fallbackSize = (visualRange[0] + visualRange[1]) / 2
    nodes.forEach((node: any) => {
      node.size = fallbackSize
    })
    return
  }
  nodes.forEach((node: any) => {
    const mapped = ((node[propertyName] - minp) / rangepLength) * rangevLength + visualRange[0]
    node.size = Math.max(visualRange[0], Math.min(visualRange[1], mapped))
  })
}
const analysis = ref([
  {
    id: '1',
    name: '卫星TLE分析',
  },
  {
    id: '2',
    name: '特殊行为分析',
  },
  {
    id: '3',
    name: '装备载荷能力',
  },
  {
    id: '4',
    name: '作战威胁分析',
  },
  {
    id: '8',
    name: '可打击度分析',
  },
  {
    id: '5',
    name: '卫星网络分析',
  },
  {
    id: '6',
    name: '技术特点分析',
  },
  {
    id: '7',
    name: '衍生型号分析',
  },
])
const activeName = ref('卫星TLE分析')
const orbitStatusMap = new Map<number, string>([
  [0, '未知'],
  [1, '在轨'],
  [2, '离轨'],
])

const selectedDay = ref('30')
const activeType = ref('1')
const jstdType = ref('1')
const activeBD = ref('行为与活动')
const activeAction = ref('轨道机动行为')
const activeSJ = ref('相关事件')
const activeZB = ref('装备优势')
const activeCs1 = ref('成像载荷参数')
const activeCs2 = ref('遥感载荷参数')
type CognitionSectionKey = 'cognitionAdvantage' | 'cognitionWeakness'
type CognitionItem = SatelliteAdvantageOrDisadvantage['cognitionAdvantage'][number]

const createEmptySatelliteProfile = (): SatelliteAdvantageOrDisadvantage => ({
  _id: '',
  equipmentId: 0,
  equipmentName: '',
  cognitionAdvantage: [],
  cognitionWeakness: [],
  derivativeModels: [],
})

const createEmptyIntelligence = (): SatelliteProfileIntelligence => ({
  get_id: '',
  norad: 0,
  title: '',
  content: '',
  source: '',
  pubTime: '',
  type: '',
  sourceType: '',
  img: '',
  createTime: '',
})

const cloneSatelliteProfile = (data?: SatelliteAdvantageOrDisadvantage | null): SatelliteAdvantageOrDisadvantage => {
  if (!data) return createEmptySatelliteProfile()
  return JSON.parse(JSON.stringify(data)) as SatelliteAdvantageOrDisadvantage
}

const dateRangeOptions = [
  { label: '近30天', value: '30' },
  { label: '近半年', value: '180' },
  { label: '近一年', value: '365' },
] as const

const intelligenceType = ref<(typeof IntelligenceTypeArr)[number]>('')
const intelligenceSourceType = ref<(typeof IntelligenceSourceTypeArr)[number] | undefined>('')

const dateRange = ref(dateRangeOptions[0].value)
const intelligenceEditorVisible = ref(false)
const intelligenceSaving = ref(false)
const intelligenceDraft = ref<SatelliteProfileIntelligence>(createEmptyIntelligence())
const intelligenceSelectedFile = ref<File | null>(null)
const currentIntelligenceMediaUrl = computed(() => resolveIntelligenceMediaUrl(intelligenceDraft.value.img))
const intelligenceSelectedFileName = computed(() => intelligenceSelectedFile.value?.name || '')
const intelligenceFileAccept = computed(() => {
  if (intelligenceDraft.value.type === '图片') return 'image/*'
  if (intelligenceDraft.value.type === '视频') return 'video/*'
  if (intelligenceDraft.value.type === '音频') return 'audio/*'
  return '*'
})
const qbjcList = computed(() => {
  return satelliteIntelligence.value
    .filter((item) => item.type === '视频' || item.type === '图片' || item.type === '音频')
    .map((item) => ({
      id: item.get_id,
      raw: item,
      title: item.title,
      content: item.content,
      source: item.source,
      type: item.type,
      mediaUrl: resolveIntelligenceMediaUrl(item.img),
      time: dayjs(item.createTime).format('YYYY年MM月DD日'),
    }))
})
const fzqbList = computed(() => {
  return satelliteIntelligence.value
    .filter((item) => item.type === '文字')
    .map((item) => ({
      id: item.get_id,
      raw: item,
      title: item.title,
      content: item.content,
      source: item.source,
      type: item.type,
      mediaUrl: resolveIntelligenceMediaUrl(item.img),
      time: dayjs(item.createTime).format('YYYY年MM月DD日'),
    }))
})

let charts1: echarts.ECharts | null = null
async function initCharts1() {
  // 获取主流关系统计数据
  if (!document.getElementById('charts1')) return
  charts1 = echarts.init(document.getElementById('charts1') as HTMLDivElement)
  const option = {
    title: {
      text: '轨道周期/海拔时间序列',
      textStyle: {
        color: themePalette.text,
        fontSize: 12,
      },
    },
    grid: {
      left: 10, // 默认 10%；数值或百分比都行，按需增大
      bottom: '10%',
      containLabel: true, // 避免再被截断
    },
    textStyle: {
      color: themePalette.text,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    legend: {
      top: 20,
      data: ['远地点高度', '近地点高度', '轨道周期'],
      textStyle: {
        color: themePalette.text,
      },
    },
    xAxis: {
      type: 'category',
      data: ['2020/1/19', '2020/1/20', '2020/1/21', '2020/1/22', '2020/1/23', '2020/1/24', '2020/1/25'],
      axisLabel: {
        color: themePalette.text,
      },
      axisLine: {
        lineStyle: {
          color: themePalette.line,
        },
      },
    },
    yAxis: [
      {
        type: 'value',
        // name: '轨道周期（分钟）',
        position: 'left',
        splitNumber: 5, // 👈 控制刻度数量
        axisLabel: {
          color: themePalette.text,
          formatter: '{value} min',
        },
        axisLine: {
          lineStyle: {
            color: themePalette.line,
          },
        },
        splitLine: {
          lineStyle: {
            color: themePalette.chartGrid,
          },
        },
      },
      {
        type: 'value',
        // name: '海拔（km）',
        position: 'right',
        splitNumber: 5, // 👈 控制刻度数量
        axisLabel: {
          color: themePalette.text,
          formatter: '{value} km',
        },
        axisLine: {
          lineStyle: {
            color: themePalette.line,
          },
        },
        splitLine: {
          lineStyle: {
            color: themePalette.chartGrid,
          },
        },
      },
    ],
    series: [
      {
        name: '远地点高度',
        type: 'line',
        yAxisIndex: 1, // 右侧轴
        data: [120, 132, 101, 134, 90, 230, 210],
      },
      {
        name: '近地点高度',
        type: 'line',
        yAxisIndex: 1, // 右侧轴
        data: [220, 182, 191, 234, 290, 330, 310],
      },
      {
        name: '轨道周期',
        type: 'line',
        yAxisIndex: 0, // 左侧轴
        data: [150, 232, 201, 154, 190, 330, 410],
      },
    ],
  }
  option && charts1.setOption(option)
}
watch(activeName, () => {
  if (activeName.value === '特殊行为分析') {
    nextTick(() => {
      initCharts1()
    })
  }
  if (activeName.value === '卫星网络分析') {
    nextTick(() => {
      initGraph()
    })
  }
  if (activeName.value === '卫星TLE分析') {
    void loadSatelliteTlePage(1, tlePageSize.value)
  }
  if (activeName.value === '可打击度分析' && !satelliteAttack.value) {
    loadSatelliteAttack(norad.value)
  }
})

const loadSatelliteDetail = async (id: number) => {
  if (id) {
    const res = await getSatelliteDetail({ norad: id })
    if (res.code === 200) {
      // console.log(res.data)
      satellite.value = res.data
      // 加载卫星的优势劣势以及衍生型号信息
      loadSatelliteAdvantageOrDisadvantage(satellite.value.norad, satellite.value.name_en)
    }
  }
}

const advantageOrDisadvantage = ref<SatelliteAdvantageOrDisadvantage>()
const editableAdvantageOrDisadvantage = ref<SatelliteAdvantageOrDisadvantage>(createEmptySatelliteProfile())
const profileSaving = ref(false)
const editingCognitionSection = ref<CognitionSectionKey | null>(null)
const editingCognitionIndex = ref<number | null>(null)
const selectedDerivativeIndex = ref(0)
const editingDerivativeIndex = ref<number | null>(null)
const currentCognitionKey = computed<CognitionSectionKey>(() =>
  activeZB.value === '装备优势' ? 'cognitionAdvantage' : 'cognitionWeakness'
)
const currentCognitionList = computed<CognitionItem[]>(
  () => editableAdvantageOrDisadvantage.value[currentCognitionKey.value] || []
)
const derivativeModels = computed(() => editableAdvantageOrDisadvantage.value.derivativeModels || [])
const currentDerivativeModel = computed(() => derivativeModels.value[selectedDerivativeIndex.value] || null)

const resetProfileEditingState = () => {
  editingCognitionSection.value = null
  editingCognitionIndex.value = null
  editingDerivativeIndex.value = null
}

const cancelProfileEditing = () => {
  editableAdvantageOrDisadvantage.value = cloneSatelliteProfile(advantageOrDisadvantage.value)
  resetProfileEditingState()
}

const isEditingCognitionItem = (index: number) =>
  editingCognitionSection.value === currentCognitionKey.value && editingCognitionIndex.value === index

const startCognitionEdit = (index: number) => {
  if (!currentCognitionList.value[index]) return
  editingDerivativeIndex.value = null
  editingCognitionSection.value = currentCognitionKey.value
  editingCognitionIndex.value = index
}

const selectDerivative = (index: number) => {
  selectedDerivativeIndex.value = index
}

const startDerivativeEdit = (index: number) => {
  if (!derivativeModels.value[index]) return
  editingCognitionSection.value = null
  editingCognitionIndex.value = null
  selectedDerivativeIndex.value = index
  editingDerivativeIndex.value = index
}

const resolveDerivativeImage = (image?: string) => {
  if (!image) return satelliteFallback
  if (/^(https?:)?\/\//.test(image) || image.startsWith('data:') || image.startsWith('blob:')) {
    return image
  }
  return getImgServerPath(image)
}

const handleDerivativeImageError = (e: Event) => {
  const target = e.target as HTMLImageElement | null
  if (target && target.src !== satelliteFallback) {
    target.src = satelliteFallback
  }
}

const saveProfileData = async () => {
  const payload = cloneSatelliteProfile(editableAdvantageOrDisadvantage.value)
  payload._id = payload._id || advantageOrDisadvantage.value?._id || ''
  payload.equipmentId = satellite.value?.norad || payload.equipmentId || Number(norad.value) || 0
  payload.equipmentName = satellite.value?.name_en || payload.equipmentName || ''

  profileSaving.value = true
  try {
    const res = await saveSatelliteProfileAdvantageOrDisadvantage(payload)
    if (res.code === 200) {
      advantageOrDisadvantage.value = cloneSatelliteProfile(payload)
      editableAdvantageOrDisadvantage.value = cloneSatelliteProfile(payload)
      resetProfileEditingState()
      ElMessage.success('卫星画像保存成功')
      return
    }
    ElMessage.error(res.msg || '卫星画像保存失败')
  } catch (error) {
    console.error('保存卫星优势劣势信息失败:', error)
    ElMessage.error('保存卫星画像失败')
  } finally {
    profileSaving.value = false
  }
}

// 获取卫星画像中卫星的优势劣势和衍生型号信息
const loadSatelliteAdvantageOrDisadvantage = async (norad: number, name_en: string) => {
  if (!norad || !name_en) return

  try {
    const res = await getSatelliteProfileAdvantageOrDisadvantage({ satelliteId: norad, satelliteName: name_en })
    if (res.code === 200) {
      const profileData = res.data || createEmptySatelliteProfile()
      profileData.equipmentId = profileData.equipmentId || norad
      profileData.equipmentName = profileData.equipmentName || name_en
      advantageOrDisadvantage.value = cloneSatelliteProfile(profileData)
      editableAdvantageOrDisadvantage.value = cloneSatelliteProfile(profileData)
      selectedDerivativeIndex.value = 0
      resetProfileEditingState()
    }
  } catch (error) {
    console.error('加载卫星优势劣势信息失败:', error)
  }
}
const satelliteThreat = ref<ThreatTaskWeightsResponse[]>([])
const currentThreat = computed(() => satelliteThreat.value[0] ?? null)
/**
 * 加载卫星威胁度数据
 * @param id
 */
const loadSatelliteThreat = async (id: number) => {
  const taskId = store.activedTask?.id
  if (!id || taskId === undefined) return
  const res = await getAllThreatList(taskId!, 1, 5, undefined, undefined, id)
  if (res.code === 200) {
    satelliteThreat.value = res.data.content
  }
}

/**
 * 加载卫星攻击事件数据
 * @param id
 */
const satelliteAttack = ref<StrikeV2>()
const loadSatelliteAttack = async (id: number) => {
  const taskId = store.activedTask?.id
  if (!id || taskId === undefined) return
  strikeLoading.value = true
  try {
    const res = await updateStrikeOfTaskV2(taskId!, id)
    if (res.code === 200) {
      satelliteAttack.value = res.data
    } else {
      satelliteAttack.value = undefined
    }
  } finally {
    strikeLoading.value = false
  }
}
const strikeLoading = ref(false)
const satelliteStrikeList = computed(() => satelliteAttack.value?.strikeList ?? [])
const satelliteStrikeWindowRows = computed(() => satelliteStrikeList.value)
const satelliteTle = ref<SatelliteTle[]>([])
const tleLoading = ref(false)
const tlePageNum = ref(1)
const tlePageSize = ref(10)
const tleTotal = ref(0)

const loadSatelliteTlePage = async (pageNum = tlePageNum.value, pageSize = tlePageSize.value) => {
  const targetNorad = Number(norad.value)
  if (!targetNorad) {
    satelliteTle.value = []
    tleTotal.value = 0
    return
  }

  tleLoading.value = true
  try {
    const res = await getSatelliteTlePages({ norads: [targetNorad], pageNum, pageSize })
    if (res.code === 200 && res.data) {
      satelliteTle.value = res.data.content || []
      tleTotal.value = res.data.totalElements || 0
      tlePageNum.value = pageNum
      tlePageSize.value = pageSize
    } else {
      satelliteTle.value = []
      tleTotal.value = 0
    }
  } finally {
    tleLoading.value = false
  }
}

const handleTleCurrentChange = (page: number) => {
  void loadSatelliteTlePage(page, tlePageSize.value)
}

const handleTleSizeChange = (pageSize: number) => {
  void loadSatelliteTlePage(1, pageSize)
}

const formatStrikeScore = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return '--'
  const num = Number(value)
  return Number.isNaN(num) ? String(value) : num.toFixed(4)
}

const formatStrikeNullable = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return '--'
  return typeof value === 'number' ? value.toFixed(2) : value
}

const resetDialogState = () => {
  satellite.value = undefined
  advantageOrDisadvantage.value = undefined
  editableAdvantageOrDisadvantage.value = createEmptySatelliteProfile()
  satelliteThreat.value = []
  satelliteAttack.value = undefined
  satelliteTle.value = []
  tleLoading.value = false
  strikeLoading.value = false
  tlePageNum.value = 1
  tlePageSize.value = 10
  tleTotal.value = 0
  activeName.value = '卫星TLE分析'
  activeType.value = '1'
  activeBD.value = '行为与活动'
  activeAction.value = '轨道机动行为'
  activeCs1.value = '成像载荷参数'
  activeCs2.value = '遥感载荷参数'
  activeZB.value = '装备优势'
  selectedDay.value = '30'
  selectedDerivativeIndex.value = 0
  resetProfileEditingState()
  cancelIntelligenceEditing()
}

const page = ref(1)
const pageSize = ref(10)
const satelliteIntelligence = ref<SatelliteProfileIntelligence[]>([])
const intelligenceEntrySource = ref<'情报监测' | '仿真情报'>('情报监测')
const intelligenceEditMode = ref<'create' | 'edit'>('edit')
const resolveIntelligenceMediaUrl = (path?: string) => {
  if (!path) return ''
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path
  return getMediaServerPath(path)
}

const isMediaIntelligenceType = (type?: string) => type === '图片' || type === '视频' || type === '音频'

const getMediaFileExtension = (mediaUrl?: string) => {
  if (!mediaUrl) return ''
  const cleanUrl = mediaUrl.split('?')[0].split('#')[0]
  const lastDot = cleanUrl.lastIndexOf('.')
  if (lastDot === -1) return ''
  return cleanUrl.slice(lastDot + 1).toLowerCase()
}

const isImageMedia = (mediaUrl?: string) => {
  const extension = getMediaFileExtension(mediaUrl)
  return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'avif', 'svg'].includes(extension)
}

const isVideoMedia = (mediaUrl?: string) => {
  const extension = getMediaFileExtension(mediaUrl)
  return ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv'].includes(extension)
}

const isAudioMedia = (mediaUrl?: string) => {
  const extension = getMediaFileExtension(mediaUrl)
  return ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(extension)
}

const openIntelligenceNew = (source: '情报监测' | '仿真情报') => {
  intelligenceEntrySource.value = source
  intelligenceEditMode.value = 'create'
  intelligenceDraft.value = {
    ...createEmptyIntelligence(),
    norad: Number(norad.value) || 0,
    type: source === '情报监测' ? '图片' : '文字',
    sourceType: source === '情报监测' ? IntelligenceSourceTypeArr[0] : IntelligenceSourceTypeArr[2],
    pubTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  }
  intelligenceSelectedFile.value = null
  intelligenceEditorVisible.value = true
}

const openIntelligenceEditor = (item: { raw: SatelliteProfileIntelligence } | SatelliteProfileIntelligence) => {
  // 编辑已有情报
  const target = 'raw' in item ? item.raw : item
  intelligenceEntrySource.value = isMediaIntelligenceType(target.type) ? '情报监测' : '仿真情报'
  intelligenceEditMode.value = 'edit'
  intelligenceDraft.value = JSON.parse(JSON.stringify(target)) as SatelliteProfileIntelligence

  intelligenceSelectedFile.value = null
  intelligenceEditorVisible.value = true
}

const cancelIntelligenceEditing = () => {
  intelligenceEditorVisible.value = false
  intelligenceSelectedFile.value = null
  intelligenceDraft.value = createEmptyIntelligence()
  intelligenceEntrySource.value = '情报监测'
  intelligenceEditMode.value = 'edit'
}

const handleIntelligenceFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0] || null
  intelligenceSelectedFile.value = file
}

const saveIntelligenceEditing = async () => {
  const payload = JSON.parse(JSON.stringify(intelligenceDraft.value)) as SatelliteProfileIntelligence
  payload.norad = payload.norad || Number(norad.value) || 0

  if (!payload.title.trim()) {
    ElMessage.warning('请输入情报标题')
    return
  }

  if (isMediaIntelligenceType(payload.type) && !payload.img && !intelligenceSelectedFile.value) {
    ElMessage.warning('媒体情报请上传文件')
    return
  }

  intelligenceSaving.value = true
  try {
    const requestPayload =
      intelligenceEditMode.value === 'create' && intelligenceEntrySource.value === '仿真情报'
        ? (() => {
            const { get_id, ...rest } = payload as SatelliteProfileIntelligence & { get_id?: string }
            return rest
          })()
        : payload

    const res = await uploadSatelliteProfileIntelligence({
      intelligenceJson: JSON.stringify(requestPayload),
      file: intelligenceSelectedFile.value || undefined,
    })
    if (res.code === 200) {
      ElMessage.success('情报信息保存成功')
      cancelIntelligenceEditing()
      await loadSatelliteIntelligence()
      return
    }
    ElMessage.error(res.msg || '情报信息保存失败')
  } catch (error) {
    console.error('保存情报信息失败:', error)
    ElMessage.error('情报信息保存失败')
  } finally {
    intelligenceSaving.value = false
  }
}

const loadSatelliteIntelligence = async () => {
  try {
    const res = await getSatelliteProfileIntelligenceList({
      pageNum: page.value,
      pageSize: pageSize.value,
      type: intelligenceType.value ? [intelligenceType.value] : [],
      sourceType: intelligenceSourceType.value,
      norad: norad.value ? Number(norad.value) : undefined,
    })
    if (res.code === 200) {
      satelliteIntelligence.value = res.data.content || []
    } else {
      satelliteIntelligence.value = []
    }
  } catch (error) {
    console.error('加载卫星情报信息失败:', error)
    satelliteIntelligence.value = []
  }
}

// 获取卫星新闻
const satelliteNews = ref<{ title: string; content: string; pubTime: string; abstracts: string[] }[]>([])
const selectedNews = ref<{ title: string; content: string; pubTime: string; abstracts: string[] } | null>(null)
const newsDetailVisible = ref(false)

const parseNewsAbstracts = (value: string | string[] | null | undefined) => {
  if (!value) return []
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)

  const text = String(value).trim()
  if (!text) return []

  try {
    const normalized = text
      .replace(/^\s*\[/, '[')
      .replace(/\]\s*$/, ']')
      .replace(/'/g, '"')
    const parsed = JSON.parse(normalized)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean)
    }
  } catch (error) {
    console.warn('解析新闻 abstracts 失败，已回退为字符串切分：', error)
  }

  return text
    .replace(/^\s*\[/, '')
    .replace(/\]\s*$/, '')
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
}

const getNewsPreview = (content?: string) => {
  const text = content || ''
  if (text.length <= 150) return text
  return `${text.slice(0, 150)}...`
}

const openNewsDetail = (news: { title: string; content: string; pubTime: string; abstracts: string[] }) => {
  selectedNews.value = news
  newsDetailVisible.value = true
}

const loadSatelliteNews = async () => {
  try {
    const res = await getSatelliteProfileNewsList({ pageNum: 1, pageSize: 10 })
    if (res.code === 200) {
      satelliteNews.value = (res.data.content || []).map((item: any) => ({
        ...item,
        abstracts: parseNewsAbstracts(item.abstracts),
      }))
    } else {
      satelliteNews.value = []
    }
  } catch (error) {
    console.error('加载卫星新闻失败:', error)
    satelliteNews.value = []
  }
}
watch(
  () => [dialogVisible.value, norad.value] as const,
  ([visible, currentNorad]) => {
    if (!visible || !currentNorad) return

    resetDialogState()
    loadSatelliteDetail(currentNorad)
    loadSatelliteThreat(currentNorad)
    loadSatelliteAttack(currentNorad)
    loadSatelliteIntelligence()
    loadSatelliteNews()
    initGraph()
    void loadSatelliteTlePage(1, tlePageSize.value)
    nextTick(() => {
      void initCharts1()
    })
  },
  { immediate: true }
)

// 复制 TLE 行到剪贴板
const copyTle = async (row: SatelliteTle) => {
  if (!row) return
  const text = `${row.line1}\n${row.line2}`
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    ElMessage.success('已复制到剪贴板')
  } catch (e) {
    ElMessage.error('复制失败')
  }
}

// 将 TLE 的 YYDDD.fraction 格式转换为可读时间
const formatEpoch = (epoch: string | number | undefined) => {
  if (!epoch) return ''
  const s = String(epoch)
  if (s.includes('T') || s.includes('-')) {
    return dayjs(s).format('YYYY-MM-DD HH:mm:ss')
  }
  const parts = s.split('.')
  const left = parts[0]
  const right = parts[1] || '0'
  if (left.length < 5) return s
  const yy = Number(left.slice(0, 2))
  const doy = Number(left.slice(2))
  const year = yy >= 57 ? 1900 + yy : 2000 + yy
  const fraction = Number('0.' + right)
  const base = Date.UTC(year, 0, 1)
  const ms = base + (doy - 1 + fraction) * 24 * 3600 * 1000
  return dayjs(ms).format('YYYY-MM-DD HH:mm:ss')
}
</script>
<style lang="scss" scoped>
.satellite-profile-dialog {
  :deep(.atlas-app-dialog__body) {
    height: 100%;
    padding: 0;
  }

  :deep(.atlas-app-dialog) {
    margin: 0;
    height: 100%;
  }
}

.container {
  --sp-accent: var(--accent-color);
  --sp-accent-strong: var(--accent-color-active);
  --sp-text-main: var(--text-color-primary);
  --sp-text-strong: var(--text-color-strong);
  --sp-text-muted: var(--text-color-secondary);
  --sp-sep-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-color) 32%, transparent);
  --sp-sep-shadow-strong: inset 0 0 0 2px color-mix(in srgb, var(--accent-color) 42%, transparent);
  --sp-accent-soft-bg: color-mix(in srgb, var(--accent-color) 12%, transparent);
  --sp-accent-soft-line: color-mix(in srgb, var(--accent-color) 24%, transparent);
  display: grid;
  height: 100%;
  gap: 2px;
  border: 1px solid var(--surface-border-color);
  grid-template-columns: 400px minmax(0, 1fr) 400px;
  .left,
  .center,
  .right {
    min-width: 0;
  }
  .left {
    background: var(--menu-bg-color);
    padding: 10px;
    .left-1 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1.5fr 1fr;

      .left-1-1 {
        display: flex;
        flex-direction: column;
        justify-content: center;
        & > div {
          display: flex;
          align-items: center;
          font-size: 12px;
          min-height: 30px;
        }
        & > div:first-child {
          flex: 1;
          font-size: 24px;
          font-weight: bold;
          gap: 20px;

          .news-content-row {
            display: flex;
            align-items: flex-start;
            gap: 8px;
          }

          .news-more-btn {
            flex-shrink: 0;
            padding: 0;
            height: auto;
            line-height: 1.6;
          }
        }
      }
      .desc-item {
        padding-top: 10px;
        font-size: 12px;

        min-height: 25px;
        display: flex;
        & > span:first-child {
          width: 30%;
          text-align: left;
          color: var(--sp-text-muted);
        }
      }
    }
    .left-2 {
      padding: 10px;
      background: var(--app-bg-color);
      margin-bottom: 10px;
      .left-2-1 {
        display: flex;
        padding-bottom: 10px;
      }
      .left-2-2 {
        & > div {
          text-align: left;
          font-size: 12px;
          line-height: 22px;
        }
      }
    }
    .left-3 {
      padding: 10px;
      margin-bottom: 10px;
      background: var(--app-bg-color);
      display: flex;
      .left-3-item {
        display: flex;
        flex-direction: column;
        flex: 1;
        & > span:last-child {
          font-size: 12px;
        }
      }
    }
    .left-4 {
      padding: 10px;
      margin-bottom: 10px;
      background: var(--app-bg-color);
      .left-4-title {
        display: flex;
      }
      .left-4-1 {
        display: flex;
        padding-top: 10px;
        & > span:first-child {
          color: var(--sp-text-muted);
        }
        & > span {
          width: 50%;
          text-align: left;
          font-size: 13px;
        }
      }
    }
    .left-5 {
      padding: 10px;
      background: var(--app-bg-color);
      .left-5-title {
        display: flex;
        padding-bottom: 5px;
      }
      .img-box {
        width: 100%;
        max-height: 120px;
        .img {
          width: 100%;
          height: 100%;
        }
      }
      .left-5-1 {
        display: flex;
        padding-top: 10px;
        & > span:first-child {
          color: var(--sp-text-muted);
        }
        & > span {
          width: 50%;
          text-align: left;
          font-size: 13px;
        }
      }
    }
  }
  .center {
    background: var(--menu-bg-color);
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    .center-top {
      flex: 1 1 auto;
      min-height: 0;
      max-height: 600px;
      overflow: hidden;
      display: flex;
      flex-direction: column;

      .center-top-tabs {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--app-bg-color);
        height: 30px;
        padding: 10px;
        .tab-item {
          cursor: pointer;
          padding: 5px 10px;
          &.active {
            box-shadow: inset 0 -2px 0 var(--sp-accent);
          }
        }
      }
      .tab-content {
        flex: 1 1 auto;
        min-height: 0;
        height: auto;
        box-sizing: border-box;
        overflow: auto;
      }
      .tab-1 {
        .tab-1__type {
          .tab-1__type__btns {
            display: flex;
            padding: 5px;
            flex-wrap: wrap;
            .atlas-app-button {
              &.active {
                background: var(--sp-accent);
              }
            }
          }
          .tab-1__time {
            min-width: 150px;
            display: flex;
            align-items: center;
            .tab-1__timetitle {
              font-size: 12px;
              min-width: 50px;
            }
          }
        }

        .tab-1__bd {
          .tab-1__bd_tabs {
            background: var(--app-bg-color);
            padding: 5px;
            display: flex;
            & > span {
              display: inline-block;
              margin-right: 5px;
              padding: 2px 10px;
              background: var(--menu-bg-color);
              cursor: pointer;
              &.active {
                background: var(--sp-accent);
              }
            }
          }
        }
        .tab-1_bd__content {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 3px;
          .bd_title {
            text-align: left;
            font-size: 12px;
            padding: 5px;
            width: 100%;
          }
          .tab-1_bd__content__left {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .tab-1_bd__content__center {
            display: flex;
            flex-direction: column;
            gap: 2px;
            .bd-zb__item {
              background: var(--app-bg-color);

              font-size: 12px;
              flex: 1;
              padding: 5px;
              & > div {
                text-align: left;
                padding: 2px;
              }
              & > div:last-child {
                background: var(--sp-accent);
              }
            }
          }
          .tab-1_bd__content__right {
            padding: 5px;
            .grid-title {
              display: grid;
              grid-template-columns: 2fr 1fr;
              margin-bottom: 5px;
              .his {
                display: flex;
                flex-direction: column;
                align-items: start;
                justify-content: start;
                font-size: 12px;
                & > div:first-child {
                  font-size: 14px;
                  padding-bottom: 10px;
                }
              }
              .time {
                display: flex;
                justify-content: end;
                align-items: center;
                gap: 5px;
                .timetitle {
                  font-size: 12px;
                }
                .select {
                  width: 80px;
                }
              }
            }
            .grid-count {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              background: var(--app-bg-color);
              margin-bottom: 5px;
              div {
                display: flex;
                flex-direction: column;
                gap: 5px;
                align-items: center;
                justify-content: center;
                padding: 5px;
                & > span:first-child {
                  font-weight: bold;
                }
                & > span:last-child {
                  font-size: 12px;
                  color: var(--sp-text-muted);
                }
              }
            }
            .mod-tabs-box {
              background: var(--app-bg-color);
              .mod-tabs {
                padding: 5px;
                background: var(--app-bg-color);
                display: flex;
                & > span {
                  display: inline-block;

                  margin-right: 5px;
                  padding: 2px 10px;
                  font-size: 12px;
                  background: var(--menu-bg-color);
                  cursor: pointer;
                  &.active {
                    background: var(--sp-accent);
                  }
                }
              }
              .mod-content {
                display: grid;
                grid-template-columns: 1fr 3fr;

                .l-box {
                  height: 100%;
                  display: flex;
                  flex-direction: column;
                  justify-content: stretch;

                  div {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding: 10px;
                    margin: 5px;
                    background: var(--menu-bg-color);
                    & > span:first-child {
                      font-size: 18px;
                      font-weight: bold;
                    }
                    & > span:last-child {
                      font-size: 12px;
                    }
                  }
                }
                .r-box {
                  min-height: 240px;
                }
              }
            }
          }
        }
      }
      .tab-2 {
        padding: 10px;
        .grid-zh {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          .l-zh {
            border: 1px solid var(--surface-border-color);
            padding: 5px;
            background: var(--app-bg-color);
            font-size: 12px;
            .title {
              text-align: left;
              padding-bottom: 10px;
            }
            .grid-ty {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 5px;
              div {
                padding: 5px;
                border: 1px solid var(--surface-border-color);
                display: flex;
                justify-content: space-between;
              }
              .span2 {
                grid-column: 1 / -1; //独占整行
              }
              .span2-col {
                grid-column: 1 / -1; //独占整行
                display: flex;
                flex-direction: column;
                align-items: start;
              }
            }
          }
          .r-zh {
            border: 1px solid var(--surface-border-color);
            padding: 5px;
            background: var(--app-bg-color);
            font-size: 12px;
            .cs-box {
              border: 1px solid var(--surface-border-color);
              &:first-of-type {
                margin-bottom: 5px;
              }
              .mod-tabs-box {
                .mod-tabs {
                  padding: 5px;
                  background: var(--app-bg-color);
                  display: flex;
                  & > span {
                    display: inline-block;
                    padding: 2px 10px;
                    font-size: 12px;
                    background: var(--menu-bg-color);
                    cursor: pointer;
                    &.active {
                      background: var(--sp-accent);
                    }
                  }
                }
                .cs-content {
                  padding: 10px;
                  text-align: left;
                }
              }
            }
          }
        }
      }
      .tab-3 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-auto-rows: minmax(0, auto);
        align-items: stretch;
        gap: 10px;
        margin: 10px;
        min-height: 0;

        .l-wx {
          background: var(--app-bg-color);
          box-shadow: var(--sp-sep-shadow-strong);
          min-height: 0;
          overflow: auto;

          .mod-tabs-box {
            .mod-tabs {
              display: flex;
              & > span {
                display: inline-block;
                padding: 2px 10px;
                font-size: 12px;
                background: var(--menu-bg-color);
                cursor: pointer;
                &.active {
                  background: var(--sp-accent);
                }
              }
            }
            .wx-content {
              text-align: left;
              font-size: 14px;
              .wx-item {
                box-shadow: var(--sp-sep-shadow-strong);
                margin: 10px;
                padding: 10px;
                div {
                  padding-bottom: 5px;
                  display: flex;
                  align-items: center;
                  div {
                    padding-right: 30px;
                  }
                }
              }
            }
          }
        }
        .r-wx {
          background: var(--app-bg-color);
          box-shadow: var(--sp-sep-shadow-strong);
          font-size: 12px;
          padding: 10px;
          min-height: 0;
          overflow: auto;

          .title,
          .nav-bar {
            padding-bottom: 10px;
            display: flex;
            gap: 10px;
            align-items: center;
            .select {
              display: inline-block;
              width: 80px;
              flex: 1;
              padding-bottom: 0;
            }
          }
          .lswx-content {
            box-shadow: var(--sp-sep-shadow-strong);
            padding: 5px;
            display: flex;
            flex-direction: column;
            .lswx-item {
              .top1 {
                display: flex;
                justify-content: space-between;
                .btn {
                  cursor: pointer;
                }
              }
              .title-yc {
                width: 100%;
                display: flex;
                align-items: center;
                gap: 10px;
              }

              .yc-content {
                width: 100%;
                display: block;
                div {
                  text-align: left;
                }
              }
            }
          }
        }
        .threat-panel {
          grid-column: 1 / -1;
          padding: 16px;
          background: var(--app-bg-color);
          min-height: 0;
          overflow: auto;

          .threat-panel__title {
            font-size: 16px;
            font-weight: 600;
            padding-bottom: 14px;
          }
          .threat-panel__summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(120px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
            .summary-item {
              background: var(--sp-accent-soft-bg);
              box-shadow: var(--sp-sep-shadow);
              border-radius: 6px;
              padding: 10px;
              display: flex;
              flex-direction: column;
              font-size: 13px;
              span {
                color: var(--sp-text-muted);
                margin-bottom: 6px;
              }
              strong {
                color: var(--sp-text-strong);
                font-size: 14px;
              }
            }
          }
          .threat-empty {
            color: var(--sp-text-muted);
            padding: 16px 0;
          }
        }

        .strike-panel {
          grid-column: 1 / -1;
          padding: 16px;
          background: var(--app-bg-color);
          min-height: 0;
          overflow: auto;

          .strike-panel__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
            text-align: left;
          }

          .strike-panel__title {
            font-size: 16px;
            font-weight: 600;
            color: var(--sp-text-strong);
          }

          .strike-panel__desc {
            margin-top: 4px;
            font-size: 12px;
            color: var(--sp-text-muted);
          }

          .strike-panel__badge {
            flex-shrink: 0;
            padding: 8px 14px;
            border-radius: 999px;
            background: var(--sp-accent-soft-bg);
            box-shadow: var(--sp-sep-shadow);
            color: var(--sp-text-main);
            font-weight: 600;
          }

          .strike-panel__summary {
            display: grid;
            grid-template-columns: repeat(5, minmax(120px, 1fr));
            gap: 12px;
            margin-bottom: 16px;

            .summary-item {
              background: var(--sp-accent-soft-bg);
              box-shadow: var(--sp-sep-shadow);
              border-radius: 6px;
              padding: 10px;
              display: flex;
              flex-direction: column;
              font-size: 13px;

              span {
                color: var(--sp-text-muted);
                margin-bottom: 6px;
              }

              strong {
                color: var(--sp-text-strong);
                font-size: 14px;
              }
            }
          }

          .strike-empty {
            color: var(--sp-text-muted);
            padding: 16px 0;
          }

          .strike-window-panel {
            margin-top: 16px;
            padding: 14px 5px;
            border-radius: 10px;
            background: var(--sp-accent-soft-bg);
            box-shadow: var(--sp-sep-shadow);
          }

          .strike-window-panel__title {
            margin-bottom: 12px;
            font-size: 15px;
            font-weight: 700;
            color: var(--sp-text-strong);
            text-align: left;
          }

          .strike-window-panel__grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            padding: 5px 0;
            justify-items: start;
            box-shadow: inset 0 -1px 0 var(--sp-accent-soft-line);
          }

          .strike-window-card {
            padding: 12px;
            border-radius: 8px;
          }

          .strike-window-card__header {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: center;
            margin-bottom: 6px;
            color: var(--sp-text-main);

            strong {
              color: var(--sp-text-strong);
              font-size: 14px;
            }

            span {
              color: var(--sp-text-main);
              font-size: 12px;
            }
          }

          .strike-window-card__score {
            margin-bottom: 8px;
            color: var(--sp-text-muted);
            font-size: 12px;
            text-align: left;
          }

          .weapon-window-list {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            align-items: center;
          }

          .weapon-window-tag {
            border: 0;
            background: var(--sp-accent-soft-bg);
            color: var(--sp-text-main);
          }

          .strike-muted {
            color: var(--sp-text-muted);
          }

          .strike-detail {
            text-align: left;
            line-height: 1.5;
            color: var(--sp-text-main);
          }

          :deep(.atlas-app-table) {
            --el-table-header-bg-color: var(--surface-bg-color);
            --el-table-tr-bg-color: var(--app-bg-color);
            --el-table-row-hover-bg-color: var(--sp-accent-soft-bg);
            --el-table-border-color: var(--sp-accent-soft-line);
            --el-text-color-regular: var(--sp-text-main);
            --el-text-color-primary: var(--sp-text-strong);
            border-radius: 12px;
            overflow: hidden;
          }

          :deep(.atlas-app-table th.el-table__cell) {
            color: var(--sp-accent-strong);
            font-weight: 700;
          }

          :deep(.atlas-app-table td.el-table__cell),
          :deep(.atlas-app-table__empty-block) {
            background: var(--app-bg-color);
            color: var(--sp-text-main);
          }

          :deep(.atlas-app-table__inner-wrapper::before) {
            background-color: var(--sp-accent-soft-line);
          }

          :deep(.atlas-app-tag) {
            border: none;
          }
        }
      }
      .tab-4 {
        .tab-1__type {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px;
          min-height: 40px;
          .tab-1__type__btns {
            .atlas-app-button {
              &.active {
                background: var(--sp-accent);
              }
            }
          }
          .tab-1__time {
            min-width: 150px;
            display: flex;
            align-items: center;
            .tab-1__timetitle {
              font-size: 12px;
              min-width: 50px;
            }
          }
        }
        .tab-4__content {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          & > div {
            padding: 10px;
            background: var(--app-bg-color);
            text-align: left;
            font-size: 14px;
            border: 1px solid var(--sp-accent-soft-line);
          }
          .l-box {
            margin: 5px;
            & > div:not(:first-child) {
              background: var(--menu-bg-color);
              padding: 10px 20px;
              margin-top: 10px;
              border: 1px solid var(--sp-accent-soft-line);
            }
          }
          .r-box {
            margin: 5px;
            .img-box {
              padding: 5px 0;
              img {
                width: 100%;
              }
            }
          }
        }
      }
      .tab-5 {
        display: flex;
        flex-direction: column;
        min-height: 0;
        .tab-2__type {
          display: flex;
          justify-content: end;
          align-items: center;
          padding: 5px;
          min-height: 40px;
          .tab-2__time {
            min-width: 150px;
            display: flex;
            align-items: center;
            .tab-2__timetitle {
              font-size: 12px;
              min-width: 50px;
            }
          }
        }
        .tab-5__content {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 2fr;
          grid-auto-rows: minmax(0, 1fr);
          align-items: stretch;
          gap: 10px;
          margin: 5px;
          padding: 5px;
          min-height: 0;
          overflow: hidden;

          .title-box {
            text-align: left;
            padding: 5px;
          }
          .l-box {
            border: 1px solid var(--sp-accent-soft-line);
            background: var(--app-bg-color);
            min-height: 0;
            overflow: auto;

            .img-box {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 5px;
              .img-item {
                cursor: pointer;
                border: 1px solid transparent;
                padding: 6px;
                img {
                  height: 60px;
                  width: 100%;
                  object-fit: cover;
                }
                div {
                  background: var(--sp-accent);
                  padding: 0 5px;
                }
                &.active {
                  border-color: var(--sp-accent-strong);
                }
                &.editing {
                  display: flex;
                  flex-direction: column;
                  gap: 8px;
                  background: var(--menu-bg-color);
                }
              }
            }
          }
          .r-box {
            border: 1px solid var(--sp-accent-soft-line);
            min-height: 0;
            overflow: auto;
            padding: 5px;
            .content-box {
              text-align: left;
              padding: 5px;
              font-size: 14px;
              min-height: 0;
              white-space: pre-wrap;
              line-height: 1.7;
            }
            .title-box--editable {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
            }
            .content-box--editable {
              cursor: pointer;
            }
            .content-box__text {
              min-height: 280px;
            }
          }
        }
      }
      .tab-6 {
        .graph-container {
          min-height: 600px;
          width: 100%;
        }
      }
      .tab-7 {
        .tle-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 12px;
          border: 1px solid var(--sp-accent-soft-line);
          background: var(--app-bg-color);
          border-radius: 8px;
          overflow: auto;
          box-sizing: border-box;
          min-height: calc(100% - 30px);
        }

        .tle-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .tle-card__title {
          font-size: 16px;
          font-weight: 600;
          color: var(--sp-text-strong);
        }

        .tle-card__desc {
          margin-top: 4px;
          font-size: 12px;
          color: var(--sp-text-muted);
        }

        .tle-card__meta {
          flex-shrink: 0;
          color: var(--sp-text-main);
          font-size: 12px;
        }

        .tle-table-wrap {
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .tle-table {
          width: 100%;
        }

        .tle-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
          white-space: normal;
          word-break: break-all;
        }

        .tle-line {
          line-height: 1.4;
          color: var(--sp-text-main);
        }

        .tle-card__footer {
          display: flex;
          justify-content: flex-end;
          padding-top: 4px;
        }

        :deep(.atlas-app-empty) {
          height: 100%;
        }
      }
    }

    .center-bottom {
      flex: 0 0 auto;
      margin-top: 10px;
      .center-bottom_tabs {
        background: var(--app-bg-color);
        padding: 5px;
        display: flex;
        & > span {
          display: inline-block;
          width: 100px;
          text-align: center;
          margin-right: 5px;
          padding: 5px;
          background: var(--menu-bg-color);
          cursor: pointer;
          &.active {
            background: var(--sp-accent);
          }
        }
      }
      .center-bottom_content {
        padding: 10px;
        .grid-box {
          display: grid;
          grid-template-columns: 150px auto;
          .grid-box_l {
            display: flex;
            flex-direction: column;
            justify-content: space-around;
            & > div:first-child {
              display: flex;
              gap: 5px;
            }
            & > div:last-child {
              display: flex;
              gap: 5px;
            }
          }
          .grid-box_r {
            padding: 5px 10px;
            margin-right: 20px;
            box-shadow: var(--sp-sep-shadow-strong);
            & > div:first-child {
              text-align: left;
            }
            & > div:last-child {
              text-align: left;
              font-size: 12px;
              color: var(--sp-text-muted);
            }
          }
        }

        .qbjc-search {
          display: flex;
          gap: 10px;
          align-items: center;
          font-size: 12px;
        }
        .qbjc-content {
          padding: 10px 0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          align-items: stretch;

          @media (max-width: 960px) {
            grid-template-columns: 1fr;
          }

          .qbjc-item {
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px;
            border-radius: 10px;
            background: var(--app-bg-color);
            box-shadow: var(--sp-sep-shadow);
            min-width: 0;

            .qbjc-img {
              width: 100%;
              aspect-ratio: 16 / 9;
              overflow: hidden;
              border-radius: 8px;

              img,
              video,
              audio {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
              }

              img {
                width: 100%;
                height: 100%;
                object-fit: cover;
              }
            }
            .qbjc-title {
              text-align: left;
              font-size: 14px;
              font-weight: 600;
              color: var(--sp-text-strong);
              line-height: 1.5;
            }
            .qbjc-source {
              font-size: 12px;
              color: var(--sp-text-muted);
              display: flex;
              gap: 10px;
              flex-wrap: wrap;
            }
          }
        }
        .fzqb-content {
          padding: 10px 0;
          .fzqb-item {
            padding: 10px;
            margin-bottom: 10px;
            background: var(--app-bg-color);
            cursor: pointer;
            .fzqb-title {
              text-align: left;
              font-size: 14px;
            }
            .fzqb-article {
              text-align: left;
              font-size: 12px;
              color: var(--sp-text-muted);
              padding: 10px 0;
            }
            .fzqb-source {
              display: flex;
              justify-content: start;
              font-size: 12px;
              gap: 10px;
              color: var(--sp-text-muted);
            }
          }
        }
      }
    }
  }
  .right {
    background: var(--menu-bg-color);
    display: flex;
    flex-direction: column;
    .right_tabs {
      background: var(--app-bg-color);
      padding: 5px;
      display: flex;
      & > span {
        display: inline-block;
        width: 50%;
        text-align: center;
        margin-right: 5px;
        padding: 5px;
        background: var(--menu-bg-color);
        cursor: pointer;
        &.active {
          background: var(--sp-accent);
        }
      }
    }
    .right_tabs_content {
      flex: 1;
      overflow: auto;
    }
    .right_tabs_content_item {
      padding: 10px;
      .title {
        display: flex;
        position: relative;
        align-items: center;
        padding-bottom: 5px;
        &::before {
          content: '';
          display: inline-block;
          width: 10px;
          height: 10px;
          background: var(--sp-accent-strong);
          margin-right: 8px;
          vertical-align: middle;
          // transform: rotate(45deg);
          margin-bottom: 3px;
          /* 正方形转 45° 就是菱形 */
        }
      }
      .item--editing {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .item {
        box-shadow: var(--sp-sep-shadow);
        background: var(--app-bg-color);
        padding: 5px;
        .item-title {
          font-size: 12px;
          text-align: left;
          padding: 10px 0;
        }
        .son {
          background: var(--menu-bg-color);
          padding: 5px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          .son-tag {
            display: flex;
          }
          .son-editor {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .son-item {
            background: var(--app-bg-color);
            text-align: left;
            font-size: 12px;
            box-sizing: border-box;
            padding: 5px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            strong {
              color: var(--sp-text-strong);
            }
            span {
              color: var(--sp-text-main);
              line-height: 1.6;
            }
          }
        }
      }
    }
    .profile-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
    .profile-actions--right {
      padding-top: 4px;
    }
  }

  .intelligence-editor {
    .intelligence-editor__meta {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      color: var(--sp-text-muted);
      font-size: 12px;
    }

    .intelligence-editor__upload {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }

    .intelligence-editor__file-name {
      color: var(--sp-text-muted);
      font-size: 12px;
    }

    .intelligence-editor__preview {
      width: 100%;

      img,
      video,
      audio {
        width: 100%;
        max-height: 240px;
        object-fit: contain;
      }
    }
  }
}

.news-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .news-detail__title {
    font-size: 18px;
    font-weight: 600;
    color: var(--sp-text-strong);
    line-height: 1.5;
  }

  .news-detail__meta {
    font-size: 12px;
    color: var(--sp-text-muted);
  }

  .news-detail__content {
    white-space: pre-wrap;
    line-height: 1.8;
    color: var(--sp-text-main);
    font-size: 14px;
  }
}
</style>
