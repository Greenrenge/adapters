const InputAdapter = require('../../../input_adapters/redis/pubsub-input-adapter')
const OutputAdapter = require('../../../output_adapters/redis/pubsub-output-adapter')

const handlers = {
  facebook: async data => {
    console.log('data come in facebook')
    console.log(data)
    // return data
  },
  instagram: async data => {
    console.log('data come in instagram')
    console.log(data)
    // return data
  },
}

const connectionString = 'redis://localhost:6379/'
const host = 'localhost'

const input = new InputAdapter(handlers)
const output = new OutputAdapter()

async function init() {
  await input.setting({
    redisConfig: { connectionString },
    acknowledgement: true,
    uniqueServiceName: 'test_01',
  })

  await output.setting({
    redisConfig: { host },
    acknowledgement: true,
    uniqueServiceName: 'test_01',
  })
}
async function main() {
  await output.connect()
  await input.connect()

  console.log('connected')

  await output.publish({
    channel: 'facebook',
    data: {
      name: 'green-fb',
      weight: 77,
    },
  })
  await output.publish({
    channel: 'instagram',
    data: {
      name: 'green-ig',
      weight: 75,
    },
  })
  try {
    await output.publish({
      channel: 'twitter',
      data: {
        name: 'green-tw',
        weight: 75,
      },
    })
  } catch (err) {
    console.log('twitter not have any subscribe , should retry')
  }
}

async function end() {
  await input.disconnect()
  await output.disconnect()
  console.log('disconnected')
}
init()
  .then(main)
  .then(end)
