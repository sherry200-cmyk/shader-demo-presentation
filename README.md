# Shader 入门分享 · Slidev

一套用于周会技术分享的 Slidev 演示文稿，内置「左侧 CodeMirror 编辑器 + 右侧 WebGL 实时预览」的 shader 沙箱，可在幻灯片里现场改代码、即时看效果。

## 运行

```bash
npm install
npm run dev      # 打开 http://localhost:3030
```

## 导出

```bash
npm run build    # 导出静态站点到 dist/（可直接部署）
npm run export   # 导出 PDF（需要按提示安装 playwright-chromium）
```

## 目录结构

```
slides.md                  # 幻灯片主文件（分享内容都在这里）
components/ShaderEditor.vue # 实时 shader 编辑器组件（CodeMirror + WebGL）
lib/glslSandbox.ts         # 极简 WebGL 渲染器（无第三方依赖）
lib/presets.ts             # 3 个预设 shader：渐变 / 星空 / 火焰
```

## 在幻灯片里嵌入编辑器

```md
<ShaderEditor preset="fire" :height="420" />
```

`preset` 可选：`gradient`（渐变）、`starfield`（星空）、`fire`（火焰）。

## 技术要点

- 渲染器自己实现了一个全屏矩形 + 片元着色器的最小 WebGL 管线，自动提供 `u_time` / `u_resolution` / `u_mouse` 三个 uniform（与《The Book of Shaders》一致）。
- 编辑器输入做了 300ms debounce，编译失败时在预览区底部显示 GLSL 错误信息。
- 鼠标在预览区移动会更新 `u_mouse`，可用于交互式 shader。

## 现场演示小贴士

1. 关键画面（渐变 → 星空 → 火焰）用顶部预设按钮一键切换。
2. 建议同时在 [ShaderToy](https://www.shadertoy.com) 存一份备份（`shadertoy.com/embed/...` 可 iframe 嵌入），作为现场 fallback。
