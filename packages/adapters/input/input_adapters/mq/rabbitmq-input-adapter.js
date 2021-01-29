const MessageQueue = require('../../../lib/mq/_message-queue')
const _logger = require('../../../logger')('rabbitmq-input-adapter')
const { each } = require('lodash')
const { promisify } = require('util')

const delay = promisify(setTimeout)
let logger = _logger

module.exports = class RabbitMQInputAdapter {
  /**
   *
   * @param {object} handlers object contains { channelName1 : handler1<Promise>},for acknowledge word handlers is async handlers
   */
  constructor(handlers = {}) {
    // each channel means routing key
    this.setHandlers(handlers)
    // init after setting() called
    this.ch = undefined
    this.mq = undefined
    this.exchangeName = undefined
    this.exchangeType = undefined
    this.queueName = undefined
    this.prefetch = undefined
    this.acknowledgement = true
    this.ignoreRoutingKey = false
  }

  setHandlers(handlers) {
    this.channels = Object.keys(handlers)
    this.handlers = handlers
  }

  /**
   * exchangeType should be the same as message publisher uses
   * exchangeName and queueName must be specified
   * acknowledgement is mode of consume data
   * ignoreRoutingKey is receive all message or not, not worked with 'direct' exchange type
   * if ignoreRoutingKey is set to false, you should have exchangeType = 'direct' or 'topic', and queue name will be queueName_channelName
   */
  async setting({
    connectionString,
    exchangeName,
    exchangeType = 'topic',
    queueName,
    namespace = '',
    prefetch = 10,
    acknowledgement = true,
    maxPriority = 0,
    ignoreRoutingKey = false,
    autoReconnect = false,
    delayReconnectMS = 5000,
    logger: customLogger,
  }) {
    if (customLogger) logger = customLogger
    logger.debug(`connectionString is ${connectionString},  exchangeName is ${exchangeName}, exchangeType is ${exchangeType}
                  , queueName is ${queueName}, prefetch is ${prefetch}, acknowledgement is ${acknowledgement}, ignoreRoutingKey(receive all msgs) is ${ignoreRoutingKey}`)
    if (
      !queueName ||
      !exchangeName ||
      !connectionString ||
      !queueName.length ||
      !exchangeName.length ||
      !connectionString.length
    ) {
      logger.error(
        'an exchangeName,queueName and connectionString must be specified!',
      )
      throw new Error(
        'an exchangeName,queueName and connectionString must be specified!',
      )
    }
    this.mq = new MessageQueue(connectionString, {
      endProcessIfError: !autoReconnect,
    })
    this.prefetch = prefetch
    this.exchangeName = exchangeName
    this.exchangeType = exchangeType
    this.queueName = queueName
    this.acknowledgement = acknowledgement
    this.ignoreRoutingKey = ignoreRoutingKey
    this.autoReconnect = autoReconnect
    this.delayReconnectMS = delayReconnectMS
    this.maxPriority = +maxPriority
    this.namespace = namespace
  }

  async reconnect() {
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
          logger.error('error to close old channel/connection', err)
        }
      }
      await this._connectMQ()
      if (this.autoReconnect) {
        this._setReconnect(this.mq.connection, this.ch)
      }
      await this._receiveData()
    } catch (err) {
      logger.error('error to reconnect', err)
      throw err
    }
  }

  async _autoReconnect() {
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

  _setReconnect(connection, channel) {
    const toReconnect = (eventNames = []) => event =>
      eventNames.map(n =>
        event.on(n, async err => {
          logger.error(`${n} IS EMITTED !! TRYING TO RECONNECT `, err)
          await this._autoReconnect()
        }),
      )
    toReconnect(['error', 'close'])(connection)
    toReconnect(['error', 'close'])(channel)
  }

  async connect() {
    try {
      await this._connectMQ()
      if (this.autoReconnect) {
        this._setReconnect(this.mq.connection, this.ch)
      }
      await this._initExchange()
      await this._initQueue()
      await this._receiveData()
    } catch (err) {
      logger.error('error to connect', err)
      throw err
    }
  }

  async _initExchange() {
    try {
      await this.mq.assertExchange(
        this.ch,
        this.exchangeName,
        this.exchangeType,
      )
    } catch (err) {
      logger.error('cannot initiation exchange on rabbitmq', err)
      throw err
    }
  }

  async _initQueue() {
    try {
      if (this.ignoreRoutingKey) {
        // receiving all msgs from exchange
        await this.mq.assertQueue(this.ch, this.queueName, {
          prefetch: this.prefetch,
          ...(this.maxPriority && { maxPriority: this.maxPriority }),
        })
        logger.debug('create queue complete', this.queueName)
        if (this.exchangeType === 'topic') {
          // this meant we receive all msgs
          await this.mq.bindQueue(
            this.ch,
            this.queueName,
            this.exchangeName,
            `${this.namespace ? `${this.namespace}.` : ''}#`,
          )
          logger.debug('bind queue complete')
          // need time to really works if first time binding
          await delay(2000)
        } else {
          await this.mq.bindQueue(
            this.ch,
            this.queueName,
            this.exchangeName,
            '',
          )
          logger.debug('bind queue complete')
          // need time to really works if first time binding
          await delay(2000)
        }
      } else {
        // each this.channels get data on each its name
        each(this.channels, async channel => {
          const routingKey = `${
            this.namespace ? `${this.namespace}.` : ''
          }${channel}`
          // queueName of each channel(routingKey) is ${queueName}_${routingKey}
          await this.mq.assertQueue(
            this.ch,
            `${this.queueName}_${routingKey}`,
            {
              prefetch: this.prefetch,
              ...(this.maxPriority && { maxPriority: this.maxPriority }),
            },
          )
          logger.debug(
            'create queue complete',
            `${this.queueName}_${routingKey}`,
          )
          await this.mq.bindQueue(
            this.ch,
            `${this.queueName}_${routingKey}`,
            this.exchangeName,
            routingKey,
          )
          logger.debug('bind queue complete', routingKey)
        })
      }
    } catch (err) {
      logger.error('cannot binding queue to exchange', err)
      throw err
    }
  }

  async _receiveData() {
    try {
      const readMessage = this.acknowledgement
        ? this.mq.readMessageWithAck.bind(this.mq)
        : this.mq.readMessageWithNoAck.bind(this.mq)
      if (this.ignoreRoutingKey) {
        // send all data from this.queueName to all handlers
        const stream = readMessage(this.ch, this.queueName)
        stream.on('data', async (data, ack) => {
          // if no-acknowledgement ack = undefined
          // if acknowledgement, all handlers must complete the job, then we will ack back to mq
          // distribute all data thru the handlers
          const tasks = []
          each(this.channels, channel => {
            tasks.push(this.handlers[channel](data))
          })
          if (ack) {
            try {
              // must pass for all handlers
              await Promise.all(tasks)
              ack()
            } catch (err) {
              // some task fail , unack
              ack(err)
            }
          }
        })
      } else {
        // each handler has its own queue
        each(this.channels, channel => {
          const routingKey = `${
            this.namespace ? `${this.namespace}.` : ''
          }${channel}`
          const channelQueueName = `${this.queueName}_${routingKey}` // channel = routingKey
          const stream = readMessage(this.ch, channelQueueName)
          stream.on('data', async (data, ack) => {
            // if no-acknowledgement ack = undefined
            // if acknowledgement, the handler must resolve the job, then we will ack back to mq
            const task = this.handlers[channel](data)
            if (ack) {
              try {
                await task
                ack()
              } catch (err) {
                // task fail
                ack(err)
              }
            }
          })
        })
      }
    } catch (err) {
      logger.error('error to initialize getting data from mq', err)
      throw err
    }
  }

  async _connectMQ() {
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
      this.ch.on('error', err => {
        logger.error('MQ channel connection close by error.', err)
        throw new Error(
          `MQ channel connection close by error.${JSON.stringify(err)}`,
        )
      })
    } catch (err) {
      throw err
    }
  }

  async disconnect() {
    try {
      await this.mq.closeChannel(this.ch)
      await this.mq.closeConnection()
    } catch (err) {
      logger.error(`cannot disconnect rabbitmq ${err}`)
      throw err
    }
  }
}
