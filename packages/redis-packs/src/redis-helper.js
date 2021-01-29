export const fromRedis = v => {
  try {
    return JSON.parse(v)
  } catch (_) {
    return null
  }
}

export const toRedis = v => JSON.stringify(v)
