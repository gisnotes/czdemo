# DemoBox、CodeBox 与 MarkdownBox 组件使用说明

## 1. 设计背景与架构（Left Tabs + Data Provider Pattern）

在 Cesium 示例展示系统中，`DemoBox` 采用 **左侧垂直标签页（`el-tabs` `tab-position="left"`）+ 数据提供者模式（Data Provider Pattern）**，将每个示例页面划分为三个全屏切换的独立视图：

1. **示例运行界面（`preview`）**：100% 占满右侧主视口，展示 Cesium 三维地球交互效果。
2. **代码（`code`）**：展示当前示例主界面 `index.vue` 源码（及通过 `extra-files` 指定的附加代码文件）。
3. **笔记（`note`）**：自动加载并渲染当前示例同级目录下的 `README.md` 总结笔记。

| 组件 | 路径 | 角色定位 | 核心职责 |
| :--- | :--- | :--- | :--- |
| **`DemoBox`** | `src/components/DemoBox/index.vue` | **Data Provider & 标签页容器** | 已全局注册。负责自动推导并加载当前路由主界面 `index.vue` 源码、自动匹配同级目录下的 `README.md` 笔记、按需加载显式指定的附加代码文件，并通过左侧标签页切换展示。 |
| **`CodeBox`** | `src/components/CodeBox/index.vue` | **Consumer & 代码高亮组件** | 在【代码】标签页中渲染单文件 Mac 风格状态栏、行号同步滚动、`highlight.js` 语法高亮与一键复制。 |
| **`MarkdownBox`** | `src/components/MarkdownBox/index.vue` | **Consumer & 笔记渲染组件** | 在【笔记】标签页中基于 `marked` + `highlight.js` 渲染暗色主题的富文本文档、表格与高亮代码块。 |

---

## 2. 核心特性

1. **零配置自动加载（代码 + 笔记）**
   - `DemoBox` 已在 `src/main.js` 中全局注册，页面无需手动 `import`。
   - 默认不传任何属性时（`<demo-box>`）：
     - **【代码】标签页**：自动根据当前路由加载主界面 `index.vue` 的源码。
     - **【笔记】标签页**：自动检测当前示例目录下是否存在 `README.md`，若存在则自动用 `MarkdownBox` 渲染为富文本笔记；若不存在则展示空状态提示。
2. **全屏视口，无需 `setTimeout`**
   - 【示例运行界面】作为默认激活的第一个标签页，挂载时即拥有完整的视口宽高，直接在 `onMounted()` 中同步调用 `createViewer(containerRef.value)` 即可。
   - 【代码】和【笔记】标签页均启用了 `lazy` 懒渲染，首次打开页面时只渲染三维场景，切换标签页时再渲染代码高亮与 Markdown 文档，首屏性能更好。

---

## 3. 使用方式示例

### 场景一：默认零配置（自动加载 `index.vue` 代码与同级 `README.md` 笔记）

在示例目录下编写 `index.vue` 和 `README.md`（可选），模板中直接包裹 `<demo-box>` 即可：

```vue
<template>
  <demo-box>
    <div ref="containerRef" class="cesium-page-container"></div>
  </demo-box>
</template>

<script setup name="GlobeMaterial">
import { useTemplateRef, onMounted, onBeforeUnmount } from "vue";
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

### 场景二：在【代码】标签页中指定额外代码文件（`extra-files`）

如果当前示例除了主界面 `index.vue` 之外，还希望在【代码】标签页中一并展示公共工具类（如 `@/utils/cesium.js`、`@/utils/gui.js`）或同级子模块（如 `./customShader.js`），通过 `extra-files` 传入路径数组即可（【代码】标签页顶部会自动生成 VS Code 风格的水平文件标签栏，点击可依次切换查看各个文件源码）：

```vue
<template>
  <demo-box :extra-files="['@/utils/cesium.js', '@/utils/gui.js']">
    <div ref="containerRef" class="cesium-page-container"></div>
  </demo-box>
</template>
```

---

### 场景三：自定义标签栏方向或自定义笔记文件路径

```vue
<template>
  <demo-box tab-position="left" note-file="./notes.md">
    <div ref="containerRef" class="cesium-page-container"></div>
  </demo-box>
</template>
```

---

## 4. API 参考

### `DemoBox` Props

| 属性名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `tabPosition` (`tab-position`) | `'left' \| 'right' \| 'top' \| 'bottom'` | `'left'` | 标签页导航栏位置 |
| `defaultTab` (`default-tab`) | `'preview' \| 'code' \| 'note'` | `'preview'` | 默认激活的标签页 |
| `extraFiles` (`extra-files`) | `Array<string \| Object>` | `[]` | 【代码】标签页额外需要展示的文件路径列表（支持 `@/xxx` 或 `./xxx`） |
| `mainFile` (`main-file`) | `string` | `""` | 手动指定主代码文件路径（不传则自动根据当前路由匹配 `index.vue`） |
| `noteFile` (`note-file`) | `string` | `"./README.md"` | 笔记 Markdown 文件路径（默认自动查找同级目录下的 `README.md`） |
| `codeBlocks` (`code-blocks`) | `Array<{ fileName, rawCode, language }>` | `[]` | 完全自定义覆盖代码块列表 |
