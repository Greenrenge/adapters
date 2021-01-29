module.exports = {
  AgendaInputAdapter: require('./input_adapters/agenda/agenda-input-adapter'),
  RabbitMQInputAdapter: require('./input_adapters/mq/rabbitmq-input-adapter'),
  RedisPubSubInputAdapter: require('./input_adapters/redis/pubsub-input-adapter'),
}
