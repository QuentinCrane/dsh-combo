/**
 * dsh-combo — Client half (browser bundle).
 *
 * Registers one decoration into the root-scoped `shell.overlay` slot and paints
 * the live combo counter. It reads the Host's combo projection value and never
 * folds session events itself.
 *
 * Three features live here rather than on the Host, by design:
 *   - `pin`: keeping a combo across turns is a display-level streak. The Host
 *     publishes only when a committed event drives its projection, so it could
 *     never push a pin toggle to the browser; keeping the streak here makes this
 *     component the single source of truth for the number it paints.
 *   - `expireMs`: the Host already restarts its run after an idle gap, so the
 *     Client only has to stop painting the abandoned value.
 *   - sound: pure presentation.
 *
 * The bundle is loaded by the Harness module loader: its factory id must equal
 * the package name, and React comes from the browser module table.
 */
window.__ModuleLoader__.load({
  id: 'dsh-combo',
  factory(require) {
    const React = require('react')
    const { useSyncExternalStore, useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    const PROJECTION_KEY = 'dshCombo'
    const CONFIG_URL = '/dsh-combo/config'
    /** The Plugins-page slot for a bundle's own configuration page (keyed by package name). */
    const SETTINGS_SLOT = 'plugins.bundle.config'
    /** The settings namespace the Host serves: the row id, which is the package name. */
    const SETTINGS_NS = 'dsh-combo'
    const PIN_STORAGE_PREFIX = 'dsh-combo:pin:'
    const CUSTOM_STORAGE_KEY = 'dsh-combo:appearance'
    const PRESET_STORAGE_KEY = 'dsh-combo:preset'
    const PRESETS = {
      particles: '晶莹粒子',
      fireworks: '绚烂烟花',
      slash: '光刃斩击',
      aura: '超赛气焰',
      glitch: '赛博故障',
    }
    const LEGACY_PRESETS = {
      flames: 'aura',
      rift: 'slash',
      electric: 'slash',
      supernova: 'fireworks',
      aurora: 'aura',
      cyber: 'glitch',
      ripple: 'fireworks',
      comic: 'slash',
    }
    const COLOR_THEMES = {
      classic: {
        name: '经典能量',
        icon: '⚡',
        stops: [
          { at: 0, color: '#9be779', halo: 'rgba(117, 213, 82, 0.36)' },
          { at: 10, color: '#b9ee72', halo: 'rgba(158, 225, 73, 0.42)' },
          { at: 20, color: '#ffd968', halo: 'rgba(255, 197, 54, 0.48)' },
          { at: 50, color: '#ff936b', halo: 'rgba(255, 113, 65, 0.55)' },
          { at: 100, color: '#c084fc', halo: 'rgba(192, 132, 252, 0.55)' },
          { at: 200, color: '#00f0ff', halo: 'rgba(0, 240, 255, 0.6)' },
          { at: 300, color: '#f43f5e', halo: 'rgba(244, 63, 94, 0.65)' },
        ],
      },
      cyberpunk: {
        name: '赛博霓虹',
        icon: '🌆',
        stops: [
          { at: 0, color: '#00f0ff', halo: 'rgba(0, 240, 255, 0.4)' },
          { at: 10, color: '#38bdf8', halo: 'rgba(56, 189, 248, 0.45)' },
          { at: 20, color: '#f43f5e', halo: 'rgba(244, 63, 94, 0.5)' },
          { at: 50, color: '#ff007f', halo: 'rgba(255, 0, 127, 0.6)' },
          { at: 100, color: '#a855f7', halo: 'rgba(168, 85, 247, 0.6)' },
          { at: 200, color: '#facc15', halo: 'rgba(250, 204, 21, 0.65)' },
        ],
      },
      sunset: {
        name: '暮光烈阳',
        icon: '🌅',
        stops: [
          { at: 0, color: '#fbbf24', halo: 'rgba(251, 191, 36, 0.4)' },
          { at: 10, color: '#f59e0b', halo: 'rgba(245, 158, 11, 0.45)' },
          { at: 20, color: '#f97316', halo: 'rgba(249, 115, 22, 0.5)' },
          { at: 50, color: '#ef4444', halo: 'rgba(239, 68, 68, 0.55)' },
          { at: 100, color: '#ec4899', halo: 'rgba(236, 72, 153, 0.6)' },
          { at: 200, color: '#ffd6a8', halo: 'rgba(255, 214, 168, 0.65)' },
        ],
      },
      matrix: {
        name: '极客矩阵',
        icon: '🟢',
        stops: [
          { at: 0, color: '#10b981', halo: 'rgba(16, 185, 129, 0.38)' },
          { at: 10, color: '#22c55e', halo: 'rgba(34, 197, 94, 0.44)' },
          { at: 20, color: '#4ade80', halo: 'rgba(74, 222, 128, 0.5)' },
          { at: 50, color: '#86efac', halo: 'rgba(134, 239, 172, 0.58)' },
          { at: 100, color: '#a7f3d0', halo: 'rgba(167, 243, 208, 0.65)' },
          { at: 200, color: '#ffffff', halo: 'rgba(255, 255, 255, 0.7)' },
        ],
      },
      frost: {
        name: '冰川极光',
        icon: '❄️',
        stops: [
          { at: 0, color: '#67e8f9', halo: 'rgba(103, 232, 249, 0.38)' },
          { at: 10, color: '#38bdf8', halo: 'rgba(56, 189, 248, 0.45)' },
          { at: 20, color: '#60a5fa', halo: 'rgba(96, 165, 250, 0.5)' },
          { at: 50, color: '#818cf8', halo: 'rgba(129, 140, 248, 0.58)' },
          { at: 100, color: '#c084fc', halo: 'rgba(192, 132, 252, 0.65)' },
          { at: 200, color: '#f8fafc', halo: 'rgba(248, 250, 252, 0.7)' },
        ],
      },
    }
    const SOUND_THEMES = {
      blip: '轻柔敲击',
      keyboard: '机械轴音',
      bubble: '治愈气泡',
      arcade: '复古街机',
      laser: '未来激光',
      melodic: '动态音阶',
    }
    const COMBO_MODES = {
      hybrid: '混合全开 (Token+工具)',
      tokens: '流式 Token 模式',
      tools: '经典工具模式 (Tool Calls)',
    }
    /** Keyframe names cycle through this many slots, so the sheet stays bounded. */
    const MOTION_RING = 8
    /** A one-call "combo" is not worth offering to keep. */
    const GHOST_MIN = 2

    /** Combo Milestone achievements */
    const COMBO_MILESTONES = [
      { at: 500, title: '🌌 奇点爆发 (SINGULARITY)', desc: '宇宙算力汇聚于此' },
      { at: 300, title: '⚡ 赛博通神 (CYBER GOD)', desc: '思维与电路完全同频' },
      { at: 200, title: '🔥 超限过载 (OVERDRIVE)', desc: '突破一切算力极壁' },
      { at: 100, title: '💥 算力燃烧 (FULL THROTTLE)', desc: '百连击百步穿杨' },
      { at: 50, title: '⚡ 极速心流 (HYPER FOCUS)', desc: '行云流水毫无滞碍' },
      { at: 20, title: '🚀 引擎全开 (IGNITION)', desc: '渐入佳境战意高涨' },
      { at: 10, title: '✨ 初露锋芒 (FIRST SPARK)', desc: '十步一杀节奏初现' },
    ]

    const CONFIG_DEFAULTS = {
      enabled: true,
      comboMode: 'hybrid',
      tokensPerCombo: 1,
      showToolName: true,
      animation: 'normal',
      particles: true,
      preset: 'particles',
      colorTheme: 'classic',
      timerMs: 10000,
      powerThreshold: 0,
      effectFrequency: 1,
      shake: true,
      shakeIntensity: 3,
      scale: 1,
      offsetX: 18,
      offsetY: 10,
      barHeight: 7,
      particleCount: 0,
      particleSize: 4,
      particleSpread: 1,
      effectDurationMs: 820,
      glow: 1,
      accentColor: '',
      numberColor: '',
      showGain: true,
      showTimer: true,
      position: 'top-right',
      expireMs: 0,
      sound: false,
      soundTheme: 'blip',
      soundVolume: 0.35,
      soundFrom: 10,
      pinPromptMs: 5000,
      screenVignette: false,
      recapCard: false,
      showMilestones: false,
      showCrit: false,
    }


    // Only known, bounded presentation settings may come from local storage.
    const CUSTOM_RANGES = {"tokensPerCombo": [1, 100], "powerThreshold": [0,1000], "effectFrequency": [1,20], "shakeIntensity": [0,12], "timerMs": [1000, 60000], "expireMs": [0, 600000], "pinPromptMs": [0, 60000], "scale": [0.5, 2], "offsetX": [0, 240], "offsetY": [0, 240], "barHeight": [2, 16], "particleCount": [0, 80], "particleSize": [1, 12], "particleSpread": [0.25, 2], "effectDurationMs": [200, 2500], "glow": [0, 2], "soundVolume": [0, 1], "soundFrom": [0, 1000]}
    function cleanAppearance(raw) {
      const out = {}
      if (!raw || typeof raw !== 'object') return out
      for (const [key, [min, max]] of Object.entries(CUSTOM_RANGES)) {
        if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) out[key] = ['particleCount', 'effectFrequency', 'powerThreshold', 'soundFrom', 'tokensPerCombo', 'expireMs', 'pinPromptMs'].includes(key) ? Math.round(Math.max(min, Math.min(max, raw[key]))) : Math.max(min, Math.min(max, raw[key]))
      }
      for (const key of ['accentColor', 'numberColor']) {
        if (raw[key] === '' || (typeof raw[key] === 'string' && /^#[0-9a-f]{6}$/i.test(raw[key]))) out[key] = raw[key]
      }
      for (const key of ['showGain', 'showTimer', 'particles', 'showToolName', 'shake', 'sound', 'screenVignette', 'recapCard', 'showMilestones', 'showCrit']) {
        if (typeof raw[key] === 'boolean') out[key] = raw[key]
      }
      if (['off', 'normal', 'strong'].includes(raw.animation)) out.animation = raw.animation
      if (Object.hasOwn(PLACEMENT, raw.position)) out.position = raw.position
      if (Object.hasOwn(SOUND_THEMES, raw.soundTheme)) out.soundTheme = raw.soundTheme
      if (Object.hasOwn(COMBO_MODES, raw.comboMode)) out.comboMode = raw.comboMode
      if (Object.hasOwn(COLOR_THEMES, raw.colorTheme)) out.colorTheme = raw.colorTheme
      if (Object.hasOwn(PRESETS, raw.preset)) out.preset = raw.preset
      else if (Object.hasOwn(LEGACY_PRESETS, raw.preset)) out.preset = LEGACY_PRESETS[raw.preset]
      return out
    }

    // The gear panel's quick tune is per browser, while the Plugins page writes
    // the profile. When the page saves a key it drops that key's local override,
    // so the saved value takes over instead of hiding behind a stale quick tune.
    const overrideListeners = new Set()
    const previewTriggerListeners = new Set()
    let globalConfigForm = null

    function triggerGlobalPreview(options = {}) {
      for (const listener of previewTriggerListeners) {
        try {
          listener(options)
        } catch {
          // ignore preview dispatch failure
        }
      }
    }

    /** The local quick-tune overrides, cleaned on the way in. */
    function readAppearance() {
      try {
        return cleanAppearance(JSON.parse(storageGet(CUSTOM_STORAGE_KEY)))
      } catch {
        return {}
      }
    }

    /** Drop saved keys from the local overrides and wake every mounted HUD. */
    function clearAppearanceKeys(keys) {
      const stored = readAppearance()
      let changed = false
      for (const key of keys) {
        if (Object.hasOwn(stored, key)) {
          delete stored[key]
          changed = true
        }
      }
      if (!changed) return
      storageSet(CUSTOM_STORAGE_KEY, JSON.stringify(stored))
      for (const listener of overrideListeners) listener()
    }

    // ---------------------------------------------------------------------
    // Config: fetched once per page, keyed by the Host's revision.
    // ---------------------------------------------------------------------
    let configCache = { revision: -1, value: CONFIG_DEFAULTS, inflight: null }
    const configListeners = new Set()

    function readConfig() {
      if (configCache.revision >= 0 || configCache.inflight !== null) return
      const pending = fetch(CONFIG_URL, { headers: { accept: 'application/json' } })
      configCache = { ...configCache, inflight: pending }
      pending
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (payload && typeof payload === 'object' && payload.config) {
            configCache = {
              revision: typeof payload.revision === 'number' ? payload.revision : 0,
              value: { ...CONFIG_DEFAULTS, ...payload.config },
              inflight: null,
            }
          } else {
            configCache = { ...configCache, revision: 0, inflight: null }
          }
        })
        .catch(() => {
          configCache = { ...configCache, revision: 0, inflight: null }
        })
        .finally(() => {
          for (const listener of configListeners) listener()
        })
    }

    /** Test-only: drop the memoized config so one bundle instance can serve many cases. */
    function resetConfigCacheForTests() {
      configCache = { revision: -1, value: CONFIG_DEFAULTS, inflight: null }
    }

    /**
     * Re-read the Host config after a settings write. The route serves the live
     * values, so this is what makes a saved setting visible in the HUD without
     * reloading the page.
     */
    function refreshConfig() {
      configCache = { revision: -1, value: configCache.value, inflight: null }
      readConfig()
    }

    function useConfig() {
      const snapshot = useSyncExternalStore(
        (listener) => {
          configListeners.add(listener)
          readConfig()
          return () => configListeners.delete(listener)
        },
        () => configCache,
        () => configCache,
      )
      return snapshot.value
    }

    // ---------------------------------------------------------------------
    // Pin storage: the kept streak is remembered per session, and degrades to
    // process memory when the page has no usable `localStorage`.
    // ---------------------------------------------------------------------
    const memoryStorage = new Map()

    /** Usable storage means the full trio exists; a partial stub is ignored. */
    function webStorage() {
      try {
        if (typeof localStorage === 'undefined' || localStorage === null) return null
        return typeof localStorage.getItem === 'function' && typeof localStorage.setItem === 'function'
          ? localStorage
          : null
      } catch {
        // Partitioned or disabled storage can throw on mere access.
        return null
      }
    }

    function storageGet(key) {
      const store = webStorage()
      if (store !== null) {
        try {
          const value = store.getItem(key)
          if (value !== null) return value
        } catch {
          // Fall through to process memory.
        }
      }
      return memoryStorage.has(key) ? memoryStorage.get(key) : null
    }

    function storageSet(key, value) {
      memoryStorage.set(key, value)
      const store = webStorage()
      if (store === null) return
      try {
        store.setItem(key, value)
      } catch {
        // A refused write must never break a tool call.
      }
    }

    function storageRemove(key) {
      memoryStorage.delete(key)
      const store = webStorage()
      if (store === null) return
      try {
        store.removeItem(key)
      } catch {
        // Ignore: the in-memory copy is already gone.
      }
    }

    const IDLE_PIN = { sessionId: undefined, active: false, base: 0 }

    /**
     * Read one session's kept streak, reconciling it with the Host's current run.
     *
     * The record holds the streak as of the last paint plus the Host score it
     * was painted at. If the Host now reports a *lower* score, a run ended while
     * this page was away, so that finished run is folded into the streak first —
     * otherwise a reload would either lose it or count the current run twice.
     *
     * @param sessionId - the conversation the record belongs to.
     * @param score - the Host's score for that conversation right now.
     * @returns the kept streak, or the idle pin.
     */
    function loadPin(sessionId, score) {
      if (typeof sessionId !== 'string' || sessionId === '') return IDLE_PIN
      const raw = storageGet(PIN_STORAGE_PREFIX + sessionId)
      if (raw === null) return IDLE_PIN
      try {
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object' || parsed.active !== true) return IDLE_PIN
        const base = Number(parsed.base)
        const lastScore = Number(parsed.score)
        let kept = Number.isFinite(base) && base > 0 ? Math.floor(base) : 0
        if (Number.isFinite(lastScore) && lastScore > score) kept += Math.floor(lastScore)
        return { sessionId, active: true, base: kept }
      } catch {
        return IDLE_PIN
      }
    }

    /** Persist (or drop) one session's pin. An idle pin leaves no trace. */
    function savePin(sessionId, pin, score) {
      if (typeof sessionId !== 'string' || sessionId === '') return
      if (pin.active !== true) {
        storageRemove(PIN_STORAGE_PREFIX + sessionId)
        return
      }
      const at = Number.isFinite(score) && score > 0 ? Math.floor(score) : 0
      storageSet(PIN_STORAGE_PREFIX + sessionId, JSON.stringify({ active: true, base: pin.base, score: at }))
    }

    // ---------------------------------------------------------------------
    // Sound: a soft percussive hit, never an audio asset. Browsers start an
    // AudioContext suspended, so it is created lazily and resumed on the first
    // gesture (the very typing that starts a turn is one).
    // ---------------------------------------------------------------------
    let audioEngine = null
    let gestureHooked = false
    let lastSoundAt = -Infinity

    function audioContext() {
      const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext
      if (typeof Ctor !== 'function') return null
      if (audioEngine === null) {
        try {
          audioEngine = new Ctor()
        } catch {
          return null
        }
      }
      return audioEngine
    }

    /** Resume the shared context from inside a user gesture, once. */
    function unlockOnGesture() {
      if (gestureHooked) return
      if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return
      gestureHooked = true
      const unlock = () => {
        const context = audioContext()
        if (context !== null && context.state === 'suspended' && typeof context.resume === 'function') {
          try {
            Promise.resolve(context.resume()).catch(() => {})
          } catch {
            // A refused resume only means silence.
          }
        }
        document.removeEventListener('pointerdown', unlock)
        document.removeEventListener('keydown', unlock)
      }
      document.addEventListener('pointerdown', unlock)
      document.addEventListener('keydown', unlock)
    }

    /**
     * Synthesize combo audio hits. Supports multiple distinct aesthetic themes:
     *   - `blip`: soft musical falling sine blip (default)
     *   - `keyboard`: rich mechanical keyboard switch (thock body + crisp click transient)
     *   - `bubble`: satisfying bouncy liquid pop (upward chirp)
     *   - `arcade`: 8-bit retro arcade two-step fifth chord
     *   - `laser`: sci-fi energy laser blast
     *   - `melodic`: dynamic pentatonic scale rising with the combo streak
     */
    function playBlip(shown, tier, volume, preview = false, theme = 'blip') {
      if (!(volume > 0)) return
      try {
        const context = audioContext()
        if (context === null || typeof context.createOscillator !== 'function') return
        if (context.state === 'suspended') {
          unlockOnGesture()
          if (typeof context.resume === 'function') Promise.resolve(context.resume()).catch(() => {})
          // Never queue stale sounds for playback when the user later unlocks audio.
          if (!preview) return
        }
        const now = context.currentTime
        // Parallel tool settlements should sound like one hit, not a loud chord.
        if (!preview && now - lastSoundAt < 0.035) return
        lastSoundAt = now

        const schedule = (osc, gain, startTime, stopTime) => {
          osc.connect(gain)
          gain.connect(context.destination)
          osc.onended = () => {
            try {
              osc.disconnect()
              gain.disconnect()
            } catch {}
          }
          osc.start(startTime)
          osc.stop(stopTime)
        }

        const tierPitch = { calm: 330, warm: 392, hot: 440, blaze: 523.25 }[tier] ?? 330

        if (theme === 'keyboard') {
          // Mechanical switch: sharp tactile click + solid bottom-out thock + micro-clack
          // 1. High tactile click transient (snap)
          const oscClick = context.createOscillator()
          const gainClick = context.createGain()
          oscClick.type = 'triangle'
          const clickFreq = 3400 + (tier === 'blaze' ? 600 : tier === 'hot' ? 400 : tier === 'warm' ? 200 : 0)
          oscClick.frequency.setValueAtTime(clickFreq, now)
          oscClick.frequency.exponentialRampToValueAtTime(1200, now + 0.015)
          gainClick.gain.setValueAtTime(0.0001, now)
          gainClick.gain.exponentialRampToValueAtTime(Math.max(volume * 0.28, 0.0002), now + 0.001)
          gainClick.gain.exponentialRampToValueAtTime(0.0001, now + 0.018)
          schedule(oscClick, gainClick, now, now + 0.02)

          // 2. Solid bottom-out chassis Thock
          const oscThock = context.createOscillator()
          const gainThock = context.createGain()
          oscThock.type = 'sine'
          const baseThock = { calm: 240, warm: 270, hot: 310, blaze: 360 }[tier] ?? 240
          oscThock.frequency.setValueAtTime(baseThock, now)
          oscThock.frequency.exponentialRampToValueAtTime(baseThock * 0.55, now + 0.038)
          gainThock.gain.setValueAtTime(0.0001, now)
          gainThock.gain.exponentialRampToValueAtTime(Math.max(volume * 0.35, 0.0002), now + 0.002)
          gainThock.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
          schedule(oscThock, gainThock, now, now + 0.05)

          // 3. Subtle micro upstroke tick
          const oscTick = context.createOscillator()
          const gainTick = context.createGain()
          oscTick.type = 'triangle'
          oscTick.frequency.setValueAtTime(2200, now + 0.018)
          gainTick.gain.setValueAtTime(0.0001, now + 0.018)
          gainTick.gain.exponentialRampToValueAtTime(Math.max(volume * 0.08, 0.0002), now + 0.02)
          gainTick.gain.exponentialRampToValueAtTime(0.0001, now + 0.032)
          schedule(oscTick, gainTick, now + 0.018, now + 0.035)
          return
        }

        if (theme === 'bubble') {
          // Juicy liquid pop: upward bloop chirp + high harmonic surface ring
          const baseFreq = 340 + (((shown || 1) - 1) % 7) * 55
          // 1. Upward bubbly chirp
          const osc = context.createOscillator()
          const amp = context.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(baseFreq, now)
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.8, now + 0.032)
          amp.gain.setValueAtTime(0.0001, now)
          amp.gain.exponentialRampToValueAtTime(Math.max(volume * 0.32, 0.0002), now + 0.003)
          amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.052)
          schedule(osc, amp, now, now + 0.055)

          // 2. High liquid surface tension ping (harmonic ring)
          const oscPing = context.createOscillator()
          const ampPing = context.createGain()
          oscPing.type = 'sine'
          const pingFreq = baseFreq * 2.2
          oscPing.frequency.setValueAtTime(pingFreq, now + 0.012)
          oscPing.frequency.exponentialRampToValueAtTime(pingFreq * 0.85, now + 0.045)
          ampPing.gain.setValueAtTime(0.0001, now + 0.012)
          ampPing.gain.exponentialRampToValueAtTime(Math.max(volume * 0.16, 0.0002), now + 0.016)
          ampPing.gain.exponentialRampToValueAtTime(0.0001, now + 0.05)
          schedule(oscPing, ampPing, now + 0.012, now + 0.055)
          return
        }

        if (theme === 'arcade') {
          // 8-bit retro arcade combo hit: crisp two-step fifth arpeggio
          const osc = context.createOscillator()
          const amp = context.createGain()
          const freq = { calm: 440, warm: 554.37, hot: 659.25, blaze: 880 }[tier] ?? 440
          osc.type = 'square'
          osc.frequency.setValueAtTime(freq, now)
          osc.frequency.setValueAtTime(freq * 1.5, now + 0.024)
          if (tier === 'hot' || tier === 'blaze') {
            osc.frequency.setValueAtTime(freq * 2.0, now + 0.048)
          }
          amp.gain.setValueAtTime(0.0001, now)
          amp.gain.exponentialRampToValueAtTime(Math.max(volume * 0.16, 0.0002), now + 0.002)
          amp.gain.exponentialRampToValueAtTime(0.0001, now + (tier === 'hot' || tier === 'blaze' ? 0.08 : 0.065))
          schedule(osc, amp, now, now + 0.085)
          return
        }

        if (theme === 'laser') {
          // Sci-fi plasma blaster: aggressive high-velocity beam zap + sub punch
          const startFreq = 2600 + (((shown || 1) - 1) % 5) * 180
          // 1. High energy sawtooth zap
          const oscBeam = context.createOscillator()
          const ampBeam = context.createGain()
          oscBeam.type = 'sawtooth'
          oscBeam.frequency.setValueAtTime(startFreq, now)
          oscBeam.frequency.exponentialRampToValueAtTime(260, now + 0.045)
          ampBeam.gain.setValueAtTime(0.0001, now)
          ampBeam.gain.exponentialRampToValueAtTime(Math.max(volume * 0.22, 0.0002), now + 0.001)
          ampBeam.gain.exponentialRampToValueAtTime(0.0001, now + 0.058)
          schedule(oscBeam, ampBeam, now, now + 0.065)

          // 2. Punchy low-end sub impact
          const oscSub = context.createOscillator()
          const ampSub = context.createGain()
          oscSub.type = 'sine'
          oscSub.frequency.setValueAtTime(200, now)
          oscSub.frequency.exponentialRampToValueAtTime(60, now + 0.035)
          ampSub.gain.setValueAtTime(0.0001, now)
          ampSub.gain.exponentialRampToValueAtTime(Math.max(volume * 0.18, 0.0002), now + 0.002)
          ampSub.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
          schedule(oscSub, ampSub, now, now + 0.045)
          return
        }

        if (theme === 'melodic') {
          // Crystal music box / Kalimba: clear fundamental chime + 2.76x bell harmonic
          const PENTATONIC = [
            523.25, // C5
            587.33, // D5
            659.25, // E5
            783.99, // G5
            880.00, // A5
            1046.50, // C6
            1174.66, // D6
            1318.51, // E6
            1567.98, // G6
            1760.00, // A6
          ]
          const noteIndex = Math.max(0, ((shown || 1) - 1)) % PENTATONIC.length
          const noteFreq = PENTATONIC[noteIndex]

          // 1. Crystal fundamental bell tone
          const osc1 = context.createOscillator()
          const amp1 = context.createGain()
          osc1.type = 'sine'
          osc1.frequency.setValueAtTime(noteFreq, now)
          osc1.frequency.exponentialRampToValueAtTime(noteFreq * 0.995, now + 0.09)
          amp1.gain.setValueAtTime(0.0001, now)
          amp1.gain.exponentialRampToValueAtTime(Math.max(volume * 0.28, 0.0002), now + 0.002)
          amp1.gain.exponentialRampToValueAtTime(0.0001, now + 0.095)
          schedule(osc1, amp1, now, now + 0.1)

          // 2. Sparkling crystalline chime overtone (2.76x physical idiophone bar ratio)
          const osc2 = context.createOscillator()
          const amp2 = context.createGain()
          osc2.type = 'sine'
          osc2.frequency.setValueAtTime(noteFreq * 2.76, now)
          osc2.frequency.exponentialRampToValueAtTime(noteFreq * 2.74, now + 0.05)
          amp2.gain.setValueAtTime(0.0001, now)
          amp2.gain.exponentialRampToValueAtTime(Math.max(volume * 0.12, 0.0002), now + 0.001)
          amp2.gain.exponentialRampToValueAtTime(0.0001, now + 0.055)
          schedule(osc2, amp2, now, now + 0.06)
          return
        }

        // Default: 'blip' (soft downward musical hit)
        const oscillator = context.createOscillator()
        const amp = context.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(tierPitch, now)
        oscillator.frequency.exponentialRampToValueAtTime(tierPitch * 0.65, now + 0.055)
        amp.gain.setValueAtTime(0.0001, now)
        amp.gain.exponentialRampToValueAtTime(Math.max(volume * 0.24, 0.0002), now + 0.003)
        amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.065)
        schedule(oscillator, amp, now, now + 0.075)
      } catch {
        // Sound must never interrupt combo rendering.
      }
    }

    // ---------------------------------------------------------------------
    // Combo value + the session it belongs to.
    // ---------------------------------------------------------------------
    const NO_SUBSCRIBE = () => () => {}
    const NO_SNAPSHOT = () => undefined
    const EMPTY_COMBO = { combo: 0, tool: '' }

    /**
     * Estimate streaming token count in an Assistant chunk.
     * CJK characters count as 1 token each; non-CJK whitespace words count as tokens.
     * Non-empty content always yields at least 1 token.
     */
    function countChunkTokens(chunk) {
      if (!chunk || typeof chunk !== 'object') return 0
      const str = typeof chunk.text === 'string'
        ? chunk.text
        : typeof chunk.argumentsDelta === 'string'
          ? chunk.argumentsDelta
          : ''
      if (!str) return 0
      const cjk = (str.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g) || []).length
      const nonCjk = str.replace(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, ' ')
      const words = (nonCjk.match(/\S+/g) || []).length
      return Math.max(1, cjk + words)
    }

    /**
     * Subscribe to the active conversation's combo value from the root overlay.
     *
     * In addition to reading the Host's durable projection face (`dshCombo`),
     * it actively listens to live Assistant streaming events (`assistant/live-chunk`)
     * on the Session's `eventSource` to compute real-time streaming token combos.
     */
    function useCombo(sessions, uiSession, config) {
      const source = uiSession?.adapter?.current
      const binding = useSyncExternalStore(
        source ? source.subscribe : NO_SUBSCRIBE,
        source ? source.getSnapshot : NO_SNAPSHOT,
        source ? source.getSnapshot : NO_SNAPSHOT,
      )
      const sessionId = binding?.key
      // Borrow the active Session's documented face. `uiSession` publishes the
      // active binding; Session Controller owns the projection observable.
      // Include the binding in the memo key so a same-id Session generation
      // replacement still resolves a fresh face.
      const face = useMemo(() => {
        if (sessionId === undefined || typeof sessions?.binding !== 'function') return undefined
        try {
          return sessions.binding(sessionId)?.session?.projections?.faceOf(PROJECTION_KEY)
        } catch {
          return undefined
        }
      }, [sessions, sessionId, binding])

      const value = useSyncExternalStore(
        face ? face.subscribe : NO_SUBSCRIBE,
        face ? face.getSnapshot : NO_SNAPSHOT,
        face ? face.getSnapshot : NO_SNAPSHOT,
      )
      const view = typeof value?.combo === 'number' ? value : EMPTY_COMBO

      // Stream token tracking:
      const sessionBinding = useMemo(() => {
        if (sessionId === undefined || typeof sessions?.binding !== 'function') return undefined
        try {
          return sessions.binding(sessionId)
        } catch {
          return undefined
        }
      }, [sessions, sessionId, binding])

      const eventSource = sessionBinding?.eventSource || sessionBinding?.session?.eventSource

      const [streamState, setStreamState] = useState(() => ({
        sessionId,
        combo: 0,
        tool: '',
        changedAt: 0,
      }))

      const streamRef = useRef({
        sessionId,
        combo: 0,
        tool: '',
        changedAt: 0,
        remainder: 0,
      })

      const excludedTools = useMemo(() => {
        const list = Array.isArray(config?.excludeTools) ? config.excludeTools : []
        return new Set(list.map((t) => String(t).toLowerCase()))
      }, [config?.excludeTools])

      const tokensPerCombo = Math.max(1, Math.round(config?.tokensPerCombo || 1))
      const comboMode = config?.comboMode || 'hybrid'

      const optionsRef = useRef({
        tokensPerCombo,
        excludedTools,
        expireMs: config?.expireMs,
        comboMode,
      })
      optionsRef.current = {
        tokensPerCombo,
        excludedTools,
        expireMs: config?.expireMs,
        comboMode,
      }

      useEffect(() => {
        const isNewSession = streamRef.current.sessionId !== sessionId
        if (isNewSession) {
          streamRef.current = {
            sessionId,
            combo: 0,
            tool: '',
            changedAt: 0,
            remainder: 0,
            pending: 0,
          }
          setStreamState({ sessionId, combo: 0, tool: '', changedAt: 0 })
        } else {
          streamRef.current.sessionId = sessionId
        }

        if (!eventSource || typeof eventSource.subscribe !== 'function') {
          return undefined
        }

        let paceTimer = null

        const flush = () => {
          const curr = streamRef.current
          if (curr.sessionId === sessionId) {
            setStreamState({
              sessionId,
              combo: curr.combo,
              tool: curr.tool,
              changedAt: curr.changedAt,
            })
          }
        }

        const stepPace = () => {
          paceTimer = null
          const curr = streamRef.current
          if (curr.sessionId !== sessionId) return
          if (curr.pending > 0) {
            const step = curr.pending > 24 ? Math.ceil(curr.pending / 8) : curr.pending > 12 ? 2 : 1
            curr.pending -= step
            curr.combo += step
            flush()
            if (curr.pending > 0) {
              paceTimer = setTimeout(stepPace, 40)
            }
          }
        }

        const notify = (added) => {
          const isNodeTest = typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function'
          if (isNodeTest) {
            // Synchronous test environment
            const curr = streamRef.current
            curr.combo += added
            flush()
          } else {
            // Browser environment: continuous paced streaming combo!
            const curr = streamRef.current
            curr.pending = (curr.pending || 0) + added
            if (paceTimer === null) {
              stepPace()
            }
          }
        }

        const handleEntry = (entry) => {
          if (!entry || typeof entry !== 'object') return
          const event = entry.event
          if (!event || typeof event !== 'object') return
          const ref = streamRef.current
          if (ref.sessionId !== sessionId) return
          const opts = optionsRef.current

          if (event.type === 'assistant/live-chunk') {
            if (opts.comboMode === 'tools') return
            const data = event.data
            const chunk = data?.chunk
            if (!chunk) return
            const tokens = countChunkTokens(chunk)
            if (tokens > 0) {
              let label = '输出'
              if (chunk.type === 'reasoning-delta') {
                label = '思考'
              } else if (chunk.type === 'tool-call-delta') {
                label = (typeof chunk.name === 'string' && chunk.name) ? chunk.name : '工具'
              }
              const at = typeof event.time === 'number' ? event.time : Date.now()
              if (opts.expireMs > 0 && ref.combo > 0 && at - ref.changedAt > opts.expireMs) {
                ref.combo = 0
                ref.remainder = 0
                ref.pending = 0
              }
              ref.remainder += tokens
              const added = Math.floor(ref.remainder / opts.tokensPerCombo)
              ref.remainder = ref.remainder % opts.tokensPerCombo
              if (added > 0) {
                ref.tool = label
                ref.changedAt = at
                notify(added)
              }
            }
          } else if (event.type === 'tool/call') {
            if (opts.comboMode === 'tokens') return
            const name = typeof event.data?.name === 'string' ? event.data.name : ''
            if (!opts.excludedTools.has(name.toLowerCase())) {
              const at = typeof event.time === 'number' ? event.time : Date.now()
              if (opts.expireMs > 0 && ref.combo > 0 && at - ref.changedAt > opts.expireMs) {
                ref.combo = 0
                ref.remainder = 0
                ref.pending = 0
              }
              ref.combo += 1
              ref.tool = name || '工具'
              ref.changedAt = at
              flush()
            }
          } else if (event.type === 'turn/start') {
            ref.combo = 0
            ref.tool = ''
            ref.remainder = 0
            ref.pending = 0
            if (paceTimer !== null) {
              clearTimeout(paceTimer)
              paceTimer = null
            }
            ref.changedAt = typeof event.time === 'number' ? event.time : Date.now()
            flush()
          } else if (event.type === 'turn/end') {
            ref.changedAt = typeof event.time === 'number' ? event.time : Date.now()
            flush()
          }
        }

        const unsubscribe = eventSource.subscribe(() => {
          const snapshot = typeof eventSource.getSnapshot === 'function' ? eventSource.getSnapshot() : null
          const change = snapshot?.change
          if (change?.kind === 'append' && Array.isArray(change.entries)) {
            for (const entry of change.entries) {
              handleEntry(entry)
            }
          }
        })

        return () => {
          if (paceTimer !== null) {
            clearTimeout(paceTimer)
            paceTimer = null
          }
          if (typeof unsubscribe === 'function') {
            unsubscribe()
          }
        }
      }, [eventSource, sessionId])

      const hasStream = streamState.sessionId === sessionId && streamState.combo > 0
      let score = view.combo
      if (comboMode === 'tokens') {
        score = streamState.combo
      } else if (comboMode === 'tools') {
        score = hasStream ? Math.max(streamState.combo, view.combo) : view.combo
      } else {
        score = hasStream ? Math.max(streamState.combo, view.combo) : view.combo
      }
      const tool = hasStream ? (streamState.tool || view.tool) : view.tool
      const changedAt = hasStream
        ? (streamState.changedAt || view.changedAt)
        : (typeof view.changedAt === 'number' && Number.isFinite(view.changedAt) ? view.changedAt : 0)

      return {
        score,
        tool: typeof tool === 'string' ? tool : '',
        changedAt: typeof changedAt === 'number' && Number.isFinite(changedAt) ? changedAt : 0,
        sessionId,
      }
    }

    // ---------------------------------------------------------------------
    // Presentation tiers. No XP, no levels, no achievements — only intensity.
    // ---------------------------------------------------------------------
    /**
     * @param combo - current combo count.
     * @returns the presentation tier for that count.
     */
    function tierOf(combo, colorTheme = 'classic') {
      const theme = COLOR_THEMES[colorTheme] ?? COLOR_THEMES.classic
      if (colorTheme === 'classic' || !COLOR_THEMES[colorTheme]) {
        if (combo >= 500) return {
          id: 'blaze', shake: true, accent: '#fde047',
          halo: 'rgba(253, 224, 71, 0.65)', spark: '#ffffff',
          gradient: 'linear-gradient(135deg, #f43f5e 0%, #fbbf24 35%, #00f0ff 70%, #c084fc 100%)',
        }
        if (combo >= 300) return {
          id: 'blaze', shake: true, accent: '#f43f5e',
          halo: 'rgba(244, 63, 94, 0.62)', spark: '#ffe4e6',
          gradient: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
        }
        if (combo >= 200) return {
          id: 'blaze', shake: true, accent: '#00f0ff',
          halo: 'rgba(0, 240, 255, 0.58)', spark: '#cffafe',
          gradient: 'linear-gradient(135deg, #00f0ff 0%, #38bdf8 100%)',
        }
        if (combo >= 100) return {
          id: 'blaze', shake: true, accent: '#c084fc',
          halo: 'rgba(192, 132, 252, 0.55)', spark: '#f3e8ff',
          gradient: 'linear-gradient(135deg, #c084fc 0%, #d946ef 100%)',
        }
        if (combo >= 50) return {
          id: 'blaze', shake: true, accent: '#ff936b',
          halo: 'rgba(255, 113, 65, 0.55)', spark: '#ffd6a8',
          gradient: 'linear-gradient(135deg, #ff936b 0%, #fbbf24 100%)',
        }
        if (combo >= 20) return {
          id: 'hot', shake: true, accent: '#ffd968',
          halo: 'rgba(255, 197, 54, 0.48)', spark: '#fff0b0',
          gradient: 'linear-gradient(135deg, #ffd968 0%, #fde047 100%)',
        }
        if (combo >= 10) return {
          id: 'warm', shake: false, accent: '#b9ee72',
          halo: 'rgba(158, 225, 73, 0.42)', spark: '#e3ffb0',
          gradient: 'linear-gradient(135deg, #b9ee72 0%, #a3e635 100%)',
        }
        return {
          id: 'calm', shake: false, accent: '#9be779',
          halo: 'rgba(117, 213, 82, 0.36)', spark: '#d7ffc3',
          gradient: 'linear-gradient(135deg, #9be779 0%, #86efac 100%)',
        }
      }

      const stops = theme.stops
      let chosen = stops[0]
      for (const stop of stops) {
        if (combo >= stop.at) chosen = stop
      }
      return {
        id: combo >= 50 ? 'blaze' : combo >= 20 ? 'hot' : combo >= 10 ? 'warm' : 'calm',
        shake: combo >= 20,
        accent: chosen.color,
        halo: chosen.halo,
        spark: '#ffffff',
        gradient: `linear-gradient(135deg, ${chosen.color} 0%, #ffffff 120%)`,
      }
    }

    const PLACEMENT = {
      'top-right': { top: true, right: true },
      'top-left': { top: true, right: false },
      'bottom-right': { top: false, right: true },
      'bottom-left': { top: false, right: false },
    }

    function ComboHud(props) {
      const sessions = props.sessions
      const uiSession = props.uiSession
      const hostConfig = useConfig()
      const [appearance, setAppearance] = useState(readAppearance)
      // The settings page may clear a local override it just replaced with the
      // profile value, so this panel follows storage instead of owning it.
      useEffect(() => {
        const sync = () => setAppearance(readAppearance())
        overrideListeners.add(sync)
        return () => overrideListeners.delete(sync)
      }, [])
      const config = { ...hostConfig, ...appearance }
      const customize = (key, value) => {
        const next = cleanAppearance({ ...appearance, [key]: value })
        storageSet(CUSTOM_STORAGE_KEY, JSON.stringify(next))
        setAppearance(next)
      }
      const combo = useCombo(sessions, uiSession, config)
      const score = combo.score
      const tool = combo.tool
      const sessionId = combo.sessionId
      const [lastCall, setLastCall] = useState(() => ({ sessionId, at: score > 0 ? combo.changedAt || Date.now() : 0 }))
      const [presetOverride, setPresetOverride] = useState(() => {
        const saved = storageGet(PRESET_STORAGE_KEY)
        return Object.hasOwn(PRESETS, saved) ? saved : null
      })
      const preset = presetOverride ?? (Object.hasOwn(PRESETS, config.preset) ? config.preset : 'particles')
      const timerPaint = useRef({ key: null, elapsed: 0 })
      const [pop, setPop] = useState(0)
      const [gain, setGain] = useState(null)
      const [particles, setParticles] = useState(null)
      const [ghost, setGhost] = useState(null)
      const [recap, setRecap] = useState(null)
      const [milestone, setMilestone] = useState(null)
      const maxStreakRef = useRef(0)
      const [expired, setExpired] = useState(false)
      const [pinState, setPinState] = useState(() => loadPin(sessionId, score))
      // The previously observed cut, so one score can be read as a transition:
      // same session and a smaller score means the Host closed a run.
      const track = useRef({ sessionId: undefined, score: 0, tool: '' })

      const motion = config.animation !== 'off'
      // A streak belongs to the conversation that earned it: another session's
      // pin must never be painted over this one's score, even for one frame
      // before the effect below swaps the record in.
      const pin = pinState.sessionId === sessionId ? pinState : IDLE_PIN
      // What the user is watching: the running count, or the kept streak.
      const streak = pin.active ? pin.base + score : score
      const strongMotion = config.animation === 'strong'

      // Also listen to external preview triggers (e.g. from Settings page)
      const [forcePreview, setForcePreview] = useState(null)
      useEffect(() => {
        let previewTimer = null
        const handlePreview = (opts = {}) => {
          setPop(token => token + 1)
          setGain(null)
          setParticles({ id: Date.now() })
          setExpired(false)
          setForcePreview({
            value: opts.combo || 18,
            tool: opts.tool || '预览',
            at: Date.now(),
          })
          if (previewTimer) clearTimeout(previewTimer)
          previewTimer = setTimeout(() => {
            setForcePreview(null)
          }, 3500)
        }
        previewTriggerListeners.add(handlePreview)
        return () => {
          previewTriggerListeners.delete(handlePreview)
          if (previewTimer) clearTimeout(previewTimer)
        }
      }, [])

      useEffect(() => {
        const prior = track.current
        track.current = { sessionId, score, tool }
        if (prior.sessionId !== sessionId) {
          // A different conversation is not a transition: adopt its value and
          // its own pin as the baseline instead of reading a reset into it.
          setLastCall({ sessionId, at: score > 0 ? combo.changedAt || Date.now() : 0 })
          setGhost(null)
          setRecap(null)
          setMilestone(null)
          maxStreakRef.current = 0
          setGain(null)
          setParticles(null)
          setPop(0)
          setExpired(false)
          setPinState(loadPin(sessionId, score))
          return undefined
        }
        const before = prior.score
        if (score < before) {
          if (score > 0) setLastCall({ sessionId, at: combo.changedAt || Date.now() })
          // The Host closed a run (turn boundary, or an opted-in idle break).
          if (pin.active) {
            const next = { sessionId, active: true, base: pin.base + before }
            savePin(sessionId, next, score)
            setPinState(next)
          } else if (before >= GHOST_MIN && config.pinPromptMs > 0) {
            // Offer the just-finished run for a moment: pinning has to be
            // clickable after the number would otherwise be gone.
            setGhost({ value: before, tool: prior.tool, at: Date.now() })
          }
          if (config.recapCard && before >= 5) {
            const peak = Math.max(before, maxStreakRef.current)
            const grade = peak >= 100 ? 'SSS' : peak >= 50 ? 'SS' : peak >= 25 ? 'S' : peak >= 12 ? 'A' : 'B'
            setRecap({ count: before, peak, tool: prior.tool, grade, at: Date.now() })
          }
          maxStreakRef.current = 0
          return undefined
        }
        if (score <= before) return undefined

        // A kept streak is written on every call, so a reload lands back inside
        // the run it was watching instead of on a stale number.
        if (pin.active) savePin(sessionId, pin, score)
        maxStreakRef.current = Math.max(maxStreakRef.current, streak)
        setLastCall({ sessionId, at: combo.changedAt || Date.now() })
        setPop((token) => token + 1)
        const isCrit = (score - before) >= 3
        setGain({ id: score, delta: score - before, crit: isCrit })
        for (const ms of COMBO_MILESTONES) {
          if (streak >= ms.at && (streak - (score - before)) < ms.at) {
            setMilestone({ ...ms, id: streak, at: Date.now() })
            break
          }
        }
        const frequency = Math.max(1, Math.round(config.effectFrequency))
        if (motion && config.particles && streak >= config.powerThreshold && Math.floor(score / frequency) > Math.floor(before / frequency)) setParticles({ id: pop + 1 })
        if (config.sound && streak >= config.soundFrom) playBlip(streak, tierOf(streak).id, config.soundVolume, false, config.soundTheme)
        return undefined
      }, [sessionId, score, tool, pin.active, pin.base, config.pinPromptMs, config.sound,
        config.soundTheme, config.soundFrom, config.soundVolume, config.particles, config.powerThreshold, config.effectFrequency, motion, streak])

      // Each transient decoration clears itself; React runs these cleanups on unmount too.
      useEffect(() => {
        if (gain === null) return undefined
        const timer = setTimeout(() => setGain(null), 900)
        return () => clearTimeout(timer)
      }, [gain])

      useEffect(() => {
        if (particles === null) return undefined
        const timer = setTimeout(() => setParticles(null), config.effectDurationMs + 80)
        return () => clearTimeout(timer)
      }, [particles, config.effectDurationMs])

      useEffect(() => {
        if (ghost === null) return undefined
        const timer = setTimeout(() => setGhost(null), config.pinPromptMs)
        return () => clearTimeout(timer)
      }, [ghost, config.pinPromptMs])

      useEffect(() => {
        if (milestone === null) return undefined
        const timer = setTimeout(() => setMilestone(null), 3200)
        return () => clearTimeout(timer)
      }, [milestone])

      useEffect(() => {
        if (recap === null) return undefined
        const timer = setTimeout(() => setRecap(null), 5200)
        return () => clearTimeout(timer)
      }, [recap])

      // The idle break the Host already applies to its fold, mirrored on screen:
      // a kept streak is exempt, because a pin says "do not drop this".
      useEffect(() => {
        setExpired(false)
        if (config.expireMs <= 0 || pin.active || score <= 0) return undefined
        const timer = setTimeout(() => setExpired(true), config.expireMs)
        return () => clearTimeout(timer)
      }, [score, config.expireMs, pin.active])

      const togglePin = () => {
        if (pin.active) {
          // Clearing is explicit: the kept streak is dropped, and the HUD falls
          // back to whatever the current run has counted.
          savePin(sessionId, IDLE_PIN, score)
          setPinState(IDLE_PIN)
          setGhost(null)
          return
        }
        // Pinning from the keep-prompt adopts the finished run's value.
        const next = { sessionId, active: true, base: ghost === null ? 0 : ghost.value }
        savePin(sessionId, next, score)
        setPinState(next)
        setGhost(null)
      }

      const ghostShown = ghost !== null && streak <= 0 && !pin.active
      const isPreview = forcePreview !== null
      const shown = isPreview ? forcePreview.value : (streak > 0 ? streak : (ghostShown ? ghost.value : 0))
      if (!config.enabled || (expired && !isPreview) || shown <= 0) {
        return null
      }

      const baseTier = tierOf(shown, config.colorTheme)
      // Presets choose particle motion; the count alone chooses the palette.
      const tier = { ...baseTier }
      if (config.accentColor) {
        tier.accent = config.accentColor
        tier.spark = config.accentColor
        const rgb = [1, 3, 5].map(at => parseInt(config.accentColor.slice(at, at + 2), 16)).join(',')
        tier.halo = `rgba(${rgb},.45)`
      }
      if (config.glow === 0) tier.halo = 'transparent'
      const timerDuration = ghostShown ? config.pinPromptMs : config.expireMs > 0 && !pin.active ? config.expireMs : config.timerMs
      const timerStart = ghostShown ? ghost.at : lastCall.sessionId === sessionId ? lastCall.at : combo.changedAt
      // Changing the delay of a running CSS animation would double-count elapsed
      // time. Snapshot it only when the bar (or its animated badge) remounts.
      const timerKey = `${sessionId}:${timerStart}:${timerDuration}:${pop}:${config.showTimer}`
      if (timerPaint.current.key !== timerKey) {
        timerPaint.current = { key: timerKey, elapsed: timerStart > 0 ? Math.max(0, Date.now() - timerStart) : timerDuration }
      }
      const timerElapsed = timerPaint.current.elapsed
      const changePreset = (event) => {
        const next = event.target.value
        if (!Object.hasOwn(PRESETS, next)) return
        storageSet(PRESET_STORAGE_KEY, next)
        setPresetOverride(next)
        setGain(null)
        setPop((token) => token + 1)
        if (motion && config.particles) setParticles({ id: pop + 1 })
      }
      const resetAppearance = () => {
        storageRemove(CUSTOM_STORAGE_KEY)
        storageRemove(PRESET_STORAGE_KEY)
        setAppearance({})
        setPresetOverride(null)
        setParticles(null)
        setGain(null)
      }
      const previewEffect = () => {
        setPop(token => token + 1)
        setGain(null)
        if (motion && config.particles) setParticles({ id: pop + 1 })
      }
      // Audition the blip at the run length it would start from; the click itself
      // is the gesture that lets the audio context resume.
      const previewSound = (overrideTheme) => {
        const at = Math.max(Math.round(config.soundFrom), 1)
        playBlip(at, tierOf(at).id, config.soundVolume, true, overrideTheme || config.soundTheme)
      }
      const side = PLACEMENT[config.position] ?? PLACEMENT['top-right']
      const shownTool = isPreview ? forcePreview.tool : (streak > 0 ? tool : (ghostShown ? ghost.tool : ''))

      const style = {
        position: 'fixed',
        zIndex: 21,
        display: 'flex',
        flexDirection: 'column',
        alignItems: side.right ? 'flex-end' : 'flex-start',
        gap: '5px',

        '--dsh-combo-shake': `${config.shakeIntensity}px`,
        '--dsh-combo-pop-scale': 1.12 + Math.min(25, Math.max(0, shown - config.powerThreshold)) * .004,
        fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
        pointerEvents: 'none',
        userSelect: 'none',
        // `--dsh-frame-top-clearance` is published by the frame (window chrome);
        // the fallback keeps the badge clear of the traffic lights.
        top: side.top ? `calc(var(--dsh-frame-top-clearance, 48px) + ${config.offsetY}px)` : 'auto',
        bottom: side.top ? 'auto' : `calc(${config.offsetY + 8}px + env(safe-area-inset-bottom, 0px))`,
        right: side.right ? `${config.offsetX}px` : 'auto',
        left: side.right ? 'auto' : `${config.offsetX}px`,
      }

      // PowerMode's meter is unboxed: a bright bar over a bold count-colored multiplier.
      const badgeStyle = {
        display: 'inline-flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1,
        minWidth: '96px',
        gap: '2px',
        padding: '7px 4px 0',
        marginTop: '12px',
        background: 'none',
        border: 'none',
        color: config.numberColor || tier.accent,
        fontVariantNumeric: 'tabular-nums',
        fontStyle: 'italic',
        fontWeight: 900,
        lineHeight: 0.95,
        letterSpacing: '-0.065em',
        transformOrigin: side.right ? 'right center' : 'left center',
        opacity: ghostShown ? 0.55 : 1,
        animation: motion && shown >= config.powerThreshold && pop > 0
          ? `dshcombo-pop${strongMotion ? '-strong' : ''}-${pop % MOTION_RING} 360ms cubic-bezier(0.16, 1, 0.3, 1)`
          : 'none',
      }

      const numberStyle = {
        fontSize: tier.id === 'calm' ? '56px' : tier.id === 'warm' ? '60px' : tier.id === 'hot' ? '64px' : '68px',
        textShadow: `0 2px 3px rgba(0,0,0,.3), 0 0 ${16 * config.glow}px ${tier.halo}, 0 0 ${34 * config.glow}px ${tier.halo}`,
      }

      const multiplierStyle = {
        ...numberStyle,
        fontSize: '44px',
        letterSpacing: '-0.08em',
      }

      const barStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: `${config.barHeight}px`,
        transformOrigin: 'left center',
        transform: 'scaleX(0)',
        animation: `dshcombo-countdown ${timerDuration}ms linear forwards`,
        animationDelay: `-${Math.min(timerElapsed, timerDuration)}ms`,
        background: config.numberColor || tier.accent,
        boxShadow: `0 3px 0 ${tier.accent}, 0 0 ${16 * config.glow}px ${tier.halo}, 0 0 ${30 * config.glow}px ${tier.halo}`,
      }

      const toolStyle = {
        fontSize: '11px',
        lineHeight: 1.5,
        fontFamily: 'var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
        color: 'var(--dsw-alias-text-secondary, #aaa)',
        opacity: ghostShown ? 0.5 : 0.75,
        maxWidth: 'min(240px, calc(100vw - 36px))',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: side.right ? 'right' : 'left',
      }

      const gainStyle = {
        position: 'absolute',
        top: '-16px',
        right: side.right ? '28px' : 'auto',
        left: side.right ? 'auto' : 0,
        fontSize: '12px',
        fontWeight: 700,
        color: tier.accent,
        whiteSpace: 'nowrap',
        maxWidth: 'min(240px, calc(100vw - 36px))',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textShadow: `0 0 12px ${tier.halo}`,
        animation: motion ? `dshcombo-float-${pop % MOTION_RING} 760ms ease-out forwards` : 'none',
      }

      const pinStyle = {
        pointerEvents: 'auto',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '28px',
        padding: 0,
        lineHeight: 1,
        borderRadius: '4px',
        border: 'none',
        background: 'transparent',
        color: pin.active ? tier.accent : 'var(--dsw-alias-text-secondary, #aaa)',
        opacity: pin.active ? 1 : 0.45,
        transition: 'opacity 160ms ease, color 160ms ease',
      }

      return h(
        'div',
        {
          'data-dsh-combo': tier.id,
          role: 'status',
          'aria-label': `${shown} combo${pin.active ? ', pinned' : ''}`,
          'data-dsh-combo-score': String(shown),
          'data-dsh-combo-preset': preset,
          'data-dsh-combo-pinned': pin.active ? 'true' : 'false',
          'data-dsh-combo-ghost': ghostShown ? 'true' : 'false',
          style,
        },
        config.showGain && gain !== null && h('div', { key: `gain-${pop}`, style: gainStyle, 'aria-hidden': 'true' },
          config.showCrit && gain.crit && h('span', {
            style: {
              fontSize: '10px',
              fontWeight: 900,
              padding: '1px 5px',
              borderRadius: '3px',
              background: '#f59e0b',
              color: '#000000',
              marginRight: '5px',
              letterSpacing: '-0.02em',
              boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
            },
          }, 'CRIT!'),
          `+${gain.delta}${config.showToolName && tool ? ` ${tool}` : ''}`),
        config.showMilestones && milestone !== null && h('div', {
          key: `milestone-${milestone.id}`,
          'data-dsh-combo-milestone': String(milestone.at),
          style: {
            fontSize: '11px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '999px',
            background: 'rgba(0, 0, 0, 0.75)',
            border: `1px solid ${tier.accent}`,
            color: tier.accent,
            boxShadow: `0 0 14px ${tier.halo}`,
            whiteSpace: 'nowrap',
            animation: 'dshcombo-recap-pop 320ms cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
          },
        }, milestone.title),
        h('div', { key: 'row', style: { display: 'flex', alignItems: 'center', gap: '7px', zoom: config.scale } },
          h('div', {
            key: 'meter',
            style: { position: 'relative', display: 'inline-flex', overflow: 'visible', isolation: 'isolate' },
          },
        motion && particles !== null && h(ParticleBurst, {
          key: `burst-${particles.id}`,
          tier,
          preset,
          config,
          id: particles.id,
          top: side.top,
          right: side.right,
        }),
          h(
            'div',
            {
              key: `badge-${pop}`,
              'data-dsh-combo-badge': tier.id,
              'aria-hidden': 'true',
              style: {
                ...badgeStyle,
                animation: motion && shown >= config.powerThreshold && pop > 0
                  ? `dshcombo-pop${strongMotion ? '-strong' : ''}-${pop % MOTION_RING} 360ms cubic-bezier(0.16, 1, 0.3, 1)${config.shake && config.shakeIntensity > 0 ? `, dshcombo-shake-${pop % MOTION_RING} 200ms ease-out` : ''}`
                  : 'none',
              },
            },
            h('span', { style: numberStyle }, String(shown)),
            h('span', { style: multiplierStyle }, '\u00D7'),
            config.showTimer && h('span', {
              key: `timer-${sessionId}-${timerStart}`,
              style: barStyle,
              'data-dsh-combo-bar': '',
              'data-dsh-combo-timer-start': timerStart,
              title: ghostShown
                ? '连击保留倒计时：点击可跨轮保留本次连击'
                : pin.active
                ? '连击已固定：跨轮持续累加，不受空闲影响'
                : config.expireMs > 0
                ? `连击倒计时：闲置 ${config.expireMs >= 60000 && config.expireMs % 60000 === 0 ? `${config.expireMs / 60000} 分钟` : `${config.expireMs / 1000} 秒`} 后清零，思考或调用时重新补满`
                : '连击保持中：无限模式，不随空闲时间衰减',
            }),
          )),
          h('button', {
            key: 'pin',
            type: 'button',
            'data-dsh-combo-pin': pin.active ? 'on' : 'off',
            'aria-label': pin.active ? '\u53D6\u6D88\u4FDD\u6301\u8FDE\u51FB' : '\u4FDD\u6301\u8FDE\u51FB\uFF08\u8DE8\u8F6E\u7D2F\u8BA1\uFF09',
            title: pin.active
              ? '\u53D6\u6D88\u4FDD\u6301\u5E76\u6E05\u96F6'
              : '\u4FDD\u6301\u8FDE\u51FB\uFF1A\u672C\u8F6E\u7ED3\u675F\u540E\u7EE7\u7EED\u7D2F\u8BA1',
            'aria-pressed': pin.active,
            onClick: togglePin,
            style: pinStyle,
          },
            h('svg', {
              viewBox: '0 0 24 24',
              width: '14',
              height: '14',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: '1.8',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-hidden': 'true',
            },
              h('path', { d: 'M16 3 21 8 17 9 14 12 13 16 10 18 6 13 11 12 14 9 15 5Z' }),
              h('path', { d: 'm3 21 8-8' }),
            ),
          ),
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', maxWidth: 'calc(100vw - 36px)' } },
          config.showToolName && shownTool !== '' && h('div', { style: toolStyle, 'aria-hidden': 'true' }, shownTool),
          h('select', {
            'data-dsh-combo-preset-select': '',
            'aria-label': '连击特效样式',
            title: '切换特效样式',
            value: preset,
            onChange: changePreset,
            style: {
              pointerEvents: 'auto', cursor: 'pointer', background: 'transparent',
              color: tier.accent, border: 'none', borderRadius: '3px',
              fontSize: '10px', padding: '2px', maxWidth: '70px',
            },
          }, Object.entries(PRESETS).map(([value, label]) => h('option', { key: value, value }, label))),
          h(AppearanceSettings, { config, customize, onReset: resetAppearance, onPreview: previewEffect, onPreviewSound: previewSound, right: side.right, top: side.top }),
        ),
        recap !== null && h('div', {
          key: `recap-${recap.at}`,
          'data-dsh-combo-recap': recap.grade,
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '10px',
            background: 'var(--dsw-alias-bg-overlay, rgba(15, 23, 42, 0.92))',
            border: `1.5px solid ${tier.accent}`,
            boxShadow: `0 8px 24px -2px rgba(0,0,0,0.45), 0 0 16px ${tier.halo}`,
            backdropFilter: 'blur(12px)',
            color: '#f8fafc',
            pointerEvents: 'auto',
            animation: 'dshcombo-recap-pop 360ms cubic-bezier(0.16, 1, 0.3, 1)',
            marginTop: '4px',
            maxWidth: 'min(320px, calc(100vw - 36px))',
          },
        },
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: recap.grade === 'SSS' ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : 'linear-gradient(135deg, #3b82f6, #10b981)',
              fontWeight: 900,
              fontSize: '13px',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              fontStyle: 'italic',
            },
          }, recap.grade),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 } },
            h('span', { style: { fontSize: '11px', fontWeight: 700, color: tier.accent } }, '回合战报结算 (Turn Recap)'),
            h('span', { style: { fontSize: '10px', color: '#cbd5e1', lineHeight: 1.3 } },
              `完成 ${recap.count} 次连携，峰值 ${recap.peak}×，达成 ${recap.grade} 级智能心流`)),
          h('button', {
            type: 'button',
            onClick: () => setRecap(null),
            style: {
              padding: '2px 6px',
              fontSize: '11px',
              color: '#94a3b8',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            },
          }, '✕')),
      )
    }

    const SECTION_META = {
      '连击与节奏': { icon: '⚡', desc: '调节 Token 连击比率、倒计时时长、空闲清零与物理微动抖动' },
      '外观风格': { icon: '🎨', desc: '选择视觉预设、计数器大小、进度条高度与自定义配色' },
      '外观': { icon: '🎨', desc: '选择视觉预设、计数器大小、进度条高度与自定义配色' },
      '粒子系统': { icon: '✨', desc: '精细调节粒子数量、飞散大小、扩散半径与动画时长' },
      '粒子': { icon: '✨', desc: '精细调节粒子数量、飞散大小、扩散半径与动画时长' },
      '位置布局': { icon: '📍', desc: '设定悬浮 HUD 在屏幕上的停靠角落与 X/Y 像素边距' },
      '位置': { icon: '📍', desc: '设定悬浮 HUD 在屏幕上的停靠角落与 X/Y 像素边距' },
      '显示元素': { icon: '👁️', desc: '自由控制倒计时条、单次增量跳动与当前思考/工具名' },
      '显示': { icon: '👁️', desc: '自由控制倒计时条、单次增量跳动与当前思考/工具名' },
      '连击打击音效': { icon: '🔊', desc: '轻击音效反馈，随连击数动态改变音阶韵律与打击感' },
      '音效': { icon: '🔊', desc: '轻击音效反馈，随连击数动态改变音阶韵律与打击感' },
      '高级过滤': { icon: '🛡️', desc: '配置特定工具名单，跳过不需要参与连击计数的调用' },
    }

    /**
     * The shared control builders. The HUD's gear panel and the Plugins-page
     * configuration page render polished modern cards and controls.
     *
     * @param config - the effective values the controls display.
     * @param write - `(key, value) => void`, the surface's own save path.
     */
    function controlKit(config, write, { compact = false } = {}) {
      const accent = 'var(--dsh-c-accent, var(--dsw-alias-brand-primary, var(--dsh-combo-control-accent, #10b981)))'
      const textPrimary = 'var(--dsh-c-text-primary, var(--dsw-alias-label-primary, var(--dsw-alias-text-primary, #0f172a)))'
      const textSecondary = 'var(--dsh-c-text-secondary, var(--dsw-alias-label-secondary, var(--dsw-alias-text-secondary, #64748b)))'
      const itemBg = compact
        ? 'transparent'
        : 'var(--dsh-c-item-bg, var(--dsw-alias-bg-module-platform, rgba(125, 125, 125, 0.04)))'
      const itemBorder = compact
        ? 'transparent'
        : 'var(--dsh-c-item-border, var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.12)))'
      const cardBg = 'var(--dsh-c-card-bg, var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.85))))'
      const cardBorder = 'var(--dsh-c-card-border, var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2, rgba(125, 125, 125, 0.15))))'

      const range = (key, label, min, max, step, unit = '', desc = '') => {
        const val = typeof config[key] === 'number' && Number.isFinite(config[key]) ? config[key] : min
        const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100))
        const formatValue = (k, v) => {
          if (k === 'particleCount' && v === 0) return '自动'
          if (k === 'expireMs') {
            if (v === 0) return compact ? '无限' : '无限 (永不清零)'
            if (v >= 60000 && v % 60000 === 0) return compact ? `${v / 60000}m` : `${v / 60000} 分钟`
            return compact ? `${v / 1000}s` : `${v / 1000} 秒`
          }
          if (k === 'timerMs') {
            if (v >= 60000 && v % 60000 === 0) return compact ? `${v / 60000}m` : `${v / 60000} 分钟`
            return compact ? `${v / 1000}s` : `${v / 1000} 秒`
          }
          return `${v}${unit}`
        }
        const expirePresets = compact
          ? [
              { label: '∞ 无限', value: 0 },
              { label: '5s', value: 5000 },
              { label: '10s', value: 10000 },
              { label: '30s', value: 30000 },
              { label: '60s', value: 60000 },
            ]
          : [
              { label: '∞ 无限 (永不清零)', value: 0 },
              { label: '5 秒', value: 5000 },
              { label: '10 秒', value: 10000 },
              { label: '30 秒', value: 30000 },
              { label: '60 秒', value: 60000 },
              { label: '5 分钟', value: 300000 },
            ]

        if (compact) {
          return h('div', { key, style: { margin: '4px 0 6px' } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' } },
              h('span', { style: { fontSize: '11px', fontWeight: 500, color: textPrimary } }, label),
              h('span', {
                style: {
                  fontSize: '10px',
                  fontWeight: 600,
                  color: accent,
                  fontVariantNumeric: 'tabular-nums',
                },
              }, formatValue(key, val)),
            ),
            h('input', {
              type: 'range',
              min,
              max,
              step,
              value: val,
              'aria-label': label,
              'data-dsh-combo-setting': key,
              className: 'dsh-combo-slider',
              style: {
                width: '100%',
                accentColor: accent,
                cursor: 'pointer',
                margin: '2px 0 0',
                background: `linear-gradient(to right, ${accent} ${pct}%, rgba(125, 125, 125, 0.18) ${pct}%)`,
                borderRadius: '999px',
                height: '4px',
              },
              onChange: event => write(key, Number(event.target.value)),
            }),
            key === 'expireMs' && h('div', {
              key: 'expire-presets',
              style: { display: 'flex', gap: '4px', flexWrap: 'wrap', margin: '4px 0 2px' },
            },
              expirePresets.map(p => {
                const isSelected = val === p.value
                return h('button', {
                  key: `exp-${p.value}`,
                  type: 'button',
                  onClick: (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    write(key, p.value)
                  },
                  style: {
                    padding: '2px 7px',
                    fontSize: '9px',
                    borderRadius: '4px',
                    border: `1px solid ${isSelected ? accent : 'rgba(125, 125, 125, 0.2)'}`,
                    background: isSelected ? 'var(--dsh-c-accent-bg, rgba(16, 185, 129, 0.16))' : 'transparent',
                    color: isSelected ? accent : textSecondary,
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                  },
                }, p.label)
              })
            ),
          )
        }
        return h('label', {
          key,
          style: {
            display: 'block',
            margin: '8px 0',
            padding: '10px 14px',
            background: itemBg,
            borderRadius: '10px',
            border: `1px solid ${itemBorder}`,
            transition: 'all 160ms ease',
          },
        },
          h('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            },
          },
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 } },
              h('span', { style: { fontSize: '13px', fontWeight: 500, color: textPrimary } }, label),
              desc ? h('span', { style: { fontSize: '11px', color: textSecondary, lineHeight: 1.4 } }, desc) : null),
            h('span', {
              style: {
                fontSize: '11px',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: accent,
                background: 'var(--dsh-c-accent-bg, rgba(16, 185, 129, 0.12))',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                whiteSpace: 'nowrap',
              },
            }, formatValue(key, val)),
          ),
          h('input', {
            type: 'range',
            min,
            max,
            step,
            value: val,
            'aria-label': label,
            'data-dsh-combo-setting': key,
            className: 'dsh-combo-slider',
            style: {
              width: '100%',
              accentColor: accent,
              cursor: 'pointer',
              margin: '4px 0 2px',
              background: `linear-gradient(to right, ${accent} ${pct}%, var(--dsh-c-badge-bg, rgba(125,125,125,0.18)) ${pct}%)`,
              borderRadius: '999px',
              height: '6px',
            },
            onChange: event => write(key, Number(event.target.value)),
          }),
          key === 'expireMs' && h('div', {
            key: 'expire-presets',
            style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' },
          },
            expirePresets.map(p => {
              const isSelected = val === p.value
              return h('button', {
                key: `exp-${p.value}`,
                type: 'button',
                onClick: (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  write(key, p.value)
                },
                style: {
                  padding: '4px 10px',
                  fontSize: '11px',
                  borderRadius: '6px',
                  border: `1px solid ${isSelected ? accent : itemBorder}`,
                  background: isSelected ? 'var(--dsh-c-accent-bg, rgba(16, 185, 129, 0.16))' : 'transparent',
                  color: isSelected ? accent : textSecondary,
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                },
              }, p.label)
            })
          ),
        )
      }

      const toggle = (key, label, desc = '') => {
        const isChecked = Boolean(config[key])
        if (compact) {
          return h('label', {
            key,
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '4px 0',
              cursor: 'pointer',
              height: '26px',
            },
          },
            h('span', { style: { fontSize: '11px', fontWeight: 500, color: textPrimary } }, label),
            h('div', {
              style: {
                position: 'relative',
                width: '32px',
                height: '18px',
                borderRadius: '999px',
                background: isChecked ? accent : 'rgba(125, 125, 125, 0.25)',
                transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                flexShrink: 0,
                boxShadow: isChecked ? '0 0 6px rgba(16, 185, 129, 0.3)' : 'none',
              },
            },
              h('input', {
                type: 'checkbox',
                checked: isChecked,
                'aria-label': label,
                'data-dsh-combo-setting': key,
                style: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, margin: 0, cursor: 'pointer', zIndex: 2 },
                onChange: event => write(key, event.target.checked),
              }),
              h('span', {
                style: {
                  position: 'absolute',
                  top: '2px',
                  left: '2px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  transform: isChecked ? 'translateX(14px)' : 'translateX(0px)',
                  transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                  pointerEvents: 'none',
                },
              }),
            ),
          )
        }
        return h('label', {
          key,
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '14px',
            margin: '8px 0',
            padding: '10px 14px',
            background: itemBg,
            borderRadius: '10px',
            border: `1px solid ${itemBorder}`,
            cursor: 'pointer',
            transition: 'all 160ms ease',
          },
        },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 } },
            h('span', { style: { fontSize: '13px', fontWeight: 500, color: textPrimary } }, label),
            desc ? h('span', { style: { fontSize: '11px', color: textSecondary, lineHeight: 1.4 } }, desc) : null),
          h('div', {
            style: {
              position: 'relative',
              width: '40px',
              height: '22px',
              borderRadius: '999px',
              background: isChecked ? accent : 'var(--dsh-c-badge-bg, rgba(125, 125, 125, 0.22))',
              transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
              boxShadow: isChecked ? '0 0 10px rgba(16, 185, 129, 0.35)' : 'none',
            },
          },
            h('input', {
              type: 'checkbox',
              checked: isChecked,
              'aria-label': label,
              'data-dsh-combo-setting': key,
              style: {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                margin: 0,
                cursor: 'pointer',
                zIndex: 2,
              },
              onChange: event => write(key, event.target.checked),
            }),
            h('span', {
              style: {
                position: 'absolute',
                top: '2px',
                left: '2px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
                transform: isChecked ? 'translateX(18px)' : 'translateX(0px)',
                transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: 'none',
              },
            })))
      }

      const color = (key, label, fallback, desc = '') => {
        const currentColor = config[key] || fallback
        const swatches = ['#9be779', '#00f0ff', '#fbbf24', '#ff5c5c', '#c084fc', '#f5fff0']
        if (compact) {
          return h('div', {
            key,
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '4px 0',
              height: '26px',
            },
          },
            h('span', { style: { fontSize: '11px', fontWeight: 500, color: textPrimary } }, label),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              h('label', {
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '2px 5px',
                  borderRadius: '5px',
                  border: '1px solid var(--dsw-alias-border-l1, rgba(125,125,125,0.2))',
                  background: 'var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2, rgba(125, 125, 125, 0.08)))',
                },
              },
                h('span', {
                  style: {
                    width: '11px',
                    height: '11px',
                    borderRadius: '2px',
                    background: config[key] || fallback,
                    display: 'inline-block',
                    border: '1px solid rgba(0,0,0,0.15)',
                  },
                }),
                h('span', { style: { fontSize: '10px', color: textPrimary } }, config[key] || '默认'),
                h('input', {
                  type: 'color',
                  value: config[key] || fallback,
                  'aria-label': label,
                  'data-dsh-combo-setting': key,
                  style: { opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' },
                  onChange: event => write(key, event.target.value),
                }),
              ),
              h('button', {
                type: 'button',
                onClick: () => write(key, ''),
                style: {
                  fontSize: '10px',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  border: '1px solid var(--dsw-alias-border-l1, rgba(125,125,125,0.2))',
                  background: config[key] === '' ? 'var(--dsw-alias-brand-primary-fade, rgba(37,99,235,0.12))' : 'transparent',
                  color: config[key] === '' ? accent : textSecondary,
                  cursor: 'pointer',
                },
              }, '自动'),
            ),
          )
        }
        return h('div', {
          key,
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            margin: '8px 0',
            padding: '10px 14px',
            background: itemBg,
            borderRadius: '10px',
            border: `1px solid ${itemBorder}`,
          },
        },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: '150px' } },
            h('span', { style: { fontSize: '13px', fontWeight: 500, color: textPrimary } }, label),
            desc ? h('span', { style: { fontSize: '11px', color: textSecondary } }, desc) : null),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
            h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } },
              swatches.map(swatch => h('button', {
                key: swatch,
                type: 'button',
                title: swatch,
                onClick: () => write(key, swatch),
                style: {
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: swatch,
                  border: config[key] === swatch ? `2px solid ${accent}` : '1px solid rgba(125,125,125,0.3)',
                  boxShadow: config[key] === swatch ? `0 0 6px ${accent}` : 'none',
                  cursor: 'pointer',
                  padding: 0,
                },
              }))),
            h('label', {
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'var(--dsh-c-badge-bg, rgba(125,125,125,0.1))',
                border: `1px solid ${itemBorder}`,
              },
            },
              h('span', {
                style: {
                  width: '14px',
                  height: '14px',
                  borderRadius: '3px',
                  background: currentColor,
                  border: '1px solid rgba(125,125,125,0.3)',
                  display: 'inline-block',
                },
              }),
              h('span', { style: { fontSize: '11px', fontVariantNumeric: 'tabular-nums', color: textPrimary } }, config[key] || '默认'),
              h('input', {
                type: 'color',
                value: config[key] || fallback,
                'aria-label': label,
                'data-dsh-combo-setting': key,
                style: { opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' },
                onChange: event => write(key, event.target.value),
              })),
            h('button', {
              type: 'button',
              onClick: () => write(key, ''),
              style: {
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 500,
                padding: '3px 8px',
                borderRadius: '6px',
                border: `1px solid ${itemBorder}`,
                background: config[key] === '' ? 'var(--dsh-c-accent-bg, rgba(16, 185, 129, 0.12))' : 'transparent',
                color: config[key] === '' ? accent : textSecondary,
                transition: 'all 140ms ease',
              },
            }, '自动')))
      }

      const select = (key, label, options, descOrExtra = '', maybeExtra = null) => {
        const desc = typeof descOrExtra === 'string' ? descOrExtra : ''
        const extra = typeof descOrExtra === 'object' && descOrExtra !== null ? descOrExtra : maybeExtra
        if (compact) {
          return h('div', {
            key,
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '4px 0',
              gap: '6px',
              height: '26px',
            },
          },
            h('span', { style: { fontSize: '11px', fontWeight: 500, color: textPrimary, flex: 1, minWidth: 0 } }, label),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
              h('select', {
                value: config[key],
                'aria-label': label,
                'data-dsh-combo-setting': key,
                onChange: event => write(key, event.target.value),
                style: {
                  maxWidth: '120px',
                  padding: '2px 6px',
                  fontSize: '11px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: '1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.2))',
                  background: 'var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2, rgba(125, 125, 125, 0.08)))',
                  color: textPrimary,
                  cursor: 'pointer',
                },
              }, Object.entries(options).map(([value, text]) => h('option', { key: value, value }, text))),
              extra,
            ),
          )
        }
        return h('label', {
          key,
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '14px',
            margin: '8px 0',
            padding: '10px 14px',
            background: itemBg,
            borderRadius: '10px',
            border: `1px solid ${itemBorder}`,
          },
        },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 } },
            h('span', { style: { fontSize: '13px', fontWeight: 500, color: textPrimary } }, label),
            desc ? h('span', { style: { fontSize: '11px', color: textSecondary, lineHeight: 1.4 } }, desc) : null),
          h('select', {
            value: config[key],
            'aria-label': label,
            'data-dsh-combo-setting': key,
            onChange: event => write(key, event.target.value),
            style: {
              maxWidth: '180px',
              padding: '5px 10px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '8px',
              border: `1px solid ${itemBorder}`,
              background: 'var(--dsh-c-input-bg, var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-2, rgba(125, 125, 125, 0.08))))',
              color: textPrimary,
              cursor: 'pointer',
              outline: 'none',
            },
          },
            Object.entries(options).map(([value, text]) => h('option', { key: value, value }, text))))
      }

      const list = (key, label, hint, desc = '') => {
        if (compact) {
          return h('div', { key, style: { margin: '4px 0' } },
            h('span', { style: { display: 'block', fontSize: '11px', fontWeight: 500, color: textPrimary, marginBottom: '2px' } }, label),
            h('input', {
              type: 'text',
              value: Array.isArray(config[key]) ? config[key].join(', ') : '',
              'aria-label': label,
              'data-dsh-combo-setting': key,
              placeholder: hint,
              style: {
                width: '100%',
                padding: '4px 6px',
                fontSize: '11px',
                boxSizing: 'border-box',
                borderRadius: '5px',
                border: '1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.2))',
                background: 'var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2, rgba(125, 125, 125, 0.08)))',
                color: textPrimary,
                outline: 'none',
              },
              onChange: event => write(key, event.target.value),
            }),
          )
        }
        const currentTools = Array.isArray(config[key]) ? config[key] : []
        const currentText = currentTools.join(', ')
        const commonTools = ['bash', 'edit', 'read', 'todo_write', 'web_search']
        const toggleTool = (tool) => {
          const next = [...currentTools]
          const idx = next.indexOf(tool)
          if (idx >= 0) next.splice(idx, 1)
          else next.push(tool)
          write(key, next.join(', '))
        }

        return h('div', {
          key,
          style: {
            display: 'block',
            margin: '8px 0',
            padding: '12px 14px',
            background: itemBg,
            borderRadius: '10px',
            border: `1px solid ${itemBorder}`,
          },
        },
          h('div', { style: { marginBottom: '8px' } },
            h('span', { style: { display: 'block', fontSize: '13px', fontWeight: 500, color: textPrimary } }, label),
            desc ? h('span', { style: { display: 'block', fontSize: '11px', color: textSecondary, marginTop: '2px' } }, desc) : null),
          h('input', {
            type: 'text',
            value: currentText,
            'aria-label': label,
            'data-dsh-combo-setting': key,
            placeholder: hint,
            style: {
              width: '100%',
              padding: '8px 12px',
              fontSize: '12px',
              boxSizing: 'border-box',
              borderRadius: '8px',
              border: `1px solid ${itemBorder}`,
              background: 'var(--dsh-c-input-bg, var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-2, rgba(125, 125, 125, 0.08))))',
              color: textPrimary,
              outline: 'none',
              fontVariantNumeric: 'tabular-nums',
            },
            onChange: event => write(key, event.target.value),
          }),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '8px' } },
            h('span', { style: { fontSize: '11px', color: textSecondary } }, '快捷过滤推荐:'),
            commonTools.map(tool => {
              const active = currentTools.includes(tool)
              return h('button', {
                key: tool,
                type: 'button',
                onClick: () => toggleTool(tool),
                style: {
                  fontSize: '11px',
                  fontVariantNumeric: 'tabular-nums',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: active ? `1px solid ${accent}` : `1px solid ${itemBorder}`,
                  background: active ? 'var(--dsh-c-accent-bg, rgba(16, 185, 129, 0.15))' : 'var(--dsh-c-badge-bg, rgba(125,125,125,0.06))',
                  color: active ? accent : textSecondary,
                  fontWeight: active ? 600 : 400,
                  transition: 'all 140ms ease',
                },
              }, `${active ? '✓ ' : '+ '}${tool}`)
            })))
      }

      const group = (title, ...children) => h('div', {
        key: `group-${title}`,
        style: {
          margin: '10px 0 6px',
          padding: '0 2px',
        },
      },
        h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
          },
        },
          h('span', {
            style: {
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: textSecondary,
            },
          }, title),
          h('div', {
            style: {
              flex: 1,
              height: '1px',
              background: 'var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.15))',
            },
          })),
        children)

      const section = (title, ...controls) => {
        const meta = SECTION_META[title] || { icon: '⚙️', desc: '' }
        return h('div', {
          key: title,
          'data-dsh-combo-section': title,
          style: {
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: '16px',
            padding: '16px 18px 14px',
            margin: '14px 0',
            boxShadow: 'var(--dsh-c-shadow, 0 4px 20px -2px rgba(0,0,0,0.05))',
            backdropFilter: 'blur(16px)',
          },
        },
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              paddingBottom: '12px',
              marginBottom: '10px',
              borderBottom: `1px solid ${itemBorder}`,
            },
          },
            h('div', {
              style: {
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'var(--dsh-c-accent-bg, rgba(16, 185, 129, 0.12))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0,
              },
            }, meta.icon),
            h('div', { style: { minWidth: 0, flex: 1 } },
              h('h3', {
                style: {
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 600,
                  color: textPrimary,
                  letterSpacing: '-0.01em',
                },
              }, title),
              meta.desc ? h('p', {
                style: {
                  margin: '2px 0 0',
                  fontSize: '11px',
                  color: textSecondary,
                  lineHeight: 1.4,
                },
              }, meta.desc) : null)),
          controls)
      }

      return { range, toggle, color, section, select, list, group }
    }

/** Numeric ranges this page edits; the two delays are not on the gear panel. */
    const PAGE_RANGES = { ...CUSTOM_RANGES, expireMs: [0, 600000], pinPromptMs: [0, 60000] }
    /** Switches, including the one that decides whether a HUD exists at all. */
    const PAGE_SWITCHES = ['enabled', 'showToolName', 'particles', 'shake', 'showGain', 'showTimer']
    const OPTIONAL_SWITCHES = ['screenVignette', 'recapCard', 'showMilestones', 'showCrit']

    /**
     * Coerce one Host config section into values the controls can draw: a
     * hand-edited patch must never hand a range a string or a select a stale
     * enum member.
     *
     * @param raw - the namespace's current value, or anything else.
     * @returns every field this page edits, at a value it can render.
     */
    function pageConfig(raw) {
      const source = raw !== null && typeof raw === 'object' ? raw : {}
      const unwrapped = {}
      for (const [key, value] of Object.entries(source)) {
        unwrapped[key] = value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
      }
      const config = { ...CONFIG_DEFAULTS, ...cleanAppearance(unwrapped) }
      for (const [key, [min, max]] of Object.entries(PAGE_RANGES)) {
        const parsed = Number(unwrapped[key])
        config[key] = Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : CONFIG_DEFAULTS[key]
      }
      for (const key of PAGE_SWITCHES) config[key] = unwrapped[key] !== false
      for (const key of OPTIONAL_SWITCHES) config[key] = unwrapped[key] === true
      // Sound is the one switch that defaults off: an accidental beep is worse
      // than a missing one.
      config.sound = unwrapped.sound === true
      config.soundTheme = Object.hasOwn(SOUND_THEMES, unwrapped.soundTheme) ? unwrapped.soundTheme : CONFIG_DEFAULTS.soundTheme
      config.comboMode = Object.hasOwn(COMBO_MODES, unwrapped.comboMode) ? unwrapped.comboMode : CONFIG_DEFAULTS.comboMode
      config.preset = Object.hasOwn(PRESETS, unwrapped.preset) ? unwrapped.preset : (LEGACY_PRESETS[unwrapped.preset] ?? CONFIG_DEFAULTS.preset)
      config.colorTheme = Object.hasOwn(COLOR_THEMES, unwrapped.colorTheme) ? unwrapped.colorTheme : CONFIG_DEFAULTS.colorTheme
      config.excludeTools = Array.isArray(unwrapped.excludeTools) ? unwrapped.excludeTools.map(String) : []
      return config
    }

    /** Split the list editor's text into tool names. */
    function splitTools(text) {
      return String(text).split(/[,\s]+/).map((part) => part.trim()).filter((part) => part !== '')
    }

    const CONFIG_PAGE_CSS = `
.dsh-combo-window {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 880px;
  min-width: min(100%, 720px);
  margin: 0 auto;
  border-radius: 16px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.2));
  background: var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-1, #1e293b));
  box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: var(--dsw-alias-label-primary, var(--dsw-alias-text-primary, #f8fafc));
  box-sizing: border-box;
  transition: all 200ms ease;
}

.dsh-combo-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 18px;
  background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2, rgba(125, 125, 125, 0.08)));
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.15));
  user-select: none;
  box-sizing: border-box;
}

.dsh-combo-body {
  display: flex;
  min-height: 540px;
  box-sizing: border-box;
}

.dsh-combo-sidebar {
  width: 200px;
  min-width: 200px;
  max-width: 200px;
  flex-shrink: 0;
  background: var(--dsw-alias-bg-module-platform, var(--dsw-specific-sidebar-fill, rgba(125, 125, 125, 0.05)));
  border-right: 1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.15));
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
}

.dsh-combo-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, var(--dsw-alias-text-secondary, #94a3b8));
  background: transparent;
  border: 1px solid transparent;
  cursor: pointer;
  text-align: left;
  transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1);
  width: 100%;
  box-sizing: border-box;
}
.dsh-combo-nav-item:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(125, 125, 125, 0.1));
  color: var(--dsw-alias-label-primary, var(--dsw-alias-text-primary, #ffffff));
  transform: translateX(2px);
}
.dsh-combo-nav-item.active {
  background: var(--dsw-alias-brand-primary-fade, rgba(37, 99, 235, 0.15));
  border-color: var(--dsw-alias-brand-primary-fade2, rgba(37, 99, 235, 0.3));
  color: var(--dsw-alias-brand-primary, #38bdf8);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.15);
}

.dsh-combo-content {
  flex: 1;
  min-width: 0;
  width: calc(100% - 200px);
  padding: 20px 24px 32px;
  overflow-y: auto;
  max-height: min(680px, calc(100vh - 120px));
  background: var(--dsw-alias-bg-base, var(--dsw-alias-bg-layer-1, transparent));
  box-sizing: border-box;
}

.dsh-combo-tab-pane {
  animation: dshcombo-tab-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes dshcombo-tab-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dsh-combo-card {
  border: 1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.18));
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 16px;
  background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-1, rgba(125, 125, 125, 0.05)));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 180ms ease;
  box-sizing: border-box;
}
.dsh-combo-card:hover {
  border-color: var(--dsw-alias-border-l2, rgba(125, 125, 125, 0.3));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}
.dsh-combo-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, var(--dsw-alias-text-primary, #f8fafc));
  margin-bottom: 12px;
}

.dsh-combo-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2, rgba(125, 125, 125, 0.08)));
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.15));
  flex-wrap: wrap;
  gap: 12px;
  box-sizing: border-box;
}

.dsh-combo-simulator {
  position: relative;
  border-radius: 14px;
  background: radial-gradient(ellipse at 50% 25%, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 8px 24px -4px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  margin-bottom: 18px;
  padding: 14px 18px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  user-select: none;
  box-sizing: border-box;
}

.dsh-combo-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  outline: none;
  margin: 6px 0 2px;
  cursor: pointer;
  transition: all 0.2s ease;
}
@keyframes dshcombo-recap-pop {
  0% { transform: scale(0.85); opacity: 0; }
  50% { transform: scale(1.04); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes dshcombo-vignette-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.95; }
}
.dsh-combo-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--dsw-alias-brand-primary, #38bdf8);
  border: 2px solid var(--dsw-alias-bg-base, #ffffff);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.dsh-combo-slider::-webkit-slider-thumb:hover {
  transform: scale(1.25);
  box-shadow: 0 0 10px var(--dsw-alias-brand-primary, #38bdf8);
}
.dsh-combo-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--dsw-alias-brand-primary, #38bdf8);
  border: 2px solid var(--dsw-alias-bg-base, #ffffff);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}

.dsh-combo-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.dsh-combo-preset-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 10px;
  border-radius: 12px;
  border: 1.5px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.15));
  background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-1, rgba(125, 125, 125, 0.05)));
  color: var(--dsw-alias-label-primary, var(--dsw-alias-text-primary, inherit));
  cursor: pointer;
  text-align: center;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}
.dsh-combo-preset-item:hover {
  border-color: var(--dsw-alias-brand-primary, #38bdf8);
  background: var(--dsw-alias-interactive-bg-hover, rgba(125, 125, 125, 0.1));
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}
.dsh-combo-preset-item.active {
  border-color: var(--dsw-alias-brand-primary, #38bdf8);
  background: var(--dsw-alias-brand-primary-fade, rgba(37, 99, 235, 0.15));
  box-shadow: 0 0 12px rgba(37, 99, 235, 0.25);
}

.dsh-combo-pos-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.dsh-combo-pos-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.18));
  background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-1, rgba(125, 125, 125, 0.05)));
  color: var(--dsw-alias-label-secondary, var(--dsw-alias-text-secondary, #94a3b8));
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.16s ease;
}
.dsh-combo-pos-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(125, 125, 125, 0.1));
  color: var(--dsw-alias-label-primary, var(--dsw-alias-text-primary, #f8fafc));
  transform: translateY(-1px);
}
.dsh-combo-pos-btn.active {
  background: var(--dsw-alias-brand-primary-fade, rgba(37, 99, 235, 0.15));
  border-color: var(--dsw-alias-brand-primary, #38bdf8);
  color: var(--dsw-alias-brand-primary, #38bdf8);
  font-weight: 600;
}

.dsh-combo-tab-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  padding: 4px 0 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.15));
}
.dsh-combo-tab-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 7px 4px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary, var(--dsw-alias-text-secondary, #94a3b8));
  cursor: pointer;
  white-space: nowrap;
  transition: all 160ms cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}
.dsh-combo-tab-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(125, 125, 125, 0.1));
  color: var(--dsw-alias-label-primary, var(--dsw-alias-text-primary, #f8fafc));
  transform: translateY(-1px);
}
.dsh-combo-tab-btn.active {
  background: var(--dsw-alias-brand-primary-fade, rgba(37, 99, 235, 0.15));
  border-color: var(--dsw-alias-brand-primary-fade2, rgba(37, 99, 235, 0.35));
  color: var(--dsw-alias-brand-primary, #38bdf8);
  font-weight: 600;
  box-shadow: 0 1px 6px rgba(37, 99, 235, 0.2);
}

@keyframes dshcombo-slash-beam {
  0% { opacity: 0; transform: rotate(-32deg) translate(-140px, -24px) scaleX(0.2); }
  25% { opacity: 1; transform: rotate(-32deg) translate(0px, 0px) scaleX(1.15); }
  60% { opacity: 0.95; transform: rotate(-32deg) translate(40px, 10px) scaleX(1); }
  100% { opacity: 0; transform: rotate(-32deg) translate(130px, 24px) scaleX(0.1); }
}

@keyframes dshcombo-cross-flash {
  0% { opacity: 0; transform: scale(0.2) rotate(0deg); }
  25% { opacity: 1; transform: scale(1.4) rotate(45deg); }
  100% { opacity: 0; transform: scale(0.1) rotate(90deg); }
}

@keyframes dshcombo-aura-pulse {
  0% { opacity: 0; transform: scale(0.4); }
  30% { opacity: 0.95; transform: scale(1.35); }
  70% { opacity: 0.8; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(1.5); }
}

@keyframes dshcombo-glitch-slice {
  0% { opacity: 0; transform: translateX(0); }
  20% { opacity: 0.95; transform: translateX(-14px); }
  45% { opacity: 0.9; transform: translateX(12px); }
  75% { opacity: 0.7; transform: translateX(-6px); }
  100% { opacity: 0; transform: translateX(0); }
}
`

    const SIDEBAR_ITEMS = [
      { id: 'basic', label: '基础设置', icon: '⚙️' },
      { id: 'effects', label: '特效设置', icon: '✦' },
      { id: 'appearance', label: '外观风格', icon: '🎨' },
      { id: 'sound', label: '音效设置', icon: '🔊' },
      { id: 'display', label: '显示与界面', icon: '🖥️' },
      { id: 'advanced', label: '高级选项', icon: '🎛️' },
      { id: 'about', label: '关于插件', icon: 'ℹ️' },
      { id: 'all', label: '全部设置', icon: '📋' },
    ]

    const PRESET_CARDS = [
      { id: 'particles', name: '晶莹粒子', icon: '🌟', desc: '经典极简微粒飘散' },
      { id: 'fireworks', name: '绚烂烟花', icon: '🎆', desc: '全向放射星光炸裂' },
      { id: 'slash', name: '光刃斩击', icon: '⚔️', desc: '45°极速激光刀光切痕' },
      { id: 'aura', name: '超赛气焰', icon: '🔥', desc: '数字本体翻腾爆气包裹' },
      { id: 'glitch', name: '赛博故障', icon: '👾', desc: 'RGB色相撕裂与切片' },
    ]

    const MODE_CARDS = [
      { id: 'hybrid', name: '混合全开', icon: '⚡', desc: '流式 Token 暴击 + 工具调用全开' },
      { id: 'tokens', name: '流式 Token', icon: '✍️', desc: '按打字流式输出连续判定' },
      { id: 'tools', name: '经典工具', icon: '🛠️', desc: '纯工具调用与回合触发连击' },
    ]

    const POS_OPTIONS = [
      { id: 'top-left', name: '↖ 左上角' },
      { id: 'top-right', name: '↗ 右上角' },
      { id: 'bottom-left', name: '↙ 左下角' },
      { id: 'bottom-right', name: '↘ 右下角' },
    ]

    const SOUND_CARDS = [
      { id: 'blip', name: '轻柔敲击', icon: '🔔', desc: '经典温和纯音，清爽耐听' },
      { id: 'keyboard', name: '机械轴音', icon: '⌨️', desc: '扎实沉稳的双层 Thock 轴声' },
      { id: 'bubble', name: '治愈气泡', icon: '🫧', desc: 'Q 弹水滴气泡，治愈解压' },
      { id: 'arcade', name: '复古街机', icon: '🕹️', desc: '8-Bit 电玩经典五度和弦' },
      { id: 'laser', name: '未来激光', icon: '⚡', desc: '科幻脉冲下潜激光，极具速度感' },
      { id: 'melodic', name: '动态音阶', icon: '🎹', desc: '连击越高音调越激昂的旋律' },
    ]

    /**
     * Shared settings pane builder for both the HUD gear popover and the full configuration page.
     */
    function renderSettingsPanes({
      activeTab,
      config,
      save,
      previewSound,
      previewComboHud,
      setDemoTool,
      textPrimary,
      textSecondary,
      control,
    }) {
      const { range, toggle, color, select, list } = control

      const card = (title, ...children) => h('div', {
        className: 'dsh-combo-card',
        key: title,
      },
        h('div', { className: 'dsh-combo-card-title' }, title),
        children)

      const tabPane = (id, title, subtitle, ...cards) => h('div', {
        key: id,
        className: 'dsh-combo-tab-pane',
        style: { display: (activeTab === id || activeTab === 'all') ? 'block' : 'none' },
      },
        h('h2', { style: { fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: textPrimary, letterSpacing: '-0.02em' } }, title),
        h('p', { style: { fontSize: '11px', color: textSecondary, margin: '0 0 14px' } }, subtitle),
        cards)

      const hiddenSelect = (key, options) => h('select', {
        key: `hidden-select-${key}`,
        tabIndex: -1,
        'data-dsh-combo-setting': key,
        value: config[key],
        onChange: (e) => save(key, e.target.value),
        style: { position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, margin: 0 },
        'aria-hidden': 'true',
      }, Object.entries(options).map(([value, text]) => h('option', { key: value, value }, text)))

      return [
        // Tab 1: basic 基础设置
        tabPane('basic', '基础设置', '设置连击判定模式、倒计时进度条与触发节奏',
          card('连击行为与判定模式',
            toggle('enabled', '显示连击 HUD', '大模型输出或调用工具时呈现悬浮计数窗'),
            h('div', { key: 'mode-grid', style: { margin: '8px 0 6px' } },
              h('span', { style: { display: 'block', fontSize: '12px', fontWeight: 500, color: textSecondary, marginBottom: '6px' } }, '连击判定模式:'),
              h('div', { className: 'dsh-combo-preset-grid' },
                MODE_CARDS.map(m => {
                  const active = (config.comboMode || 'hybrid') === m.id
                  return h('div', {
                    key: m.id,
                    className: `dsh-combo-preset-item ${active ? 'active' : ''}`,
                    onClick: () => save('comboMode', m.id),
                  },
                    h('span', { style: { fontSize: '18px', marginBottom: '2px' } }, m.icon),
                    h('strong', { style: { fontSize: '12px', color: active ? 'var(--dsw-alias-brand-primary, #38bdf8)' : textPrimary } }, m.name),
                    h('span', { style: { fontSize: '10px', color: textSecondary, marginTop: '2px' } }, m.desc))
                }))),
            hiddenSelect('comboMode', COMBO_MODES),
            range('tokensPerCombo', 'Token 连击比率', 1, 50, 1, ' Token/次', '流式打字输出时每多少个 Token 计为一次连击')),
          card('倒计时条管理',
            toggle('showTimer', '显示倒计时进度条', '在悬浮窗顶部展示本轮连击有效期的收缩条'),
            range('timerMs', '倒计时条时长', 1000, 60000, 1000, ' ms', '单次连击完成后倒计时条耗尽的时长'),
            range('barHeight', '进度条粗细高度', 2, 16, 1, ' px', '连击倒计时进度条的高度粗细')),
          card('触发与节奏规则',
            range('powerThreshold', '特效触发门槛', 0, 100, 1, ' 次', '连击达到多少次后才开始迸发粒子或特效'),
            range('effectFrequency', '特效触发频率', 1, 20, 1, ' 次/回', '每隔多少次连击触发一次特效冲击'),
            range('expireMs', '空闲重置时间', 0, 600000, 1000, ' ms', '闲置超过该时长自动重置连击，倒计时条同步倒数归零；设为 0 为无限模式（永不清零）'),
            range('pinPromptMs', '保留连击提示时长', 0, 60000, 500, ' ms', '一轮对话结束后，提供「固定连击」的悬浮倒计时'))),

        // Tab 2: effects 特效设置
        tabPane('effects', '特效设置', '支持多种连击特效与物理微动震颤，实时动态预览',
          card('连击视觉特效预设',
            toggle('particles', '启用粒子特效', '连击达到门槛时向四周喷射动态粒子'),
            h('div', { key: 'fx-grid', style: { margin: '10px 0 8px' } },
              h('span', { style: { display: 'block', fontSize: '12px', fontWeight: 500, color: textSecondary, marginBottom: '8px' } }, '选择特效视觉主题 (点击即时生效):'),
              h('div', { className: 'dsh-combo-preset-grid' },
                PRESET_CARDS.map(p => {
                  const active = config.preset === p.id
                  return h('div', {
                    key: p.id,
                    className: `dsh-combo-preset-item ${active ? 'active' : ''}`,
                    onClick: () => {
                      save('preset', p.id)
                      if (setDemoTool) setDemoTool(p.name)
                    },
                  },
                    h('div', {
                      style: {
                        width: '100%',
                        height: '42px',
                        borderRadius: '8px',
                        background: 'var(--dsw-alias-bg-layer-2, rgba(125, 125, 125, 0.12))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '6px',
                        boxShadow: active ? '0 0 12px var(--dsw-alias-brand-primary, #38bdf8)' : 'none',
                      },
                    },
                      h('span', { style: { fontSize: '22px' } }, p.icon)),
                    h('strong', { style: { fontSize: '12px', color: active ? 'var(--dsw-alias-brand-primary, #38bdf8)' : textPrimary } }, p.name),
                    h('span', { style: { fontSize: '10px', color: textSecondary, marginTop: '2px' } }, p.desc))
                }))),
            hiddenSelect('preset', PRESETS),
            range('particleCount', '粒子数量', 0, 80, 1, '', '设为 0 时根据连击段位自动增多'),
            range('particleSize', '粒子大小', 1, 12, .5, ' px', '粒子碎片的基准尺寸'),
            range('particleSpread', '扩散范围', .25, 2, .05, '×', '粒子从中心迸发向外的辐射半径比例'),
            range('effectDurationMs', '特效时长', 200, 2500, 50, ' ms', '单次粒子与特效从爆发到消散的总毫秒数')),
          card('连击物理微动与动效',
            toggle('shake', '连击物理抖动', '数字命中时的微动物理打击震颤'),
            range('shakeIntensity', '抖动强度', 0, 12, .5, ' px', '连击命中时画面的微动振幅'),
            select('animation', '反馈动画强度', { off: '关闭', normal: '普通', strong: '强烈' }, '控制数字命中时的缩放与倾斜力度'))),

        // Tab 3: appearance 外观风格
        tabPane('appearance', '外观风格', '自定义计数器尺寸、高阶色彩蜕变与调色板主题',
          card('调色板主题风格',
            h('div', { key: 'color-theme-grid', style: { margin: '8px 0 8px' } },
              h('span', { style: { display: 'block', fontSize: '12px', fontWeight: 500, color: textSecondary, marginBottom: '8px' } }, '选择动态色彩调色板:'),
              h('div', { className: 'dsh-combo-preset-grid' },
                Object.entries(COLOR_THEMES).map(([themeId, themeMeta]) => {
                  const active = (config.colorTheme || 'classic') === themeId
                  return h('div', {
                    key: themeId,
                    className: `dsh-combo-preset-item ${active ? 'active' : ''}`,
                    onClick: () => save('colorTheme', themeId),
                  },
                    h('div', { style: { display: 'flex', gap: '3px', marginBottom: '6px' } },
                      themeMeta.stops.slice(0, 4).map((s, idx) => h('span', {
                        key: idx,
                        style: { width: '8px', height: '8px', borderRadius: '50%', background: s.color },
                      }))),
                    h('strong', { style: { fontSize: '12px', color: active ? 'var(--dsw-alias-brand-primary, #38bdf8)' : textPrimary } }, `${themeMeta.icon} ${themeMeta.name}`),
                    h('span', { style: { fontSize: '10px', color: textSecondary, marginTop: '2px' } }, `${themeMeta.stops.length} 阶动态光晕`))
                }))),
            hiddenSelect('colorTheme', { classic: '经典能量', cyberpunk: '赛博霓虹', sunset: '暮光烈阳', matrix: '极客矩阵', frost: '冰川极光' })),
          card('尺寸比例与发光',
            range('scale', '计数器大小', .5, 2, .05, '×', '调整屏幕连击悬浮窗的整体缩放比例'),
            range('glow', '光晕强度', 0, 2, .1, '', '连击数字与特效周围的发光光晕')),
          card('个性化色彩定制',
            color('accentColor', '特效自定义颜色', '#9be779', '自定义特效与进度条色彩，留空为连击数自适应'),
            color('numberColor', '数字自定义颜色', '#f5fff0', '自定义连击数字主色，留空为自动'))),

        // Tab 4: sound 音效设置
        tabPane('sound', '音效设置', '配置连击时的打击音频与多风格主题音色',
          card('打击音频与音色主题',
            toggle('sound', '启用连击打击音效', '利用 Web Audio 合成多风格打击音效，零音频文件依赖'),
            h('div', { key: 'sound-grid', style: { margin: '10px 0 8px' } },
              h('span', { style: { display: 'block', fontSize: '12px', fontWeight: 500, color: textSecondary, marginBottom: '8px' } }, '音效主题风格 (点击试听):'),
              h('div', { className: 'dsh-combo-preset-grid' },
                SOUND_CARDS.map(s => {
                  const active = (config.soundTheme || 'blip') === s.id
                  return h('div', {
                    key: s.id,
                    className: `dsh-combo-preset-item ${active ? 'active' : ''}`,
                    onClick: () => {
                      save('soundTheme', s.id)
                      if (previewSound) previewSound(s.id)
                    },
                  },
                    h('span', { style: { fontSize: '20px', marginBottom: '4px' } }, s.icon),
                    h('strong', { style: { fontSize: '12px', color: active ? 'var(--dsw-alias-brand-primary, #38bdf8)' : textPrimary } }, s.name),
                    h('span', { style: { fontSize: '10px', color: textSecondary, marginTop: '2px' } }, s.desc))
                }))),
            hiddenSelect('soundTheme', SOUND_THEMES),
            h('div', {
              key: 'audition-card',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                margin: '8px 0',
                padding: '10px 14px',
                background: 'var(--dsh-c-item-bg, rgba(125, 125, 125, 0.04))',
                borderRadius: '10px',
                border: '1px solid var(--dsh-c-item-border, rgba(125, 125, 125, 0.1))',
              },
            },
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 } },
                h('span', { style: { fontSize: '13px', fontWeight: 500, color: textPrimary } }, '试听当前音效'),
                h('span', { style: { fontSize: '11px', color: textSecondary } },
                  config.sound ? `连击达到 ${config.soundFrom} 次后每次连击播放音效。` : '音效当前关闭；点「试听」可先测试音量与音色。')),
              h('button', {
                type: 'button',
                'data-dsh-combo-setting': 'soundPreview',
                onClick: () => previewSound && previewSound(),
                style: {
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: '1px solid var(--dsw-alias-border-l1, rgba(125,125,125,0.25))',
                  background: 'var(--dsw-alias-bg-layer-2, rgba(125, 125, 125, 0.15))',
                  color: textPrimary,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 160ms ease',
                },
              }, '🔔 试听打击音效'))),
          card('音量与触发门槛',
            range('soundVolume', '打击音量', 0, 1, .05, '', '音效输出响度'),
            range('soundFrom', '起播连击数门槛', 0, 100, 1, ' 次', '达到指定连击数后才触发音效，避免单次零散发声'))),

        // Tab 5: display 显示与界面
        tabPane('display', '显示与界面', '设置悬浮窗在屏幕上的方位角与展示元素',
          card('屏幕停靠方位',
            h('div', { key: 'pos-grid', style: { marginBottom: '8px' } },
              h('span', { style: { display: 'block', fontSize: '12px', fontWeight: 500, color: textSecondary, marginBottom: '8px' } }, '屏幕停靠角落方位:'),
              h('div', { className: 'dsh-combo-pos-grid' },
                POS_OPTIONS.map(pos => {
                  const active = config.position === pos.id
                  return h('button', {
                    key: pos.id,
                    type: 'button',
                    className: `dsh-combo-pos-btn ${active ? 'active' : ''}`,
                    onClick: () => save('position', pos.id),
                  }, pos.name)
                }))),
            hiddenSelect('position', { 'top-right': '右上角', 'top-left': '左上角', 'bottom-right': '右下角', 'bottom-left': '左下角' }),
            range('offsetX', '水平边距', 0, 240, 2, ' px', '离屏幕边缘的水平像素距离'),
            range('offsetY', '垂直边距', 0, 240, 2, ' px', '离屏幕边缘的垂直像素距离')),
          card('界面元素显示',
            toggle('showGain', '显示增量提示 (+N)', '显示如 +1、+3 等单次跃升的浮动数字'),
            toggle('showToolName', '显示思考 / 输出 / 工具名', '显示「思考」、「输出」或调用的具体工具名字')),
          card('沉浸扩展增强 (默认关闭)',
            toggle('showCrit', '暴击角标提示 (CRIT!)', '高吞吐批量跃升时在增量前标记 CRIT!'),
            toggle('showMilestones', '连击里程碑成就浮现', '达到 10/20/50 等心流阈值时短暂浮现里程碑称号'),
            toggle('recapCard', '回合结束战报卡片 (Turn Recap)', '每轮 Agent 思考执行完成后显示段位评价与战报'),
            toggle('screenVignette', '高连击全屏边缘光晕 (Screen Vignette)', '开启后屏幕四周环绕柔和环境呼吸发光'))),

        // Tab 6: advanced 高级选项
        tabPane('advanced', '高级选项', '配置工具调用黑名单与自动化过滤规则',
          card('工具过滤名单',
            list('excludeTools', '不计入连击的工具列表', 'bash, edit, read', '用逗号或空格分隔工具名，这些工具调用时不累加连击'))),

        // Tab 7: about 关于插件
        tabPane('about', '关于插件', 'DeepSeek Harness 沉浸式连击反馈系统',
          card('插件信息',
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' } },
              h('span', { style: { fontSize: '32px' } }, '🔥'),
              h('div', null,
                h('strong', { style: { fontSize: '15px', color: textPrimary, display: 'block' } }, 'dsh-combo 动态连击系统'),
                h('span', { style: { fontSize: '12px', color: textSecondary } }, '当前安装版本: v0.6.0 · 纯本地前端与 Host 投影架构'))),
            h('p', { style: { fontSize: '13px', lineHeight: 1.6, color: textSecondary, margin: '8px 0' } },
              '为 DeepSeek Harness 提供类似 PowerMode 的高拟真连击反馈体验。支持大模型实时流式 Token 暴击、工具调用连击、6 种纯 Web Audio 打击音效、4 大主题粒子迸发与跨轮 Pin 保持。'),
            h('div', { style: { marginTop: '16px', display: 'flex', gap: '10px' } },
              h('button', {
                type: 'button',
                onClick: previewComboHud,
                style: {
                  padding: '7px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--dsw-alias-brand-primary, #38bdf8)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(56, 189, 248, 0.3)',
                },
              }, '🚀 启动屏幕 HUD 体验')))),
      ]
    }

    function ensureConfigStyles() {
      if (typeof document !== 'undefined' && document.head && !document.getElementById('dsh-combo-config-css')) {
        const el = document.createElement('style')
        el.id = 'dsh-combo-config-css'
        el.textContent = CONFIG_PAGE_CSS
        document.head.appendChild(el)
      }
    }

const POP_TABS = [
      { id: 'basic', label: '连击', icon: '⚡' },
      { id: 'effects', label: '特效', icon: '✨' },
      { id: 'appearance', label: '外观', icon: '🎨' },
      { id: 'sound', label: '音效', icon: '🔊' },
      { id: 'display', label: '界面', icon: '👁️' },
      { id: 'advanced', label: '高级', icon: '🎛️' },
      { id: 'all', label: '全部', icon: '📋' },
    ]

    const compactControls = (config, write) => controlKit(config, write, { compact: true })

    function AppearanceSettings({ config, customize, onReset, onPreview, onPreviewSound, right, top }) {
      const [activeTab, setActiveTab] = useState('basic')
      const [demoCombo, setDemoCombo] = useState(24)
      const [demoTool, setDemoTool] = useState('思考')

      useEffect(() => {
        ensureConfigStyles()
      }, [])

      const textPrimary = 'var(--dsh-c-text-primary, var(--dsw-alias-label-primary, var(--dsw-alias-text-primary, #0f172a)))'
      const textSecondary = 'var(--dsh-c-text-secondary, var(--dsw-alias-label-secondary, var(--dsw-alias-text-secondary, #64748b)))'
      const accent = 'var(--dsh-c-accent, var(--dsw-alias-brand-primary, var(--dsh-combo-control-accent, #10b981)))'

      const save = (key, raw) => {
        const value = key === 'excludeTools' ? splitTools(raw) : raw
        customize(key, value)
      }

      const c = controlKit(config, save, { compact: true })
      const previewSound = (overrideTheme) => {
        const at = Math.max(Math.round(config.soundFrom), 1)
        playBlip(at, tierOf(at).id, config.soundVolume, true, overrideTheme || config.soundTheme || 'blip')
      }
      const previewComboHud = () => {
        triggerGlobalPreview({ combo: 24, tool: demoTool || '思考' })
        if (config.sound) previewSound()
        if (onPreview) onPreview()
      }

      const pane = (id, ...children) => h('div', {
        key: id,
        className: 'dsh-combo-tab-pane',
        style: { display: (activeTab === id || activeTab === 'all') ? 'block' : 'none' },
      }, children)

      return h('details', { 'data-dsh-combo-settings': '', style: { position: 'static', pointerEvents: 'auto' } },
        h('summary', {
          'aria-label': '自定义连击外观',
          title: '自定义连击外观',
          style: {
            listStyle: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            fontSize: '13px',
            opacity: .85,
            color: textSecondary,
            background: 'var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.08))',
            border: '1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.15))',
            backdropFilter: 'blur(8px)',
            transition: 'all 160ms cubic-bezier(0.16, 1, 0.3, 1)',
          },
        }, '\u2699'),
        h('div', {
          'data-dsh-combo-settings-panel': '',
          style: {
            position: 'absolute',
            zIndex: 30,
            top: top ? 'calc(100% + 8px)' : 'auto',
            bottom: top ? 'auto' : 'calc(100% + 8px)',
            right: right ? 0 : 'auto',
            left: right ? 'auto' : 0,
            width: 'min(330px, calc(100vw - 28px))',
            maxHeight: `min(540px, max(140px, calc(100dvh - var(--dsh-frame-top-clearance, 48px) - ${config.offsetY + 120 * config.scale + 32}px)))`,
            overflowY: 'auto',
            padding: '12px 14px',
            borderRadius: '16px',
            border: '1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.25))',
            background: 'var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base, #1e293b)))',
            color: textPrimary,
            boxShadow: '0 16px 40px -4px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08))',
            backdropFilter: 'blur(20px)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: '11px',
            fontWeight: 400,
            lineHeight: 1.4,
            boxSizing: 'border-box',
          },
        },
          // Header
          h('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: '8px',
              borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.15))',
              marginBottom: '10px',
            },
          },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              h('span', { style: { fontSize: '15px' } }, '🔥'),
              h('strong', { style: { fontSize: '12px', fontWeight: 600, color: textPrimary } }, '连击快速调参'),
              h('span', { style: { fontSize: '9px', color: textSecondary, background: 'var(--dsw-alias-bg-module-platform, rgba(125,125,125,0.1))', padding: '1px 5px', borderRadius: '4px' } }, 'v0.6.0')),
            h('button', {
              type: 'button',
              onClick: previewComboHud,
              style: {
                padding: '3px 8px',
                fontSize: '10px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                background: 'var(--dsw-alias-brand-primary, #38bdf8)',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
              },
            }, '⚡ 预览')),

          // Quick Preset Bar for 1-click change
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4px',
              padding: '4px',
              marginBottom: '8px',
              background: 'var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2, rgba(125, 125, 125, 0.08)))',
              borderRadius: '8px',
            },
          },
            PRESET_CARDS.map(p => {
              const active = config.preset === p.id
              return h('button', {
                key: `quick-preset-${p.id}`,
                type: 'button',
                title: `${p.name}: ${p.desc}`,
                onClick: () => {
                  save('preset', p.id)
                  if (setDemoTool) setDemoTool(p.name)
                },
                style: {
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 0',
                  fontSize: '11px',
                  borderRadius: '6px',
                  border: active ? '1px solid var(--dsw-alias-brand-primary, #38bdf8)' : '1px solid transparent',
                  background: active ? 'var(--dsw-alias-brand-primary-fade, rgba(56, 189, 248, 0.18))' : 'transparent',
                  color: active ? 'var(--dsw-alias-brand-primary, #38bdf8)' : textSecondary,
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                },
              }, h('span', { style: { fontSize: '13px' } }, p.icon))
            })),

          // Grid Tab bar
          h('div', { className: 'dsh-combo-tab-bar' },
            POP_TABS.map(item => h('button', {
              key: item.id,
              type: 'button',
              className: `dsh-combo-tab-btn ${activeTab === item.id ? 'active' : ''}`,
              onClick: () => setActiveTab(item.id),
            },
              h('span', { style: { fontSize: '13px', lineHeight: 1 } }, item.icon),
              h('span', null, item.label)))),

          // Panes with grouped visual sections
          pane('basic',
            c.group('核心功能',
              c.toggle('enabled', '启用连击 HUD'),
              c.select('comboMode', '连击计算模式', COMBO_MODES)),
            c.group('倒计时与节拍',
              c.toggle('showTimer', '显示倒计时进度条'),
              c.range('timerMs', '倒计时条时长', 1000, 60000, 1000, ' ms'),
              c.range('barHeight', '进度条高度', 2, 16, 1, ' px'),
              c.range('tokensPerCombo', 'Token 连击比率', 1, 50, 1, ' Token'),
              c.range('expireMs', '空闲重置时间', 0, 600000, 1000, ' ms')),
            c.group('触发门槛',
              c.range('powerThreshold', '特效触发门槛', 0, 100, 1, ' 次'),
              c.range('effectFrequency', '特效触发频率', 1, 20, 1, ' 次/回'))),

          pane('effects',
            c.group('特效视觉主题',
              c.toggle('particles', '启用粒子特效'),
              c.select('preset', '特效主题预设', PRESETS, h('button', {
                type: 'button',
                onClick: previewComboHud,
                style: { padding: '2px 6px', fontSize: '10px', borderRadius: '4px', border: 'none', background: 'var(--dsw-alias-brand-primary, #38bdf8)', color: '#fff', cursor: 'pointer' } }, '测试'))),
            c.group('粒子物理表现',
              c.range('particleCount', '粒子数量', 0, 80, 1, ''),
              c.range('particleSize', '粒子碎片尺寸', 1, 12, 0.5, ' px'),
              c.range('particleSpread', '粒子扩散范围', 0.25, 2, 0.05, '×'),
              c.range('effectDurationMs', '特效爆发时长', 200, 2500, 50, ' ms')),
            c.group('命中物理与动效',
              c.toggle('shake', '连击物理抖动'),
              c.range('shakeIntensity', '命中震颤强度', 0, 12, 0.5, ' px'),
              c.select('animation', '反馈动画力度', { off: '关闭', normal: '普通', strong: '强烈' }))),

          pane('appearance',
            c.group('色彩风格',
              c.select('colorTheme', '调色板风格', { classic: '经典能量 (绿/金/橙/紫)', cyberpunk: '赛博霓虹 (青/粉/紫/金)', sunset: '暮光烈阳 (金/橙/红/玫)', matrix: '极客矩阵 (翠绿/薄荷/白)', frost: '冰川极光 (天蓝/青/冰白)' })),
            c.group('悬浮尺寸与发光',
              c.range('scale', '计数悬浮窗缩放', 0.5, 2, 0.05, '×'),
              c.range('glow', '数字光晕发光', 0, 2, 0.1, '')),
            c.group('自定义颜色',
              c.color('accentColor', '特效自定义颜色', '#9be779'),
              c.color('numberColor', '数字自定义颜色', '#f5fff0'))),

          pane('sound',
            c.group('打击音效开关',
              c.toggle('sound', '启用连击打击音效'),
              c.select('soundTheme', '打击音效音色', SOUND_THEMES, h('button', {
                type: 'button',
                'data-dsh-combo-setting': 'soundPreview',
                onClick: () => previewSound(),
                style: { padding: '2px 7px', fontSize: '10px', borderRadius: '4px', border: 'none', background: 'var(--dsw-alias-brand-primary, #38bdf8)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' },
              }, '🔔 试听'))),
            c.group('音量与门槛',
              c.range('soundVolume', '打击音量大小', 0, 1, 0.05, ''),
              c.range('soundFrom', '起播连击门槛', 0, 100, 1, ' 次'))),

          pane('display',
            c.group('停靠角落方位',
              c.select('position', '屏幕停靠角落', { 'top-right': '↗ 右上角', 'top-left': '↖ 左上角', 'bottom-right': '↘ 右下角', 'bottom-left': '↙ 左下角' }),
              c.range('offsetX', '水平边缘间距', 0, 240, 2, ' px'),
              c.range('offsetY', '垂直边缘间距', 0, 240, 2, ' px')),
            c.group('界面要素展示',
              c.toggle('showGain', '显示连击增量 (+N)'),
              c.toggle('showToolName', '显示思考/输出/工具名')),
            c.group('沉浸扩展增强 (可选)',
              c.toggle('showCrit', '暴击角标提示 (CRIT!)'),
              c.toggle('showMilestones', '连击里程碑成就浮现'),
              c.toggle('recapCard', '回合结束战报卡片'),
              c.toggle('screenVignette', '高连击全屏边缘光晕'))),

          pane('advanced',
            c.group('过滤与固定规则',
              c.list('excludeTools', '不计入连击的工具名单', 'bash, edit, read'),
              c.range('pinPromptMs', '固定连击提示倒计时', 0, 60000, 500, ' ms'))),

          // Footer
          h('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.15))',
              flexWrap: 'wrap',
            },
          },
            h('button', {
              type: 'button',
              onClick: () => {
                onReset()
                setDemoCombo(24)
              },
              style: {
                padding: '4px 8px',
                fontSize: '10px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px dashed var(--dsw-alias-border-l2, rgba(125, 125, 125, 0.3))',
                background: 'transparent',
                color: textPrimary,
                cursor: 'pointer',
              },
            }, '恢复默认设置'),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
              h('button', {
                type: 'button',
                onClick: () => {
                  setDemoCombo(c => c + 1)
                  if (config.sound) previewSound()
                },
                style: {
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  borderRadius: '6px',
                  border: '1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.2))',
                  background: 'var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2, rgba(125, 125, 125, 0.08)))',
                  color: textPrimary,
                  cursor: 'pointer',
                },
              }, `⚡ 试玩 (${demoCombo}×)`),
              h('button', {
                type: 'button',
                'data-dsh-combo-setting': 'previewHud',
                onClick: previewComboHud,
                style: {
                  padding: '4px 10px',
                  fontSize: '10px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--dsw-alias-brand-primary, #38bdf8)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                },
              }, '🚀 预览 HUD'))),
        ),
      )
    }

    /** Multi-theme particle burst supporting fundamentally distinct visual presets. */
    function ParticleBurst({ tier, preset, config, id, top, right }) {
      const effect = (preset === 'flames' || preset === 'aurora') ? 'aura'
        : (preset === 'rift' || preset === 'electric') ? 'slash'
        : (preset === 'cyber') ? 'glitch'
        : (preset === 'supernova') ? 'ripple'
        : preset

      const count = config.particleCount > 0
        ? Math.round(config.particleCount)
        : tier.id === 'blaze' ? 20 : tier.id === 'hot' ? 17 : tier.id === 'warm' ? 13 : 10
      const reach = config.particleSpread * (tier.id === 'blaze' ? 112 : tier.id === 'hot' ? 92 : tier.id === 'warm' ? 76 : 60)
      const sparks = []

      for (let index = 0; index < count; index += 1) {
        const seed = (index * 37 + id * 17) % 101
        const rad = seed * 3.6 * Math.PI / 180
        const distance = reach * (0.5 + ((index * 13 + id * 7) % 51) / 100)
        let x = 0
        let y = 0
        let w = config.particleSize * (0.75 + (index % 3) * 0.25)
        let h_px = w
        let radius = '0px'
        let bg = index % 3 === 0 ? '#f5fff0' : index % 3 === 1 ? tier.accent : tier.spark
        let shadow = `0 0 7px ${tier.halo}`
        let anim = 'spark'

        if (effect === 'fireworks') {
          x = Math.cos(rad) * distance * (right ? 1 : -1)
          y = Math.sin(rad) * distance * (top ? 1 : -1)
          radius = '50%'
          anim = 'fireworks'
        } else if (effect === 'slash') {
          const slashAngle = (-32 + (seed - 50) * 0.4) * Math.PI / 180
          x = Math.cos(slashAngle) * distance * 1.25 * (right ? 1 : -1)
          y = Math.sin(slashAngle) * distance * 1.25
          w = Math.max(2, config.particleSize * 0.5)
          h_px = config.particleSize * 3.5
          radius = '1px'
          bg = index % 3 === 0 ? '#ffffff' : tier.accent
          shadow = `0 0 10px #ffffff, 0 0 16px ${tier.accent}`
          anim = 'rift'
        } else if (effect === 'aura') {
          x = (seed - 50) * 0.75
          y = -distance * 1.3
          w = config.particleSize * (0.8 + (index % 3) * 0.3)
          h_px = w * 2.8
          radius = '50% 50% 20% 20%'
          bg = index % 3 === 0 ? '#ffffff' : tier.accent
          shadow = `0 0 12px ${tier.halo}`
          anim = 'flames'
        } else if (effect === 'glitch') {
          x = ((seed % 10) - 5) * 14 * (right ? 1 : -1)
          y = ((seed % 7) - 3) * 12 * (top ? 1 : -1)
          w = config.particleSize * 2.5
          h_px = Math.max(2, config.particleSize * 0.6)
          radius = '0px'
          bg = index % 3 === 0 ? '#00f0ff' : index % 3 === 1 ? '#ff007f' : tier.accent
          shadow = `0 0 8px ${tier.accent}`
          anim = 'rift'
        } else {
          const angle = (-155 + seed * 1.15) * Math.PI / 180
          x = Math.cos(angle) * distance * (right ? 1 : -1)
          y = Math.sin(angle) * distance * (top ? 1 : -1)
          anim = 'spark'
        }

        sparks.push(h('span', {
          key: index,
          style: {
            position: 'absolute',
            left: '50%',
            top: top ? '16px' : '70%',
            width: `${w.toFixed(1)}px`,
            height: `${h_px.toFixed(1)}px`,
            borderRadius: radius,
            background: bg,
            boxShadow: shadow,
            '--dsh-combo-spin': `${seed * 3.6}deg`,
            '--dsh-combo-x': `${x.toFixed(1)}px`,
            '--dsh-combo-y': `${y.toFixed(1)}px`,
            '--dsh-combo-fall': `${(y + 34).toFixed(1)}px`,
            opacity: 0,
            animation: `dshcombo-${anim}-${id % MOTION_RING} ${config.effectDurationMs}ms ease-out ${(index % 4) * 14}ms both`,
          },
        }))
      }

      return h('div', {
        'data-dsh-combo-burst': '',
        'data-dsh-combo-effect': preset,
        'aria-hidden': 'true',
        style: {
          position: 'absolute',
          inset: 0,
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: 0,
        },
      },
        // 1. Slash: High-speed angled laser blade incision + cross star flash
        (effect === 'slash' || preset === 'rift') && h(React.Fragment, null,
          h('span', {
            style: {
              position: 'absolute', left: '50%', top: '50%', width: '240px', height: '4px',
              marginLeft: '-120px', marginTop: '-2px', borderRadius: '999px',
              background: `linear-gradient(90deg, transparent 0%, #ffffff 40%, ${tier.accent} 65%, transparent 100%)`,
              boxShadow: `0 0 14px #ffffff, 0 0 28px ${tier.accent}`,
              transformOrigin: 'center center',
              animation: `dshcombo-slash-beam ${config.effectDurationMs}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
            },
          }),
          h('span', {
            style: {
              position: 'absolute', left: '50%', top: '50%', width: '56px', height: '56px',
              marginLeft: '-28px', marginTop: '-28px', borderRadius: '50%',
              background: `radial-gradient(circle, #ffffff 15%, ${tier.accent} 55%, transparent 75%)`,
              boxShadow: `0 0 24px ${tier.accent}`,
              animation: `dshcombo-cross-flash ${config.effectDurationMs}ms ease-out both`,
            },
          }),
        ),

        // 2. Aura: Expanding billowing plasma energy core
        (effect === 'aura' || preset === 'flames') && h('span', {
          style: {
            position: 'absolute', left: '50%', top: '50%', width: '160px', height: '110px',
            marginLeft: '-80px', marginTop: '-55px', borderRadius: '50% 50% 30% 30%',
            background: `radial-gradient(ellipse at 50% 75%, ${tier.accent} 0%, ${tier.halo} 60%, transparent 85%)`,
            filter: 'blur(10px)',
            animation: `dshcombo-aura-pulse ${config.effectDurationMs}ms ease-out both`,
          },
        }),

        // 3. Glitch: RGB chromatic shift shadows + scanline tears
        effect === 'glitch' && h(React.Fragment, null,
          h('span', {
            style: {
              position: 'absolute', left: '-10%', top: '30%', width: '120%', height: '3px',
              background: '#00f0ff', boxShadow: '0 0 10px #00f0ff',
              animation: `dshcombo-glitch-slice ${config.effectDurationMs}ms steps(4) both`,
            },
          }),
          h('span', {
            style: {
              position: 'absolute', left: '-5%', top: '65%', width: '110%', height: '2px',
              background: '#ff007f', boxShadow: '0 0 8px #ff007f',
              animation: `dshcombo-glitch-slice ${config.effectDurationMs}ms steps(3) 30ms both`,
            },
          }),
        ),

        sparks)
    }

    /**
     * Interactive HUD mini simulator embedded in the configuration page.
     * Reacts in real time to color, scale, glow, barHeight, preset, and sound changes.
     */
    function ComboMiniSimulator({
      config,
      demoCombo,
      demoTool,
      setDemoCombo,
      setDemoTool,
      previewSound,
      previewComboHud,
    }) {
      const [burstId, setBurstId] = useState(0)
      const tier = tierOf(demoCombo, config.colorTheme)
      if (config.accentColor) {
        tier.accent = config.accentColor
        tier.spark = config.accentColor
        const rgb = [1, 3, 5].map(at => parseInt(config.accentColor.slice(at, at + 2), 16)).join(',')
        tier.halo = `rgba(${rgb},.45)`
      }
      if (config.glow === 0) tier.halo = 'transparent'

      const handleIncrement = () => {
        setDemoCombo(c => c + 1)
        setBurstId(id => id + 1)
        if (config.sound) {
          previewSound()
        }
      }

      const numColor = config.numberColor || tier.accent
      const preset = config.preset || 'particles'

      return h('div', {
        className: 'dsh-combo-simulator',
        style: {
          '--sim-halo': tier.halo,
        },
      },
        // Top bar
        h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          },
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            h('span', { style: { fontSize: '14px' } }, '✨'),
            h('span', { style: { fontSize: '11px', fontWeight: 600, color: '#f8fafc', letterSpacing: '-0.01em' } }, '连击效果实时模拟器 (Live Simulator)'),
            h('span', {
              style: {
                fontSize: '9px',
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.08)',
                color: '#94a3b8',
                fontVariantNumeric: 'tabular-nums',
              },
            }, `${tier.id.toUpperCase()} 段位`)),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
            h('span', { style: { fontSize: '10px', color: '#94a3b8' } }, '测试状态:'),
            ['思考', 'bash', 'edit', '输出'].map(tool => h('button', {
              key: tool,
              type: 'button',
              onClick: () => setDemoTool(tool),
              style: {
                padding: '2px 6px',
                fontSize: '10px',
                borderRadius: '4px',
                border: demoTool === tool ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
                background: demoTool === tool ? 'rgba(255,255,255,0.14)' : 'transparent',
                color: demoTool === tool ? '#ffffff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 140ms ease',
              },
            }, tool)))),

        // Main Center Stage
        h('div', {
          style: {
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '74px',
            padding: '6px 0',
          },
        },
          config.particles && burstId > 0 && h(ParticleBurst, {
            key: `sim-burst-${burstId}`,
            tier,
            preset,
            config,
            id: burstId,
            top: true,
            right: true,
          }),
          h('div', {
            key: `sim-badge-${burstId}`,
            style: {
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `scale(${Math.min(1.25, Math.max(0.65, config.scale * 0.85))})`,
              transition: 'transform 180ms ease',
            },
          },
            config.showTimer && h('div', {
              style: {
                width: '100%',
                height: `${config.barHeight}px`,
                background: numColor,
                borderRadius: '999px',
                boxShadow: `0 0 ${12 * config.glow}px ${tier.halo}`,
                marginBottom: '4px',
                transition: 'height 160ms ease',
              },
            }),
            h('div', {
              style: {
                display: 'flex',
                alignItems: 'baseline',
                gap: '2px',
                color: numColor,
                fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
                fontStyle: 'italic',
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: '-0.06em',
                textShadow: `0 2px 4px rgba(0,0,0,0.5), 0 0 ${16 * config.glow}px ${tier.halo}`,
                animation: burstId > 0 ? 'dshcombo-pop-0 280ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
              },
            },
              h('span', { style: { fontSize: '48px', fontVariantNumeric: 'tabular-nums' } }, String(demoCombo)),
              h('span', { style: { fontSize: '32px' } }, '×')),
            config.showToolName && h('span', {
              style: {
                fontSize: '11px',
                fontFamily: 'ui-monospace, monospace',
                color: 'rgba(255, 255, 255, 0.75)',
                marginTop: '2px',
              },
            }, demoTool))),

        // Bottom toolbar
        h('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            flexWrap: 'wrap',
            gap: '6px',
          },
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            h('button', {
              type: 'button',
              onClick: handleIncrement,
              style: {
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                background: 'var(--dsw-alias-brand-primary, #10b981)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                transition: 'all 140ms ease',
              },
            }, '⚡ 模拟敲击 (+1)'),
            h('button', {
              type: 'button',
              onClick: () => setDemoCombo(1),
              style: {
                padding: '5px 8px',
                fontSize: '11px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                cursor: 'pointer',
              },
            }, '重置为 1×')),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            h('button', {
              type: 'button',
              onClick: previewComboHud,
              style: {
                padding: '5px 10px',
                fontSize: '11px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              },
            }, '🚀 呼出屏幕 HUD 预览'))),
      )
    }

    function ComboSettingsPage(props) {
      const form = props.form
      const snapshot = useSyncExternalStore(
        (listener) => form.subscribe(listener),
        () => form.getSnapshot(),
      )
      const [busy, setBusy] = useState(false)
      const [notice, setNotice] = useState(null)
      const [activeTab, setActiveTab] = useState('basic')
      const [demoCombo, setDemoCombo] = useState(24)
      const [demoTool, setDemoTool] = useState('思考')

      const textPrimary = 'var(--dsh-c-text-primary, var(--dsw-alias-label-primary, var(--dsw-alias-text-primary, #0f172a)))'
      const textSecondary = 'var(--dsh-c-text-secondary, var(--dsw-alias-label-secondary, var(--dsw-alias-text-secondary, #64748b)))'

      if (props?.view === 'summary') {
        return h('div', {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            borderRadius: '8px',
            background: 'var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-1, rgba(125,125,125,0.06)))',
            fontSize: '12px',
            color: textSecondary,
          },
        },
          h('span', { style: { fontSize: '14px' } }, '🔥'),
          h('strong', { style: { color: textPrimary, fontWeight: 600 } }, 'dsh-combo'),
          h('span', null, '· 连击 HUD 与打击音效系统已就绪'))
      }

      const save = (key, raw) => {
        const value = key === 'excludeTools' ? splitTools(raw) : raw
        const revision = snapshot.revision
        setBusy(true)
        setNotice(null)
        Promise.resolve(form.mutate([{ op: 'set', path: [key], value }], revision))
          .then((accepted) => {
            if (!accepted) {
              const moved = form.getSnapshot().revision !== revision
              setNotice({
                kind: 'error',
                text: moved ? '配置已在别处修改，已重新载入当前值，请再试一次。' : '本部署没有接受这个取值。',
              })
              return
            }
            clearAppearanceKeys([key])
            refreshConfig()
            setNotice({ kind: 'ok', text: '已保存到 profile 配置，立即生效。' })
          })
          .catch((error) => setNotice({ kind: 'error', text: String(error?.message ?? error) }))
          .finally(() => setBusy(false))
      }

      if (snapshot.status !== 'ready') {
        return h('p', { role: 'status', style: { margin: 0, opacity: .75 } },
          snapshot.status === 'unavailable' ? 'dsh-combo 当前未加载，暂时无法配置。' : '正在读取配置…')
      }
      if (snapshot.writable === false) {
        return h('p', { role: 'status', style: { margin: 0, opacity: .75 } }, '当前部署不允许写入配置。')
      }

      const config = pageConfig(snapshot.value)
      const control = controlKit(config, save)
      const previewSound = (overrideTheme) => {
        const at = Math.max(Math.round(config.soundFrom), 1)
        playBlip(at, tierOf(at).id, config.soundVolume, true, overrideTheme || config.soundTheme || 'blip')
      }
      const previewComboHud = () => {
        triggerGlobalPreview({ combo: 24, tool: demoTool || '思考' })
        if (config.sound) {
          previewSound()
        }
      }

      const resetAll = () => {
        const ops = Object.entries(CONFIG_DEFAULTS).map(([k, v]) => ({ op: 'set', path: [k], value: v }))
        setBusy(true)
        Promise.resolve(form.mutate(ops, snapshot.revision))
          .then(() => {
            localStorage.removeItem(CUSTOM_STORAGE_KEY)
            refreshConfig()
            setNotice({ kind: 'ok', text: '已恢复默认配置。' })
          })
          .catch(e => setNotice({ kind: 'error', text: String(e?.message ?? e) }))
          .finally(() => setBusy(false))
      }

      return h('div', {
        className: 'dsh-combo-window',
        'data-dsh-combo-config': '',
        'aria-busy': busy ? 'true' : 'false',
        style: { opacity: busy ? 0.75 : 1, transition: 'opacity 160ms ease' },
      },
        h('style', { key: 'config-styles' }, CONFIG_PAGE_CSS),
        // 1. Title bar
        h('div', { className: 'dsh-combo-titlebar' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            h('span', { style: { fontSize: '16px' } }, '🔥'),
            h('strong', { style: { fontSize: '13px', fontWeight: 600, color: textPrimary } }, 'dsh-combo 设置'),
            h('span', { style: { fontSize: '10px', color: textSecondary, background: 'var(--dsw-alias-bg-module-platform, rgba(125,125,125,0.1))', padding: '1px 6px', borderRadius: '4px' } }, 'v0.6.0')),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
              h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--dsw-alias-state-success-primary, #10b981)' } }),
              h('span', { style: { fontSize: '11px', color: textSecondary } }, '即时生效')),
            h('button', {
              type: 'button',
              onClick: previewComboHud,
              style: {
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 500,
                borderRadius: '6px',
                border: '1px solid var(--dsw-alias-border-l1, rgba(125,125,125,0.2))',
                background: 'var(--dsw-alias-bg-layer-2, rgba(125,125,125,0.1))',
                color: textPrimary,
                cursor: 'pointer',
                transition: 'all 140ms ease',
              },
            }, '⚡ 屏幕 HUD 预览'))),

        // 2. Body: Left Sidebar + Right Content
        h('div', { className: 'dsh-combo-body' },
          // Left Sidebar
          h('div', { className: 'dsh-combo-sidebar' },
            SIDEBAR_ITEMS.map(item => h('button', {
              key: item.id,
              type: 'button',
              className: `dsh-combo-nav-item ${activeTab === item.id ? 'active' : ''}`,
              onClick: () => setActiveTab(item.id),
            },
              h('span', { style: { fontSize: '15px', lineHeight: 1 } }, item.icon),
              h('span', null, item.label)))),

          // Right Content Area
          h('div', { className: 'dsh-combo-content' },
            h(ComboMiniSimulator, {
              config,
              demoCombo,
              demoTool,
              setDemoCombo,
              setDemoTool,
              previewSound,
              previewComboHud,
            }),
            renderSettingsPanes({
              activeTab,
              config,
              save,
              previewSound,
              previewComboHud,
              setDemoTool,
              textPrimary,
              textSecondary,
              control,
            }))),

        // 3. Footer Bar
        h('div', { className: 'dsh-combo-footer' },
          h('div', { style: { flex: 1, minWidth: '180px' } },
            notice === null ? null : h('div', {
              role: 'status',
              'data-dsh-combo-notice': notice.kind,
              style: {
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: notice.kind === 'ok' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${notice.kind === 'ok' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: notice.kind === 'ok' ? '#10b981' : '#ef4444',
              },
            },
              h('span', null, notice.kind === 'ok' ? '✓' : '⚠️'),
              h('span', null, notice.text))),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            h('button', {
              type: 'button',
              onClick: resetAll,
              style: {
                padding: '7px 12px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '8px',
                border: '1.5px dashed var(--dsw-alias-border-l2, rgba(125, 125, 125, 0.25))',
                background: 'transparent',
                color: textPrimary,
                cursor: 'pointer',
                transition: 'all 140ms ease',
              },
            }, '恢复默认设置'),
            h('button', {
              type: 'button',
              onClick: () => {
                setDemoCombo(c => c + 1)
                if (config.sound) previewSound()
              },
              style: {
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '8px',
                border: '1px solid var(--dsw-alias-border-l1, rgba(125, 125, 125, 0.2))',
                background: 'var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-module-platform, rgba(125, 125, 125, 0.12)))',
                color: textPrimary,
                cursor: 'pointer',
                transition: 'all 140ms ease',
              },
            }, `⚡ 试玩连击 (${demoCombo}×)`),
            h('button', {
              type: 'button',
              'data-dsh-combo-setting': 'previewHud',
              onClick: previewComboHud,
              style: {
                padding: '7px 16px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '8px',
                border: 'none',
                background: 'var(--dsw-alias-brand-primary, #38bdf8)',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                transition: 'all 140ms ease',
              },
            }, '🚀 预览 HUD 连击'))),
      )
    }

    /**
     * Component-local keyframes, rendered as elements so unmounting this plugin
     * removes them with no document-level cleanup. Names cycle through a bounded
     * ring, which keeps this sheet fixed no matter how long a combo runs.
     */
    function ComboStyles() {
      const frames = ['@keyframes dshcombo-countdown{from{transform:scaleX(1)}to{transform:scaleX(0)}}']
      for (let index = 0; index < MOTION_RING; index += 1) {
        frames.push(`@keyframes dshcombo-pop-${index}{0%{transform:scale(var(--dsh-combo-pop-scale,1.2))}42%{transform:scale(.97)}100%{transform:scale(1)}}`)
        frames.push(`@keyframes dshcombo-pop-strong-${index}{0%{transform:scale(1.38) rotate(-3deg)}40%{transform:scale(.94) rotate(1deg)}72%{transform:scale(1.05)}100%{transform:scale(1)}}`)
        frames.push(`@keyframes dshcombo-shake-${index}{0%,100%{translate:0 0}20%{translate:calc(-1 * var(--dsh-combo-shake,3px)) 1px}40%{translate:var(--dsh-combo-shake,3px) -1px}60%{translate:calc(-.66 * var(--dsh-combo-shake,3px)) 0}80%{translate:calc(.33 * var(--dsh-combo-shake,3px)) 0}}`)
        frames.push(`@keyframes dshcombo-float-${index}{0%{transform:translateY(4px);opacity:0}15%{opacity:1}65%{opacity:1}100%{transform:translateY(-14px);opacity:0}}`)
        frames.push(`@keyframes dshcombo-spark-${index}{0%{opacity:0;transform:translate(0,0) scale(.5)}8%{opacity:1}60%{opacity:.85;transform:translate(var(--dsh-combo-x),var(--dsh-combo-y)) scale(1)}100%{opacity:0;transform:translate(var(--dsh-combo-x),var(--dsh-combo-fall)) scale(.3)}}`)
        frames.push(`@keyframes dshcombo-flames-${index}{0%{opacity:0;transform:translate(0,0) scale(.5)}12%{opacity:1}55%{opacity:.9}100%{opacity:0;transform:translate(var(--dsh-combo-x),var(--dsh-combo-y)) scale(.15) rotate(-20deg)}}`)
        frames.push(`@keyframes dshcombo-fireworks-${index}{0%{opacity:1;transform:translate(0,0) scale(.4)}45%{opacity:1;transform:translate(var(--dsh-combo-x),var(--dsh-combo-y)) scale(1)}100%{opacity:0;transform:translate(var(--dsh-combo-x),var(--dsh-combo-fall)) scale(.15)}}`)
        frames.push(`@keyframes dshcombo-rift-${index}{0%{opacity:0;transform:translate(0,0) rotate(0)}15%{opacity:1}100%{opacity:0;transform:translate(var(--dsh-combo-x),var(--dsh-combo-y)) rotate(var(--dsh-combo-spin)) scale(.1)}}`)
        frames.push(`@keyframes dshcombo-portal-${index}{0%{opacity:0;transform:scale(.25) rotate(-20deg)}25%{opacity:.9}100%{opacity:0;transform:scale(1.5) rotate(15deg)}}`)
      }
      frames.push('[data-dsh-combo-preset-select]:focus-visible{outline:2px solid currentColor;outline-offset:2px}')
      frames.push('[data-dsh-combo-preset-select] option{background:var(--dsw-alias-bg-base,#202124);color:var(--dsw-alias-text-primary,#eee)}')
      frames.push('[data-dsh-combo-pin]:hover{opacity:1!important}')
      frames.push('[data-dsh-combo-pin]:focus-visible{opacity:1!important;outline:2px solid currentColor;outline-offset:3px}')
      frames.push('@media(max-width:480px){[data-dsh-combo-badge]{zoom:.8}}')
      frames.push('@media (prefers-reduced-motion:reduce){[data-dsh-combo],[data-dsh-combo] *:not([data-dsh-combo-bar]){animation:none!important;transition:none!important}[data-dsh-combo-burst]{display:none!important}[data-dsh-combo-vignette]{animation:none!important;transition:none!important}}')
      return h('style', { 'data-dsh-combo-style': '' }, frames.join(''))
    }

    function ScreenVignette({ tier, enabled, streak }) {
      if (!enabled || streak < 10) return null
      const baseColor = tier.accent || '#10b981'
      let r = 16, g = 185, b = 129
      if (typeof baseColor === 'string' && baseColor.startsWith('#')) {
        const clean = baseColor.slice(1).trim()
        if (clean.length === 6) {
          const pr = parseInt(clean.slice(0, 2), 16)
          const pg = parseInt(clean.slice(2, 4), 16)
          const pb = parseInt(clean.slice(4, 6), 16)
          if (!Number.isNaN(pr) && !Number.isNaN(pg) && !Number.isNaN(pb)) {
            r = pr; g = pg; b = pb
          }
        } else if (clean.length === 3) {
          const pr = parseInt(clean[0] + clean[0], 16)
          const pg = parseInt(clean[1] + clean[1], 16)
          const pb = parseInt(clean[2] + clean[2], 16)
          if (!Number.isNaN(pr) && !Number.isNaN(pg) && !Number.isNaN(pb)) {
            r = pr; g = pg; b = pb
          }
        }
      }
      const alpha = Math.min(0.22, Math.max(0.08, 0.08 + (streak - 10) * 0.003))
      const innerColor = `rgba(${r}, ${g}, ${b}, 0)`
      const midColor = `rgba(${r}, ${g}, ${b}, ${(alpha * 0.4).toFixed(3)})`
      const edgeColor = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
      const outerBorder = `rgba(${r}, ${g}, ${b}, ${(alpha * 0.65).toFixed(3)})`

      return h('div', {
        'data-dsh-combo-vignette': '',
        'aria-hidden': 'true',
        style: {
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          background: `radial-gradient(ellipse 90% 82% at 50% 50%, ${innerColor} 68%, ${midColor} 88%, ${edgeColor} 100%)`,
          boxShadow: `inset 0 0 140px ${outerBorder}, inset 0 0 40px ${midColor}`,
          animation: 'dshcombo-vignette-pulse 5s ease-in-out infinite',
          transition: 'background 600ms ease, box-shadow 600ms ease, opacity 600ms ease',
        },
      })
    }

    function ComboRoot(props) {
      useEffect(() => {
        ensureConfigStyles()
      }, [])
      const hostConfig = useConfig()
      const [appearance, setAppearance] = useState(readAppearance)
      useEffect(() => {
        const sync = () => setAppearance(readAppearance())
        overrideListeners.add(sync)
        return () => overrideListeners.delete(sync)
      }, [])
      const config = { ...hostConfig, ...appearance }
      const combo = useCombo(props.sessions, props.uiSession, config)
      const tier = tierOf(combo.score || 0, config.colorTheme)
      if (config.accentColor) {
        tier.accent = config.accentColor
        tier.halo = `rgba(${parseInt(config.accentColor.slice(1,3),16)},${parseInt(config.accentColor.slice(3,5),16)},${parseInt(config.accentColor.slice(5,7),16)},.45)`
      }

      return h(React.Fragment, null,
        h(ComboStyles, null),
        config.screenVignette && h(ScreenVignette, { tier, enabled: config.screenVignette, streak: combo.score || 0 }),
        h(ComboHud, { sessions: props.sessions, uiSession: props.uiSession }),
      )
    }

    return {
      name: 'dsh-combo',
      /**
       * Cordis SERVICE names this plugin waits for inside the client runtime —
       * deliberately not package names. `dsh.client.inject` in package.json is
       * the separate package-level ordering declaration; declaring a package
       * here makes the entry wait for a service that never exists, and the boot
       * reports it as pending forever.
       */
      inject: ['slots', 'sessions', 'uiSession'],
      /** Test-only seam; the Harness never calls this. */
      __resetConfigCacheForTests: resetConfigCacheForTests,
      apply(ctx) {
        const sessions = ctx.sessions
        const uiSession = ctx.uiSession
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-combo',
          order: 50,
        }, (props) => h(ComboRoot, { ...props, sessions, uiSession })))

        // The dedicated configuration page. `configForms` is injected softly, so
        // a profile without the settings plugin keeps the HUD and its local
        // quick panel; `whileServed` waits until the Host actually serves this
        // row's namespace, which is what makes a write possible.
        ctx.inject(['configForms'], (settingsCtx) => {
          const form = settingsCtx.configForms.get(SETTINGS_NS)
          globalConfigForm = form
          settingsCtx.effect(() => settingsCtx.configForms.whileServed([SETTINGS_NS], () => settingsCtx.slots.inject(SETTINGS_SLOT, () => settingsCtx.slots.register({
            name: SETTINGS_SLOT,
            key: SETTINGS_NS,
            inject: () => ({ form }),
          }, ComboSettingsPage))))
        })
      },
    }
  },
})
