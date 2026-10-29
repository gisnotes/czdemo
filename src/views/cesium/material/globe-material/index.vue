<template>
  <demo-box
    :extra-files="[
      {
        file: '@/utils/cesium.js',
        pick: ['createViewer', 'optimizeViewerQuality'],
      },
    ]"
  >
    <div ref="containerRef" class="cesium-page-container"></div>
  </demo-box>
</template>

<script setup name="GlobeMaterial">
import { useTemplateRef, onMounted, onBeforeUnmount } from "vue";
import Cesium from "cesium";
import { createViewer, optimizeViewerQuality } from "@/utils/cesium";
import { createGUI } from "@/utils/gui";

const containerRef = useTemplateRef("containerRef");
let viewer = null;
let gui = null;

// 高程极值常量（死海约 -414m，珠穆朗玛峰约 8777m）
const minHeight = -414.0;
const maxHeight = 8777.0;

// 色带渐变断点配置
const elevationRamp = [0.0, 0.045, 0.1, 0.15, 0.37, 0.54, 1.0];
const slopeRamp = [0.0, 0.29, 0.5, Math.sqrt(2) / 2, 0.87, 0.91, 1.0];
const aspectRamp = [0.0, 0.2, 0.4, 0.6, 0.8, 0.9, 1.0];

// 预设视角列表（对应官方 Sandcastle.addToolbarMenu 的 4 个地点）
const PRESET_VIEWS = {
  himalayas: {
    label: "喜马拉雅山脉 (Himalayas)",
    destination: new Cesium.Cartesian3(
      322100.7492728492,
      5917960.047024654,
      3077602.646977297
    ),
    orientation: {
      heading: 5.988151498702285,
      pitch: -1.5614542839414822,
      roll: 0,
    },
    time: "2017-09-22T04:00:00Z",
  },
  halfDome: {
    label: "半圆顶 (Half Dome)",
    destination: new Cesium.Cartesian3(
      -2495709.521843174,
      -4391600.804712465,
      3884463.7192916023
    ),
    orientation: {
      heading: 1.7183056487769202,
      pitch: -0.06460370548034144,
      roll: 0.0079181631783527,
    },
    time: "2017-09-22T18:00:00Z",
  },
  vancouver: {
    label: "温哥华 (Vancouver)",
    destination: new Cesium.Cartesian3(
      -2301222.367751603,
      -3485269.915771613,
      4812080.961755785
    ),
    orientation: {
      heading: 0.11355958593902571,
      pitch: -0.260011078090858,
      roll: 0.00039019018274721873,
    },
    time: "2017-09-22T18:00:00Z",
  },
  mountEverest: {
    label: "珠穆朗玛峰 (Mount Everest)",
    destination: new Cesium.Cartesian3(
      282157.6960889096,
      5638892.465594703,
      2978736.186473513
    ),
    orientation: {
      heading: 4.747266966349747,
      pitch: -0.2206998858596192,
      roll: 6.280340554587955,
    },
    time: "2017-09-22T04:00:00Z",
  },
};

const contourColor = Cesium.Color.RED.clone();
let contourUniforms = {};
let shadingUniforms = {};

// 面板控制参数
const viewModel = {
  location: "himalayas",
  selectedShading: "elevation",
  enableContour: false,
  contourSpacing: 150.0,
  contourWidth: 2.0,
  contourColorCss: "#ff0000",
  randomContourColor() {
    Cesium.Color.fromRandom({ alpha: 1.0 }, contourColor);
    viewModel.contourColorCss = contourColor.toCssHexString();
    if (contourUniforms) {
      contourUniforms.color = contourColor;
    }
  },
};

/**
 * 1. 创建【高程渐变 + 等高线】复合材质
 */
function getElevationContourMaterial() {
  return new Cesium.Material({
    fabric: {
      type: "ElevationColorContour",
      materials: {
        contourMaterial: {
          type: "ElevationContour",
        },
        elevationRampMaterial: {
          type: "ElevationRamp",
        },
      },
      components: {
        diffuse:
          "contourMaterial.alpha == 0.0 ? elevationRampMaterial.diffuse : contourMaterial.diffuse",
        alpha: "max(contourMaterial.alpha, elevationRampMaterial.alpha)",
      },
    },
    translucent: false,
  });
}

/**
 * 2. 创建【坡度渐变 + 等高线】复合材质
 */
function getSlopeContourMaterial() {
  return new Cesium.Material({
    fabric: {
      type: "SlopeColorContour",
      materials: {
        contourMaterial: {
          type: "ElevationContour",
        },
        slopeRampMaterial: {
          type: "SlopeRamp",
        },
      },
      components: {
        diffuse:
          "contourMaterial.alpha == 0.0 ? slopeRampMaterial.diffuse : contourMaterial.diffuse",
        alpha: "max(contourMaterial.alpha, slopeRampMaterial.alpha)",
      },
    },
    translucent: false,
  });
}

/**
 * 3. 创建【坡向渐变 + 等高线】复合材质
 */
function getAspectContourMaterial() {
  return new Cesium.Material({
    fabric: {
      type: "AspectColorContour",
      materials: {
        contourMaterial: {
          type: "ElevationContour",
        },
        aspectRampMaterial: {
          type: "AspectRamp",
        },
      },
      components: {
        diffuse:
          "contourMaterial.alpha == 0.0 ? aspectRampMaterial.diffuse : contourMaterial.diffuse",
        alpha: "max(contourMaterial.alpha, aspectRampMaterial.alpha)",
      },
    },
    translucent: false,
  });
}

/**
 * 4. 使用 Canvas 生成 100x1 的一维线性渐变色带纹理
 */
function getColorRamp(selectedShading) {
  const ramp = document.createElement("canvas");
  ramp.width = 100;
  ramp.height = 1;
  const ctx = ramp.getContext("2d");

  let values;
  if (selectedShading === "elevation") {
    values = elevationRamp;
  } else if (selectedShading === "slope") {
    values = slopeRamp;
  } else if (selectedShading === "aspect") {
    values = aspectRamp;
  }

  const grd = ctx.createLinearGradient(0, 0, 100, 0);
  grd.addColorStop(values[0], "#000000"); // 黑色
  grd.addColorStop(values[1], "#2747E0"); // 蓝色
  grd.addColorStop(values[2], "#D33B7D"); // 粉色
  grd.addColorStop(values[3], "#D33038"); // 红色
  grd.addColorStop(values[4], "#FF9742"); // 橙色
  grd.addColorStop(values[5], "#ffd700"); // 黄色
  grd.addColorStop(values[6], "#ffffff"); // 白色

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 100, 1);

  return ramp;
}

/**
 * 5. 根据当前配置更新地球表面材质
 */
function updateMaterial() {
  if (!viewer) return;
  const hasContour = viewModel.enableContour;
  const selectedShading = viewModel.selectedShading;
  const globe = viewer.scene.globe;
  let material;

  if (hasContour) {
    if (selectedShading === "elevation") {
      material = getElevationContourMaterial();
      shadingUniforms = material.materials.elevationRampMaterial.uniforms;
      shadingUniforms.minimumHeight = minHeight;
      shadingUniforms.maximumHeight = maxHeight;
      contourUniforms = material.materials.contourMaterial.uniforms;
    } else if (selectedShading === "slope") {
      material = getSlopeContourMaterial();
      shadingUniforms = material.materials.slopeRampMaterial.uniforms;
      contourUniforms = material.materials.contourMaterial.uniforms;
    } else if (selectedShading === "aspect") {
      material = getAspectContourMaterial();
      shadingUniforms = material.materials.aspectRampMaterial.uniforms;
      contourUniforms = material.materials.contourMaterial.uniforms;
    } else {
      material = Cesium.Material.fromType("ElevationContour");
      contourUniforms = material.uniforms;
    }
    contourUniforms.width = viewModel.contourWidth;
    contourUniforms.spacing = viewModel.contourSpacing;
    contourUniforms.color = contourColor;
  } else if (selectedShading === "elevation") {
    material = Cesium.Material.fromType("ElevationRamp");
    shadingUniforms = material.uniforms;
    shadingUniforms.minimumHeight = minHeight;
    shadingUniforms.maximumHeight = maxHeight;
  } else if (selectedShading === "slope") {
    material = Cesium.Material.fromType("SlopeRamp");
    shadingUniforms = material.uniforms;
  } else if (selectedShading === "aspect") {
    material = Cesium.Material.fromType("AspectRamp");
    shadingUniforms = material.uniforms;
  }

  if (selectedShading !== "none") {
    shadingUniforms.image = getColorRamp(selectedShading);
  }

  globe.material = material;
}

/**
 * 6. 切换相机视角与光照时间
 */
function flyToPreset(key) {
  if (!viewer || !PRESET_VIEWS[key]) return;
  const target = PRESET_VIEWS[key];
  viewer.camera.setView({
    destination: target.destination,
    orientation: target.orientation,
  });
  viewer.clockViewModel.currentTime = Cesium.JulianDate.fromIso8601(
    target.time
  );
}

onMounted(() => {
  init();
});

function init() {
  if (!containerRef.value) return;

  // 1. 初始化 Viewer，开启世界地形并请求顶点法线（用于计算坡度与坡向）
  viewer = createViewer(containerRef.value, {
    terrain: Cesium.Terrain.fromWorldTerrain({
      requestVertexNormals: true,
    }),
  });
  optimizeViewerQuality(viewer);

  // 2. 初始化地球材质并定位到默认视角（喜马拉雅山脉）
  updateMaterial();
  flyToPreset(viewModel.location);

  // 3. 构建 lil-gui 控制面板
  gui = createGUI({
    container: containerRef.value,
    title: "地球材质控制 (Globe Materials)",
    width: 280,
  });

  gui
    .add(viewModel, "location", {
      "喜马拉雅山脉 (Himalayas)": "himalayas",
      "半圆顶 (Half Dome)": "halfDome",
      "温哥华 (Vancouver)": "vancouver",
      "珠穆朗玛峰 (Mount Everest)": "mountEverest",
    })
    .name("观测地点")
    .onChange((val) => flyToPreset(val));

  gui
    .add(viewModel, "selectedShading", {
      "无着色 (No shading)": "none",
      "高程设色 (Elevation)": "elevation",
      "坡度分析 (Slope)": "slope",
      "坡向分析 (Aspect)": "aspect",
    })
    .name("地表着色模式")
    .onChange(() => updateMaterial());

  const contourFolder = gui.addFolder("等高线设置 (Contour Lines)");
  let spacingCtrl = null;
  let widthCtrl = null;
  let colorCtrl = null;
  let randomBtnCtrl = null;

  function syncContourCtrlState(enabled) {
    [spacingCtrl, widthCtrl, colorCtrl, randomBtnCtrl].forEach((ctrl) => {
      if (ctrl) ctrl.disable(!enabled);
    });
  }

  contourFolder
    .add(viewModel, "enableContour")
    .name("启用等高线")
    .onChange((enabled) => {
      updateMaterial();
      syncContourCtrlState(enabled);
    });

  spacingCtrl = contourFolder
    .add(viewModel, "contourSpacing", 1.0, 500.0, 1.0)
    .name("等高距 (m)")
    .onChange((val) => {
      if (contourUniforms) contourUniforms.spacing = parseFloat(val);
    });

  widthCtrl = contourFolder
    .add(viewModel, "contourWidth", 1.0, 10.0, 1.0)
    .name("等高线宽 (px)")
    .onChange((val) => {
      if (contourUniforms) contourUniforms.width = parseFloat(val);
    });

  colorCtrl = contourFolder
    .addColor(viewModel, "contourColorCss")
    .name("等高线颜色")
    .onChange((val) => {
      Cesium.Color.fromCssColorString(val, contourColor);
      if (contourUniforms) contourUniforms.color = contourColor;
    });

  randomBtnCtrl = contourFolder
    .add(viewModel, "randomContourColor")
    .name("随机等高线颜色")
    .onChange(() => {
      colorCtrl?.updateDisplay();
    });

  syncContourCtrlState(viewModel.enableContour);
}

onBeforeUnmount(() => {
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
