<template>
  <div class="markdown-box">
    <!-- 顶部 Mac 风格状态栏（与 CodeBox 保持视觉统一） -->
    <div class="mac-header">
      <div class="dots">
        <span class="mac-dot red"></span>
        <span class="mac-dot yellow"></span>
        <span class="mac-dot green"></span>
      </div>
      <span class="file-name" v-if="fileName">{{ fileName }}</span>
      <div class="header-actions">
        <el-button
          v-if="isSupported"
          :type="copied ? 'success' : 'primary'"
          link
          @click="copy(rawCode)"
        >
          <template #icon>
            <el-icon>
              <Check v-if="copied" />
              <CopyDocument v-else />
            </el-icon>
          </template>
          {{ copied ? "已复制" : "复制" }}
        </el-button>
      </div>
    </div>

    <!-- Markdown 富文本渲染区域 -->
    <div class="markdown-scroll-area">
      <div class="markdown-body" v-html="renderedHtml"></div>
    </div>
  </div>
</template>

<script setup name="MarkdownBox">
import { Marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import { useClipboard } from "@vueuse/core";

const props = defineProps({
  fileName: { type: String, default: "README.md" },
  rawCode: { type: String, required: true },
  language: { type: String, default: "markdown" },
});

const { copy, copied, isSupported } = useClipboard({ legacy: true });

// 配置独立 Marked 实例并接入 highlight.js 代码块高亮
const markedInstance = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }) {
      const validLang = lang && hljs.getLanguage(lang) ? lang : "";
      let highlighted = text;
      try {
        highlighted = validLang
          ? hljs.highlight(text, { language: validLang }).value
          : hljs.highlightAuto(text).value;
      } catch (e) {
        highlighted = text;
      }
      const langLabel = validLang ? `<span class="code-lang">${validLang}</span>` : "";
      return `<pre class="md-code-block">${langLabel}<code class="hljs">${highlighted}</code></pre>`;
    },
  },
});

const renderedHtml = computed(() => {
  if (!props.rawCode) return "";
  try {
    return markedInstance.parse(props.rawCode);
  } catch (e) {
    return `<pre>${props.rawCode}</pre>`;
  }
});
</script>

<style scoped lang="scss">
$bg-color: #1e1e1e;
$header-bg: #2d2d2d;
$border-color: #333;
$text-color: #d4d4d4;
$heading-color: #ffffff;
$muted-color: #9da5b4;
$code-bg: #16181d;

.markdown-box {
  height: 100%;
  background-color: $bg-color;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  & ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  & ::-webkit-scrollbar-track {
    background: transparent;
  }

  & ::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 5px;
    border: 2px solid $bg-color;
    &:hover {
      background: #555;
    }
  }

  & ::-webkit-scrollbar-corner {
    background-color: transparent;
  }

  .mac-header {
    height: 32px;
    flex-shrink: 0;
    background: $header-bg;
    display: flex;
    align-items: center;
    padding: 0 15px;
    z-index: 10;
    position: relative;

    .dots {
      display: flex;
      align-items: center;

      .mac-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        display: inline-block;
        margin-right: 8px;

        &.red {
          background: #ff5f56;
        }
        &.yellow {
          background: #ffbd2e;
        }
        &.green {
          background: #27c93f;
        }
      }
    }

    .file-name {
      flex: 1;
      margin-left: 5px;
      color: #858585;
      font-size: 12px;
      font-family: monospace;
    }

    .header-actions {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      right: 0;
      padding: 0 10px;
      z-index: 10;
      background-color: $header-bg;
    }
  }

  .markdown-scroll-area {
    flex: 1;
    overflow: auto;
    min-height: 0;
    padding: 18px 22px 28px;
  }

  .markdown-body {
    color: $text-color;
    font-size: 14px;
    line-height: 1.7;
    word-wrap: break-word;

    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4) {
      color: $heading-color;
      font-weight: 600;
      margin: 1.2em 0 0.6em;
      line-height: 1.35;
    }

    :deep(h1) {
      font-size: 1.45em;
      margin-top: 0;
      padding-bottom: 0.4em;
      border-bottom: 1px solid $border-color;
    }

    :deep(h2) {
      font-size: 1.2em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    :deep(h3) {
      font-size: 1.05em;
    }

    :deep(p) {
      margin: 0.6em 0;
    }

    :deep(ul),
    :deep(ol) {
      padding-left: 1.5em;
      margin: 0.5em 0;
    }

    :deep(li) {
      margin: 0.25em 0;
    }

    :deep(hr) {
      border: 0;
      border-top: 1px solid $border-color;
      margin: 1.2em 0;
    }

    :deep(blockquote) {
      margin: 0.8em 0;
      padding: 0.4em 1em;
      color: $muted-color;
      border-left: 4px solid #409eff;
      background: rgba(64, 158, 255, 0.08);
      border-radius: 0 4px 4px 0;
    }

    :deep(code:not(.hljs)) {
      font-family: Consolas, Monaco, monospace;
      font-size: 0.9em;
      padding: 0.15em 0.4em;
      border-radius: 4px;
      background-color: rgba(255, 255, 255, 0.1);
      color: #e06c75;
    }

    :deep(pre.md-code-block) {
      position: relative;
      margin: 0.8em 0;
      padding: 12px 14px;
      background-color: $code-bg;
      border: 1px solid #2b2d33;
      border-radius: 6px;
      overflow-x: auto;

      .code-lang {
        position: absolute;
        top: 6px;
        right: 10px;
        font-size: 11px;
        color: #666;
        font-family: monospace;
        user-select: none;
      }

      code.hljs {
        font-family: Consolas, Monaco, monospace;
        font-size: 13px;
        line-height: 1.5;
        background: transparent;
        padding: 0;
      }
    }

    :deep(table) {
      width: 100%;
      border-collapse: collapse;
      margin: 0.8em 0;
      font-size: 13px;

      th,
      td {
        border: 1px solid #383838;
        padding: 8px 12px;
        text-align: left;
      }

      th {
        background-color: #262626;
        color: $heading-color;
        font-weight: 600;
      }

      tr:nth-child(even) {
        background-color: rgba(255, 255, 255, 0.02);
      }
    }

    :deep(a) {
      color: #409eff;
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>

