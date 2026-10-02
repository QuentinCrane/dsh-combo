/** Test-only resolver: points `@deepseek-ai/schemastery` at the local shim. */
const SHIM = new URL('./schemastery-shim.mjs', import.meta.url).href

export function resolve(specifier, context, nextResolve) {
  if (specifier === '@deepseek-ai/schemastery') {
    return { url: SHIM, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
