<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { StreamLanguage } from '@codemirror/language';
import { cpp } from '@codemirror/legacy-modes/mode/clike';
import { oneDark } from '@codemirror/theme-one-dark';
import { GlslSandbox } from '../lib/glslSandbox';
import { PRESETS, getPreset } from '../lib/presets';

const props = withDefaults(
  defineProps<{
    preset?: string; // 初始预设：gradient | starfield | fire | ...
    height?: number; // 组件高度（px）
    only?: string[]; // 只显示这些预设的切换按钮（不传则显示全部）
    codeRatio?: number; // 初始代码区占比（0~1）：0 = 只看效果，1 = 只看代码
  }>(),
  { preset: 'gradient', height: 420, only: undefined, codeRatio: 0.56 },
);

// 工具栏只展示需要的预设按钮，避免按钮太多
const visiblePresets = computed(() =>
  props.only ? PRESETS.filter((p) => props.only!.includes(p.key)) : PRESETS,
);

const editorEl = ref<HTMLDivElement>();
const canvasEl = ref<HTMLCanvasElement>();
const bodyEl = ref<HTMLDivElement>();
const error = ref('');
const activeKey = ref(props.preset);

// 代码区占比（0~1）：0 = 只看效果，1 = 只看代码
const DEFAULT_RATIO = 0.56;
const ratio = ref(props.codeRatio);
let dragging = false;

function startDrag(e: MouseEvent) {
  e.preventDefault();
  dragging = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
}
function onDrag(e: MouseEvent) {
  if (!dragging || !bodyEl.value) return;
  const rect = bodyEl.value.getBoundingClientRect();
  const r = (e.clientX - rect.left) / rect.width;
  ratio.value = Math.max(0, Math.min(1, r));
}
function stopDrag() {
  dragging = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
}
function resetRatio() {
  ratio.value = DEFAULT_RATIO;
}

const view = shallowRef<EditorView>();
const sandbox = shallowRef<GlslSandbox>();

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function applyShader(code: string) {
  const sb = sandbox.value;
  if (!sb) return;
  const res = sb.load(code);
  error.value = res.ok ? '' : (res.error ?? '编译失败');
}

function onDocChange(code: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => applyShader(code), 300);
}

function loadPreset(key: string) {
  activeKey.value = key;
  const code = getPreset(key).source;
  const v = view.value;
  if (v) {
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: code } });
  }
  applyShader(code);
}

function onCanvasMouseMove(e: MouseEvent) {
  const sb = sandbox.value;
  const canvas = canvasEl.value;
  if (!sb || !canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // WebGL 原点在左下角，y 翻转
  sb.setMouse((e.clientX - rect.left) * dpr, (rect.bottom - e.clientY) * dpr);
}

const isFullscreen = ref(false);
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false;
  }
}

onMounted(() => {
  const initial = getPreset(props.preset).source;

  view.value = new EditorView({
    doc: initial,
    parent: editorEl.value,
    extensions: [
      basicSetup,
      StreamLanguage.define(cpp), // 用 C/C++ 模式近似高亮 GLSL
      oneDark,
      EditorView.theme({
        '&': { height: '100%', fontSize: '13px' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, monospace' },
      }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onDocChange(u.state.doc.toString());
      }),
    ],
  });

  try {
    sandbox.value = new GlslSandbox(canvasEl.value!);
    applyShader(initial);
    sandbox.value.start();
  } catch (e) {
    error.value = (e as Error).message;
  }

  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
  sandbox.value?.dispose();
  view.value?.destroy();
});
</script>

<template>
  <div
    class="shader-editor"
    :class="{ 'se-fullscreen': isFullscreen }"
    :style="isFullscreen ? undefined : { height: `${props.height}px` }"
  >
    <div class="se-toolbar">
      <button
        v-for="p in visiblePresets"
        :key="p.key"
        class="se-btn"
        :class="{ active: activeKey === p.key }"
        @click="loadPreset(p.key)"
      >
        {{ p.label }}
      </button>
      <span class="se-hint">改一个数字，画面立刻变 →</span>
      <button class="se-fs-btn" @click="toggleFullscreen">
        {{ isFullscreen ? '✕ 退出全屏 (Esc)' : '⛶ 全屏' }}
      </button>
    </div>

    <div ref="bodyEl" class="se-body">
      <div ref="editorEl" class="se-code" :style="{ flex: ratio }" />
      <div
        class="se-divider"
        title="拖动调整代码/效果比例 · 双击复位"
        @mousedown="startDrag"
        @dblclick="resetRatio"
      />
      <div class="se-preview" :style="{ flex: 1 - ratio }">
        <canvas ref="canvasEl" class="se-canvas" @mousemove="onCanvasMouseMove" />
        <div v-if="error" class="se-error">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shader-editor {
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid #2a2a3a;
  border-radius: 8px;
  overflow: hidden;
  background: #1e1e2e;
}
/* 全屏：铺满整个视口，代码和预览都放到最大 */
.se-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  width: 100vw;
  height: 100vh;
  border-radius: 0;
}
.se-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #181825;
  border-bottom: 1px solid #2a2a3a;
}
.se-btn {
  padding: 3px 12px;
  font-size: 13px;
  color: #cdd6f4;
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.se-btn:hover {
  background: #45475a;
}
.se-btn.active {
  background: #f38ba8;
  color: #11111b;
  border-color: #f38ba8;
  font-weight: 600;
}
.se-hint {
  margin-left: auto;
  font-size: 12px;
  color: #6c7086;
}
.se-fs-btn {
  padding: 3px 10px;
  font-size: 12px;
  color: #cdd6f4;
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.se-fs-btn:hover {
  background: #585b70;
}
.se-body {
  display: flex;
  flex: 1;
  min-height: 0;
}
.se-code {
  height: 100%;
  min-width: 0;
  overflow: auto;
}
.se-divider {
  flex: 0 0 6px;
  height: 100%;
  cursor: col-resize;
  background: #2a2a3a;
  transition: background 0.15s;
}
.se-divider:hover {
  background: #585b70;
}
.se-preview {
  position: relative;
  min-width: 0;
  height: 100%;
  background: #000;
}
.se-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.se-error {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 50%;
  overflow: auto;
  padding: 8px 10px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.4;
  color: #f38ba8;
  background: rgba(17, 17, 27, 0.92);
  white-space: pre-wrap;
}
</style>
