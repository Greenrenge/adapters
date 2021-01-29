export default function Suppress(target) {
  const { descriptor } = target
  const fn = descriptor.value
  const { name } = fn
  async function wrapped(...args) {
    try {
      const ret = await fn.call(this, ...args)
      return ret
    } catch (err) {
      return undefined
    }
  }
  Object.defineProperty(wrapped, 'name', { value: name, configurable: true }) // set function name to wrapped function
  descriptor.value = wrapped
  return target
}
