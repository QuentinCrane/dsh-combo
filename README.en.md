# dsh-combo

[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/quentincrane/dsh-combo)
[![npm version](https://img.shields.io/npm/v/dsh-combo.svg?style=flat&color=38bdf8)](https://www.npmjs.com/package/dsh-combo)
[![CI](https://github.com/QuentinCrane/dsh-combo/actions/workflows/ci.yml/badge.svg)](https://github.com/QuentinCrane/dsh-combo/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/QuentinCrane/dsh-combo.svg?style=flat&color=10b981)](LICENSE)
[![DSH Compatibility](https://img.shields.io/badge/DSH-Web%20%7C%20Desktop-purple.svg)](https://github.com/deepseek-ai/deepseek-harness)

[简体中文](README.md) | English

A lightweight DeepSeek Harness (DSH) plugin providing PowerMode-style combo feedback for streaming text and tool calls in DSH Web and DSH Desktop. Features real-time token combos, 5 dynamic visual presets, 5 color themes, 6 synthesized Web Audio styles, and a live HUD simulator.

## 🎮 Visual Showcase

![Combo Demo](docs/combo-countdown.gif)

- **Dynamic HUD Feedback**: Multiplier pops and scales with typing rhythm and tool execution velocity.
- **5 Particle Presets**: Choose between crystalline `particles`, full-spectrum `fireworks`, directional laser `slash`, plasma `aura`, or cyberpunk `glitch`.
- **Pure Web Audio**: Real-time auditory strikes synthesized locally with zero sound file dependencies.

## ✨ Features

- **Real-Time Streaming Token Hits**: Listens to streaming chunks (`assistant/live-chunk`) to compute token-level combos as the model types, delivering immediate visual and audio hits! Supports `hybrid` (tokens + tools), `tokens`, and `tools` modes.
- **Rhythm & Countdown Bar**: Turn-based by default. Set `expireMs` for an idle timeout bar with quick presets (`[ ∞ Infinite | 5s | 10s | 30s | 60s ]`). Tune `tokensPerCombo` for custom strike ratios.
- **5 Visual Presets & 5 Color Themes**: Choose from `particles`, `fireworks`, `slash`, `aura`, and `glitch` presets, paired with `classic`, `cyberpunk`, `sunset`, `matrix`, or `frost` dynamic themes scaling up to 500+ combos.
- **6 Synthesized Web Audio Sound Themes**: Pure Web Audio synthesis (`blip`, `keyboard`, `bubble`, `arcade`, `laser`, `melodic`) with zero external sound files.
- **Immersion Enhancements**: Optional full-screen ambient energy vignette, milestone achievement badges, critical hit (`CRIT!`) popups, and streak recap cards.
- **Interactive Configuration Page & Mini Simulator**: Dedicated configuration page under **Plugins → dsh-combo** with a live interactive HUD mini-simulator and sound auditioning, plus an on-HUD quick-tune panel.
- **Safe & Self-Contained**: Pure client-side presentation without touching model prompts or contacting external networks. Streak pins persist across turns in `localStorage`.

## 🚀 Installation

Install using the official DSH CLI. Web and Desktop have separate profiles:

```sh
# For DSH Web
dsh plugin --profile web add github:QuentinCrane/dsh-combo

# For DSH Desktop
dsh plugin --profile desktop add github:QuentinCrane/dsh-combo
```

> **Desktop Note**: Launch DSH Desktop once to initialize its profile, fully quit it, and run Desktop's bundled `dsh` CLI (enable it via **Manage dsh Command** in the app if not on your PATH). See the [Desktop guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.md#bundled-command-runtime).

To install from a local repository checkout:

```sh
dsh plugin --profile <profile> add link:/absolute/path/to/dsh-combo
```

## ⚙️ Configuration

`dsh-combo` is designed to be configured effortlessly without manual file editing:

1. **In-App Configuration Page (Recommended)**: Go to **Plugins** in the sidebar → select `dsh-combo` → **配置**. Changes save directly to your profile and apply live without page reloads or restarts.
2. **HUD Quick-Tune Popover**: Click the gear (⚙️) on the combo counter for instant per-browser tuning, theme previewing, and 1-click preset switching.
3. **Profile Patch (`cordis.patch.yml`)**: Declare custom defaults in your profile's patch file.

```yaml
- id: dsh-combo
  config:
    enabled: true
    comboMode: hybrid        # hybrid | tokens | tools
    preset: particles        # particles | fireworks | slash | aura | glitch
    colorTheme: classic      # classic | cyberpunk | sunset | matrix | frost
    position: top-right      # top-right | top-left | bottom-right | bottom-left
    sound: false             # opt-in audio switch
    soundTheme: blip         # blip | keyboard | bubble | arcade | laser | melodic
    soundVolume: 0.35
    timerMs: 10000           # countdown duration (ms)
    expireMs: 0              # 0 = infinite (no idle timeout)
```

👉 **For the complete 38-property schema, defaults, and ranges, see the [Configuration Reference](docs/configuration.md) ([中文](docs/configuration.zh-CN.md)).**

## 🎨 Presets & Visual Tiers

### Visual Presets & Audio Themes

| Visual Preset | Mechanics | Audio Theme | Sound Profile |
|---|---|---|---|
| **`particles`** | Crystalline sparks radiating outward | **`blip`** | Soft clean percussive chimes |
| **`fireworks`** | Spherical burst with glowing embers | **`keyboard`** | Mechanical click & bottom-out thock |
| **`slash`** | Dual high-speed laser blade incision | **`bubble`** | Satisfying liquid pop |
| **`aura`** | Plasma flame pillar billowing upward | **`arcade`** | Retro 8-bit chiptune arpeggio |
| **`glitch`** | Cyberpunk scanline tear & displacement| **`laser`** | Futuristic plasma beam shot |
| — | — | **`melodic`** | Harmonious rising pentatonic scale |

### Combo Tiers

| Count | Tier | Visual Evolution |
|---|---|---|
| **1–9** | Calm | Emerald digits, progress bar, subtle glow, and square sparks |
| **10–19** | Warm | Larger lime digits, brighter halo, and expanded particle bursts |
| **20–49** | Hot | Amber luminescence, physical hit micro-shake, and dense explosions |
| **50–99** | Blaze | Fiery orange glow, largest multiplier scale, and heavy particle wash |
| **100–199** | Cosmic | Deep cosmic violet aura and glowing core |
| **200–299** | Cyber | High-voltage cyber cyan luminescence |
| **300–499** | Inferno | Blazing inferno crimson energy |
| **500+** | Prismatic | Full-spectrum hyper prismatic rainbow overdrive |

> Pin your streak using the 📌 button to accumulate counts across turns!

## 📚 Documentation

- 📖 **[Configuration Reference](docs/configuration.md)** ([中文](docs/configuration.zh-CN.md)) — Full settings dictionary, Schemastery types, and YAML examples.
- 🛠️ **[Development Notes](docs/development.md)** — Architectural path, session projections, and runtime shims.
- ❓ **[Troubleshooting Guide](docs/troubleshooting.md)** — Solutions for missing HUD, sound issues, or profile persistence.
- 🚀 **[Publishing Guide](docs/publishing.md)** — Release checklist and npm distribution.

## 📄 License

MIT © [Quentin Crane](https://github.com/QuentinCrane)
