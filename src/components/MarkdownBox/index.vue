<template>
  <div class="markdown-box">
    <!-- 顶部状态栏 -->
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
      const langLabel = validLang
        ? `<span class="code-lang">${validLang}</span>`
        : "";
      return `<pre class="md-code-block">${langLabel}<code class="hljs">${highlighted}</code></pre>`;
    },
  },
});

/**
 * 修正 CommonMark 在中文环境下当 ** 紧贴中文标点（如 （）、“”、``）与汉字时无法识别加粗的问题
 */
function fixCjkBold(html) {
  return html
    .split(/(<pre[\s\S]*?<\/pre>)/gi)
    .map((segment) => {
      if (segment.startsWith("<pre")) return segment;
      return segment.replace(
        /\*\*(?!\s)([^\n*]+?)(?<!\s)\*\*/g,
        "<strong>$1</strong>"
      );
    })
    .join("");
}

const renderedHtml = computed(() => {
  if (!props.rawCode) return "";
  try {
    const rawHtml = markedInstance.parse(props.rawCode);
    return fixCjkBold(rawHtml);
  } catch (e) {
    return `<pre>${props.rawCode}</pre>`;
  }
});
</script>

<style scoped lang="scss">
$header-bg: #f1f5f9;
$border-color: #e2e8f0;
$text-color: #334155;
$heading-color: #0f172a;
$muted-color: #475569;
$code-bg: #1e222a;

.markdown-box {
  height: 100%;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  & ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  & ::-webkit-scrollbar-track {
    background: transparent;
  }

  & ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
    &:hover {
      background: #94a3b8;
    }
  }

  .mac-header {
    height: 36px;
    flex-shrink: 0;
    background: $header-bg;
    border-bottom: 1px solid $border-color;
    display: flex;
    align-items: center;
    padding: 0 16px;
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
      margin-left: 6px;
      color: #64748b;
      font-size: 12px;
      font-family: Consolas, Monaco, monospace;
    }

    .header-actions {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      right: 0;
      padding: 0 12px;
      z-index: 10;
    }
  }

  .markdown-scroll-area {
    flex: 1;
    overflow: auto;
    min-height: 0;
    padding: 24px 32px 40px;
  }

  .markdown-body {
    max-width: 960px;
    margin: 0 auto;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid $border-color;
    border-radius: 10px;
    padding: 28px 36px;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
    color: $text-color;
    font-size: 14px;
    line-height: 1.75;
    word-wrap: break-word;

    :deep(strong) {
      color: #0f172a;
      font-weight: 700;
    }

    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4) {
      color: $heading-color;
      font-weight: 600;
      margin: 1.3em 0 0.65em;
      line-height: 1.35;
    }

    :deep(h1) {
      font-size: 1.55em;
      margin-top: 0;
      padding-bottom: 0.45em;
      border-bottom: 2px solid $border-color;
    }

    :deep(h2) {
      font-size: 1.25em;
      padding-bottom: 0.35em;
      border-bottom: 1px solid $border-color;
    }

    :deep(h3) {
      font-size: 1.08em;
    }

    :deep(p) {
      margin: 0.65em 0;
    }

    :deep(ul),
    :deep(ol) {
      padding-left: 1.5em;
      margin: 0.55em 0;
    }

    :deep(li) {
      margin: 0.3em 0;
    }

    :deep(hr) {
      border: 0;
      border-top: 1px solid $border-color;
      margin: 1.4em 0;
    }

    :deep(blockquote) {
      margin: 0.9em 0;
      padding: 0.6em 1.2em;
      color: $muted-color;
      border-left: 4px solid #3b82f6;
      background: linear-gradient(90deg, #eff6ff 0%, #f8fafc 100%);
      border-radius: 0 6px 6px 0;
    }

    :deep(code:not(.hljs)) {
      font-family: Consolas, Monaco, monospace;
      font-size: 0.88em;
      padding: 0.18em 0.45em;
      border-radius: 4px;
      background-color: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #d946ef;
    }

    :deep(pre.md-code-block) {
      position: relative;
      margin: 0.9em 0;
      padding: 14px 16px;
      background-color: $code-bg;
      border-radius: 8px;
      overflow-x: auto;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);

      .code-lang {
        position: absolute;
        top: 6px;
        right: 12px;
        font-size: 11px;
        color: #94a3b8;
        font-family: monospace;
        user-select: none;
      }

      code.hljs {
        font-family: Consolas, Monaco, monospace;
        font-size: 13px;
        line-height: 1.55;
        background: transparent;
        padding: 0;
        color: #abb2bf;
      }
    }

    :deep(table) {
      width: 100%;
      border-collapse: collapse;
      margin: 0.9em 0;
      font-size: 13.5px;
      border-radius: 6px;
      overflow: hidden;

      th,
      td {
        border: 1px solid $border-color;
        padding: 10px 14px;
        text-align: left;
      }

      th {
        background-color: #f8fafc;
        color: $heading-color;
        font-weight: 600;
      }

      tr:nth-child(even) {
        background-color: #fcfdff;
      }

      tr:hover {
        background-color: #f1f5f9;
      }
    }

    :deep(a) {
      color: #2563eb;
      text-decoration: none;
      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>
