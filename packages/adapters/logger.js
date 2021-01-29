module.exports = name => ({
  info: (...any) => console.log(`[${name}]`, ...any),
  error: (...any) => console.error(`[${name}]`, ...any),
  debug: (...any) => console.debug(`[${name}]`, ...any),
  warn: (...any) => console.warn(`[${name}]`, ...any),
})
