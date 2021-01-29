const amqp = require('amqplib')
const EventEmitter = require('events')
const _logger = require('../../logger')('queue')

let logger = _logger
const { Buffer } = require('safe-buffer')

class Queue extends EventEmitter {
  constructor({ url, queueName, prefetch, logger: customLogger }) {
    super()
    this.url = url
    this.queueName = queueName
    this.prefetch = prefetch
    if (customLogger) logger = customLogger
  }

  async connect() {
    this.conn = await amqp.connect(`amqp://${this.url}`)
    this.ch = await this.conn.createChannel()
    this.ch.prefetch(+this.prefetch || 50)
    logger.info(`Queue connected ${this.queueName}`)
    const timestamp = new Date().getTime()
    const hostname = require('os').hostname()
    this.consumerTag = `${hostname}.${timestamp}.${Math.round(
      Math.random() * 100,
    )}`
  }

  async consume() {
    this.ch.consume(
      this.queueName,
      msg => {
        try {
          const content = JSON.parse(msg.content.toString())
          this.emit('data', content, err => {
            return err ? this.ch.nack(msg) : this.ch.ack(msg)
          })
        } catch (err) {
          logger.error('Queue.consume', err.message)
          this.ch.nack(msg)
        }
      },
      { consumerTag: this.consumerTag },
    )
  }

  async stop() {
    this.ch.cancel(this.consumerTag)
  }

  async sendQueueMessage(message) {
    const res = this.ch.sendToQueue(
      this.queueName,
      Buffer.from(JSON.stringify(message)),
    )
    if (res) return true

    logger.error('fail to call ch.sendQueueMessage')
    throw new Error('fail to call ch.sendQueueMessage')
  }

  async sendExchangeMessage({ exchangeName, message, routingKey }) {
    const res = this.ch.publish(
      exchangeName,
      routingKey || '',
      Buffer.from(JSON.stringify(message)),
    )
    if (res) return true

    logger.error('fail to call ch.sendExchangeMessage')
    throw new Error('fail to call ch.sendExchangeMessage')
  }
}

module.exports = Queue
