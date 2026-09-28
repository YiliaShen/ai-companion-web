# Mira · AI 情感陪伴 Web App

从“多角色、长期记忆、情绪触发生图”的 AI 情感陪伴项目资料重建的可部署 Web MVP。

## 本地运行

```bash
pnpm install
pnpm dev
```

默认使用内置 `demo` provider，无需任何 API Key 即可体验完整聊天、记忆、相册、氛围音与安全边界。用户也可以在设置中填写 OpenAI 兼容接口，切换到真实模型。

## 验证

```bash
pnpm check
```

## 部署

`main` 分支保存源码；当前公开站点通过 `gh-pages` 分支发布，避免依赖本地 Token 的 `workflow` scope。当前公开产品定位为本地优先 PWA：对话与记忆默认只保存在浏览器；只有用户主动配置真实模型时，当前上下文才会发送到其指定的服务商。

Public URL: `https://yiliashen.github.io/ai-companion-web/`. Pages is configured to serve the `gh-pages` branch. The validated GitHub Actions workflow is retained at `docs/deploy/github-actions-pages.yml.example`; if the GitHub CLI account is authorized with the `workflow` scope, it can be moved back to `.github/workflows/deploy-pages.yml` for automatic CI deployment.

The workflow uses Node.js 22, pinned pnpm 12.3.4, and a frozen lockfile. `VITE_BASE_PATH=/ai-companion-web/` targets `https://<owner>.github.io/ai-companion-web/`. If the repository name or custom domain changes, update that base in the workflow; use `/` for root-domain hosting. The local default is `./`.

Reproduce release validation locally with Node.js 22:

```bash
pnpm install --frozen-lockfile
VITE_BASE_PATH=/ai-companion-web/ pnpm check
VITE_BASE_PATH=/ai-companion-web/ node scripts/verify-dist.mjs
VITE_BASE_PATH=/ai-companion-web/ node scripts/smoke-web.mjs
```

`pnpm check` runs typecheck, tests, and build. The dist verifier checks production resource paths, PWA scope, offline photo coverage, source credits, and all photo hashes. The HTTP smoke check starts a temporary loopback-only static server, requests every output file under the project prefix, validates status, MIME type and exact bytes, then closes the server. It does not replace browser interaction or service-worker lifecycle testing. The package aliases are `pnpm verify:dist` and `pnpm smoke:web`; without an environment override, both infer the base from the built HTML.

After a future deployment, check a site against the same local build:

```bash
node scripts/smoke-web.mjs --url https://<owner>.github.io/ai-companion-web/
```

GitHub Pages serves static files. Keep navigation on the single app entry or use hash routing; a direct request to an ungenerated pathname has no SPA fallback. The PWA precaches local photos and their manifest after the first successful online load. Do not place provider credentials in `VITE_*` variables or build artifacts.

The local photo library contains 11 JPEGs (about 1.44 MB): avatar and hero crops for three personas, plus five shared scenes (`late_night`, `seaside`, `cafe`, `city_walk`, `celebration`). See [CREDITS.md](public/assets/CREDITS.md) for the Pexels/Unsplash licenses, original URLs and stable filename contract, and [manifest.json](public/assets/manifest.json) for metadata. Read `personas[id].avatar` / `.hero`, `personas[id].scenes[scene]` or `scenes[scene].path`, and prepend `import.meta.env.BASE_URL` to these paths without a leading slash. The files are local and need no runtime third-party image request once used by the UI.

## 产品与工程文档

- [PRODUCT.md](docs/PRODUCT.md)
- [DESIGN.md](docs/DESIGN.md)
- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [API_CONTRACT.md](docs/API_CONTRACT.md)
