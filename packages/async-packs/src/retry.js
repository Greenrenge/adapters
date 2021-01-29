export const delay = ms =>
  new Promise(resolve => setTimeout(() => resolve(), ms))
export const retryUntil = async (
  promise,
  assertion = a => !!a,
  limit = 20,
  msDelay = 0,
) => {
  let round = 0
  let lastError
  while (round < limit) {
    round++
    try {
      const resolved = await promise()
      if (await assertion(resolved)) return resolved
    } catch (err) {
      lastError = err
    } finally {
      msDelay && (await delay(msDelay))
    }
  }
  throw lastError
}

module.exports = {
  retryUntil,
}
