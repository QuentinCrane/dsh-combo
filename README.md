# dsh-combo

[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/quentincrane/dsh-combo)
[![npm version](https://img.shields.io/npm/v/dsh-combo.svg?style=flat&color=38bdf8)](https://www.npmjs.com/package/dsh-combo)
[![CI](https://github.com/QuentinCrane/dsh-combo/actions/workflows/ci.yml/badge.svg)](https://github.com/QuentinCrane/dsh-combo/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/QuentinCrane/dsh-combo.svg?style=flat&color=10b981)](LICENSE)
[![DSH Compatibility](https://img.shields.io/badge/DSH-Web%20%7C%20Desktop-purple.svg)](https://github.com/deepseek-ai/deepseek-harness)

简体中文 | [English](README.en.md)

dsh-combo 是 DeepSeek Harness（DSH）的轻量级连击反馈插件，为 DSH Web 界面和 DSH Desktop 桌面端带来 PowerMode 风格的打字暴击与工具调用连击体验。支持实时 Token 连击、5 大视觉动效预设、5 款调色板主题、6 种 Web Audio 合成音色以及内置交互模拟器。

## 🎮 效果演示

![Combo Demo](docs/combo-countdown.gif)

- **实时动态打击感**：连击倍率随模型流式打字与工具调用实时暴击迸发，支持微动物理震颤。
- **5 款爆发力学预设**：晶莹粒子、球形烟花、激光光刃斩击、超赛气焰升腾或赛博故障撕裂。
- **纯本地 Web Audio**：零音频文件依赖，高保真动态声学合成，伴随敲击节奏起伏。

## ✨ 功能亮点

- **实时流式 Token 暴击**：监听 `assistant/live-chunk` 流式输出，实时打字暴击爽感拉满！同时兼容 Host 提供的 `dshCombo` 会话投影与持久化工具调用（支持 `hybrid` 混合、`tokens` 纯打字、`tools` 经典工具回合三种模式）。
- **倒计时进度条与灵活节拍**：默认按 turn 计数；支持通过 `expireMs` 启用空闲倒计时（配有一键预设 `[ ∞ 无限 | 5秒 | 10秒 | 30秒 | 60秒 ]`）；支持通过 `tokensPerCombo` 自定义每次连击所需 token 比例。
- **5 大视觉动效预设 & 5 套调色板**：支持 `particles`（晶莹粒子）、`fireworks`（绚烂烟花）、`slash`（光刃斩击）、`aura`（超赛气焰）、`glitch`（赛博故障）五大动效力学，搭配 `classic`、`cyberpunk`、`sunset`、`matrix`、`frost` 调色板，支持多段位跃升至 500+。
- **6 款纯 Web Audio 合成打击音效**：纯本地声学合成（`blip`、`keyboard`、`bubble`、`arcade`、`laser`、`melodic`），零外部音频文件依赖。
- **沉浸式高阶增强**：支持屏幕边缘能量晕影（Screen Vignette）、连击里程碑成就称号浮现、高吞吐批量暴击角标（CRIT!）以及战绩结算卡。
- **独立配置页与内嵌交互模拟器**：在侧栏**插件 → dsh-combo**拥有专属配置中心，内置交互式迷你 HUD 连击模拟器与实时音效试听；HUD 悬浮窗亦带有一键快捷面板。
- **轻量纯净与跨端运行**：纯客户端呈现，不修改模型上下文，不发起第三方网络请求，Pin 状态跨会话本地持久化。

## 🚀 安装指南

通过官方 `dsh plugin` CLI 命令安装。Web 和 Desktop 使用不同 profile：

```sh
# DSH Web 界面
dsh plugin --profile web add github:QuentinCrane/dsh-combo

# DSH Desktop 桌面端
dsh plugin --profile desktop add github:QuentinCrane/dsh-combo
```

> **Desktop 提示**：首次使用 DSH Desktop 时，先启动一次应用以初始化 profile，退出后运行 Desktop 附带的 `dsh` 命令（若终端中未识别，可在应用的 **Manage dsh Command** 中启用）。详见 [官方 Desktop 指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md#bundled-command-runtime)。

如需安装本地开发源码目录，传入包含 `package.json` 的绝对路径：

```sh
dsh plugin --profile <profile> add link:/absolute/path/to/dsh-combo
```

## ⚙️ 配置方式

无需手动编辑配置文件，插件提供了完善的可视化配置体验：

1. **界面独立配置页（推荐）**：打开侧栏 **插件** → 选中 `dsh-combo` → **配置**。保存直接写入 profile 配置，**即时生效，无需重启或刷新页面**。
2. **HUD 悬浮窗齿轮面板**：点击连击悬浮窗旁的齿轮（⚙️）可在当前浏览器快速调优并一键切换预设。
3. **Profile 补丁文件 (`cordis.patch.yml`)**：在 profile 中声明全局缺省配置。

```yaml
- id: dsh-combo
  config:
    enabled: true
    comboMode: hybrid        # hybrid (混合) | tokens (打字) | tools (工具)
    preset: particles        # particles | fireworks | slash | aura | glitch
    colorTheme: classic      # classic | cyberpunk | sunset | matrix | frost
    position: top-right      # top-right | top-left | bottom-right | bottom-left
    sound: false             # 音效开关 (默认关闭)
    soundTheme: blip         # blip | keyboard | bubble | arcade | laser | melodic
    soundVolume: 0.35
    timerMs: 10000           # 倒计时基准时长 (毫秒)
    expireMs: 0              # 0 = 无限模式 (空闲不归零)
```

👉 **查看完整的 38 项配置参数字典、默认值及取值范围，请参阅 [配置参考指南](docs/configuration.zh-CN.md) ([English](docs/configuration.md))。**

## 🎨 动效预设与连击段位

### 5 大视觉预设与 6 款音色主题

| 视觉预设 | 动效力学表现 | 音效风格 | 声学特色 |
|---|---|---|---|
| **`particles`** | 晶莹方块粒子受重力向外抛洒 | **`blip`** | 轻柔清脆的合成下行打击敲击音 |
| **`fireworks`** | 全向球形烟花爆发，带有微光余烬 | **`keyboard`** | 模拟机械键盘清脆轴音与触底声 |
| **`slash`** | 疾速双激光光刃切击，中心十字闪光 | **`bubble`** | 治愈系灵动水滴水泡破裂声 |
| **`aura`** | 等离子能量巨柱纵向翻涌升腾 | **`arcade`** | 8-bit 复古红白机街机音阶 |
| **`glitch`** | 赛博数码扫描线错位撕裂与色散 | **`laser`** | 未来科幻等离子能量脉冲射击声 |
| — | — | **`melodic`** | 灵动上扬的五声音阶晶体风铃音 |

### 连击段位阶梯

| 连击次数 | 段位名称 | 视觉与能量演化 |
|---|---|---|
| **1–9** | Calm 宁静 | 翡翠绿倍率数字、顶部进度亮条、晶莹方块粒子 |
| **10–19** | Warm 活跃 | 更大尺寸黄绿倍率、高亮光晕、粒子数量翻倍 |
| **20–49** | Hot 炽热 | 琥珀金光晕、轻微物理打击微动、更密集的爆发粒子 |
| **50–99** | Blaze 燃爆 | 烈焰橙光晕、最大尺寸连击倍率、高密度粒子浪涌 |
| **100–199** | Cosmic 宇宙 | 秘境深紫高阶能量光冕与粒子内核 |
| **200–299** | Cyber 赛博 | 高能赛博电青霓虹高亮闪烁 |
| **300–499** | Inferno 炼狱 | 极怒炼狱猩红裂隙能量 |
| **500+** | Prismatic 幻彩 | 全光谱超维流光彩虹过载光效 |

> 点击连击窗上的 📌 图标可将 Streak 锁定跨 turn 累积！

## 📚 文档索引

- 📖 **[配置参考指南](docs/configuration.zh-CN.md)** ([English](docs/configuration.md)) — 完整 38 项字段字典、Schemastery 类型与 YAML 声明。
- 🛠️ **[架构与开发笔记](docs/development.md)** — 会话投影运行时路径、服务注入与本地开发。
- ❓ **[问题排查指南](docs/troubleshooting.md)** — HUD 未显示、声音无输出或配置不生效等常见问题。
- 🚀 **[打包发布指南](docs/publishing.md)** — 规范化发布流程与 npm 分发。

## 📄 开源许可

MIT © [Quentin Crane](https://github.com/QuentinCrane)
