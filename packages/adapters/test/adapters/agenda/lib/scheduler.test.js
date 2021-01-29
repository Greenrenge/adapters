global.config = {
  log: () => ({
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }),
}
const { MongoClient } = require('mongodb')
const Agenda = require('agenda')
const Scheduler = require('../../../../lib/agenda/agenda-scheduler.lib')
const Promise = require('bluebird')
const { promisify } = require('bluebird')

const delay = promisify(setTimeout)
const _ = require('lodash')

let connection
let db
let agenda
let agendaCols
let scheduler
const jobName = 'achieved_kpi'
const key = {
  job_noti_id: '152_5aa24fa9424d913f6bae2a09',
  job_event: jobName,
}
async function findJob(query) {
  try {
    const jobs = await agenda.jobs(query)
    return jobs
  } catch (err) {
    console.log(err)
    throw err
  }
}
const data = {
  _id: '152_5aa24fa9424d913f6bae2a09',
  campaign_enabled: true,
  account_id: '152',
  campaign_id: '5aa24fa9424d913f6bae2a09',
  __v: 0,
  achieved_kpi: { enabled: true },
  emails: ['sorasak.s@zanroo.com', 'greenrenge@gmail.com'],
}
const interval = '10 minutes'

beforeAll(async () => {
  connection = await MongoClient.connect(global.__MONGO_URI__)
  db = await connection.db(global.__MONGO_DB_NAME__)
  // connection = await MongoClient.connect('mongodb://localhost')
  // db = await connection.db('campaign_noti')
  agenda = new Agenda({
    mongo: db,
    db: {
      collection: 'test_agenda',
    },
    ssl: true,
    defaultLockLifetime: 5000,
  })
  //   agenda.define('achieved_kpi', (job, cb) => {

  //   })
  await agenda.start()
  agendaCols = db.collection('test_agenda')
  scheduler = new Scheduler(agenda)
})

afterAll(async () => {
  await new Promise((resolve, reject) => {
    agenda.stop(resolve)
  })
  await connection.close()
  await db.close()
})
beforeEach(async () => {
  await agendaCols.remove({})
})
afterEach(async () => {
  await agendaCols.remove({})
})
describe('JOB NOT IN DB YET', () => {
  it('it should create a brand new job and start running', async () => {
    await scheduler.startJob({ jobName, key, interval, data })
    try {
      const jobs = await findJob(Scheduler.agendaQueryBuild(key))
      expect(jobs.length).toEqual(1)
      expect(jobs[0].attrs.disabled).toBe(false)
    } catch (err) {
      fail(err)
    }
  })
  it('if key not match it should create a new job', async () => {
    const task1 = scheduler.startJob({
      jobName,
      key: _.assign({}, key, { job_event: 'other jobName' }),
      interval,
      data,
    })
    const task2 = scheduler.startJob({
      jobName,
      key: _.assign({}, key, { job_noti_id: 'other id' }),
      interval,
      data,
    })
    const task3 = scheduler.startJob({ jobName, key, interval, data })
    await task1
    await task2
    await task3
    expect(await agendaCols.count()).toBe(3)
  })
  it('it should not remove any job if job never exist', async () => {
    const task1 = scheduler.startJob({
      jobName,
      key: _.assign({}, key, { job_event: 'other jobName' }),
      interval,
      data,
    })
    const task2 = scheduler.startJob({
      jobName,
      key: _.assign({}, key, { job_noti_id: 'other id' }),
      interval,
      data,
    })
    await task1
    await task2
    await scheduler.stopJob({ jobName, key })
    //  console.log('stopped')
    try {
      const newJob = await findJob(Scheduler.agendaQueryBuild(key))
      expect(newJob.length).toEqual(0)
      const mockJob1 = await findJob(
        Scheduler.agendaQueryBuild(
          _.assign({}, key, { job_event: 'other jobName' }),
        ),
      )
      expect(mockJob1.length).toEqual(1)
      const mockJob2 = await findJob(
        Scheduler.agendaQueryBuild(
          _.assign({}, key, { job_noti_id: 'other id' }),
        ),
      )
      expect(mockJob2.length).toEqual(1)
    } catch (err) {
      fail(err)
    }
  })
  it('it should not cancel any job if job never exist', async () => {
    const task1 = scheduler.startJob({
      jobName,
      key: _.assign({}, key, { job_event: 'other jobName' }),
      interval,
      data,
    })
    const task2 = scheduler.startJob({
      jobName,
      key: _.assign({}, key, { job_noti_id: 'other id' }),
      interval,
      data,
    })
    await task1
    await task2
    try {
      await scheduler.cancelJob({ jobName, key })
    } catch (err) {
      fail(err)
    }
    try {
      const newJob = await findJob(Scheduler.agendaQueryBuild(key))
      expect(newJob.length).toEqual(0)
      const mockJob1 = await findJob(
        Scheduler.agendaQueryBuild(
          _.assign({}, key, { job_event: 'other jobName' }),
        ),
      )
      expect(mockJob1.length).toEqual(1)
      const mockJob2 = await findJob(
        Scheduler.agendaQueryBuild(
          _.assign({}, key, { job_noti_id: 'other id' }),
        ),
      )
      expect(mockJob2.length).toEqual(1)
    } catch (err) {
      fail(err)
    }
  })
})
describe('JOB EXIST IN DB', () => {
  it('it should not duplicate the existing but change data and run it', async () => {
    await scheduler.startJob({ jobName, key, interval, data })
    const newData = _.cloneDeep(data)
    newData.emails = ['new@email.com']
    await scheduler.startJob({
      jobName,
      key,
      interval: '5 hours',
      data: newData,
    })
    expect(await agendaCols.count()).toBe(1)
    const job = await findJob(Scheduler.agendaQueryBuild(key))
    expect(job.length).toBe(1)
    expect(job[0].attrs.data.raw.emails).toEqual(['new@email.com'])
    // console.log(job[0])
    expect(job[0].attrs.repeatInterval).toBe('5 hours')
    expect(job[0].attrs.disabled).toBe(false)
  })
  it('it should cancel the existing job', async () => {
    const task1 = scheduler.startJob({
      jobName,
      key: _.assign({}, key, { job_noti_id: 'other id' }),
      interval,
      data,
    })
    const task2 = scheduler.startJob({ jobName, key, interval, data })
    await task1
    await task2
    try {
      await scheduler.cancelJob({ jobName, key })
    } catch (err) {
      fail(err)
    }
    expect(await agendaCols.count()).toBe(1)
    const job = await findJob(Scheduler.agendaQueryBuild(key))
    expect(job.length).toBe(0)
  })
  it('it should disable if job is enable', async () => {
    const task1 = scheduler.startJob({
      jobName,
      key: _.assign({}, key, { job_noti_id: 'other id' }),
      interval,
      data,
    })
    const task2 = scheduler.startJob({ jobName, key, interval, data })
    await task1
    await task2
    await scheduler.stopJob({ jobName, key })
    expect(await agendaCols.count()).toBe(2)
    const job = await findJob(Scheduler.agendaQueryBuild(key))
    expect(job.length).toBe(1)
    expect(job[0].attrs.disabled).toBe(true)
  })
})

describe('FLOW CONTROL FEATURE', () => {
  it('it should change data if flow control is greater than the old one', async () => {
    await scheduler.startJob({ jobName, key, interval, data, flowControl: 10 })
    const newData = _.cloneDeep(data)
    newData.emails = ['new@email.com']
    await scheduler.startJob({
      jobName,
      key,
      interval: '5 hours',
      data: newData,
      flowControl: 15,
    })
    expect(await agendaCols.count()).toBe(1)
    const job = await findJob(Scheduler.agendaQueryBuild(key))
    expect(job.length).toBe(1)
    expect(job[0].attrs.data.raw.emails).toEqual(['new@email.com'])
    // console.log(job[0])
    expect(job[0].attrs.repeatInterval).toBe('5 hours')
    expect(job[0].attrs.disabled).toBe(false)
  })
  it('it should not change data if flow control is less than the old one', async () => {
    await scheduler.startJob({ jobName, key, interval, data, flowControl: 10 })
    const newData = _.cloneDeep(data)
    newData.emails = ['new@email.com']
    await scheduler.startJob({
      jobName,
      key,
      interval: '5 hours',
      data: newData,
      flowControl: 5,
    })
    expect(await agendaCols.count()).toBe(1)
    const job = await findJob(Scheduler.agendaQueryBuild(key))
    expect(job.length).toBe(1)
    expect(job[0].attrs.data.raw.emails).toEqual(data.emails)
    // console.log(job[0])
    expect(job[0].attrs.repeatInterval).toBe(interval)
    expect(job[0].attrs.disabled).toBe(false)
  })
})

// describe('CONCURRENCY FEATURE', () => {
//   it('it should not allow second work to be done if the first one is not finished within the lock time (30s for default lock time)', async () => {
//     await scheduler.startJob({jobName, key, interval, data, flowControl: 10})

//     const newData1 = _.cloneDeep(data)
//     newData1.emails = [
//       '1=longtask'
//     ]

//     const newData2 = _.cloneDeep(data)
//     newData2.emails = [
//       '2=shorttask'
//     ]
//     const longTask = async () => {
//       await scheduler.startJob({jobName, key, interval: '5 hours', data: newData, flowControl: 15})
//     }
//     await scheduler.startJob({jobName, key, interval: '5 hours', data: newData, flowControl: 15})

//     expect(await agendaCols.count()).toBe(1)
//     const job = await findJob(Scheduler.agendaQueryBuild(key))
//     expect(job.length).toBe(1)
//     expect(job[0].attrs.data.raw.emails).toEqual(['new@email.com'])
//     // console.log(job[0])
//     expect(job[0].attrs.repeatInterval).toBe('5 hours')
//     expect(job[0].attrs.disabled).toBe(false)
//   })
// })
