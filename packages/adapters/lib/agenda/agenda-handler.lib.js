const Agenda = require('agenda')
const defaultLogger = require('../../logger')('agenda-handler.lib')
let _logger = defaultLogger
const { isArray } = require('lodash')
/*
 * @param {object} features.
 */
module.exports = class MyAgenda {
  constructor (features, logger) {
    if (logger) _logger = logger
    this.ch = null
    this.features = features
    // initialized after connect
    this.agenda = null
  }
  async connect ({ dbHost, collectionName, mongoClient }) {
    try {
      if (!mongoClient) {
        this.agenda = new Agenda({
          db: {
            address: dbHost,
            collection: collectionName
          },
          ssl: true,
          defaultLockLifetime: 5000
        })
      } else {
        this.agenda = new Agenda({
          mongo: mongoClient,
          ssl: true,
          defaultLockLifetime: 5000
        })
      }
      await new Promise((resolve, reject) => {
        this.agenda.on('ready', () => {
          resolve()
        })
      })
    } catch (err) {
      _logger.error('It cannot connect to mongodb', err)
      throw new Error('It cannot connect mongodb', err)
    }
  }
  async disconnect () {
    await this.agenda.stop()
  }
  /*
   * Note Before run this should check.
   * this.agenda.on('ready', () => {
   *   startAgenda(callback);
   * });
   * @param {callback} callback when started.
   */
  /**
   *
   * @param {jobTypes:Array<string>} jobTypes agenda modes to run eg.achieved_kpi
   */
  async startAgenda (jobTypes) {
    if (!isArray(jobTypes)) {
      _logger.error('no job types configured')
      throw new Error('no job types configured')
    }
    if (!this.agenda) { await this.connect() }
    _logger.info('start agenda')
    jobTypes.forEach((type) => {
      try {
        this.features[type](this.agenda)
      } catch (err) {
        _logger.error(type, `cannot be run ${err}`)
        throw err
      }
    })

    if (jobTypes && jobTypes.length) {
      await this.agenda.start()
      _logger.info(jobTypes, 'started.')
    } else {
      throw new Error('It has no job types.')
    }
  }
}
