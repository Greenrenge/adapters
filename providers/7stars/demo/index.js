/* eslint-disable no-console */
// eslint-disable-line
import Redis from 'ioredis'
import { debug, logged, createRunSuit } from '@kkg/demo'
import { SevenStars } from '../src'

const agent = new SevenStars({
  username: 'test02',
  password: 'aabb1122',
  redis: new Redis(),
})
const { Run, Suit } = createRunSuit()

@Suit
class Demo {
  @debug('*7stars*')
  static login() {
    return agent.login()
  }

  @debug('*7stars*')
  static async loginWrongPassword() {
    const correct = agent._password
    agent._password = 'wrong'
    try {
      return await agent.login()
    } catch (err) {
      agent._password = correct
      return err
    }
  }

  @debug('*7stars*')
  static getUserInfo() {
    return agent.userInfo('12099')
  }

  @debug('*7stars*')
  static isActiveSession() {
    return agent.isActiveSession()
  }

  @debug('*7stars*')
  static userExist() {
    return agent.userExist()
  }

  @debug('*7stars*')
  static createUser() {
    return agent.createUser({
      password: 'a1111111',
      active: true,
      displayName: 'from demo',
      remark: 'created by demo',
    })
  }

  @debug('*7stars*')
  static addCredit() {
    return agent.adjustCredit('12099', 1000, 0)
  }

  @debug('*7stars*')
  static removeCredit() {
    return agent.adjustCredit('12099', -1000, 1000)
  }

  @debug('*7stars*')
  static editUser() {
    return agent.editUser('12099', {
      displayName: `set from demo ${new Date()}`,
      remark: `set from demo ${new Date()}`,
    })
  }

  @debug('*7stars*')
  static lock() {
    return agent.lock('12099')
  }

  @debug('*7stars*')
  static suspend() {
    return agent.suspend('12099')
  }

  @debug('*7stars*')
  static resetUserPassword() {
    return agent.resetUserPassword('12099', 'a2222222')
  }

  @debug('*7stars*')
  static checkUserLoginThatInvalid() {
    return agent.checkUserLogin('1331313759', 'a111111')
  }

  @Run
  @debug('*7stars*')
  static checkUserLoginThatValid() {
    return agent.checkUserLogin('1331313759', 'a2222222')
  }
}

Demo.run()
