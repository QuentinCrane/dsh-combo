/**
 * Local harness — Host half.
 *
 * Verifies the combo fold and the wire view without booting DSH:
 *   node --test test/host.test.mjs
 *
 * `@deepseek-ai/schemastery` is shimmed through test/loader.mjs; the fold logic
 * itself is imported from the real plugin entry.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, foldCombo, publicConfig, toComboView, ComboViewSchema, CONFIG_DEFAULTS } from '../index.js'

const call = (name, time = 1000) => ({ type: 'tool/call', data: { callId: `c-${name}-${time}`, name }, time })
const boundary = (type, surfaceOp = 'append') => ({ type, surfaceOp })
const idle = () => ({ combo: 0, tool: '', lastCallAt: 0, updatedAt: 0 })

test('one tool call is exactly +1 combo', () => {
  let state = idle()
  state = foldCombo(state, call('read'))
  assert.equal(state.combo, 1)
  assert.equal(state.tool, 'read')
  state = foldCombo(state, call('grep'))
  assert.equal(state.combo, 2)
  assert.equal(state.tool, 'grep')
})

test('tool results never count (only tool/call does)', () => {
  const state = { combo: 3, tool: 'bash', lastCallAt: 5, updatedAt: 3 }
  const result = { type: 'tool/result', data: { message: { source: { callId: 'c-1' } } } }
  assert.equal(foldCombo(state, result), state, 'unchanged state must keep its reference')
})

test('turn/end closes the combo and turn/start begins a fresh one', () => {
  let state = { combo: 4, tool: 'edit', lastCallAt: 9, updatedAt: 4 }
  state = foldCombo(state, boundary('turn/end'))
  assert.deepEqual({ combo: state.combo, tool: state.tool }, { combo: 0, tool: '' })
  assert.equal(foldCombo(state, boundary('turn/end')), state, 'a closed combo is already idle')
  state = foldCombo(state, call('bash'))
  assert.equal(state.combo, 1)
  state = foldCombo(state, boundary('turn/start'))
  assert.equal(state.combo, 0)
})

test('a replaced (non-append) boundary is not a fresh turn', () => {
  const state = { combo: 7, tool: 'bash', lastCallAt: 1, updatedAt: 7 }
  assert.equal(foldCombo(state, boundary('turn/end', 'replace')), state)
  assert.equal(foldCombo(state, boundary('turn/start', 'delete')), state)
})

test('thinking between calls never breaks a combo (turn-based, not time-based)', () => {
  let state = idle()
  state = foldCombo(state, call('read', 1000))
  for (const type of ['assistant/live-chunk', 'assistant/message', 'step/start', 'user/message']) {
    const next = foldCombo(state, { type, time: 60_000 })
    assert.equal(next, state, `${type} must not touch the combo`)
  }
  state = foldCombo(state, call('bash', 90_000))
  assert.equal(state.combo, 2)
})

test('an opted-in idle break restarts the run after a long gap', () => {
  const options = { expireMs: 30_000 }
  let state = idle()
  state = foldCombo(state, call('read', 1_000), options)
  state = foldCombo(state, call('grep', 5_000), options)
  assert.equal(state.combo, 2, 'a gap inside the window keeps the run')

  state = foldCombo(state, call('bash', 40_000), options)
  assert.equal(state.combo, 1, 'the first call after the gap opens a fresh run')
  assert.equal(state.tool, 'bash')
  assert.equal(state.lastCallAt, 40_000, 'the new run is anchored at the late call')
  assert.equal(state.updatedAt, 3, 'one bump per counting call')
})

test('the idle window is exclusive and never fires on an empty combo', () => {
  const options = { expireMs: 1_000 }
  let state = idle()
  // A first call always opens the run: there is no previous call to be far from.
  state = foldCombo(state, call('read', 500_000), options)
  assert.equal(state.combo, 1)
  // Exactly at the boundary the run still holds; one millisecond later it breaks.
  state = foldCombo(state, call('grep', 501_000), options)
  assert.equal(state.combo, 2)
  state = foldCombo(state, call('bash', 502_001), options)
  assert.equal(state.combo, 1)
})

test('expireMs 0 (the default) keeps the combo purely turn-based', () => {
  let state = idle()
  state = foldCombo(state, call('read', 1), { expireMs: 0 })
  state = foldCombo(state, call('grep', 10_000_000), { expireMs: 0 })
  assert.equal(state.combo, 2)
  // And an absent option behaves the same as an explicit 0.
  assert.equal(foldCombo(state, call('bash', 20_000_000)).combo, 3)
})

test('excluded tools do not raise the combo', () => {
  const options = { excluded: new Set(['todo_write']) }
  const state = { combo: 2, tool: 'read', lastCallAt: 0, updatedAt: 2 }
  assert.equal(foldCombo(state, call('todo_write'), options), state)
  assert.equal(foldCombo(state, call('bash'), options).combo, 3)
})

test('an excluded tool does not count as the gap that breaks a run', () => {
  // Exclusion must be decided before the idle check touches lastCallAt.
  const options = { excluded: new Set(['todo_write']), expireMs: 1_000 }
  const state = { combo: 2, tool: 'read', lastCallAt: 0, updatedAt: 2 }
  assert.equal(foldCombo(state, call('todo_write', 900_000), options), state)
})

test('parallel tool calls in one step land as a run of +1s', () => {
  let state = { combo: 4, tool: '', lastCallAt: 0, updatedAt: 0 }
  for (const name of ['read', 'grep', 'bash']) state = foldCombo(state, call(name))
  assert.equal(state.combo, 7)
  assert.equal(state.tool, 'bash', 'the last call names the current tool')
})

test('the wire view carries only what the HUD needs', () => {
  const state = { combo: 12, tool: 'edit', lastCallAt: 4242, updatedAt: 12 }
  assert.deepEqual(toComboView(state), { combo: 12, tool: 'edit', changedAt: 4242 })
  assert.deepEqual(ComboViewSchema.parse(toComboView(state)), { combo: 12, tool: 'edit', changedAt: 4242 })
})

test('the wire validator normalizes anything the carrier might hand it', () => {
  assert.deepEqual(ComboViewSchema.parse(undefined), { combo: 0, tool: '', changedAt: 0 })
  assert.deepEqual(ComboViewSchema.parse({ combo: 'x', tool: 7, changedAt: null }), { combo: 0, tool: '', changedAt: 0 })
  assert.deepEqual(ComboViewSchema.parse({ combo: NaN, tool: ' bash ', changedAt: 5 }), { combo: 0, tool: ' bash ', changedAt: 5 })
})

test('apply() declares a view validator for the carrier', () => {
  const units = []
  apply({
    config: undefined,
    sessionProjections: { register: (definition) => units.push(definition) },
    inject: () => {},
  })
  assert.equal(typeof units[0].wire.viewSchema.parse, 'function', 'the carrier calls viewSchema.parse on every value')
})

test('apply() registers one projection unit and one config route', () => {
  const units = []
  const routes = []
  const effects = []
  const ctx = {
    config: undefined,
    sessionProjections: { register: (definition) => units.push(definition) },
    inject: (services, callback) => callback({
      effect: (factory) => effects.push({ services, value: factory() }),
      webServer: { register: (route) => routes.push(route) },
    }),
  }
  apply(ctx)

  assert.equal(units.length, 1)
  assert.equal(units[0].key, 'dshCombo')
  assert.equal(units[0].stateVersion, 2)
  const configRoute = routes.find((route) => route.path === '/dsh-combo/config')
  assert.ok(configRoute, 'the config route is registered')
  assert.equal(configRoute.kind, 'exact')
  assert.equal(effects.filter((entry) => entry.services.includes('webServer')).length, routes.length,
    'every route is owned by its own effect')

  // The unit drives exactly like the framework drives it.
  let state = units[0].init()
  state = units[0].apply(state, call('read'))
  state = units[0].apply(state, call('edit'))
  assert.deepEqual(units[0].wire.view(state), { combo: 2, tool: 'edit', changedAt: 1000 })
  state = units[0].apply(state, boundary('turn/end'))
  assert.deepEqual(units[0].wire.view(state), { combo: 0, tool: '', changedAt: 1000 })
})

test('apply() withdraws the auto-generated settings form for its own page', () => {
  const configured = []
  const fiber = { uid: 7 }
  const childFiber = { uid: 8 }
  apply({
    config: undefined,
    fiber,
    sessionProjections: { register: () => {} },
    inject: (services, callback) => {
      if (!services.includes('settings')) return
      callback({
        // The child injection has its own fiber; the policy must name the plugin's.
        fiber: childFiber,
        effect: (factory) => factory(),
        settings: { configure: (presentation, owner) => configured.push({ presentation, owner }) },
      })
    },
  })
  assert.deepEqual(configured, [{ presentation: { auto: false }, owner: fiber }],
    'the Plugins page owns the form, so Settings must not auto-generate one')
})

test('a settings write reaches the live values without remounting', () => {
  const routes = []
  // One mutable config object, exactly as the Loader commits volatile fields.
  const config = { sound: false, soundVolume: 0.35, timerMs: 4_000 }
  apply({
    config,
    sessionProjections: { register: () => {} },
    inject: (services, callback) => callback({
      effect: (factory) => factory(),
      webServer: { register: (route) => routes.push(route) },
    }),
  })
  const route = routes.find((entry) => entry.path === '/dsh-combo/config')
  const read = () => {
    let body = ''
    route.handler({}, { writeHead: () => {}, end: (chunk) => { body = chunk } })
    return JSON.parse(body).config
  }
  assert.equal(read().sound, false, 'the route starts from the row config')

  // A volatile write commits into the same references; a volatile field parses
  // into a `.get()` reference, so both shapes have to land.
  config.sound = { get: () => true }
  config.soundVolume = { get: () => 0.8 }
  assert.equal(read().sound, true, 'the route serves the committed value')
  assert.equal(read().soundVolume, 0.8, 'and unwraps the volatile reference')
})

test('apply() wires expireMs from row config into the fold', () => {
  const units = []
  apply({
    config: { expireMs: 5_000 },
    sessionProjections: { register: (definition) => units.push(definition) },
    inject: () => {},
  })
  let state = units[0].init()
  state = units[0].apply(state, call('read', 1_000))
  state = units[0].apply(state, call('grep', 20_000))
  assert.equal(state.combo, 1, 'the route config reaches the unit, not just the fold defaults')
})

test('apply() honours row config', () => {
  const units = []
  const ctx = {
    config: { excludeTools: ['Todo_Write'], position: 'bottom-left', animation: 'off' },
    sessionProjections: { register: (definition) => units.push(definition) },
    inject: () => {},
  }
  apply(ctx)
  let state = units[0].init()
  state = units[0].apply(state, call('todo_write'))
  assert.equal(state.combo, 0)
  state = units[0].apply(state, call('bash'))
  assert.equal(state.combo, 1)
})

test('the published config route serves the clamped config', () => {
  const routes = []
  apply({
    config: { expireMs: 2_000, sound: true },
    sessionProjections: { register: () => {} },
    inject: (services, callback) => callback({
      effect: (factory) => factory(),
      webServer: { register: (route) => routes.push(route) },
    }),
  })
  let body = ''
  let head = null
  routes.find((route) => route.path === '/dsh-combo/config').handler({}, {
    writeHead: (status, headers) => { head = { status, headers } },
    end: (chunk) => { body = chunk },
  })
  const payload = JSON.parse(body)
  assert.equal(head.status, 200)
  assert.equal(head.headers['Cache-Control'], 'no-store')
  assert.equal(payload.config.expireMs, 2_000)
  assert.equal(payload.config.sound, true)
  assert.equal(payload.revision, 4, 'the revision lets a cached Client notice an upgrade')
})

test('the published config is clamped to known values', () => {
  assert.deepEqual(publicConfig({ position: 'sideways', animation: 'loud' }), CONFIG_DEFAULTS)
  assert.deepEqual(publicConfig({ excludeTools: 'nope' }).excludeTools, [], 'a non-array is ignored, not fatal')
  assert.deepEqual(publicConfig({ excludeTools: ['bash'] }).excludeTools, ['bash'])
  assert.equal(publicConfig(undefined).enabled, true, 'no config at all still yields defaults')
  assert.equal(publicConfig({ enabled: false, sound: true }).sound, true)
  assert.equal(publicConfig({ enabled: false }).enabled, false)
})

test('numeric knobs are clamped, and a switch never masquerades as a duration', () => {
  assert.equal(publicConfig({ expireMs: 10 }).expireMs, 10)
  assert.equal(publicConfig({ expireMs: '2500' }).expireMs, 2_500, 'a quoted YAML number is still a number')
  assert.equal(publicConfig({ expireMs: -5 }).expireMs, 0, 'a negative window means "no idle break"')
  assert.equal(publicConfig({ expireMs: 99_999_999 }).expireMs, 600_000, 'bounded so a typo cannot park a timer for a day')
  assert.equal(publicConfig({ expireMs: true }).expireMs, CONFIG_DEFAULTS.expireMs, 'a boolean is not a duration')
  assert.equal(publicConfig({ expireMs: null }).expireMs, CONFIG_DEFAULTS.expireMs)
  assert.equal(publicConfig({ expireMs: 'soon' }).expireMs, CONFIG_DEFAULTS.expireMs)

  assert.equal(publicConfig({ soundVolume: 5 }).soundVolume, 1)
  assert.equal(publicConfig({ soundVolume: -1 }).soundVolume, 0)
  assert.equal(publicConfig({ soundVolume: '0.5' }).soundVolume, 0.5)
  assert.equal(publicConfig({ soundVolume: false }).soundVolume, CONFIG_DEFAULTS.soundVolume)

  assert.equal(publicConfig({ soundFrom: -3 }).soundFrom, 0, '0 means "beep from the first call"')
  assert.equal(publicConfig({ soundFrom: 10 }).soundFrom, 10)
  assert.equal(publicConfig({ soundFrom: 9_999 }).soundFrom, 1_000)

  assert.equal(publicConfig({ pinPromptMs: 0 }).pinPromptMs, 0, '0 disables the keep-prompt')
  assert.equal(publicConfig({ pinPromptMs: '800' }).pinPromptMs, 800)
  assert.equal(publicConfig({ pinPromptMs: 9_999_999 }).pinPromptMs, 60_000)
  assert.equal(publicConfig({ pinPromptMs: {} }).pinPromptMs, CONFIG_DEFAULTS.pinPromptMs)
})


test('the public preset accepts supported effects and falls back for unknown values', () => {
  for (const preset of ['particles', 'flames', 'fireworks', 'rift']) {
    assert.equal(publicConfig({ preset }).preset, preset)
  }
  assert.equal(publicConfig({ preset: 'unknown' }).preset, 'particles')
})


test('appearance configuration validates colors and bounds expensive effects', () => {
  const config = publicConfig({ timerMs: 0, scale: 99, particleCount: 999, effectDurationMs: -1, glow: 99, accentColor: 'url(bad)', numberColor: '#abcdef', effectFrequency: 0, powerThreshold: -1, shakeIntensity: 999 })
  assert.equal(config.timerMs, 1000)
  assert.equal(config.scale, 2)
  assert.equal(config.particleCount, 80)
  assert.equal(config.effectDurationMs, 200)
  assert.equal(config.glow, 2)
  assert.equal(config.accentColor, '')
  assert.equal(config.numberColor, '#abcdef')
  assert.equal(config.effectFrequency, 1)
  assert.equal(config.powerThreshold, 0)
  assert.equal(config.shakeIntensity, 12)
})
