<template>
  <demo-box>
    <div ref="containerRef" class="cesium-page-container"></div>
  </demo-box>
</template>

<script setup name="ITwinGaussianSplats">
import { useTemplateRef, onMounted, onBeforeUnmount } from "vue";
import { ElMessage } from "element-plus";
import Cesium from "cesium";
import { createViewer, optimizeViewerQuality } from "@/utils/cesium";

const containerRef = useTemplateRef("containerRef");
let viewer = null;

onMounted(() => {
  init();
});

async function init() {
  if (!containerRef.value) return;

  // 生成用于免 OAuth 访问 iTwin 资源的共享密钥（Share Key）
  // 参考文档：https://developer.bentley.com/apis/access-control-v2/operations/create-itwin-share/
  Cesium.ITwinPlatform.defaultShareKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpVHdpbklkIjoiMDRiYTcyNWYtZjNjMC00ZjMwLTgwMTQtYTQ0ODhjYmQ2MTJkIiwiaWQiOiI3ZDVjN2FmNy1hYTZlLTQwYWYtYmJlOC1iZDBjNTQ0NTAzNGQiLCJleHAiOjE3OTYxMDIwMTR9.lAMXet_oZeIR-fpGMlawsBNrEj1CNTGK7WiRWQZCcs8";

  // 如需使用其他鉴权方式，请参考：https://developer.bentley.com/apis/overview/authorization/
  // 然后配置访问令牌：Cesium.ITwinPlatform.defaultAccessToken = 'your token'

  viewer = createViewer(containerRef.value, {
    terrain: Cesium.Terrain.fromWorldTerrain(),
  });
  optimizeViewerQuality(viewer);

  try {
    // 根据 iTwin 实景数据 ID 创建高斯泼溅（Gaussian Splats）3D Tileset
    const realityMesh = await Cesium.ITwinData.createTilesetForRealityDataId({
      iTwinId: "04ba725f-f3c0-4f30-8014-a4488cbd612d",
      realityDataId: "4afd5d69-3ba7-491d-86cd-3d86d43db907",
      tilesetOptions: {
        // 微调模型矩阵向下偏移，使其与 Cesium 世界地形对齐贴合
        modelMatrix: Cesium.Matrix4.fromTranslation(
          new Cesium.Cartesian3(-1, 9, -8)
        ),
      },
    });

    if (!viewer || viewer.isDestroyed()) return;
    viewer.scene.primitives.add(realityMesh);

    // 设置相机视角朝向大坝模型
    viewer.zoomTo(realityMesh, new Cesium.HeadingPitchRange(0, -0.5, 100));
  } catch (error) {
    console.error("加载 iTwin Reality Data 失败:", error);
    ElMessage.error(`模型加载失败: ${error?.message || error}`);
  }
}

onBeforeUnmount(() => {
  if (viewer && !viewer.isDestroyed()) {
    viewer.destroy();
    viewer = null;
  }
});
</script>

