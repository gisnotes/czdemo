# Cesium 官方示例解读：iTwin 实景高斯泼溅模型（Gaussian Splats）

本文档对应官方 Sandcastle 示例 [Gaussian Splats](https://sandcastle.cesium.com/?id=itwin-gaussian-splats)，演示了如何通过 Cesium 与 Bentley iTwin 平台的整合能力，将前沿的 **3D 高斯泼溅（3D Gaussian Splatting，简称 3DGS）** 实景三维资产以 **3D Tiles** 流式规范挂载到三维地球场景中。

---

## 一、 什么是“高斯泼溅（3DGS）”？为什么在三维 GIS 中是颠覆性的？

### 1. 传统实景三维（摄影测量）的痛点
传统倾斜摄影自动化建模输出的是 **连续三角网格（Triangle Mesh）+ 表面纹理贴图（Texture）**：
- **薄壁、镂空易拉花**：铁塔框架、大坝栏杆、桥梁拉索、树枝等细小几何体，极易出现模型粘连、断裂或严重拉花。
- **高反光与水面空洞**：汽车车窗、建筑物玻璃幕墙、平静水面由于光反射随视角剧烈变化，传统算法难以计算匹配点，导致模型破洞或凹凸不平。
- **数据处理极其繁重**：从空三计算到密集点云匹配、泊松表面重建与纹理映射，流程冗长耗时。

### 2. 3D 高斯泼溅（3DGS）的核心优势
高斯泼溅彻底抛弃了“三角形面片拼接”的传统思路，它用数以百万计的 **三维高斯椭球（3D Gaussians）微粒** 来表征现实世界：
- **微粒自带多维光学属性**：每个高斯点包含三维空间中心坐标（$x, y, z$）、三维协方差椭球形状（缩放与旋转）、不透明度（$\alpha$）以及 **球谐函数（Spherical Harmonics）**。
- **真实还原各向异性光影**：借助球谐系数，同一个物体在不同观察视角下会呈现不同的反光高光与色彩变化。
- **渲染速度极快**：显卡只需将三维椭球投影压扁为 2D 椭圆光斑，并在屏幕上进行泼溅叠加（Splatting）与透明度排序融合，天然契合现代 GPU 的并行光栅化架构。

| 对比维度 | 传统倾斜摄影网格（Triangle Mesh） | 3D 高斯泼溅（3DGS） |
| :--- | :--- | :--- |
| **基础图元** | 三角面片 + 纹理贴图 | 数百万个连续高斯椭球分布 |
| **边缘与植被细节** | 容易拉花、模型模糊、树冠成块状 | 极高保真，树叶间隙、栏杆纤毫毕现 |
| **高反光/透明物体** | 容易破洞、凹陷或几何畸变 | 支持视点相关的各向异性反光，光影真实 |
| **数据流式规范** | 成熟的 3D Tiles（B3DM / glTF） | 新兴扩展：**3D Tiles 1.1 + `KHR_gaussian_splatting`** |

---

## 二、 官方示例的技术突破：3DGS 进入大规模 3D Tiles 流式加载

早期互联网上的 3DGS 演示基本只能在特定的单独 WebGL/WebGPU 播放器中加载独立的 `.ply` 或 `.splat` 文件（单体模型）：
- 无法结合地理空间参考坐标系；
- 一次性把数百兆模型灌入显存，范围稍大就会造成显存溢出（OOM）。

**本示例代表的突破**：
Bentley 与 Cesium 合作，将超大范围的实景高斯泼溅数据进行了**空间八叉树切块分级（LOD）**，遵循 3D Tiles 标准打包：
- 远看加载粗糙层次、近看动态按需下载精细瓦片；
- 返回的实例对象本质上就是一个标准的 `Cesium3DTileset`，能够无缝融合 Cesium 世界地形并参与空间测量与深度拾取。

---

## 三、 代码核心实现原理解读

```js
// 1. 设置 iTwin 平台的免登录共享密钥（ShareKey）
Cesium.ITwinPlatform.defaultShareKey = "...";

// 2. 根据资产 ID 异步创建 3D Tileset
const realityMesh = await Cesium.ITwinData.createTilesetForRealityDataId({
  iTwinId: "04ba725f-f3c0-4f30-8014-a4488cbd612d",
  realityDataId: "4afd5d69-3ba7-491d-86cd-3d86d43db907",
  tilesetOptions: {
    // 3. 微调模型矩阵使其与全球地形精准贴合
    modelMatrix: Cesium.Matrix4.fromTranslation(
      new Cesium.Cartesian3(-1, 9, -8)
    ),
  },
});
viewer.scene.primitives.add(realityMesh);

// 4. 定位相机聚焦至大坝实景模型
viewer.zoomTo(realityMesh, new Cesium.HeadingPitchRange(0, -0.5, 100));
```

### 1. `Cesium.ITwinPlatform.defaultShareKey` 鉴权机制
Bentley 采用基于 JWT（JSON Web Token）的 **ShareKey** 机制。该 Token 内嵌了只读许可范围与有效截止期，允许第三方 Web 应用在无需搭建 OAuth2 认证服务器的前提下安全读取特定实景资产。

### 2. `Cesium.ITwinData.createTilesetForRealityDataId(...)` 底层执行流程
该工厂方法在内部执行了两阶段操作：
1. **元数据鉴权查询**：携带 ShareKey 请求 Bentley 云服务接口 `https://api.bentley.com/reality-management/reality-data/...`，获取该模型对应的根瓦片地址（带有 SAS 安全签名的 Azure Blob Storage 路径）。
2. **实例化 Tileset**：基于获取到的 `tileset.json` 构造 `Cesium3DTileset` 对象，并自动解析其瓦片内的高斯图元。

### 3. 为什么需要 `modelMatrix` 平移向下下沉 8 米（`z: -8`）？
```js
modelMatrix: Cesium.Matrix4.fromTranslation(new Cesium.Cartesian3(-1, 9, -8))
```
- **高程基准差异**：无人机航测生成模型时采用的局部测量坐标基准与 Cesium 全球地形切片（WGS84 椭球面 / EGM96 大地水准面）在绝对垂直高程上通常存在数米的微小误差。
- **贴地优化**：若直接加载，大坝底部可能会悬浮在半空中。通过在 `tilesetOptions.modelMatrix` 传入平移向量将其稍微下移 8 米，可使大坝基座与世界地形网格无缝相融。

---

## 四、 实际生产业务落地指南：如何离线加载自主生产的高斯模型？

在实际项目开发中，通常**不需要依赖 Bentley 云平台**。如果你使用开源软件或商业工具生产了自己的 3DGS 数据：

1. **切片为 3D Tiles 格式**：
   使用支持 3D Tiles 1.1 / `KHR_gaussian_splatting` 扩展的切片工具（或 Cesium ion 网页端上传），将 `.ply` 瓦片化为包含 `tileset.json` 的空间切片目录。
2. **本地静态服务部署**：
   将切片目录放置于项目本地的 `public/models/my-splats/` 或静态文件服务器（Nginx）。
3. **前端标准 API 离线加载**：
   ```js
   const mySplatTileset = await Cesium.Cesium3DTileset.fromUrl(
     "/models/my-splats/tileset.json"
   );
   viewer.scene.primitives.add(mySplatTileset);
   viewer.zoomTo(mySplatTileset);
   ```
   这种方式无需连接任何外网云服务，即可在大屏或内网纯离线环境下平滑展示千万级实景高斯模型。

