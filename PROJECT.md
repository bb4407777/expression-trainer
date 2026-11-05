# 项目纪要 / PROJECT NOTES

## 工作纪要

### 2026-08-05 — 首次安装:裸 clone → 可运行状态

**背景**:2026-08-01 clone 后从未安装(无 node_modules / 无模型 / 无 settings.json)。本机 github.com DNS 失效,外网 CDN 慢(~20-40KB/s)。

**本次完成**:

| 项目 | 状态 |
|------|------|
| `npm install` | ✅ 72 包 / 20s(设 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`),Electron v33.4.11 |
| 语音模型 | ✅ `models/sherpa-onnx-streaming-paraformer-bilingual-zh-en/` 三件套(见下) |
| `settings.json` | ✅ 从 example 复制,apiKey 留空,占位配置 |
| 启动验证 | ✅ `npm start` 实测成功:主进程起窗口,`[词库] 加载完成,共 146 个情绪词`,无报错 |
| ASR 验证 | ✅ `initASR()` 用真实离线模型初始化成功(OnlineRecognizer 加载 encoder/decoder/tokens) |

**模型来源**(GitHub/HF 官方 CDN 均慢,改用 ModelScope 镜像,实测 ~8.4MB/s):

```
models/sherpa-onnx-streaming-paraformer-bilingual-zh-en/
├── encoder.int8.onnx   165,462,184 B (~158MB)
├── decoder.int8.onnx    71,664,561 B (~ 68MB)
└── tokens.txt               75,756 B
```

镜像地址:https://modelscope.cn/models/pengzhendong/sherpa-onnx-streaming-paraformer-bilingual-zh-en
(`resolve/master/<文件名>` 直链,与官方 huggingface 同哈希同大小)

**settings.json 说明**:
- 项目内 `settings.json` 为**模板/参考**(含 `_comment` 字段说明);应用运行时实际读写
  `~/Library/Application Support/宇宙无敌表达训练/settings.json`(由应用内 ⚙️ 设置页保存)。
- 默认 provider = deepseek,apiKey 留空;用户首次使用在应用内 ⚙️ 填 key,或用 Ollama(本地,无需 key)。

**已知注意事项**:
- 语音识别完全离线可用(词库分析/字幕无需网络);仅 AI 反馈需要 API key 或本地 Ollama。
- 麦克风权限:首次点击「开始录制」时 macOS 会弹权限请求,需在 系统设置→隐私与安全性→麦克风 允许。
- `npm install` 若遇 Electron 下载慢,先 `export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`。

## 首次使用方法

1. **启动**:在项目目录运行 `npm start`(或 `npm run dev` 带 DevTools)。有 GUI 环境即弹出「宇宙无敌表达训练」窗口。
2. **配置 AI 后端**(可选,仅影响 AI 反馈/报告;词库分析离线可用):点右上角 ⚙️ → 选 DeepSeek(填 key)/ OpenAI / Ollama(本地) / 自定义,保存。
3. **开始使用**:点「开始录制」→ 允许麦克风权限 → 说话,实时字幕+填充词/犹豫词/笼统词统计;说完点「结束」→「生成报告」。
4. **无 key 也能用**:默认 deepseek 无 key 时 AI 反馈会报错,但语音识别与词库分析不受影响。
