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
      <!-- 材质对比与工况交互 HUD 面板 -->
      <div class="legend-card">
        <div class="legend-header">
          <span class="legend-title">Cesium 常用材质与工业告警</span>
          <span class="type-badge" :class="alarmBadgeClass">{{ currentModeText }}</span>
        </div>

        <div class="legend-body">
          <!-- 工业园区管线工况模拟专区 (重点业务场景) -->
          <div class="pipe-alarm-box" :class="pipelineStatus">
            <div class="alarm-title-row">
              <span class="alarm-icon">⚠️</span>
              <span class="alarm-headline">化工园区 #02 液氨输送管监测</span>
            </div>
            <div class="alarm-metrics">
              <div class="metric-item">
                <span class="lbl">管内压力:</span>
                <span class="val" :class="pipelineStatus">{{ currentPressure }} MPa</span>
              </div>
              <div class="metric-item">
                <span class="lbl">运行工况:</span>
                <span class="val" :class="pipelineStatus">{{ statusLabel }}</span>
              </div>
            </div>
            <div class="alarm-action-buttons">
              <button
                v-for="st in pipeStatuses"
                :key="st.key"
                class="status-btn"
                :class="[{ active: pipelineStatus === st.key }, st.key]"
                @click="switchPipeStatus(st.key)"
              >
                {{ st.label }}
              </button>
            </div>
          </div>

          <div class="group-title" style="margin-top: 14px;">面状几何材质 (Surface Material)</div>
          <div class="chips-row">
            <span
              v-for="item in surfaceTypes"
              :key="item.key"
              class="chip-btn"
              :class="{ active: currentSurfaceType === item.key }"
              @click="switchSurfaceMaterial(item.key)"
            >
              {{ item.label }}
            </span>
          </div>

          <div class="group-title" style="margin-top: 10px;">线状几何材质 (Polyline Material)</div>
          <div class="chips-row">
            <span
              v-for="item in polylineTypes"
              :key="item.key"
              class="chip-btn line-chip"
              :class="{ active: currentPolylineType === item.key }"
              @click="switchPolylineMaterial(item.key)"
            >
              {{ item.label }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </demo-box>
</template>

<script setup name="MaterialGallery">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import Cesium from "cesium";
import { createViewer, optimizeViewerQuality } from "@/utils/cesium";
import { createGUI } from "@/utils/gui";
import logoPng from "@/assets/logo/logo.png";

const containerRef = ref(null);

let viewer = null;
let gui = null;
let ellipseEntity = null;
let polylineEntity = null;
let wallEntity = null;
let alarmPipeEntity = null;
let normalPipeEntity = null;
let leakPinEntity = null;

// 工业管线工况状态
const pipelineStatus = ref("danger"); // normal | warning | danger | isolated
const currentSurfaceType = ref("image");
const currentPolylineType = ref("glow");

const pipeStatuses = [
  { key: "normal", label: "正常输送", pressure: "2.40" },
  { key: "warning", label: "超压预警", pressure: "3.85" },
  { key: "danger", label: "泄漏报警 (呼吸闪烁)", pressure: "0.28" },
  { key: "isolated", label: "紧急切断", pressure: "0.00" },
];

const statusLabel = computed(() => {
  const item = pipeStatuses.find((x) => x.key === pipelineStatus.value);
  return item?.label || "监控中";
});

const currentPressure = computed(() => {
  const item = pipeStatuses.find((x) => x.key === pipelineStatus.value);
  return item?.pressure || "0.00";
});

const alarmBadgeClass = computed(() => {
  if (pipelineStatus.value === "danger") return "badge-danger";
  if (pipelineStatus.value === "warning") return "badge-warning";
  if (pipelineStatus.value === "isolated") return "badge-isolated";
  return "badge-normal";
});

const currentModeText = computed(() => {
  if (pipelineStatus.value === "danger") return "🚨 发生危化品泄漏故障!";
  if (pipelineStatus.value === "warning") return "⚠️ 管道超压异常预警";
  if (pipelineStatus.value === "isolated") return "⛔ 截断阀已切断隔离";
  return "安全平稳运行中";
});

const surfaceTypes = [
  { key: "color", label: "纯色 / 半透明" },
  { key: "image", label: "图片纹理 / 重复" },
  { key: "checkerboard", label: "黑白棋盘格" },
  { key: "stripe", label: "条纹走马灯" },
  { key: "grid", label: "经纬线框网格" },
];

const polylineTypes = [
  { key: "color", label: "普通单色" },
  { key: "glow", label: "发光光晕线" },
  { key: "outline", label: "带描边线" },
  { key: "dash", label: "虚线间隔" },
  { key: "arrow", label: "末端箭头" },
];

// 控制面板统一状态
const params = {
  // 1. 面材质参数
  surfaceType: "image",
  color: "#3b82f6",
  colorAlpha: 0.85,
  imageRepeatX: 4,
  imageRepeatY: 4,
  checkerEvenColor: "#ffffff",
  checkerOddColor: "#0f172a",
  checkerRepeatX: 6,
  checkerRepeatY: 6,
  stripeOrientation: "垂直",
  stripeEvenColor: "#ffffff",
  stripeOddColor: "#1e293b",
  stripeRepeat: 16,
  stripeOffset: 0.0,
  stripeSpeed: 0.5,
  gridColor: "#facc15",
  gridCellAlpha: 0.15,
  gridLineCountX: 8,
  gridLineCountY: 8,
  gridThicknessX: 2.0,
  gridThicknessY: 2.0,

  // 2. 线材质参数
  polylineType: "glow",
  lineWidth: 8.0,
  polyColor: "#06b6d4",
  glowPower: 0.35,
  taperPower: 0.8,
  outlineColor: "#ef4444",
  outlineBorderColor: "#000000",
  outlineBorderWidth: 3.0,
  dashLength: 24.0,
  dashPattern: 255,
  dashGapColor: "#334155",

  // 3. 工业危化管线告警参数
  pipeStatus: "danger",
  dangerBlinkFreq: 5.0, // 泄漏报警剧烈闪烁频率
  warningBlinkFreq: 2.0, // 超压呼吸中速频率
  pipeRadius: 500.0, // 管道粗细 (米)
  showNormalPipe: true,
};

let tickTime = 0;

onMounted(() => {
  init();
});

function init() {
  if (!containerRef.value) return;

  // 1. 初始化 Viewer（无需天地图，直接使用内置基础球体，速度最快）
  viewer = createViewer(containerRef.value, {
    baseLayerPicker: false,
    timeline: false,
    animation: false,
  });
  optimizeViewerQuality(viewer);

  // 2. 构建实体场景（面、线、立面墙、工业正常管线、重点告警管线、泄漏标记）
  setupEntities();

  // 3. 定位到直观的立体观察视角
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(116.3912, 39.73, 56000.0),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-50),
      roll: 0,
    },
  });

  // 4. 接入帧循环回调
  viewer.clock.onTick.addEventListener(handleTick);

  // 5. 初始化参数控制面板
  setupGUI();
}

/**
 * 管道截面圆生成函数
 */
function computeCircle(radius, points = 32) {
  const positions = [];
  for (let i = 0; i < points; i++) {
    const rad = (i / points) * Cesium.Math.TWO_PI;
    positions.push(
      new Cesium.Cartesian2(radius * Math.cos(rad), radius * Math.sin(rad))
    );
  }
  return positions;
}

/**
 * 帧循环时间累计
 */
function handleTick() {
  tickTime += 0.016;
  if (params.stripeSpeed > 0) {
    params.stripeOffset = (tickTime * 0.5 * params.stripeSpeed) % 1.0;
  }
}

/**
 * 核心：工业管线工况动态材质生成器
 * 利用 CallbackProperty 实现平滑呼吸、高频警报脉冲与条纹隔离
 */
function createIndustrialPipeMaterial() {
  return new Cesium.ColorMaterialProperty(
    new Cesium.CallbackProperty(() => {
      const mode = pipelineStatus.value;

      // 1. 危险/泄漏报警状态：高频剧烈红黑/红亮呼吸闪烁 (实战报警核心)
      if (mode === "danger") {
        const pulse = 0.5 + 0.5 * Math.sin(tickTime * params.dangerBlinkFreq * Math.PI);
        // 在刺目纯红与暗红之间快速爆闪呼吸
        const red = 1.0;
        const green = 0.15 * pulse;
        const blue = 0.15 * pulse;
        const alpha = 0.4 + 0.6 * pulse;
        return new Cesium.Color(red, green, blue, alpha);
      }

      // 2. 超压预警状态：黄色中频呼吸脉冲 (0.5s 周期)
      if (mode === "warning") {
        const pulse = 0.5 + 0.5 * Math.sin(tickTime * params.warningBlinkFreq * Math.PI);
        return new Cesium.Color(1.0, 0.75 + 0.25 * pulse, 0.05, 0.5 + 0.5 * pulse);
      }

      // 3. 紧急隔离切断状态：灰色停机色
      if (mode === "isolated") {
        return Cesium.Color.fromCssColorString("#64748b").withAlpha(0.7);
      }

      // 4. 正常工况：安全青绿健康色
      return Cesium.Color.fromCssColorString("#10b981").withAlpha(0.9);
    }, false)
  );
}

/**
 * 初始化场景实体
 */
function setupEntities() {
  // 1. 椭圆几何（展示面材质）
  ellipseEntity = viewer.entities.add({
    name: "厂区面几何 (椭圆)",
    position: Cesium.Cartesian3.fromDegrees(116.3912, 39.905),
    ellipse: {
      semiMinorAxis: 7500.0,
      semiMajorAxis: 12000.0,
      material: createSurfaceMaterial(params.surfaceType),
    },
  });

  // 2. 空间折线（展示线材质）
  const linePoints = [
    [116.18, 39.72],
    [116.32, 39.77],
    [116.45, 39.81],
    [116.60, 39.78],
  ];
  polylineEntity = viewer.entities.add({
    name: "工业线缆 (折线)",
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArray(linePoints.flat()),
      width: params.lineWidth,
      material: createPolylineMaterial(params.polylineType),
      clampToGround: true,
    },
  });

  // 3. 立面围墙（展示立面贴图）
  const wallPoints = [
    [116.22, 40.06],
    [116.35, 40.09],
    [116.46, 40.07],
    [116.58, 40.03],
  ];
  wallEntity = viewer.entities.add({
    name: "厂区边界立面墙 (Wall)",
    wall: {
      positions: Cesium.Cartesian3.fromDegreesArray(wallPoints.flat()),
      minimumHeights: [0, 0, 0, 0],
      maximumHeights: [4000, 4000, 4000, 4000],
      material: createSurfaceMaterial(params.surfaceType),
    },
  });

  // 4. 正常运行的辅助输送管道（对比参照物）
  const normalPipeCoords = [
    116.16, 39.84, 2500.0,
    116.26, 39.94, 4000.0,
    116.46, 39.94, 4000.0,
    116.56, 39.84, 2500.0,
  ];
  normalPipeEntity = viewer.entities.add({
    name: "#01 蒸汽回流管道 (稳态运行)",
    show: params.showNormalPipe,
    polylineVolume: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(normalPipeCoords),
      shape: computeCircle(350.0),
      cornerType: Cesium.CornerType.ROUNDED,
      material: new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.7)
      ),
    },
  });

  // 5. 重点监控的危化管线（故障告警/泄漏脉冲管）
  const alarmPipeCoords = [
    116.18, 39.88, 3200.0,
    116.28, 39.98, 5200.0, // 弯管突发泄漏点
    116.48, 39.98, 5200.0,
    116.58, 39.88, 3200.0,
  ];
  alarmPipeEntity = viewer.entities.add({
    name: "#02 液氨高压输送管 (重点监控)",
    polylineVolume: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(alarmPipeCoords),
      shape: new Cesium.CallbackProperty(
        () => computeCircle(params.pipeRadius),
        false
      ),
      cornerType: Cesium.CornerType.ROUNDED,
      material: createIndustrialPipeMaterial(),
    },
  });

  // 6. 泄漏点三维提示实体（在第二拐弯节点处）
  leakPinEntity = viewer.entities.add({
    name: "泄漏点三维定位",
    position: Cesium.Cartesian3.fromDegrees(116.28, 39.98, 5800.0),
    point: {
      pixelSize: 18,
      color: new Cesium.CallbackProperty(() => {
        if (pipelineStatus.value === "danger") {
          return (Math.floor(tickTime * 8) % 2 === 0)
            ? Cesium.Color.RED
            : Cesium.Color.YELLOW;
        }
        return Cesium.Color.TRANSPARENT;
      }, false),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: new Cesium.CallbackProperty(() => {
        if (pipelineStatus.value === "danger") return "⚠ #02弯管法兰微裂泄漏";
        if (pipelineStatus.value === "warning") return "⚠ #02管道压力超限";
        if (pipelineStatus.value === "isolated") return "✓ 阀门已关断";
        return "✓ 状态正常";
      }, false),
      font: "bold 14px sans-serif",
      fillColor: Cesium.Color.WHITE,
      backgroundColor: new Cesium.CallbackProperty(() => {
        if (pipelineStatus.value === "danger") return Cesium.Color.RED.withAlpha(0.85);
        if (pipelineStatus.value === "warning") return Cesium.Color.ORANGE.withAlpha(0.85);
        if (pipelineStatus.value === "isolated") return Cesium.Color.DARKSLATEGRAY.withAlpha(0.85);
        return Cesium.Color.DARKGREEN.withAlpha(0.75);
      }, false),
      showBackground: true,
      backgroundPadding: new Cesium.Cartesian2(8, 5),
      pixelOffset: new Cesium.Cartesian2(0, -28),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000),
    },
  });
}

/**
 * 切换管道工况
 */
function switchPipeStatus(statusKey) {
  pipelineStatus.value = statusKey;
  params.pipeStatus = statusKey;
}

/**
 * 根据所选类型动态构建面材质
 */
function createSurfaceMaterial(type) {
  switch (type) {
    case "color":
      return Cesium.Color.fromCssColorString(params.color).withAlpha(
        params.colorAlpha
      );

    case "image":
      return new Cesium.ImageMaterialProperty({
        image: logoPng,
        repeat: new Cesium.Cartesian2(params.imageRepeatX, params.imageRepeatY),
        transparent: true,
      });

    case "checkerboard":
      return new Cesium.CheckerboardMaterialProperty({
        evenColor: Cesium.Color.fromCssColorString(params.checkerEvenColor),
        oddColor: Cesium.Color.fromCssColorString(params.checkerOddColor),
        repeat: new Cesium.Cartesian2(
          params.checkerRepeatX,
          params.checkerRepeatY
        ),
      });

    case "stripe":
      return new Cesium.StripeMaterialProperty({
        orientation:
          params.stripeOrientation === "垂直"
            ? Cesium.StripeOrientation.VERTICAL
            : Cesium.StripeOrientation.HORIZONTAL,
        evenColor: Cesium.Color.fromCssColorString(params.stripeEvenColor),
        oddColor: Cesium.Color.fromCssColorString(params.stripeOddColor),
        repeat: params.stripeRepeat,
        offset: new Cesium.CallbackProperty(() => params.stripeOffset, false),
      });

    case "grid":
      return new Cesium.GridMaterialProperty({
        color: Cesium.Color.fromCssColorString(params.gridColor),
        cellAlpha: params.gridCellAlpha,
        lineCount: new Cesium.Cartesian2(
          params.gridLineCountX,
          params.gridLineCountY
        ),
        lineThickness: new Cesium.Cartesian2(
          params.gridThicknessX,
          params.gridThicknessY
        ),
      });

    default:
      return Cesium.Color.BLUE;
  }
}

/**
 * 根据所选类型动态构建线材质
 */
function createPolylineMaterial(type) {
  switch (type) {
    case "color":
      return Cesium.Color.fromCssColorString(params.polyColor);

    case "glow":
      return new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.fromCssColorString(params.polyColor),
        glowPower: params.glowPower,
        taperPower: params.taperPower,
      });

    case "outline":
      return new Cesium.PolylineOutlineMaterialProperty({
        color: Cesium.Color.fromCssColorString(params.outlineColor),
        outlineColor: Cesium.Color.fromCssColorString(params.outlineBorderColor),
        outlineWidth: params.outlineBorderWidth,
      });

    case "dash":
      return new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.fromCssColorString(params.polyColor),
        gapColor: Cesium.Color.fromCssColorString(params.dashGapColor),
        dashLength: params.dashLength,
        dashPattern: params.dashPattern,
      });

    case "arrow":
      return new Cesium.PolylineArrowMaterialProperty(
        Cesium.Color.fromCssColorString(params.polyColor)
      );

    default:
      return Cesium.Color.CYAN;
  }
}

function switchSurfaceMaterial(key) {
  currentSurfaceType.value = key;
  params.surfaceType = key;
  const mat = createSurfaceMaterial(key);
  if (ellipseEntity?.ellipse) ellipseEntity.ellipse.material = mat;
  if (wallEntity?.wall) wallEntity.wall.material = mat;
}

function switchPolylineMaterial(key) {
  currentPolylineType.value = key;
  params.polylineType = key;
  if (polylineEntity?.polyline) {
    polylineEntity.polyline.material = createPolylineMaterial(key);
  }
}

function setupGUI() {
  gui = createGUI({
    container: containerRef.value,
    title: "园区管线仿真与材质调优",
    width: 320,
    position: "top-left",
  });

  // 1. 工业管网应急控制组 (核心实战)
  const pipeFolder = gui.addFolder("1. 工业园区管网工况 (PolylineVolume)");
  pipeFolder
    .add(params, "pipeStatus", {
      "🚨 泄漏爆闪 (Danger)": "danger",
      "⚠️ 超压预警 (Warning)": "warning",
      "✅ 正常输送 (Normal)": "normal",
      "⛔ 紧急切断 (Isolated)": "isolated",
    })
    .name("管网运行工况")
    .onChange((val) => {
      switchPipeStatus(val);
    });

  pipeFolder
    .add(params, "dangerBlinkFreq", 1.0, 10.0, 0.5)
    .name("泄漏爆闪频率 (Hz)");

  pipeFolder
    .add(params, "warningBlinkFreq", 0.5, 4.0, 0.5)
    .name("预警呼吸频率 (Hz)");

  pipeFolder
    .add(params, "pipeRadius", 200.0, 1200.0, 50.0)
    .name("管道口径半径 (米)");

  pipeFolder
    .add(params, "showNormalPipe")
    .name("显示辅管线")
    .onChange((val) => {
      if (normalPipeEntity) normalPipeEntity.show = val;
    });

  // 2. 视角交互辅助
  const viewFolder = gui.addFolder("2. 场景视角控制");
  const actions = {
    focusAlarmPipe: () => {
      if (alarmPipeEntity) {
        viewer?.flyTo(alarmPipeEntity, {
          offset: new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(35),
            Cesium.Math.toRadians(-32),
            16000
          ),
        });
      }
    },
    resetGlobalView: () => {
      viewer?.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.3912, 39.73, 56000.0),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-50),
          roll: 0,
        },
      });
    },
  };
  viewFolder.add(actions, "focusAlarmPipe").name("🚨 快速聚焦泄漏管段");
  viewFolder.add(actions, "resetGlobalView").name("▶ 重置全局俯瞰视角");

  // 3. 常规面材质与线材质
  const matFolder = gui.addFolder("3. 基础材质调谐 (MaterialProperty)");
  matFolder
    .add(params, "surfaceType", {
      "贴图 (Image)": "image",
      "条纹流动 (Stripe)": "stripe",
      "棋盘格 (Checkerboard)": "checkerboard",
      "线框网格 (Grid)": "grid",
      "纯色 (Color)": "color",
    })
    .name("面材质类型")
    .onChange((val) => switchSurfaceMaterial(val));

  matFolder
    .add(params, "polylineType", {
      "发光光晕 (Glow)": "glow",
      "描边线条 (Outline)": "outline",
      "虚线间隔 (Dash)": "dash",
      "末端箭头 (Arrow)": "arrow",
    })
    .name("线材质类型")
    .onChange((val) => switchPolylineMaterial(val));
}

onBeforeUnmount(() => {
  if (gui) {
    gui.destroy();
    gui = null;
  }
  if (viewer && !viewer.isDestroyed()) {
    viewer.clock.onTick.removeEventListener(handleTick);
    viewer.destroy();
    viewer = null;
  }
});
</script>

<style scoped>
.cesium-page-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* 材质悬浮状态指示与快捷选择卡片 */
.legend-card {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 14px 16px;
  width: 330px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  color: #f1f5f9;
}

.legend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.legend-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #ffffff;
}

.type-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
  white-space: nowrap;
}

.badge-danger {
  background: rgba(239, 68, 68, 0.25);
  border: 1px solid #ef4444;
  color: #fca5a5;
  animation: pulse-danger 1s infinite alternate;
}

.badge-warning {
  background: rgba(245, 158, 11, 0.25);
  border: 1px solid #f59e0b;
  color: #fde68a;
}

.badge-normal {
  background: rgba(16, 185, 129, 0.25);
  border: 1px solid #10b981;
  color: #6ee7b7;
}

.badge-isolated {
  background: rgba(100, 116, 139, 0.25);
  border: 1px solid #64748b;
  color: #cbd5e1;
}

@keyframes pulse-danger {
  0% { box-shadow: 0 0 4px rgba(239, 68, 68, 0.4); }
  100% { box-shadow: 0 0 12px rgba(239, 68, 68, 0.9); }
}

/* 工业管网应急监控区块 */
.pipe-alarm-box {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
  transition: all 0.3s ease;
}

.pipe-alarm-box.danger {
  border-color: rgba(239, 68, 68, 0.7);
  background: rgba(69, 10, 10, 0.5);
}

.pipe-alarm-box.warning {
  border-color: rgba(245, 158, 11, 0.7);
  background: rgba(69, 40, 10, 0.5);
}

.alarm-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 6px;
}

.alarm-metrics {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  margin-bottom: 8px;
  padding: 4px 6px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 4px;
}

.metric-item .lbl {
  color: #94a3b8;
  margin-right: 4px;
}

.metric-item .val {
  font-weight: 700;
}

.metric-item .val.danger {
  color: #ef4444;
}

.metric-item .val.warning {
  color: #f59e0b;
}

.metric-item .val.normal {
  color: #10b981;
}

.alarm-action-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.status-btn {
  font-size: 11px;
  padding: 5px 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.2s ease;
}

.status-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.status-btn.active.normal {
  background: #059669;
  border-color: #10b981;
  color: #ffffff;
  font-weight: 600;
}

.status-btn.active.warning {
  background: #d97706;
  border-color: #f59e0b;
  color: #ffffff;
  font-weight: 600;
}

.status-btn.active.danger {
  background: #dc2626;
  border-color: #ef4444;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 0 10px rgba(220, 38, 38, 0.6);
}

.status-btn.active.isolated {
  background: #475569;
  border-color: #64748b;
  color: #ffffff;
}

.group-title {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 6px;
}

.chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.chip-btn {
  font-size: 11px;
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.chip-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.chip-btn.active {
  background: #2563eb;
  border-color: #3b82f6;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 0 8px rgba(37, 99, 235, 0.5);
}

.chip-btn.line-chip.active {
  background: #0891b2;
  border-color: #06b6d4;
  box-shadow: 0 0 8px rgba(8, 145, 178, 0.5);
}
</style>
