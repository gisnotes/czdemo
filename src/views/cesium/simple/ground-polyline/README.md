# Cesium 编程：贴地线（Ground Clamping Polyline）实现方案总结

在三维 GIS 开发中，**贴地线（Ground-Clamped Polyline）** 是一项基础且关键的技术。在真实具有高程起伏的山体、峡谷或城市地形中，普通的空间三维线段（两个端点直接相连）会直接“穿透”山峰地底，导致中间绝大部分线段被山体遮挡，产生严重的**穿模截断现象**。

为了让线段像“公路”或“河流”一样紧紧吸附在复杂起伏的地表表面，Cesium 演进并提供了多种不同的贴地技术方案。

---

## 目录索引

1. [背景：普通空间折线为什么在地形上会穿模？](#一-背景普通空间折线为什么在地形上会穿模)
2. [方案 1：现代原生贴地线 (clampToGround: true)](#二-方案-1现代原生贴地线-clamptoground-true)
3. [方案 2：走廊带多边形模拟贴地线 (Corridor)](#三-方案-2走廊带多边形模拟贴地线-corridor)
4. [方案 3：地形高度细分采样插值 (SampleTerrain)](#四-方案-3地形高度细分采样插值-sampleterrain)
5. [方案 4：高性能底层贴地线图元 (GroundPolylinePrimitive)](#五-方案-4高性能底层贴地线图元-groundpolylineprimitive)
6. [四种贴地线方案对比与选型指南](#六-四种贴地线方案对比与选型指南)

---

## 一、 背景：普通空间折线为什么在地形上会穿模？

```javascript
// 普通折线（未启用贴地）
viewer.entities.add({
  polyline: {
    positions: Cesium.Cartesian3.fromDegreesArray([
      86.925765, 27.988057,
      86.976497, 27.988057
    ]),
    width: 4,
    material: Cesium.Color.RED,
    clampToGround: false // 默认不贴地
  }
});
```

- **问题现象**：两个端点定义在山脊两侧，中间相隔的山峰海拔高达 8000 多米。由于两点之间直接以欧氏空间直线相连，中间直线沉入山体内部几百米深。在开启地形深度检测后，山体把中间线段完全阻挡，视口中只能看到两侧露出的零碎端头。

---

## 二、 方案 1：现代原生贴地线 (clampToGround: true)

这是 **Cesium 1.54+ 官方推荐的首选方案**，也是开发中最简洁标准的方式。

### 1. 核心代码
```javascript
viewer.entities.add({
  polyline: {
    positions: Cesium.Cartesian3.fromDegreesArray([...]),
    width: 6,
    clampToGround: true, // 核心属性：开启贴地
    classificationType: Cesium.ClassificationType.TERRAIN, // 贴地类型
    material: Cesium.Color.YELLOW,
  }
});
```

### 2. 技术原理解析
- **GPU 阴影体投影（Shadow Volume）**：Cesium 在底层基于 `GroundPolylineGeometry` 算法，在 GPU 渲染时自动沿着折线路径生成一道立体的阴影体，并将线段纹理实时贴附到地表地形或倾斜摄影网格上。
- **分类吸附选项 (`classificationType`)**：
  - `Cesium.ClassificationType.TERRAIN`：仅贴附在地形（Terrain）上；
  - `Cesium.ClassificationType.CESIUM_3D_TILE`：仅贴附在 3D Tiles（倾斜摄影、BIM/白模）上；
  - `Cesium.ClassificationType.BOTH`：两者均贴附（默认）。

---

## 三、 方案 2：走廊带多边形模拟贴地线 (Corridor)

在早期 Cesium 版本尚未原生支持 `GroundPolyline` 时，开发者常利用**走廊（Corridor）**并赋予较小的宽度（如 5 ~ 15 米）来表现贴地线。

### 1. 核心代码
```javascript
viewer.entities.add({
  corridor: {
    positions: Cesium.Cartesian3.fromDegreesArray([...]),
    width: 10, // 设定较窄宽度（单位：米）
    cornerType: Cesium.CornerType.ROUNDED, // 转折拐角处平滑圆润过渡
    material: Cesium.Color.GREEN.withAlpha(0.85),
    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, // 贴地高程模式
    classificationType: Cesium.ClassificationType.TERRAIN
  }
});
```

### 2. 特性与优势
- **转角平滑**：支持 `Cesium.CornerType.ROUNDED`（圆角）、`MITERED`（尖角）与 `BEVELED`（平角），在大角度拐弯时视觉更圆滑。
- **材质丰富**：本质属于二维面，因此能够完美支持各种面填充材质（条纹 Stripe、发光线 Glow、棋盘格、图片贴图）。

---

## 四、 方案 3：地形高度细分采样插值 (SampleTerrain)

这是 Cesium 官方经典示例 **Ground Clamping** 采用的纯数学与异步地形切片查询方案。

### 1. 核心算法流程
```mermaid
flowchart LR
    A["起止经纬度两点"] --> B["等间距几何细分采样(如300点)"]
    B --> C["Cesium.sampleTerrainMostDetailed()"]
    C --> D["查询真实地形瓦片高程切片"]
    D --> E["叠加垂直微偏移(+2.0m防Z-Fighting)"]
    E --> F["重构为高精度三维立体折线"]
```

### 2. 核心代码
```javascript
// 1. 在首尾两点间线性插值生成 N 个等间距经纬度点
const samplePositions = [];
for (let i = 0; i < count; i++) {
  const lon = Cesium.Math.lerp(startLon, endLon, i / (count - 1));
  const lat = Cesium.Math.lerp(startLat, endLat, i / (count - 1));
  samplePositions.push(new Cesium.Cartographic(lon, lat));
}

// 2. 异步查询地形瓦片高程
const samples = await Cesium.sampleTerrainMostDetailed(
  viewer.terrainProvider,
  samplePositions
);

// 3. 增加微小离地偏移（如 2 米），防止线条与地表雪地发生 Z-Fighting 深度闪烁
for (let i = 0; i < samples.length; i++) {
  samples[i].height = (samples[i].height || 0) + 2.0;
}

// 4. 构建带立体描边的高精度折线
viewer.entities.add({
  polyline: {
    positions: Cesium.Ellipsoid.WGS84.cartographicArrayToCartesianArray(samples),
    followSurface: false,
    width: 5,
    material: new Cesium.PolylineOutlineMaterialProperty({
      color: Cesium.Color.ORANGE,
      outlineWidth: 2,
      outlineColor: Cesium.Color.BLACK
    }),
    depthFailMaterial: new Cesium.PolylineOutlineMaterialProperty({
      color: Cesium.Color.DARKRED, // 被山体遮挡的背面显示为深红
      outlineWidth: 2,
      outlineColor: Cesium.Color.BLACK
    })
  }
});
```

### 3. 为什么需要采样方案？
- **支持深度遮挡区分**：可以完美搭配 `depthFailMaterial`，山脊正面显示高亮橙色，翻过山脊背对相机的被遮挡段显示深红色；
- **真实空间三维点列**：插值后的折线是完全具有三维高度的实体线，可以参与空间射线相交计算、剖面分析与漫游相机跟踪。

---

## 五、 方案 4：高性能底层贴地线图元 (GroundPolylinePrimitive)

当场景中需要加载成千上万条道路中心线、公交轨迹或地下管网时，如果为每条线创建一个 Entity，会因开销过大导致明显掉帧。此时推荐采用底层 **GroundPrimitive** 批处理。

### 核心代码
```javascript
const instance = new Cesium.GeometryInstance({
  geometry: new Cesium.GroundPolylineGeometry({
    positions: coordsCartesian,
    width: 4.0
  }),
  attributes: {
    color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.SKYBLUE)
  }
});

const groundPrimitive = new Cesium.GroundPolylinePrimitive({
  geometryInstances: instance,
  classificationType: Cesium.ClassificationType.TERRAIN
});

viewer.scene.groundPrimitives.add(groundPrimitive);
```

---

## 六、 四种贴地线方案对比与选型指南

| 方案 | 核心 API | 实现复杂度 | 性能表现 | 优缺点分析 | 推荐场景 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0. 普通空间折线** | `polyline` (`clampToGround: false`) | 最低 | 极高 | ❌ 在起伏地形上严重穿模断裂 | 纯平地、高空航线、空间弦 |
| **1. 原生贴地线** | `polyline` (`clampToGround: true`) | **极简 (一行配置)** | 高 | ✅ 现代首选，GPU 阴影体实时贴合，无穿模 | **绝大多数业务的首选**（如路径、轨迹） |
| **2. 走廊模拟贴地线** | `corridor` (`CLAMP_TO_GROUND`) | 中等 | 中等 | ✅ 转角圆润，支持丰富面材质；❌ 拐角过大时易产生几何折叠 | 宽道路面标线、河流、航道带 |
| **3. 地形高度插值采样** | `sampleTerrainMostDetailed` | 较高 (需异步采样) | 取决于采样点数 | ✅ 具备真实 3D 绝对高度，支持 `depthFailMaterial`；❌ 依赖地形瓦片异步下载 | 山脊登山步道、高程剖面分析 |
| **4. 底层图元贴地线** | `GroundPolylinePrimitive` | 较高 (Primitive API) | **极高 (批处理)** | ✅ 适合批量合并渲染；❌ 动态交互属性修改相对繁琐 | **海量 GIS 路网、百万管线渲染** |

