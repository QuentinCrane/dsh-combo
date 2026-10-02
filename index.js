/**
 * dsh-combo — Host half.
 *
 * The only Host responsibility is to keep ONE per-session value that answers:
 * "how many tool calls has the current agent turn made so far?"
 *
 * It is a session projection unit (`ctx.sessionProjections`), so the framework
 * drives it over committed session events and serves it to the browser as a
 * wire view. The Client never folds session events itself.
 *
 * Combo semantics (this plugin's product boundary):
 *   1. tool call  = +1 combo          (event `tool/call`, never `tool/result`)
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
 * This file imports nothing: DSH resolves bundled packages only for its own
 * packages, and an out-of-tree bundle declares no dependencies. Configuration is
 * therefore read straight from `ctx.config` and clamped field by field.
 */

const PLUGIN_ID = 'dsh-combo'
const PROJECTION_KEY = 'dshCombo'
const CONFIG_ROUTE = '/dsh-combo/config'
const CONFIG_REVISION = 4

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
  const raw = cfg !== null && typeof cfg === 'object' ? cfg : {}
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

  if (event !== null && typeof event === 'object' && event.type === 'tool/call') {
    const name = event.data !== undefined && typeof event.data.name === 'string' ? event.data.name : ''
    if (excluded.has(name.toLowerCase())) return state
    const at = typeof event.time === 'number' ? event.time : state.lastCallAt
    // An opted-in idle break restarts the run, exactly as a turn boundary would:
    // the call that arrives after the gap is the first one of a fresh combo.
    const stale = expireMs > 0 && state.combo > 0 && at - state.lastCallAt > expireMs
    return {
      combo: stale ? 1 : state.combo + 1,
      // Sequential calls inside one step arrive as a run of `tool/call` events,
      // so the last one is the current tool. The label is never cleared on its
      // own: it should keep naming the last tool while the agent thinks.
      tool: name,
      lastCallAt: at,
      updatedAt: state.updatedAt + 1,
    }
  }
  if (event !== null && typeof event === 'object' && (event.type === 'turn/start' || event.type === 'turn/end')) {
    // A replaced (replayed/rewritten) turn boundary is not a fresh turn.
    if (event.surfaceOp !== undefined && event.surfaceOp !== 'append') return state
    if (state.combo === 0 && state.tool === '') return state
    return { combo: 0, tool: '', lastCallAt: state.lastCallAt, updatedAt: state.updatedAt + 1 }
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
  const cfg = publicConfig(config ?? ctx.config)
  const excluded = new Set(cfg.excludeTools.map((tool) => String(tool).toLowerCase()))

  // One combo value per session, driven by the framework over committed events.
  ctx.sessionProjections.register({
    key: PROJECTION_KEY,
    stateVersion: 2,
    init: () => ({ combo: 0, tool: '', lastCallAt: 0, updatedAt: 0 }),
    apply: (state, event) => foldCombo(state, event, { excluded, expireMs: cfg.expireMs }),
    wire: { viewSchema: ComboViewSchema, view: toComboView },
  })

  // The Client bundle is a static artifact and cannot read this plugin's row
  // config, so the Host publishes it over one no-store route.
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: CONFIG_ROUTE,
      handler: (_req, res) => {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        })
        res.end(JSON.stringify({ revision: CONFIG_REVISION, config: cfg }))
      },
    }), `${PLUGIN_ID}: config route`)
  })
}
