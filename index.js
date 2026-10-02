/**
 * dsh-combo — Host half.
 *
 * The only Host responsibility is to keep ONE per-session value that answers:
 * "how many model steps and tool calls has the current agent turn completed?"
 *
 * It is a session projection unit (`ctx.sessionProjections`), so the framework
 * drives it over committed session events and serves it to the browser as a
 * wire view. The Client never folds session events itself.
 *
 * Combo semantics (this plugin's product boundary):
 *   1. completed model step or tool call = +1 combo          (events `assistant/message` and `tool/call`, never stream deltas)
 *   2. one turn   = one combo session (close on `turn/start` and `turn/end`)
 *   3. no time decay unless opted in  (`expireMs`; 0 keeps it purely turn-based)
 *
 * Two features deliberately live on the Client instead of here:
 *   - `pin` (keep the combo across turns) is a display-level streak. A projection
 *     publishes only when a committed event drives it, so the Host could never
 *     push a pin toggle to the browser; keeping the streak client-side is what
 *     makes it the single source of truth for the number it paints.
 *   - sound, which is pure presentation.
 *
 * This file imports one thing: the Config schema. DSH resolves
 * `@deepseek-ai/*` peers from the running installation, so an out-of-tree
 * bundle shares the host's Schemastery instance instead of installing its own.
 * Configuration is still clamped field by field below, because profile patches
 * are user-authored YAML.
 */

import z from '@deepseek-ai/schemastery'

const PLUGIN_ID = 'dsh-combo'
const PROJECTION_KEY = 'dshCombo'
const CONFIG_ROUTE = '/dsh-combo/config'
const CONFIG_REVISION = 5

/** Positions accepted by both halves; the Client maps them onto CSS edges. */
const POSITIONS = ['top-right', 'top-left', 'bottom-right', 'bottom-left']
/** Animation intensities; `off` keeps the counter but drops every motion. */
const ANIMATIONS = ['off', 'normal', 'strong']
const PRESETS = ['particles', 'flames', 'fireworks', 'rift']

/** Upper bounds for the numeric knobs, so a typo cannot schedule a day-long timer. */
const MAX_EXPIRE_MS = 600000
const MAX_PIN_PROMPT_MS = 60000
const MAX_SOUND_FROM = 1000

/**
 * Row-config defaults. These are the values the Client falls back to when the
 * config route is unreachable, so keep them in step with `client.js`.
 */
export const CONFIG_DEFAULTS = {
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
  excludeTools: [],
  expireMs: 0,
  sound: false,
  soundVolume: 0.35,
  soundFrom: 10,
  pinPromptMs: 5000,
}

/**
 * Row-config schema.
 *
 * DSH derives a plugin's editable configuration from the `Config` this module
 * exports, and only fields marked `.volatile()` are accepted: a volatile field
 * is parsed into a stable reference that the loader commits in place, so a save
 * from the Plugins page applies without remounting the row. Every field is
 * volatile — the HUD is pure presentation, and a saved setting should be
 * visible at once.
 *
 * `any()` is deliberate. DSH serializes this schema to the browser and
 * validates writes against it, but a profile patch stays user-authored YAML:
 * `publicConfig` already clamps each field, and a stricter type here would turn
 * a quoted number into a row that refuses to load — exactly what this plugin
 * tolerates today.
 */
export const Config = z.object({
  enabled: z.any().default(CONFIG_DEFAULTS.enabled).volatile(),
  showToolName: z.any().default(CONFIG_DEFAULTS.showToolName).volatile(),
  animation: z.any().default(CONFIG_DEFAULTS.animation).volatile(),
  particles: z.any().default(CONFIG_DEFAULTS.particles).volatile(),
  preset: z.any().default(CONFIG_DEFAULTS.preset).volatile(),
  timerMs: z.any().default(CONFIG_DEFAULTS.timerMs).volatile(),
  powerThreshold: z.any().default(CONFIG_DEFAULTS.powerThreshold).volatile(),
  effectFrequency: z.any().default(CONFIG_DEFAULTS.effectFrequency).volatile(),
  shake: z.any().default(CONFIG_DEFAULTS.shake).volatile(),
  shakeIntensity: z.any().default(CONFIG_DEFAULTS.shakeIntensity).volatile(),
  scale: z.any().default(CONFIG_DEFAULTS.scale).volatile(),
  offsetX: z.any().default(CONFIG_DEFAULTS.offsetX).volatile(),
  offsetY: z.any().default(CONFIG_DEFAULTS.offsetY).volatile(),
  barHeight: z.any().default(CONFIG_DEFAULTS.barHeight).volatile(),
  particleCount: z.any().default(CONFIG_DEFAULTS.particleCount).volatile(),
  particleSize: z.any().default(CONFIG_DEFAULTS.particleSize).volatile(),
  particleSpread: z.any().default(CONFIG_DEFAULTS.particleSpread).volatile(),
  effectDurationMs: z.any().default(CONFIG_DEFAULTS.effectDurationMs).volatile(),
  glow: z.any().default(CONFIG_DEFAULTS.glow).volatile(),
  accentColor: z.any().default(CONFIG_DEFAULTS.accentColor).volatile(),
  numberColor: z.any().default(CONFIG_DEFAULTS.numberColor).volatile(),
  showGain: z.any().default(CONFIG_DEFAULTS.showGain).volatile(),
  showTimer: z.any().default(CONFIG_DEFAULTS.showTimer).volatile(),
  position: z.any().default(CONFIG_DEFAULTS.position).volatile(),
  excludeTools: z.any().default(CONFIG_DEFAULTS.excludeTools).volatile(),
  expireMs: z.any().default(CONFIG_DEFAULTS.expireMs).volatile(),
  sound: z.any().default(CONFIG_DEFAULTS.sound).volatile(),
  soundVolume: z.any().default(CONFIG_DEFAULTS.soundVolume).volatile(),
  soundFrom: z.any().default(CONFIG_DEFAULTS.soundFrom).volatile(),
  pinPromptMs: z.any().default(CONFIG_DEFAULTS.pinPromptMs).volatile(),
})

/**
 * Unwrap one volatile field.
 *
 * A field declared `.volatile()` parses into a stable reference read with
 * `.get()`; a field left at its default stays ordinary data. Both shapes reach
 * the same clamp.
 *
 * @param value - raw config member, possibly a volatile reference.
 * @returns the value the reference holds, or the value itself.
 */
function plain(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
}

/**
 * Clamp one numeric knob.
 *
 * Accepts a YAML number or a numeric string (YAML quoting is a common slip) and
 * rejects booleans, `null` and `''`, which `Number()` would otherwise fold into
 * 0/1 and silently turn a switch into a duration.
 *
 * @param value - raw config member.
 * @param fallback - default used when the value is unusable.
 * @param min - inclusive lower bound.
 * @param max - inclusive upper bound.
 * @returns a finite number inside `[min, max]`.
 */
function clampNumber(value, fallback, min, max) {
  const usable = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
  if (!usable) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

/**
 * Clamp one raw row config into the public shape.
 *
 * The harness config is user-authored YAML, so every field is treated as
 * untrusted input: unknown enum members fall back to the default and a
 * non-array `excludeTools` is ignored rather than fatal.
 *
 * @param cfg - raw `ctx.config` (or any partial object).
 * @returns the Client-facing configuration.
 */
export function publicConfig(cfg) {
  const source = plain(cfg)
  // Volatile fields arrive as references; the clamp below wants plain values.
  const raw = {}
  if (source !== null && typeof source === 'object') {
    for (const [key, value] of Object.entries(source)) raw[key] = plain(value)
  }
  return {
    enabled: raw.enabled !== false,
    showToolName: raw.showToolName !== false,
    animation: ANIMATIONS.includes(raw.animation) ? raw.animation : CONFIG_DEFAULTS.animation,
    particles: raw.particles !== false,
    preset: PRESETS.includes(raw.preset) ? raw.preset : CONFIG_DEFAULTS.preset,
    powerThreshold: Math.round(clampNumber(raw.powerThreshold, CONFIG_DEFAULTS.powerThreshold, 0, 1000)),
    effectFrequency: Math.round(clampNumber(raw.effectFrequency, CONFIG_DEFAULTS.effectFrequency, 1, 20)),
    shake: raw.shake !== false,
    shakeIntensity: clampNumber(raw.shakeIntensity, CONFIG_DEFAULTS.shakeIntensity, 0, 12),
    timerMs: clampNumber(raw.timerMs, CONFIG_DEFAULTS.timerMs, 1000, 60000),
    scale: clampNumber(raw.scale, CONFIG_DEFAULTS.scale, 0.5, 2),
    offsetX: clampNumber(raw.offsetX, CONFIG_DEFAULTS.offsetX, 0, 240),
    offsetY: clampNumber(raw.offsetY, CONFIG_DEFAULTS.offsetY, 0, 240),
    barHeight: clampNumber(raw.barHeight, CONFIG_DEFAULTS.barHeight, 2, 16),
    particleCount: clampNumber(raw.particleCount, CONFIG_DEFAULTS.particleCount, 0, 80),
    particleSize: clampNumber(raw.particleSize, CONFIG_DEFAULTS.particleSize, 1, 12),
    particleSpread: clampNumber(raw.particleSpread, CONFIG_DEFAULTS.particleSpread, 0.25, 2),
    effectDurationMs: clampNumber(raw.effectDurationMs, CONFIG_DEFAULTS.effectDurationMs, 200, 2500),
    glow: clampNumber(raw.glow, CONFIG_DEFAULTS.glow, 0, 2),
    accentColor: /^#[0-9a-f]{6}$/i.test(raw.accentColor) ? raw.accentColor : '',
    numberColor: /^#[0-9a-f]{6}$/i.test(raw.numberColor) ? raw.numberColor : '',
    showGain: raw.showGain !== false,
    showTimer: raw.showTimer !== false,
    position: POSITIONS.includes(raw.position) ? raw.position : CONFIG_DEFAULTS.position,
    excludeTools: Array.isArray(raw.excludeTools) ? raw.excludeTools.slice() : [],
    // 0 disables the idle break, which keeps the default semantics turn-based.
    expireMs: clampNumber(raw.expireMs, CONFIG_DEFAULTS.expireMs, 0, MAX_EXPIRE_MS),
    sound: raw.sound === true,
    soundVolume: clampNumber(raw.soundVolume, CONFIG_DEFAULTS.soundVolume, 0, 1),
    soundFrom: clampNumber(raw.soundFrom, CONFIG_DEFAULTS.soundFrom, 0, MAX_SOUND_FROM),
    pinPromptMs: clampNumber(raw.pinPromptMs, CONFIG_DEFAULTS.pinPromptMs, 0, MAX_PIN_PROMPT_MS),
  }
}

const NO_EXCLUSIONS = new Set()

/**
 * Fold one committed session event into the combo state.
 *
 * Pure and synchronous, and it returns the SAME reference for events that do
 * not concern the combo, so the projection framework's change gate skips all
 * downstream work (this unit is driven eagerly on every committed event).
 *
 * @param state - current combo state: `{ combo, tool, lastCallAt, updatedAt }`.
 * @param event - one committed session event.
 * @param options - `{ excluded, expireMs }`; `excluded` is a set of lower-cased
 *   tool names that must not count, `expireMs` is the optional idle break.
 * @returns the next state, or the same reference when nothing changed.
 */
export function foldCombo(state, event, options = {}) {
  const excluded = options.excluded ?? NO_EXCLUSIONS
  const expireMs = Number.isFinite(options.expireMs) ? options.expireMs : 0

  if (event === null || typeof event !== 'object') return state
  const thought = event.type === 'assistant/message'
  if (thought || event.type === 'tool/call') {
    // Count one settled model round, including providers without exposed reasoning.
    // Stream deltas, failed attempts, interrupted prefixes and history rewrites
    // never earn a combo. One turn/step identity prevents repeated settlement.
    const data = event.data
    const thoughtKey = thought && Number.isInteger(data?.turn) && Number.isInteger(data?.step)
      ? `${data.turn}:${data.step}` : null
    if (thought && (thoughtKey === null || data.interrupted === true ||
      (event.surfaceOp !== undefined && event.surfaceOp !== 'append') ||
      state.lastThought === thoughtKey)) return state
    const name = thought ? '思考' : typeof data?.name === 'string' ? data.name : ''
    if (!thought && excluded.has(name.toLowerCase())) return state
    const at = typeof event.time === 'number' ? event.time : state.lastCallAt
    // An opted-in idle break restarts the run, exactly as a turn boundary would:
    // the call that arrives after the gap is the first one of a fresh combo.
    const stale = expireMs > 0 && state.combo > 0 && at - state.lastCallAt > expireMs
    return {
      ...state,
      ...(thought ? { lastThought: thoughtKey } : {}),
      combo: stale ? 1 : state.combo + 1,
      // The label names the latest counted activity, either thinking or a tool.
      tool: name,
      lastCallAt: at,
      updatedAt: state.updatedAt + 1,
    }
  }
  if (event !== null && typeof event === 'object' && (event.type === 'turn/start' || event.type === 'turn/end')) {
    // A replaced (replayed/rewritten) turn boundary is not a fresh turn.
    if (event.surfaceOp !== undefined && event.surfaceOp !== 'append') return state
    if (state.combo === 0 && state.tool === '') return state
    return { ...state, combo: 0, tool: '', lastThought: null, lastCallAt: state.lastCallAt, updatedAt: state.updatedAt + 1 }
  }
  return state
}

/** Shape of one session's wire view, applied in `apply`. */
export function toComboView(state) {
  return { combo: state.combo, tool: state.tool, changedAt: state.lastCallAt }
}

/**
 * The wire view's validator.
 *
 * The projection carrier calls `viewSchema.parse()` on every published value,
 * so a unit that declares a wire view must supply one. The interface is the
 * only thing that matters here (`{ parse(value) }`); a hand-written validator
 * keeps this plugin dependency-free while still guaranteeing the Client never
 * receives a non-number combo or a non-string tool name.
 */
export const ComboViewSchema = {
  /**
   * @param value - whatever `toComboView` produced.
   * @returns a normalized view value.
   */
  parse(value) {
    const raw = value !== null && typeof value === 'object' ? value : {}
    const combo = Number(raw.combo)
    const changedAt = Number(raw.changedAt)
    return {
      combo: Number.isFinite(combo) ? combo : 0,
      tool: typeof raw.tool === 'string' ? raw.tool : '',
      changedAt: Number.isFinite(changedAt) ? changedAt : 0,
    }
  },
}

export const name = PLUGIN_ID

/**
 * Cordis service dependencies. `sessionProjections` gates activation; the
 * Web server is optional, so it is awaited locally with `ctx.inject` instead
 * (a profile without a Web carrier still gets the combo projection).
 */
export const inject = ['sessionProjections']

/**
 * Host plugin body.
 *
 * @param ctx - the plugin's Cordis context.
 * @param config - the resolved row config when the loader passes it.
 */
export function apply(ctx, config) {
  // Volatile configuration is committed into the running references when a
  // settings write lands, so every read goes through the live values instead of
  // a snapshot frozen at apply time.
  const live = () => publicConfig(config ?? ctx.config)

  // One combo value per session, driven by the framework over committed events.
  ctx.sessionProjections.register({
    key: PROJECTION_KEY,
    stateVersion: 3,
    init: () => ({ combo: 0, tool: '', lastThought: null, lastCallAt: 0, updatedAt: 0 }),
    apply: (state, event) => {
      const cfg = live()
      const excluded = new Set(cfg.excludeTools.map((tool) => String(tool).toLowerCase()))
      return foldCombo(state, event, { excluded, expireMs: cfg.expireMs })
    },
    wire: { viewSchema: ComboViewSchema, view: toComboView },
  })

  // This plugin renders its own page on the Plugins page, so the settings
  // service withdraws the auto-generated form for the row. The service is
  // optional: a profile without it still gets the projection and the route.
  // The owner must be THIS plugin's fiber, not the child injection's.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.effect(() => {
      const fiber = ctx.fiber
      if (fiber === undefined) return undefined
      return settingsCtx.settings.configure({ auto: false }, fiber)
    }, `${PLUGIN_ID}: settings presentation`)
  })

  // The Client bundle is a static artifact and cannot read this plugin's row
  // config, so the Host publishes it over one no-store route. Serving the live
  // values keeps a saved setting visible without reloading the page.
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: CONFIG_ROUTE,
      handler: (_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(JSON.stringify({ revision: CONFIG_REVISION, config: live() }))
      },
    }), `${PLUGIN_ID}: config route`)
  })
}
