[![npm version](https://img.shields.io/npm/v/dsh-live-voice?logo=npm&label=npm&color=brightgreen)](https://www.npmjs.com/package/dsh-live-voice)
[![Tested DSH](https://img.shields.io/badge/Tested_DSH-v0.2.1--rc.2-5c5cff?logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.2)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

# DSH Live Voice - You and Your Team / 实时语音 - 您和您的团队

[English](README.md) | [Português (Brasil)](README.pt.md) | **简体中文**

这是简体中文版。[英文 README](README.md) 是本项目的主要参考文档。

**用语音与 AI 助手交流，聆听回答，并将会议上下文带入对话，无需频繁切回键盘。**

DSH Live Voice 是 DeepSeek Harness（DSH）的本地优先语音插件，提供语音转文字（STT）、文字转语音（TTS）和实时会议转写。

![DSH Live Voice 对话，展示助手语音字幕、播放控件和正在运行的语音识别](https://github.com/user-attachments/assets/6c6f8b2c-a7ff-4478-ad97-882617fff8ea)

*用语音与助手交流、聆听回答并控制对话，无需切回键盘。*

*在巴西开发 🇧🇷，每天在 macOS 上使用巴西葡萄牙语进行测试。*

---

## ⚡ 快速开始

**已在 DeepSeek Harness v0.2.1-rc.2 上测试。**

从 npm 安装已构建的包到 DSH 的 web 配置中（无需编译源码）：

```sh
npx dsh plugin add --profile web dsh-live-voice
```

下次启动 DSH 后，打开 **设置 → Live Voice**。

界面语言：🇺🇸 英语 · 🇧🇷 巴西葡萄牙语 · 🇪🇸 西班牙语 · 🇫🇷 法语 · 🇮🇳 印地语 · 🇨🇳 中文。这里指插件界面，不代表语音识别或语音合成引擎支持的语言。

## 你可以用它做什么？

- **用语音工作：** 口述请求，讨论代码或文档，并在专注工作时聆听助手的回答。
- **让 AI 助手参与会议：** 采集讨论音频、检查转写文本，然后请助手帮助比较方案或总结决定。采集会议音频和共享助手语音需要分别配置；这不是 Meet 或 Teams 的原生集成。
- **掌握控制权：** 发送前检查文本，选择手动或自动发送，并暂停、继续或停止语音回答。监听和打断控件详见[对话流程指南](docs/CONFIGURATION.md)（英文）。
- **选择语音方案：** 在受支持的环境中使用本地识别和合成引擎，或配置 HTTP 服务。本地优先语音不意味着 DSH 或其 AI 服务提供方完全离线运行。

---

## ✨ 功能概览

- 🎙️ **语音输入：** 将最终识别的文本追加到 DSH 消息输入框末尾，不覆盖手动编辑的内容。
- 👐 **免键盘对话：** 连续语音对话可在切换聊天会话后保持启用。
- ❓ **语音回答结构化问题：** 朗读 DSH 的提问，并提交你的口头回答。
- ⌨️ **可选的按住说话（Push-to-Talk）：** 在设置中启用后，在页面任意位置按住 `Control` 说话；松开后，消息会按配置的发送延迟排入发送队列。默认关闭。
- 🎧 **适应音频输出方式：** 使用扬声器时控制监听，避免回声干扰；使用耳机时支持通过开放麦克风打断播放。
- 🗣️ **语音命令：** 使用配置的短语控制发送、静音、清空文本和停止朗读。
- ⭐ **专用语音栏：** 显示平滑滚动的近似字幕和动态高亮，支持上一段、下一段、暂停、继续和停止，并显示当前段数与总段数。字幕显示发送给语音合成引擎的文本，不保证逐词同步。
- 🔊 **语音音量：** 在语音设置中保存 Browser、Say 和 Qwen 的播放音量，从静音到最大音量，不改变麦克风输入。
- 🧹 **适配 Markdown 的朗读：** 去除格式标记，提示链接而不朗读完整 URL，缩短文件路径和行号引用，朗读复选框状态和表格行，并将较长的代码块替换为本地化提示。保留自定义提示。
- ⚡ **可调节的对话节奏：** 自动发送延迟可设为 600 毫秒、800 毫秒或 1–6 秒（默认 4 秒）；助手回答的额外延迟可设为 600 毫秒、1.5、2、3、4 或 5 秒（默认 1.5 秒）。语音识别和合成仍会增加整体延迟。
- 🛠️ **可选的 Live Voice Debugger：** 单独安装 `dsh-live-voice-debugger` 后，可在 Live Voice 设置的 Developer 标签页中查看运行状态和队列。主插件无需调试器也能工作。
- 🏠 **本地优先语音选项：** 在受支持的环境中使用 Qwen 或 Whisper 等本地引擎。浏览器语音识别和配置的 HTTP 服务各有处理要求，并非所有配置都会将音频保留在你的机器上。
- 🌐 **手机上也能使用 DSH 语音助手：** 无论通过家庭网络还是在外访问 DSH，都可以在手机浏览器中继续用语音提问（STT）并聆听回答（TTS）。使用主机端引擎时，语音处理仍在运行 DSH 的电脑上完成，手机负责采集你的声音和播放回答，无需在手机上安装本地模型。*我使用带身份验证的 Cloudflare Tunnel 在外访问自己的 DSH。* 请使用 HTTPS 和经过身份验证的访问方式；即使在家庭网络中，麦克风采集也需要浏览器支持和用户授权。

## 🧑‍💻 会议模式 — 实时会议转写与 AI 问答

在会议进行时保留可编辑的转写文本，直接向 DSH 助手询问讨论内容，无需事后重新描述。适用于代码审查、项目讨论或共同分析电子表格。

### 从讨论到回答

1. 浏览器支持共享音频轨道时，可选择 **Browser** 语音识别；否则使用 **Qwen HTTP** / **Whisper HTTP**。Browser 会在启动时检查支持情况，绝不会静默切换到麦克风；本地处理和语言包仍需满足浏览器要求。
2. 点击消息输入框麦克风旁的共享音频图标，并在浏览器的共享对话框中启用音频。需要记录自己的发言时，也可开启麦克风。
3. 检查输入框中的转写文本，补充问题，并将相关上下文发送给 DSH。例如：*“到目前为止，我们做出了哪些决定？”*、*“帮我们回答这一点”* 或 *“将这个方案与项目代码进行比较。”* 回答取决于你发送的转写文本，以及提供给智能体的代码、电子表格或文档。
4. 在会议继续进行时阅读或聆听回答。如果希望其他参会者也能听到，需要在会议应用中单独配置助手播放音频的共享。

### 由你决定采集和发送什么

- 共享音频和麦克风各有独立控制，可分别停止。常规语音命令和助手语音回答仍然可用。
- 同时采集两种音源时，切换音源会插入 `Me:` 或 `Them:`；同一音源的连续片段另起一行。可在 **Live Voice 设置 → 语音识别 → 会议模式** 中自定义麦克风和共享音频名称（默认：`Me` / `Them`）。离开输入框时保存；留空恢复默认值，最多 80 个单行字符。更改仅用于新的音源段落，不会改写现有文本。这些标签区分的是**音频来源，而不是每位参会者**。
- 可选的 **Timestamp** 时钟开关会为新的音源文本块添加本地时间戳，例如 `[YYYY/MM/DD HH:MM:SS]`。它使用片段开始的时间，而不是识别完成的时间；默认关闭，不会改写已有文本。
- 麦克风与共享音频栏采用相同控件：前导图标切换**监听／忽略**，精确语音命令、时间戳和手动／排队／引导发送可分别控制，两栏均提供倒计时和取消。忽略不会停止采集；请使用消息输入框中的共享音频按钮停止共享。启用的命令和自动发送遵循各音源的独立设置。为参会者音频启用命令前请先检查命令配置。

音频是否可用取决于浏览器、操作系统和共享的窗口、标签页或屏幕。**这不是 Google Meet 或 Teams 的内置集成。** 采集会议音频和将助手的语音共享回会议需要分别配置。请使用耳机减少音频反馈，并在采集会议前取得参会者的适当同意。转写和 AI 回答都存在处理延迟；“实时”不意味着瞬间完成，也不保证准确无误。

## 文档

以下详细指南以英文提供：

- [配置与对话流程指南](docs/CONFIGURATION.md) — 设置概览、扬声器与耳机模式、时序图、静音延迟和外部引擎配置。
- [选择语音识别引擎](docs/CHOOSING-AN-ENGINE.md) — 浏览器 STT、Qwen3 ASR 与 Whisper 的比较、内存需求及操作系统兼容性。
- [项目背后的故事](HISTORY.md) — 项目的起因，以及协调聆听与说话背后的人文故事。
- [版本更新说明](CHANGELOG.md) — 各版本的变更，以英文主历史为准。

---

## 工作区结构（贡献者）

这个 pnpm monorepo 包含两个可独立安装的插件：

- `packages/live-voice`：主语音插件，拥有自己的源码、测试和包清单。
- `packages/live-voice-debugger`：可选调试器，拥有自己的源码、测试和包清单。

在根目录运行 `pnpm install --frozen-lockfile`，然后运行 `pnpm build` 或 `pnpm test`。可通过 `pnpm --filter dsh-live-voice build` 或 `pnpm --filter dsh-live-voice-debugger build` 单独构建插件。根目录文档涵盖两个包。根目录的英文 `CHANGELOG.md` 是主要版本历史，包内 README 会链接到该历史。生成的 `packages/*/lib/` 目录会被忽略，任何版本发布都不应将其提交到 Git。用户应从 npm 安装已构建的包，而不是直接从 Git 安装。贡献者必须先构建，再将本地包目录链接到 DSH；请参阅[开发指南](DEVELOPMENT.md)（英文）。

## 🤝 致谢与社区

聆听和说话应当协同工作。衷心感谢 [GooDAnDReaDY](https://github.com/GooDAnDReaDY) 的 [dsh-voice](https://github.com/GooDAnDReaDY/dsh-voice) 和 [Alan2Z](https://github.com/Alan2Z) 的 [dsh-speak](https://github.com/Alan2Z/dsh-speak)，它们启发了这个统一的协调器。[阅读完整故事](HISTORY.md)。

我每天使用 DSH Live Voice 至少 8 小时。欢迎反馈、建议和贡献：

- [提交 Issue](https://github.com/victorwads/dsh-live-voice/issues)
- [提交 Pull Request](https://github.com/victorwads/dsh-live-voice/pulls)

---

real-time meeting transcription, live meeting transcription, AI questions during meetings, meeting assistant, meeting Q&A, shared audio capture, speech-to-text, text-to-speech, local-first voice assistant, DeepSeek Harness plugin.
transcrição de reuniões em tempo real, transcrição ao vivo, perguntas à IA durante reuniões, assistente de reuniões, perguntas e respostas sobre reuniões, captura de áudio compartilhado, reconhecimento de fala, síntese de voz, assistente de voz com prioridade local, plugin para DeepSeek Harness.
实时会议转写、实时语音转文字、会议中向 AI 提问、AI 会议助手、会议问答、共享音频采集、语音识别、语音合成、本地优先语音助手、DeepSeek Harness 插件。

许可证：[Apache-2.0](LICENSE)
