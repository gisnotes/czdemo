<template>
  <div class="terrain-doc-container">
    <div class="doc-header">
      <div class="header-left">
        <el-tag type="warning" effect="dark" class="doc-badge">技术实践与踩坑总结</el-tag>
        <h2 class="doc-title">Cesium 地形切片构建与发布指南</h2>
      </div>
      <div class="header-right">
        <el-button
          type="primary"
          :plain="isTocCollapsed"
          size="small"
          @click="toggleToc"
        >
          <el-icon style="margin-right: 4px"><List /></el-icon>
          {{ isTocCollapsed ? '展开目录' : '收起目录' }}
        </el-button>
      </div>
    </div>

    <!-- 主展示区：左侧 Markdown 内容 + 右侧目录大纲 -->
    <div class="doc-layout">
      <!-- Markdown 文档内容渲染区域 -->
      <div class="doc-main-panel">
        <MarkdownBox
          ref="markdownBoxRef"
          fileName="CesiumTerrainBuilder.md"
          :rawCode="readmeContent"
          language="markdown"
        />
      </div>

      <!-- 右侧悬浮/常驻大纲目录面板 -->
      <transition name="el-zoom-in-right">
        <aside v-show="!isTocCollapsed" class="doc-toc-panel">
          <div class="toc-header">
            <span class="toc-title">文档目录</span>
            <el-tooltip content="收起目录" placement="top">
              <el-icon class="toc-close-btn" @click="isTocCollapsed = true"><Fold /></el-icon>
            </el-tooltip>
          </div>
          <div class="toc-body">
            <div
              v-for="item in tocList"
              :key="item.id"
              class="toc-item"
              :class="[`level-${item.level}`, { active: activeHeadingId === item.id }]"
              @click="scrollToHeading(item.id)"
            >
              <span class="toc-dot"></span>
              <span class="toc-text" :title="item.title">{{ item.title }}</span>
            </div>
          </div>
        </aside>
      </transition>
    </div>
  </div>
</template>

<script setup name="TerrainBuilderDoc">
import { ref, onMounted, nextTick } from "vue";
import { List, Fold } from "@element-plus/icons-vue";
import MarkdownBox from "@/components/MarkdownBox/index.vue";
import readmeContent from "./README.md?raw";

const isTocCollapsed = ref(false);
const activeHeadingId = ref("");
const markdownBoxRef = ref(null);
const tocList = ref([]);

/**
 * 解析 Markdown 标题生成目录项
 */
function extractToc() {
  const lines = readmeContent.split("\n");
  const list = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim().replace(/[*`_]/g, "");
      const id = title
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
        .replace(/^-+|-+$/g, "");

      list.push({
        id,
        title,
        level,
      });
    }
  }
  tocList.value = list;
}

/**
 * 给渲染出的 Markdown 标题节点注入对应 ID，便于锚点定位
 */
function injectHeadingIds() {
  nextTick(() => {
    const container = document.querySelector(".terrain-doc-container .markdown-body");
    if (!container) return;

    const headingDoms = container.querySelectorAll("h2, h3");
    headingDoms.forEach((h) => {
      const title = h.innerText.trim().replace(/[*`_]/g, "");
      const id = title
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
        .replace(/^-+|-+$/g, "");
      h.id = id;
    });

    if (tocList.value.length > 0 && !activeHeadingId.value) {
      activeHeadingId.value = tocList.value[0].id;
    }
  });
}

function toggleToc() {
  isTocCollapsed.value = !isTocCollapsed.value;
}

function scrollToHeading(id) {
  activeHeadingId.value = id;
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

onMounted(() => {
  extractToc();
  injectHeadingIds();
});
</script>

<style scoped>
.terrain-doc-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 16px 20px 20px;
  background-color: var(--el-bg-color-page, #f8fafc);
  overflow: hidden;
  box-sizing: border-box;
}

.doc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  margin-bottom: 12px;
  background: var(--el-bg-color, #ffffff);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--el-border-color-lighter, #e2e8f0);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.doc-badge {
  font-weight: 600;
  border-radius: 4px;
}

.doc-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--el-text-color-primary, #1e293b);
  letter-spacing: -0.3px;
}

.doc-layout {
  display: flex;
  flex: 1;
  gap: 16px;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.doc-main-panel {
  flex: 1;
  min-width: 0;
  background: var(--el-bg-color, #ffffff);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter, #e2e8f0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  position: relative;
}

.doc-main-panel :deep(.markdown-box) {
  height: 100%;
}

.doc-toc-panel {
  width: 270px;
  flex-shrink: 0;
  background: var(--el-bg-color, #ffffff);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter, #e2e8f0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter, #f1f5f9);
  background: #f8fafc;
}

.toc-title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.toc-close-btn {
  font-size: 16px;
  color: #94a3b8;
  cursor: pointer;
  transition: color 0.2s;
}
.toc-close-btn:hover {
  color: #2563eb;
}

.toc-body {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
}

.toc-item {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  margin-bottom: 2px;
  font-size: 13px;
  color: #475569;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
  line-height: 1.4;
}

.toc-item:hover {
  background-color: #f1f5f9;
  color: #1d4ed8;
}

.toc-item.active {
  background-color: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}

.toc-item.level-2 {
  padding-left: 10px;
  font-weight: 500;
}

.toc-item.level-3 {
  padding-left: 24px;
  font-size: 12.5px;
  color: #64748b;
}

.toc-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: #cbd5e1;
  margin-right: 8px;
  flex-shrink: 0;
  transition: background-color 0.2s;
}

.toc-item.active .toc-dot {
  background-color: #2563eb;
  transform: scale(1.3);
}

.toc-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
