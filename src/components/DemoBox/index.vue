<template>
  <div class="demo-box">
    <el-tabs
      v-model="activeTab"
      :tab-position="tabPosition"
      type="card"
      class="demo-tabs"
    >
      <!-- Tab 1：示例运行界面 -->
      <el-tab-pane name="preview" label="示例运行界面">
        <div class="preview-container">
          <slot :blocks="resolvedCodeBlocks" :note="resolvedNoteBlock"></slot>
        </div>
      </el-tab-pane>

      <!-- Tab 2：代码（支持单文件或水平 Tabs 依次切换展示 extraFiles） -->
      <el-tab-pane name="code" label="代码" lazy>
        <div class="tab-full-panel">
          <!-- 仅单文件时直接全屏展示 -->
          <CodeBox
            v-if="resolvedCodeBlocks.length === 1"
            v-bind="resolvedCodeBlocks[0]"
          />

          <!-- 多文件时采用顶部水平 Tabs 依次展示主文件与 extraFiles -->
          <el-tabs
            v-else-if="resolvedCodeBlocks.length > 1"
            v-model="activeCodeFile"
            tab-position="top"
            type="card"
            class="code-file-tabs"
          >
            <el-tab-pane
              v-for="(block, index) in resolvedCodeBlocks"
              :key="block.fileName || index"
              :name="block.fileName || String(index)"
              :label="formatTabLabel(block.fileName, index)"
              lazy
            >
              <CodeBox v-bind="block" />
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-tab-pane>

      <!-- Tab 3：笔记 -->
      <el-tab-pane name="note" label="笔记" lazy>
        <div class="tab-full-panel">
          <MarkdownBox v-if="resolvedNoteBlock" v-bind="resolvedNoteBlock" />
          <div v-else class="empty-note">
            <el-empty
              description="当前示例暂无笔记文档（可在示例目录下创建 README.md）"
            />
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup name="DemoBox">
import CodeBox from "@/components/CodeBox/index.vue";
import MarkdownBox from "@/components/MarkdownBox/index.vue";

// 预加载所有 Cesium 示例视图、Markdown 笔记及公共工具源码（Data Provider 数据源）
const rawModules = import.meta.glob(
  ["/src/views/cesium/**/*", "/src/utils/**/*"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

const props = defineProps({
  // 外层主标签页位置：'left' | 'right' | 'top' | 'bottom'
  tabPosition: {
    type: String,
    default: "right",
  },
  // 默认激活的主标签页：'preview' | 'code' | 'note'
  defaultTab: {
    type: String,
    default: "preview",
  },
  // 额外需要展示在【代码】水平标签页中的文件路径列表（如 ['@/utils/cesium.js', '@/utils/gui.js']）
  extraFiles: {
    type: Array,
    default: () => [],
  },
  // 自定义覆盖主代码文件路径（默认根据当前路由自动推导 index.vue）
  mainFile: {
    type: String,
    default: "",
  },
  // 自定义覆盖笔记文件路径（默认自动查找当前示例同级目录下的 ./README.md）
  noteFile: {
    type: String,
    default: "./README.md",
  },
  // 兼容完整自定义传入的 codeBlocks 数组
  codeBlocks: {
    type: Array,
    default: () => [],
  },
});

const activeTab = ref(props.defaultTab);
const activeCodeFile = ref("");
const route = useRoute();

// 支持子组件或页面通过 inject('demoBox') 动态注册额外代码块
const injectedBlocks = ref([]);

function registerCodeBlock(block) {
  if (!block) return;
  injectedBlocks.value.push(block);
}

/**
 * 格式化水平代码标签页的标题（提取文件名展示，更加简洁直观）
 */
function formatTabLabel(fileName = "", index = 0) {
  if (!fileName) return `文件 ${index + 1}`;
  const parts = fileName.split("/");
  return parts[parts.length - 1] || fileName;
}

/**
 * 判断某个块是否为 Markdown 文档
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
  } else if (rawPath.startsWith("/src/")) {
    moduleKey = rawPath;
    displayPath = `@/${rawPath.slice(5)}`;
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
 * 解析【代码】标签页展示的代码块列表（过滤掉 .md 文件）
 */
const resolvedCodeBlocks = computed(() => {
  if (props.codeBlocks && props.codeBlocks.length > 0) {
    return props.codeBlocks.filter((b) => !isMarkdownBlock(b));
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

  // 2. 页面通过 extraFiles 显式指定的额外代码文件
  props.extraFiles.forEach((item) => {
    const block = normalizeFileEntry(item);
    if (
      block &&
      !isMarkdownBlock(block) &&
      !list.some((b) => b.fileName === block.fileName)
    ) {
      list.push(block);
    }
  });

  // 3. 通过 provide/inject 动态注册的附加代码块
  injectedBlocks.value.forEach((item) => {
    const block = normalizeFileEntry(item);
    if (
      block &&
      !isMarkdownBlock(block) &&
      !list.some((b) => b.fileName === block.fileName)
    ) {
      list.push(block);
    }
  });

  return list;
});

watchEffect(() => {
  const blocks = resolvedCodeBlocks.value;
  if (
    blocks.length > 0 &&
    !blocks.some((b) => b.fileName === activeCodeFile.value)
  ) {
    activeCodeFile.value = blocks[0].fileName || "0";
  }
});

/**
 * 解析【笔记】标签页展示的 Markdown 文档（默认自动查找同级目录下的 ./README.md）
 */
const resolvedNoteBlock = computed(() => {
  // 1. 若 extraFiles 中显式传入了 .md 文件，优先使用
  for (const item of props.extraFiles) {
    const block = normalizeFileEntry(item);
    if (block && isMarkdownBlock(block)) {
      return block;
    }
  }

  // 2. 默认自动匹配当前示例目录下的 README.md（或 props.noteFile）
  if (props.noteFile) {
    return resolveSourceByPath(props.noteFile, "markdown");
  }

  return null;
});

// 向后代组件提供上下文数据与注册方法（Data Provider Pattern）
provide("demoBox", {
  activeTab,
  activeCodeFile,
  blocks: resolvedCodeBlocks,
  note: resolvedNoteBlock,
  registerCodeBlock,
});
</script>

<style scoped lang="scss">
.demo-box {
  width: 100%;
  height: calc(100vh - 84px);
  overflow: hidden;
  background-color: var(--el-bg-color, #fff);
}

.demo-tabs {
  width: 100%;
  height: 100%;

  :deep(> .el-tabs__header.is-left) {
    margin-right: 0;
    background-color: var(--el-fill-color-blank, #fff);
    border-right: 1px solid var(--el-border-color-light, #e4e7ed);
    padding-top: 8px;
  }

  :deep(> .el-tabs__header.is-left .el-tabs__item.is-left) {
    text-align: right;
    padding: 0 18px;
    height: 44px;
    line-height: 44px;
    font-size: 14px;
  }

  :deep(> .el-tabs__content) {
    height: 100%;
    padding: 0;
    overflow: hidden;

    > .el-tab-pane {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }
  }
}

.preview-container,
.tab-full-panel {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

/* 代码区顶部水平多文件切换 Tabs 样式（贴合暗色编辑器风格） */
.code-file-tabs {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1e1e1e;

  :deep(> .el-tabs__header) {
    margin: 0;
    background-color: #252526;
    border-bottom: 1px solid #1e1e1e;
    flex-shrink: 0;

    .el-tabs__nav {
      border: none;
    }

    .el-tabs__item {
      height: 36px;
      line-height: 36px;
      color: #969696;
      background-color: #2d2d2d;
      border: none;
      border-right: 1px solid #1e1e1e;
      font-family: Consolas, Monaco, monospace;
      font-size: 13px;
      padding: 0 18px;
      transition: all 0.15s;

      &:hover {
        color: #ffffff;
      }

      &.is-active {
        color: #ffffff;
        background-color: #1e1e1e;
        border-top: 2px solid #409eff;
      }
    }
  }

  :deep(> .el-tabs__content) {
    flex: 1;
    min-height: 0;
    padding: 0;
    overflow: hidden;

    > .el-tab-pane {
      width: 100%;
      height: 100%;
    }
  }
}

.empty-note {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%);
}
</style>
