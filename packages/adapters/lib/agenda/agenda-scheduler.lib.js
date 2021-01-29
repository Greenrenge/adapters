const _ = require('lodash')
const microtime = require('microtime')
const promisify = require('util').promisify
const delay = promisify(setTimeout)
const _logger = require('../../logger')('agenda-handler.lib')
// ensure that only 1 code can be run at a time on a single doc work
const _LOCK_TIME = 30 * 1000 // 30sec
const LOCK_KEY = 'custom_lock_time'
const AGENDA_LOCK_KEY = `attrs.${LOCK_KEY}`

const unlock = (job) => {
  _.set(job, AGENDA_LOCK_KEY, 0)
  return job
}
const checkLock = (job) => {
  const now = microtime.now()// nanosecond
  const availbleInNano = _.get(job, AGENDA_LOCK_KEY, 0)
  if (availbleInNano === 0) {
    return 0 // available but needs to lock it first,
  }
  return (availbleInNano - now) / 1000 // ms need to invoke again
}

module.exports = class Scheduler {
  constructor (agenda, { lockTime = _LOCK_TIME } = { lockTime: _LOCK_TIME }, logger = _logger) {
    this.agenda = agenda
    this.logger = logger
    this.uniqueIndexCreated = false
    this.lockTime = lockTime
  }
  static agendaQueryBuild (key) {
    const obj = {}
    const keys = Object.keys(key)
    for (let i = 0, len = keys.length; i < len; i++) {
      obj[`data.${keys[i]}`] = key[keys[i]]
    }
    return obj
  }

  /**
 * create necessary indexes in the db
 * @return {Promise<mongoResponse>} object return from mongo.createIndex() method
 */
  async createUniqueIndex (key) {
    // https://www.guru99.com/working-mongodb-indexes.html
    // Creates an index on the specified field if the index does not already exist.
    const indexes = {}
    const keys = Object.keys(key)
    for (let i = 0, len = keys.length; i < len; i++) {
      indexes[keys[i]] = 1
    }
    await this.agenda._collection.createIndex(indexes, { unique: true })
  }
  async _tryLockJob (job) {
    const oldLock = _.get(job, AGENDA_LOCK_KEY)
    const now = microtime.now()// nanosecond
    try {
      const result = await this.agenda._collection.updateOne({ _id: job.attrs._id, [LOCK_KEY]: oldLock },
        {
          $set: {
            [LOCK_KEY]: now + (this.lockTime * 1000)
          }
        })
      // { "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
      if (result.matchedCount === 0) {
        this.logger.error(`tryLockJob cannot find job id ${job.attrs._id}`)
      }
      if (result.modifiedCount === 1) {
        return true
      } else return false
    } catch (err) {
      this.logger.error(`tryLockJob failed`, JSON.stringify({ name: err.name, message: err.message }))
      return false
    }
  }

  async _fetchJob (key) {
    const jobs = await this.agenda.jobs(Scheduler.agendaQueryBuild(key))
    return jobs && jobs.length ? jobs[0] : undefined
  }
  async getUnlockedJob (key) {
    let job = await this._fetchJob(key)
    if (!job) return undefined // new Job return undefined then

    let msToWait = checkLock(job)
    let lockComplete = false
    while (!lockComplete) {
      while (msToWait) {
        // job has been locked
        await delay(msToWait + 50)// adds 50ms more for sure
        job = await this._fetchJob(key)
        if (!job) return undefined // someone deleted doc while we were waiting for it
        msToWait = checkLock(job)
      }

      // try to lock by update mongo
      lockComplete = await this._tryLockJob(job)
    }
    // lock complete
    return job
  }
  /**
   * create or update a job and start running immediately
   * @param {Object} setting contains jobName:string, key:Object, interval:string, data:any , customSchedule : (job)=> void for custom set schedule mode
   */
  async startJob ({ jobName, key, interval, data, customSchedule = null, flowControl }) {
    let job
    try {
      // lets createUniqueIndexesFirst
      if (!this.uniqueIndexCreated) {
        await this.createUniqueIndex(Scheduler.agendaQueryBuild(key))
        this.uniqueIndexCreated = true
      }
      job = await this.getUnlockedJob(key)
      // if flow-sequence is incorrect will return here
    } catch (err) {
      this.logger.error(`Error to find job ${JSON.stringify(err)} at startJob`)
      throw err
    }
    const wrappedData = { raw: _.cloneDeep(data) }
    const mergedData = _.assign({}, wrappedData, key)
    if (job) {
      // reject if timeStamp less than job's current timestamp
      if (flowControl) {
        if (_.get(job, 'attrs.data.flow_control', -1) > +flowControl) {
          // reject
          return
        }
      }
      job.attrs.data = _.assign(job.attrs.data, _.cloneDeep(mergedData))
    } else {
      job = this.agenda.create(jobName, mergedData)
      // there was found concurrency issue with unique key **************** THIS IS MONGO findOneAndUpdate(key,{upsert:true}) issue , SO THE AGENDA SHOULD BE ONLY ONE INSTANCE
      // NOTE, OR WE FORCE DB TO HAVE UNIQUE INDEX : ref.https://docs.mongodb.com/manual/core/index-unique/
      job.unique(Scheduler.agendaQueryBuild(key))
    }
    if (!customSchedule) {
      job.repeatEvery(interval)
    } else {
      customSchedule(job)
    }
    job.enable()
    if (flowControl) {
      _.set(job, 'attrs.data.flow_control', +flowControl)
    }
    // set initial lock prop,or unlock the job
    job = unlock(job)
    try {
      // TODO **************
      // WHAT IF LOCK IS CLEARED BEFORE GO THIS LINE ?
      // SHOULD WE REJECT SAVE IF OTHER TASK WORKING ON THIS TASK INSTEAD
      await job.save()
    } catch (err) {
      this.logger.error(`Error to save job ${JSON.stringify(err)}`)
      throw err
    }
    this.logger.debug(`Create jobs complete`)
  }
  /**
  * Disable a job by specify job name and its key
  * @param {Object} criteria key:Object
  */
  async stopJob ({ key, flowControl }) {
    let job
    try {
      job = await this.getUnlockedJob(key)
    } catch (err) {
      this.logger.error(`Error during find job ${JSON.stringify(err)} for stopJob`)
      throw err
    }
    if (job) {
      if (flowControl) {
        if (_.get(job, 'attrs.data.flow_control', -1) > +flowControl) {
          // reject
          return
        }
      }
      job.disable()
      if (flowControl) {
        _.set(job, 'attrs.data.flow_control', +flowControl)
      }
      job = unlock(job)
      try {
        await job.save()
      } catch (err) {
        this.logger.error(`Error to save job ${JSON.stringify(err)} for stopJob`)
        throw err
      }
    }
  }
  /**
  * Cancel/Delete a job by specify job name and its key
  * @param {Object} criteria  key:Object
  */
  async cancelJob ({ key, flowControl }) {
    let job
    try {
      job = await this.getUnlockedJob(key)
      // check sequence of timestamp for control event flows
      if (flowControl) {
        if (_.get(job, 'attrs.data.flow_control', -1) > +flowControl) {
          // reject
          return
        }
      }
      const no = await this.agenda.cancel(Scheduler.agendaQueryBuild(key))
      this.logger.debug(`cancel jobs complete : ${no} jobs are deleted`)
    } catch (err) {
      this.logger.error(`Error to cancel job ${JSON.stringify(err)}`)
      throw err
    }
  }
}
