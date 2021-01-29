const amqp = require('amqplib')
const { EventEmitter } = require('events')
const _logger = require('../../logger')('message-queue')

module.exports = class MessageQueue {
  constructor(
    connectionString,
    {
      prefetch = 10,
      heartbeat = 580,
      json = true,
      endProcessIfError = true,
      logger = _logger,
    } = {},
  ) {
    this.connection = undefined
    this.connStr = connectionString
    this.prefetch = prefetch || 10
    this.heartbeat = heartbeat || 580
    this.json = json === undefined ? true : json
    this.endProcessIfError =
      endProcessIfError === undefined ? true : endProcessIfError
    this.logger = logger || _logger
    // If connection string has no heartbeat.. put default to it
    if (/\bheartbeat\b/.test(this.connStr)) {
      const prefix = /\?/.test(this.connStr) ? '&' : '?'
      this.connStr += `${prefix}heartbeat=${this.heartbeat}`
    }
    if (!this.connStr.startsWith('amqp://')) {
      this.connStr = `amqp://${this.connStr}`
    }
    this.error = (err, msg, ...params) =>
      this.logger.error(
        msg,
        { name: err.name, message: err.message, stack: err.stack },
        ...params,
      )
  }

  async connect() {
    try {
      const connection = await amqp.connect(this.connStr)
      if (this.endProcessIfError) {
        connection.on('close', err => {
          this.bail(err)
        })
        connection.on('error', err => {
          this.bail(err)
        })
      }
      this.connection = connection
    } catch (err) {
      this.error(err, 'cannot connect to amqp')
      this._handleError(err)
    }
  }

  _handleError(err) {
    if (this.endProcessIfError) {
      this.bail(err)
    } else {
      throw err
    }
  }

  async createChannel() {
    if (!this.connection) {
      this._handleError(
        new Error('Please connect to mq first by call .connect'),
      )
    }
    try {
      const ch = await this.connection.createChannel()
      return ch
    } catch (err) {
      this.error(err, 'cannot create channel')
      this._handleError(err)
    }
  }

  async createConfirmChannel() {
    if (!this.connection) {
      this._handleError(
        new Error('Please connect to mq first by call .connect'),
      )
    }
    try {
      const ch = await this.connection.createConfirmChannel()
      return ch
    } catch (err) {
      this.error(err, 'cannot create confirm channel')
      this._handleError(err)
    }
  }

  /**
   *
   *
    interface AssertQueue {
        exclusive?: boolean;
        durable?: boolean;
        autoDelete?: boolean;
        arguments?: any;
        messageTtl?: number;
        expires?: number;
        deadLetterExchange?: string;
        deadLetterRoutingKey?: string;
        maxLength?: number;
        maxPriority?: number;
    }
*/
  async assertQueue(channel, queueName, prefetchOrOpts = this.prefetch) {
    let opts = {
      durable: true,
    }
    if (['number', 'string'].includes(typeof prefetchOrOpts)) {
      channel.prefetch(parseInt(prefetchOrOpts))
    } else if (typeof prefetchOrOpts === 'object') {
      if (prefetchOrOpts.prefetch) {
        channel.prefetch(parseInt(prefetchOrOpts.prefetch))
      }
      const { prefetch, ...rest } = prefetchOrOpts
      opts = {
        ...opts,
        ...rest,
      }
    }
    try {
      await channel.assertQueue(queueName, opts)
    } catch (err) {
      this.error(err, 'cannot assertQueue')
      this._handleError(err)
    }
  }

  assertPriorityQueue(
    channel,
    queueName,
    maxPriority = 10,
    prefetchOrOpts = this.prefetch,
  ) {
    return this.assertQueue(channel, queueName, {
      maxPriority: +maxPriority,
      ...(typeof prefetchOrOpts === 'object'
        ? prefetchOrOpts
        : { prefetch: prefetchOrOpts }),
    })
  }

  setPrefetch(channel, prefetch = this.prefetch) {
    channel.prefetch(parseInt(prefetch))
  }

  async assertExchange(ch, exchangeName, type) {
    try {
      await ch.assertExchange(exchangeName, type, {
        durable: true,
      })
    } catch (err) {
      this.error(err, 'cannot assertExchange')
      this._handleError(err)
    }
  }

  readMessageWithAck(channel, queueName) {
    const myEmitter = new EventEmitter()
    channel.consume(queueName, msg => {
      if (msg !== null) {
        try {
          const content = msg.content.toString()
          const result = this.json ? this._parseJSON(content) : content
          if (result) {
            myEmitter.emit('data', result, err => {
              if (err) {
                channel.nack(msg)
              } else {
                channel.ack(msg)
              }
            })
            return
          }
          channel.ack(msg)
        } catch (err) {
          this.error(err, 'channel consume with ack error')
          this._handleError(err)
        }
      }
    })
    return myEmitter
  }

  readMessageWithNoAck(channel, queueName) {
    const myEmitter = new EventEmitter()
    const options = {
      noAck: true,
    }
    channel.consume(
      queueName,
      msg => {
        if (msg !== null) {
          try {
            const content = msg.content.toString()
            const result = this.json ? this._parseJSON(content) : content
            if (result) {
              myEmitter.emit('data', result)
              return
            }
          } catch (err) {
            this.error(err, 'channel consume with ack error')
            this._handleError(err)
          }
        }
      },
      options,
    )
    return myEmitter
  }

  /**
 *
 { expiration?: string | number;
        userId?: string;
        CC?: string | string[];

        mandatory?: boolean;
        persistent?: boolean;
        deliveryMode?: boolean | number;
        BCC?: string | string[];

        contentType?: string;
        contentEncoding?: string;
        headers?: any;
        priority?: number;
        correlationId?: string;
        replyTo?: string;
        messageId?: string;
        timestamp?: number;
        type?: string;
        appId?: string;
 }
*/
  sendQueueMessage(channel, queueName, message, options = {}) {
    message = typeof message === 'string' ? message : JSON.stringify(message)
    return channel.sendToQueue(queueName, Buffer.from(message), options)
  }

  publish(channel, exchangeName, message, routingKey = '*', options = {}) {
    message = typeof message === 'string' ? message : JSON.stringify(message)
    return channel.publish(
      exchangeName,
      routingKey,
      Buffer.from(message),
      options,
    )
  }

  async closeChannel(channel) {
    try {
      await channel.close()
    } catch (err) {
      this.error(err, 'error to close channel')
      this._handleError(err)
    }
  }

  async closeConnection() {
    if (!this.connection) {
      this._handleError(
        new Error('Please connect to mq first by call .connect'),
      )
    }
    try {
      await this.connection.close()
    } catch (err) {
      this.error(err, 'error to close connection')
      this._handleError(err)
    }
  }

  async purge(channel, queueName) {
    try {
      await channel.purgeQueue(queueName)
    } catch (err) {
      this.error(err, 'error to purge')
      this._handleError(err)
    }
  }

  async bindQueue(channel, queue, source, pattern) {
    try {
      await channel.bindQueue(queue, source, pattern)
    } catch (err) {
      this.error(err, 'error to bindQueue')
      this._handleError(err)
    }
  }

  async unbindQueue(channel, queue, source, pattern, callback) {
    try {
      await channel.unbindQueue(queue, source, pattern)
    } catch (err) {
      this.error(err, 'error to unBindQueue')
      this._handleError(err)
    }
  }

  async deleteQueue(
    channel,
    queueName,
    options = {
      ifUnused: false,
      ifEmpty: false,
    },
  ) {
    try {
      await channel.deleteQueue(queueName, options)
    } catch (err) {
      this.error(err, 'error to deleteQueue')
      this._handleError(err)
    }
  }

  async deleteExchange(
    channel,
    exchangeName,
    options = {
      ifUnused: false,
    },
  ) {
    try {
      await channel.deleteExchange(exchangeName, options)
    } catch (err) {
      this.error(err, 'error to deleteExchange')
      this._handleError(err)
    }
  }

  bail(err) {
    if (err) {
      this.error(err, 'process is going to exit')
      console.log('process is going to exit', err)
    } else {
      this.logger.error('process is going to exit')
      console.log('process is going to exit')
    }
    process.exit(1)
  }

  _parseJSON(content) {
    try {
      return JSON.parse(content)
    } catch (err) {
      this.error(err, 'This message content cannot parse to JSON.')
      return null
    }
  }
}
