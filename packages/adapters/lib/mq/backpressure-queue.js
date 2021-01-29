const amqp = require('amqplib')

const delay = ms =>
  new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })

async function getSendQueue({ mqConnectionString, queueName, queueLength }) {
  const conn = await amqp.connect(mqConnectionString)
  const ch = await conn.createConfirmChannel()
  const { queue, messageCount, consumerCount } = await ch.assertQueue(
    queueName,
    {
      maxLength: +queueLength,
      overflow: 'reject-publish',
    },
  )
  return item =>
    new Promise((resolve, reject) => {
      ch.sendToQueue(queueName, Buffer.from(JSON.stringify(item)), {}, err => {
        if (err) reject(err)
        else resolve()
      })
    })
}

module.exports = class BackPressureQueue {
  constructor({
    readableStream,
    mqConnectionString,
    queueName,
    queueLength = 100000,
    retryInMs = 1000,
    onSuccess,
  }) {
    this.processedCount = 0
    this.lastFinish = undefined
    this.sendQueue = undefined
    this.readableStream = readableStream
    this.mqConnectionString = mqConnectionString.startsWith('amqp://')
      ? mqConnectionString
      : `amqp://${mqConnectionString}`
    this.queueName = queueName
    this.queueLength = queueLength
    this.retryInMs = retryInMs
    this.onSuccess = onSuccess
  }

  async connect() {
    this.sendQueue = await getSendQueue({
      mqConnectionString: this.mqConnectionString,
      queueLength: this.queueLength,
      queueName: this.queueName,
    })
  }

  async start() {
    if (!this.sendQueue)
      throw new Error('please call connect() before calling start()')
    for await (const item of this.readableStream) {
      while (true) {
        try {
          await this.sendQueue(item)
          this.processedCount++
          this.lastFinish = item
          if (this.onSuccess) {
            this.onSuccess(item)
          }
          break
        } catch (err) {
          await delay(this.retryInMs)
        }
      }
    }
  }
}
