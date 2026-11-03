<template>
  <demo-box
    :extra-files="[
      {
        file: '@/utils/cesium.js',
        pick: ['createViewer', 'optimizeViewerQuality'],
      },
    ]"
  >
    <div ref="containerRef" class="cesium-page-container">
      <!-- 贴地线方案对比 HUD 悬浮指示卡 -->
      <div class="legend-card">
        <div class="legend-header">
          <span class="legend-title">Cesium 贴地线技术方案对比</span>
          <span class="scene-badge">{{ currentSceneLabel }}</span>
        </div>

        <div class="legend-body">
          <div
            class="legend-item"
            :class="{ active: params.showNormal }"
            @click="toggleParam('showNormal')"
          >
            <span
              class="badge-dot"
              :style="{ backgroundColor: params.normalColor }"
            ></span>
            <div class="item-text">
              <span class="tech-name">0. 普通空间折线 (未贴地)</span>
              <span class="tech-sub">直接穿透起伏山体，产生严重穿模</span>
            </div>
            <span class="status-tag">{{ params.showNormal ? '显示' : '隐藏' }}</span>
          </div>

          <div
            class="legend-item"
            :class="{ active: params.showClamp }"
            @click="toggleParam('showClamp')"
          >
            <span
              class="badge-dot"
              :style="{ backgroundColor: params.clampColor }"
            ></span>
            <div class="item-text">
              <span class="tech-name">1. 原生贴地线 (clampToGround)</span>
              <span class="tech-sub">现代推荐，利用 GPU 阴影体严密贴合</span>
            </div>
            <span class="status-tag">{{ params.showClamp ? '显示' : '隐藏' }}</span>
          </div>

          <div
            class="legend-item"
            :class="{ active: params.showCorridor }"
            @click="toggleParam('showCorridor')"
          >
            <span
              class="badge-dot"
              :style="{ backgroundColor: params.corridorColor }"
            ></span>
            <div class="item-text">
              <span class="tech-name">2. 走廊模拟贴地线 (Corridor)</span>
              <span class="tech-sub">窄走廊多边形贴地，支持圆角与丰富贴图</span>
            </div>
            <span class="status-tag">{{ params.showCorridor ? '显示' : '隐藏' }}</span>
          </div>

          <div
            class="legend-item"
            :class="{ active: params.showSampled }"
            @click="toggleParam('showSampled')"
          >
            <span
              class="badge-dot"
              :style="{ backgroundColor: params.sampledColor }"
            ></span>
            <div class="item-text">
              <span class="tech-name">3. 地形高度插值采样 (SampleTerrain)</span>
              <span class="tech-sub">官方经典算法，分段采样地形真实高程</span>
            </div>
            <span class="status-tag">{{ params.showSampled ? '显示' : '隐藏' }}</span>
          </div>

          <div
            class="legend-item"
            :class="{ active: params.showPrimitive }"
            @click="toggleParam('showPrimitive')"
          >
            <span
              class="badge-dot"
              :style="{ backgroundColor: params.primitiveColor }"
            ></span>
            <div class="item-text">
              <span class="tech-name">4. 底层 GroundPolylinePrimitive</span>
              <span class="tech-sub">面向海量道路管网数据的高性能图元</span>
            </div>
            <span class="status-tag">{{ params.showPrimitive ? '显示' : '隐藏' }}</span>
          </div>
        </div>

        <div class="legend-footer" v-if="samplingStatus">
          <span class="sample-info">{{ samplingStatus }}</span>
        </div>
      </div>
    </div>
  </demo-box>
</template>

<script setup name="GroundPolyline">
import { ref, reactive, useTemplateRef, onMounted, onBeforeUnmount } from "vue";
import Cesium from "cesium";
import { createViewer, optimizeViewerQuality } from "@/utils/cesium";
import { createGUI } from "@/utils/gui";

const containerRef = useTemplateRef("containerRef");
let viewer = null;
let gui = null;

// 珠穆朗玛峰测试地理场景（官方 Ground Clamping 经典场景）
const SCENE_CONFIG = {
  label: "珠穆朗玛峰山脊",
  positions: [
    [86.925765, 27.988057],
    [86.976497, 27.988057],
  ],
  // 经典侧向鸟瞰观察视角：从侧方低仰角/斜俯视观察山脊，极大凸显贴地与起伏
  camera: {
    target: new Cesium.Cartesian3(
      300770.50072389364,
      5634912.131394595,
      2978152.2865545116
    ),
    // 侧向偏移：拉开 Y 轴横向观察距离，降低 Z 轴垂直距离形成低角度侧看
    offset: new Cesium.Cartesian3(
      4200.0,
      -3800.0,
      1600.0
    ),
  },
};

const currentSceneLabel = ref("珠穆朗玛峰山脊 (Everest Ridge)");
const samplingStatus = ref("");

// 控制面板参数
const params = reactive({
  // 全局地球地形开关
  showTerrain: true,

  // 0. 未贴地普通线
  showNormal: true,
  normalColor: "#94a3b8",
  normalWidth: 4,

  // 1. 原生贴地线
  showClamp: true,
  clampColor: "#facc15",
  clampWidth: 6,

  // 2. 走廊模拟贴地线
  showCorridor: true,
  corridorColor: "#22c55e",
  corridorWidth: 50, // 走廊宽度（米）

  // 3. 高精度地形采样插值线
  showSampled: true,
  sampledColor: "#f97316",
  sampledWidth: 6,
  sampleCount: 300,
  sampleOffset: 2.0, // 抬高偏移（米，防止与地形产生深度闪烁）

  // 4. 底层 Primitive 贴地线
  showPrimitive: false,
  primitiveColor: "#38bdf8",
  primitiveWidth: 5,
});

// 场景实体与图元引用
let normalEntity = null;
let clampEntity = null;
let corridorEntity = null;
let sampledEntity = null;
let primitiveInstance = null;
let terrainInstance = null;
let ellipsoidProvider = null;

onMounted(() => {
  init();
});

async function init() {
  if (!containerRef.value) return;

  terrainInstance = Cesium.Terrain.fromWorldTerrain({
    requestVertexNormals: true,
    requestWaterMask: true,
  });
  ellipsoidProvider = new Cesium.EllipsoidTerrainProvider();

  // 1. 初始化 Viewer 并加载全球真实 3D 地形
  viewer = createViewer(containerRef.value, {
    terrain: terrainInstance,
    baseLayerPicker: false,
    timeline: false,
    animation: false,
  });
  optimizeViewerQuality(viewer);

  // 开启地形深度检测，凸显山体对未贴地普通折线的真实遮挡
  viewer.scene.globe.depthTestAgainstTerrain = true;

  // 2. 渲染所有贴地线方案
  await buildAllLines();
  flyToCurrentScene(0);

  // 3. 初始化控制面板
  setupGUI();

  // 4. 当地形 Provider 异步就绪后，再触发高精度地形采样插值（方案 3）
  terrainInstance.readyEvent.addEventListener(() => {
    buildSampledTerrainLine(SCENE_CONFIG.positions);
  });
}

/**
 * 切换真实 3D 地形与默认平滑椭球面
 */
function toggleTerrain(enabled) {
  if (!viewer) return;
  if (enabled) {
    viewer.scene.setTerrain(terrainInstance);
    viewer.scene.globe.depthTestAgainstTerrain = true;
    buildSampledTerrainLine(SCENE_CONFIG.positions);
  } else {
    viewer.scene.terrainProvider = ellipsoidProvider;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    buildSampledTerrainLine(SCENE_CONFIG.positions);
  }
}

/**
 * 快捷切换参数并联动实体
 */
function toggleParam(key) {
  params[key] = !params[key];
  syncEntitiesVisibility();
}

/**
 * 重建当前场景下的全部贴地线方案
 */
async function buildAllLines() {
  if (!viewer) return;
  clearAllEntities();

  const positionsDeg = SCENE_CONFIG.positions.flat();
  const positionsCartesian = Cesium.Cartesian3.fromDegreesArray(positionsDeg);

  // -------------------------------------------------------------
  // 方案 0：普通未贴地空间折线 (Normal Polyline)
  // -------------------------------------------------------------
  normalEntity = viewer.entities.add({
    name: "0. 普通折线 (未贴地)",
    polyline: {
      positions: positionsCartesian,
      width: params.normalWidth,
      material: Cesium.Color.fromCssColorString(params.normalColor),
      clampToGround: false,
      show: params.showNormal,
    },
  });

  // -------------------------------------------------------------
  // 方案 1：现代原生贴地线 (clampToGround: true)
  // -------------------------------------------------------------
  clampEntity = viewer.entities.add({
    name: "1. 原生贴地线 (clampToGround: true)",
    polyline: {
      positions: positionsCartesian,
      width: params.clampWidth,
      clampToGround: true, // 核心属性：自动吸附地表
      classificationType: Cesium.ClassificationType.TERRAIN,
      material: Cesium.Color.fromCssColorString(params.clampColor),
      show: params.showClamp,
    },
  });

  // -------------------------------------------------------------
  // 方案 2：走廊多边形模拟贴地线 (Corridor)
  // -------------------------------------------------------------
  corridorEntity = viewer.entities.add({
    name: "2. 走廊模拟贴地线 (Corridor)",
    corridor: {
      positions: positionsCartesian,
      width: params.corridorWidth,
      cornerType: Cesium.CornerType.ROUNDED,
      material: Cesium.Color.fromCssColorString(params.corridorColor).withAlpha(
        0.85
      ),
      classificationType: Cesium.ClassificationType.TERRAIN,
      show: params.showCorridor,
    },
  });

  // -------------------------------------------------------------
  // 方案 3：高精度地形高度采样插值线 (SampleTerrain)
  // -------------------------------------------------------------
  await buildSampledTerrainLine(SCENE_CONFIG.positions);

  // -------------------------------------------------------------
  // 方案 4：底层 GroundPolylinePrimitive
  // -------------------------------------------------------------
  buildGroundPrimitiveLine(positionsCartesian);
}

/**
 * 方案 3 实现：在两点/多点间细密插值，异步采样地形高程切片
 */
async function buildSampledTerrainLine(points) {
  if (sampledEntity) {
    viewer.entities.remove(sampledEntity);
    sampledEntity = null;
  }

  const terrainProvider = viewer?.terrainProvider || viewer?.scene?.globe?.terrainProvider;
  if (!terrainProvider || !terrainProvider.availability) {
    samplingStatus.value = "地形服务异步握手中，稍候自动计算采样...";
    return;
  }

  samplingStatus.value = `正在采样地形高程 (${params.sampleCount} 点)...`;

  try {
    const rawCartographics = points.map(([lon, lat]) =>
      Cesium.Cartographic.fromDegrees(lon, lat)
    );

    // 等间距细分插值生成采样点列
    const sampleCartographics = [];
    for (let seg = 0; seg < rawCartographics.length - 1; seg++) {
      const pStart = rawCartographics[seg];
      const pEnd = rawCartographics[seg + 1];
      const count = Math.max(
        10,
        Math.floor(params.sampleCount / (rawCartographics.length - 1))
      );

      for (let i = 0; i <= count; i++) {
        const ratio = i / count;
        const lon = Cesium.Math.lerp(pStart.longitude, pEnd.longitude, ratio);
        const lat = Cesium.Math.lerp(pStart.latitude, pEnd.latitude, ratio);
        sampleCartographics.push(new Cesium.Cartographic(lon, lat));
      }
    }

    // 核心异步 API：向 terrainProvider 发起地形高程高精度瓦片采样查询
    const samples = await Cesium.sampleTerrainMostDetailed(
      terrainProvider,
      sampleCartographics
    );

    // 叠加微小垂直偏移（防止与地表同高产生 Z-Fighting 深度网格斑驳闪烁）
    for (let i = 0; i < samples.length; i++) {
      samples[i].height = (samples[i].height || 0) + params.sampleOffset;
    }

    const sampledCartesians =
      Cesium.Ellipsoid.WGS84.cartographicArrayToCartesianArray(samples);

    sampledEntity = viewer.entities.add({
      name: "3. 地形高度采样插值线 (SampleTerrain)",
      polyline: {
        positions: sampledCartesians,
        followSurface: false,
        width: params.sampledWidth,
        material: new Cesium.PolylineOutlineMaterialProperty({
          color: Cesium.Color.fromCssColorString(params.sampledColor),
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
        }),
        // 遮挡部分（背山面）以暗红色高亮呈现
        depthFailMaterial: new Cesium.PolylineOutlineMaterialProperty({
          color: Cesium.Color.DARKRED,
          outlineWidth: 1.5,
          outlineColor: Cesium.Color.BLACK,
        }),
        show: params.showSampled,
      },
    });

    samplingStatus.value = `地形采样完成：成功插值 ${samples.length} 个三维高程点`;
  } catch (err) {
    console.warn("地形高程采样失败或地形不可用", err);
    samplingStatus.value = "外网地形请求受限，未获取到高程瓦片";
  }
}

/**
 * 方案 4 实现：面向海量大数据矢量的 GroundPolylinePrimitive
 */
function buildGroundPrimitiveLine(positions) {
  if (primitiveInstance) {
    viewer.scene.groundPrimitives.remove(primitiveInstance);
    primitiveInstance = null;
  }

  const geometryInstance = new Cesium.GeometryInstance({
    geometry: new Cesium.GroundPolylineGeometry({
      positions,
      width: params.primitiveWidth,
    }),
    id: "ground-primitive-line",
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(
        Cesium.Color.fromCssColorString(params.primitiveColor)
      ),
    },
  });

  primitiveInstance = new Cesium.GroundPolylinePrimitive({
    geometryInstances: geometryInstance,
    classificationType: Cesium.ClassificationType.TERRAIN,
    show: params.showPrimitive,
  });

  viewer.scene.groundPrimitives.add(primitiveInstance);
}

/**
 * 同步显隐状态
 */
function syncEntitiesVisibility() {
  if (normalEntity?.polyline) normalEntity.polyline.show = params.showNormal;
  if (clampEntity?.polyline) clampEntity.polyline.show = params.showClamp;
  if (corridorEntity?.corridor)
    corridorEntity.corridor.show = params.showCorridor;
  if (sampledEntity?.polyline) sampledEntity.polyline.show = params.showSampled;
  if (primitiveInstance) primitiveInstance.show = params.showPrimitive;
}

/**
 * 平滑飞往珠穆朗玛峰最佳观测视角
 */
function flyToCurrentScene(duration = 2.0) {
  if (!viewer) return;
  // 官方 Ground Clamping 原版 lookAt 视角锁定
  viewer.camera.lookAt(SCENE_CONFIG.camera.target, SCENE_CONFIG.camera.offset);
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
}

/**
 * 清除所有当前图元与实体
 */
function clearAllEntities() {
  if (!viewer) return;
  [normalEntity, clampEntity, corridorEntity, sampledEntity].forEach((e) => {
    if (e) viewer.entities.remove(e);
  });
  if (primitiveInstance) {
    viewer.scene.groundPrimitives.remove(primitiveInstance);
    primitiveInstance = null;
  }
  normalEntity = null;
  clampEntity = null;
  corridorEntity = null;
  sampledEntity = null;
}

/**
 * 初始化 lil-gui 操作面板
 */
function setupGUI() {
  gui = createGUI({
    container: containerRef.value,
    title: "贴地线实现方案 (Ground Polyline)",
    width: 310,
    position: "top-left",
  });

  // 1. 全局地形开关
  const terrainFolder = gui.addFolder("地形环境配置");
  terrainFolder
    .add(params, "showTerrain")
    .name("开启 3D 地形")
    .onChange((val) => {
      toggleTerrain(val);
    });

  // 2. 方案 0：普通未贴地折线
  const normalFolder = gui.addFolder("0. 普通折线 (未贴地对比)");
  normalFolder
    .add(params, "showNormal")
    .name("启用显示")
    .onChange((val) => {
      if (normalEntity?.polyline) normalEntity.polyline.show = val;
    });
  normalFolder
    .addColor(params, "normalColor")
    .name("线条颜色")
    .onChange((val) => {
      if (normalEntity?.polyline) {
        normalEntity.polyline.material = Cesium.Color.fromCssColorString(val);
      }
    });
  normalFolder
    .add(params, "normalWidth", 1, 15, 1)
    .name("线宽 (px)")
    .onChange((val) => {
      if (normalEntity?.polyline) normalEntity.polyline.width = val;
    });

  // 3. 方案 1：原生贴地线 (clampToGround)
  const clampFolder = gui.addFolder("1. 原生贴地线 (clampToGround)");
  clampFolder
    .add(params, "showClamp")
    .name("启用显示")
    .onChange((val) => {
      if (clampEntity?.polyline) clampEntity.polyline.show = val;
    });
  clampFolder
    .addColor(params, "clampColor")
    .name("线条颜色")
    .onChange((val) => {
      if (clampEntity?.polyline) {
        clampEntity.polyline.material = Cesium.Color.fromCssColorString(val);
      }
    });
  clampFolder
    .add(params, "clampWidth", 1, 20, 1)
    .name("线宽 (px)")
    .onChange((val) => {
      if (clampEntity?.polyline) clampEntity.polyline.width = val;
    });

  // 4. 方案 2：走廊多边形模拟贴地线
  const corridorFolder = gui.addFolder("2. 走廊模拟贴地线 (Corridor)");
  corridorFolder
    .add(params, "showCorridor")
    .name("启用显示")
    .onChange((val) => {
      if (corridorEntity?.corridor) corridorEntity.corridor.show = val;
    });
  corridorFolder
    .addColor(params, "corridorColor")
    .name("填充颜色")
    .onChange((val) => {
      if (corridorEntity?.corridor) {
        corridorEntity.corridor.material = Cesium.Color.fromCssColorString(
          val
        ).withAlpha(0.85);
      }
    });
  corridorFolder
    .add(params, "corridorWidth", 10, 200, 5)
    .name("走廊宽度 (m)")
    .onChange((val) => {
      if (corridorEntity?.corridor) corridorEntity.corridor.width = val;
    });

  // 5. 方案 3：地形高程采样插值线 (SampleTerrain)
  const sampledFolder = gui.addFolder("3. 地形高度采样线 (SampleTerrain)");
  sampledFolder
    .add(params, "showSampled")
    .name("启用显示")
    .onChange((val) => {
      if (sampledEntity?.polyline) sampledEntity.polyline.show = val;
    });
  sampledFolder
    .addColor(params, "sampledColor")
    .name("正面颜色")
    .onChange((val) => {
      if (sampledEntity?.polyline) {
        sampledEntity.polyline.material =
          new Cesium.PolylineOutlineMaterialProperty({
            color: Cesium.Color.fromCssColorString(val),
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
          });
      }
    });
  sampledFolder
    .add(params, "sampleOffset", 0.0, 10.0, 0.5)
    .name("离地偏移 (m)")
    .onFinishChange(async () => {
      await buildSampledTerrainLine(SCENE_CONFIG.positions);
    });
  sampledFolder
    .add(params, "sampleCount", 50, 600, 50)
    .name("采样点数")
    .onFinishChange(async () => {
      await buildSampledTerrainLine(SCENE_CONFIG.positions);
    });

  // 6. 方案 4：底层 Primitive 贴地线
  const primFolder = gui.addFolder("4. GroundPolylinePrimitive");
  primFolder
    .add(params, "showPrimitive")
    .name("启用显示")
    .onChange((val) => {
      if (primitiveInstance) primitiveInstance.show = val;
    });
  primFolder
    .add(params, "primitiveWidth", 1, 15, 1)
    .name("线宽 (px)")
    .onFinishChange(() => {
      const positionsCartesian = Cesium.Cartesian3.fromDegreesArray(
        SCENE_CONFIG.positions.flat()
      );
      buildGroundPrimitiveLine(positionsCartesian);
    });

  // 7. 视角辅助
  const viewFolder = gui.addFolder("视角操作");
  const actions = {
    flyToScene: () => flyToCurrentScene(1.5),
  };
  viewFolder.add(actions, "flyToScene").name("▶ 重置观察视角");
}

onBeforeUnmount(() => {
  clearAllEntities();
  if (gui) {
    gui.destroy();
    gui = null;
  }
  if (viewer && !viewer.isDestroyed()) {
    viewer.destroy();
    viewer = null;
  }
});
</script>

<style scoped>
.legend-card {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 10;
  width: 340px;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  color: #f1f5f9;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  overflow: hidden;
  user-select: none;
}

.legend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.legend-title {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
}

.scene-badge {
  font-size: 11px;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(56, 189, 248, 0.3);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-body {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  &.active {
    border-color: rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
  }
}

.badge-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}

.item-text {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.tech-name {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
}

.tech-sub {
  font-size: 10.5px;
  color: #94a3b8;
  line-height: 1.3;
}

.status-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.06);

  .active & {
    color: #4ade80;
    background: rgba(74, 222, 128, 0.15);
  }
}

.legend-footer {
  padding: 8px 14px;
  background: rgba(0, 0, 0, 0.25);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.sample-info {
  font-size: 11px;
  color: #cbd5e1;
  font-family: "JetBrains Mono", Consolas, monospace;
}
</style>

