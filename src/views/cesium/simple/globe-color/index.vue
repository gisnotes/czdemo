<template>
  <demo-box>
    <div ref="containerRef" class="cesium-page-container"></div>
  </demo-box>
</template>

<script setup name="GlobeColor">
import { useTemplateRef, onMounted, onBeforeUnmount } from "vue";
import Cesium from "cesium";
import { createViewer, optimizeViewerQuality } from "@/utils/cesium";
import { createGUI } from "@/utils/gui";

const containerRef = useTemplateRef("containerRef");
let viewer = null;
let gui = null;

// 控制面板状态参数
const params = {
  baseColor: "#00ff00",
  imageryAlpha: 0.0,
};

onMounted(() => {
  init();
});

function init() {
  if (!containerRef.value) return;

  // 1. 初始化 Cesium Viewer 并优化渲染画质
  viewer = createViewer(containerRef.value);
  optimizeViewerQuality(viewer);

  // 2. 设置球体初始属性（参考示例代码）
  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.scene.skyAtmosphere.show = false;

  viewer.scene.globe.imageryLayers.get(0).alpha = 0.0;
  viewer.scene.globe.baseColor = new Cesium.Color(0, 1, 0, 0); // 默认为蓝色，这里改成绿色

  // 3. 创建自定义 lil-gui 面板辅助调节地球颜色
  gui = createGUI({
    container: containerRef.value,
    title: "地球颜色控制",
  });

  gui
    .addColor(params, "baseColor")
    .name("地球底色 (baseColor)")
    .onChange((val) => {
      viewer.scene.globe.baseColor =
        Cesium.Color.fromCssColorString(val).withAlpha(0);
    });

  gui
    .add(params, "imageryAlpha", 0, 1, 0.01)
    .name("底图透明度 (alpha)")
    .onChange((val) => {
      const layer = viewer.scene.globe.imageryLayers.get(0);
      if (layer) {
        layer.alpha = val;
      }
    });
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

