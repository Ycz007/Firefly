# 全屏开场动画（Entrance Animation）设计文档

日期：2026-08-14
状态：已确认

## 目标

给博客加一个**首屏全屏开场动画（Logo 揭幕式）**：用户第一次进入站点时，先看到全屏遮罩上 Logo 淡入 + 光晕 + 站点名，短暂停留后整屏褪去，露出主页。之后用户可自行替换 Logo 图片。

## 需求

1. 全屏开场动画，只在**真正刷新进站**时播放一次（Swup 切页不重放）。
2. 画面：居中 Logo 图（带柔光光晕）+ 站点名文字，深色遮罩，动画结束整体淡出。
3. Logo 先用现有头像 `src/assets/images/avatar.avif` 占位，路径做成可配置，用户后续换透明 PNG。
4. 配置驱动，与现有 `sakuraConfig` 同风格，集中管理。
5. 尊重 `prefers-reduced-motion`（直接跳过动画）。
6. 回放策略可配：`once`（每会话一次，默认）/ `always`（每次刷新都播）/ `off`。

## 非目标（YAGNI）

- 不做 Lottie / GIF / 视频开场（用户已选定 Logo 揭幕，纯图 + CSS/JS 即可）。
- 不做切页过渡增强、首屏元素逐个入场等其它入场形式（本次只做全屏开场）。
- 不做进度条 / 百分比加载逻辑（开场动画是固定时长，非真实加载进度）。

## 架构

采用**方案 A：全屏遮罩层 + 内联脚本**，与现有防闪逻辑一致。

### 组件划分

1. **配置** — `entranceConfig`
   - 类型：`EntranceConfig`，新增在 `src/types/effectsConfig.ts`（与 `SakuraConfig` 并列）。
   - 配置值：新增在 `src/config/effectsConfig.ts`，与 `sakuraConfig` 并列导出。
   - 桶文件：`src/config/index.ts` 增加 `entranceConfig` 导出（值 + 类型）。

2. **遮罩层 DOM** — 写在 `src/layouts/Layout.astro` 的 `<body>` 顶部（`<slot />` 之前），位于 Swup 替换容器之外，因此不会被 Swup 切页替换掉。
   - 结构：`<div id="entrance-overlay">`，内含 `<img id="entrance-logo">` + `<div id="entrance-title">`。
   - 初始由内联脚本控制显隐，CSS 负责动画。

3. **内联脚本** — 放在 `Layout.astro` 的 `<head>` 中（`is:inline`，与主题初始化脚本同位置），保证首帧前执行、无闪屏。
   - 逻辑：
     a. 若 `entranceConfig.enable` 为 false，直接返回（遮罩不显示）。
     b. 若 `prefers-reduced-motion` 命中，直接返回（遮罩不显示）。
     c. 若回放策略为 `once`，读 `sessionStorage` 判断本会话是否已播，已播则返回。
     d. 显示遮罩，播放 Logo 放大 + 光晕 + 站点名淡入。
     e. `duration` 结束后遮罩淡出，随后从 DOM 移除，并写入 `sessionStorage` 标记。

### 数据流

```
页面刷新
  → head 内联脚本执行（首帧前）
    → 判断 enable / reduced-motion / replay
    → 显示 #entrance-overlay
    → 播放入场动画（CSS transition / @keyframes）
    → duration 后淡出 + 移除 DOM + 写 sessionStorage
```

Swup 切页时 head 内联脚本**不会**重跑，遮罩层又不在 swup 容器内，因此自然满足"只在真正进站时播一次"。

## 配置 Schema

```ts
export interface EntranceConfig {
  /** 是否启用开场动画 */
  enable: boolean;
  /** Logo 图片路径（public 目录下的相对路径，以 "/" 开头） */
  logo: string;
  /** 动画总时长（ms） */
  duration: number;
  /** 回放策略：once 每会话一次 / always 每次刷新 / off 关闭 */
  replay: "once" | "always" | "off";
}
```

默认值：

```ts
export const entranceConfig: EntranceConfig = {
  enable: true,
  logo: "/assets/images/effects/entrance-logo.avif", // 占位，后续用户可换透明 PNG
  duration: 1600,
  replay: "once",
};
```

> 站点名文字**不**单独配置，直接由 `Layout.astro` 用 `define:vars` 注入 `siteConfig.title`（单一数据源，避免与 `siteConfig` 重复维护）。

## 动画序列（约 1.6s）

1. **遮罩**：不透明深色背景（跟随主题深浅色，用 CSS 变量 `--page-bg` 或固定深色），`position: fixed; inset: 0; z-index` 高于页面内容（如 200）。
2. **Logo 淡入 + 缩放**：`opacity 0→1` + `scale 0.85→1`，同时外发光（`box-shadow` / `filter: drop-shadow`）淡入。
3. **站点名淡入**：Logo 之后小幅延迟，文字 `opacity 0→1` + 轻微上移。
4. **整体淡出**：停留后遮罩 `opacity 1→0`（约 300ms），随后 `remove()` 从 DOM 移除并回收。

实现上优先用 CSS `transition`（脚本切换类名）+ 少量 `@keyframes`，减少 JS 动画代码；`prefers-reduced-motion` 时由脚本提前返回，CSS 不做动画。

## 可访问性与降级

- `prefers-reduced-motion: reduce`：跳过动画，遮罩不显示。
- 遮罩层 `aria-hidden="true"` + `pointer-events: none`（动画期间用脚本临时开启 pointer-events 以挡住首屏点击，淡出前关闭，避免挡住交互）。简化处理：遮罩在 `duration` 内 `pointer-events: auto` 挡点击，移除后自然释放。
- Logo `<img>` 加 `alt`（空串或站点名），避免装饰图被读屏读出。

## 素材说明

- **当前占位**：把现有头像 `src/assets/images/avatar.avif` 复制一份到 `public/assets/images/effects/entrance-logo.avif` 作为占位 Logo（故意复制一份，形成"这里就是开场 Logo、要换就换这个"的明确落点）。
- **后续换图**：用户将一张透明背景 PNG 覆盖 `public/assets/images/effects/entrance-logo.avif`，或放入新路径后在 `entranceConfig.logo` 改路径即可，无需改代码。

## 涉及文件

| 文件 | 改动 |
|---|---|
| `src/types/effectsConfig.ts` | 新增 `EntranceConfig` 类型 |
| `src/config/effectsConfig.ts` | 新增 `entranceConfig` 导出 |
| `src/config/index.ts` | 导出 `entranceConfig` 及类型 |
| `src/layouts/Layout.astro` | 新增遮罩 DOM + head 内联脚本 + 遮罩 CSS |
| `public/assets/images/effects/entrance-logo.avif` | 占位 Logo（复制自头像，后续用户替换） |

## 测试 / 验证

1. `pnpm dev` 启动，硬刷新首页 → 应看到开场动画播放一次。
2. 同会话内刷新/切页 → 不再播放（`once` 生效）。
3. 改 `replay: "always"` → 每次刷新都播。
4. 改 `enable: false` → 无遮罩。
5. 系统开启"减弱动态效果" → 直接跳过。
6. `pnpm check` / `pnpm type-check` / `pnpm lint` 通过。
7. 深浅色主题下遮罩配色正常、无闪屏。
