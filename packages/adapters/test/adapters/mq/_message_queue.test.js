const MQ_HOST = 'guest:guest@localhost'
const MessageQueue = require('../../../lib/mq/_message-queue')
const amqplib = require('amqplib')
// const jest = require('jest')
let connection
let channel

beforeAll(async () => {
  connection = await amqplib.connect(`amqp://${MQ_HOST}`)
  channel = await connection.createChannel()
})

describe('Create Connection and Channel', () => {
  let mq
  it('it should be create the connection to rabbitmq correctly', async () => {
    mq = new MessageQueue(MQ_HOST)
    await mq.connect()
    expect(mq.connection).toBeDefined()
  })

  it('it should be create the channel', async () => {
    const ch = await mq.createChannel()
    expect(ch).toBeDefined()
  })
})

describe('Priority Queue', () => {
  let mq
  const queueName = 'test-priority-queue'
  it('it should be assert priority queue with 0-20 level', async () => {
    await channel.deleteQueue(queueName)
    mq = new MessageQueue(MQ_HOST)
    await mq.connect()
    const ch = await mq.createChannel()
    await mq.assertPriorityQueue(ch, queueName, 20)
    const checkQueue = await channel.checkQueue(queueName)
    const { queue, messageCount, consumerCount } = checkQueue
    expect(queue).toEqual(queueName)
  })

  it('it should be sent the right priority to the queue directly', async () => {
    const msg = { p: 10 }
    const ch = await mq.createConfirmChannel()
    mq.sendQueueMessage(ch, queueName, msg, { priority: 10 })
    await ch.waitForConfirms()
    const msgInQ = await channel.get(queueName, { noAck: true })
    expect(msgInQ.properties.priority).toBe(10)
  })

  it('higher priority message should be send first even it comes to the last one', async () => {
    const msg = { p: 8 }
    const ch = await mq.createConfirmChannel()
    mq.sendQueueMessage(ch, queueName, msg, { priority: 8 })
    mq.sendQueueMessage(ch, queueName, msg, { priority: 8 })
    mq.sendQueueMessage(ch, queueName, msg, { priority: 8 })
    mq.sendQueueMessage(ch, queueName, msg, { priority: 8 })
    mq.sendQueueMessage(ch, queueName, msg, { priority: 8 })
    mq.sendQueueMessage(ch, queueName, msg, { priority: 8 })
    await ch.waitForConfirms()

    mq.sendQueueMessage(ch, queueName, { p: 20 }, { priority: 20 })
    await ch.waitForConfirms()

    const msgInQ = await channel.get(queueName, { noAck: true })
    expect(msgInQ.properties.priority).toBe(20)
    expect(JSON.parse(msgInQ.content)).toEqual({ p: 20 })

    const msgInQ2 = await channel.get(queueName, { noAck: true })
    expect(msgInQ2.properties.priority).toBe(8)
    expect(JSON.parse(msgInQ2.content)).toEqual({ p: 8 })
  })
})

// describe('send task to queue adapter', () => {
//   jest.setTimeout(5000)
// })
