import mockedEnv from 'mocked-env'

process.env.NODE_ENV = 'test'

describe('Test', () => {
  let restore
  before(() => {
    restore = mockedEnv({
      NODE_ENV: 'production',
    })
  })
  after(() => {
    restore()
  })
  context('change env to production', () => {
    it('should change env to production', () => {
      process.env.NODE_ENV.should.be.eq('production')
    })
  })
})
