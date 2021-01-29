// https://github.com/smrchy/rsmq
// https://github.com/bee-queue/bee-queue

const Redis = require('ioredis')
const _logger = require('../../../logger')('rabbitmq-output-adapter')
let logger = _logger
const uuidv4 = require('uuid/v4')

const ACK_PREFIX = 'ACK'
const STREAM_PREFIX = 'STREAM'

const setStreamData = (data) => ({
  id: uuidv4(),
  data,
  sys_time: new Date().getTime()
})

const getAckId = (msg) => msg.id

module.exports = class RedisPubSubOutputAdapter {
  constructor () {
    this.unAck = {}
  }

  async setting ({
    redisConfig: { connectionString, host, port = 6379, password }
    , uniqueServiceName
    , acknowledgement = false
    , maxWaitAckMillisec = 3 * 1000,
    logger: customLogger
  }) { // 3 sec
    if (customLogger) logger = customLogger
    logger.debug(`connectionString is ${connectionString}, host is ${host}, port is ${port}
                  , uniqueServiceName is ${uniqueServiceName}, acknowledgement is ${acknowledgement}`)

    if (!uniqueServiceName) {
      logger.error('an uniqueServiceName must be specified!')
      throw new Error('an uniqueServiceName must be specified!')
    }

    this.toStream = (channel) => `${this.uniqueServiceName}_${STREAM_PREFIX}_${channel}`
    this.toAck = (channel) => `${this.uniqueServiceName}_${ACK_PREFIX}_${channel}`
    this.acknowledgement = acknowledgement
    this.maxWaitAckMillisec = maxWaitAckMillisec
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

    // this._waitAck = this.acknowledgement ? (fullRedisChannel, id) => this.ackRedis.publish(fullRedisChannel, getAck(id)) : () => {}
  }

  async connect () {
    if (this.acknowledgement) {
      this.ackRedis.on('message', function (fullChannel, message) {
        // console.log('recieved acked', fullChannel, message)
        // handle ack
        message = JSON.parse(message)
        // console.log(this.unAck[fullChannel].total)
        // console.log(getAckId(message))
        if (this.unAck[fullChannel]) {
          if (this.unAck[fullChannel].total[getAckId(message)]) {
            // found unack that match the id
            // console.log('found')
            this.unAck[fullChannel].total[getAckId(message)].ack()
          }
        }
      }.bind(this))
    }
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
  }

  _initAck (channel) {
    const fullChannel = this.toAck(channel)
    this.ackRedis.subscribe(fullChannel, function (err, count) {
      if (err) {
        logger.error('error to subscribe in _initAck', { name: err.name, message: err.message, stack: err.stack })
      }
      logger.debug('subcribe channel count ack : ', count)
    })
    // console.log('sub to ', fullChannel)
    this.unAck[fullChannel] = {
      total: {

      }
    }
  }
  publish ({ channel, data }) {
    if (this.acknowledgement) {
    // if ack, need to subto the channel
      if (!this.unAck[this.toAck(channel)]) {
        this._initAck(channel)
      }
      // set ack handler for set back
      return new Promise((resolve, reject) => {
        const { total } = this.unAck[this.toAck(channel)]
        const sentData = setStreamData(data)
        total[sentData.id] = {
          ack: () => {
            // console.log('acked calleddddd')
            delete total[sentData.id]
            resolve()
          }
        }
        this.redis.publish(this.toStream(channel), JSON.stringify(sentData)).then(() => {
          // console.log('published')
          setTimeout(reject, this.maxWaitAckMillisec, new Error('timeout for acknowledgement'))
        })
      })
    } else {
      return this.redis.publish(this.toStream(channel), JSON.stringify(setStreamData(data)))
    }
  }

  async disconnect () {
    await this.redis.quit()
    if (this.acknowledgement) {
      await this.ackRedis.quit()
    }
  }
}
