const Agenda = require('../../../lib/agenda/agenda-handler.lib')
const _logger = require('../../../logger')('agenda-input-adapter')
const { each, get } = require('lodash')
let logger = _logger

module.exports = class AgendaInputAdapter {
  /**
   *
   * @param {object} handlers object contains { channelName1 : handler1<Promise>},for acknowledge word handlers is async handlers
   */
  constructor (handlers) {
    this.channels = Object.keys(handlers)
    this.handlers = handlers
    this.db = 'mongodb://localhost:27017/agenda'
    this.collectionName = 'agendaJobs'
    this.lockLifetime = 2 * 60 * 1000 // default 2 mins locking time
  }
  async setting ({ db, collectionName, lockLifetime, logger: customLogger }) {
    if (customLogger) logger = customLogger
    if (db) this.db = db
    if (collectionName) this.collectionName = collectionName
    if (lockLifetime) this.lockLifetime = lockLifetime
  }
  async asyncProcess (channel, job) {
    let rawData = get(job, 'attrs.data.raw')
    if (!rawData) {
      logger.error(`no data.raw inside the agenda job agenda, send data instead`)
      rawData = get(job, 'attrs.data')
    }
    logger.debug(`send job to handler ${channel} , data ${JSON.stringify(rawData)}`)
    await this.handlers[channel](rawData, { job })
  }
  emitData (channel, job, done) {
    if (this.handlers[channel]) {
      this.asyncProcess(channel, job)
        .then(() => done())
        .catch((err) => {
          logger.error(` error found after emit data on ${channel}`, err)
          done(err)
        })
    } else {
      logger.error(`not found async handlers for ${channel}`)
    }
  }
  async connect () {
    if (this.db === 'mongodb://localhost:27017/agenda') {
      logger.warn('database is not set , default database is used.')
    }
    const feature = {}
    each(this.channels, (channel) => {
      feature[channel] = (agenda) => {
        agenda.define(channel, {
          lockLifetime: this.lockLifetime
        }, (job, done) => this.emitData(channel, job, done))
      }
    })
    this.agenda = new Agenda(feature)
    await this.agenda.connect({ dbHost: this.db, collectionName: this.collectionName })
    await this.agenda.startAgenda(this.channels)
    logger.info('Completed Initializing AGENDA')
  }
  async disconnect () {
    return new Promise((resolve, reject) => {
      try {
        this.agenda.stop(resolve)
      } catch (err) {
        reject(err)
      }
    })
  }
}
