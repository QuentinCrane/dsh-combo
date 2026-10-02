/**
 * Minimal stand-in for `@deepseek-ai/schemastery`, used only by the local test
 * harness so the plugin can be exercised without the DSH installation.
 * It implements exactly the surface dsh-combo touches.
 */
class Shape {
  constructor(dict) {
    this.dict = dict
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

  parse(value) {
    const source = value === undefined ? this.meta.default : value
    if (this.dict === undefined) return source
    const out = {}
    for (const [key, shape] of Object.entries(this.dict)) {
      out[key] = shape.parse(source?.[key])
    }
    return out
  }
}

const chainable = () => new Shape(undefined)

export default {
  object: (dict) => new Shape(dict),
  boolean: chainable,
  number: chainable,
  string: chainable,
  array: () => chainable(),
  union: () => chainable(),
  const: chainable,
  any: chainable,
}
