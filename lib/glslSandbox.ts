// 极简 WebGL fragment-shader 沙箱：全屏画一个矩形，把用户的片元着色器贴上去。
// 自动提供三个 uniform（和《The Book of Shaders》一致）：
//   uniform float u_time;        当前时间（秒）
//   uniform vec2  u_resolution;  画布像素尺寸
//   uniform vec2  u_mouse;       鼠标像素坐标
// 没有任何第三方依赖，API 完全可控。

export interface CompileResult {
  ok: boolean;
  error?: string;
}

const VERTEX_SHADER = `attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export class GlslSandbox {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private raf = 0;
  private startTime = performance.now();
  // [-1,-1] 表示鼠标还没动过，render 时回退到画面中心
  private mouse: [number, number] = [-1, -1];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('当前环境不支持 WebGL');
    this.gl = gl as WebGLRenderingContext;

    // 两个三角形拼成一个铺满屏幕的矩形
    this.buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW,
    );
  }

  /** 编译并加载一段片元着色器；返回是否成功 + 错误信息 */
  load(fragmentSource: string): CompileResult {
    const gl = this.gl;
    const vs = this.compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    if (!vs.shader) return { ok: false, error: vs.error };

    const fs = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!fs.shader) {
      gl.deleteShader(vs.shader);
      return { ok: false, error: fs.error };
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs.shader);
      gl.deleteShader(fs.shader);
      return { ok: false, error: '无法创建 WebGL program' };
    }
    gl.attachShader(program, vs.shader);
    gl.attachShader(program, fs.shader);
    gl.linkProgram(program);
    gl.deleteShader(vs.shader);
    gl.deleteShader(fs.shader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program) || '链接失败';
      gl.deleteProgram(program);
      return { ok: false, error };
    }

    if (this.program) gl.deleteProgram(this.program);
    this.program = program;
    return { ok: true };
  }

  private compile(
    type: number,
    source: string,
  ): { shader: WebGLShader | null; error?: string } {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return { shader: null, error: '无法创建 shader' };
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader) || '编译失败';
      gl.deleteShader(shader);
      return { shader: null, error };
    }
    return { shader };
  }

  start() {
    this.stop();
    const loop = () => {
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  setMouse(x: number, y: number) {
    this.mouse = [x, y];
  }

  private resize() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(c.clientWidth * dpr));
    const h = Math.max(1, Math.floor(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
  }

  private render() {
    const gl = this.gl;
    if (!this.program) return;
    this.resize();
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(this.program);

    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(this.program, 'u_time');
    if (uTime) gl.uniform1f(uTime, (performance.now() - this.startTime) / 1000);
    const uRes = gl.getUniformLocation(this.program, 'u_resolution');
    if (uRes) gl.uniform2f(uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const uMouse = gl.getUniformLocation(this.program, 'u_mouse');
    if (uMouse) {
      let mx = this.mouse[0];
      let my = this.mouse[1];
      if (mx < 0 && my < 0) {
        // 鼠标还没动过：默认放在画面中心
        mx = gl.drawingBufferWidth / 2;
        my = gl.drawingBufferHeight / 2;
      }
      gl.uniform2f(uMouse, mx, my);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose() {
    this.stop();
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    this.program = null;
    this.buffer = null;
  }
}
