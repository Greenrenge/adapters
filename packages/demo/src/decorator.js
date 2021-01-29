/* eslint-disable no-unused-vars */
/* eslint-disable no-console */
import Debug from 'debug'

async function runner(task) {
  try {
    const result = await task()
    console.info(' ===== [DEMO] : ', task.name)
    if (result !== undefined) console.log('result is ', result)
  } catch (err) {
    console.error(' ===== [DEMO] FAILED : ', task.name)
    console.error(err)
  }
}

export const createRunSuit = () => {
  const markedRun = new Set()
  let fnsToBeRun = []
  function Suit(target) {
    if (target.kind === 'class') {
      const elms = target.elements
      fnsToBeRun = elms
        .map(({ kind, key, placement, descriptor }) => {
          if (placement === 'static' && markedRun.has(key)) {
            return descriptor.value
          }
          return undefined
        })
        .filter(a => !!a)
    }
    async function run() {
      for (const fn of fnsToBeRun) {
        await runner(fn)
      }
      console.log('Demo finished')
    }
    run.bind(this)
    const mock = Object.create(target.elements[0])
    Object.assign(mock, target.elements[0])
    mock.key = 'run'
    mock.descriptor.value = run
    target.elements.push(mock)
    return target
  }

  function Run(target) {
    const { kind, key, placement, descriptor } = target
    if (kind === 'method') markedRun.add(key)
    return target
  }

  return {
    Run,
    Suit,
  }
}

export function logged(target) {
  const { kind, key, placement, descriptor } = target
  const fn = descriptor.value
  const { name } = fn
  function wrapped(...args) {
    // before call
    console.log(`starting ${name} with arguments ${args.join(', ')}`)
    const ret = fn.call(this, ...args)
    // after call
    console.log(`ending ${name}`)
    return ret
  }
  Object.defineProperty(wrapped, 'name', { value: name, configurable: true }) // set function name to wrapped function
  descriptor.value = wrapped
  return { kind, key, placement, descriptor }
}

export function debug(pattern = '*') {
  return function(target) {
    const { kind, key, placement, descriptor } = target
    const fn = descriptor.value
    const { name } = fn
    function wrapped(...args) {
      const debugPattern = `${
        process.env.DEBUG ? `${process.env.DEBUG},` : ''
      }${pattern}`
      Debug.enable(debugPattern)
      const ret = fn.call(this, ...args)
      return ret
    }
    Object.defineProperty(wrapped, 'name', { value: name, configurable: true }) // set function name to wrapped function
    descriptor.value = wrapped
    return { kind, key, placement, descriptor }
  }
}
