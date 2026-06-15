// 三个预设 shader，对应分享的三个递进阶段：渐变 → 星空 → 火焰。
// 全部使用《The Book of Shaders》风格：u_time / u_resolution / u_mouse + main + gl_FragColor。

export interface Preset {
  key: string;
  label: string;
  source: string;
}

const gradient = `precision mediump float;

uniform vec2  u_resolution; // 画布尺寸
uniform float u_time;       // 时间（秒）

void main() {
  // 当前像素在 0~1 区间的坐标
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  // 位置即颜色：x→红，y→绿，蓝色随时间呼吸
  vec3 color = vec3(uv.x, uv.y, abs(sin(u_time)));

  gl_FragColor = vec4(color, 1.0);
}`;

const starfield = `precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;

// GPU 里没有 random()，用一行 sin 制造伪随机
float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  uv.x *= u_resolution.x / u_resolution.y; // 修正宽高比，星星不被拉扁

  // 把屏幕切成网格，每格决定一颗星
  vec2 grid = uv * 40.0;
  vec2 id   = floor(grid);
  vec2 gv   = fract(grid) - 0.5;

  float r = random(id);
  float star = step(0.92, r);                       // 只有约 8% 的格子有星星
  float twinkle = 0.5 + 0.5 * sin(u_time * 3.0 + random(id + 1.0) * 6.2831); // 闪烁
  float d = length(gv);                             // 到格子中心的距离
  float brightness = star * smoothstep(0.25, 0.0, d) * twinkle;

  vec3 color = vec3(brightness);
  color += vec3(0.02, 0.03, 0.2) * (1.0 - uv.y);   // 夜空背景渐变

  gl_FragColor = vec4(color, 1.0);
}`;

const fire = `precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;

float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// value noise：平滑的随机（自然界的云、火、烟都靠它）
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// FBM：多层噪声叠加，细节更丰富
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  vec2 q = uv;
  q.x *= 2.0;
  // 噪声随时间向上流动 → 火苗往上窜
  float n = fbm(q * 3.0 + vec2(0.0, -u_time * 1.5));

  // 底部强、顶部弱
  float flame = n * (1.0 - uv.y) * 1.8;

  // 颜色梯度：黑 → 暗红 → 橙 → 黄
  vec3 color = vec3(0.0);
  color += vec3(1.5, 0.0, 0.0) * smoothstep(0.0, 0.5, flame);
  color += vec3(1.0, 0.6, 0.0) * smoothstep(0.3, 0.8, flame);
  color += vec3(1.0, 1.0, 0.6) * smoothstep(0.6, 1.0, flame);

  gl_FragColor = vec4(color, 1.0);
}`;

// ===== 火焰「四步搭建」：每一步只比上一步多一点点，让观众亲眼看它长出来 =====

// 这段 random / noise / fbm 是四步共用的「底料工具」，每页都一样，不用记
const fireHelpers = `float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// FBM：多层 noise 叠加 —— 大轮廓 + 越来越小的细节
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}`;

// 第一步 · 准备「生动的烟雾基底」（噪声 + 分形 FBM）—— 静止、灰度，先看清质感
const fireStep1 = `precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;

${fireHelpers}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  vec2 q = uv;
  q.x *= 2.0;

  // 只是一片静止的、像云一样的随机纹理 —— 这就是火焰的「底料」
  float n = fbm(q * 3.0);

  gl_FragColor = vec4(vec3(n), 1.0);
}`;

// 第二步 · 让烟雾「飘起来」（动画引擎）—— 采样坐标随时间往下移，纹理看起来往上窜
const fireStep2 = `precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;

${fireHelpers}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  vec2 q = uv;
  q.x *= 2.0;

  // ★ 新增 vec2(0.0, -u_time * 1.5)：坐标往下挪 → 看起来纹理一直往上飘
  float n = fbm(q * 3.0 + vec2(0.0, -u_time * 1.5));

  gl_FragColor = vec4(vec3(n), 1.0);
}`;

// 第三步 · 用「剪刀」剪出火苗形状（形状遮罩）—— 乘 (1 - uv.y) 让下浓上淡
const fireStep3 = `precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;

${fireHelpers}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  vec2 q = uv;
  q.x *= 2.0;
  float n = fbm(q * 3.0 + vec2(0.0, -u_time * 1.5));

  // ★ 新增 (1.0 - uv.y)：底部强(=1)、顶部弱(=0)，把飘动的烟「剪」成火苗轮廓
  float flame = n * (1.0 - uv.y) * 1.8;

  // 还是灰度，但已经能看出火苗的形状了
  gl_FragColor = vec4(vec3(flame), 1.0);
}`;

// 第四步 · 给火苗「注入灵魂」（色彩梯度映射）—— 三段 smoothstep 点亮 红→橙→黄
const fireStep4 = `precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;

${fireHelpers}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  vec2 q = uv;
  q.x *= 2.0;
  float n = fbm(q * 3.0 + vec2(0.0, -u_time * 1.5));
  float flame = n * (1.0 - uv.y) * 1.8;

  // ★ 新增三行：把灰度强度当「温度计」，由低到高依次叠上 暗红 → 橙 → 亮黄
  vec3 color = vec3(0.0);
  color += vec3(1.5, 0.0, 0.0) * smoothstep(0.0, 0.5, flame);
  color += vec3(1.0, 0.6, 0.0) * smoothstep(0.3, 0.8, flame);
  color += vec3(1.0, 1.0, 0.6) * smoothstep(0.6, 1.0, flame);

  gl_FragColor = vec4(color, 1.0);
}`;

const mouse = `precision mediump float;

uniform vec2  u_resolution;
uniform vec2  u_mouse;   // 鼠标像素坐标 —— 移动鼠标试试！
uniform float u_time;

void main() {
  // 把坐标移到画面中心，并按高度修正宽高比
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
  vec2 m  = (u_mouse.xy      - 0.5 * u_resolution.xy) / u_resolution.y;

  float d = length(uv - m);                 // 当前像素到鼠标的距离

  float glow   = 0.12 / (d + 0.08);         // 越靠近鼠标越亮 → 光晕
  float ripple = 0.6 + 0.4 * sin(d * 35.0 - u_time * 5.0); // 向外扩散的波纹

  // 随时间循环的三通道颜色
  vec3 tint  = 0.5 + 0.5 * cos(u_time + vec3(0.0, 2.0, 4.0));
  vec3 color = glow * ripple * tint;

  gl_FragColor = vec4(color, 1.0);
}`;

// ===== 鼠标「三步搭建」：先看光晕，再加波纹，最后上色 =====

// 第一步 · 只有光晕：每个像素算自己离鼠标多远，离得越近越亮
const mouseGlow = `precision mediump float;

uniform vec2  u_resolution;
uniform vec2  u_mouse;   // 鼠标像素坐标 —— 移动鼠标试试！
uniform float u_time;

void main() {
  // 坐标移到画面中心，x、y 都除以高度 → 保证是正圆不被拉扁
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
  vec2 m  = (u_mouse.xy      - 0.5 * u_resolution.xy) / u_resolution.y;

  float d = length(uv - m);          // 当前像素离鼠标多远

  // 距离的倒数：d 越小越亮（+0.08 防止除以 0）
  float glow = 0.12 / (d + 0.08);

  gl_FragColor = vec4(vec3(glow), 1.0);   // 先用白色，只看光晕
}`;

// 第二步 · 加波纹：用 sin 沿距离画出一圈圈环，-u_time 让环向外扩散（先保持黑白）
const mouseRipple = `precision mediump float;

uniform vec2  u_resolution;
uniform vec2  u_mouse;
uniform float u_time;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
  vec2 m  = (u_mouse.xy      - 0.5 * u_resolution.xy) / u_resolution.y;

  float d = length(uv - m);

  float glow = 0.12 / (d + 0.08);

  // sin 沿距离一上一下 → 同心圆环；d*35 控制环的疏密；-u_time*5 让环往外跑
  float ripple = 0.6 + 0.4 * sin(d * 35.0 - u_time * 5.0);

  gl_FragColor = vec4(vec3(glow * ripple), 1.0);   // 光晕 × 波纹，黑白看清条纹
}`;

// ===== 函数小课堂：单独演示一个内置函数 =====

const fnStep = `precision mediump float;

uniform vec2 u_resolution;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  // step(edge, x)：x < edge 给 0，x >= edge 给 1
  // 就是一个"阈值开关"，输出非黑即白，边界一刀切
  float s = step(0.5, uv.x);

  gl_FragColor = vec4(vec3(s), 1.0);
}`;

const fnSmoothstep = `precision mediump float;

uniform vec2 u_resolution;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  // smoothstep(a, b, x)：x 在 [a,b] 之间平滑过渡 0→1
  // 与 step 的区别：边界是柔和的渐变，不是硬切
  float s = smoothstep(0.3, 0.7, uv.x);

  gl_FragColor = vec4(vec3(s), 1.0);
}`;

const fnMix = `precision mediump float;

uniform vec2 u_resolution;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  vec3 colorA = vec3(0.1, 0.4, 0.9); // 蓝
  vec3 colorB = vec3(1.0, 0.5, 0.0); // 橙

  // mix(a, b, t)：t=0 全取 a，t=1 全取 b，中间线性混合
  // 做颜色渐变 / 数值插值的万能工具
  vec3 color = mix(colorA, colorB, uv.x);

  gl_FragColor = vec4(color, 1.0);
}`;

const fnNoise = `precision mediump float;

uniform vec2  u_resolution;
uniform float u_time;

float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// value noise：相邻随机点之间用 mix 平滑插值
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  // 放大坐标看清噪声格子；加 u_time 让它流动
  float n = noise(uv * 8.0 + u_time);

  gl_FragColor = vec4(vec3(n), 1.0);
}`;

export const PRESETS: Preset[] = [
  { key: 'gradient', label: '① 渐变', source: gradient },
  { key: 'starfield', label: '② 星空', source: starfield },
  { key: 'fire', label: '③ 火焰', source: fire },
  { key: 'mouse', label: '④ 鼠标', source: mouse },
  { key: 'fire_step1', label: '步骤1·基底', source: fireStep1 },
  { key: 'fire_step2', label: '步骤2·飘动', source: fireStep2 },
  { key: 'fire_step3', label: '步骤3·剪形', source: fireStep3 },
  { key: 'fire_step4', label: '步骤4·上色', source: fireStep4 },
  { key: 'mouse_glow', label: '①光晕', source: mouseGlow },
  { key: 'mouse_ripple', label: '②波纹', source: mouseRipple },
  { key: 'mouse_full', label: '③上色', source: mouse },
  { key: 'fn_step', label: 'step', source: fnStep },
  { key: 'fn_smoothstep', label: 'smoothstep', source: fnSmoothstep },
  { key: 'fn_mix', label: 'mix', source: fnMix },
  { key: 'fn_noise', label: 'noise', source: fnNoise },
];

export function getPreset(key: string): Preset {
  return PRESETS.find((p) => p.key === key) ?? PRESETS[0];
}
