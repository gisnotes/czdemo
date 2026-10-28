# Cesium 官方示例解读：地球材质（Globe Materials）

本文档对应官方 Sandcastle 示例 [Globe Materials](https://sandcastle.cesium.com/?id=globe-materials)，通过向 `viewer.scene.globe.material` 挂载内置材质与 Fabric 复合材质，实现地球地形表面的 **高程设色（Elevation）**、**坡度分析（Slope）**、**坡向分析（Aspect）** 以及 **等高线（Contour Lines）** 叠加渲染。

---

## 一、 为什么初始化地形时必须开启 `requestVertexNormals: true`？

```js
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromWorldTerrain({
    requestVertexNormals: true, // Needed to visualize slope
  }),
});
```

- **作用**：向地形切片服务请求每个地形网格顶点的**三维法向量（Vertex Normals）**数据。
- **原因**：
  - **高程（Elevation）** 只需要知道每个片元的海拔高度 `h`，不依赖法向量。
  - **坡度（Slope，地表倾斜程度）** 和 **坡向（Aspect，山坡朝向方位）** 在片元着色器（Fragment Shader）中必须通过地表法向量与椭球面法向量的夹角及切空间投影计算得出。若不开启 `requestVertexNormals: true`，选择坡度或坡向模式时将无法正确渲染。

---

## 二、 Cesium 内置的 4 种地球表面材质

代码中通过 `Cesium.Material.fromType(type)` 调用了 Cesium 专门为 `Globe` 预置的 4 种着色器材质：

| 材质类型 (`type`) | 功能描述 | 核心 Uniform 参数 | 着色器底层逻辑 |
| :--- | :--- | :--- | :--- |
| **`ElevationRamp`** | **高程渐变设色** | `image`（1D 色带纹理）<br>`minimumHeight`（最低高程 `-414m` 死海）<br>`maximumHeight`（最高高程 `8777m` 珠峰） | 将当前片元的高程值线性归一化到 `[0.0, 1.0]`，作为纹理坐标去一维色带图 `image` 中采样对应颜色 |
| **`SlopeRamp`** | **坡度渐变设色** | `image`（1D 色带纹理） | 根据顶点法向量计算地形坡度角（`[0, π/2]`，即 `0° ~ 90°`），归一化到 `[0.0, 1.0]` 后去 `image` 中采样颜色 |
| **`AspectRamp`** | **坡向渐变设色** | `image`（1D 色带纹理） | 计算山坡朝向方位角（`0° ~ 360°`），归一化到 `[0.0, 1.0]` 后去 `image` 中采样颜色 |
| **`ElevationContour`** | **等高线** | `spacing`（等高距，单位：米）<br>`width`（等高线宽度，单位：像素）<br>`color`（等高线颜色） | 将片元海拔对 `spacing` 取模（求余数），并利用屏幕空间偏导数 `fwidth` 检测整数倍等高面边缘，在等高线处输出指定 `color`，其余区域 `alpha = 0.0` |

> **什么是“取模”？（等高线绘制原理解析）**
> - **取模（Modulo）就是“求余数”**（对应 JS 中的 `%` 运算符，或 GLSL 着色器中的 `mod(a, b)` 函数）；当**余数为 `0`** 时，就代表**刚好能被整除**。
> - **举例说明**：假设等高距 `spacing = 100`（每隔 100 米画一条等高线），着色器会对地形上每个像素的海拔 `height` 除以 `100` 求余数（`mod(height, 100)`）：
>   - 海拔 **`135米`**：`135 ÷ 100` **余数为 `35`** → 不在等高线上，保持透明（`alpha = 0.0`）。
>   - 海拔 **`200米`**：`200 ÷ 100` **余数为 `0`（刚好整除）** → 正好处于 100 米的整数倍高度上，绘制等高线颜色！
>   - 海拔 **`300米`**：`300 ÷ 100` **余数为 `0`（刚好整除）** → 同样绘制等高线颜色！
> - **配合 `fwidth` 控制线宽**：由于三维地形上很难有像素的海拔分毫不差等于 `200.00000` 米，着色器会结合 `fwidth`（计算相邻像素的海拔变化率），将余数接近 `0` 的那一圈像素（宽度由 `width` 决定，如 `2px`）都渲染为等高线颜色。

---

## 三、 什么是 Fabric？以及 `getXXXContourMaterial()` 复合材质的合成原理

### 1. `Fabric` 在 Cesium 中的含义与翻译
- **字面本意与隐喻**：`Fabric` 英文原意为 **“织物、布料”**，引申为 **“结构、构造方式”**。Cesium 官方将自己的 JSON 材质描述系统命名为 `Fabric`，是因为在三维图形学中，给几何体表面赋予材质就像给物体“穿上布料/织物”，并且它支持将多个子材质像“编织布料”一样交织组合成一个新材质。
- **中文技术译法**：在中文文档中通常保留英文专有名词，译为 **“Fabric 材质规范”**、**“Fabric 材质系统”** 或 **“材质结构定义”**（不建议生硬直译为“织物”）。
- **核心作用**：当编写 `new Cesium.Material({ fabric: { type, uniforms, materials, components, source } })` 时，`fabric` 就是告诉 Cesium 这块材质由哪些参数（`uniforms`）、哪些子材质（`materials`）和什么样的着色规则（`components` / `source`）构成，Cesium 会在底层将其自动编译拼接为完整的 WebGL GLSL 着色器代码。

### 2. `getXXXContourMaterial()` 复合材质合成逻辑

当用户**同时开启“渐变着色（高程/坡度/坡向）”与“等高线（Enable Contour Lines）”**时，`viewer.scene.globe.material` 只能挂载一个材质实例。因此需要利用 Cesium 的 **Fabric 复合材质机制** 将两个子材质组合在一起。

以 `getElevationContourMaterial()` 为例：

```js
function getElevationContourMaterial() {
  return new Cesium.Material({
    fabric: {
      type: "ElevationColorContour",
      // 1. 声明需要组合的子材质
      materials: {
        contourMaterial: {
          type: "ElevationContour", // 子材质 1：等高线
        },
        elevationRampMaterial: {
          type: "ElevationRamp",    // 子材质 2：高程色带
        },
      },
      // 2. 编写 GLSL 像素混合规则
      components: {
        // 如果当前像素不在等高线上（contourMaterial.alpha == 0.0），则显示高程渐变底色；
        // 如果在等高线上，则优先显示等高线颜色（contourMaterial.diffuse）
        diffuse:
          "contourMaterial.alpha == 0.0 ? elevationRampMaterial.diffuse : contourMaterial.diffuse",
        // 最终不透明度取两者的最大值
        alpha: "max(contourMaterial.alpha, elevationRampMaterial.alpha)",
      },
    },
    translucent: false,
  });
}
```

- `getSlopeContourMaterial()` 和 `getAspectContourMaterial()` 完全同理，仅将底层的 `ElevationRamp` 分别替换为 `SlopeRamp` 和 `AspectRamp`。

> **`components` 中 GLSL 表达式的白话拆解**
>
> 在 Cesium 的 Fabric 材质中，`components` 用于定义每个像素最终输出的外观属性，语法与 JavaScript 非常相似：
> 1. **两个核心属性**：
>    - **`diffuse`（漫反射颜色）**：决定当前像素最终显示**什么 RGB 颜色**。
>    - **`alpha`（不透明度）**：决定当前像素**是否透明**（`0.0` 为完全透明，`1.0` 为完全不透明）。
> 2. **`diffuse` 三元表达式解析（`条件 ? 结果A : 结果B`）**：
>    ```glsl
>    contourMaterial.alpha == 0.0 ? elevationRampMaterial.diffuse : contourMaterial.diffuse
>    ```
>    显卡在绘制地表每一个像素点时，都会执行这句判断：
>    - **问**：`contourMaterial.alpha == 0.0`（当前这个像素点在“等高线图层”上是不是透明的？即：**这里是不是没有等高线经过？**）
>    - **如果是（没有等高线）**：取 `?` 后面的 `elevationRampMaterial.diffuse` → **显示高程渐变的底色**。
>    - **如果否（正好在等高线上）**：取 `:` 后面的 `contourMaterial.diffuse` → **显示等高线的颜色（把底色盖住）**。
> 3. **`alpha` 最大值函数解析（`max(a, b)`）**：
>    ```glsl
>    max(contourMaterial.alpha, elevationRampMaterial.alpha)
>    ```
>    相当于 JS 中的 `Math.max()`，取两个子材质不透明度的较大值（因为渐变底色不透明度恒为 `1.0`，最终结果恒为 `1.0`，保证地表完全不透明）。

---

## 四、 `getColorRamp()`：用 HTML5 Canvas 动态生成 100×1 渐变纹理（1D LUT）

```js
const elevationRamp = [0.0, 0.045, 0.1, 0.15, 0.37, 0.54, 1.0];
const slopeRamp = [0.0, 0.29, 0.5, Math.sqrt(2) / 2, 0.87, 0.91, 1.0];
const aspectRamp = [0.0, 0.2, 0.4, 0.6, 0.8, 0.9, 1.0];

function getColorRamp(selectedShading) {
  const ramp = document.createElement("canvas");
  ramp.width = 100;
  ramp.height = 1;
  const ctx = ramp.getContext("2d");

  const grd = ctx.createLinearGradient(0, 0, 100, 0);
  grd.addColorStop(values[0], "#000000"); // 黑
  grd.addColorStop(values[1], "#2747E0"); // 蓝
  grd.addColorStop(values[2], "#D33B7D"); // 粉
  grd.addColorStop(values[3], "#D33038"); // 红
  grd.addColorStop(values[4], "#FF9742"); // 橙
  grd.addColorStop(values[5], "#ffd700"); // 黄
  grd.addColorStop(values[6], "#ffffff"); // 白

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 100, 1);
  return ramp;
}
```

1. **为什么画布尺寸是 `100 × 1`？**
   着色器对高程/坡度/坡向的采样本质上是**一维颜色查找表（1D Color Lookup Table）**。`height = 1` 即可满足一维插值需求，开销极小。
2. **为什么三种模式的渐变断点（`values`）分布不同？**
   - **高程 (`elevationRamp`)**：全球海拔区间为 `[-414m, 8777m]`，但绝大多数平原和山地集中在 `0 ~ 2500m`（前 30% 区间），因此前 4 个颜色断点（`0.0, 0.045, 0.1, 0.15`）分布密集，使中低海拔地形也能呈现丰富的色彩对比。
   - **坡度 (`slopeRamp`)**：以 `sin(45°) = √2 / 2 ≈ 0.707` 为分界，突出陡坡与悬崖的颜色过渡。
   - **坡向 (`aspectRamp`)**：`0° ~ 360°` 各个朝向概率均等，因此断点均匀分布。

---

## 五、 `updateMaterial()` 状态机与工程化改造说明

1. **`updateMaterial()` 核心职责**：
   - 当切换着色模式（`selectedShading`）或开关等高线（`enableContour`）时，需要**重新构造对应的 `Cesium.Material` 实例**并赋值给 `viewer.scene.globe.material`。
   - 当仅调节等高距（`contourSpacing`）、等高线宽度（`contourWidth`）或等高线颜色（`contourColor`）时，无需重建材质，直接修改 `contourUniforms` 对象的属性即可实时生效。
2. **Vue 3 + `lil-gui` 改造**：
   - 官方原示例使用了早期的 `Cesium.knockout` 进行表单双向绑定，以及 `Sandcastle.addToolbarMenu` 切换预设相机视角。
   - 在本项目的 `index.vue` 实现中，已移除 `knockout` 和 `Sandcastle` 依赖，统一采用项目内置的 `createGUI`（`lil-gui`）构建交互控制面板。


---

## 六、 细节剖析：为什么 `Cesium.Color.RED.clone()` 必须调用 `.clone()`？

```js
const contourColor = Cesium.Color.RED.clone();
```

这里涉及 Cesium 的**只读常量保护机制**与**内存复用（`result` 参数）设计模式**：

1. **`Cesium.Color.RED` 是被 `Object.freeze()` 冻结的全局只读常量**
   在 Cesium 源码中，所有预定义颜色常量（如 `Cesium.Color.RED`、`Cesium.Color.WHITE`）在初始化时均通过 `Object.freeze()` 冻结：
   ```js
   Color.RED = Object.freeze(Color.fromCssColorString("#FF0000"));
   ```
   这是为了防止某处代码意外修改了全局的 `Cesium.Color.RED`，导致整个应用中所有引用该常量的对象颜色被污染。

2. **后续变色操作使用了 `result` 参数进行原地属性修改（In-place Mutation）**
   在随机切换颜色或通过颜色选择器修改颜色时：
   ```js
   // 第二个参数 contourColor 作为 result 传入，直接原地修改其 red/green/blue/alpha 属性
   Cesium.Color.fromRandom({ alpha: 1.0 }, contourColor);
   Cesium.Color.fromCssColorString(val, contourColor);
   ```
   Cesium 为了避免高频交互时频繁 `new Cesium.Color()` 产生垃圾回收（GC）开销，设计了第二个参数 `result`，将计算出的新通道值直接写入 `contourColor` 实例内部：
   - **如果不调用 `.clone()`**：`contourColor` 指向被冻结的只读对象，执行 `fromRandom(..., contourColor)` 修改属性时会直接报错：`TypeError: Cannot assign to read only property 'red' of object`。
   - **调用 `.clone()` 后**：创建一个**全新的、可变的（Mutable）`Color` 实例**，既能安全地复用同一个对象引用（让 `contourUniforms.color` 自动感知内部值变化），又不会污染全局常量。
