import { ERRORS } from '../config/constants'

export default function AuthRequired(target) {
  const { descriptor } = target
  const fn = descriptor.value
  const { name } = fn
  // run-time fn called
  async function wrapped(...args) {
    await this.loadSession()
    try {
      const ret = await fn.call(this, ...args)
      return ret
    } catch (err) {
      // since it is wrapped to Transform Error under transform of request-config.js
      if (err.message.includes(ERRORS.LOGIN_REQUIRED)) {
        // login failed then login
        await this.login()
        const ret = await fn.call(this, ...args)
        return ret
      }
      throw err
    }
  }
  Object.defineProperty(wrapped, 'name', { value: name, configurable: true }) // set function name to wrapped function
  descriptor.value = wrapped
  return target
}
