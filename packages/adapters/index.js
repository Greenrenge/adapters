module.exports = {
  input: require('./input'),
  output: require('./output'),
  lib: {
    AgendaScheduler: require('./lib/agenda/agenda-scheduler.lib'),
    AgendaHandler: require('./lib/agenda/agenda-handler.lib'),
    amqpMessageQueue: require('./lib/mq/_message-queue'),
    Queue: require('./lib/mq/queue'),
    DelayedRequeue: require('./lib/mq/delayed-requeue'),
  },
}
