# Cesium 编程：Polyline 弧段类型 (ArcType)

本篇笔记系统性对比与解析了 Cesium 中折线（Polyline）的三种弧段表现模式（`ArcType.NONE`、`ArcType.GEODESIC`、`ArcType.RHUMB`），并结合大地测量学、球面几何与墨卡托导航理论进行深度剖析。

---

## 目录索引

1. [核心概念：Cesium 中 Polyline 的三种表现](#一-核心概念cesium-中-polyline-的三种表现)
2. [空间直线 (无弧度) Cesium.ArcType.NONE](#二-空间直线-无弧度-cesiumarctypenone)
3. [球面线段 (大圆测地线) Cesium.ArcType.GEODESIC](#三-球面线段-大圆测地线-cesiumarctypegeodesic)
4. [恒向线 (等角航线) Cesium.ArcType.RHUMB](#四-恒向线-等角航线-cesiumarctyperhumb)
5. [三种弧段类型对比总结与选型指南](#五-三种弧段类型对比总结与选型指南)
6. [API 使用参考与示例代码](#六-api-使用参考与示例代码)

---

## 一、 核心概念：Cesium 中 Polyline 的三种表现

在 Cesium 三维地球视口中，当你在球面上任意指定两个远距离经纬度点（例如伦敦到旧金山）并绘制一条连线时，Cesium 内部支持通过 `arcType` 属性指定三种截然不同的线段插值算法：

```javascript
// 枚举定义
Cesium.ArcType = {
  NONE: 0,      // 空间绝对直线（两点直接相连，穿入地下）
  GEODESIC: 1,  // 球面测地线 / 大圆航线（两点间球面最短路径，默认值）
  RHUMB: 2      // 恒向线 / 等角航线（墨卡托投影上的直线，方位角恒定）
};
```

---

## 二、 空间直线 (无弧度) Cesium.ArcType.NONE

### 1. 概念与几何本质
- **定义**：直接在三维笛卡尔直角坐标系（Cartesian3 $X, Y, Z$）中，以欧氏空间两点间的一条直线段（空间弦）进行连接，两点之间**没有任何球面弧度插值**。
- **与球面的关系**：
  - 如果两点相距很近（如几十米），弧度和直线的差异肉眼几乎不可辨别；
  - 如果两点相距甚远（如跨大西洋或跨太平洋），这条线段将会**穿透地球内部（地壳与地幔）**，形成一条连接两点的“地下隧道”。

### 2. 为什么在默认三维场景下它会“断裂”或“看不见”？
- 因为 Cesium 默认开启了地表球体的遮挡剔除（或开启了深度检测 `depthTestAgainstTerrain = true`）。
- 由于空间直线沉入了地球椭球体内部，中间绝大部分线段被实体地表阻挡，因此只能在起点和终点露出一点端头。
- **为什么把底图透明度调为 0 依然看不到？**
  - 底图切片（`ImageryLayer`）只是贴在球体网格表面的一张画皮。即使画皮 100% 透明，其下方的**地球几何体（Globe 椭球体网格）**依然是不透明实体，且每帧写入深度缓冲区（Z-Buffer），牢牢遮挡着地底要素。
- **正规透视观察方案**：
  1. **开启地球球体半透明（Globe Translucency，本示例采用）**：
     将空间直线保持为原本纯粹的几何实线，通过调节地球球体透明度，获得最真实自然的晶莹地心穿透观感：
     ```javascript
     viewer.scene.globe.translucency.enabled = true;
     viewer.scene.globe.translucency.frontFaceAlpha = 0.5; // 半透明透视
     viewer.scene.globe.translucency.backFaceAlpha = 0.5;
     ```
  2. **配置深度遮挡材质（[depthFailMaterial](https://cesium.com/learn/cesiumjs/ref-doc/PolylineGraphics.html#depthFailMaterial)）**：
     > 官方定义：`depthFailMaterial` 指定当折线未通过深度测试（即被地表或模型遮挡）时使用的渲染材质。如果希望在不透明地球下将地底部分标为虚线，可配置此属性：
     ```javascript
     polyline: {
       material: Cesium.Color.PURPLE, // 未被遮挡部分（实线）
       depthFailMaterial: new Cesium.PolylineDashMaterialProperty({
         color: Cesium.Color.PURPLE.withAlpha(0.85),
         dashLength: 16.0, // 被地表遮挡的地下部分（虚线）
       }),
     }
     ```
  3. **关闭深度检测**：
     ```javascript
     viewer.scene.globe.depthTestAgainstTerrain = false;
     ```

---

## 三、 球面线段 (大圆测地线) Cesium.ArcType.GEODESIC

### 1. 概念与几何本质
- **定义**：球面上两点之间的最短连线长度称为**球面距离（Geodesic Distance）**。在数学上，它是**经过球心与这两点的平面所截球面得到的“大圆”（Great Circle）上的一段劣弧**。
- **特性**：
  - **曲面距离最短**：现代跨洋民航客机执飞航线通常沿着大圆航线飞行，以达到最省油、耗时最短的目标。
  - **向高纬度凸起**：当航线跨越长经度时，三维视角下的大圆劣弧在传统平面地图上看会明显向极地高纬度方向弯曲凸起（例如北京飞往纽约的航线会跨越北极圈上空）。

### 2. 计算 API
Cesium 内置了 `EllipsoidGeodesic` 类用于高精度测地线计算：
```javascript
const start = Cesium.Cartographic.fromDegrees(-0.1278, 51.5074);
const end = Cesium.Cartographic.fromDegrees(-122.4194, 37.7749);

const geodesic = new Cesium.EllipsoidGeodesic(start, end);
const distanceKm = geodesic.surfaceDistance / 1000; // 单位：千米
```

---

## 四、 恒向线 (等角航线) Cesium.ArcType.RHUMB

### 1. 概念与几何本质
恒向线（Rhumb Line，又称等角航线或 Loxodrome）是航海与早期航空史上极为关键的一种航线：

- **特性 1（等角性）**：航线与地球表面上的每一条经线（子午线）相交成**完全恒定的夹角（保持航向角不变）**。
- **特性 2（墨卡托投影为直线）**：在正轴等角圆柱投影（标准墨卡托海图）上，恒向线表现为一条绝对的几何直线。

### 2. 为什么需要恒向线？（航海优势）
- **操舵友好**：
  - **大圆航线**虽然总距离最短，但航行过程中航向角在不间断地微小改变，要求舵手或自动舵系统持续修正船头朝向；
  - **恒向线**则不然，舵手只需将罗盘锁定在某一固定方位角（例如东北 $42^\circ$），即可保持该航向一路航行抵达目的地，中途数小时甚至数天都无需频繁改变舵角。
- **航程劣势**：
  - 恒向线的实际球面距离始终大于大圆航线。在大范围跨洋或中高纬度长途航行中，恒向线可能会比大圆航线多走数百甚至上千公里。
  - **工程实践折中**：在现代远洋船舶与航线规划中，通常会将漫长的大圆航线划分为若干短线段（如每隔几百海里一个分段点），各分段内部采用恒向线航行，既享受了大圆航线总体路程短的优势，又兼顾了航向阶段性固定的操舵便利。

### 3. 计算 API
Cesium 提供了配套的 `EllipsoidRhumbLine` 类：
```javascript
const rhumb = new Cesium.EllipsoidRhumbLine(start, end);
const rhumbDistKm = rhumb.surfaceDistance / 1000;
```

---

## 五、 三种弧段类型对比总结与选型指南

以本示例内置的经典跨大西洋航线 **伦敦 (-0.128, 51.507) ↔ 旧金山 (-122.419, 37.775)** 为例：

| 弧段类型 | Cesium 枚举值 | 几何形态 | 实际航程 (km) | 相对大圆航程差 | 典型适用场景 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **球面线段 (测地线)** | `Cesium.ArcType.GEODESIC` | 球面大圆劣弧 | **8,638.7 km** | **0% (最短标准)** | 民航越洋航线、导弹/卫星轨道地面投影、全球 GIS 测距 |
| **恒向线 (等角线)** | `Cesium.ArcType.RHUMB` | 球面螺旋等角弧 | **9,753.2 km** | **+1,114.5 km (+12.9%)** | 传统航海海图导航、固定航向等角走线 |
| **空间绝对直线** | `Cesium.ArcType.NONE` | 空间穿地弦 | **7,995.8 km** | - (下潜最大深度 598 km) | 隧道/管道贯通、视线遮挡分析 (LOS)、星地激光直线链路 |

---

## 六、 API 使用参考与示例代码

```javascript
import Cesium from "cesium";

// 1. 创建大圆航线实体
const geodesicLine = viewer.entities.add({
  polyline: {
    positions: Cesium.Cartesian3.fromDegreesArray([
      -0.1278, 51.5074, // 伦敦
      -122.4194, 37.7749 // 旧金山
    ]),
    width: 4,
    arcType: Cesium.ArcType.GEODESIC,
    material: Cesium.Color.RED,
  }
});

// 2. 创建恒向线实体
const rhumbLine = viewer.entities.add({
  polyline: {
    positions: Cesium.Cartesian3.fromDegreesArray([
      -0.1278, 51.5074,
      -122.4194, 37.7749
    ]),
    width: 4,
    arcType: Cesium.ArcType.RHUMB,
    material: Cesium.Color.GREEN,
  }
});

// 3. 创建空间直线实体
const straightLine = viewer.entities.add({
  polyline: {
    positions: Cesium.Cartesian3.fromDegreesArray([
      -0.1278, 51.5074,
      -122.4194, 37.7749
    ]),
    width: 4,
    arcType: Cesium.ArcType.NONE,
    material: Cesium.Color.PURPLE,
  }
});
```

