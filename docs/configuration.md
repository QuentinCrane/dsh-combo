# Configuration Reference

`dsh-combo` offers extensive visual, audio, rhythm, and immersion customizations. Settings can be adjusted live in the GUI or declared in your profile's `cordis.patch.yml`.

[简体中文](configuration.zh-CN.md)

---

## Configuration Methods

### 1. In the Web / Desktop GUI (Recommended)

1. Open **Plugins** in the sidebar.
2. Select the `dsh-combo` bundle and navigate to the **配置 (Configuration)** section.
3. Every setting — including visual presets, color themes, sound effects, volume, and thresholds — is available across organized tabs.
4. Saving commits directly to the profile row config and applies immediately with **no restart and no page refresh**.
5. Use the built-in mini HUD simulator and **试听 (Audition)** button to test adjustments in real time.

### 2. HUD Quick-Tune Popover

Click the gear icon (⚙️) next to the floating combo counter to open the on-screen quick-tune popover:
- Allows immediate, per-browser tuning stored in `localStorage`.
- Includes a 1-click preset bar for instant theme changes.
- Saving a setting from the main Plugins configuration page clears local overrides for that key.
- **恢复默认设置 (Reset Defaults)** clears all local overrides and restores configured profile defaults.

### 3. Profile Patch (`cordis.patch.yml`)

Add a row for `dsh-combo` in your profile's `cordis.patch.yml`. Omitted settings automatically fall back to schema defaults:

```yaml
- id: dsh-combo
  config:
    enabled: true
    # hybrid | tokens | tools
    comboMode: hybrid
    # particles | fireworks | slash | aura | glitch
    preset: particles
    # classic | cyberpunk | sunset | matrix | frost
    colorTheme: classic
    # top-right | top-left | bottom-right | bottom-left
    position: top-right
    # sound is opt-in: false by default
    sound: false
    # blip | keyboard | bubble | arcade | laser | melodic
    soundTheme: blip
    soundVolume: 0.35
    # Countdown duration on thoughts/tools (ms)
    timerMs: 10000
    # 0 = purely turn-based. >0 breaks a run after idle gap (ms)
    expireMs: 0
```

> **Note**: DSH patch layers replace a row's complete `config` object. Include any setting you wish to explicitly lock in.

---

## Core Settings

| Setting | Default | Type | Description |
|---|---:|---|---|
| `enabled` | `true` | boolean | Toggle the floating combo HUD overlay. |
| `comboMode` | `hybrid` | enum | Calculation mode: `hybrid` (streaming tokens + tool calls), `tokens` (streaming tokens only), or `tools` (classic tool calls & completed model rounds only). |
| `tokensPerCombo` | `1` | number | Streaming tokens needed per combo hit (`1`–`50`). |
| `showToolName` | `true` | boolean | Display the active tool name or "思考" (thinking) label below the count. |
| `position` | `top-right` | enum | Screen corner: `top-right`, `top-left`, `bottom-right`, or `bottom-left`. |
| `offsetX` | `18` | number | Horizontal margin from the screen edge (in pixels, `0`–`240`). |
| `offsetY` | `10` | number | Vertical margin from the screen edge (in pixels, `0`–`240`). |
| `scale` | `1` | number | Overall scale multiplier of the HUD and particle effects (`0.5`–`2.0`). |
| `excludeTools` | `[]` | string[] | Array of tool names to ignore from combo increments (case-insensitive). |
| `pinPromptMs` | `5000` | number | Window (ms) after turn boundary offering to pin streaks of 2+ calls (`0`–`60000`; `0` disables prompt). |

---

## Timing and Rhythm

| Setting | Default | Type | Description |
|---|---:|---|---|
| `expireMs` | `0` | number | Idle timeout in ms; `0` enables Infinite mode (never expires on idle). Preset buttons: `[ ∞ Infinite | 5s | 10s | 30s | 60s ]`. Max: `600000`. |
| `timerMs` | `10000` | number | Base duration (ms) for the countdown bar to drain (`1000`–`60000`). Overridden by `expireMs` when idle timeout is enabled. |
| `showTimer` | `true` | boolean | Toggle the countdown progress bar above the counter. |
| `barHeight` | `7` | number | Thickness of the countdown progress bar in pixels (`2`–`16`). |
| `powerThreshold` | `0` | number | Minimum combo count required before emitting visual particle effects (`0`–`1000`). |
| `effectFrequency` | `1` | number | Emit effects every N combo hits (`1`–`20`). |

---

## Visual Presets and Animation

| Setting | Default | Type | Description |
|---|---:|---|---|
| `preset` | `particles` | enum | Visual preset: `particles`, `fireworks`, `slash`, `aura`, or `glitch`. |
| `animation` | `normal` | enum | Feedback animation strength: `off`, `normal`, or `strong`. |
| `particles` | `true` | boolean | Master switch for burst particles and dynamic effects. |
| `particleCount` | `0` | number | Number of particles per burst (`0`–`80`; `0` auto-scales with combo tier). |
| `particleSize` | `4` | number | Base particle diameter in pixels (`1`–`12`). |
| `particleSpread` | `1` | number | Particle dispersion radius multiplier (`0.25`–`2.0`). |
| `effectDurationMs`| `820` | number | Burst lifespan from explosion to fade in ms (`200`–`2500`). |
| `shake` | `true` | boolean | Toggle micro physical screen shake on hits. |
| `shakeIntensity` | `3` | number | Shake amplitude in pixels (`0`–`12`). |

### Preset Details
- **`particles` (Crystalline Sparks)**: Directional square particles radiating outward with gravity decay.
- **`fireworks` (Radial Fireworks)**: High-density circular bursts with bright trailing embers.
- **`slash` (Blade Slash)**: High-speed dual laser blade cuts with center cross flare.
- **`aura` (Super Saiyan Flame)**: Billowing plasma energy pillar erupting vertically.
- **`glitch` (Cyber Glitch)**: Chromatic aberration tear lines and digital slice displacement.

---

## Colors and Themes

| Setting | Default | Type | Description |
|---|---:|---|---|
| `colorTheme` | `classic` | enum | Palette theme: `classic`, `cyberpunk`, `sunset`, `matrix`, or `frost`. |
| `glow` | `1` | number | Intensity of the glow aura surrounding numbers and particles (`0`–`2.0`). |
| `accentColor` | `''` | string | Custom hex color (`#RRGGBB`) for effects/progress bar. Empty string uses count-based colors. |
| `numberColor` | `''` | string | Custom hex color (`#RRGGBB`) for digits. Empty string uses count-based colors. |

### Color Themes
- **`classic` (Energy)**: Emerald Green → Lime → Amber → Solar Orange → Cosmic Violet → Prismatic.
- **`cyberpunk` (Neon)**: Neon Cyan → Hot Pink → Electric Purple → Cyber Gold.
- **`sunset` (Solar Flame)**: Golden Amber → Tangerine → Crimson Red → Rose Magenta.
- **`matrix` (Hacker Terminal)**: Phosphor Green → Deep Emerald → Mint Neon → White Glint.
- **`frost` (Glacial Aurora)**: Sky Blue → Cyan Glow → Polar Teal → Glacial White.

---

## Sound Synthesizer (Web Audio)

Synthesized locally in pure Web Audio with zero external audio assets.

| Setting | Default | Type | Description |
|---|---:|---|---|
| `sound` | `false` | boolean | Toggle audio feedback (opt-in). |
| `soundTheme` | `blip` | enum | Audio theme: `blip`, `keyboard`, `bubble`, `arcade`, `laser`, or `melodic`. |
| `soundVolume` | `0.35` | number | Output volume (`0`–`1.0`). |
| `soundFrom` | `10` | number | Combo threshold before audio begins (`0`–`1000`). |

### Audio Theme Descriptions
- **`blip`**: Clean, non-intrusive soft percussion chimes.
- **`keyboard`**: Tactile mechanical switch click and acoustic bottom-out thock.
- **`bubble`**: Gentle liquid popping sound.
- **`arcade`**: Retro 8-bit chiptune arpeggios.
- **`laser`**: Futuristic plasma beam discharge.
- **`melodic`**: Harmonious rising pentatonic scale tones.

---

## Immersion and Feedback

| Setting | Default | Type | Description |
|---|---:|---|---|
| `showGain` | `true` | boolean | Show floating `+N` increment indicator on hit. |
| `screenVignette`| `false` | boolean | Ambient screen-edge radial energy vignette pulsing during high streaks (10+). |
| `showMilestones`| `false` | boolean | Achievement banners floating at milestone thresholds (10, 20, 50, 100, etc.). |
| `showCrit` | `false` | boolean | Mark rapid token bursts with critical hit indicators (`CRIT!`). |
| `recapCard` | `false` | boolean | Display a transient summary victory card when a large streak concludes. |
