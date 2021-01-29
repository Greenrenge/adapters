const Q = require('./queue')
const DQ = require('./delayed-requeue')

async function start() {
  const delayQ = new DQ({
    url: 'guest:guest@localhost',
    name: 'campaign_aghanim_*',
  })
  const queue = new Q({
    url: 'guest:guest@localhost',
    prefetch: 1,
    queueName: 'campaign_aghanim_*',
  })
  queue.on('data', (msg, done) => {
    console.log(msg)
    delayQ
      .sendQueueMessage(msg)
      .then(() => {
        console.log('reQ done')
        done()
      })
      .catch(err => done(err))
  })
  await delayQ.create({ queueName: 'campaign_aghanim_*', ttl: 60000 })
  await queue.connect()
  await queue.consume()
}
start()
