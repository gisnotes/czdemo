<template>
  <div ref="containerRef" class="cesium-page-container"></div>
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
  if (!containerRef.value) return;

  // 1. 初始化 Cesium Viewer 并优化渲染画质
  viewer = createViewer(containerRef.value);
  optimizeViewerQuality(viewer);

  // 2. 设置球体初始属性（参考示例代码）
  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.scene.skyAtmosphere.show = false;

  const baseImageryLayer = viewer.scene.globe.imageryLayers.get(0);
  if (baseImageryLayer) {
    baseImageryLayer.alpha = params.imageryAlpha;
  }

  // 默认改为绿色
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(
    params.baseColor
  );

  // 3. 创建自定义 lil-gui 面板辅助调节地球颜色
  gui = createGUI({
    container: containerRef.value,
    title: "地球颜色控制",
  });

  gui
    .addColor(params, "baseColor")
    .name("地球底色 (baseColor)")
    .onChange((val) => {
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString(val);
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
});

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

<style scoped lang="scss">
@import "@/assets/styles/cesium.scss";
</style>
