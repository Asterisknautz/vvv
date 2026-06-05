# asterisknautz.vvv – setup.md

three.js を **Vite + Vercel + rollup-plugin-visualizer** で動かし、トップ（`/`）と 3 桁のアイデアページ（`/001` のようなルーティング）を量産するためのセットアップ手順を 1 ファイルに集約しました。ベースカラーは **#191925**、クリック反応（波紋）あり。プロジェクト名は **vvv** 想定。

---

## 0. 目的と方針
- **目的**: すぐ試せる three.js 実験場。トップと `/\d{3}` の各ページごとに idea モジュールを差し替え。
- **方針**: SPA（History API ルーティング）+ 動的 import。存在しない 3 桁ページはフォールバック。

---

## 1. 前提条件
- Node.js 18+（推奨: 20+）
- npm（もしくは pnpm/yarn。以降 npm を例示）
- GitHub アカウント（Vercel 連携用）
- Vercel アカウント

---

## 2. プロジェクト作成
```bash
# 新規作成（Vanilla + TypeScript）
npm create vite@latest asterisknautz-vvv -- --template vanilla-ts
cd asterisknautz-vvv

# 依存パッケージ
npm i three
npm i -D @types/three vite rollup-plugin-visualizer

# 必要ディレクトリ
mkdir -p src/ideas public
```

---

## 3. ファイル構成（最小）
```
asterisknautz-vvv/
├─ index.html
├─ vercel.json
├─ vite.config.ts
├─ src/
│  ├─ main.ts
│  ├─ router.ts
│  ├─ threeScene.ts
│  ├─ ideas/
│  │  └─ 001.ts
│  └─ styles.css
└─ public/
   └─ favicon.svg
```

---

## 4. 各ファイルの内容

### 4.1 `index.html`
```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>asterisknautz.vvv</title>
    <link rel="icon" href="/favicon.svg" />
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="app">
      <canvas id="three-canvas"></canvas>
      <header class="site-brand">
        <h1>asterisknautz.<span>vvv</span></h1>
        <div id="route-indicator">/</div>
      </header>

      <nav class="ui">
        <a href="/" data-link>Home</a>
        <a href="/001" data-link>001</a>
        <a href="/002" data-link>002</a>
      </nav>

      <footer class="hint">
        click: drop ripple • drag: orbit • dblclick: reset
      </footer>
    </div>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

### 4.2 `src/styles.css`
```css
:root{
  --bg:#191925;
  --fg:#e6e6f6;
  --sub:#9aa3ff;
}
*{ box-sizing:border-box; }
html,body,#app{ height:100%; margin:0; }
body{ background:var(--bg); color:var(--fg); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
#three-canvas{
  position:fixed; inset:0; width:100%; height:100%; display:block;
}

.site-brand{
  position:fixed; top:24px; left:24px; line-height:1;
  mix-blend-mode:screen; user-select:none; pointer-events:none;
}
.site-brand h1{
  margin:0; font-weight:800; letter-spacing:0.5px; font-size: clamp(20px, 2.8vw, 40px);
}
.site-brand h1 span{ color:var(--sub); }
#route-indicator{
  margin-top:6px; opacity:.7; font-size:12px; letter-spacing:1.5px;
}

.ui{
  position:fixed; top:24px; right:24px; display:flex; gap:12px;
  background:rgba(255,255,255,.05); backdrop-filter: blur(6px);
  padding:8px 10px; border-radius:10px;
}
.ui a{
  color:var(--fg); text-decoration:none; opacity:.8;
}
.ui a:hover{ opacity:1; text-decoration:underline; }

.hint{
  position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
  font-size:12px; opacity:.6; background:rgba(0,0,0,.25); padding:6px 10px; border-radius:8px;
}
```

### 4.3 `src/router.ts`
```ts
// src/router.ts
type RouteHandler = (params: { id?: string }) => void;

const routes: { pattern: RegExp; handler: RouteHandler }[] = [
  { pattern: /^\/$/, handler: () => onRoute({}) },
  { pattern: /^\/(\d{3})$/, handler: ([, id]) => onRoute({ id }) },
];

let onRoute: RouteHandler = () => {};
export function setRouteHandler(fn: RouteHandler) { onRoute = fn; }

export function navigate(path: string) {
  if (location.pathname !== path) history.pushState({}, "", path);
  dispatch();
}

export function dispatch() {
  const path = location.pathname;
  for (const r of routes) {
    const match = path.match(r.pattern);
    if (match) {
      // @ts-ignore
      r.handler(match);
      return true;
    }
  }
  history.replaceState({}, "", "/");
  onRoute({});
  return false;
}

export function interceptLinks() {
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement)?.closest("a[data-link]") as HTMLAnchorElement | null;
    if (a && a.href.startsWith(location.origin)) {
      e.preventDefault();
      navigate(a.pathname);
    }
  });
}

window.addEventListener("popstate", dispatch);
```

### 4.4 `src/threeScene.ts`
```ts
// src/threeScene.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type IdeaModule = (ctx: SceneContext) => void | (() => void);

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  root: THREE.Group;     // idea をぶら下げる
  clock: THREE.Clock;
}

export class ThreeApp {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  floor: THREE.Mesh;
  root = new THREE.Group();
  clock = new THREE.Clock();
  cleanupIdea: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(innerWidth, innerHeight);

    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    this.camera.position.set(4, 3, 6);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;

    this.scene.fog = new THREE.FogExp2(0x191925, 0.06);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x222244, 1.0);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 7);
    this.scene.add(hemi, dir);

    const floorGeo = new THREE.PlaneGeometry(50, 50).rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222233, metalness: 0.1, roughness: 0.9 });
    this.floor = new THREE.Mesh(floorGeo, floorMat);
    this.scene.add(this.floor);

    const ico = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.8, 1),
      new THREE.MeshStandardMaterial({ color: 0x9aa3ff, metalness: 0.4, roughness: 0.3 })
    );
    ico.position.y = 1;
    this.scene.add(ico);

    this.scene.add(this.root);

    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("resize", () => this.onResize());
    canvas.addEventListener("dblclick", () => this.resetView());

    this.animate();
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  resetView() {
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(4, 3, 6);
  }

  onPointerDown(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.floor)[0];
    if (hit) this.spawnRipple(hit.point);
  }

  spawnRipple(point: THREE.Vector3) {
    const geo = new THREE.TorusGeometry(0.01, 0.005, 8, 48);
    const mat = new THREE.MeshBasicMaterial({ color: 0x9aa3ff, transparent: true, opacity: 0.9 });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(point);
    this.scene.add(ring);

    const start = this.clock.getElapsedTime();
    const maxR = 1.5;
    const duration = 1.2;

    const update = () => {
      const t = this.clock.getElapsedTime() - start;
      const k = Math.min(1, t / duration);
      ring.scale.setScalar(0.1 + k * (maxR / 0.1));
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      if (k >= 1) {
        this.scene.remove(ring);
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
        this.updates.delete(update);
      }
    };
    this.updates.add(update);
  }

  updates = new Set<() => void>();

  animate = () => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.updates.forEach((fn) => fn());
    this.renderer.render(this.scene, this.camera);
  };

  async loadIdea(id?: string) {
    if (this.cleanupIdea) { this.cleanupIdea(); this.cleanupIdea = null; }
    this.root.clear();

    if (!id) return;

    try {
      const mod: { default: (ctx: SceneContext) => void | (() => void) } = await import(`./ideas/${id}.ts`);
      const maybeCleanup = mod.default({
        scene: this.scene,
        camera: this.camera,
        renderer: this.renderer,
        root: this.root,
        clock: this.clock,
      });
      if (typeof maybeCleanup === "function") this.cleanupIdea = maybeCleanup;
    } catch {
      // not found → do nothing
    }
  }
}
```

### 4.5 `src/ideas/001.ts`
```ts
// src/ideas/001.ts
import * as THREE from "three";
import type { SceneContext } from "../threeScene";

export default function idea001({ root, clock }: SceneContext) {
  const g = new THREE.TorusKnotGeometry(0.6, 0.18, 128, 32);
  const m = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.6 });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(0, 1.1, 0);
  root.add(mesh);

  let rafId = 0;
  const tick = () => {
    const t = clock.getElapsedTime();
    mesh.rotation.x = t * 0.3;
    mesh.rotation.y = t * 0.2;
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(rafId);
    root.remove(mesh);
    g.dispose(); m.dispose();
  };
}
```

### 4.6 `src/main.ts`
```ts
// src/main.ts
import { ThreeApp } from "./threeScene";
import { dispatch, interceptLinks, setRouteHandler } from "./router";

const canvas = document.getElementById("three-canvas") as HTMLCanvasElement;
const app = new ThreeApp(canvas);

const routeIndicator = document.getElementById("route-indicator")!;

setRouteHandler(async ({ id }) => {
  routeIndicator.textContent = id ? `/${id}` : "/";
  await app.loadIdea(id);
});

interceptLinks();
dispatch();
```

### 4.7 `vite.config.ts`
```ts
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    visualizer({
      filename: "stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }) as any,
  ],
  server: {
    port: 5173,
  },
});
```

### 4.8 `vercel.json`
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

### 4.9 `public/favicon.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#191925"/>
  <path d="M18 20 L46 44 M46 20 L18 44" stroke="#9AA3FF" stroke-width="6" stroke-linecap="round"/>
</svg>
```

---

## 5. 起動 & 開発
```bash
# 開発サーバー
npm run dev

# プロダクションビルド
npm run build

# ローカルプレビュー（dist を確認）
npm run preview
```

> Vite のデフォルト scripts はテンプレート生成時に用意されます。必要に応じて `package.json` を確認。

---

## 6. GitHub & Vercel デプロイ
1. Git 初期化・初回コミット
   ```bash
   git init
   git add -A
   git commit -m "feat: initial asterisknautz.vvv"
   ```
2. GitHub に新規リポジトリ作成 → push
   ```bash
   git remote add origin <YOUR_GITHUB_REPO_URL>
   git branch -M main
   git push -u origin main
   ```
3. Vercel で **New Project** → リポジトリ選択
   - Framework: **Vite**（自動認識）
   - Build Command: `vite build`
   - Output Directory: `dist`
   - `vercel.json` により、「`/001` など→ `index.html`」へリライト
4. デプロイ完了 URL を確認
5. カスタムドメイン
   - 例: `vvv.asterisknautz.com` など、実在ドメインでの割当（`asterisknautz.vvv` のような TLD は不可）

---

## 7. アイデアページの追加
- 新規 ID を作るだけ。
  ```bash
  # 例: 002 を作成
  cat > src/ideas/002.ts <<'TS'
  import * as THREE from "three";
  import type { SceneContext } from "../threeScene";
  export default function idea002({ root }: SceneContext) {
    const geom = new THREE.BoxGeometry(1,1,1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff5577, metalness: 0.2, roughness: 0.4 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = 1.2;
    root.add(mesh);

    let t = 0, rafId = 0;
    const tick = () => {
      t += 0.016;
      mesh.rotation.x += 0.02;
      mesh.rotation.y += 0.03;
      mesh.position.y = 1.2 + Math.sin(t) * 0.2;
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      root.remove(mesh);
      geom.dispose(); mat.dispose();
    };
  }
  TS
  ```
- ブラウザで `https://<your-domain>/002` を開くと自動的に動的 import。

### （任意）雛形ジェネレーター
- 簡易 npm script を追加して 3 桁 ID のファイルを生成（zsh/bash）：
```jsonc
// package.json の scripts に追加
{
  "scripts": {
    "new": "node scripts/new-idea.mjs"
  }
}
```
```bash
# scripts/new-idea.mjs を作成
mkdir -p scripts
cat > scripts/new-idea.mjs <<'JS'
import { writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';

const id = process.argv[2];
if (!id || !/^\d{3}$/.test(id)) {
  console.error('Usage: npm run new <3-digit-id> (e.g., 007)');
  process.exit(1);
}
if (!existsSync('src/ideas')) mkdirSync('src/ideas', { recursive: true });
const p = `src/ideas/${id}.ts`;
if (existsSync(p)) {
  console.error(`Already exists: ${p}`);
  process.exit(1);
}
const template = `import * as THREE from "three";\nimport type { SceneContext } from "../threeScene";\n\nexport default function idea${id}({ root }: SceneContext) {\n  const geom = new THREE.SphereGeometry(0.8, 32, 16);\n  const mat = new THREE.MeshStandardMaterial({ color: 0x9aa3ff, metalness: 0.3, roughness: 0.3 });\n  const mesh = new THREE.Mesh(geom, mat);\n  mesh.position.y = 1.1;\n  root.add(mesh);\n\n  let t = 0, rafId = 0;\n  const tick = () => {\n    t += 0.016;\n    mesh.rotation.y += 0.02;\n    rafId = requestAnimationFrame(tick);\n  };\n  rafId = requestAnimationFrame(tick);\n\n  return () => {\n    cancelAnimationFrame(rafId);\n    root.remove(mesh);\n    geom.dispose(); mat.dispose();\n  };\n}\n`;
await writeFile(p, template, 'utf8');
console.log('Created', p);
JS
```
- 使い方: `npm run new 007`

---

## 8. Visualizer の使い方
- ビルド後、`stats.html` が生成される：
  ```bash
  npm run build
  open stats.html   # macOS の例
  ```
- three.js を分割したい／軽量化したいときのサイズ解析に便利。

---

## 9. 運用 Tips
- **DPR 上限**: `Math.min(2, devicePixelRatio)` でモバイルの過剰負荷を緩和。
- **クリーンアップ**: IDEAs は `return () => {...}` でジオメトリやマテリアルを `dispose()`。
- **カメラ UX**: `dblclick` で初期位置に戻す実装済み。
- **フォント/文言**: サイト名は `asterisknautz.vvv` を固定表示。右上に簡易ナビ。
- **ベースカラー**: 背景 #191925、アクセント #9AA3FF（UI と三面色の調和）。

---

## 10. よくあるハマり
- **/001 に直リンクで 404**: `vercel.json` の rewrites が必須。Vercel のプロジェクトにファイルが含まれているか確認。
- **型エラー**: `@types/three` が必要。`node_modules` 消して再インストールで解決する場合あり。
- **真っ黒画面**: カメラ近すぎ／遠すぎ、Canvas スタイルが `display:none` になっていないか、`setSize` 周りを確認。

---

## 11. 完了チェックリスト
- [ ] `npm run dev` で `/` が表示され、クリックで波紋が出る
- [ ] `/001` が読み込まれ、トーラスノットが回転する
- [ ] `npm run build` → `stats.html` が出力される
- [ ] Vercel で `/001` 直リンクが動作する（SPA ルーティング OK）

---

## 12. 次のステップ（任意）
- PostProcessing（bloom/FXAA）、InstancedMesh 粒子、カスタムシェーダ波紋
- `/:id` 存在チェック → 未実装 ID 一覧ページ
- 解析導入（pageview: `/001` など）
- UI コンポーネント最小導入（ヘルプオーバーレイ）

