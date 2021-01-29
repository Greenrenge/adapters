import Debug from 'debug'
import { fromRedis, toRedis } from './redis-helper'

const debug = Debug('redis:lock')

export const createRedisLocker = (redis, lockKey, msLocked = 20 * 1000) => {
  const getLockedValue = async val => {
    val = val || fromRedis(await redis.get(lockKey))
    return val
  }

  const isLocked = async val => {
    val = await getLockedValue(val)
    return (
      val && +val.lockedAt && +val.lockedAt + msLocked > new Date().getTime()
    )
  }

  return {
    getLockedValue,
    isLocked,
    async lock() {
      try {
        await redis.watch(lockKey)
        const value = fromRedis(await redis.get(lockKey))
        if (await isLocked(value)) {
          debug('FAILED TO LOCK : other client locked')
          return false
        }
        const setVal = {
          ...value,
          lockedAt: new Date().getTime(),
        }
        await redis
          .multi()
          .set(lockKey, toRedis(setVal))
          .exec()
        return setVal
      } catch (err) {
        debug('FAILED TO LOCK : redis watch lock failed', err)
      } finally {
        await redis.unwatch()
      }
    },
    async unlock(value) {
      try {
        const setVal = {
          ...value,
          lockedAt: 0,
        }
        await redis.set(lockKey, JSON.stringify(setVal))
        return setVal
      } catch (err) {
        debug('FAILED TO UNLOCK : redis unwatch lock failed', err)
      }
    },
    kill() {
      redis.disconnect()
    },
  }
}
