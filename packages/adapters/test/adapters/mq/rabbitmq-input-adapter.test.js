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
const RabbitMQInputAdapter = require('../../../input/input_adapters/mq/rabbitmq-input-adapter')

describe('RabbitMQInputAdapter constructor', () => {
  test('default constructor', () => {
    const adapter = new RabbitMQInputAdapter()
    expect(adapter.channels.length).toBe(0)
    expect(typeof adapter.handlers).toBe('object')
  })
  test('handlers constructor', () => {
    const channels = {
      facebook: () => jest.fn(),
    }
    const adapter = new RabbitMQInputAdapter(channels)
    expect(adapter.channels.length).toBe(1)
    expect(typeof adapter.handlers).toBe('object')
  })
})

describe('send task to queue adapter', () => {
  jest.setTimeout(5000)
  test('send example task', async () => {
    const taskObj = { task: 'something to do' }
    const exchangeName = 'test-exchange'
    const connectionString = process.env.MQ_URL || 'guest:guest@localhost'
    const routingKey = 'test'
    const task = Buffer.from(JSON.stringify(taskObj))

    const handlers = {
      [routingKey]: task => {
        expect(task).toMatchObject(taskObj)
      },
    }
    const adapter = new RabbitMQInputAdapter(handlers)
    await adapter.setting({
      connectionString,
      exchangeName,
      queueName: 'test-queue',
    })
    await adapter.connect()
    const connection = await amqplib.connect(`amqp://${connectionString}`)
    const ch = await connection.createChannel()
    await ch.publish(exchangeName, routingKey, task)
  })
})
