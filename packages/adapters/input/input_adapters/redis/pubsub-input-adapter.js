const Redis = require('ioredis')
const _logger = require('../../../logger')('pubsub-input-adapter')
let logger = _logger
const ACK_PREFIX = 'ACK'
const STREAM_PREFIX = 'STREAM'
const getAck = (id) => JSON.stringify({
  sys_time: new Date().getTime(),
  id
})
const getStreamData = (msg) => msg.data

const getStreamId = (msg) => msg.id

module.exports = class RedisPubSubInputAdapter {
  constructor (handlers = {}) {
    // each channel means channel
    this._handlers = handlers
  }

  setHandlers () {
    this.streamChannels = Object.keys(this._handlers).map(this.toStream)
    this.ackChannels = Object.keys(this._handlers).map(this.toAck)
    this.handlers = Object.keys(this._handlers).map(c => ({ [this.toStream(c)]: { handler: this._handlers[c], channel: c } })).reduce((p, c) => ({
      ...p,
      ...c
    }), {})
  }

  //   toStream(channel) {
  //       return channel
  //   }
  //   toAck(channel) {
  //       return channel
  //   }

  async setting ({
    redisConfig: { connectionString, host, port = 6379, password }
    , uniqueServiceName
    , acknowledgement = false
    , logger: customLogger
    //, json = true
  }) {
    if (customLogger) logger = customLogger
    logger.debug(`connectionString is ${connectionString}, host is ${host}, port is ${port}
                  , uniqueServiceName is ${uniqueServiceName}, acknowledgement is ${acknowledgement}`)

    if (!uniqueServiceName) {
      logger.error('an uniqueServiceName must be specified!')
      throw new Error('an uniqueServiceName must be specified!')
    }
    this.toStream = (channel) => `${this.uniqueServiceName}_${STREAM_PREFIX}_${channel}`
    this.toAck = (channel) => `${this.uniqueServiceName}_${ACK_PREFIX}_${channel}`
    // this.json = json
    this.acknowledgement = acknowledgement
    this.uniqueServiceName = uniqueServiceName

    if (connectionString) {
      this.redis = new Redis(connectionString)
      if (this.acknowledgement) {
        this.ackRedis = new Redis(connectionString)
      }
    } else {
      this.redis = new Redis({
        port, // Redis port
        host, // Redis host
        // family: 4, // 4 (IPv4) or 6 (IPv6)
        ...(password && { password })
        // db: 0
      })
      if (this.acknowledgement) {
        this.ackRedis = new Redis({
          port, // Redis port
          host, // Redis host
          // family: 4, // 4 (IPv4) or 6 (IPv6)
          ...(password && { password })
        // db: 0
        })
      }
    }

    this._setAck = this.acknowledgement ? (fullRedisChannel, id) => this.ackRedis.publish(fullRedisChannel, getAck(id)) : async () => {}

    this.setHandlers()
  }

  async connect () {
    await (new Promise((resolve, reject) => {
      this.redis.on('ready', resolve)
      if (this.redis.status === 'ready') {
        resolve()
      }
    }))

    if (this.acknowledgement) {
      await (new Promise((resolve, reject) => {
        this.ackRedis.on('ready', resolve)
        if (this.ackRedis.status === 'ready') {
          resolve()
        }
      }))
    }

    const streamHandler = (channel, msg) => {
      // console.log('channel ', channel)
      // console.log('msg ', msg)
      const task = this.handlers[channel].handler
      msg = JSON.parse(msg)
      const data = getStreamData(msg)
      task(data)
        .then(() => {
          this._setAck(this.toAck(this.handlers[channel].channel), getStreamId(msg)).then((n) => {
            // console.log('acked sent', n)
          })
        })
        .catch((err) => {
          logger.debug('error occurred during call handler', { name: err.name, message: err.message, stack: err.stack })
        })
    }

    this.redis.subscribe(this.streamChannels, function (err, count) {
      if (err) {
        logger.error('error to subscribe', { name: err.name, message: err.message, stack: err.stack })
      }
      logger.debug('subscribe channel count : ', count)
    })

    this.redis.on('message', streamHandler)
  }

  async disconnect () {
    await this.redis.quit()
    if (this.acknowledgement) {
      await this.ackRedis.quit()
    }
  }
}
