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
      <!-- 航线弧段对比状态 HUD 悬浮面板 -->
      <div class="legend-card">
        <div class="legend-header">
          <span class="legend-title">Cesium.ArcType 弧段对比</span>
          <span class="route-tag">{{ currentRouteName }}</span>
        </div>

        <div class="legend-body">
          <div class="legend-row geodesic">
            <span
              class="color-dot"
              :style="{ backgroundColor: params.geodesicColor }"
            ></span>
            <div class="row-info">
              <span class="type-name">GEODESIC (大圆弧线 / 测地线)</span>
              <span class="type-desc">三维曲面最短路径（劣弧）</span>
            </div>
            <span class="dist-val">{{ routeStats.geodesicDist }} km</span>
          </div>

          <div class="legend-row rhumb">
            <span
              class="color-dot"
              :style="{ backgroundColor: params.rhumbColor }"
            ></span>
            <div class="row-info">
              <span class="type-name">RHUMB (恒向线 / 等角航线)</span>
              <span class="type-desc">墨卡托投影直线，航向角恒定</span>
            </div>
            <span class="dist-val">{{ routeStats.rhumbDist }} km</span>
          </div>

          <div class="legend-row none">
            <span
              class="color-dot"
              :style="{ backgroundColor: params.noneColor }"
            ></span>
            <div class="row-info">
              <span class="type-name">NONE (空间直线 / 空间弦)</span>
              <span class="type-desc">空间绝对直线，下穿地球内部</span>
            </div>
            <span class="dist-val">{{ routeStats.chordDist }} km</span>
          </div>
        </div>

        <div class="legend-footer">
          <div class="stat-badge">
            <span class="stat-label">航程差 (恒向线 - 大圆):</span>
            <span class="stat-highlight">
              +{{ routeStats.diffDist }} km ({{ routeStats.diffRatio }}%)
            </span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">直线最大下潜深度:</span>
            <span class="stat-depth">{{ routeStats.maxDepth }} km</span>
          </div>
        </div>
      </div>
    </div>
  </demo-box>
</template>

<script setup name="PolylineArcType">
import { ref, reactive, useTemplateRef, onMounted, onBeforeUnmount } from "vue";
import Cesium from "cesium";
import { createViewer, optimizeViewerQuality } from "@/utils/cesium";
import { createGUI } from "@/utils/gui";

const containerRef = useTemplateRef("containerRef");
let viewer = null;
let gui = null;

// 经典跨洲预设航线
const ROUTE_PRESETS = {
  LondonToSanFrancisco: {
    label: "伦敦 ↔ 旧金山 (跨大西洋经典)",
    start: { name: "伦敦 (London)", lon: -0.1278, lat: 51.5074 },
    end: { name: "旧金山 (San Francisco)", lon: -122.4194, lat: 37.7749 },
    view: {
      destination: [-60.0, 58.0, 11000000.0],
      heading: 0,
      pitch: -80,
    },
  },
  BeijingToNewYork: {
    label: "北京 ↔ 纽约 (跨北极圈极地航线)",
    start: { name: "北京 (Beijing)", lon: 116.4074, lat: 39.9042 },
    end: { name: "纽约 (New York)", lon: -74.006, lat: 40.7128 },
    view: {
      destination: [-170.0, 75.0, 12000000.0],
      heading: 0,
      pitch: -85,
    },
  },
  TokyoToSydney: {
    label: "东京 ↔ 悉尼 (跨赤道南北半球)",
    start: { name: "东京 (Tokyo)", lon: 139.6917, lat: 35.6895 },
    end: { name: "悉尼 (Sydney)", lon: 151.2093, lat: -33.8688 },
    view: {
      destination: [145.0, 0.0, 13000000.0],
      heading: 0,
      pitch: -85,
    },
  },
  ParisToMelbourne: {
    label: "巴黎 ↔ 墨尔本 (超远距离对跖航线)",
    start: { name: "巴黎 (Paris)", lon: 2.3522, lat: 48.8566 },
    end: { name: "墨尔本 (Melbourne)", lon: 144.9631, lat: -37.8136 },
    view: {
      destination: [75.0, 10.0, 15000000.0],
      heading: 0,
      pitch: -85,
    },
  },
};

const currentRouteName = ref("伦敦 ↔ 旧金山 (跨大西洋经典)");

// 面板交互参数
const params = reactive({
  routeKey: "LondonToSanFrancisco",

  // 1. 大圆弧线
  showGeodesic: true,
  geodesicColor: "#ff3b30",
  geodesicWidth: 4.5,

  // 2. 恒向线
  showRhumb: true,
  rhumbColor: "#34c759",
  rhumbWidth: 4.5,

  // 3. 空间直线
  showNone: true,
  noneColor: "#af52de",
  noneWidth: 4.5,

  // 辅助观察
  showMarkers: true,
  globeAlpha: 1.0,
  depthTest: true,
});

// 统计计算响应式数据
const routeStats = reactive({
  geodesicDist: "0.0",
  rhumbDist: "0.0",
  chordDist: "0.0",
  diffDist: "0.0",
  diffRatio: "0.0",
  maxDepth: "0.0",
});

// 场景实体引用
let geodesicEntity = null;
let rhumbEntity = null;
let noneEntity = null;
let startMarker = null;
let endMarker = null;

onMounted(() => {
  init();
});

function init() {
  if (!containerRef.value) return;

  // 1. 创建 Cesium Viewer
  viewer = createViewer(containerRef.value, {
    baseLayerPicker: false,
    timeline: false,
    animation: false,
  });
  optimizeViewerQuality(viewer);

  // 默认启用深度检测，以准确呈现三维遮挡与地底被遮挡效果
  viewer.scene.globe.depthTestAgainstTerrain = params.depthTest;
  updateGlobeAlpha(params.globeAlpha);

  // 2. 构建弧段实体并加载默认航线
  updateRouteLines();
  flyToCurrentRoute(0);

  // 3. 构建 lil-gui 控制面板
  setupGUI();
}

/**
 * 根据当前选中的路线构建 3 类 ArcType 实体及地标
 */
function updateRouteLines() {
  if (!viewer) return;

  const route = ROUTE_PRESETS[params.routeKey];
  currentRouteName.value = route.label;

  const p1Cartographic = Cesium.Cartographic.fromDegrees(
    route.start.lon,
    route.start.lat
  );
  const p2Cartographic = Cesium.Cartographic.fromDegrees(
    route.end.lon,
    route.end.lat
  );

  const p1Cartesian = Cesium.Cartesian3.fromDegrees(
    route.start.lon,
    route.start.lat,
    1000
  );
  const p2Cartesian = Cesium.Cartesian3.fromDegrees(
    route.end.lon,
    route.end.lat,
    1000
  );
  const positions = [p1Cartesian, p2Cartesian];

  // 计算三种航线的真实数学距离与深入地心参数
  calculateDistances(p1Cartographic, p2Cartographic, p1Cartesian, p2Cartesian);

  // 清除旧实体
  clearEntities();

  // (1) 大圆弧线 Cesium.ArcType.GEODESIC
  geodesicEntity = viewer.entities.add({
    name: "大圆航线 (Cesium.ArcType.GEODESIC)",
    polyline: {
      positions,
      width: params.geodesicWidth,
      arcType: Cesium.ArcType.GEODESIC,
      material: Cesium.Color.fromCssColorString(params.geodesicColor),
      show: params.showGeodesic,
    },
  });

  // (2) 恒向线 Cesium.ArcType.RHUMB
  rhumbEntity = viewer.entities.add({
    name: "恒向线 (Cesium.ArcType.RHUMB)",
    polyline: {
      positions,
      width: params.rhumbWidth,
      arcType: Cesium.ArcType.RHUMB,
      material: Cesium.Color.fromCssColorString(params.rhumbColor),
      show: params.showRhumb,
    },
  });

  // (3) 空间直线 Cesium.ArcType.NONE
  noneEntity = viewer.entities.add({
    name: "空间直线 (Cesium.ArcType.NONE)",
    polyline: {
      positions,
      width: params.noneWidth,
      arcType: Cesium.ArcType.NONE,
      material: Cesium.Color.fromCssColorString(params.noneColor),
      show: params.showNone,
    },
  });

  // (4) 起点与终点标识点
  startMarker = createCityMarker(route.start, "#007aff");
  endMarker = createCityMarker(route.end, "#ff9500");
}

/**
 * 创建城市标牌与发光点实体
 */
function createCityMarker(city, colorCss) {
  return viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(city.lon, city.lat, 1000),
    point: {
      pixelSize: 10,
      color: Cesium.Color.fromCssColorString(colorCss),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      show: params.showMarkers,
    },
    label: {
      text: city.name,
      font: "bold 13px sans-serif",
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -12),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      show: params.showMarkers,
    },
  });
}

/**
 * 严格计算三种弧段的地理物理距离
 */
function calculateDistances(p1Cg, p2Cg, p1Cs, p2Cs) {
  // 1. 大圆弧线距离 (EllipsoidGeodesic)
  const geodesic = new Cesium.EllipsoidGeodesic(p1Cg, p2Cg);
  const geoDistMeters = geodesic.surfaceDistance;
  const geoDistKm = geoDistMeters / 1000;

  // 2. 恒向线距离 (EllipsoidRhumbLine)
  const rhumb = new Cesium.EllipsoidRhumbLine(p1Cg, p2Cg);
  const rhumbDistMeters = rhumb.surfaceDistance;
  const rhumbDistKm = rhumbDistMeters / 1000;

  // 3. 空间直线弦长 (Cartesian3.distance)
  const chordDistMeters = Cesium.Cartesian3.distance(p1Cs, p2Cs);
  const chordDistKm = chordDistMeters / 1000;

  // 4. 空间直线最大深入地下深度 (h = R - sqrt(R^2 - (L/2)^2))
  const earthRadius = 6371.0;
  const halfChord = chordDistKm / 2;
  const maxDepthKm =
    halfChord < earthRadius
      ? earthRadius - Math.sqrt(earthRadius * earthRadius - halfChord * halfChord)
      : earthRadius;

  const diffKm = rhumbDistKm - geoDistKm;
  const diffRatio = ((diffKm / geoDistKm) * 100).toFixed(1);

  routeStats.geodesicDist = geoDistKm.toFixed(1);
  routeStats.rhumbDist = rhumbDistKm.toFixed(1);
  routeStats.chordDist = chordDistKm.toFixed(1);
  routeStats.diffDist = diffKm.toFixed(1);
  routeStats.diffRatio = diffRatio;
  routeStats.maxDepth = maxDepthKm.toFixed(1);
}

/**
 * 相机平滑飞往当前航线的宏观鸟瞰视角
 */
function flyToCurrentRoute(duration = 2.0) {
  if (!viewer) return;
  const route = ROUTE_PRESETS[params.routeKey];
  const [lon, lat, height] = route.view.destination;

  const target = {
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
    orientation: {
      heading: Cesium.Math.toRadians(route.view.heading),
      pitch: Cesium.Math.toRadians(route.view.pitch),
      roll: 0.0,
    },
    duration,
  };

  if (duration === 0) {
    viewer.camera.setView(target);
  } else {
    viewer.camera.flyTo(target);
  }
}

/**
 * 清除现有弧段实体与标记
 */
function clearEntities() {
  if (!viewer) return;
  [geodesicEntity, rhumbEntity, noneEntity, startMarker, endMarker].forEach(
    (e) => {
      if (e) viewer.entities.remove(e);
    }
  );
  geodesicEntity = null;
  rhumbEntity = null;
  noneEntity = null;
  startMarker = null;
  endMarker = null;
}

/**
 * 启用并更新地球透明度（Globe Translucency）以透视内部穿地空间直线
 */
function updateGlobeAlpha(val) {
  if (!viewer) return;
  const isTranslucent = val < 1.0;

  // 1. 开启 Cesium 地球几何体半透明（让地球变成半透明晶莹球体）
  viewer.scene.globe.translucency.enabled = isTranslucent;
  viewer.scene.globe.translucency.frontFaceAlpha = val;
  viewer.scene.globe.translucency.backFaceAlpha = val;

  // 2. 半透明状态下关闭防穿地检测，允许相机自由透视地表
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = !isTranslucent;

  // 3. 联动同步底图影像透明度
  const baseLayer = viewer.scene.globe.imageryLayers.get(0);
  if (baseLayer) {
    baseLayer.alpha = val;
  }
}

/**
 * 构建交互式 lil-gui 面板
 */
function setupGUI() {
  gui = createGUI({
    container: containerRef.value,
    title: "Polyline 弧段类型 (ArcType)",
    width: 300,
    position: "top-left",
  });

  // 1. 预设航线选择
  const routeOptions = {};
  Object.keys(ROUTE_PRESETS).forEach((k) => {
    routeOptions[ROUTE_PRESETS[k].label] = k;
  });

  gui
    .add(params, "routeKey", routeOptions)
    .name("选择航线")
    .onChange(() => {
      updateRouteLines();
      flyToCurrentRoute(1.8);
    });

  // 2. 大圆航线控制 (GEODESIC)
  const geoFolder = gui.addFolder("大圆航线 (GEODESIC)");
  geoFolder
    .add(params, "showGeodesic")
    .name("显示大圆弧线")
    .onChange((val) => {
      if (geodesicEntity?.polyline) geodesicEntity.polyline.show = val;
    });
  geoFolder
    .addColor(params, "geodesicColor")
    .name("线条颜色")
    .onChange((val) => {
      if (geodesicEntity?.polyline) {
        geodesicEntity.polyline.material = Cesium.Color.fromCssColorString(val);
      }
    });
  geoFolder
    .add(params, "geodesicWidth", 1, 12, 0.5)
    .name("线条宽度 (px)")
    .onChange((val) => {
      if (geodesicEntity?.polyline) geodesicEntity.polyline.width = val;
    });

  // 3. 恒向线控制 (RHUMB)
  const rhumbFolder = gui.addFolder("恒向线 (RHUMB)");
  rhumbFolder
    .add(params, "showRhumb")
    .name("显示恒向线")
    .onChange((val) => {
      if (rhumbEntity?.polyline) rhumbEntity.polyline.show = val;
    });
  rhumbFolder
    .addColor(params, "rhumbColor")
    .name("线条颜色")
    .onChange((val) => {
      if (rhumbEntity?.polyline) {
        rhumbEntity.polyline.material = Cesium.Color.fromCssColorString(val);
      }
    });
  rhumbFolder
    .add(params, "rhumbWidth", 1, 12, 0.5)
    .name("线条宽度 (px)")
    .onChange((val) => {
      if (rhumbEntity?.polyline) rhumbEntity.polyline.width = val;
    });

  // 4. 空间直线控制 (NONE)
  const noneFolder = gui.addFolder("空间直线 (NONE)");
  noneFolder
    .add(params, "showNone")
    .name("显示空间直线")
    .onChange((val) => {
      if (noneEntity?.polyline) noneEntity.polyline.show = val;
    });
  noneFolder
    .addColor(params, "noneColor")
    .name("线条颜色")
    .onChange((val) => {
      if (noneEntity?.polyline) {
        noneEntity.polyline.material = Cesium.Color.fromCssColorString(val);
      }
    });
  noneFolder
    .add(params, "noneWidth", 1, 12, 0.5)
    .name("线条宽度 (px)")
    .onChange((val) => {
      if (noneEntity?.polyline) noneEntity.polyline.width = val;
    });

  // 5. 场景与观察视角
  const sceneFolder = gui.addFolder("透视与视角辅助");
  sceneFolder
    .add(params, "showMarkers")
    .name("显示起止地标")
    .onChange((val) => {
      if (startMarker?.point) startMarker.point.show = val;
      if (startMarker?.label) startMarker.label.show = val;
      if (endMarker?.point) endMarker.point.show = val;
      if (endMarker?.label) endMarker.label.show = val;
    });
  sceneFolder
    .add(params, "globeAlpha", 0.0, 1.0, 0.05)
    .name("地球透明度 (透视地底)")
    .onChange((val) => updateGlobeAlpha(val));
  sceneFolder
    .add(params, "depthTest")
    .name("地表深度检测")
    .onChange((val) => {
      viewer.scene.globe.depthTestAgainstTerrain = val;
    });

  const actions = {
    flyToView: () => flyToCurrentRoute(1.5),
  };
  sceneFolder.add(actions, "flyToView").name("▶ 飞向当前航线全景");
}

onBeforeUnmount(() => {
  clearEntities();
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
  width: 330px;
  background: rgba(18, 24, 38, 0.88);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
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
  letter-spacing: 0.5px;
  color: #ffffff;
}

.route-tag {
  font-size: 11px;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.12);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(56, 189, 248, 0.3);
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-body {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}

.row-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.type-name {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
}

.type-desc {
  font-size: 10.5px;
  color: #94a3b8;
}

.dist-val {
  font-family: "JetBrains Mono", Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  color: #f8fafc;
}

.legend-footer {
  padding: 8px 14px 10px;
  background: rgba(0, 0, 0, 0.25);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-badge {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
}

.stat-highlight {
  font-weight: 600;
  color: #f59e0b;
  font-family: "JetBrains Mono", Consolas, monospace;
}

.stat-depth {
  font-weight: 600;
  color: #c084fc;
  font-family: "JetBrains Mono", Consolas, monospace;
}
</style>

