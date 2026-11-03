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
      <!-- 离屏双缓冲 Canvas -->
      <canvas id="canvas-a" class="canvas" width="700" height="100"></canvas>
      <canvas id="canvas-b" class="canvas" width="700" height="100"></canvas>

      <!-- 极简模式切换悬浮栏 -->
      <div class="switch-toolbar">
        <el-radio-group v-model="currentType" size="small" @change="handleTypeChange">
          <el-radio-button label="image">1. 移动箭头图片</el-radio-button>
          <el-radio-button label="text">2. 动态时间文字 (带旋转)</el-radio-button>
        </el-radio-group>
      </div>
    </div>
  </demo-box>
</template>

<script setup name="DynamicCanvasMaterial">
import { ref, onMounted, onBeforeUnmount } from "vue";
import Cesium from "cesium";
import { createViewer, optimizeViewerQuality } from "@/utils/cesium";
import arrowIcon from "@/assets/images/arrow.png";

const containerRef = ref(null);
const currentType = ref("image"); // 'image' | 'text'

let viewer = null;
let rectEntity = null;
let curCanvas = "a";
let i = 0;
let rotation = Cesium.Math.toRadians(30);

// 预加载箭头图标
const img = new Image();
img.src = arrowIcon;

function getRotationValue() {
  rotation += 0.005;
  return rotation;
}

/**
 * 统一双缓冲 Canvas 渲染调度
 */
function drawDynamicCanvas(time, result) {
  const canvas = document.getElementById("canvas-" + curCanvas);
  if (!canvas) return null;

  const cwidth = 700;
  const cheight = 100;
  const ctx = canvas.getContext("2d");

  // 清空画布
  ctx.clearRect(0, 0, cwidth, cheight);

  if (currentType.value === "image") {
    // 【例二：绘制移动箭头图片】
    if (img.complete && img.naturalWidth > 0) {
      if (i <= cwidth) {
        ctx.drawImage(img, i, 0);
      } else {
        i = 0;
      }
      i += 3;
    } else {
      img.onload = function () {
        if (i <= cwidth) {
          ctx.drawImage(img, i, 0);
        } else {
          i = 0;
        }
        i += 3;
      };
    }
  } else {
    // 【例一：绘制动态时间戳文字】
    ctx.font = "italic 40pt Calibri";
    ctx.fillStyle = "red";
    const timestamp = Cesium.JulianDate.toDate(
      Cesium.JulianDate.now()
    ).getTime();
    ctx.fillText(timestamp, 20, 70);
  }

  curCanvas = curCanvas === "a" ? "b" : "a";
  return canvas;
}

onMounted(() => {
  init();
});

function init() {
  if (!containerRef.value) return;

  viewer = createViewer(containerRef.value, {
    baseLayerPicker: false,
    timeline: false,
    animation: false,
  });
  optimizeViewerQuality(viewer);

  // 初始化添加矩形实体
  rectEntity = viewer.entities.add({
    name: "Dynamic Canvas Rectangle",
    rectangle: {
      coordinates: Cesium.Rectangle.fromDegrees(-90.0, 30.0, -70.0, 35.0),
      material: new Cesium.ImageMaterialProperty({
        image: new Cesium.CallbackProperty(drawDynamicCanvas, false),
        transparent: true,
      }),
      // 默认图片模式不旋转
      rotation: 0,
      stRotation: 0,
    },
  });

  // 镜头自动贴脸聚焦
  viewer.zoomTo(viewer.entities);
}

/**
 * 切换示例模式（文字/图片）
 */
function handleTypeChange(val) {
  if (!rectEntity) return;

  if (val === "text") {
    // 文字模式：启用原教程中的动态旋转
    rotation = Cesium.Math.toRadians(30);
    rectEntity.rectangle.rotation = new Cesium.CallbackProperty(
      getRotationValue,
      false
    );
    rectEntity.rectangle.stRotation = new Cesium.CallbackProperty(
      getRotationValue,
      false
    );
  } else {
    // 图片模式：重置位移与角度
    i = 0;
    rectEntity.rectangle.rotation = 0;
    rectEntity.rectangle.stRotation = 0;
  }
}

onBeforeUnmount(() => {
  if (viewer && !viewer.isDestroyed()) {
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

.switch-toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
}

.canvas {
  position: absolute;
  left: 10px;
  top: 10px;
  display: none;
}
#canvas-a {
  top: 10px;
}
#canvas-b {
  top: 120px;
}
</style>
