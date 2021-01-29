global.config = {
  log: () => ({
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }),
}
const amqplib = require('amqplib')
require('dotenv').config({ path: `${__dirname}/../../.env` })

process.env.NODE_ENV = 'development'
process.env.DEBUG = '*'
const RabbitMQOutputAdapter = require('../../../output/output_adapters/mq/rabbitmq-output-adapter')

async function sleep(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

describe('receive task to queue adapter', () => {
  jest.setTimeout(5000)
  test('receive example task', async () => {
    const taskObj = { task: 'something to do' }
    const exchangeName = 'test-exchange'
    const queueName = 'test-queue'
    const routingKey = 'test'
    const connectionString = process.env.MQ_URL || 'guest:guest@localhost'
    const adapter = new RabbitMQOutputAdapter()
    await adapter.setting({
      connectionString,
      exchangeName,
      queueName,
      exchangeType: 'topic',
    })
    const connection = await amqplib.connect(`amqp://${connectionString}`)
    const ch = await connection.createChannel()

    // need to deleteExchange first to prevent not response when exchange type is not matched
    await ch.deleteExchange(exchangeName, {
      ifUnused: false,
    })
    await ch.assertQueue(queueName)
    await ch.assertExchange(exchangeName, 'topic')
    await ch.bindQueue(queueName, exchangeName, routingKey)
    sleep(2000)
    // after bind q need to wait for while
    await adapter.connect()
    await adapter.publish({ data: taskObj })

    ch.consume(queueName, task => {
      if (task) {
        const message = JSON.parse(task.content.toString())
        expect(message).toMatchObject(taskObj)
        ch.ack(task)
      }
    })
  })
})
