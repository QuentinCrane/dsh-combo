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
    const PRESETS = { particles: '粒子', flames: '火焰', fireworks: '烟花', rift: '裂隙' }
    /** Keyframe names cycle through this many slots, so the sheet stays bounded. */
    const MOTION_RING = 8
    /** A one-call "combo" is not worth offering to keep. */
    const GHOST_MIN = 2

    const CONFIG_DEFAULTS = {
      enabled: true,
      showToolName: true,
      animation: 'normal',
      particles: true,
      preset: 'particles',
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
      soundVolume: 0.35,
      soundFrom: 10,
      pinPromptMs: 5000,
    }


    // Only known, bounded presentation settings may come from local storage.
    const CUSTOM_RANGES = {"powerThreshold": [0,1000], "effectFrequency": [1,20], "shakeIntensity": [0,12], "timerMs": [1000, 60000], "scale": [0.5, 2], "offsetX": [0, 240], "offsetY": [0, 240], "barHeight": [2, 16], "particleCount": [0, 80], "particleSize": [1, 12], "particleSpread": [0.25, 2], "effectDurationMs": [200, 2500], "glow": [0, 2], "soundVolume": [0, 1], "soundFrom": [0, 1000]}
    function cleanAppearance(raw) {
      const out = {}
      if (!raw || typeof raw !== 'object') return out
      for (const [key, [min, max]] of Object.entries(CUSTOM_RANGES)) {
        if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) out[key] = ['particleCount', 'effectFrequency', 'powerThreshold', 'soundFrom'].includes(key) ? Math.round(Math.max(min, Math.min(max, raw[key]))) : Math.max(min, Math.min(max, raw[key]))
      }
      for (const key of ['accentColor', 'numberColor']) {
        if (raw[key] === '' || (typeof raw[key] === 'string' && /^#[0-9a-f]{6}$/i.test(raw[key]))) out[key] = raw[key]
      }
      for (const key of ['showGain', 'showTimer', 'particles', 'showToolName', 'shake', 'sound']) {
        if (typeof raw[key] === 'boolean') out[key] = raw[key]
      }
      if (['off', 'normal', 'strong'].includes(raw.animation)) out.animation = raw.animation
      if (Object.hasOwn(PLACEMENT, raw.position)) out.position = raw.position
      return out
    }

    // The gear panel's quick tune is per browser, while the Plugins page writes
    // the profile. When the page saves a key it drops that key's local override,
    // so the saved value takes over instead of hiding behind a stale quick tune.
    const overrideListeners = new Set()

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
    // Sound: a short synthesized blip, never an audio asset. Browsers start an
    // AudioContext suspended, so it is created lazily and resumed on the first
    // gesture (the very typing that starts a turn is one).
    // ---------------------------------------------------------------------
    let audioEngine = null
    let gestureHooked = false

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
            context.resume()
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
     * One blip whose pitch rises with the combo. Every failure mode here is
     * silent on purpose: audio is decoration, never a reason to break a render.
     */
    function playBlip(shown, tier, volume) {
      if (!(volume > 0)) return
      try {
        const context = audioContext()
        if (context === null || typeof context.createOscillator !== 'function') return
        if (context.state === 'suspended') {
          unlockOnGesture()
          if (typeof context.resume === 'function') context.resume()
        }
        const now = context.currentTime
        const oscillator = context.createOscillator()
        const amp = context.createGain()
        // Two octaves over the first 48 calls, then flat: rising but never shrill.
        const frequency = 240 * Math.pow(2, Math.min(Math.max(shown, 1), 48) / 24)
        oscillator.type = tier === 'blaze' ? 'triangle' : 'sine'
        oscillator.frequency.setValueAtTime(frequency, now)
        amp.gain.setValueAtTime(0.0001, now)
        amp.gain.exponentialRampToValueAtTime(Math.max(volume * 0.5, 0.0002), now + 0.008)
        amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.085)
        oscillator.connect(amp)
        amp.connect(context.destination)
        oscillator.start(now)
        oscillator.stop(now + 0.095)
      } catch {
        // Ignore: see above.
      }
    }

    // ---------------------------------------------------------------------
    // Combo value + the session it belongs to.
    // ---------------------------------------------------------------------
    const NO_SUBSCRIBE = () => () => {}
    const NO_SNAPSHOT = () => undefined
    const EMPTY_COMBO = { combo: 0, tool: '' }

    /**
     * Subscribe to the active conversation's combo value from the root overlay.
     *
     * The public UiSession adapter exposes the current standard-source binding;
     * Session Controller exposes the selected Session's projection face through
     * `sessions.binding(id).session.projections`. A root-scoped slot cannot use
     * the session-scoped `useProjection` hook directly.
     */
    function useCombo(sessions, uiSession) {
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
      return {
        score: view.combo,
        tool: typeof view.tool === 'string' ? view.tool : '',
        changedAt: typeof view.changedAt === 'number' && Number.isFinite(view.changedAt) ? view.changedAt : 0,
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
    function tierOf(combo) {
      if (combo >= 50) return {
        id: 'blaze', shake: true, accent: '#ff936b',
        halo: 'rgba(255, 113, 65, 0.55)', spark: '#ffd6a8',
      }
      if (combo >= 20) return {
        id: 'hot', shake: true, accent: '#ffd968',
        halo: 'rgba(255, 197, 54, 0.48)', spark: '#fff0b0',
      }
      if (combo >= 10) return {
        id: 'warm', shake: false, accent: '#b9ee72',
        halo: 'rgba(158, 225, 73, 0.42)', spark: '#e3ffb0',
      }
      return {
        id: 'calm', shake: false, accent: '#9be779',
        halo: 'rgba(117, 213, 82, 0.36)', spark: '#d7ffc3',
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
      const combo = useCombo(sessions, uiSession)
      const score = combo.score
      const tool = combo.tool
      const sessionId = combo.sessionId
      const [lastCall, setLastCall] = useState(() => ({ sessionId, at: score > 0 ? combo.changedAt || Date.now() : 0 }))

      // Motion is driven by `animationName`, which cycles through a bounded ring
      // so a continuing combo re-triggers the pop instead of sitting still.
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

      useEffect(() => {
        const prior = track.current
        track.current = { sessionId, score, tool }
        if (prior.sessionId !== sessionId) {
          // A different conversation is not a transition: adopt its value and
          // its own pin as the baseline instead of reading a reset into it.
          setLastCall({ sessionId, at: score > 0 ? combo.changedAt || Date.now() : 0 })
          setGhost(null)
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
          return undefined
        }
        if (score <= before) return undefined

        // A kept streak is written on every call, so a reload lands back inside
        // the run it was watching instead of on a stale number.
        if (pin.active) savePin(sessionId, pin, score)
        setLastCall({ sessionId, at: combo.changedAt || Date.now() })
        setPop((token) => token + 1)
        setGain({ id: score, delta: score - before })
        const frequency = Math.max(1, Math.round(config.effectFrequency))
        if (motion && config.particles && streak >= config.powerThreshold && Math.floor(score / frequency) > Math.floor(before / frequency)) setParticles({ id: pop + 1 })
        if (config.sound && streak >= config.soundFrom) playBlip(streak, tierOf(streak).id, config.soundVolume)
        return undefined
      }, [sessionId, score, tool, pin.active, pin.base, config.pinPromptMs, config.sound,
        config.soundFrom, config.soundVolume, config.particles, config.powerThreshold, config.effectFrequency, motion, streak])

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
      const shown = streak > 0 ? streak : (ghostShown ? ghost.value : 0)
      if (!config.enabled || expired || shown <= 0) {
        return null
      }

      const baseTier = tierOf(shown)
      const palettes = {
        flames: { accent: '#ffad58', halo: 'rgba(255, 117, 42, .48)', spark: '#ffe0a0' },
        fireworks: { accent: '#88dcff', halo: 'rgba(89, 191, 255, .45)', spark: '#e0f6ff' },
        rift: { accent: '#c4a1ff', halo: 'rgba(163, 112, 255, .48)', spark: '#ecdfff' },
      }
      const tier = { ...baseTier, ...palettes[preset] }
      if (preset === 'particles') {
        const hue = Math.max(0, 100 - Math.max(0, shown - config.powerThreshold) * 1.2)
        tier.accent = `hsl(${hue}, 85%, 65%)`
        tier.halo = `hsla(${hue}, 85%, 55%, .4)`
        tier.spark = `hsl(${hue}, 90%, 85%)`
      }
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
      const previewSound = () => {
        const at = Math.max(Math.round(config.soundFrom), 1)
        playBlip(at, tierOf(at).id, config.soundVolume)
      }
      const side = PLACEMENT[config.position] ?? PLACEMENT['top-right']
      const shownTool = streak > 0 ? tool : (ghostShown ? ghost.tool : '')

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

      // PowerMode's meter is unboxed: a bright bar over a bold white multiplier.
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
        color: config.numberColor || 'var(--dsw-alias-text-primary, #f5fff0)',
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
        background: config.numberColor || 'var(--dsw-alias-text-primary, #f5fff0)',
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
          `+${gain.delta}${config.showToolName && tool ? ` ${tool}` : ''}`),
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
            config.showTimer && h('span', { key: `timer-${sessionId}-${timerStart}`, style: barStyle, 'data-dsh-combo-bar': '', 'data-dsh-combo-timer-start': timerStart, title: '连击倒计时：每次工具调用重新补满' }),
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
      )
    }

    /**
     * The shared control builders. The HUD's gear panel and the Plugins-page
     * configuration page render the same rows; only the write target differs, so
     * the two can never drift apart.
     *
     * @param config - the effective values the controls display.
     * @param write - `(key, value) => void`, the surface's own save path.
     */
    function controlKit(config, write) {
      const controlStyle = { width: '100%', accentColor: 'var(--dsh-combo-control-accent, #9be779)' }
      const range = (key, label, min, max, step, unit = '') => h('label', { key, style: { display: 'block', margin: '10px 0' } },
        h('span', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px' } },
          label, h('span', { style: { opacity: .7 } }, key === 'particleCount' && config[key] === 0 ? '自动' : `${config[key]}${unit}`)),
        h('input', { type: 'range', min, max, step, value: config[key], 'aria-label': label,
          'data-dsh-combo-setting': key, style: controlStyle, onChange: event => write(key, Number(event.target.value)) }))
      const toggle = (key, label) => h('label', { key, style: { display: 'flex', gap: '8px', margin: '9px 0', alignItems: 'center' } },
        h('input', { type: 'checkbox', checked: config[key], 'data-dsh-combo-setting': key,
          onChange: event => write(key, event.target.checked) }), label)
      const color = (key, label, fallback) => h('label', { key, style: { display: 'flex', alignItems: 'center', gap: '8px', margin: '10px 0' } },
        h('span', { style: { flex: 1 } }, label),
        h('input', { type: 'color', value: config[key] || fallback, 'aria-label': label, 'data-dsh-combo-setting': key,
          style: { width: '32px', height: '24px', padding: 0, border: 0, background: 'transparent' },
          onChange: event => write(key, event.target.value) }),
        h('button', { type: 'button', onClick: () => write(key, ''), style: { cursor: 'pointer' } }, '自动'))
      const section = (title, ...controls) => h('fieldset', { key: title, style: { border: 'none', borderTop: '1px solid rgba(128,128,128,.25)', padding: '8px 0', margin: '12px 0 0' } },
        h('legend', { style: { fontWeight: 700, paddingRight: '8px' } }, title), controls)
      const select = (key, label, options) => h('label', { key, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', margin: '10px 0' } }, label,
        h('select', { value: config[key], 'aria-label': label, 'data-dsh-combo-setting': key,
          onChange: event => write(key, event.target.value), style: { maxWidth: '150px' } },
          Object.entries(options).map(([value, text]) => h('option', { key: value, value }, text))))
      // The list editor writes the raw text; the surface decides how to split it.
      const list = (key, label, hint) => h('label', { key, style: { display: 'block', margin: '10px 0' } },
        h('span', { style: { display: 'block', opacity: .8 } }, label),
        h('input', { type: 'text', value: Array.isArray(config[key]) ? config[key].join(', ') : '', 'aria-label': label,
          'data-dsh-combo-setting': key, placeholder: hint, style: { width: '100%' },
          onChange: event => write(key, event.target.value) }))
      return { range, toggle, color, section, select, list }
    }

    function AppearanceSettings({ config, customize, onReset, onPreview, onPreviewSound, right, top }) {
      const { range, toggle, color, section, select } = controlKit(config, customize)
      return h('details', { 'data-dsh-combo-settings': '', style: { position: 'static', pointerEvents: 'auto' } },
        h('summary', { 'aria-label': '自定义连击外观', title: '自定义连击外观', style: { listStyle: 'none', cursor: 'pointer', fontSize: '14px', opacity: .7, padding: '2px 4px', color: 'var(--dsw-alias-text-secondary,#aaa)' } }, '\u2699'),
        h('div', { 'data-dsh-combo-settings-panel': '', style: {
          position: 'absolute', zIndex: 30, top: top ? 'calc(100% + 8px)' : 'auto', bottom: top ? 'auto' : 'calc(100% + 8px)',
          right: right ? 0 : 'auto', left: right ? 'auto' : 0,
          width: 'min(280px, calc(100vw - 36px))', maxHeight: `min(520px, max(120px, calc(100dvh - var(--dsh-frame-top-clearance, 48px) - ${config.offsetY + 120 * config.scale + 32}px)))`, overflowY: 'auto',
          padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(128,128,128,.3)',
          background: 'var(--dsw-alias-bg-base, #24262a)', color: 'var(--dsw-alias-text-primary,#eee)',
          boxShadow: '0 8px 28px rgba(0,0,0,.25)', fontFamily: 'Arial, sans-serif', fontSize: '12px', fontWeight: 400, lineHeight: 1.5,
        } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('strong', { style: { fontSize: '14px' } }, '连击外观'),
            h('button', { type: 'button', onClick: onPreview }, '预览特效')),
          section('连击与节奏',
            range('timerMs', '倒计时时长', 1000, 60000, 1000, ' ms'),
            h('p', { key: 'timer-note', style: { margin: '4px 0', opacity: .65, fontSize: '11px' } }, config.expireMs > 0 ? `空闲清零已开启，进度条使用 ${config.expireMs} ms。` : '每次调用补满进度条。耗尽后保留本轮计数。'),
            range('powerThreshold', '特效触发门槛', 0, 100, 1, ' 次'),
            range('effectFrequency', '每几次调用触发特效', 1, 20, 1),
            toggle('shake', '连击抖动'), range('shakeIntensity', '抖动强度', 0, 12, .5, ' px')),
          section('外观', range('scale', '计数器大小', .5, 2, .05, '×'),
            range('barHeight', '进度条高度', 2, 16, 1, ' px'), range('glow', '光晕强度', 0, 2, .1),
            color('accentColor', '特效颜色', '#9be779'), color('numberColor', '数字颜色', '#f5fff0')),
          section('粒子', toggle('particles', '启用粒子特效'),
            range('particleCount', '粒子数量', 0, 80, 1), range('particleSize', '粒子大小', 1, 12, .5, ' px'),
            range('particleSpread', '扩散范围', .25, 2, .05, '×'), range('effectDurationMs', '特效时长', 200, 2500, 50, ' ms')),
          section('位置', select('position', '浮层位置', { 'top-right': '右上角', 'top-left': '左上角', 'bottom-right': '右下角', 'bottom-left': '左下角' }),
            range('offsetX', '水平边距', 0, 240, 2, ' px'), range('offsetY', '垂直边距', 0, 240, 2, ' px')),
          section('显示', toggle('showTimer', '显示倒计时条'), toggle('showGain', '显示增量提示'), toggle('showToolName', '显示工具名'),
            select('animation', '反馈强度', { off: '关闭', normal: '普通', strong: '强烈' })),
          section('音效', toggle('sound', '启用音效'),
            range('soundVolume', '音量', 0, 1, .05),
            range('soundFrom', '起播连击数', 0, 100, 1, ' 次'),
            h('p', { key: 'sound-note', style: { margin: '4px 0', opacity: .65, fontSize: '11px' } },
              config.sound ? `连击达到 ${config.soundFrom} 次后每次调用响一声。` : '音效当前关闭；点「试听」可先听效果。'),
            h('button', { type: 'button', 'data-dsh-combo-setting': 'soundPreview', onClick: onPreviewSound,
              style: { width: '100%', cursor: 'pointer' } }, '试听')),
          h('button', { type: 'button', onClick: onReset, style: { width: '100%', cursor: 'pointer', marginTop: '10px' } }, '恢复默认设置'),
        ),
      )
    }

    // ---------------------------------------------------------------------
    // Configuration page: Plugins → dsh-combo → 配置
    //
    // DSH renders this one into the bundle's page on the Plugins page and hands
    // it the Host settings form, so these values live in the profile's row
    // config and apply live. The gear panel above stays a per-browser quick
    // tune on top of them.
    // ---------------------------------------------------------------------

    /** Numeric ranges this page edits; the two delays are not on the gear panel. */
    const PAGE_RANGES = { ...CUSTOM_RANGES, expireMs: [0, 600000], pinPromptMs: [0, 60000] }
    /** Switches, including the one that decides whether a HUD exists at all. */
    const PAGE_SWITCHES = ['enabled', 'showToolName', 'particles', 'shake', 'showGain', 'showTimer']

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
      // Sound is the one switch that defaults off: an accidental beep is worse
      // than a missing one.
      config.sound = unwrapped.sound === true
      config.preset = Object.hasOwn(PRESETS, unwrapped.preset) ? unwrapped.preset : CONFIG_DEFAULTS.preset
      config.excludeTools = Array.isArray(unwrapped.excludeTools) ? unwrapped.excludeTools.map(String) : []
      return config
    }

    /** Split the list editor's text into tool names. */
    function splitTools(text) {
      return String(text).split(/[,\s]+/).map((part) => part.trim()).filter((part) => part !== '')
    }

    /**
     * The bundle's configuration page.
     *
     * @param props - the slot's props plus `form`, the Host settings form this
     *   plugin injects for its own namespace.
     */
    function ComboSettingsPage(props) {
      const form = props.form
      const snapshot = useSyncExternalStore(
        (listener) => form.subscribe(listener),
        () => form.getSnapshot(),
      )
      const [busy, setBusy] = useState(false)
      const [notice, setNotice] = useState(null)

      const save = (key, raw) => {
        const value = key === 'excludeTools' ? splitTools(raw) : raw
        const revision = snapshot.revision
        setBusy(true)
        setNotice(null)
        Promise.resolve(form.mutate([{ op: 'set', path: [key], value }], revision))
          .then((accepted) => {
            if (!accepted) {
              // The form reports a refusal as `false`; a moved revision is what
              // separates "someone else saved first" from "the Host said no".
              const moved = form.getSnapshot().revision !== revision
              setNotice({
                kind: 'error',
                text: moved ? '配置已在别处修改，已重新载入当前值，请再试一次。' : '本部署没有接受这个取值。',
              })
              return
            }
            // The profile value now wins, and the HUD repaints from the live route.
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
      const { range, toggle, color, section, select, list } = controlKit(config, save)
      const previewSound = () => {
        const at = Math.max(Math.round(config.soundFrom), 1)
        playBlip(at, tierOf(at).id, config.soundVolume)
      }

      return h('div', {
        'data-dsh-combo-config': '',
        'aria-busy': busy ? 'true' : 'false',
        style: { fontSize: '12px', lineHeight: 1.5, opacity: busy ? .75 : 1 },
      },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' } },
          h('strong', { style: { fontSize: '14px' } }, '连击 HUD'),
          h('span', { style: { opacity: .65 } }, '保存到 profile 配置，立即生效')),
        section('连击与节奏',
          toggle('enabled', '显示连击 HUD'),
          range('timerMs', '倒计时时长', 1000, 60000, 1000, ' ms'),
          range('powerThreshold', '特效触发门槛', 0, 100, 1, ' 次'),
          range('effectFrequency', '每几次调用触发特效', 1, 20, 1),
          toggle('shake', '连击抖动'),
          range('shakeIntensity', '抖动强度', 0, 12, .5, ' px'),
          range('expireMs', '空闲清零', 0, 600000, 1000, ' ms'),
          range('pinPromptMs', '保留连击提示时长', 0, 60000, 500, ' ms')),
        section('外观',
          select('preset', '默认特效', PRESETS),
          range('scale', '计数器大小', .5, 2, .05, '×'),
          range('barHeight', '进度条高度', 2, 16, 1, ' px'),
          range('glow', '光晕强度', 0, 2, .1),
          color('accentColor', '特效颜色', '#9be779'),
          color('numberColor', '数字颜色', '#f5fff0')),
        section('粒子', toggle('particles', '启用粒子特效'),
          range('particleCount', '粒子数量', 0, 80, 1),
          range('particleSize', '粒子大小', 1, 12, .5, ' px'),
          range('particleSpread', '扩散范围', .25, 2, .05, '×'),
          range('effectDurationMs', '特效时长', 200, 2500, 50, ' ms')),
        section('位置',
          select('position', '浮层位置', { 'top-right': '右上角', 'top-left': '左上角', 'bottom-right': '右下角', 'bottom-left': '左下角' }),
          range('offsetX', '水平边距', 0, 240, 2, ' px'),
          range('offsetY', '垂直边距', 0, 240, 2, ' px')),
        section('显示',
          toggle('showTimer', '显示倒计时条'),
          toggle('showGain', '显示增量提示'),
          toggle('showToolName', '显示工具名'),
          select('animation', '反馈强度', { off: '关闭', normal: '普通', strong: '强烈' })),
        section('音效', toggle('sound', '启用音效'),
          range('soundVolume', '音量', 0, 1, .05),
          range('soundFrom', '起播连击数', 0, 100, 1, ' 次'),
          h('p', { key: 'sound-note', style: { margin: '4px 0', opacity: .65, fontSize: '11px' } },
            config.sound ? `连击达到 ${config.soundFrom} 次后每次调用响一声。` : '音效当前关闭；点「试听」可先听效果。'),
          h('button', { type: 'button', 'data-dsh-combo-setting': 'soundPreview', onClick: previewSound,
            style: { width: '100%', cursor: 'pointer' } }, '试听')),
        section('高级', list('excludeTools', '不计入连击的工具', 'bash, edit')),
        notice === null ? null : h('p', {
          role: 'status',
          'data-dsh-combo-notice': notice.kind,
          style: { margin: '10px 0 0', opacity: .9 },
        }, notice.text),
      )
    }

    /** Small square particles fan toward the interior, then fall and fade. */
    function ParticleBurst({ tier, preset, config, id, top, right }) {
      const count = config.particleCount > 0 ? Math.round(config.particleCount) : tier.id === 'blaze' ? 20 : tier.id === 'hot' ? 17 : tier.id === 'warm' ? 13 : 10
      const reach = config.particleSpread * (tier.id === 'blaze' ? 112 : tier.id === 'hot' ? 92 : tier.id === 'warm' ? 76 : 60)
      const sparks = []
      for (let index = 0; index < count; index += 1) {
        // Deterministic variation keeps each burst distinct without random renders.
        const seed = (index * 37 + id * 17) % 101
        const angle = (preset === 'fireworks' || preset === 'rift' ? seed * 3.6 : -155 + seed * 1.15) * Math.PI / 180
        const distance = reach * (0.5 + ((index * 13 + id * 7) % 51) / 100)
        const x = preset === 'flames' ? (seed - 50) * .7 : Math.cos(angle) * distance * (right ? 1 : -1)
        const y = preset === 'flames' ? -distance * 1.25 : Math.sin(angle) * distance * (top ? 1 : -1) * (preset === 'rift' ? .45 : 1)
        const size = config.particleSize * (.75 + (index % 3) * .25)
        sparks.push(h('span', {
          key: index,
          style: {
            position: 'absolute',
            left: '50%',
            top: top ? '16px' : '70%',
            width: `${size}px`,
            height: `${preset === 'flames' ? size * 3 : preset === 'rift' ? size * 2 : size}px`,
            borderRadius: preset === 'fireworks' ? '50%' : preset === 'flames' ? '70% 30% 60% 40%' : 0,
            background: index % 3 === 0 ? '#f5fff0' : index % 3 === 1 ? tier.accent : tier.spark,
            boxShadow: `0 0 7px ${tier.halo}`,
            '--dsh-combo-spin': `${seed * 3.6}deg`,
            '--dsh-combo-x': `${x.toFixed(1)}px`,
            '--dsh-combo-y': `${y.toFixed(1)}px`,
            '--dsh-combo-fall': `${(y + 34).toFixed(1)}px`,
            opacity: 0,
            animation: `dshcombo-${preset === 'particles' ? 'spark' : preset}-${id % MOTION_RING} ${config.effectDurationMs}ms ease-out ${(index % 4) * 14}ms both`,
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
        preset === 'rift' && h('span', {
          style: {
            position: 'absolute', left: '50%', top: '35%', width: '90px', height: '32px',
            marginLeft: '-45px', border: `2px solid ${tier.accent}`, borderRadius: '50%',
            boxShadow: `0 0 18px ${tier.halo}, inset 0 0 12px ${tier.halo}`,
            animation: `dshcombo-portal-${id % MOTION_RING} ${config.effectDurationMs}ms ease-out both`,
          },
        }), sparks)
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
      frames.push('@media (prefers-reduced-motion:reduce){[data-dsh-combo],[data-dsh-combo] *:not([data-dsh-combo-bar]){animation:none!important;transition:none!important}[data-dsh-combo-burst]{display:none!important}}')
      return h('style', { 'data-dsh-combo-style': '' }, frames.join(''))
    }

    function ComboRoot(props) {
      return h(React.Fragment, null,
        h(ComboStyles, null),
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
