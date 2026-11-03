import {
  WebMapTileServiceImageryProvider,
  ImageryLayer,
  WebMercatorTilingScheme,
  GeographicTilingScheme,
  Credit,
} from "cesium";

/**
 * 天地图图层类型映射字典
 * 支持常用中文名称与官方简写代号双向兼容
 */
const LAYER_MAPPING = {
  // 矢量底图与注记
  矢量底图: "vec",
  矢量注记: "cva",
  vec: "vec",
  cva: "cva",

  // 影像底图与注记
  影像底图: "img",
  影像注记: "cia",
  img: "img",
  cia: "cia",

  // 地形晕渲底图与注记
  地形底图: "ter",
  地形晕渲: "ter",
  地形注记: "cta",
  ter: "ter",
  cta: "cta",

  // 全球境界（国界/省界/九段线）
  全球境界: "ibo",
  境界线: "ibo",
  ibo: "ibo",
};

/**
 * 天地图 WMTS 服务管理工具类
 */
export default class Tianditu {
  #baseUrl = "https://t{s}.tianditu.gov.cn/";
  #tk = "11c161d1558ad38a25a080da1ab26784";
  #subdomains = ["0", "1", "2", "3", "4", "5", "6", "7"];

  constructor(tk) {
    if (tk) {
      this.#tk = tk;
    }
  }

  get tk() {
    return this.#tk;
  }

  set tk(val) {
    if (val) this.#tk = val;
  }

  /**
   * 创建天地图 WMTS ImageryProvider 数据源实例
   * @param {string} serviceType - 图层类型（支持 '影像底图' | '影像注记' | '矢量底图' | '矢量注记' | '地形晕渲' | 'img' | 'vec' 等）
   * @param {Object} [options={}] - 自定义扩展配置
   * @param {'w' | 'c'} [options.crs='w'] - 坐标系统投影（'w': Web 墨卡托 EPSG:3857, 'c': CGCS2000 经纬度 EPSG:4490）
   * @param {number} [options.maximumLevel=18] - 最大支持瓦片切片层级
   * @returns {WebMapTileServiceImageryProvider}
   */
  createTiandituService(serviceType, options = {}) {
    const layer = LAYER_MAPPING[serviceType];
    if (!layer) {
      throw new Error(
        `[Tianditu] 未知的服务类型 "${serviceType}"，支持的值: ${Object.keys(LAYER_MAPPING).join(", ")}`
      );
    }

    const {
      crs = "w",
      maximumLevel = 18,
      style = "default",
      format = "tiles",
      credit = new Credit("天地图 GS(2024)0000号"),
      ...providerOptions
    } = options;

    const tileMatrixSet = crs === "c" ? "c" : "w";
    const tileMatrixSetID = crs === "c" ? "c" : "GoogleMapsCompatible";
    const tilingScheme =
      crs === "c"
        ? new GeographicTilingScheme()
        : new WebMercatorTilingScheme();

    const url =
      `${this.#baseUrl}${layer}_${crs}/wmts?` +
      `service=wmts&request=GetTile&version=1.0.0&LAYER=${layer}&tileMatrixSet=${tileMatrixSet}&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&tk=${this.#tk}`;

    return new WebMapTileServiceImageryProvider({
      url,
      layer,
      style,
      format,
      tileMatrixSetID,
      tilingScheme,
      subdomains: this.#subdomains,
      maximumLevel,
      credit,
      ...providerOptions,
    });
  }

  /**
   * 便捷工厂方法：直接创建封装好的 ImageryLayer 实例
   * @param {string} serviceType - 图层类型
   * @param {Object} [providerOptions={}] - Provider 配置参数
   * @param {Object} [layerOptions={}] - ImageryLayer 配置（如 alpha, show, brightness 等）
   * @returns {ImageryLayer}
   */
  createLayer(serviceType, providerOptions = {}, layerOptions = {}) {
    const provider = this.createTiandituService(serviceType, providerOptions);
    return new ImageryLayer(provider, layerOptions);
  }

  /**
   * 便捷工厂方法：成对创建“底图 + 中文注记”图层组合
   * @param {'img' | 'vec' | 'ter' | '影像' | '矢量' | '地形'} type - 图层大类
   * @param {Object} [options={}] - 配置项
   * @returns {[ImageryLayer, ImageryLayer]} 返回 [底图Layer, 注记Layer] 数组
   */
  createLayerGroup(type = "img", options = {}) {
    const normalized = String(type).toLowerCase();
    let baseType = "img";
    let labelType = "cia";

    if (normalized.includes("vec") || normalized.includes("矢量")) {
      baseType = "vec";
      labelType = "cva";
    } else if (normalized.includes("ter") || normalized.includes("地形")) {
      baseType = "ter";
      labelType = "cta";
    }

    const baseLayer = this.createLayer(baseType, options);
    const labelLayer = this.createLayer(labelType, options);
    return [baseLayer, labelLayer];
  }
}
