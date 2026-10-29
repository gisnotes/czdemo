<template>
  <div class="code-box">
    <!-- 顶部状态栏 -->
    <div class="mac-header">
      <div class="dots">
        <span class="mac-dot red"></span>
        <span class="mac-dot yellow"></span>
        <span class="mac-dot green"></span>
      </div>
      <span class="file-name" v-if="fileName">{{ fileName }}</span>
      <div class="copy-btn">
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

    <!-- 主体区域 -->
    <div class="code-main-body">
      <div class="line-numbers-wrapper" ref="lineNumbersRef">
        <div class="line-numbers-col">
          <span v-for="n in lineCount" :key="n" v-memo="[lineCount]">{{
            n
          }}</span>
        </div>
      </div>

      <!-- 右侧代码区 -->
      <div class="code-scroll-area" @scroll="handleScroll">
        <pre
          class="code-content"
          v-html="`<code class='hljs'>${highlightedCode}</code>`"
        ></pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-light.css";
import { useClipboard } from "@vueuse/core";

const props = defineProps({
  fileName: { type: String, default: "index.vue" },
  rawCode: { type: String, required: true },
  language: { type: String, default: "html" },
});

const lineNumbersRef = shallowRef(null);

const { copy, copied, isSupported } = useClipboard({ legacy: true });

const handleScroll = (e) => {
  const el = lineNumbersRef.value;
  if (el) el.scrollTop = e.target.scrollTop;
};

const lineCount = computed(() => {
  const lines = props.rawCode.split("\n");
  return lines[lines.length - 1] === "" ? lines.length - 1 || 1 : lines.length;
});

const highlightedCode = computed(() => {
  try {
    if (props.language && hljs.getLanguage(props.language)) {
      return hljs.highlight(props.rawCode, { language: props.language }).value;
    }
    return hljs.highlightAuto(props.rawCode).value;
  } catch (e) {
    return props.rawCode;
  }
});

onUnmounted(() => {
  lineNumbersRef.value = null;
});
</script>

<style scoped lang="scss">
$code-bg: #ffffff;
$gutter-bg: #f8fafc;
$header-bg: #f1f5f9;
$line-num-color: #94a3b8;
$border-color: #e2e8f0;

.code-box {
  height: 100%;
  background-color: $code-bg;
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

  & ::-webkit-scrollbar-corner {
    background-color: transparent;
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
      font-family: "Maple Mono Normal NF CN", "Maple Mono CN", "Maple Mono", "JetBrains Mono", Consolas, Monaco, monospace;
    }

    .copy-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      right: 0;
      padding: 0 12px;
      z-index: 10;
      background-color: $header-bg;
    }
  }

  /* 主体布局 */
  .code-main-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
    padding-bottom: 6px;

    /* 行号外部容器 */
    .line-numbers-wrapper {
      flex-shrink: 0;
      width: 50px;
      overflow: hidden;
      background-color: $gutter-bg;
      border-right: 1px solid $border-color;

      .line-numbers-col {
        padding: 16px 0 30px 0;
        display: flex;
        flex-direction: column;
        text-align: right;
        user-select: none;

        span {
          padding: 0 12px;
          color: $line-num-color;
          font-family: "Maple Mono Normal NF CN", "Maple Mono CN", "Maple Mono", "JetBrains Mono", Consolas, Monaco, monospace;
          font-size: 13.5px;
          line-height: 1.6;
        }
      }
    }
    /* 代码滚动区域 */
    .code-scroll-area {
      flex: 1;
      overflow: auto;
      background-color: $code-bg;
      min-width: 0;

      .code-content {
        margin: 0;
        padding: 16px 20px;
        width: max-content;
        min-width: 100%;

        :deep(code.hljs) {
          font-family: "Maple Mono Normal NF CN", "Maple Mono CN", "Maple Mono", "JetBrains Mono", Consolas, Monaco, monospace;
          font-size: 13.5px;
          line-height: 1.6;
          display: block;
          background: transparent;
          color: #383a42;
          padding: 0;
          white-space: pre;
        }
      }
    }
  }
}
</style>

