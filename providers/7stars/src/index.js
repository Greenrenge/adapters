import Debug from 'debug'
import { RedisCookieStore } from '@greenrenge/request'
import { get, isNumber } from 'lodash'
import rp from 'request-promise'
import { fromRedis, toRedis, createLocker } from '@kkg/redis-packs'
import { options as rpOptions } from './7stars/config/request-config'
import { login, checkLoginValid } from './7stars/page/login'
import {
  listUsers,
  addCredit,
  editUser,
  getUser,
  getCreditInfo,
  removeCredit,
  resetTurnover,
  createUser,
} from './7stars/page/dashboard'
import { ERRORS } from './7stars/config/constants'
import { AuthRequired, Suppress } from './7stars/decorators'

const debug = Debug('7stars:index')

const { ANOTHER_LOGGING_IN, LOGIN_FAILED, INPUT_INVALID } = ERRORS

// @TODO: decorator for validation
export class SevenStars {
  _loginKey

  _username

  _password

  _redis

  _cookieStore

  currentSessionGuid

  requestPromise

  constructor({ username, password, redis } = {}) {
    this._username = username
    this._password = password
    this._loginKey = `7stars_login_${username}`
    const cookieKey = `7stars_cookie_${username}`
    this._redis = redis
    this._cookieStore = new RedisCookieStore({
      redis,
      key: cookieKey,
    })
    this.requestPromise = rp.defaults({
      jar: rp.jar(this._cookieStore),
      ...rpOptions,
    })
  }

  // used by AuthRequired decorator
  async loadSession() {
    this.currentSessionGuid = get(
      fromRedis(await this._redis.get(this._loginKey)),
      'sessionGuid',
    )
    debug('currentSessionGuid is ', this.currentSessionGuid)
  }

  // used by AuthRequired decorator
  async login(password) {
    if (password) {
      this._password = password
    }
    const locker = createLocker(
      this._redis.duplicate(),
      this._loginKey,
      60 * 1000,
    )
    let loginInfo
    try {
      const lockedObj = await locker.lock()
      const isStillLocked = async () =>
        toRedis(lockedObj) === toRedis(await locker.getLockedValue())
      if (!lockedObj) {
        debug('another client logging in')
        throw new Error(ANOTHER_LOGGING_IN)
      }
      const { loginInfo: _loginInfo, error, errorText } = await login(
        // error are captcha credential lock
        this.requestPromise,
        this._username,
        this._password,
        isStillLocked,
      )
      loginInfo = _loginInfo
      if (loginInfo) {
        // @TODO: check if case invalid username passwork not captcha
        this.currentSessionGuid = loginInfo.sessionGuid
        return this.currentSessionGuid
      }
      debug('cannot login')
      throw new Error(LOGIN_FAILED)
    } finally {
      await locker.unlock({
        username: this._username,
        ...loginInfo,
      })
      locker.kill()
    }
  }

  @Suppress
  async isActiveSession() {
    return await checkLoginValid(this.requestPromise, this.currentSessionGuid)
  }

  @AuthRequired
  async userInfo(userId) {
    const raw = await getUser(
      this.requestPromise,
      this.currentSessionGuid,
      userId,
    )
    if (raw) {
      return {
        credit: raw.credit,
        raw,
      }
    }
    return undefined
  }

  @Suppress
  async userExist(userId) {
    return !!(await this.userInfo(userId))
  }

  @AuthRequired
  async createUser({ password, displayName, remark, active }) {
    const { userId, userName } = await createUser(
      this.requestPromise,
      this.currentSessionGuid,
      {
        displayName,
        password,
        remark,
        active,
      },
    )
    return {
      userId,
      userName,
      password,
    }
  }

  @AuthRequired
  async adjustCredit(userId, amount, creditBefore) {
    if (!isNumber(amount)) throw new Error(INPUT_INVALID)
    const creditAduster = amount > 0 ? addCredit : removeCredit
    amount = Math.abs(amount)
    const creditAfter = await creditAduster(
      this.requestPromise,
      this.currentSessionGuid,
      {
        userId,
        amount,
        creditBefore,
      },
    )
    return {
      creditBefore,
      creditAfter,
    }
  }

  @AuthRequired
  async editUser(
    userId,
    { password, remark, active, displayName, toggleStatus },
  ) {
    const {
      displayName: displayNameAfter,
      status,
      remark: remarkAfter,
    } = await editUser(this.requestPromise, this.currentSessionGuid, userId, {
      password,
      remark,
      active,
      displayName,
      toggleStatus,
    })
    return {
      displayName: displayNameAfter,
      status,
      remark: remarkAfter,
      ...(password && { password }),
    }
  }

  async lock(userId) {
    const { status } = await this.editUser(userId, { toggleStatus: true })
    return status.toLowerCase().includes('active')
  }

  suspend(userId) {
    return this.lock(userId)
  }

  resetUserPassword(userId, newPassword) {
    return this.editUser(userId, { password: newPassword })
  }

  // @TODO: implement
  userWinloss({ userId, startDate, endDate, type }) {
    // // userId optional if not specify get all in page
    // // type: 'CASINO' | 'SPORTBOOK' | 'SLOT' | 'OTHER'
    // return {
    //   turnover: Number,
    //   stake: Number, // turnover ไม่รวมเสมอ
    //   winloss: Number,
    //   commission: Number,
    //   pagination: {
    //     // อันไหนไม่มีใส่ 1
    //     ...paginationInfo,
    //   },
  }

  /** SPECIALS */
  // @TODO: uses {error, result} manner for better control normal flow
  async checkUserLogin(username, password) {
    const { error } = await login(
      this.requestPromise,
      username,
      password,
      () => true,
    )
    if (error !== 'member') throw new Error(LOGIN_FAILED)
    return true
  }

  @AuthRequired
  async listUsers({
    page,
    limit,
    startDate,
    endDate,
    nameFilter,
    nameFilterType = 'username', // 'displayName'
  }) {
    const lowerNameFilterType = nameFilterType.toLowerCase().trim()
    return listUsers(this.requestPromise, this.currentSessionGuid, {
      CurrentPage: page,
      ItemsPerPage: limit,
      filterEnddate: endDate, // @TODO: handle locale time to MM and convert timestamp to 2020-09-17
      filterName: nameFilter,
      filterNameType:
        lowerNameFilterType === 'username'
          ? 'UserName'
          : lowerNameFilterType === 'displayname'
          ? 'DisplayName'
          : undefined,
      filterStartdate: startDate,
    })
  }

  @AuthRequired
  getCreditInfo(userId) {
    return getCreditInfo(this.requestPromise, this.currentSessionGuid, userId)
  }

  @AuthRequired
  resetTurnover(userId) {
    return resetTurnover(this.requestPromise, this.currentSessionGuid, userId)
  }
}
