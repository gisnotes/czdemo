<template>
  <div class="demo-box">
    <el-splitter>
      <!-- 左侧 Cesium 预览区域 (70%) -->
      <el-splitter-panel :size="70" collapsible>
        <div class="preview-container">
          <slot :blocks="resolvedBlocks"></slot>
        </div>
      </el-splitter-panel>

      <!-- 右侧代码/文档展示区域 (30%)：自动识别代码块或 Markdown 文档 -->
      <el-splitter-panel :size="30" collapsible>
        <!-- 只有一个展示块时，直接占满右侧区域 -->
        <component
          v-if="resolvedBlocks.length === 1"
          :is="getViewerComponent(resolvedBlocks[0])"
          v-bind="resolvedBlocks[0]"
        />

        <!-- 多个展示块时垂直平铺分割：主界面占 50%（若含文档）或 75%，其余平分剩余空间 -->
        <el-splitter
          v-else-if="resolvedBlocks.length > 1"
          layout="vertical"
          class="code-vertical-splitter"
        >
          <el-splitter-panel :size="primarySize" collapsible>
            <component
              :is="getViewerComponent(resolvedBlocks[0])"
              v-bind="resolvedBlocks[0]"
            />
          </el-splitter-panel>

          <el-splitter-panel
            v-for="(block, index) in restBlocks"
            :key="block.fileName || index"
            :size="restSize"
            collapsible
          >
            <component :is="getViewerComponent(block)" v-bind="block" />
          </el-splitter-panel>
        </el-splitter>
      </el-splitter-panel>
    </el-splitter>
  </div>
</template>

<script setup name="DemoBox">
import CodeBox from "@/components/CodeBox/index.vue";
import MarkdownBox from "@/components/MarkdownBox/index.vue";

// 预加载所有 Cesium 示例视图及公共工具源码（Data Provider 数据源）
const rawModules = import.meta.glob(
  ["/src/views/cesium/**/*", "/src/utils/**/*"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  }
);

const props = defineProps({
  // 额外需要展示的文件路径列表（如 ['./README.md', '@/utils/cesium.js', '@/utils/gui.js']）
  extraFiles: {
    type: Array,
    default: () => [],
  },
  // 自定义覆盖主文件路径（默认根据当前路由自动推导 index.vue）
  mainFile: {
    type: String,
    default: "",
  },
  // 兼容完整自定义传入的 codeBlocks 数组
  codeBlocks: {
    type: Array,
    default: () => [],
  },
});

const route = useRoute();

// 支持子组件或页面通过 inject('demoBox') 动态注册额外代码块
const injectedBlocks = ref([]);

function registerCodeBlock(block) {
  if (!block) return;
  injectedBlocks.value.push(block);
}

/**
 * 判断某个块是否为 Markdown 文档，自动返回 MarkdownBox 或 CodeBox 组件
 */
function isMarkdownBlock(block) {
  if (!block) return false;
  return (
    block.language === "markdown" ||
    block.language === "md" ||
    (typeof block.fileName === "string" &&
      block.fileName.toLowerCase().endsWith(".md"))
  );
}

function getViewerComponent(block) {
  return isMarkdownBlock(block) ? MarkdownBox : CodeBox;
}

/**
 * 根据文件后缀自动推导语言类型
 */
function inferLanguage(filePath = "") {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const langMap = {
    vue: "html",
    html: "html",
    js: "javascript",
    mjs: "javascript",
    ts: "typescript",
    json: "json",
    scss: "scss",
    css: "css",
    glsl: "glsl",
    md: "markdown",
  };
  return langMap[ext] || "javascript";
}

/**
 * 推导当前路由对应的视图组件相对路径（如 cesium/simple/globe-color/index）
 */
const currentComponentPath = computed(() => {
  if (route?.meta?.componentPath) {
    return route.meta.componentPath.replace(/\.vue$/, "");
  }
  const cleanPath = (route?.path || "").replace(/^\/+|\/+$/g, "");
  return cleanPath ? `cesium/${cleanPath}/index` : "";
});

/**
 * 将相对路径或别名路径统一规范化为 { fileName, rawCode, language }
 */
function normalizeFileEntry(entry) {
  if (typeof entry === "object" && entry !== null) {
    if (entry.rawCode) {
      return {
        fileName: entry.fileName || "index.vue",
        rawCode: entry.rawCode,
        language: entry.language || inferLanguage(entry.fileName),
      };
    }
    if (entry.file) {
      return resolveSourceByPath(entry.file, entry.language);
    }
  }
  if (typeof entry === "string") {
    return resolveSourceByPath(entry);
  }
  return null;
}

function resolveSourceByPath(rawPath, customLang) {
  if (!rawPath) return null;
  let moduleKey = rawPath;
  let displayPath = rawPath;

  if (rawPath.startsWith("@/")) {
    moduleKey = `/src/${rawPath.slice(2)}`;
    displayPath = rawPath;
  } else if (rawPath.startsWith("/src/") || rawPath.startsWith("/docs/")) {
    moduleKey = rawPath;
    displayPath = rawPath.startsWith("/src/")
      ? `@/${rawPath.slice(5)}`
      : rawPath;
  } else if (rawPath.startsWith("./")) {
    const baseDir = currentComponentPath.value
      .split("/")
      .slice(0, -1)
      .join("/");
    moduleKey = `/src/views/${baseDir}/${rawPath.slice(2)}`;
    displayPath = `@/views/${baseDir}/${rawPath.slice(2)}`;
  } else {
    const normalized = rawPath.replace(/^\/+/, "");
    moduleKey = `/src/views/${normalized}`;
    displayPath = `@/views/${normalized}`;
  }

  // 若未带扩展名，依次尝试补全 .vue、.js 或 .md
  if (!rawModules[moduleKey]) {
    if (rawModules[`${moduleKey}.vue`]) {
      moduleKey = `${moduleKey}.vue`;
      displayPath = `${displayPath}.vue`;
    } else if (rawModules[`${moduleKey}.js`]) {
      moduleKey = `${moduleKey}.js`;
      displayPath = `${displayPath}.js`;
    } else if (rawModules[`${moduleKey}.md`]) {
      moduleKey = `${moduleKey}.md`;
      displayPath = `${displayPath}.md`;
    }
  }

  const rawCode = rawModules[moduleKey];
  if (!rawCode) return null;

  return {
    fileName: displayPath,
    rawCode,
    language: customLang || inferLanguage(moduleKey),
  };
}

/**
 * 最终聚合生成的代码/文档块列表（默认仅加载主界面 index.vue，其余文件均需显式指定）
 */
const resolvedBlocks = computed(() => {
  if (props.codeBlocks && props.codeBlocks.length > 0) {
    return props.codeBlocks;
  }

  const list = [];

  // 1. 默认加载当前路由对应的主视图 index.vue 源码
  const mainTarget =
    props.mainFile ||
    (currentComponentPath.value
      ? `@/views/${currentComponentPath.value}.vue`
      : "");
  const mainBlock = resolveSourceByPath(mainTarget, "html");
  if (mainBlock) {
    list.push(mainBlock);
  }

  // 2. 页面通过 extraFiles 属性显式指定的其他关联文件（支持 .md、.js、.vue 等）
  props.extraFiles.forEach((item) => {
    const block = normalizeFileEntry(item);
    if (block && !list.some((b) => b.fileName === block.fileName)) {
      list.push(block);
    }
  });

  // 3. 通过 provide/inject 动态注册的附加块
  injectedBlocks.value.forEach((item) => {
    const block = normalizeFileEntry(item);
    if (block && !list.some((b) => b.fileName === block.fileName)) {
      list.push(block);
    }
  });

  return list;
});

const restBlocks = computed(() => resolvedBlocks.value.slice(1));

// 若包含 Markdown 说明文档，默认上下 50% / 50% 对半展示更便于阅读文档；否则 75% / 25%
const hasMarkdownInRest = computed(() =>
  restBlocks.value.some((block) => isMarkdownBlock(block))
);

const primarySize = computed(() => (hasMarkdownInRest.value ? 50 : 75));

const restSize = computed(() => {
  const count = restBlocks.value.length;
  const remaining = 100 - primarySize.value;
  return count > 0 ? remaining / count : remaining;
});

// 向后代组件提供上下文数据与注册方法（Data Provider Pattern）
provide("demoBox", {
  blocks: resolvedBlocks,
  registerCodeBlock,
});
</script>

<style scoped lang="scss">
$border-color: #ddd;

.demo-box {
  width: 100%;
  height: 100%;
  border: 1px solid $border-color;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.preview-container {
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
}

:deep(.el-splitter) {
  height: 100%;
  width: 100%;
}

:deep(.el-splitter-panel) {
  height: 100%;
  overflow: hidden;
  position: relative;
}

/* 提升分割条与折叠按钮层级，避免被 CodeBox / MarkdownBox 顶部的 .mac-header (z-index: 10) 遮挡 */
:deep(.el-splitter-bar) {
  z-index: 20;
}

:deep(.el-splitter-bar__collapse-icon) {
  z-index: 21;
}

/* 解决水平 el-splitter 在首次挂载阶段 ResizeObserver 尚未触发、两侧面板同时为 flex-basis: 0px 导致 Cesium 初始化时容器宽度为 0 的问题（同时不影响单个面板 collapsible 折叠为 0px） */
:deep(.el-splitter:not(.code-vertical-splitter):has(> .el-splitter-panel:first-of-type[style*="flex-basis: 0px"]):has(> .el-splitter-panel:last-of-type[style*="flex-basis: 0px"])) {
  > .el-splitter-panel:first-of-type {
    flex-basis: 70% !important;
  }
  > .el-splitter-panel:last-of-type {
    flex-basis: 30% !important;
  }
}
</style>
