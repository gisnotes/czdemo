# Cesium Canvas 动态纹理与双缓冲机制 (Dynamic Canvas Material)

## 一、双案例一键切换

本示例将《Cesium 动态纹理-图片》中的两个典型场景整合为一键切换：

| 模式 | 视觉表现 | 核心代码机制 |
| :--- | :--- | :--- |
| **1. 移动箭头图片** | 橙黄色箭头在矩形内从左往右持续平滑位移 | `ctx.drawImage(img, i, 0)` + `i += 3`，配合双缓冲 Canvas |
| **2. 动态时间文字 (带旋转)** | 红色斜体毫秒时间戳实时跳动 + 矩形动态自转 | `ctx.fillText(timestamp, 20, 70)` + `rotation/stRotation: CallbackProperty` |

---

## 二、双缓冲核心避坑原理

Cesium 对 `ImageMaterialProperty` 进行材质缓存脏检查，若返回的 Canvas 引用对象没有改变，WebGL 不会重新上传纹理，导致重绘假死：

```javascript
let curCanvas = 'a';

function drawDynamicCanvas() {
  const canvas = document.getElementById("canvas-" + curCanvas);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. 根据模式绘制图片或文字
  // ...

  // 2. 关键：交替返回 canvas-a 与 canvas-b 的 DOM 引用
  curCanvas = curCanvas === 'a' ? 'b' : 'a';
  return canvas;
}
```
