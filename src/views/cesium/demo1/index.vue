<template>
  <div class="app-container cesium-demo-wrap">
    <el-card shadow="never" class="demo-card">
      <template #header>
        <div class="card-header">
          <div class="title-wrap">
            <svg-icon icon-class="international" class="header-icon" />
            <span class="demo-title">Cesium 案例 1：地球基础展示</span>
          </div>
          <el-tag type="success" effect="plain">纯前端免后端运行中</el-tag>
        </div>
      </template>

      <div class="demo-desc">
        <p>
          本分支已转换为<strong>纯前端项目</strong>，去除了后端依赖并开启免登录直达首页模式。
        </p>
        <p>
          当前页面为 Cesium 案例的基础开发容器模版，可在此容器内挂载 <code>Cesium.Viewer</code> 并编写三维地理空间交互代码。
        </p>
      </div>

      <div class="cesium-viewer-box">
        <div id="cesiumContainer" class="cesium-container">
          <div class="placeholder-tip">
            <el-icon :size="48" color="#409eff"><Compass /></el-icon>
            <h3>Cesium Viewer 容器已就绪</h3>
            <p>已预留 <code>#cesiumContainer</code> 挂载点，安装 <code>cesium</code> 依赖后即可直接初始化三维球体。</p>
            <el-button type="primary" plain @click="handleTips">查看如何接入 Cesium</el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 接入说明弹窗 -->
    <el-dialog v-model="dialogVisible" title="Cesium 快速开发指南" width="600px">
      <div class="dialog-content">
        <el-timeline>
          <el-timeline-item timestamp="步骤 1" placement="top" type="primary">
            <el-card>
              <h4>安装 Cesium 依赖</h4>
              <p>在项目根目录下执行：<code>npm install cesium vite-plugin-cesium -D</code></p>
            </el-card>
          </el-timeline-item>
          <el-timeline-item timestamp="步骤 2" placement="top" type="success">
            <el-card>
              <h4>在页面中初始化 Viewer</h4>
              <pre class="code-snippet"><code>import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

onMounted(() => {
  const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: Cesium.createWorldTerrain()
  })
})</code></pre>
            </el-card>
          </el-timeline-item>
          <el-timeline-item timestamp="步骤 3" placement="top" type="warning">
            <el-card>
              <h4>新增更多案例</h4>
              <p>在 <code>src/menu/index.js</code> 中追加案例菜单，并在 <code>src/views/cesium/</code> 新建对应组件即可。</p>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </div>
      <template #footer>
        <el-button type="primary" @click="dialogVisible = false">我知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="CesiumDemo1">
import { ref } from 'vue'
import { Compass } from '@element-plus/icons-vue'

const dialogVisible = ref(false)

function handleTips() {
  dialogVisible.value = true
}
</script>

<style scoped lang="scss">
.cesium-demo-wrap {
  padding: 16px;
  height: calc(100vh - 84px);
  display: flex;
  flex-direction: column;

  .demo-card {
    display: flex;
    flex-direction: column;
    flex: 1;

    :deep(.el-card__body) {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 16px;
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;

      .header-icon {
        font-size: 20px;
        color: #409eff;
      }

      .demo-title {
        font-size: 16px;
        font-weight: 600;
      }
    }
  }

  .demo-desc {
    margin-bottom: 16px;
    font-size: 14px;
    color: var(--el-text-color-regular);
    line-height: 1.6;

    p {
      margin: 4px 0;
    }

    code {
      background: var(--el-fill-color-light);
      padding: 2px 6px;
      border-radius: 4px;
      color: #409eff;
    }
  }

  .cesium-viewer-box {
    flex: 1;
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    border: 1px dashed var(--el-border-color);
    background: var(--el-fill-color-blank);

    .cesium-container {
      width: 100%;
      height: 100%;
      min-height: 480px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .placeholder-tip {
      text-align: center;
      color: var(--el-text-color-secondary);

      h3 {
        margin: 12px 0 8px;
        font-size: 18px;
        color: var(--el-text-color-primary);
      }

      p {
        margin-bottom: 16px;
        font-size: 14px;
      }
    }
  }
}

.code-snippet {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-family: Consolas, Monaco, monospace;
  font-size: 13px;
  line-height: 1.5;
  margin: 8px 0 0;
}
</style>
