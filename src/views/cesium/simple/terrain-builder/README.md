# Cesium 地形切片构建与发布指南 (Cesium Terrain)

## 一、技术演变与现状评析：Cesium Terrain Builder 过时了吗？

> [!IMPORTANT]
> **结论：是的，原版 `cesium-terrain-builder`（CTB）以及 2018 年前后基于 MSVC 2012 / CMake 源码编译的方案早已严重过时，且在现代高版本 Cesium 中存在诸多硬伤。**

### 1. 为什么说它已经过时？
1. **源码年久失修**：
   - 原版 `geo-data/cesium-terrain-builder` 项目停更近 10 年，仅支持 GDAL 1.x / 2.x，不支持现代 GDAL 3.x+ 高级投影坐标转换。
   - 依赖过期的 MSVC 2012/2015 运行库，在现代 Win10/Win11 及新版 Linux 上极易出现 DLL 缺失或符号冲突。
2. **格式与规范落后**：
   - 默认切片格式为早期 heightmap 灰度高程切片，即使是打过 `quantized-mesh` 补丁的分支，也存在索引文件（`layer.json`）字段缺失、包围盒（BoundingSphere）计算精度误差等问题。
   - 缺乏水面掩膜（WaterMask）、法向量光照（VertexNormals）与元数据扩展支持。
3. **运维与编译成本极高**：
   - 当年需要手动下载源码、配 CMake、找 GDAL 依赖、改 C++ 源码、甚至写 Go 服务（如 `cesium-terrain-server`）来解决 Content-Encoding gzip 响应头问题。
   - 部署笨重，在现代化 CI/CD 与容器化环境中难以维护。

---

## 二、现代主流替代方案对比

在当今 Cesium 生态中，如果要把本地的 DEM 高程栅格（`.tif` / `.img`）切成地形切片并加载，主流方案如下：

| 方案 | 工具/产品 | 特点与优势 | 适用场景与成本 |
| :--- | :--- | :--- | :--- |
| **方案 1：开箱即用现代开源工具** *(强烈推荐)* | **ctb-tile / Docker 镜像**<br>(如 `tumgis/ctb-quantized-mesh`) | 基于 Docker 一键切片，免编译环境；原生支持 `quantized-mesh-1.0` 网格瓦片，自动生成 `layer.json`。 | 自建私网切片工具链的首选，完全免费开源。 |
| **方案 2：高性能生产级切片工具** | **Cesium Lab (本地桌面端)** | 国产老牌切片利器，图形化拖拽操作，切片速度极快，自带静态瓦片服务预览，一键生成标准网格切片。 | 中小项目、个人研发、离线内网项目首选（基础功能免费）。 |
| **方案 3：新一代轻量级开源切片** | **tilers-tools / ctb-tile-v2** | 基于 Python/Rust 开发的高性能并行切片工具，适配 GDAL 3+。 | 自动化构建管道集成。 |
| **方案 4：官方企业级方案** | **Cesium ion / Cesium ion Self-Hosted** | 官方标杆，切片算法最强，支持全球地形无缝拼接与 LOD 智能金字塔。 | 商业化项目、资金充裕团队。 |

---

## 三、现代实践路线一：Docker 一键生成 Quantized-Mesh 地形瓦片

无需安装 Visual Studio、CMake 或繁琐编译 C++，只需本地装好 Docker 即可一条命令完成。

### 1. 准备 DEM 原始数据
确保原始 DEM 为标准 WGS84（EPSG:4326）地理坐标系：
```bash
# 如果 DEM 投影是 UTM 或 Web墨卡托，先用 gdalwarp 转为 4326
gdalwarp -t_srs EPSG:4326 input_dem.tif dem_4326.tif
```

### 2. 使用 Docker 执行切片
```bash
# 启动切片容器（自动切片为 quantized-mesh 格式，并输出到 output_terrain 文件夹）
docker run -it --rm -v D:/gis_data:/data tumgis/ctb-quantized-mesh \
  ctb-tile -f Mesh -C -N -o /data/output_terrain /data/dem_4326.tif

# 生成 layer.json 索引配置文件
docker run -it --rm -v D:/gis_data:/data tumgis/ctb-quantized-mesh \
  ctb-export -f Mesh -o /data/output_terrain
```

> [!TIP]
> - `-f Mesh`：指定输出格式为 `quantized-mesh-1.0`（现代 Cesium 标配三维网格地形）。
> - `-C`：计算包围体与法向量，开启光照阴影效果。
> - `-N`：多线程并行加速。

---

## 四、现代实践路线二：Cesium Lab 图形化快速切片

如果不想使用命令行或 Docker，**Cesium Lab** 是目前国内开发中最便捷的桌面工具：

1. 打开 **Cesium Lab** -> 选择 **数据处理** -> **地形切片**；
2. 拖入你的 `.tif` 高程栅格文件；
3. 输出格式选择 **quantized-mesh**；
4. 勾选 **法线（VertexNormals）**（增强山体立体感）与 **水面掩膜（WaterMask）**；
5. 点击开始处理，片刻后即可在输出目录得到带有 `layer.json`、完整各层级 `.terrain` 瓦片的目录。

---

## 五、现代 HTTP 服务发布（Nginx 静态发布最佳配置）

`quantized-mesh` 瓦片通常默认采用 `gzip` 压缩存储（后缀为 `.terrain`）。早年博客中之所以需要编写 Go/Nodejs 服务，就是为了手动给请求加上 `Content-Encoding: gzip` 响应头。

在现代运维架构中，直接使用标准 **Nginx** 即可高效发布：

```nginx
server {
    listen 8080;
    server_name localhost;

    location /terrain/ {
        alias /data/output_terrain/;
        
        # 允许跨域（Cesium Web 客户端必备）
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, OPTIONS';
        add_header Access-Control-Allow-Headers '*';

        # 为 .terrain 瓦片注入正确的 MIME 类型与 GZIP 解压标记
        types {
            application/vnd.cesium.terrain terrain;
            application/json json;
            application/octet-stream *;
        }

        # 核心关键：当瓦片本身是 gzip 压缩产物时告诉浏览器直接解压
        add_header Content-Encoding gzip;
    }
}
```

---

## 六、现代 CesiumJS 前端接入代码（Cesium 1.107+ 推荐写法）

早期博客中的写法：
```javascript
// ❌ 早年已废弃的写法 (不推荐)
var viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: new Cesium.CesiumTerrainProvider({
    url: "http://localhost:8080/terrain"
  })
});
```

现代标准写法（推荐）：
```javascript
// ✅ 现代 Cesium 1.107+ 异步工厂标准写法
import Cesium from "cesium";

// 方式 1：使用 Cesium.Terrain 工厂（推荐）
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrain: Cesium.Terrain.fromUrl("http://localhost:8080/terrain", {
    requestVertexNormals: true, // 开启法线光照
    requestWaterMask: true      // 开启水面动态波纹
  })
});

// 方式 2：使用 CesiumTerrainProvider.fromUrl 异步创建
Cesium.CesiumTerrainProvider.fromUrl("http://localhost:8080/terrain", {
  requestVertexNormals: true
}).then(terrainProvider => {
  viewer.scene.terrainProvider = terrainProvider;
});

// 开启地形深度检测（防止地下穿模）
viewer.scene.globe.depthTestAgainstTerrain = true;
```

---

## 七、总结与选型建议

1. **学习/开发测试**：直接使用官方提供的全球免费地形 `Cesium.Terrain.fromWorldTerrain()`。
2. **私有化/内网小中型项目**：使用 **Cesium Lab** 图形化一键切片，或使用 **Docker `ctb-quantized-mesh`** 脚本化自动化处理。
3. **服务部署**：直接使用 **Nginx** 静态文件托管配置 `Content-Encoding gzip`，无需再维护老旧且有安全隐患的第三方二进制服务端。

