import Cesium from "cesium";
import worldImageUrl from "@/assets/images/worldimage.jpg";

/**
 * Cesium Ion 默认访问密钥
 * 这是官方随源码分发的评估用 token（aud 里标注了会在 2026-12-01 被删除/失效），只适合试用；
 * 到期后可在此处手动更新，或前往 https://ion.cesium.com/tokens 申请自己的 token 替换。
 */
export const defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6Im01MDBjRTVZclBWTmwycGsiLCJqdGkiOiI3NGFjZmI5MS01MDAwLTQwZTktOTlkMC01OTJkN2E2MmQ5OTgiLCJpZCI6MjU5LCJzdWIiOiJDZXNpdW1KUyIsImlzcyI6Imh0dHBzOi8vYXBpLmNlc2l1bS5jb20iLCJhdWQiOiIxLjE0NiBSZWxlYXNlIC0gRGVsZXRlIG9uIERlY2VtYmVyIDEsIDIwMjYiLCJpYXQiOjE3OTAzMTMyMTJ9.4CskcFdVNW5VgLW2iBnYt2GIW2Yl9Q5u6T8gSRK4rkU";

// 全局设置 Cesium Ion 默认 Token
Cesium.Ion.defaultAccessToken = defaultAccessToken;

/**
 * 默认的 Cesium Viewer 基础配置
 */
export const DEFAULT_VIEWER_OPTIONS = {
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  baseLayerPicker: false,
  navigationHelpButton: false,
  animation: false,
  timeline: false,
  fullscreenButton: false,
  infoBox: false,
  selectionIndicator: false,
  shouldAnimate: true,
};

/**
 * 创建通用的 Cesium Viewer 实例
 * @param {HTMLElement|string} container - DOM 节点引用或容器元素 ID
 * @param {Object} [options={}] - 自定义覆盖配置项
 * @returns {Cesium.Viewer} Cesium.Viewer 实例
 */
export function createViewer(container, options = {}) {
  // const defaultBaseLayer = Cesium.ImageryLayer.fromProviderAsync(
  //   Cesium.TileMapServiceImageryProvider.fromUrl(
  //     Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
  //   ),
  // );

  const defaultBaseLayer = Cesium.ImageryLayer.fromProviderAsync(
    Cesium.SingleTileImageryProvider.fromUrl(worldImageUrl),
  );

  return new Cesium.Viewer(container, {
    ...DEFAULT_VIEWER_OPTIONS,
    baseLayer: defaultBaseLayer,
    ...options,
  });
}

/**
 * 开启高清晰度渲染与抗锯齿优化，解决几何体边框线锯齿感与粗糙感
 * @param {Cesium.Viewer} viewer - Viewer 实例
 * @param {Object} [options={}] - 抗锯齿配置项
 * @param {number} [options.msaaSamples=4] - WebGL2 多重采样抗锯齿倍数 (2, 4, 8)
 * @param {boolean} [options.enableFxaa=true] - 是否开启 FXAA 快速近似抗锯齿
 */
export function optimizeViewerQuality(viewer, { msaaSamples = 4, enableFxaa = true } = {}) {
  if (!viewer || !viewer.scene) return;

  viewer.resolutionScale = window.devicePixelRatio || 1.0;
  if (viewer.scene.msaaSamples !== undefined) {
    viewer.scene.msaaSamples = msaaSamples;
  }
  if (enableFxaa && viewer.scene.postProcessStages && viewer.scene.postProcessStages.fxaa) {
    viewer.scene.postProcessStages.fxaa.enabled = true;
  }
}
