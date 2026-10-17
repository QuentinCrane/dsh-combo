/**
 * Stand-in for `@deepseek-ai/schemastery`, used by the local test harness
 * so the plugin can be exercised without the DSH installation.
 * It enforces real Schemastery type validation behavior so schema regressions
 * (e.g. string numbers passed to strict number schemas) are caught by tests.
 */
class Shape {
  constructor(type, arg) {
    this.type = type
    this.arg = arg
    this.meta = { default: undefined }
  }

  default(value) {
    this.meta.default = value
    return this
  }

  description(text) {
    this.meta.description = text
    return this
  }

  /**
   * Real Schemastery parses a `.volatile()` field into a stable reference read
   * with `.get()`. This shim mimics that behavior when parsing.
   */
  volatile() {
    this.meta.volatile = true
    return this
  }

  parse(value) {
    const source = value === undefined ? this.meta.default : value
    if (this.type === 'object') {
      const out = {}
      for (const [key, shape] of Object.entries(this.arg)) {
        out[key] = shape.parse(source?.[key])
      }
      return out
    }

    if (source !== undefined && source !== null) {
      if (this.type === 'number') {
        if (typeof source !== 'number' || Number.isNaN(source)) {
          throw new TypeError(`expected number, got ${typeof source}: ${JSON.stringify(source)}`)
        }
      } else if (this.type === 'boolean') {
        if (typeof source !== 'boolean') {
          throw new TypeError(`expected boolean, got ${typeof source}: ${JSON.stringify(source)}`)
        }
      } else if (this.type === 'string') {
        if (typeof source !== 'string') {
          throw new TypeError(`expected string, got ${typeof source}: ${JSON.stringify(source)}`)
        }
      } else if (this.type === 'array') {
        if (!Array.isArray(source)) {
          throw new TypeError(`expected array, got ${typeof source}: ${JSON.stringify(source)}`)
        }
        if (this.arg) {
          for (const item of source) this.arg.parse(item)
        }
      } else if (this.type === 'union') {
        const matches = Array.isArray(this.arg) && this.arg.some(candidate => {
          if (candidate instanceof Shape) {
            try { candidate.parse(source); return true } catch { return false }
          }
          return candidate === source
        })
        if (!matches) {
          throw new TypeError(`value ${JSON.stringify(source)} does not match union candidates`)
        }
      }
    }

    if (this.meta.volatile) {
      return { get: () => source }
    }
    return source
  }
}

export default {
  object: (dict) => new Shape('object', dict),
  boolean: () => new Shape('boolean'),
  number: () => new Shape('number'),
  string: () => new Shape('string'),
  array: (item) => new Shape('array', item),
  union: (items) => new Shape('union', items),
  const: (val) => new Shape('const', val),
  any: () => new Shape('any'),
}
