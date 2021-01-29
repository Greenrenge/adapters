const MessageQueue = require('../../../lib/mq/_message-queue')
const _logger = require('../../../logger')('rabbitmq-output-adapter')
let logger = _logger
const { promisify } = require('util')
const delay = promisify(setTimeout)

module.exports = class RabbitMQOutputAdapter {
  constructor () {
    // explicit props shown here, later initialized
    this.ch = undefined
    this.mq = undefined
    this.exchangeName = undefined
    this.exchangeType = undefined
    this.queueName = undefined
    this.prefetch = undefined
    this.ignoreRoutingKey = false
  }
  async setting ({ connectionString, exchangeName, exchangeType = 'topic', queueName = 'default_queue', autoCreateQueue = true, namespace, maxPriority = 0, prefetch = 10, ignoreRoutingKey = false, autoReconnect = false, delayReconnectMS = 5000, logger: customLogger }) {
    /**
     * this adapter is meant to send to exchange, not send directly to a queue
     */
    if (customLogger) logger = customLogger
    logger.debug(`connectionString is ${connectionString},  exchangeName is ${exchangeName}
    , exchangeType is ${exchangeType}, queueName is ${queueName},prefetch is ${prefetch}
    , ignoreRoutingKey is ${ignoreRoutingKey}`)

    if (!exchangeName || !connectionString || !exchangeName.length || !connectionString.length) {
      logger.error('an exchangeName and connectionString must be specified!')
      throw new Error('an exchangeName and connectionString must be specified!')
    }
    this.mq = new MessageQueue(connectionString, { endProcessIfError: !autoReconnect })
    this.exchangeName = exchangeName
    this.exchangeType = exchangeType
    this.queueName = queueName
    this.prefetch = prefetch
    this.ignoreRoutingKey = ignoreRoutingKey
    this._cachedQueue = {}
    this.autoReconnect = autoReconnect
    this.delayReconnectMS = delayReconnectMS
    this.autoCreateQueue = autoCreateQueue
    this.namespace = namespace
    this.maxPriority = +maxPriority
  }

  async reconnect () {
    try {
      if (this.mq) {
        try {
        // destroy old channel
          if (this.ch) {
            await this.ch.close()
          }
          // destroy old connection
          if (this.mq.connection) {
            await this.mq.connection.close()
          }
        } catch (err) {
          logger.error(`error to close old channel/connection`, err)
        }
      }
      await this._connectMQ()
      if (this.autoReconnect) { this._setReconnect(this.mq.connection, this.ch) }
    } catch (err) {
      logger.error(`error to reconnect`, err)
      throw err
    }
  }

  async _autoReconnect () {
    let complete = false
    while (!complete) {
      await delay(+this.delayReconnectMS || 5000)
      try {
        this.reconnect()
        complete = true
      } catch (err) {
        continue
      }
    }
  }

  _setReconnect (connection, channel) {
    const toReconnect = (eventNames = []) => event => eventNames.map(n => event.on(n, async (err) => {
      logger.error(`${n} IS EMITTED !! TRYING TO RECONNECT `, err)
      await this._autoReconnect()
    }))
    toReconnect(['error', 'close'])(connection)
    toReconnect(['error', 'close'])(channel)
  }

  async _initExchange () {
    try {
      await this.mq.assertExchange(this.ch, this.exchangeName, this.exchangeType)
    } catch (err) {
      logger.error(`cannot initiation exchange on rabbitmq`, err)
      throw err
    }
  }
  async _initQueueAndBind (channel) {
    try {
      // channel always has value (*=default)
      // queueName of each channel(routingKey) is ${queueName}_${namespace}.${routingKey}
      const routingKey = `${this.namespace ? this.namespace + '.' : ''}${channel || ''}`
      await this.mq.assertQueue(this.ch, `${this.queueName}_${routingKey}`, {
        prefetch: this.prefetch,
        ...this.maxPriority && { maxPriority: this.maxPriority }
      })
      logger.debug('create queue complete', `${this.queueName}_${routingKey}`)
      await this.mq.bindQueue(this.ch, `${this.queueName}_${routingKey}`, this.exchangeName, routingKey)
      logger.debug('bind queue complete', routingKey)
      // need time to really works if first time binding
      await delay(2000)
    } catch (err) {
      logger.error(`cannot binding queue to exchange`, err)
      throw err
    }
  }
  async _connectMQ () {
    try {
      if (!this.mq) {
        logger.error('no setting(..) called before connect!')
        throw new Error('call setting(..) before connect!')
      }

      await this.mq.connect()

      logger.info('RabbitMQ has connected')
      const _ch = await this.mq.createChannel()
      logger.info('RabbitMQ channel opened')
      this.ch = _ch
      this.ch.on('close', () => {
        logger.error('MQ channel connection close')
        throw new Error('MQ channel connection close.')
      })
      this.ch.on('error', (err) => {
        logger.error(`MQ channel connection close by error.`, err)
        throw new Error('MQ channel connection close by error.' + JSON.stringify(err))
      })
    } catch (err) {
      throw err
    }
  }
  async connect () {
    try {
      await this._connectMQ()
      if (this.autoReconnect) { this._setReconnect(this.mq.connection, this.ch) }
      await this._initExchange()
    } catch (err) {
      logger.error(`error to connect`, err)
      throw err
    }
  }
  async _ensureQueueExistsAndBind (channel) {
    if (!this._cachedQueue[channel]) {
      // non-cached , need to init
      await this._initQueueAndBind(channel)
      this._cachedQueue[channel] = true
    }
  }
  async publish ({ channel, data, persist: autoCreateQueue = this.autoCreateQueue }) {
    /**
    * if channel is specified, it is the routing key on a queue, if undefined it will later set as ''
    */
    if (!this.mq) {
      throw new Error(`please call connect() before publishing data`)
    }
    const message = JSON.stringify(data)
    if (this.exchangeType === 'topic' && channel === undefined) {
      // default routing value for topic in case no routing key specified
      channel = '*'
    }
    if (autoCreateQueue) {
      await this._ensureQueueExistsAndBind(channel)
    }

    await this.sendToExchange(channel, message)
  }

  async sendToExchange (channel, message) {
    try {
      const routingKey = `${this.namespace ? this.namespace + '.' : ''}${channel || ''}`
      logger.debug(`publishing data on routing key =${routingKey}`, JSON.stringify(message))
      // this.mq.publish(this.ch, this.exchangeName, message, channel)
      return this.ch.publish(this.exchangeName, routingKey || '', Buffer.from(message), { persistent: true })
    } catch (err) {
      logger.error(`cannot publish data to rabbitmq`, err)
      throw err
    }
  }

  async disconnect () {
    try {
      await this.mq.closeChannel(this.ch)
      await this.mq.closeConnection()
    } catch (err) {
      logger.error(`cannot disconnect rabbitmq ${err}`)
      throw err
    }
  }
}
