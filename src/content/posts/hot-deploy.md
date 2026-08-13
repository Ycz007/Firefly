---
title: 博客热部署指南：Push 代码自动更新到服务器
published: 2026-08-12
updated: 2026-08-12
pinned: true
description: "使用 GitHub Actions 实现博客热部署：推送代码到 GitHub 后自动构建并部署到自有服务器，服务器无需安装 Node.js、Git 等环境。"
image: "/images/cicd-cover.png"
tags: ["博客", "热部署", "GitHub Actions", "Nginx", "CI/CD"]
category: CI/CD
---


## 背景

本博客基于 Astro 静态站点框架，部署在自有服务器上(Ubuntu22.04)。之前每次更新内容都需要手动 SSH 连上服务器，拉代码、构建、拷贝文件，非常繁琐。

引入 **GitHub Actions** 自动化部署后，只需本地 `git push`，云端自动构建并将 `dist/` 推送到服务器，Nginx 直接返回新内容，真正实现"写完就发"。

---

## 整体架构

```
┌──────────────┐   git push   ┌───────────────┐   SSH+rsync   ┌──────────────┐
│  本地电脑      │ ──────────> │  GitHub 仓库    │ ────────────> │  自有服务器    │
│  (写代码)      │             │  Actions 构建   │               │  Nginx 返回   │
└──────────────┘             └───────┬───────┘               └──────────────┘
                                     │
                              云端 Ubuntu 环境
                              - checkout 代码
                              - 安装 pnpm + 依赖
                              - pnpm build 构建
                              - rsync dist/ → 服务器
```

**核心优势**：服务器上不需要安装 Git、Node.js、pnpm 等任何开发环境，只需要 Nginx 和 rsync。

---

## 第一步：服务器生成 SSH 密钥

SSH 连上服务器，生成一组供 GitHub Actions 使用的密钥对：

```bash
ssh-keygen -t ed25519 -f /root/.ssh/github-actions -N ""

# 公钥（锁）装到服务器
cat /root/.ssh/github-actions.pub >> /root/.ssh/authorized_keys

# 私钥（钥匙）复制下来，稍后填入 GitHub
cat /root/.ssh/github-actions
```

> **公钥和私钥的区别**：公钥是"锁"，装在服务器上，谁都可以看；私钥是"钥匙"，必须保密。GitHub Actions 拿着钥匙去开服务器的锁，匹配成功就能免密登录。

---

## 第二步：GitHub 仓库添加 Secrets

打开 GitHub 仓库 → **Settings → Secrets and variables → Actions → New repository secret**，添加三个：

| Secret 名称 | 示例值 | 说明 |
|:---|:---|:---|
| `SERVER_HOST` | `192.168.150.1` | 服务器 IP 地址 |
| `SERVER_USER` | `root` | SSH 登录用户名 |
| `SERVER_SSH_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----`... | 第一步复制的完整私钥（含头尾） |

> 添加时注意私钥必须包含 `-----BEGIN OPENSSH PRIVATE KEY-----` 和 `-----END OPENSSH PRIVATE KEY-----`，缺一不可。
>
> 确保 `https://github.com/用户名称/仓库名称/settings/actions` 的Actions permissions是Allow all actions and reusable workflows。
---

## 第三步：创建 deploy.yml

在项目根目录创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to Server

on:                          # 触发条件
  push:
    branches: [master]        # 推送到 master 分支时触发
  workflow_dispatch:          # 允许在网页上手动触发

concurrency:
  group: "deploy"
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest    # GitHub 提供的一台临时云服务器
    steps:
      # ① 拉代码
      - name: Checkout
        uses: actions/checkout@v4

      # ② 装 Node.js 22
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"

      # ③ 装 pnpm 9.14.4
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.14.4
          run_install: false

      # ④ 装项目依赖
      - name: Install dependencies
        run: pnpm install --no-frozen-lockfile

      # ⑤ 构建 → 生成 dist/ 目录
      - name: Build site
        run: pnpm run build

      # ⑥ 把 dist/ 推送到你的服务器 /var/www/html/
      - name: Deploy to server
        uses: easingthemes/ssh-deploy@v5.1.2
        with:
          SSH_PRIVATE_KEY: ${{ secrets.SERVER_SSH_KEY }}   # 你的私钥
          ARGS: "-avz --delete"                             # rsync 参数：归档+压缩+删除旧文件
          SOURCE: "dist/"                                   # 要上传的本地目录
          REMOTE_HOST: ${{ secrets.SERVER_HOST }}           # 你的服务器 IP
          REMOTE_USER: ${{ secrets.SERVER_USER }}           # 登录用户
          TARGET: "/var/www/html"                           # 服务器上的目标目录
```

### 配置说明

| 配置项 | 说明 |
|:---|:---|
| `on.push.branches: [master]` | 推送到 master 分支时自动触发 |
| `workflow_dispatch` | 允许手动在 Actions 页面点击触发 |
| `runs-on: ubuntu-latest` | GitHub 提供的临时 Linux 服务器 |
| `SOURCE: "dist/"` | 本地构建产物目录 |
| `TARGET: "/var/www/html"` | 服务器上 Nginx 的根目录 |
| `ARGS: "-avz --delete"` | rsync 参数：归档模式 + 压缩 + 删除旧文件 |
| `--no-frozen-lockfile` | 允许 pnpm 更新 lockfile，避免版本锁定导致构建失败 |

---

## 第四步：Nginx 配置

确保服务器上的 Nginx 指向正确的目录：

```nginx
server {
    listen 443 ssl http2;
    server_name www.ynnn-7.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    root /var/www/html;
    index index.html;

    # 不带 www 跳转到带 www
    server {
        listen 443 ssl;
        server_name ynnn-7.com;
        return 301 https://www.ynnn-7.com$request_uri;
    }

    location / {
        try_files $uri $uri.html $uri/ /404.html;
    }

    # Astro 静态资源长期缓存
    location /_astro/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml text/javascript image/svg+xml;
}
```

---

## 工作原理

每次 `git push origin master` 后，GitHub Actions 自动执行以下流程：

```mermaid
flowchart TD
    A[git push] --> B[GitHub Actions 触发]
    B --> C[拉取最新代码]
    C --> D[安装 Node.js 22]
    D --> E[安装 pnpm]
    E --> F[pnpm install 装依赖]
    F --> G[pnpm build 构建]
    G --> H[rsync dist/ → 服务器 /var/www/html/]
    H --> I[Nginx 返回新页面]
```

---

## 如何使用

以后写完文章只需要：

```bash
git add .
git commit -m "更新内容"
git push
```

然后打开 GitHub 仓库的 **Actions** 标签页，查看 **Deploy to Server** 运行状态。变成绿色 ✅ 后等待 1-2 分钟，刷新博客即可看到更新。

---

## 踩坑记录

### 1. SSH 连接被拒

**现象**：`Host key verification failed`

**解决**：确认 `authorized_keys` 中已添加公钥，且 GitHub Secrets 中的 `SERVER_SSH_KEY` 私钥内容完整（包含头尾标记）。

### 2. Action 版本找不到

**现象**：`Unable to resolve action easingthemes/ssh-deploy@v5`

**解决**：`v5` 不是有效的版本 tag，必须使用具体版本号如 `v5.1.2`。

### 3. 构建失败但部署日志看不到

**现象**：Actions 页面显示红色失败

**解决**：项目中的其他 workflow（如 Biome 代码检查）可能同时运行并失败，但它们是独立的，不影响部署 workflow。在 Actions 页面左侧点击 **Deploy to Server** 查看部署专属日志。

### 4. 部署成功但网站没变化

**解决**：
- 检查 Nginx 的 `root` 是否指向 `/var/www/html`
- 检查服务器是否安装了 `rsync`：`apt install -y rsync`
- 清除浏览器缓存或使用无痕模式访问

---

## 总结

| 做了什么 | 在哪里 |
|:---|:---|
| SSH 密钥对 | 服务器 `/root/.ssh/` |
| 三个 Secrets | GitHub 仓库 Settings |
| `deploy.yml` | 项目 `.github/workflows/` |
| Nginx 配置 | 服务器 `/etc/nginx/` |
| **本地代码** | **正常上传即可** |
