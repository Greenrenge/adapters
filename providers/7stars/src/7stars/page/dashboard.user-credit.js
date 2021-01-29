import { get, pick } from 'lodash'
import { BASE_URL, HEADERS, ERRORS } from '../config/constants'
import { normalize } from '../config/field-mapping'
import { sevenStarTransformCheckUnAuth } from '../config/request-config'
import { transform } from '../../helpers/cheerio/aspnet-forms-post'

const {
  CREDIT_NOT_MATCH,
  TOO_MANY_REQUEST,
  INPUT_INVALID,
  TURNOVER_REQUIED,
  UNKNOWN,
} = ERRORS

const addCreditKeys = [
  '__RequestVerificationToken',
  'TransAmount',
  'BonusPerc',
  'BonusAmt',
  'AmtMultiplier',
  'RolloverMultiplier',
  'CurrentRollOver',
  'TargetRollOver',
  'CreditAlert',
  'CreditLimit',
  'DailyBonusRemaining',
  'CreditAlertItg',
  'CreditLimitItg',
  'DailyBonusRemainingItg',
  'UserId',
  'UserType',
  'Username',
  'CreditBalance',
  'CreditBalanceItg',
  'DisplayName',
  'BonusDepositType',
  'PlatformType',
  'CurrencyCode',
  'PortalRoundToValue',
]

const removeCreditKeys = [
  '__RequestVerificationToken',
  'TransAmount',
  'UserId',
  'UserType',
  'Username',
  'DisplayName',
  'CurrentRollOver',
  'TargetRollOver',
  'CreditBalance',
  'CreditBalanceItg',
  'FromPrompt',
  'PlatformType',
  'AmtMultiplier',
]

const getCreditInfoRaw = async (rp, guidSessionId, userId) => {
  const { form } = await rp.get(
    `${BASE_URL}${guidSessionId}/Manager/Dashboard/Withdraw`,
    {
      qs: {
        userId,
      },
      transform: transform(sevenStarTransformCheckUnAuth, 'form', {
        valueAttribute: [
          'data-real-data',
          'data-target-rollover',
          'data-current-rollover',
        ],
        inputSelectors: [
          'input',
          'span[data-target-rollover]',
          'span[data-current-rollover]',
        ],
      }),
    },
  )
  return form
}

export const addCredit = async (
  rp,
  guidSessionId,
  { userId, amount, creditBefore, options },
) => {
  const { form } = await rp.get(
    `${BASE_URL}${guidSessionId}/Manager/Dashboard/TopUp`,
    {
      qs: {
        userId,
      },
      transform: transform(sevenStarTransformCheckUnAuth, 'form', {
        valueAttribute: 'data-real-data',
        inputSelectors: ['input', 'span[data-real-data]'],
      }),
    },
  )

  if (
    typeof creditBefore === 'number' &&
    parseFloat(form.CreditBalance) !== parseFloat(creditBefore)
  )
    throw new Error(CREDIT_NOT_MATCH)

  const res = await rp.post(
    `${BASE_URL}${guidSessionId}/Manager/Dashboard/TopUp`,
    {
      json: true,
      headers: {
        ...HEADERS,
        referer: `${BASE_URL}${guidSessionId}/Manager/Dashboard?DashboardType=2`,
      },
      qs: {
        userId,
      },
      form: pick(
        {
          ...form,
          ...options,
          TransAmount: +amount,
        },
        addCreditKeys,
      ),
    },
  )
  if (res.CreditBalance) {
    return parseFloat(res.CreditBalance.replace(/,/g, ''))
  }
  // @TODO: RequestError: Error: ESOCKETTIMEDOUT but it's successful
  // idea : stamp transaction id and cache in redis
  throw new Error(TOO_MANY_REQUEST)
}

export const getCreditInfo = async (rp, guidSessionId, userId) => {
  return normalize(await getCreditInfoRaw(rp, guidSessionId, userId), true)
}

export const removeCredit = async (
  rp,
  guidSessionId,
  { userId, amount, creditBefore },
) => {
  if (!amount || !userId) throw new Error(INPUT_INVALID)
  const form = await getCreditInfoRaw(rp, guidSessionId, userId)
  console.log('amount===>', amount) // eslint-disable-line
  if (
    typeof creditBefore === 'number' &&
    parseFloat(form.CreditBalance) !== parseFloat(creditBefore)
  )
    throw new Error(CREDIT_NOT_MATCH)

  const res = await rp.post(
    `${BASE_URL}${guidSessionId}/Manager/Dashboard/Withdraw`,
    {
      json: true,
      headers: {
        ...HEADERS,
        referer: `${BASE_URL}${guidSessionId}/Manager/Dashboard?DashboardType=2`,
      },
      qs: {
        userId,
      },
      form: pick(
        {
          ...form,
          TransAmount: +amount,
        },
        removeCreditKeys,
      ),
    },
  )
  if (res.CreditBalance) {
    return parseFloat(res.CreditBalance.replace(/,/g, ''))
  }

  if (get(res, 'AjaxReturn', '').includes('not achieved target rollover'))
    throw new Error(TURNOVER_REQUIED)

  if (get(res, 'ModelState[0]')) throw new Error(INPUT_INVALID)

  // @TODO: RequestError: Error: ESOCKETTIMEDOUT but it's successful
  // idea : stamp transaction id and cache in redis
  throw new Error(TOO_MANY_REQUEST)
}

export const resetTurnover = async (rp, guidSessionId, userId) => {
  const { __RequestVerificationToken } = await getCreditInfoRaw(
    rp,
    guidSessionId,
    userId,
  )
  const res = await rp.post(
    `${BASE_URL}${guidSessionId}/Manager/User/ResetRollOver`,
    {
      json: true,
      headers: {
        ...HEADERS,
        referer: `${BASE_URL}${guidSessionId}/Manager/Dashboard?DashboardType=2`,
      },
      qs: {
        userId,
      },
      form: {
        __RequestVerificationToken,
        PlatformType: 'Normal',
      },
    },
  )
  if (get(res, 'model.TargetRolloverAmt') !== undefined) return true
  throw new Error(UNKNOWN)
}
