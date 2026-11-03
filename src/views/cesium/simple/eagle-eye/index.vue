<template>
  <demo-box
    :extra-files="[
      './Tianditu.js',
      {
        file: '@/utils/cesium.js',
        pick: ['createViewer', 'optimizeViewerQuality'],
      },
    ]"
  >
    <div class="eagle-eye-page">
      <!-- 主三维场景容器 -->
      <div ref="mainViewerRef" class="main-viewer"></div>

      <!-- 右下角鹰眼悬浮小窗 -->
      <div class="eagle-eye-window" :class="{ collapsed: isEagleEyeCollapsed }">
        <div class="eagle-eye-header">
          <div class="header-left">
            <span class="pulse-indicator"></span>
            <span class="title">鹰眼导航 (2D Overview)</span>
          </div>
          <div class="header-actions">
            <span
              class="action-btn"
              :title="isEagleEyeCollapsed ? '展开鹰眼' : '折叠鹰眼'"
              @click="isEagleEyeCollapsed = !isEagleEyeCollapsed"
            >
              {{ isEagleEyeCollapsed ? '▢' : '一' }}
            </span>
          </div>
        </div>
        <div v-show="!isEagleEyeCollapsed" class="eagle-eye-body">
          <div ref="eagleEyeViewerRef" class="eagle-eye-viewer"></div>
          <!-- 鹰眼中心准星指示器 -->
          <div class="crosshair-indicator"></div>
        </div>
      </div>
    </div>
  </demo-box>
</template>

<script setup name="EagleEye">
import { ref, onMounted, onBeforeUnmount } from "vue";
import Cesium from "cesium";
import { createViewer, optimizeViewerQuality } from "@/utils/cesium";
import { createGUI } from "@/utils/gui";
import Tianditu from "@/utils/tianditu";

const mainViewerRef = ref(null);
const eagleEyeViewerRef = ref(null);
const isEagleEyeCollapsed = ref(false);

const tdt = new Tianditu();

let viewer = null;
let viewerEagle = null;
let extentEntity = null;
let removePreRenderListener = null;
let gui = null;

onMounted(() => {
  init();
});

// 参数控制面板
const params = {
  mapType: "天地图影像", // 默认加载天地图影像
  scaleRatio: 3.0, // 鹰眼相对于主图的高空放大倍率
  showExtent: true, // 是否显示视域红色边界线
  extentWidth: 2.5, // 边界线宽
  extentColor: "#ef4444", // 视域线颜色
  minHeight: 300.0, // 最小限制高度（米）
  maxHeight: 20000000.0, // 最大限制高度（米）
};

// 预分配对象与缓存数组，彻底避免高频运行时的 GC 压力
const scratchC2 = new Cesium.Cartesian2();
let activePositions = [];
let closedPositions = [];

/**
 * 拾取屏幕坐标与椭球面交点；若在地球外部（如看天空或大仰角），则从中心向外二分逼近地平线切线边缘
 */
function pickScreenOrHorizon(scene, ellipsoid, targetX, targetY, centerX, centerY) {
  scratchC2.x = targetX;
  scratchC2.y = targetY;
  const directPos = scene.camera.pickEllipsoid(scratchC2, ellipsoid);
  if (directPos) return Cesium.Cartesian3.clone(directPos);

  // 如果目标角在地球外部，从中心点向目标角二分探测地平线边缘
  let lowT = 0.0;
  let highT = 1.0;
  let bestPos = null;

  for (let i = 0; i < 4; i++) {
    const midT = (lowT + highT) * 0.5;
    scratchC2.x = centerX + (targetX - centerX) * midT;
    scratchC2.y = centerY + (targetY - centerY) * midT;
    const testPos = scene.camera.pickEllipsoid(scratchC2, ellipsoid);
    if (testPos) {
      bestPos = testPos;
      lowT = midT;
    } else {
      highT = midT;
    }
  }

  return bestPos ? Cesium.Cartesian3.clone(bestPos) : null;
}

/**
 * 实时获取主视图 Camera 在地面的 4 个角视域范围，支持任意旋转与全缩放等级
 */
function updateCameraExtent() {
  if (!viewer || !viewer.scene || !viewer.camera) {
    activePositions = [];
    return;
  }

  const scene = viewer.scene;
  const canvas = scene.canvas;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0) return;

  const ellipsoid = scene.globe.ellipsoid;
  const cx = width * 0.5;
  const cy = height * 0.5;

  // 四个角点（按顺时针闭合顺序：左下 -> 右下 -> 右上 -> 左上）
  const corners = [
    { x: 0, y: height },
    { x: width, y: height },
    { x: width, y: 0 },
    { x: 0, y: 0 },
  ];

  const points = [];
  for (let i = 0; i < 4; i++) {
    const pt = pickScreenOrHorizon(scene, ellipsoid, corners[i].x, corners[i].y, cx, cy);
    if (pt) {
      const prev = points[points.length - 1];
      if (!prev || Cesium.Cartesian3.distance(pt, prev) > 1.0) {
        points.push(pt);
      }
    }
  }

  if (points.length >= 3) {
    activePositions = points;
    closedPositions = points.concat(points[0]);
  } else {
    activePositions = [];
    closedPositions = [];
  }
}

/**
 * 相机视角同步与范围框更新核心循环（每帧 preRender 触发）
 */
function syncViewer() {
  if (!viewer || !viewerEagle || !viewer.camera || !viewerEagle.camera) return;

  // 1. 获取主视图相机的地理坐标（经度、纬度、离地高度）
  const carto = viewer.camera.positionCartographic;
  if (!carto) return;

  const lon = Cesium.Math.toDegrees(carto.longitude);
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const mainHeight = carto.height;

  // 2. 鹰眼高度计算与动态 Clamp 限制
  const targetHeight = Cesium.Math.clamp(
    mainHeight * params.scaleRatio,
    params.minHeight,
    params.maxHeight
  );

  // 3. 鹰眼视图保持正俯视平面视角（Pitch: -90°），跟随主相机 Heading 旋转实现航向同步
  viewerEagle.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, targetHeight),
    orientation: {
      heading: viewer.camera.heading,
      pitch: Cesium.Math.toRadians(-90), // 正俯视纯平面小地图
      roll: 0,
    },
  });

  // 4. 更新主视口相机的平面视域边界
  updateCameraExtent();
}

/**
 * 为 Viewer 设置天地图底图（影像或矢量，并自动附带中文注记）
 */
function applyTiandituLayers(targetViewer, type = "img") {
  if (!targetViewer || !targetViewer.scene) return;
  const layers = targetViewer.scene.imageryLayers;
  layers.removeAll();

  // 根据类型成对添加底图与注记
  const [baseLayer, labelLayer] = tdt.createLayerGroup(type);
  layers.add(baseLayer);
  layers.add(labelLayer);
}

/**
 * 切换主视图与鹰眼的底图类型
 */
function switchMapType(typeKey) {
  params.mapType = typeKey;
  const typeCode = typeKey.includes("矢量") ? "vec" : "img";
  applyTiandituLayers(viewer, typeCode);
  applyTiandituLayers(viewerEagle, typeCode);
}

function init() {
  if (!mainViewerRef.value || !eagleEyeViewerRef.value) return;

  // 共享统一的时钟对象
  const sharedClock = new Cesium.ClockViewModel();

  // 1. 创建主场景 Viewer（初始关闭默认底图，由天地图统一托管）
  viewer = createViewer(mainViewerRef.value, {
    clockViewModel: sharedClock,
    baseLayer: false,
  });
  optimizeViewerQuality(viewer);

  // 2. 创建鹰眼小地图 Viewer（隐藏所有多余原生控件）
  viewerEagle = createViewer(eagleEyeViewerRef.value, {
    clockViewModel: sharedClock,
    baseLayer: false,
    baseLayerPicker: false,
    timeline: false,
    animation: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    infoBox: false,
    selectionIndicator: false,
  });
  optimizeViewerQuality(viewerEagle);

  // 3. 应用天地图高清底图
  switchMapType(params.mapType);

  // 3. 禁用鹰眼视图中的全部鼠标交互（保持纯预览导航状态）
  const controller = viewerEagle.scene.screenSpaceCameraController;
  controller.enableRotate = false;
  controller.enableTranslate = false;
  controller.enableZoom = false;
  controller.enableTilt = false;
  controller.enableLook = false;

  // 4. 在鹰眼中添加主视口当前视域边界实体（使用 CallbackProperty 动态响应，无需反复重建实体）
  extentEntity = viewerEagle.entities.add({
    name: "主视图视域范围",
    show: new Cesium.CallbackProperty(
      () => params.showExtent && activePositions.length >= 3,
      false
    ),
    polyline: {
      positions: new Cesium.CallbackProperty(() => closedPositions, false),
      width: params.extentWidth,
      material: Cesium.Color.fromCssColorString(params.extentColor),
      arcType: Cesium.ArcType.NONE, // 纯直线段连接，无任何多余剖分开销
      clampToGround: false,
    },
  });

  // 5. 监听主场景 preRender 事件，达到丝滑高帧率同步
  removePreRenderListener = viewer.scene.preRender.addEventListener(syncViewer);

  // 6. 默认定位至中国区域（宏观概览视角）
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(108.0, 34.0, 9500000.0),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
  });

  // 7. 配置 lil-gui 控制面板
  setupGUI();
}

function setupGUI() {
  gui = createGUI({
    container: mainViewerRef.value,
    title: "鹰眼联动配置 (Eagle Eye)",
    width: 290,
    position: "top-left",
  });

  const mapFolder = gui.addFolder("底图设置");
  mapFolder
    .add(params, "mapType", ["天地图影像", "天地图矢量"])
    .name("天地图类型")
    .onChange((val) => {
      switchMapType(val);
    });

  const syncFolder = gui.addFolder("联动参数");
  syncFolder
    .add(params, "scaleRatio", 1.5, 10.0, 0.5)
    .name("高空比例系数");

  const extentFolder = gui.addFolder("视域线框外观");
  extentFolder
    .add(params, "showExtent")
    .name("显示视域线框");
  extentFolder
    .addColor(params, "extentColor")
    .name("线框颜色")
    .onChange((val) => {
      if (extentEntity?.polyline) {
        extentEntity.polyline.material = Cesium.Color.fromCssColorString(val);
      }
    });
  extentFolder
    .add(params, "extentWidth", 1, 8, 0.5)
    .name("线框宽度")
    .onChange((val) => {
      if (extentEntity?.polyline) {
        extentEntity.polyline.width = val;
      }
    });

  const quickFolder = gui.addFolder("快捷定位");
  const quickActions = {
    beijing: () => {
      viewer?.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.3974, 39.9093, 12000.0),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-45),
          roll: 0,
        },
      });
    },
    shanghai: () => {
      viewer?.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(121.4737, 31.2304, 15000.0),
        orientation: {
          heading: Cesium.Math.toRadians(45),
          pitch: Cesium.Math.toRadians(-35),
          roll: 0,
        },
      });
    },
    global: () => {
      viewer?.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(105.0, 35.0, 15000000.0),
      });
    },
  };
  quickFolder.add(quickActions, "beijing").name("▶ 北京市区 (倾斜视口)");
  quickFolder.add(quickActions, "shanghai").name("▶ 上海市区 (大倾角)");
  quickFolder.add(quickActions, "global").name("▶ 全球远景视角");
}

onBeforeUnmount(() => {
  if (removePreRenderListener) {
    removePreRenderListener();
    removePreRenderListener = null;
  }
  if (gui) {
    gui.destroy();
    gui = null;
  }
  if (viewerEagle) {
    if (extentEntity) {
      viewerEagle.entities.remove(extentEntity);
      extentEntity = null;
    }
    viewerEagle.destroy();
    viewerEagle = null;
  }
  if (viewer) {
    viewer.destroy();
    viewer = null;
  }
});
</script>

<style scoped>
.eagle-eye-page {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.main-viewer {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
}

/* 鹰眼悬浮小窗现代卡片质感 */
.eagle-eye-window {
  position: absolute;
  right: 16px;
  bottom: 24px;
  width: 280px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 50;
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.eagle-eye-window.collapsed {
  width: 180px;
}

.eagle-eye-header {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: rgba(0, 0, 0, 0.45);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pulse-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.eagle-eye-header .title {
  font-size: 12px;
  font-weight: 600;
  color: #f1f5f9;
  user-select: none;
  letter-spacing: 0.3px;
}

.action-btn {
  font-size: 13px;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
  user-select: none;
}
.action-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.15);
}

.eagle-eye-body {
  height: 200px;
  position: relative;
  width: 100%;
}

.eagle-eye-viewer {
  width: 100%;
  height: 100%;
}

/* 中心准星指示器 */
.crosshair-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 14px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 10;
}
.crosshair-indicator::before,
.crosshair-indicator::after {
  content: "";
  position: absolute;
  background: rgba(255, 255, 255, 0.75);
}
.crosshair-indicator::before {
  top: 6px;
  left: 0;
  width: 14px;
  height: 2px;
}
.crosshair-indicator::after {
  top: 0;
  left: 6px;
  width: 2px;
  height: 14px;
}
</style>

