# 配置参考指南

`dsh-combo` 拥有非常丰富的视觉、音频、节奏与沉浸式效果调节项。所有设置既可以在界面中实时热更新，也可以声明在 profile 的 `cordis.patch.yml` 中。

[English](configuration.md)

---

## 配置生效途径

### 1. Web 界面 / Desktop 桌面端独立配置页（推荐）

1. 点击侧栏的 **插件 (Plugins)**。
2. 选中 `dsh-combo` 组合包，进入 **配置** 面板。
3. 全部设置（动效预设、调色板、音色、音量、门槛阈值等）按功能划分为清晰的 Tab 页面。
4. 点击保存后直接写入 profile 行配置，**无需重启、无需刷新页面立即热生效**。
5. 页面内置交互式迷你 HUD 连击模拟器与 **试听** 按钮，便于实时调优。

### 2. HUD 悬浮齿轮快捷面板

点击连击悬浮窗旁的齿轮图标（⚙️）可呼出快捷面板：
- 针对当前浏览器快速调优，保存在 `localStorage` 中。
- 顶部配有一键预设切换栏，点击即切即看。
- 在插件配置页保存某个字段会自动清除该字段的本地覆盖。
- 点击 **恢复默认设置** 可一键丢弃全部本地覆盖，恢复为 profile 统一配置。

### 3. Profile 补丁文件 (`cordis.patch.yml`)

在 profile 的 `cordis.patch.yml` 中添加 `dsh-combo` 挂载行。未声明的字段将自动回退为 schema 默认值：

```yaml
- id: dsh-combo
  config:
    enabled: true
    # hybrid (混合) | tokens (流式Token) | tools (经典工具)
    comboMode: hybrid
    # particles | fireworks | slash | aura | glitch
    preset: particles
    # classic | cyberpunk | sunset | matrix | frost
    colorTheme: classic
    # top-right | top-left | bottom-right | bottom-left
    position: top-right
    # 声音默认关闭
    sound: false
    # blip | keyboard | bubble | arcade | laser | melodic
    soundTheme: blip
    soundVolume: 0.35
    # 倒计时基准时长 (毫秒)
    timerMs: 10000
    # 0 = 无限模式 (空闲不归零); >0 为超时毫秒数
    expireMs: 0
```

> **注意**：DSH 的 patch layer 会完整替换该行的 `config` 对象。若手动编写 patch，请将需锁定的核心设置一并保留。

---

## 核心设置

| 配置项 | 默认值 | 类型 | 说明 |
|---|---:|---|---|
| `enabled` | `true` | boolean | 开关连击悬浮 HUD 窗口。 |
| `comboMode` | `hybrid` | enum | 连击计算模式：`hybrid`（混合模式：流式打字暴击 + 工具调用全开）、`tokens`（纯 Token 打字模式）、`tools`（经典模式：仅工具调用与完整思考回合累加）。 |
| `tokensPerCombo` | `1` | number | 流式打字输出时每多少个 Token 计为一次连击（`1`–`50`）。 |
| `showToolName` | `true` | boolean | 在计数器下方显示调用的工具名或「思考」状态。 |
| `position` | `top-right` | enum | 悬浮窗停靠屏幕角落：`top-right`（右上）、`top-left`（左上）、`bottom-right`（右下）、`bottom-left`（左下）。 |
| `offsetX` | `18` | number | 距屏幕左右边缘的像素距离（`0`–`240` px）。 |
| `offsetY` | `10` | number | 距屏幕上下边缘的像素距离（`0`–`240` px）。 |
| `scale` | `1` | number | 悬浮窗和粒子动效的整体缩放倍率（`0.5`–`2.0` 倍）。 |
| `excludeTools` | `[]` | string[] | 忽略的工具名列表（不区分大小写），调用这些工具时不累加连击。 |
| `pinPromptMs` | `5000` | number | turn 结束时，至少有 2 次调用的连击可被 Pin 的停留挽留时长（`0`–`60000` ms；设为 `0` 不提示）。 |

---

## 倒计时与节拍

| 配置项 | 默认值 | 类型 | 说明 |
|---|---:|---|---|
| `expireMs` | `0` | number | 空闲重置时间（毫秒）；`0` 为无限模式（永不清零）。支持快捷预设 `[ ∞ 无限 | 5秒 | 10秒 | 30秒 | 60秒 ]`。最大值 `600000`。 |
| `timerMs` | `10000` | number | 倒计时进度条基准时长（`1000`–`60000` ms）；启用空闲重置时优先遵循 `expireMs`。 |
| `showTimer` | `true` | boolean | 是否在悬浮窗顶部展示倒计时进度条。 |
| `barHeight` | `7` | number | 倒计时进度条的高度粗细（`2`–`16` px）。 |
| `powerThreshold` | `0` | number | 从第几次连击开始迸发粒子或触发特效（`0`–`1000`）。 |
| `effectFrequency` | `1` | number | 每隔多少次连击触发一次特效冲击（`1`–`20`）。 |

---

## 视觉预设与动效

| 配置项 | 默认值 | 类型 | 说明 |
|---|---:|---|---|
| `preset` | `particles` | enum | 连击爆发视觉主题：`particles`、`fireworks`、`slash`、`aura` 或 `glitch`。 |
| `animation` | `normal` | enum | 反馈动画强度：`off`（关闭）、`normal`（普通）、`strong`（强烈）。 |
| `particles` | `true` | boolean | 粒子特效总开关。 |
| `particleCount` | `0` | number | 每次爆发的粒子碎片数量（`0`–`80`；设为 `0` 根据段位自适应递增）。 |
| `particleSize` | `4` | number | 粒子碎片基准尺寸（`1`–`12` px）。 |
| `particleSpread` | `1` | number | 粒子扩散辐射范围比例（`0.25`–`2.0` 倍）。 |
| `effectDurationMs`| `820` | number | 粒子从迸发到消散的动画时长（`200`–`2500` ms）。 |
| `shake` | `true` | boolean | 连击命中时的微动物理打击震颤开关。 |
| `shakeIntensity` | `3` | number | 物理抖动微动振幅（`0`–`12` px）。 |

### 5 大动效预设特色
- **`particles`（晶莹粒子）**：经典方块粒子随物理重力抛物线向外迸发衰落。
- **`fireworks`（绚烂烟花）**：高密度球形全向扩散，附带明亮拖尾微光。
- **`slash`（光刃斩击）**：高能激光光刃疾速切击，伴随中心十字闪光。
- **`aura`（超赛气焰）**：等离子能量巨柱纵向翻涌升腾。
- **`glitch`（赛博故障）**：数码扫描线错位撕裂与色相色散。

---

## 调色板与色彩定制

| 配置项 | 默认值 | 类型 | 说明 |
|---|---:|---|---|
| `colorTheme` | `classic` | enum | 动态调色板主题：`classic`、`cyberpunk`、`sunset`、`matrix`、`frost`。 |
| `glow` | `1` | number | 数字与特效周围的发光光晕强度（`0`–`2.0`）。 |
| `accentColor` | `''` | string | 自定义特效与进度条颜色（`#RRGGBB` 格式）。留空则按连击数自动变色。 |
| `numberColor` | `''` | string | 自定义连击数字主色（`#RRGGBB` 格式）。留空则按连击数自动变色。 |

### 5 套调色板主题
- **`classic`（经典能量）**：翡翠绿 → 青柠 → 琥珀金 → 烈焰橙 → 秘境深紫 → 幻彩流光。
- **`cyberpunk`（赛博霓虹）**：荧光青 → 热力粉 → 电力紫 → 赛博金。
- **`sunset`（暮光烈阳）**：晨曦金 → 暖阳橙 → 炽烈红 → 玫瑰玫红。
- **`matrix`（极客矩阵）**：荧光翠绿 → 深林幽绿 → 薄荷电光 → 冰冷白光。
- **`frost`（冰川极光）**：天蓝极光 → 极地青碧 → 冰川幽蓝 → 霜雪晶白。

---

## Web Audio 打击音效合成

基于原生 Web Audio 动态声学合成，无需下载任何外部音频文件。

| 配置项 | 默认值 | 类型 | 说明 |
|---|---:|---|---|
| `sound` | `false` | boolean | 启用连击打击音效（默认关闭，需用户主动开启）。 |
| `soundTheme` | `blip` | enum | 音效风格主题：`blip`、`keyboard`、`bubble`、`arcade`、`laser`、`melodic`。 |
| `soundVolume` | `0.35` | number | 输出音量响度（`0`–`1.0`）。 |
| `soundFrom` | `10` | number | 起播门槛：达到多少次连击后才开始播放声音（`0`–`1000`）。 |

### 6 种音色风格
- **`blip`**：清脆轻柔的合成下行敲击音。
- **`keyboard`**：模拟真实机械键盘敲击轴音与触底声。
- **`bubble`**：治愈系水滴破裂水泡声。
- **`arcade`**：8-bit 经典复古红白机街机琶音。
- **`laser`**：科幻未来等离子能量脉冲射击声。
- **`melodic`**：灵动上扬的五声音阶晶体风铃音。

---

## 高阶沉浸式增强

| 配置项 | 默认值 | 类型 | 说明 |
|---|---:|---|---|
| `showGain` | `true` | boolean | 连击跳动时显示 `+N` 浮动数字增量。 |
| `screenVignette`| `false` | boolean | 高连击（10+）时在屏幕四周边沿浮现动态呼应的能量光晕。 |
| `showMilestones`| `false` | boolean | 达到 10/20/50/100 等连击里程碑时浮现成就称号。 |
| `showCrit` | `false` | boolean | 高吞吐批量跃升时在增量前标记暴击角标（`CRIT!`）。 |
| `recapCard` | `false` | boolean | 连击结束时展示本轮连击战绩总结卡。 |
