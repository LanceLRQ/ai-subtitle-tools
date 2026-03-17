# AI Subtitle Tools

中文 | [English](README_EN.md)

跨平台的视频字幕自动生成与翻译工具。通过 FFmpeg 提取音频、调用 FunASR API服务进行语音识别、调用 LLM 进行翻译，最终导出双语 SRT 字幕文件。

## 功能特性

- **语音识别** — 接入 FunASR API，支持 Qwen3-ASR、Paraformer 等模型
- **智能断句** — 按标点拆分长文本，贪心合并为合理长度的字幕行，基于逐字时间戳精确分配时间
- **字幕翻译** — 兼容 OpenAI 格式的 LLM API，批量翻译，支持深度思考模型（自动过滤 `<think>` 标签）
- **专有名词对照表** — 可定义 `原文 -> 译文` 对照表，翻译时自动注入 LLM 提示词，确保角色名、地名等专有名词翻译一致
- **双语字幕** — 支持导出原文 + 译文双语 SRT
- **多语言** — 目标语言可选中文、英语、日语、韩语、西班牙语、葡萄牙语，也可自定义输入
- **中英界面** — 支持中文 / English 界面切换
- **跨平台** — 基于 Tauri，支持 Windows、macOS、Linux
- **调试模式** — 可保存 ASR 原始 JSON 和 LLM 请求日志，便于排查问题

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js + React + TypeScript + Tailwind CSS |
| 桌面框架 | Tauri 2 (Rust) |
| 语音识别 | FunASR API |
| 翻译 | OpenAI 兼容 Chat Completions API |
| 音频处理 | FFmpeg |

## 处理流程

```
视频文件 → FFmpeg 提取音频 → FunASR 语音识别 → 标点断句与合并 → LLM 翻译(可选) → 导出 SRT 字幕
```

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.77
- [FFmpeg](https://ffmpeg.org/)（可配置路径，也支持自动检测）
- FunASR API 服务（参见下方 [Docker 部署](#docker-部署服务)）

### 开发

```bash
cd app
npm install
npm run tauri dev
```

### 构建

```bash
cd app
npm run build
npm run tauri build
```

构建产物位于 `app/src-tauri/target/release/bundle/`。

## Docker 部署服务

项目提供 Docker Compose 配置，一键启动 FunASR 语音识别和 llama.cpp 翻译服务（需要 NVIDIA GPU）：

```bash
cd services

# 启动服务
./manage.sh start

# 查看状态
./manage.sh status

# 查看日志
./manage.sh logs

# 停止服务
./manage.sh stop
```

| 服务 | 端口 | 说明 |
|------|------|------|
| FunASR API | 17000 | 语音识别服务，默认加载 Qwen3-ASR 1.7B |
| llama.cpp Server | 17001 | LLM 翻译服务，使用 [translategemma-4b-it](https://huggingface.co/mradermacher/translategemma-4b-it-GGUF) 量化模型 |

> 使用 llama.cpp 服务前，需下载 [translategemma-4b-it-GGUF](https://huggingface.co/mradermacher/translategemma-4b-it-GGUF) 模型文件放入 `services/llama_model/` 目录。

## 配置说明

应用配置自动保存到系统配置目录：

- **Windows**: `%APPDATA%/ai-subtitle-tools/config.json`
- **macOS**: `~/Library/Application Support/ai-subtitle-tools/config.json`
- **Linux**: `~/.config/ai-subtitle-tools/config.json`

### 配置项

| 分类 | 配置项 | 默认值 | 说明 |
|------|--------|--------|------|
| FFmpeg | 路径 | (自动检测) | 留空则按 用户配置 → 本地目录 → 系统 PATH 顺序检测 |
| FunASR | API URL | `http://127.0.0.1:17000` | FunASR 服务地址 |
| FunASR | 模型 | `qwen3-asr-1.7b` | 可选 qwen3-asr-0.6b、paraformer-large |
| LLM | Base URL | `https://api.openai.com/v1` | OpenAI 兼容 API 地址 |
| LLM | 模型 | `gpt-4o-mini` | 任意兼容模型 |
| 翻译 | 每批数量 | 100 | 每次 API 请求翻译的字幕条数 (1-200) |
| 翻译 | 目标语言 | 中文 | 支持自定义输入 |
| 翻译 | 专有名词对照表 | (空) | 每行一个 `原文 -> 译文`，翻译时注入 LLM 提示词 |
| 字幕 | 每行最大字符数 | 30 | ASR 长文本按标点拆分后的合并上限 |

## 项目结构

```
ai-subtitle-tools/
├── app/                        # 桌面应用
│   ├── src/
│   │   ├── app/                # Next.js 页面
│   │   ├── components/         # UI 组件
│   │   │   ├── FilePicker      #   文件选择
│   │   │   ├── GlossaryPanel   #   专有名词对照表
│   │   │   ├── SettingsPanel   #   设置面板
│   │   │   ├── ProgressBar     #   进度条
│   │   │   └── SubtitlePreview #   字幕预览表格
│   │   ├── hooks/
│   │   │   └── usePipeline     # 流水线调度
│   │   └── lib/
│   │       ├── ffmpeg          #   FFmpeg 执行
│   │       ├── ffmpegDetector  #   FFmpeg 三级检测
│   │       ├── funasr          #   FunASR API 客户端
│   │       ├── translator      #   LLM 翻译 (重试+批量)
│   │       ├── subtitle        #   SRT 解析/生成
│   │       ├── subtitleSplitter#   标点断句+贪心合并
│   │       ├── config          #   配置管理
│   │       ├── debugLog        #   调试日志
│   │       └── types           #   类型定义
│   └── src-tauri/              # Tauri Rust 后端
│       └── src/
│           ├── lib.rs          #   入口 + 命令注册
│           ├── config.rs       #   配置读写
│           ├── ffmpeg.rs       #   FFmpeg 执行 + 进度事件
│           └── file_ops.rs     #   文件操作 (含安全校验)
├── services/                   # Docker 服务配置
│   ├── docker-compose.yml
│   └── manage.sh
└── LICENSE                     # MIT
```

## 支持的视频格式

MP4、MKV、AVI、MOV、FLV、WMV、WebM

## 鸣谢

- [Quantatirsk/funasr-api](https://github.com/Quantatirsk/funasr-api) — 基于 FunASR 与 Qwen3-ASR 的语音识别 API 服务，支持 52 种语言，兼容 OpenAI API 与阿里云语音 API。

## 许可证

[MIT](LICENSE)
