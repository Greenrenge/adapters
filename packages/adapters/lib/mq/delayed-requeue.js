const amqp = require('amqplib')
const _logger = require('../../logger')('delayed-requeue')

let logger = _logger
const { Buffer } = require('safe-buffer')

class DelayedRequeue {
  constructor({ url, name }) {
    this.url = url
    this.name = name
  }

  // if there is an exchange existing, routingkey should be set to undefined, routing key will be the same as original routingkey
  async create({
    queueName,
    ttl,
    expire,
    routingKey = undefined,
    exchangeName = undefined,
    logger: customLogger,
  }) {
    if (customLogger) logger = customLogger
    this.conn = await amqp.connect(`amqp://${this.url}`)
    this.ch = await this.conn.createChannel()
    if (!exchangeName) {
      exchangeName = 'retry_exchange'
      await this.ch.assertExchange(exchangeName, 'direct')
      routingKey = queueName
      await this.ch.bindQueue(queueName, exchangeName, routingKey)
    }

    this.ch.assertQueue(`retry_${this.name}`, {
      arguments: {
        'x-dead-letter-exchange': exchangeName,
        ...(routingKey && { 'x-dead-letter-routing-key': routingKey }),
        ...(ttl && { 'x-message-ttl': +ttl }),
        ...(expire && { 'x-expires': +expire }),
      },
    })
  }

  async sendQueueMessage(message) {
    const res = this.ch.sendToQueue(
      `retry_${this.name}`,
      Buffer.from(JSON.stringify(message)),
    )
    if (res) return true

    logger.error('fail to call ch.sendQueueMessage')
    throw new Error('fail to call ch.sendQueueMessage')
  }
}

module.exports = DelayedRequeue
