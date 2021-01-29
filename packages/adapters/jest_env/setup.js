const MongodbMemoryServer = require('mongodb-memory-server')

/**
 * Creates in-memory MongoDb Server and puts into the global variable.
 */
console.log('global setup is run')
const MONGO_DB_NAME = 'jest'
const mongod = new MongodbMemoryServer.default({
  instance: {
    dbName: MONGO_DB_NAME
  },
  binary: {
    version: '3.2.19'
  }
})

module.exports = function () {
  global.__MONGOD__ = mongod
  global.__MONGO_DB_NAME__ = MONGO_DB_NAME
}
