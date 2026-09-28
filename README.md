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

`main` 分支通过 GitHub Actions 自动发布到 GitHub Pages。当前公开产品定位为本地优先 PWA：对话与记忆默认只保存在浏览器；只有用户主动配置真实模型时，当前上下文才会发送到其指定的服务商。

## 产品与工程文档

- [PRODUCT.md](docs/PRODUCT.md)
- [DESIGN.md](docs/DESIGN.md)
- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [API_CONTRACT.md](docs/API_CONTRACT.md)
