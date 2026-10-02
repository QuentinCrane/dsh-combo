/**
 * Local harness — Client half.
 *
 * Loads the real browser bundle through a `window.__ModuleLoader__` stub with a
 * React/DOM stand-in, then asserts the HUD's data wiring, its presentation
 * tiers, the kept (pinned) streak, the idle break and the sound gate.
 *   node --import ./test/register.mjs --test test/client.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as React from './react-shim.mjs'

const BUNDLE = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const DEFAULT_CONFIG = {
  enabled: true,
  showToolName: true,
  animation: 'normal',
  particles: true,
  position: 'top-right',
  expireMs: 0,
  sound: false,
  soundVolume: 0.35,
  soundFrom: 10,
  pinPromptMs: 5000,
}

/** Let the bundle's config fetch settle before asserting config-dependent behavior. */
const settle = async () => {
  for (let tick = 0; tick < 3; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * A thenable that runs its chain synchronously, so a single `mountCombo` call is
 * enough to observe the fetched config without awaiting the microtask queue.
 */
function syncThenable(value) {
  const chain = {
    then: (onFulfilled) => (onFulfilled === undefined ? chain : syncThenable(onFulfilled(value))),
    // The bundle's own catch() must never swallow a passing chain.
    catch: () => chain,
    finally: (onFinally) => {
      onFinally?.()
      return chain
    },
  }
  return chain
}

const response = (payload) => ({ ok: true, json: () => payload })

/** A `localStorage` stand-in that outlives one bundle instance, like the real one. */
function fakeStorage() {
  const entries = new Map()
  return {
    getItem: (key) => (entries.has(key) ? entries.get(key) : null),
    setItem: (key, value) => { entries.set(key, String(value)) },
    removeItem: (key) => { entries.delete(key) },
    clear: () => entries.clear(),
    keys: () => [...entries.keys()],
    raw: entries,
  }
}

/** A WebAudio stand-in that records every blip the bundle tries to play. */
function fakeAudio() {
  const played = []
  class FakeOscillator {
    constructor() {
      this.type = 'sine'
      this.hz = 0
      this.frequency = { setValueAtTime: (value) => { this.hz = value } }
    }
    connect() {}
    start() { played.push({ type: this.type, hz: this.hz }) }
    stop() {}
  }
  class FakeGain {
    constructor() {
      this.gain = { setValueAtTime() {}, exponentialRampToValueAtTime() {} }
    }
    connect() {}
  }
  class FakeAudioContext {
    constructor() {
      this.state = 'running'
      this.currentTime = 0
      this.destination = {}
    }
    createOscillator() { return new FakeOscillator() }
    createGain() { return new FakeGain() }
    resume() {}
  }
  return { played, Ctor: FakeAudioContext }
}

/**
 * A stand-in for the Host settings form the Plugins page hands a bundle
 * (`ctx.configForms.get(ns)`): a revisioned snapshot plus the documented write
 * queue, so a test can watch exactly what the configuration page sends.
 */
function fakeForm(options = {}) {
  const writes = []
  const listeners = new Set()
  let snapshot = {
    status: options.status ?? 'ready',
    value: options.value ?? {},
    base: options.value ?? {},
    user: {},
    revision: options.revision ?? 1,
    writable: options.writable !== false,
    mode: 'host',
  }
  return {
    writes,
    getSnapshot: () => snapshot,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    mutate: async (ops, revision) => {
      writes.push({ ops: structuredClone(ops), revision })
      if (options.refuse === true) return false
      const value = { ...snapshot.value }
      for (const op of ops) if (op.op === 'set') value[op.path[0]] = op.value
      snapshot = { ...snapshot, value, revision: (revision ?? snapshot.revision) + 1 }
      for (const listener of listeners) listener()
      return true
    },
  }
}

/** The real `localStorage` (absent in Node), restored whenever a mount has no stand-in. */
const originalStorage = globalThis.localStorage

/** Mount the bundle against one session whose combo value the test drives. */
function mountCombo(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...(options.config ?? {}) }
  const initialSessionId = options.sessionId ?? 'session-1'

  // One projection face per session, exactly as the Session Controller keeps it.
  const faces = new Map()
  const faceOf = (sessionId) => {
    if (!faces.has(sessionId)) {
      let value = sessionId === initialSessionId
        ? (options.combo ?? { combo: 0, tool: '' })
        : { combo: 0, tool: '' }
      const listeners = new Set()
      faces.set(sessionId, {
        getSnapshot: () => value,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
        set(next) { value = next; for (const listener of listeners) listener() },
      })
    }
    return faces.get(sessionId)
  }
  const comboFace = faceOf(initialSessionId)

  // A switchable active session; the snapshot is cached like a real store's, so
  // React's identity check on `getSnapshot` behaves as it does in the browser.
  // The value mirrors `uiSession.adapter.current`: the session id is carried on
  // `key` (an absent binding is `{ key: undefined }`), never on a `sessionId`
  // field. `sessions.binding(id).session.projections` supplies the face.
  const bindingOf = (sessionId) => ({ key: sessionId, hooks: {}, keyedHooks: {}, props: {} })
  let activeSessionId = initialSessionId
  let sessionSnapshot = bindingOf(activeSessionId)
  const sessionListeners = new Set()
  const current = {
    getSnapshot: () => sessionSnapshot,
    subscribe(listener) { sessionListeners.add(listener); return () => sessionListeners.delete(listener) },
    activate(next) {
      if (next === activeSessionId) return
      activeSessionId = next
      sessionSnapshot = bindingOf(next)
      for (const listener of sessionListeners) listener()
    },
  }

  const sessions = {
    binding: (sessionId) => ({
      session: { projections: { faceOf: () => faceOf(sessionId) } },
    }),
  }

  let factory = null
  const previousWindow = globalThis.window
  const previousFetch = globalThis.fetch
  globalThis.window = { __ModuleLoader__: { load: (registration) => { factory = registration.factory } } }
  globalThis.fetch = () => syncThenable(response({ revision: 2, config }))
  // A storage stand-in must outlive the mount that installed it: the test keeps
  // driving the HUD long after this function returns. Each mount therefore
  // retires the previous stand-in instead of restoring it in a `finally`.
  globalThis.localStorage = options.storage !== undefined ? options.storage : originalStorage
  let mounted = null
  let module = null
  let settingsPage = null
  try {
    // The bundle is a classic script; a function scope supplies its globals. The
    // config fetch starts on the first render, so it stays stubbed until then.
    new Function('window', BUNDLE)(globalThis.window)

    assert.ok(factory, 'the bundle must register a factory')
    module = factory((specifier) => {
      if (specifier === 'react') return React
      throw new Error(`unexpected require(${specifier})`)
    })
    module.__resetConfigCacheForTests?.()

    const registered = []
    settingsPage = null
    module.apply({
      sessions,
      uiSession: { adapter: { current } },
      slots: {
        inject: (owner, callback) => callback(),
        register: (slotOptions, component) => { registered.push({ slotOptions, component }); return component },
      },
      // The settings page is injected softly; a test opts in by handing over a
      // form, and `served: false` keeps the Host from serving the namespace.
      inject: (services, callback) => {
        if (!services.includes('configForms') || options.form === undefined) return
        callback({
          configForms: {
            get: () => options.form,
            whileServed: (namespaces, register) => (options.served === false ? () => {} : register(new Set(namespaces))),
          },
          slots: {
            inject: (owner, inner) => inner(),
            register: (slotOptions, component) => { settingsPage = component; return component },
          },
          effect: (factory) => factory(),
        })
      },
    })
    assert.equal(registered.length, 1)
    assert.equal(registered[0].slotOptions.name, 'shell.overlay')

    mounted = React.mount(React.createElement(registered[0].component, {}))
  } finally {
    globalThis.fetch = previousFetch
    globalThis.window = previousWindow
  }

  return { mounted, comboFace, current, faceOf, module, settingsPage, storage: options.storage }
}

/** Text directly inside nodes (not the whole subtree). */
const ownText = (node) => (node?.children ?? [])
  .map((child) => (child.kind === 'text' ? child.value : ''))
  .join('')
/** Text inside one node's direct children, e.g. the number and label of the pill. */
const nestedText = (node) => (node?.children ?? []).map(ownText).join('')

const findAll = (mounted, predicate) => mounted.all().filter(predicate)
/** The root HUD container (fixed to a viewport corner), or undefined when hidden. */
const hud = (mounted) => findAll(mounted, (node) => node.attributes?.['data-dsh-combo'] !== undefined)[0]
/** The pill holding the number and the label. */
const badge = (mounted) => findAll(mounted, (node) => node.attributes?.['data-dsh-combo-badge'] !== undefined)[0]
const pinButton = (mounted) => findAll(mounted, (node) => node.attributes?.['data-dsh-combo-pin'] !== undefined)[0]
const gainLabel = (mounted) => findAll(mounted, (node) => typeof node.style?.animation === 'string' && node.style.animation.startsWith('dshcombo-float-'))[0]
const toolLabel = (mounted) => findAll(mounted, (node) => typeof node.style?.fontFamily === 'string' && node.style.fontFamily.includes('monospace'))[0]
const burst = (mounted) => findAll(mounted, (node) => node.attributes?.['data-dsh-combo-burst'] !== undefined)
const sparks = (mounted) => findAll(mounted, (node) => typeof node.style?.animation === 'string' && node.style.animation.startsWith('dshcombo-spark-'))

/** Press the HUD's pin control, as a user click would. */
function clickPin(mounted) {
  const button = pinButton(mounted)
  assert.ok(button, 'the pin control must be on screen to be clicked')
  assert.equal(typeof button.props.onClick, 'function', 'the pin control must be clickable')
  button.props.onClick()
  mounted.update()
}

test('nothing renders while the combo is zero', () => {
  const { mounted } = mountCombo({ combo: { combo: 0, tool: '' } })
  assert.equal(hud(mounted), undefined)
})

// The two declarations below are different things, and confusing them leaves the
// entry pending forever with "waiting for services: <package name>". This pair of
// cases is the regression guard for exactly that boot failure.
test('the module declares client SERVICE dependencies, not packages', () => {
  const { module } = mountCombo({ combo: { combo: 0, tool: '' } })
  assert.deepEqual(module.inject, ['slots', 'sessions', 'uiSession'])
  assert.equal(module.name, 'dsh-combo')
  for (const dependency of module.inject) {
    assert.equal(dependency.includes('/'), false, `${dependency} looks like a package, not a service`)
    assert.equal(dependency.startsWith('@'), false, `${dependency} looks like a package, not a service`)
  }
})

test('package.json declares the packages that provide those services', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.deepEqual(manifest.dsh.client.inject, [
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-api-session-controller',
    '@deepseek-ai/dsh-client-ui-session',
  ])
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.equal(manifest.dsh.client.immediately, undefined,
    'ordinary feature plugins do not use the stage-one preload mark')
  assert.equal(manifest.exports['./client'], './client.js')
  assert.equal(manifest.exports['./package.json'], './package.json')
})

test('the active Session is resolved through the public binding and projection faces', async () => {
  // The root UI binding is exposed by `uiSession.adapter.current`; the Session
  // Controller then exposes its projections through `sessions.binding(id)`.
  const { mounted, comboFace } = mountCombo({ combo: { combo: 0, tool: '' } })
  await settle()
  comboFace.set({ combo: 4, tool: 'read' })
  mounted.update()
  assert.equal(hud(mounted)?.attributes['data-dsh-combo-score'], '4',
    'a binding read through the wrong field leaves the HUD permanently empty')
})

test('one tool call paints "1×" in the calm tier', async () => {
  const { mounted, comboFace } = mountCombo({ combo: { combo: 0, tool: '' } })
  await settle()
  comboFace.set({ combo: 1, tool: 'read' })
  mounted.update()
  const root = hud(mounted)
  assert.ok(root, 'the HUD must appear at combo 1')
  assert.equal(root.attributes['data-dsh-combo'], 'calm')
  assert.equal(nestedText(badge(mounted)), '1×')
  assert.ok(toolLabel(mounted), 'the current tool name is shown')
  assert.equal(ownText(toolLabel(mounted)), 'read')
})

test('tier thresholds match the spec', async () => {
  const cases = [
    [4, 'calm', '4×'],
    [5, 'calm', '5×'],
    [9, 'calm', '9×'],
    [10, 'warm', '10×'],
    [19, 'warm', '19×'],
    [20, 'hot', '20×'],
    [49, 'hot', '49×'],
    [50, 'blaze', '50×'],
    [53, 'blaze', '53×'],
  ]
  for (const [score, tier, text] of cases) {
    const { mounted, comboFace } = mountCombo({ combo: { combo: score - 1, tool: 'bash' } })
    await settle()
    comboFace.set({ combo: score, tool: 'bash' })
    mounted.update()
    const root = hud(mounted)
    assert.equal(root.attributes['data-dsh-combo'], tier, `combo ${score} picks tier ${tier}`)
    assert.equal(root.attributes['data-dsh-combo-score'], String(score))
    assert.equal(nestedText(badge(mounted)), text, `combo ${score} renders its number`)
    const number = badge(mounted).children[0]
    assert.equal(number.style.fontSize, score >= 50 ? '68px' : score >= 20 ? '64px' : score >= 10 ? '60px' : '56px',
      `combo ${score} scales the number with its tier`)
  }
})

test('each increment restarts the pop animation', async () => {
  const { mounted, comboFace } = mountCombo({ combo: { combo: 0, tool: '' } })
  await settle()
  comboFace.set({ combo: 1, tool: 'read' })
  mounted.update()
  const first = badge(mounted).style.animation
  comboFace.set({ combo: 2, tool: 'grep' })
  mounted.update()
  const next = badge(mounted).style.animation
  assert.notEqual(first, next, 'the animation must be re-triggered by a new name')
  assert.match(next, /^dshcombo-pop-2/)
  const gain = gainLabel(mounted)
  assert.ok(gain, 'the +1 float is rendered')
  assert.equal(ownText(gain), '+1 grep')
})

test('motion names cycle through a bounded ring however long the run', async () => {
  // The keyframe sheet is rendered once, so a long run must reuse names rather
  // than mint a new keyframe per call.
  const { mounted, comboFace } = mountCombo({ combo: { combo: 0, tool: '' } })
  await settle()
  for (let score = 1; score <= 40; score += 1) {
    comboFace.set({ combo: score, tool: 'bash' })
    mounted.update()
  }
  const styles = findAll(mounted, (node) => node.type === 'style')
  assert.equal(styles.length, 1)
  const sheet = styles[0].children.map((child) => child.value ?? '').join('')
  const names = new Set([...sheet.matchAll(/@keyframes ([a-z0-9-]+)/g)].map((match) => match[1]))
  assert.equal(names.size, 73, 'nine bounded animation families plus one countdown')
  assert.match(badge(mounted).style.animation, /^dshcombo-pop-0/, 'score 40 wraps into the ring')
})

test('parallel calls land as one jump of +N', async () => {
  const { mounted, comboFace } = mountCombo({ combo: { combo: 7, tool: 'read' } })
  await settle()
  comboFace.set({ combo: 10, tool: 'bash' })
  mounted.update()
  assert.equal(ownText(gainLabel(mounted)), '+3 bash')
})

test('the finished run is offered for keeping, then fades', async () => {
  const { mounted, comboFace } = mountCombo({ config: { pinPromptMs: 40 }, combo: { combo: 6, tool: 'edit' } })
  await settle()
  comboFace.set({ combo: 0, tool: '' })
  mounted.update()
  const root = hud(mounted)
  assert.ok(root, 'the keep-prompt keeps a finished run on screen for a moment')
  assert.equal(root.attributes['data-dsh-combo-ghost'], 'true')
  assert.equal(root.attributes['data-dsh-combo-score'], '6')
  assert.equal(badge(mounted).style.opacity, 0.55, 'the prompt is deliberately quiet')
  assert.ok(pinButton(mounted), 'the prompt carries the pin control')
  await wait(90)
  mounted.update()
  assert.equal(hud(mounted), undefined, 'and then it is gone')
})

test('a one-call run is not worth offering to keep', async () => {
  const { mounted, comboFace } = mountCombo({ combo: { combo: 1, tool: 'read' } })
  await settle()
  comboFace.set({ combo: 0, tool: '' })
  mounted.update()
  assert.equal(hud(mounted), undefined)
})

test('pinPromptMs: 0 drops the keep-prompt entirely', async () => {
  const { mounted, comboFace } = mountCombo({ config: { pinPromptMs: 0 }, combo: { combo: 9, tool: 'bash' } })
  await settle()
  comboFace.set({ combo: 0, tool: '' })
  mounted.update()
  assert.equal(hud(mounted), undefined)
})

test('a pinned streak survives the turn boundary and keeps accumulating', async () => {
  const { mounted, comboFace } = mountCombo({ combo: { combo: 12, tool: 'edit' } })
  await settle()
  comboFace.set({ combo: 0, tool: '' })
  mounted.update()
  clickPin(mounted)

  let root = hud(mounted)
  assert.equal(root.attributes['data-dsh-combo-pinned'], 'true')
  assert.equal(root.attributes['data-dsh-combo-score'], '12', 'pinning adopts the finished run')

  // The next turn continues the streak instead of restarting it.
  comboFace.set({ combo: 1, tool: 'read' })
  mounted.update()
  root = hud(mounted)
  assert.equal(root.attributes['data-dsh-combo-score'], '13', 'the streak continues across turns')
  assert.equal(root.attributes['data-dsh-combo-ghost'], 'false')
  assert.equal(root.attributes['data-dsh-combo'], 'warm', 'the kept streak drives the tier')

  comboFace.set({ combo: 2, tool: 'grep' })
  mounted.update()
  assert.equal(hud(mounted).attributes['data-dsh-combo-score'], '14')

  // And a later boundary folds the new run in rather than dropping it.
  comboFace.set({ combo: 0, tool: '' })
  mounted.update()
  assert.equal(hud(mounted).attributes['data-dsh-combo-score'], '14', 'the kept streak survives another turn end')
})

test('unpinning clears the kept streak', async () => {
  const storage = fakeStorage()
  const { mounted, comboFace } = mountCombo({ storage, combo: { combo: 5, tool: 'bash' } })
  await settle()
  clickPin(mounted)
  assert.equal(hud(mounted).attributes['data-dsh-combo-score'], '5')
  assert.equal(storage.keys().length, 1, 'the pin is persisted per session')

  comboFace.set({ combo: 0, tool: '' })
  mounted.update()
  assert.equal(hud(mounted).attributes['data-dsh-combo-score'], '5')

  clickPin(mounted)
  assert.equal(hud(mounted), undefined, 'clearing drops the streak and the idle run paints nothing')
  assert.equal(storage.keys().length, 0, 'an idle pin leaves no trace in storage')
})

test('a kept streak is remembered across a remount', async () => {
  const storage = fakeStorage()
  const first = mountCombo({ storage, combo: { combo: 8, tool: 'edit' } })
  await settle()
  clickPin(first.mounted)
  assert.equal(hud(first.mounted).attributes['data-dsh-combo-pinned'], 'true')

  // A fresh page load: same session, same storage, the same live run.
  const second = mountCombo({ storage, combo: { combo: 8, tool: 'edit' } })
  await settle()
  const root = hud(second.mounted)
  assert.ok(root, 'the kept streak is still on screen after a reload')
  assert.equal(root.attributes['data-dsh-combo-pinned'], 'true')
  assert.equal(root.attributes['data-dsh-combo-score'], '8', 'the live run is not counted twice')
  assert.equal(root.attributes['data-dsh-combo'], 'calm', '8 keeps its own tier')
})

test('a run that ended while the page was away is folded into the streak', async () => {
  const storage = fakeStorage()
  const first = mountCombo({ storage, combo: { combo: 8, tool: 'edit' } })
  await settle()
  clickPin(first.mounted)

  // The page comes back on a *new* run: the Host reports 1, so the 8 that
  // finished while nobody was watching must be folded in, not lost.
  const second = mountCombo({ storage, combo: { combo: 1, tool: 'bash' } })
  await settle()
  assert.equal(hud(second.mounted).attributes['data-dsh-combo-score'], '9')
})

test('a kept streak belongs to its own conversation', async () => {
  const storage = fakeStorage()
  const { mounted, comboFace, current, faceOf } = mountCombo({ storage, combo: { combo: 6, tool: 'edit' } })
  await settle()
  clickPin(mounted)
  assert.equal(hud(mounted).attributes['data-dsh-combo-score'], '6')

  // Another conversation must not inherit the streak it never earned.
  current.activate('session-2')
  mounted.update()
  assert.equal(hud(mounted), undefined, 'session-2 has counted nothing yet')

  faceOf('session-2').set({ combo: 3, tool: 'bash' })
  mounted.update()
  const other = hud(mounted)
  assert.equal(other.attributes['data-dsh-combo-pinned'], 'false')
  assert.equal(other.attributes['data-dsh-combo-score'], '3')

  // And going back restores the kept streak, still persisted.
  current.activate('session-1')
  mounted.update()
  const back = hud(mounted)
  assert.equal(back.attributes['data-dsh-combo-pinned'], 'true')
  assert.equal(back.attributes['data-dsh-combo-score'], '6')
})

test('switching conversation offers no keep-prompt', async () => {
  const { mounted, current } = mountCombo({ combo: { combo: 9, tool: 'bash' } })
  await settle()
  assert.equal(hud(mounted).attributes['data-dsh-combo-score'], '9')

  current.activate('session-2')
  mounted.update()
  assert.equal(hud(mounted), undefined, 'a conversation change is not a finished run')
})

test('adopting a conversation that already has calls is not an increment', async () => {
  const { mounted, current, faceOf } = mountCombo({ combo: { combo: 9, tool: 'bash' } })
  await settle()
  // Calls that happened before this conversation was opened are not increments
  // we watched: adopting it must not pop a "+N" or read the switch as a reset.
  faceOf('session-2').set({ combo: 2, tool: 'read' })
  current.activate('session-2')
  mounted.update()
  assert.equal(gainLabel(mounted), undefined, 'adopting a conversation is not an increment')
  assert.equal(hud(mounted).attributes['data-dsh-combo-score'], '2')
})

test('a corrupt or foreign pin record never breaks the HUD', async () => {  const storage = fakeStorage()
  storage.setItem('dsh-combo:pin:session-1', '{not json')
  const { mounted, comboFace } = mountCombo({ storage, combo: { combo: 3, tool: 'read' } })
  await settle()
  assert.equal(hud(mounted).attributes['data-dsh-combo-pinned'], 'false')
  comboFace.set({ combo: 4, tool: 'read' })
  mounted.update()
  assert.equal(hud(mounted).attributes['data-dsh-combo-score'], '4')
})

test('an idle break hides an abandoned combo, and a new call brings it back', async () => {
  const { mounted, comboFace } = mountCombo({ config: { expireMs: 40 }, combo: { combo: 5, tool: 'bash' } })
  await settle()
  assert.ok(hud(mounted), 'the combo is live')
  await wait(90)
  mounted.update()
  assert.equal(hud(mounted), undefined, 'the idle break retires the abandoned number')

  comboFace.set({ combo: 1, tool: 'read' })
  mounted.update()
  assert.ok(hud(mounted), 'the next call starts a fresh visible run')
})

test('expireMs: 0 (the default) never retires a combo', async () => {
  const { mounted } = mountCombo({ combo: { combo: 7, tool: 'bash' } })
  await settle()
  await wait(60)
  mounted.update()
  assert.ok(hud(mounted))
})

test('a kept streak is exempt from the idle break', async () => {
  const { mounted } = mountCombo({ config: { expireMs: 40 }, combo: { combo: 9, tool: 'bash' } })
  await settle()
  clickPin(mounted)
  await wait(90)
  mounted.update()
  const root = hud(mounted)
  assert.ok(root, 'a pin says "do not drop this", so the idle break yields')
  assert.equal(root.attributes['data-dsh-combo-score'], '9')
})

test('sound stays silent unless it is switched on', async () => {
  const audio = fakeAudio()
  const previous = globalThis.AudioContext
  globalThis.AudioContext = audio.Ctor
  try {
    const { mounted, comboFace } = mountCombo({ combo: { combo: 20, tool: 'bash' } })
    await settle()
    comboFace.set({ combo: 21, tool: 'bash' })
    mounted.update()
    assert.equal(audio.played.length, 0, 'sound defaults to off')
  } finally {
    globalThis.AudioContext = previous
  }
})

test('sound plays from soundFrom upward, with a rising pitch', async () => {
  const audio = fakeAudio()
  const previous = globalThis.AudioContext
  globalThis.AudioContext = audio.Ctor
  try {
    const { mounted, comboFace } = mountCombo({
      config: { sound: true, soundFrom: 10, soundVolume: 0.5 },
      combo: { combo: 8, tool: 'bash' },
    })
    await settle()
    comboFace.set({ combo: 9, tool: 'bash' })
    mounted.update()
    assert.equal(audio.played.length, 0, 'nothing below the threshold')

    comboFace.set({ combo: 10, tool: 'bash' })
    mounted.update()
    assert.equal(audio.played.length, 1, 'the crossing call beeps')
    comboFace.set({ combo: 12, tool: 'bash' })
    mounted.update()
    assert.equal(audio.played.length, 2)
    assert.ok(audio.played[1].hz > audio.played[0].hz, 'pitch rises with the combo')
    assert.ok(audio.played[1].hz < 2000, 'and stays inside a bearable band')
  } finally {
    globalThis.AudioContext = previous
  }
})

test('soundFrom: 0 beeps from the very first call, and volume 0 is silence', async () => {
  const audio = fakeAudio()
  const previous = globalThis.AudioContext
  globalThis.AudioContext = audio.Ctor
  try {
    const loud = mountCombo({ config: { sound: true, soundFrom: 0 }, combo: { combo: 0, tool: '' } })
    await settle()
    loud.comboFace.set({ combo: 1, tool: 'read' })
    loud.mounted.update()
    assert.equal(audio.played.length, 1)

    const muted = mountCombo({ config: { sound: true, soundFrom: 0, soundVolume: 0 }, combo: { combo: 0, tool: '' } })
    await settle()
    muted.comboFace.set({ combo: 1, tool: 'read' })
    muted.mounted.update()
    assert.equal(audio.played.length, 1, 'a zero volume is not a blip')
  } finally {
    globalThis.AudioContext = previous
  }
})

test('a missing AudioContext is not fatal', async () => {
  const previous = globalThis.AudioContext
  const previousWebkit = globalThis.webkitAudioContext
  delete globalThis.AudioContext
  delete globalThis.webkitAudioContext
  try {
    const { mounted, comboFace } = mountCombo({ config: { sound: true }, combo: { combo: 9, tool: 'bash' } })
    await settle()
    comboFace.set({ combo: 10, tool: 'bash' })
    mounted.update()
    assert.ok(hud(mounted), 'the HUD still paints without an audio stack')
  } finally {
    globalThis.AudioContext = previous
    if (previousWebkit !== undefined) globalThis.webkitAudioContext = previousWebkit
  }
})

test('the HUD panel carries the sound controls, and 试听 auditions while sound is off', async () => {
  const audio = fakeAudio()
  const storage = fakeStorage()
  const previous = globalThis.AudioContext
  globalThis.AudioContext = audio.Ctor
  try {
    const fixture = mountCombo({ storage, config: { sound: false, soundFrom: 4, soundVolume: 0.5 }, combo: { combo: 2, tool: 'read' } })
    await settle()
    const setting = key => findAll(fixture.mounted, node => node.attributes?.['data-dsh-combo-setting'] === key)[0]

    const preview = setting('soundPreview')
    assert.ok(preview, 'the panel offers a 试听 control')
    preview.props.onClick()
    assert.equal(audio.played.length, 1, '试听 plays one blip even while the switch is off')
    assert.equal(audio.played[0].hz, 240 * Math.pow(2, 4 / 24), 'auditioned at the configured starting combo')

    setting('sound').props.onChange({ target: { checked: true } })
    fixture.mounted.update()
    fixture.comboFace.set({ combo: 3, tool: 'read' })
    fixture.mounted.update()
    assert.equal(audio.played.length, 1, 'below soundFrom stays silent')
    fixture.comboFace.set({ combo: 4, tool: 'read' })
    fixture.mounted.update()
    assert.equal(audio.played.length, 2, 'the crossing call beeps')
    assert.ok(storage.getItem('dsh-combo:appearance').includes('"sound":true'), 'the switch is kept locally')

    const reload = mountCombo({ storage, config: { sound: false, soundFrom: 4, soundVolume: 0.5 }, combo: { combo: 4, tool: 'read' } })
    await settle()
    reload.comboFace.set({ combo: 5, tool: 'read' })
    reload.mounted.update()
    assert.equal(audio.played.length, 3, 'the locally kept switch still beeps after a reload')
  } finally {
    globalThis.AudioContext = previous
  }
})

test('the configuration page appears only while the Host serves the namespace', async () => {
  const unserved = mountCombo({ form: fakeForm(), served: false, combo: { combo: 2, tool: 'read' } })
  await settle()
  assert.equal(unserved.settingsPage, null, 'no page while the namespace is unserved')

  const served = mountCombo({ form: fakeForm(), combo: { combo: 2, tool: 'read' } })
  await settle()
  assert.equal(typeof served.settingsPage, 'function', 'the page registers once the namespace is served')
  assert.ok(hud(served.mounted), 'the HUD keeps running either way')
})

test('the configuration page writes through the Host form and drops the local override', async () => {
  const storage = fakeStorage()
  storage.setItem('dsh-combo:appearance', JSON.stringify({ sound: false, scale: 1.5 }))
  const form = fakeForm({ value: { sound: false, soundFrom: 4, soundVolume: 0.5, enabled: true }, revision: 3 })
  const fixture = mountCombo({ storage, form, combo: { combo: 2, tool: 'read' } })
  await settle()
  const page = React.mount(React.createElement(fixture.settingsPage, { form }))
  const setting = key => page.all().filter(node => node.attributes?.['data-dsh-combo-setting'] === key)[0]

  assert.equal(setting('sound').props.checked, false, 'the page shows the served value')
  assert.equal(setting('soundFrom').props.value, 4)
  setting('sound').props.onChange({ target: { checked: true } })
  await settle()
  page.update()

  assert.deepEqual(form.writes, [{ ops: [{ op: 'set', path: ['sound'], value: true }], revision: 3 }],
    'the write is revision-fenced and shaped as the Host expects')
  const notice = page.all().filter(node => node.attributes?.['data-dsh-combo-notice'] !== undefined)[0]
  assert.equal(notice.attributes['data-dsh-combo-notice'], 'ok')
  const stored = JSON.parse(storage.getItem('dsh-combo:appearance'))
  assert.equal(Object.hasOwn(stored, 'sound'), false, 'a saved key leaves the per-browser quick tune')
  assert.equal(stored.scale, 1.5, 'other quick-tune keys stay')
})

test('the configuration page reports a refused write instead of pretending to save', async () => {
  const form = fakeForm({ value: { sound: false }, refuse: true })
  const fixture = mountCombo({ form, combo: { combo: 2, tool: 'read' } })
  await settle()
  const page = React.mount(React.createElement(fixture.settingsPage, { form }))
  const setting = key => page.all().filter(node => node.attributes?.['data-dsh-combo-setting'] === key)[0]

  setting('sound').props.onChange({ target: { checked: true } })
  await settle()
  page.update()
  const notice = page.all().filter(node => node.attributes?.['data-dsh-combo-notice'] !== undefined)[0]
  assert.equal(notice.attributes['data-dsh-combo-notice'], 'error')
})

test('the configuration page splits the excluded-tool list into an array', async () => {
  const form = fakeForm({ value: { excludeTools: [] } })
  const fixture = mountCombo({ form, combo: { combo: 2, tool: 'read' } })
  await settle()
  const page = React.mount(React.createElement(fixture.settingsPage, { form }))
  const setting = key => page.all().filter(node => node.attributes?.['data-dsh-combo-setting'] === key)[0]

  setting('excludeTools').props.onChange({ target: { value: 'todo_write, bash  edit' } })
  await settle()
  assert.deepEqual(form.writes.at(-1).ops, [{
    op: 'set',
    path: ['excludeTools'],
    value: ['todo_write', 'bash', 'edit'],
  }])
})

test('config controls placement, the tool name and particles', async () => {
  const { mounted, comboFace } = mountCombo({
    config: { showToolName: false, animation: 'off', position: 'bottom-left' },
    combo: { combo: 30, tool: 'bash' },
  })
  await settle()
  const container = hud(mounted)
  assert.equal(badge(mounted).style.animation, 'none', 'animation: off drops the pop')
  assert.equal(container.style.left, '18px')
  assert.equal(container.style.right, 'auto')
  assert.equal(container.style.bottom.startsWith('calc(18px'), true, 'bottom-left docks to the lower corner')
  assert.equal(toolLabel(mounted), undefined, 'showToolName false hides the tool')
  comboFace.set({ combo: 31, tool: 'bash' })
  mounted.update()
  assert.equal(burst(mounted).length, 0, 'animation: off drops particles')
})

test('spark bursts start on each tool call and grow with combo tier', async () => {
  const { mounted, comboFace } = mountCombo({ combo: { combo: 1, tool: 'read' } })
  await settle()
  comboFace.set({ combo: 19, tool: 'read' })
  mounted.update()
  assert.equal(sparks(mounted).length, 13, 'the warm tier gets a light burst')
  comboFace.set({ combo: 20, tool: 'read' })
  mounted.update()
  assert.equal(sparks(mounted).length, 17, 'the hot tier gets a denser burst')
})

test('the HUD never swallows clicks, but its pin control accepts them', async () => {
  const { mounted } = mountCombo({ combo: { combo: 4, tool: 'read' } })
  await settle()
  assert.equal(hud(mounted).style.pointerEvents, 'none')
  assert.equal(pinButton(mounted).style.pointerEvents, 'auto')
})

test('enabled: false renders nothing even at a high combo', async () => {
  const { mounted } = mountCombo({ config: { enabled: false }, combo: { combo: 42, tool: 'bash' } })
  await settle()
  assert.equal(hud(mounted), undefined)
})

test('the HUD falls back to defaults when the config route fails', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('offline') }
  let mounted = null
  let comboFace = null
  try {
    ({ mounted, comboFace } = mountCombo({ combo: { combo: 0, tool: '' } }))
    await settle()
  } finally {
    globalThis.fetch = previousFetch
  }
  comboFace.set({ combo: 3, tool: 'read' })
  mounted.update()
  assert.equal(hud(mounted).attributes['data-dsh-combo'], 'calm', 'defaults keep the HUD alive')
  assert.equal(nestedText(badge(mounted)), '3×')
  comboFace.set({ combo: 0, tool: '' })
  mounted.update()
  assert.equal(hud(mounted).attributes['data-dsh-combo-ghost'], 'true', 'defaults still offer the finished run')
})


test('presets switch immediately, preserve the score and survive a reload', async () => {
  const storage = fakeStorage()
  const { mounted, comboFace } = mountCombo({ storage, combo: { combo: 7, tool: 'read' } })
  await settle()
  const selector = () => findAll(mounted, node => node.attributes?.['data-dsh-combo-preset-select'] !== undefined)[0]
  for (const preset of ['flames', 'fireworks', 'rift', 'particles']) {
    selector().props.onChange({ target: { value: preset } })
    mounted.update()
    assert.equal(hud(mounted).attributes['data-dsh-combo-preset'], preset)
    assert.equal(hud(mounted).attributes['data-dsh-combo-score'], '7')
    assert.equal(burst(mounted)[0].attributes['data-dsh-combo-effect'], preset)
  }
  selector().props.onChange({ target: { value: 'rift' } })
  mounted.update()
  comboFace.set({ combo: 8, tool: 'bash' })
  mounted.update()
  assert.equal(burst(mounted)[0].attributes['data-dsh-combo-effect'], 'rift')
  const reload = mountCombo({ storage, combo: { combo: 8, tool: 'bash' } })
  await settle()
  assert.equal(hud(reload.mounted).attributes['data-dsh-combo-preset'], 'rift')
})

test('config selects the default preset and ignores corrupt saved preferences', async () => {
  const storage = fakeStorage()
  storage.setItem('dsh-combo:preset', 'invalid')
  const { mounted, comboFace } = mountCombo({ storage, config: { preset: 'fireworks', particles: false }, combo: { combo: 7, tool: 'read' } })
  await settle()
  assert.equal(hud(mounted).attributes['data-dsh-combo-preset'], 'fireworks')
  const selector = findAll(mounted, node => node.attributes?.['data-dsh-combo-preset-select'] !== undefined)[0]
  selector.props.onChange({ target: { value: 'flames' } })
  mounted.update()
  comboFace.set({ combo: 8, tool: 'read' })
  mounted.update()
  assert.equal(burst(mounted).length, 0, 'particles: false also suppresses preset previews')
})


test('countdown refills on calls, retains its deadline on preset and appearance changes', async () => {
  const { mounted, comboFace } = mountCombo({ config: { timerMs: 2000 }, combo: { combo: 0, tool: '' } })
  await settle()
  const bar = () => findAll(mounted, node => node.attributes?.['data-dsh-combo-bar'] !== undefined)[0]
  const setting = key => findAll(mounted, node => node.attributes?.['data-dsh-combo-setting'] === key)[0]
  const at = Date.now()
  comboFace.set({ combo: 1, tool: 'read', changedAt: at })
  mounted.update()
  assert.equal(bar().attributes['data-dsh-combo-timer-start'], at)
  assert.equal(bar().style.animation, 'dshcombo-countdown 2000ms linear forwards')
  await wait(20)
  const selector = findAll(mounted, node => node.attributes?.['data-dsh-combo-preset-select'] !== undefined)[0]
  selector.props.onChange({ target: { value: 'fireworks' } })
  mounted.update()
  assert.equal(bar().attributes['data-dsh-combo-timer-start'], at, 'preset preview must not refill the timer')
  const delay = bar().style.animationDelay
  setting('glow').props.onChange({ target: { value: '1.5' } })
  mounted.update()
  assert.equal(bar().style.animationDelay, delay, 'a running animation must not subtract elapsed time twice')
  const next = Date.now()
  comboFace.set({ combo: 2, tool: 'bash', changedAt: next })
  mounted.update()
  assert.equal(bar().attributes['data-dsh-combo-timer-start'], next)
  setting('showTimer').props.onChange({ target: { checked: false } })
  mounted.update()
  assert.equal(bar(), undefined)
  assert.equal(hud(mounted).attributes['data-dsh-combo-score'], '2')
})

test('power threshold and frequency gate effects without changing the count', async () => {
  const { mounted, comboFace } = mountCombo({ config: { powerThreshold: 5, effectFrequency: 2 }, combo: { combo: 0, tool: '' } })
  await settle()
  for (const score of [1, 2, 3, 4, 5]) { comboFace.set({ combo: score, tool: 'read' }); mounted.update() }
  assert.equal(burst(mounted).length, 0)
  comboFace.set({ combo: 6, tool: 'read' }); mounted.update()
  assert.equal(burst(mounted).length, 1)
  comboFace.set({ combo: 9, tool: 'read' }); mounted.update()
  assert.equal(hud(mounted).attributes['data-dsh-combo-score'], '9', 'batched calls still count fully')
  assert.equal(burst(mounted).length, 1, 'a jump crossing a frequency boundary triggers an effect')
})

test('appearance settings persist and resetting restores host defaults', async () => {
  const storage = fakeStorage()
  const fixture = mountCombo({ storage, combo: { combo: 7, tool: 'read' } })
  await settle()
  const setting = key => findAll(fixture.mounted, node => node.attributes?.['data-dsh-combo-setting'] === key)[0]
  setting('particleCount').props.onChange({ target: { value: '32' } })
  fixture.mounted.update()
  setting('accentColor').props.onChange({ target: { value: '#ab1256' } })
  fixture.mounted.update()
  const reload = mountCombo({ storage, combo: { combo: 7, tool: 'read' } })
  await settle()
  reload.comboFace.set({ combo: 8, tool: 'read' }); reload.mounted.update()
  assert.equal(sparks(reload.mounted).length, 32)
  assert.equal(sparks(reload.mounted)[1].style.background, '#ab1256')
  const reset = findAll(reload.mounted, node => node.type === 'button' && ownText(node) === '恢复默认设置')[0]
  reset.props.onClick(); reload.mounted.update()
  reload.comboFace.set({ combo: 9, tool: 'read' }); reload.mounted.update()
  assert.equal(sparks(reload.mounted).length, 10)
  assert.equal(storage.getItem('dsh-combo:appearance'), null)
})

test('restoring an old conversation uses its original countdown timestamp', async () => {
  const at = Date.now() - 10000
  const { mounted } = mountCombo({ config: { timerMs: 2000, animation: 'off' }, combo: { combo: 7, tool: 'read', changedAt: at } })
  await settle()
  const bar = findAll(mounted, node => node.attributes?.['data-dsh-combo-bar'] !== undefined)[0]
  assert.equal(bar.style.animationDelay, '-2000ms', 'a stale combo must not get a new full timer')
  assert.equal(bar.style.animation, 'dshcombo-countdown 2000ms linear forwards', 'functional timer remains when feedback motion is off')
})
