# DemoBox 与 CodeBox 组件使用说明

## 1. 设计背景与架构（Data Provider Pattern）

在 Cesium 示例展示系统中，每个示例页面通常需要**左侧展示三维地球交互视图（70%）**、**右侧展示关联源码（30%）**。

为了避免在每个示例页面重复编写 `import ... from './index.vue?raw'`、`import DemoBox`、`const codeBlocks = ref([...])` 以及因 `el-splitter` 初始挂载宽度为 `0px` 而在 `onMounted` 中编写 `setTimeout` 的繁琐样板代码，我们将组件精简为 **2 个核心组件**，并采用 **Vue 数据提供者模式（Data Provider Pattern）**：

| 组件 | 路径 | 角色定位 | 核心职责 |
| :--- | :--- | :--- | :--- |
| **`DemoBox`** | `src/components/DemoBox/index.vue` | **Data Provider & 布局容器** | 已全局注册。负责自动推导并加载当前路由主界面 `index.vue` 源码、按需加载显式指定的附加文件、管理水平/垂直分栏布局，并通过 `provide` / `slot` / `props` 分发代码块数据。 |
| **`CodeBox`** | `src/components/CodeBox/index.vue` | **Consumer & 展示组件** | 负责单文件 Mac 风格状态栏、行号同步滚动、`highlight.js` 语法高亮与一键复制。 |

---

## 2. 核心特性

1. **默认只加载主界面 `index.vue`，其余文件按需指定**
   - `DemoBox` 已在 `src/main.js` 中全局注册，页面无需手动 `import`。
   - 默认不传任何属性时（`<demo-box>`），组件会结合当前路由元信息 `route.meta.componentPath` **仅自动加载当前主界面 `index.vue` 的源码**并占满右侧代码区。
   - 如需展示其他文件（如 `@/utils/cesium.js`、`@/utils/gui.js` 或同级目录文件 `./shader.glsl`），只需通过 `:extra-files` 等方式显式指定路径即可。

2. **无需 `setTimeout` 延迟初始化 Cesium**
   - `DemoBox` 内置了针对 `el-splitter` 首次同步挂载阶段（`ResizeObserver` 尚未触发、`flex-basis: 0px`）的宽度兜底样式（左 70% / 右 30%）。
   - 页面可直接在 `onMounted()` 中同步调用 `createViewer(containerRef.value)`，无需包裹 `setTimeout` 与 `clearTimeout`。

3. **智能分栏排版**
   - 当只有默认的 **1 个**主界面代码块时，`CodeBox` 直接占满右侧 100% 高度。
   - 当指定了附加文件（共 **多个**代码块）时，主界面 `index.vue` 默认占右侧 **75%** 高度，其余指定文件平分剩余 **25%** 高度，支持上下拖拽调整比例。

---

## 3. 使用方式示例

### 场景一：默认零配置（仅展示当前主界面 `index.vue`）

直接包裹 `<demo-box>`，不传任何参数，右侧将全屏展示当前页面 `index.vue` 的源码：

```vue
<template>
  <demo-box>
    <div ref="containerRef" class="cesium-page-container"></div>
  </demo-box>
</template>

<script setup name="GlobeColor">
import { useTemplateRef, onMounted, onBeforeUnmount } from "vue";
import Cesium from "cesium";
import { createViewer, optimizeViewerQuality } from "@/utils/cesium";

const containerRef = useTemplateRef("containerRef");
let viewer = null;

onMounted(() => {
  viewer = createViewer(containerRef.value);
  optimizeViewerQuality(viewer);
});

onBeforeUnmount(() => {
  if (viewer && !viewer.isDestroyed()) {
    viewer.destroy();
    viewer = null;
  }
});
</script>
```

---

### 场景二：指定额外需要展示的文件（`extra-files`）

如果当前示例除了主界面 `index.vue` 之外，还需要展示公共工具类（如 `@/utils/cesium.js`、`@/utils/gui.js`）或同级子模块（如 `./customShader.js`），通过 `extra-files` 传入文件路径数组即可（支持 `@/` 别名路径和 `./` 相对当前页面目录路径，自动根据后缀名识别语法高亮语言）：

```vue
<template>
  <demo-box :extra-files="['@/utils/cesium.js', '@/utils/gui.js']">
    <div ref="containerRef" class="cesium-page-container"></div>
  </demo-box>
</template>
```

同级目录下的文件也可以直接用 `./` 指定：

```vue
<template>
  <demo-box :extra-files="['./shader.glsl', './helper.js']">
    <div ref="containerRef" class="cesium-page-container"></div>
  </demo-box>
</template>
```

---

### 场景三：通过 `provide / inject` 动态注册附加代码块

在子组件或脚本逻辑中，也可以通过 `inject('demoBox')` 获取上下文并动态指定额外文件或代码块：

```js
import { inject } from "vue";

const demoBox = inject("demoBox", null);

// 方式 A：直接传入文件路径，由 DemoBox 自动解析源码
demoBox?.registerCodeBlock("@/utils/cesium.js");

// 方式 B：传入自定义生成的代码块对象
demoBox?.registerCodeBlock({
  fileName: "config.json",
  rawCode: JSON.stringify({ msaa: 4 }, null, 2),
  language: "json",
});
```

---

### 场景四：完全自定义 `codeBlocks`（兼容旧写法）

若需要完全接管右侧展示的所有代码块（不自动加载当前路由的 `index.vue`），可直接传入 `:code-blocks` 数组：

```vue
<template>
  <demo-box :code-blocks="customBlocks">
    <div ref="containerRef" class="cesium-page-container"></div>
  </demo-box>
</template>

<script setup>
const customBlocks = [
  {
    fileName: "custom.js",
    rawCode: "const viewer = new Cesium.Viewer('container');",
    language: "javascript",
  },
];
</script>
```

---

## 4. API 参考

### `DemoBox` Props

| 属性名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `extraFiles` (`extra-files`) | `Array<string \| Object>` | `[]` | 额外需要展示的文件路径列表（支持 `@/xxx` 或 `./xxx`）或代码块对象 |
| `mainFile` (`main-file`) | `string` | `""` | 手动指定主文件路径（不传则自动根据当前路由匹配 `index.vue`） |
| `codeBlocks` (`code-blocks`) | `Array<{ fileName, rawCode, language }>` | `[]` | 完全自定义覆盖代码块列表（传入非空数组时优先使用该列表） |

### `DemoBox` Slots

| 插槽名 | 作用域参数 | 说明 |
| :--- | :--- | :--- |
| `default` | `{ blocks }` | 左侧 70% 预览容器内容区域，可通过作用域插槽拿到当前解析后的 `blocks` 列表 |

### `DemoBox` Provide 上下文 (`inject('demoBox')`)

| 字段 / 方法 | 类型 | 说明 |
| :--- | :--- | :--- |
| `blocks` | `ComputedRef<Array>` | 当前已解析的所有代码块响应式数组 |
| `registerCodeBlock` | `(entry: string \| Object) => void` | 动态追加一个文件路径或 `{ fileName, rawCode, language }` 代码块 |

### `CodeBox` Props

| 属性名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `fileName` | `string` | `"index.vue"` | 顶部状态栏展示的文件名称 |
| `rawCode` | `string` | **必填** | 原始代码字符串 |
| `language` | `string` | `"html"` | `highlight.js` 语法高亮语言（如 `html`、`javascript`、`json`、`scss`、`glsl`、`markdown`） |
