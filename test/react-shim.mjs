/**
 * Test-only React stand-in: the hook surface the dsh-combo bundle uses, with a
 * minimal virtual DOM so a render can be asserted. Not a React implementation —
 * it exists to prove the bundle's data wiring and tier thresholds deterministically.
 *
 * Hook slots live in one array and are addressed by their position in the
 * depth-first render order, so a component keeps its state across renders.
 * A request raised while rendering is coalesced, never re-entered.
 */

/** Every element created by the last render, in creation order. */
export const nodes = []

let store = []
/** Previous pass's slots, read while the current pass rebuilds `store`. */
let previous = []
let cursor = 0
let slotStart = 0
let current = null
let rerender = () => {}
let rendering = false
let queued = false
/**
 * Bumped by every `mount`. A hook closure born in an earlier generation (a
 * timer that outlived the mount that scheduled it) must not write into the
 * current tree's slots — the real React would have unmounted it.
 */
let generation = 0

export function createElement(type, props, ...children) {
  if (typeof type === 'function' || type === Fragment) {
    // A pending component: `pending` keeps this marker distinct from any `kind`
    // field of the props it carries.
    return { pending: true, type, props: { ...(props ?? {}), children } }
  }
  const flat = (children ?? [])
    .flat(Infinity)
    .filter((child) => child !== null && child !== undefined && child !== false)
  // `data-*` props are the observable surface a test asserts on.
  const attributes = {}
  for (const [key, value] of Object.entries(props ?? {})) {
    if (key.startsWith('data-') || key === 'aria-hidden') attributes[key] = value
  }
  const node = {
    kind: 'element',
    type,
    props: props ?? {},
    style: normalizeStyle(props?.style),
    attributes,
    children: flat,
  }
  nodes.push(node)
  return node
}

export const Fragment = Symbol('Fragment')

function normalizeStyle(style) {
  const out = {}
  for (const [key, value] of Object.entries(style ?? {})) {
    out[key.startsWith('--') ? key : key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value
  }
  return out
}

/** Resolve one hook slot: a stable index inside the rendering component. */
function slot() {
  return slotStart + cursor++
}

/** One slot's state carried over from the previous pass, if it existed. */
function carried(index) {
  return previous !== undefined && index in previous ? previous[index] : undefined
}

/** Test visibility into the hook store. */
export const __store = () => store.map((entry) => (entry && typeof entry === 'object' && 'current' in entry ? '<ref>' : entry?.deps !== undefined ? '<effect d=' + JSON.stringify(entry.deps) + '>' : entry))

function requestRender() {
  if (rendering) {
    queued = true
    return
  }
  rerender()
}

export function useState(initial) {
  const index = slot()
  const born = generation
  if (!(index in store)) {
    const carried = carriedState(index)
    store[index] = carried !== undefined ? carried : (typeof initial === 'function' ? initial() : initial)
  }
  const set = (next) => {
    if (born !== generation) return
    const value = typeof next === 'function' ? next(store[index]) : next
    if (Object.is(value, store[index])) return
    store[index] = value
    requestRender()
  }
  return [store[index], set]
}

function carriedState(index) {
  return previous !== undefined && index in previous ? previous[index] : undefined
}

export function useRef(initial) {
  const index = slot()
  if (!(index in store)) store[index] = carriedState(index) ?? { current: initial }
  return store[index]
}

export function useMemo(factory, deps) {
  const index = slot()
  const entry = carriedState(index)
  if (entry === undefined || !sameDeps(entry.deps, deps)) {
    store[index] = { deps, value: factory() }
  } else {
    store[index] = entry
  }
  return store[index].value
}

export function useEffect(effect, deps) {
  const index = slot()
  const entry = carriedState(index)
  if (entry !== undefined && sameDeps(entry.deps, deps)) {
    store[index] = entry
    return
  }
  entry?.cleanup?.()
  const cleanup = effect()
  store[index] = { deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined }
}

export function useSyncExternalStore(subscribe, getSnapshot) {
  const index = slot()
  const born = generation
  const entry = carriedState(index)
  if (entry !== undefined) {
    entry.snapshot = getSnapshot()
    store[index] = entry
    return entry.snapshot
  }
  const fresh = { subscribe, snapshot: getSnapshot(), dispose: undefined }
  if (typeof subscribe === 'function') {
    fresh.dispose = subscribe(() => {
      if (born !== generation) return
      requestRender()
    })
  }
  store[index] = fresh
  return fresh.snapshot
}

function sameDeps(left, right) {
  if (left === undefined || right === undefined) return false
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
}

/** Mount a component tree and return a re-render trigger. */
export function mount(element) {
  const root = element
  generation += 1
  const host = { kind: 'root', type: 'root', props: {}, style: {}, attributes: {}, children: [] }
  rerender = () => {
    if (rendering) {
      queued = true
      return
    }
    let guard = 0
    do {
      queued = false
      render(host, root)
      guard += 1
    } while (queued && guard < 12)
  }
  store = []
  rerender()
  return {
    host,
    update: () => rerender(),
    /** Depth-first walk over the produced virtual DOM. */
    all: () => walk(host),
    find: (predicate) => walk(host).find(predicate),
  }
}

function render(host, root) {
  nodes.length = 0
  cursor = 0
  // Slots are addressed by depth-first render position, so one pass rebuilds
  // the table and carries each component's previous state forward by position.
  previous = store
  store = []
  rendering = true
  let tree
  try {
    tree = instantiate(root, host)
  } finally {
    rendering = false
  }
  host.children = tree === null ? [] : [tree]
}

function instantiate(element, parent) {
  if (element === null || element === undefined || element === false) return null
  if (typeof element === 'string' || typeof element === 'number') return { kind: 'text', value: String(element), children: [] }
  if (element.type === Fragment) {
    // A pending element keeps its children on `props`; a rendered host element
    // keeps them on the node itself.
    const raw = element.children ?? element.props?.children ?? []
    const children = raw.flat(Infinity).map((child) => instantiate(child, parent)).filter(Boolean)
    return { kind: 'fragment', children, parent }
  }
  if (typeof element.type === 'function') {
    const savedCursor = cursor
    const savedCurrent = current
    const start = store.length
    slotStart = start
    cursor = 0
    const produced = element.type({ ...element.props, children: element.children })
    // The component's hooks own [start, start + cursor); nested components that
    // rendered inside it have already appended their own further slots.
    store.length = Math.max(store.length, start + cursor)
    current = savedCurrent
    slotStart = start
    cursor = savedCursor + cursor
    return {
      kind: 'component',
      name: element.type.name || 'anonymous',
      props: element.props,
      style: {},
      attributes: {},
      children: [instantiate(produced, parent)].filter(Boolean),
      parent,
    }
  }
  return {
    kind: 'element',
    type: element.type,
    props: element.props,
    style: element.style,
    attributes: element.attributes,
    children: element.children.map((child) => instantiate(child, element)).filter(Boolean),
    parent,
  }
}

function walk(node, out = []) {
  out.push(node)
  for (const child of node.children ?? []) walk(child, out)
  return out
}
