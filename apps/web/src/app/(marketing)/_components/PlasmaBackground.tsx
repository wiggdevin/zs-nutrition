'use client';

import { useRef, useEffect, useState } from 'react';

const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uScrollFade;

out vec4 fragColor;

// Perlin-style noise helpers
vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 5; i++) {
    v += a * cnoise(p);
    p = rot * p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = uv * 3.0;

  // Mouse influence — subtle attraction
  vec2 mouse = uMouse / uResolution;
  vec2 diff = uv - mouse;
  float dist = length(diff);
  p += diff * 0.3 / (dist + 0.5);

  float t = uTime * 0.15;
  float n1 = fbm(p + vec2(t, t * 0.7));
  float n2 = fbm(p + vec2(n1 * 0.5, t * 0.5));
  float n = fbm(p + vec2(n2));

  // Orange/coral palette
  vec3 col1 = vec3(0.976, 0.451, 0.086); // #f97316
  vec3 col2 = vec3(1.0, 0.478, 0.478);   // #ff7a7a
  vec3 col3 = vec3(0.914, 0.345, 0.047);  // deeper orange

  float blend = smoothstep(-0.4, 0.6, n);
  vec3 color = mix(col1, col2, blend);
  color = mix(color, col3, smoothstep(0.2, 0.8, n2));

  // Intensity: brighter in blob centers, darker between
  float intensity = smoothstep(-0.1, 0.5, n) * 0.6;
  intensity *= smoothstep(1.0, 0.3, length(uv - 0.5)); // vignette

  fragColor = vec4(color * intensity * uScrollFade, intensity * uScrollFade);
}`;

export function PlasmaBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scrollFadeRef = useRef(1);
  const [webgl2Supported, setWebgl2Supported] = useState<boolean | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
    if (!gl) {
      setWebgl2Supported(false);
      return;
    }
    setWebgl2Supported(true);

    // Compile shader helper
    function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // Full-screen quad
    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uResolution = gl.getUniformLocation(program, 'uResolution');
    const uMouse = gl.getUniformLocation(program, 'uMouse');
    const uScrollFade = gl.getUniformLocation(program, 'uScrollFade');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Resize handler
    function resize() {
      if (!canvas || !gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    // Mouse handler
    function onPointerMove(e: PointerEvent) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      mouseRef.current.x = e.clientX * dpr;
      mouseRef.current.y = (window.innerHeight - e.clientY) * dpr;
    }
    window.addEventListener('pointermove', onPointerMove);

    // Scroll handler
    function onScroll() {
      scrollFadeRef.current = Math.max(0, 1 - window.scrollY / window.innerHeight);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Reduced motion check
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const startTime = performance.now();

    function render() {
      if (!gl || !canvas) return;
      const elapsed = (performance.now() - startTime) / 1000;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform2f(uMouse, mouseRef.current.x, mouseRef.current.y);
      gl.uniform1f(uScrollFade, scrollFadeRef.current);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (!reducedMotion) {
        rafRef.current = requestAnimationFrame(render);
      }
    }

    render();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
      gl.deleteBuffer(buf);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  if (webgl2Supported === false) {
    return <div className="plasma-bg-fallback" aria-hidden="true" />;
  }

  return (
    <div ref={containerRef} className="plasma-bg-container" aria-hidden="true">
      <canvas ref={canvasRef} className="plasma-bg-canvas" />
      <div className="plasma-bg-overlay" />
    </div>
  );
}
