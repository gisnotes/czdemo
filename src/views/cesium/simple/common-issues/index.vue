<template>
  <demo-box
    :extra-files="[
      './Tianditu.js',
      {
        file: '@/utils/cesium.js',
        pick: ['createViewer', 'optimizeViewerQuality', 'DEFAULT_VIEWER_OPTIONS'],
      },
    ]"
  >
    <div ref="containerRef" class="cesium-page-container"></div>
  </demo-box>
</template>

<script setup name="CommonIssues">
import { useTemplateRef, onMounted, onBeforeUnmount } from "vue";
import Cesium from "cesium";
import { createViewer, optimizeViewerQuality } from "@/utils/cesium";
import { createGUI } from "@/utils/gui";
import Tianditu from "./Tianditu.js";
import worldImageUrl from "@/assets/images/worldimage.jpg";

const containerRef = useTemplateRef("containerRef");
let viewer = null;
let gui = null;
let demoDataSource = null;
let sampleBuildingEntity = null;
let selectionChangedListener = null;

// 底图图层缓存（普通对象存储）：按需惰性加载，通过 layer.show 控制显隐，兼顾极致性能与代码简明
const baseLayersCache = {};

// 控制台状态参数（对应常见问题 1 ~ 10 项）
const params = {
  // 1. 去掉下面的logo
  hideLogo: true,

  // 2. 显示帧率 (FPS)
  showFps: true,

  // 3. 关闭/开启大气层显示
  showAtmosphere: true,

  // 4 & 5. 底图服务切换
  baseLayer: "天地图影像 (WMTS)",
  tdtToken: "11c161d1558ad38a25a080da1ab26784",

  // 6. 控制图层显隐
  showDataLayer: true,

  // 8. 控制视角不转到地下（深度检测 + 碰撞检测）
  depthTestAgainstTerrain: true,
  enableCollisionDetection: true,

  // 9. 禁止 entity 选中
  allowEntitySelect: false,

  // 10. 调整阴影明暗
  enableShadows: true,
  shadowDarkness: 0.8,
};

onMounted(() => {
  init();
});

async function init() {
  if (!containerRef.value) return;

  // 设置默认视图范围为中国范围
  Cesium.Camera.DEFAULT_VIEW_RECTANGLE = Cesium.Rectangle.fromDegrees(
    73.66,
    3.86,
    135.05,
    53.55
  );

  // 1. 初始化 Cesium.Viewer 并启用选择指示器以供功能演示
  viewer = createViewer(containerRef.value, {
    baseLayer: false, // 禁用默认底图，由 switchBaseLayer 统一管理
    selectionIndicator: true,
    infoBox: true,
  });
  optimizeViewerQuality(viewer);

  // 取消默认的双击事件（避免双击追踪物体导致相机晃动）
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
    Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );

  // 2. 初始配置常见功能属性
  // (1) 底部版权与 Logo
  updateLogoVisibility();

  // (2) 帧率显示
  viewer.scene.debugShowFramesPerSecond = params.showFps;

  // (3) 大气层显示
  viewer.scene.skyAtmosphere.show = params.showAtmosphere;

  // (4 & 5) 默认加载天地图服务（通过 Tianditu 服务类）
  await switchBaseLayer(params.baseLayer);

  // (8) 视角防穿透地下设置
  viewer.scene.globe.depthTestAgainstTerrain = params.depthTestAgainstTerrain;
  viewer.scene.screenSpaceCameraController.enableCollisionDetection =
    params.enableCollisionDetection;

  // (10) 开启太阳光照与阴影渲染
  setupLightingAndShadows();

  // (6, 9, 10) 初始化包含 3D 建筑与标牌点位的示例数据源
  await initDemoDataSource();

  // (9) 设置 Entity 选中状态监听与指示器拦截
  setupEntitySelectionControl();

  // 初始将相机飞往示例场景位置
  flyToCustomHome(0);

  // 3. 构建可视化 lil-gui 操作面板
  setupGUI();
}

/**
 * 1. 隐藏 / 显示底部版权 Logo 信息
 */
function updateLogoVisibility() {
  if (!viewer) return;
  const displayVal = params.hideLogo ? "none" : "block";

  if (viewer.cesiumWidget?.creditContainer) {
    viewer.cesiumWidget.creditContainer.style.setProperty(
      "display",
      displayVal,
      "important"
    );
  }
  if (viewer.bottomContainer) {
    viewer.bottomContainer.style.setProperty(
      "display",
      displayVal,
      "important"
    );
  }
}

/**
 * 4 & 5. 切换底图服务（惰性加载 + layer.show 显隐控制，无重复网络请求与显存销毁）
 */
async function switchBaseLayer(type) {
  if (!viewer) return;

  // 1. 若当前底图首次使用，则按需工厂化创建并插入到底层
  if (!baseLayersCache[type]) {
    baseLayersCache[type] = await createBaseLayers(type);
  }

  // 2. 仅控制 show 属性，实现 0ms 零白屏极速切换
  Object.keys(baseLayersCache).forEach((key) => {
    const isCurrent = key === type;
    baseLayersCache[key].forEach((layer) => {
      if (layer) layer.show = isCurrent;
    });
  });
}

/**
 * 按类型工厂化创建底图图层数组（始终保持在最底层）
 */
async function createBaseLayers(type) {
  const tdt = new Tianditu(params.tdtToken);

  if (type === "天地图影像 (WMTS)") {
    const [imgLayer, ciaLayer] = tdt.createLayerGroup("img");
    viewer.imageryLayers.add(imgLayer, 0);
    viewer.imageryLayers.add(ciaLayer, 1);
    return [imgLayer, ciaLayer];
  }

  if (type === "天地图矢量 (WMTS)") {
    const [vecLayer, cvaLayer] = tdt.createLayerGroup("vec");
    viewer.imageryLayers.add(vecLayer, 0);
    viewer.imageryLayers.add(cvaLayer, 1);
    return [vecLayer, cvaLayer];
  }

  if (type === "本地单图 (SingleTile)") {
    const layer = await Cesium.ImageryLayer.fromProviderAsync(
      Cesium.SingleTileImageryProvider.fromUrl(worldImageUrl)
    );
    viewer.imageryLayers.add(layer, 0);
    return [layer];
  }

  if (type === "本地TMS瓦片 (NaturalEarthII)") {
    const tmsUrl = Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII");
    const layer = await Cesium.ImageryLayer.fromProviderAsync(
      Cesium.TileMapServiceImageryProvider.fromUrl(tmsUrl)
    );
    viewer.imageryLayers.add(layer, 0);
    return [layer];
  }

  return [];
}

/**
 * 6. 创建示例图层（DataSource），用于测试显隐、选中及阴影
 */
async function initDemoDataSource() {
  demoDataSource = new Cesium.CustomDataSource("facilitiesDataSource");

  // 添加三维实体建筑（支持投射并接收阴影）
  sampleBuildingEntity = demoDataSource.entities.add({
    name: "示范设施三维实体",
    position: Cesium.Cartesian3.fromDegrees(116.3912, 39.9073, 100.0),
    box: {
      dimensions: new Cesium.Cartesian3(160.0, 160.0, 200.0),
      material: Cesium.Color.fromCssColorString("#ff7043").withAlpha(0.92),
      shadows: Cesium.ShadowMode.ENABLED,
    },
    description: `
      <div style="padding: 10px; font-size: 13px; line-height: 1.6;">
        <h4 style="margin: 0 0 8px; color: #ff7043; font-size: 15px;">北京示范三维建筑实体</h4>
        <p><b>坐标位置：</b>116.3912°E, 39.9073°N</p>
        <p><b>尺寸：</b>长 160m × 宽 160m × 高 200m</p>
        <p><b>测试重点：</b></p>
        <ul style="padding-left: 18px; margin: 4px 0;">
          <li><b>问题 9：</b>切换“允许选中 Entity”，测试点击时是否出现绿框指示器和信息窗口。</li>
          <li><b>问题 10：</b>拖动“阴影明暗”滑块，实时观察地面投射阴影深浅变化。</li>
        </ul>
      </div>
    `,
  });

  // 添加设施点位与文字标牌
  demoDataSource.entities.add({
    name: "北京示范设施点位",
    position: Cesium.Cartesian3.fromDegrees(116.395, 39.909, 30.0),
    point: {
      pixelSize: 12,
      color: Cesium.Color.fromCssColorString("#00e676"),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: "示范设施点位",
      font: "14px sans-serif",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -12),
    },
    description: "数据源包含的点位要素，可通过【控制图层显隐】一键批量隐藏或显示。",
  });

  await viewer.dataSources.add(demoDataSource);
  demoDataSource.show = params.showDataLayer;
}


/**
 * 相机飞往自定义预设视角（北京示范要素上空）
 */
function flyToCustomHome(duration = 1.5) {
  if (!viewer) return;
  const target = {
    destination: Cesium.Cartesian3.fromDegrees(116.3912, 39.9073, 2200.0),
    orientation: {
      heading: Cesium.Math.toRadians(25.0),
      pitch: Cesium.Math.toRadians(-35.0),
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
 * 9. 禁止 Entity 选中指示器与属性框
 */
function setupEntitySelectionControl() {
  if (!viewer) return;

  selectionChangedListener = (selectedEntity) => {
    if (selectedEntity && !params.allowEntitySelect) {
      // 若处于禁止选中模式，强制重置选中状态
      viewer.selectedEntity = undefined;
    }
  };

  viewer.selectedEntityChanged.addEventListener(selectionChangedListener);
  updateSelectionIndicatorDisplay();
}

function updateSelectionIndicatorDisplay() {
  if (viewer?.selectionIndicator?.viewModel) {
    const el = viewer.selectionIndicator.viewModel.selectionIndicatorElement;
    if (el) {
      el.style.display = params.allowEntitySelect ? "block" : "none";
    }
  }
}

/**
 * 10. 太阳光照与阴影渲染参数初始化
 */
function setupLightingAndShadows() {
  if (!viewer) return;

  viewer.shadows = params.enableShadows;
  viewer.terrainShadows = Cesium.ShadowMode.RECEIVE_ONLY;
  if (viewer.shadowMap) {
    viewer.shadowMap.darkness = params.shadowDarkness;
    viewer.shadowMap.size = 2048;
  }
  viewer.scene.globe.enableLighting = true;

  // 固定阳光时间为北京时间 15:00（UTC 07:00），此时太阳斜射，阴影清晰立体
  viewer.clock.currentTime = Cesium.JulianDate.fromDate(
    new Date("2026-05-15T07:00:00Z")
  );
  viewer.clock.shouldAnimate = false;
}

/**
 * 构建交互式 lil-gui 控制面板
 */
function setupGUI() {
  gui = createGUI({
    container: containerRef.value,
    title: "常见问题",
    width: 300,
    position: "top-left",
  });

  // 一、界面与控件控制 (问题 1, 2, 3)
  const uiFolder = gui.addFolder("一、界面与控件控制");
  uiFolder
    .add(params, "hideLogo")
    .name("1. 去除底部Logo")
    .onChange(() => updateLogoVisibility());

  uiFolder
    .add(params, "showFps")
    .name("2. 显示帧率 (FPS)")
    .onChange((val) => {
      viewer.scene.debugShowFramesPerSecond = val;
    });

  uiFolder
    .add(params, "showAtmosphere")
    .name("3. 显示大气层")
    .onChange((val) => {
      viewer.scene.skyAtmosphere.show = val;
    });

  // 二、底图服务与图层 (问题 4, 5, 6)
  const layerFolder = gui.addFolder("二、底图服务与图层");
  layerFolder
    .add(params, "baseLayer", {
      "天地图影像 (WMTS)": "天地图影像 (WMTS)",
      "天地图矢量 (WMTS)": "天地图矢量 (WMTS)",
      "本地单图 (SingleTile)": "本地单图 (SingleTile)",
      "本地TMS瓦片 (NaturalEarthII)": "本地TMS瓦片 (NaturalEarthII)",
    })
    .name("4/5. 底图服务选择")
    .onChange((val) => switchBaseLayer(val));

  layerFolder
    .add(params, "tdtToken")
    .name("5. 天地图 Token")
    .onFinishChange(() => {
      // Token 更新时释放旧的天地图图层缓存，以便重新根据新 Token 生成
      ["天地图影像 (WMTS)", "天地图矢量 (WMTS)"].forEach((key) => {
        if (baseLayersCache[key]) {
          baseLayersCache[key].forEach((l) => viewer.imageryLayers.remove(l, true));
          delete baseLayersCache[key];
        }
      });
      if (params.baseLayer.includes("天地图")) {
        switchBaseLayer(params.baseLayer);
      }
    });

  layerFolder
    .add(params, "showDataLayer")
    .name("6. 控制图层显隐")
    .onChange((val) => {
      if (demoDataSource) demoDataSource.show = val;
    });

  // 三、视角与交互行为 (问题 7, 8, 9)
  const actionFolder = gui.addFolder("三、交互行为与视角");

  const actionParams = {
    triggerHome: () => {
      flyToCustomHome(1.8);
    },
    selectBuilding: () => {
      if (sampleBuildingEntity) {
        viewer.selectedEntity = sampleBuildingEntity;
      }
    },
  };

  actionFolder.add(actionParams, "triggerHome").name("7. 跳转自定义Home视角");

  actionFolder
    .add(params, "depthTestAgainstTerrain")
    .name("8. 地表深度检测")
    .onChange((val) => {
      viewer.scene.globe.depthTestAgainstTerrain = val;
    });

  actionFolder
    .add(params, "enableCollisionDetection")
    .name("8. 相机防穿地检测")
    .onChange((val) => {
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = val;
    });

  actionFolder
    .add(params, "allowEntitySelect")
    .name("9. 允许选中 Entity")
    .onChange(() => updateSelectionIndicatorDisplay());

  actionFolder.add(actionParams, "selectBuilding").name("▶ 选中示例建筑实体");

  // 四、阴影与光照调节 (问题 10)
  const shadowFolder = gui.addFolder("四、阴影与光照调节");
  shadowFolder
    .add(params, "enableShadows")
    .name("10. 开启阴影")
    .onChange((val) => {
      viewer.shadows = val;
    });

  shadowFolder
    .add(params, "shadowDarkness", 0.0, 1.0, 0.05)
    .name("10. 阴影明暗")
    .onChange((val) => {
      if (viewer.shadowMap) {
        viewer.shadowMap.darkness = val;
      }
    });
}

onBeforeUnmount(() => {
  if (selectionChangedListener && viewer?.selectedEntityChanged) {
    viewer.selectedEntityChanged.removeEventListener(selectionChangedListener);
  }
  Object.keys(baseLayersCache).forEach((key) => {
    delete baseLayersCache[key];
  });
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
:deep(.cesium-performanceDisplay-defaultContainer) {
  top: 8px;
  left: auto;
  right: 8px;
  z-index: 10;
  user-select: none;
}
</style>
