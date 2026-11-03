# Cesium 编程：入门常见问题汇总

本篇笔记对 Cesium 初学者在三维项目开发中最常遇到的 **10 个典型问题与高频配置** 进行了现代化的完整重构与解析。

---

## 目录索引

1. [怎么去掉下面的 Logo 与版权信息？](#一-怎么去掉下面的-logo-与版权信息)
2. [如何显示渲染帧率 (FPS)？](#二-如何显示渲染帧率-fps)
3. [如何关闭大气层显示？](#三-如何关闭大气层显示)
4. [如何使用本地底图代替在线服务？](#四-如何使用本地底图代替在线服务)
5. [如何使用天地图服务 (WMTS)？](#五-如何使用天地图服务-wmts)
6. [如何控制图层或数据源显隐？](#六-如何控制图层或数据源显隐)
7. [点击 View Home 按钮之后跳转到自定义位置？](#七-点击-view-home-按钮之后跳转到自定义位置)
8. [如何控制视角不转到地下（防穿透）？](#八-如何控制视角不转到地下防穿透)
9. [如何禁止 Entity 实体选中状态？](#九-如何禁止-entity-实体选中状态)
10. [如何调整场景阴影的明暗程度？](#十-如何调整场景阴影的明暗程度)
11. [Cesium 核心基础配置速查表](#十一-cesium-核心基础配置速查表)

---

## 一、 怎么去掉下面的 Logo 与版权信息？

在初始化 Cesium Viewer 后，界面底部默认会有一个由 Cesium 官方提供的版权信息栏（`creditContainer`），包含 Cesium 蓝色 Logo、Ion 资产声明及数据源信息。

常见的三种隐藏或处理方式如下：

### 1. CSS 强行隐藏（最简单常用）
```css
/* 隐藏底部版权信息栏 */
.cesium-viewer-bottom,
.cesium-widget-credits {
  display: none !important;
}
```

### 2. 通过 JS DOM 动态控制
```javascript
// 隐藏 creditContainer 容器
viewer.cesiumWidget.creditContainer.style.display = "none";

// 若开启了 timeline/animation 等小部件，还可控制 bottomContainer
if (viewer.bottomContainer) {
  viewer.bottomContainer.style.display = "none";
}
```

### 3. 初始化 Viewer 时指定隐藏容器
```javascript
const viewer = new Cesium.Viewer("cesiumContainer", {
  // 将版权元素重定向到一个未挂载到画面的虚拟元素中
  creditContainer: document.createElement("div"),
});
```

> [!NOTE]
> **版权合规提示**：在商用或对外发布的生产项目中，若使用了 Cesium Ion 在线资源、商业卫星切片（如 Bing Maps、Mapbox 等），通常需遵守相应的数据许可协议，在软件系统的“关于”或页面版权页保留数据提供方鸣谢说明。

---

## 二、 如何显示渲染帧率 (FPS)？

### 核心代码
```javascript
// 开启帧率与渲染耗时监控面板
viewer.scene.debugShowFramesPerSecond = true;
```

### 作用与原理解析
- 开启后，Cesium 会在场景角落（默认右下角或底部）浮动显示当前实时帧率（如 `60 FPS`）以及单帧耗时（如 `16.6 ms`）。
- **性能排查利器**：
  - 当加载海量三维建筑物瓦片（3D Tileset）、高精度高程地形（Terrain）或大批量矢量要素（Entity / Primitive）出现卡顿与掉帧时，开启此项能快速评估 WebGL 渲染性能瓶颈。

---

## 三、 如何关闭大气层显示？

### 核心代码
```javascript
// 关闭外太空淡蓝色发光大气层圈层
viewer.scene.skyAtmosphere.show = false;
```

### 进阶优化：打造纯净黑/暗色大屏风格
如果希望整体背景更加深邃纯净（例如智慧城市数字孪生夜景模式），建议连同以下参数一并配置：
```javascript
// 1. 关闭大气发光层
viewer.scene.skyAtmosphere.show = false;

// 2. 关闭雾效（防止远处地表发灰发白）
viewer.scene.fog.enabled = false;

// 3. 关闭太阳和月亮渲染（可选）
viewer.scene.sun.show = false;
viewer.scene.moon.show = false;

// 4. 背景色设为透明或指定纯黑
viewer.scene.backgroundColor = Cesium.Color.BLACK;
```

---

## 四、 如何使用本地底图代替在线服务？

在**内网隔离、离线专网**或弱网环境下，三维地球无法访问 Cesium Ion、Bing、OSM 等外网地图，需要加载本地切片或单张离线图片。

### 1. 现代 Cesium 推荐：加载单张离线世界地图（SingleTile）
```javascript
import worldImageUrl from "@/assets/images/worldimage.jpg";

// Cesium 1.104+ 推荐使用异步静态工厂 fromUrl
const singleTileLayer = await Cesium.ImageryLayer.fromProviderAsync(
  Cesium.SingleTileImageryProvider.fromUrl(worldImageUrl)
);
viewer.imageryLayers.add(singleTileLayer);
```

### 2. 加载本地离线 TMS 切片瓦片（TileMapService）
Cesium 源码内部自带了一套离线的 `NaturalEarthII` 地表切片瓦片，路径位于 `Assets/Textures/NaturalEarthII`：
```javascript
const tmsUrl = Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII");

const tmsLayer = await Cesium.ImageryLayer.fromProviderAsync(
  Cesium.TileMapServiceImageryProvider.fromUrl(tmsUrl)
);
viewer.imageryLayers.add(tmsLayer);
```

> [!TIP]
> **Cesium 1.104+ API 变更注意**：
> 早期 Cesium 版本采用 `new Cesium.SingleTileImageryProvider({ url })` 同步构造函数；在新版中，Provider 的元数据加载已被全面改造为异步 Promise 机制，统一推荐使用 `ImageryLayer.fromProviderAsync(XXXImageryProvider.fromUrl(...))`。

---

## 五、 如何使用天地图服务 (WMTS)？

国家天地图是国内 GIS 项目中使用最广泛的官方地理底图服务，遵循 OGC WMTS（Web Map Tile Service）规范标准。

### 1. 规范封装：`Tianditu` 服务管理类
为避免重复拼接 WMTS URL，建议对天地图服务进行面向对象封装（参见同级目录下的 [`Tianditu.js`](file:///d:/Users/Downloads/czdemo/src/views/cesium/simple/common-issues/Tianditu.js)）：

```javascript
import { WebMapTileServiceImageryProvider } from "cesium";

export default class Tianditu {
  #baseUrl = "https://t{s}.tianditu.gov.cn/";
  #tk = "11c161d1558ad38a25a080da1ab26784";
  #sourceType = {
    矢量底图: "vec",
    矢量注记: "cva",
    影像底图: "img",
    影像注记: "cia",
  };

  // 官方服务说明处给出的请求 url 示例：http://lbs.tianditu.gov.cn/server/MapService.html
  createTiandituService(serviceType) {
    const layer = this.#sourceType[serviceType];
    const url =
      this.#baseUrl +
      layer +
      "_w/wmts?" +
      "service=wmts&request=GetTile&version=1.0.0&LAYER=" +
      layer +
      "&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&tk=" +
      this.#tk;
    return new WebMapTileServiceImageryProvider({
      url,
      layer,
      style: "default",
      format: "tiles",
      tileMatrixSetID: "GoogleMapsCompatible",
      subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
      maximumLevel: 18,
    });
  }
}
```

### 2. 页面中调用与加载
```javascript
import Tianditu from "./Tianditu.js";

const tdt = new Tianditu();

// 方式 A：加载天地图影像底图与中文注记
const imgService = tdt.createTiandituService("影像底图");
viewer.imageryLayers.addImageryProvider(imgService, 0);
const ciaService = tdt.createTiandituService("影像注记");
viewer.imageryLayers.addImageryProvider(ciaService, 1);

// 方式 B：加载天地图矢量底图与矢量注记
// const vecService = tdt.createTiandituService("矢量底图");
// viewer.imageryLayers.addImageryProvider(vecService, 0);
// const cvaService = tdt.createTiandituService("矢量注记");
// viewer.imageryLayers.addImageryProvider(cvaService, 1);
```

> [!IMPORTANT]
> **为什么 `tileMatrixSetID` 必须配置为 `"GoogleMapsCompatible"`？**
> - 天地图的 Web 墨卡托投影瓦片（`_w`）采用切片级别 `0 ~ 18`。
> - Cesium 的 `WebMapTileServiceImageryProvider` 默认瓦片矩阵集标识中，只有识别到 `"GoogleMapsCompatible"` 时，底层才会自动启用对应的 WebMercator 切片方案（`WebMercatorTilingScheme`），并自动映射 `0, 1, 2...` 的层级序号，保证瓦片精准对齐。

### 3. 国内项目最佳体验配置
在加载国内天地图时，建议搭配以下两项配置：
```javascript
// 1. 设置地球初始化默认相机视野范围为中国范围
Cesium.Camera.DEFAULT_VIEW_RECTANGLE = Cesium.Rectangle.fromDegrees(
  73.66, 3.86, 135.05, 53.55
);

// 2. 取消默认的双击事件（避免双击追踪物体导致相机剧烈晃动）
viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
  Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
);
```

---

## 六、 如何控制图层或数据源显隐？

在 Cesium 中，无论是图层数据源（`DataSource`）、影像瓦片层（`ImageryLayer`）、三维瓦片模型（`Cesium3DTileset`）还是独立实体（`Entity`），都原生封装了布尔属性 **`.show`**。

### 1. 控制 DataSource 数据源整体显隐
```javascript
// 加载 KML / GeoJSON / CustomDataSource
viewer.dataSources.add(Cesium.KmlDataSource.load("facilities.kml")).then((dataSource) => {
  // 一键隐藏该数据源下的所有点、线、面实体
  dataSource.show = false;

  // 重新展示
  dataSource.show = true;
});
```

### 2. 控制 ImageryLayer 栅格瓦片层显隐
```javascript
const layer = viewer.imageryLayers.get(0);
layer.show = false; // 隐藏底图
```

### 3. 控制单个 Entity 显隐
```javascript
const entity = viewer.entities.getById("my-entity-id");
entity.show = false;
```

> [!TIP]
> **显隐控制 vs 销毁移除（底图切换核心性能优化）**：
> - **错误做法（低性能）**：每次切换底图时，调用 `viewer.imageryLayers.remove()` 销毁旧图层，然后再 `new Provider()`。这会导致 WebGL 纹理被强制注销、触发垃圾回收（GC），再次切换回来时必须重新向网络发起数百个切片请求，并且切换瞬间会出现“地球白屏闪烁”。
> - **推荐做法（图层缓存池 + `.show` 显隐切换）**：
>   ```javascript
>   // 1. 底图缓存字典：Map<type, ImageryLayer[]>
>   const baseLayersCache = new Map();
>
>   async function switchBaseLayer(type) {
>     // 2. 惰性初始化：仅在首次使用该底图时创建并加入缓存池
>     if (!baseLayersCache.has(type)) {
>       const layers = await createBaseLayersByType(type);
>       baseLayersCache.set(type, layers);
>     }
>     // 3. 极速切换：仅将目标底图设为 show = true，其余已缓存图层设为 show = false
>     for (const [layerType, layers] of baseLayersCache.entries()) {
>       layers.forEach((layer) => {
>         layer.show = layerType === type;
>       });
>     }
>   }
>   ```
>   采用该模式后，底图切换耗时降至 **0ms 零白屏**，网络流量与 GPU 显存均保持最佳热缓存状态！

---

## 七、 点击 View Home 按钮之后跳转到自定义位置？

Cesium 右上角工具栏默认的 Home 按钮，点击后会将相机飞回初始的全球视图（视角正对西半球）。业务上通常需要将其重定向为**中国全图、目标省市或具体园区**。

### 核心覆盖监听机制
```javascript
// 监听 Home 按钮执行前的 beforeExecute 事件
viewer.homeButton.viewModel.command.beforeExecute.addEventListener((commandInfo) => {
  // 1. 飞向业务自定义的中心目标视角（例如北京示范要素上空）
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.3912, 39.9073, 2200.0),
    orientation: {
      heading: Cesium.Math.toRadians(25.0),
      pitch: Cesium.Math.toRadians(-35.0),
      roll: 0.0,
    },
    duration: 1.8,
  });

  // 2. 关键：通知 Cesium 取消原生默认的全球跳转命令
  commandInfo.cancel = true;
});
```

如果场景中已经确定了某个包围盒实体（`BoundingSphere`），亦可使用：
```javascript
viewer.camera.flyToBoundingSphere(boundingSphere);
commandInfo.cancel = true;
```

---

## 八、 如何控制视角不转到地下（防穿透）？

在三维球体交互中，常常会遇到“相机转到了地表以下”或者“地下看不见的面反而在地表上方被透视显示”的问题。需要结合两个维度的设置：

```javascript
// 1. 开启地表深度检测（WebGL 深度测试）
viewer.scene.globe.depthTestAgainstTerrain = true;

// 2. 开启相机碰撞检测（物理阻止相机潜入地心）
viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
```

### 两种配置的区别与配合
| 属性 | 作用层级 | 未开启现象 | 开启后效果 |
| :--- | :--- | :--- | :--- |
| **`depthTestAgainstTerrain`** | **渲染渲染级（Depth Buffer）** | 地形背面的几何体、位于地下海拔的管网/点位即使被山体遮挡，依然会穿透绘制在地表上方 | 地形会正确遮挡住其背后的几何体与地下实体 |
| **`enableCollisionDetection`** | **交互控制器级（Camera Controller）** | 用户使用鼠标滚轮向下放大或倾斜拖拽时，视角会直接穿破地表钻入地核内部，看到地球背部反面 | 相机运动到地表面时会被碰撞检测拦截，阻止继续向下下潜 |

---

## 九、 如何禁止 Entity 实体选中状态？

在默认情况下，当用户点击场景中的实体（Entity）时，Cesium 会：
1. 在点击位置显示一个**绿色的跟踪指示方块**（`selectionIndicator`）；
2. 在界面右上角弹出一个展示实体名称与 description 的**属性信息框**（`infoBox`）。

对于很多只需展示、或有自定义 UI 弹窗（Popup/Overlay）的项目，这套原生选中体验通常需要关闭。

### 方式一：在创建 Viewer 时全局禁用（推荐）
```javascript
const viewer = new Cesium.Viewer("cesiumContainer", {
  selectionIndicator: false, // 禁用绿框选择指示器
  infoBox: false,            // 禁用右上角原生属性弹窗
});
```

### 方式二：在已运行的 Viewer 中动态拦截选中
```javascript
// 监听选中实体变动，一旦被选中直接设为 undefined
viewer.selectedEntityChanged.addEventListener((selectedEntity) => {
  if (selectedEntity) {
    viewer.selectedEntity = undefined;
  }
});

// 或者动态隐藏指示器 DOM 元素
if (viewer.selectionIndicator?.viewModel?.selectionIndicatorElement) {
  viewer.selectionIndicator.viewModel.selectionIndicatorElement.style.display = "none";
}
```

---

## 十、 如何调整场景阴影的明暗程度？

Cesium 支持基于太阳方位的实时级联阴影贴图（Shadow Maps），可为三维建筑实体、倾斜摄影模型和地形地表赋予极具立体感的真实投影。

### 核心配置代码
```javascript
// 1. 开启场景阴影与地形接收阴影
viewer.shadows = true;
viewer.terrainShadows = Cesium.ShadowMode.RECEIVE_ONLY;

// 2. 调节阴影暗度（取值范围 0.0 ~ 1.0）
// 值越小，阴影越深邃浓黑；值越接近 1.0，阴影越浅淡柔和透明
viewer.shadowMap.darkness = 0.8;

// 3. 提高阴影分辨率以消除边缘马赛克狗牙
viewer.shadowMap.size = 2048;

// 4. 开启地表太阳光照
viewer.scene.globe.enableLighting = true;
```

> [!TIP]
> **使物体投射阴影的前提条件**：
> 1. `viewer.shadows = true`；
> 2. 模型的几何体属性中设置了 `shadows: Cesium.ShadowMode.ENABLED`（如本示例代码中的 `box.shadows = Cesium.ShadowMode.ENABLED`）；
> 3. 场景的当前时间必须处于白天（太阳在地平线之上），如果处于深夜或太阳直射头顶正上方，地面将无法观察到斜向长阴影。

---

## 十一、 Cesium 核心基础配置速查表

| 配置分类 | 配置项 / 属性 API | 默认值 | 推荐配置 | 作用说明 |
| :--- | :--- | :--- | :--- | :--- |
| **界面控件** | `creditContainer.style.display` | `'block'` | `'none'` | 隐藏底部版权与 Cesium Logo |
| | `scene.debugShowFramesPerSecond` | `false` | `true/false` | 实时帧率与耗时监控开关 |
| | `scene.skyAtmosphere.show` | `true` | `true/false` | 控制大气层蓝色外发光圈层 |
| **视角交互** | `homeButton.viewModel.command` | 原生全球跳转 | 拦截覆盖 | 自定义 Home 按钮飞往目标项目中心 |
| | `globe.depthTestAgainstTerrain` | `false` | `true` | 开启地表深度检测，防止地下要素穿透地表显示 |
| | `screenSpaceCameraController.enableCollisionDetection` | `false` | `true` | 防止相机视角缩放时穿入地下 |
| | `selectionIndicator` | `true` | `false` | 禁用实体选中时的绿色聚焦方框 |
| | `infoBox` | `true` | `false` | 禁用原生右上角属性气泡信息框 |
| **底图与图层** | `dataSource.show` | `true` | 动态切换 | 控制 KML/GeoJSON/Custom 数据集显隐 |
| | `imageryLayers.get(i).show` | `true` | 动态切换 | 控制栅格底图或注记图层显隐 |
| **光影渲染** | `shadows` | `false` | `true` | 开启三维实体与地形阴影投射 |
| | `shadowMap.darkness` | `0.3` | `0.6 ~ 0.85` | 调节阴影暗度系数（越接近 1 阴影越透明柔和） |

