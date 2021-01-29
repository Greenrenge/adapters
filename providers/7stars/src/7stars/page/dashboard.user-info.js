import { isEmpty, get, pick } from 'lodash'
import { BASE_URL, HEADERS, ERRORS } from '../config/constants'
import { normalize, translate } from '../config/field-mapping'
import { horizontalTable } from '../../helpers/cheerio/table-extractor'
import { transform } from '../../helpers/cheerio/aspnet-forms-post'
import { sevenStarTransformCheckUnAuth } from '../config/request-config'
import { getOnlineUserOption } from './agent-info'

const { INPUT_INVALID, TOO_MANY_REQUEST } = ERRORS
const extractPage = html => horizontalTable({ html })

const createUserKeys = [
  '__RequestVerificationToken',
  'fromUserDetail',
  'Username',
  'UserStatus',
  'DisplayName',
  'Password',
  'AllowBonus',
  'AllowBonusItg',
  'AllowBonusOverLimit',
  'AllowBonusOverLimitItg',
  'AllowRollover',
  'AllowRolloverItg',
  'AutoResetRollover',
  'AutoResetRolloverItg',
  'BonusDepositType',
  'BonusDepositTypeItg',
  'ParentUserId',
  'CurrencyId',
  'BrandId',
  'PasswordConfirm',
]

const editUserKeys = [
  '__RequestVerificationToken',
  'fromUserDetail',
  'Username',
  'UserStatus',
  'DisplayName',
  'Password',
  'AllowBonus',
  'AllowBonusItg',
  'AllowBonusOverLimit',
  'AllowBonusOverLimitItg',
  'AllowRollover',
  'AllowRolloverItg',
  'AutoResetRollover',
  'AutoResetRolloverItg',
  'BonusDepositType',
  'BonusDepositTypeItg',
  'ParentUserId',
  'CurrencyId',
  'BrandId',
  'PasswordConfirm',
  'Remarks',
]

export const getUser = async (rp, guidSessionId, userId) => {
  const page = await rp.get(`${BASE_URL}${guidSessionId}/Manager/User/Popup`, {
    qs: {
      userId,
      isView: true,
      userType: 'Member',
    },
  })
  const userObj = extractPage(page) // maybe {}
  return normalize(isEmpty(userObj) ? undefined : userObj)
}

export const editUser = async (
  rp,
  guidSessionId,
  userId,
  {
    password: Password,
    remark: Remarks,
    active: IsActive,
    displayName: DisplayName,
    toggleStatus,
  },
) => {
  const defaultUserOption = await getOnlineUserOption(rp, guidSessionId)
  const { form } = await rp.get(
    `${BASE_URL}${guidSessionId}/Manager/User/Popup`,
    {
      qs: {
        userId,
        isEdit: true,
        userType: 'Member',
      },
      transform: transform(sevenStarTransformCheckUnAuth, 'form', {
        valueAttribute: 'data-real-data',
        inputSelectors: ['input'],
      }),
    },
  )
  console.log('form.UserStatus===>', form.UserStatus) // eslint-disable-line
  const adjustedForm = {
    ...defaultUserOption,
    ...form,
    fromUserDetail: false,
    ...(toggleStatus && {
      UserStatus: +form.UserStatus === 261 ? '264' : '261',
    }),
    ...(!toggleStatus &&
      [true, false].includes(IsActive) && {
        UserStatus: IsActive ? '261' : '264', // 264=disable 261=active
      }),
    ...(Remarks && { Remarks }),
    ...(Password && { Password, PasswordConfirm: Password }),
    ...(DisplayName && { DisplayName }),
  }

  const res = await rp.post(
    `${BASE_URL}${guidSessionId}/Manager/User/Edit/${userId}`,
    {
      json: true,
      headers: {
        ...HEADERS,
        referer: `${BASE_URL}${guidSessionId}/Manager/Dashboard?DashboardType=2`,
      },
      form: pick(adjustedForm, editUserKeys),
    },
  )
  if (get(res, 'AjaxReturn') || get(res, 'ModelState[0]')) {
    // @ TODO: create custom error for this and return translated model state back to frontend
    throw new Error(INPUT_INVALID)
  }
  return normalize(pick(adjustedForm, ['UserStatus', 'DisplayName', 'Remarks']))
}

export const createUser = async (
  rp,
  guidSessionId,
  {
    displayName: DisplayName,
    remark: Remarks,
    active: IsActive = true,
    password: Password,
  },
) => {
  // TODO: validation
  const { form } = await rp.get(
    `${BASE_URL}${guidSessionId}/Manager/User/Popup`,
    {
      qs: {
        quickCreate: 'True',
        userType: 'Member',
        isEdit: 'False',
      },
      transform: transform(sevenStarTransformCheckUnAuth, 'form', {
        valueAttribute: 'data-real-data',
        inputSelectors: ['input'],
      }),
    },
  )

  const defaultUserOption = await getOnlineUserOption(rp, guidSessionId)
  const res = await rp.post(`${BASE_URL}${guidSessionId}/Manager/User/Create`, {
    qs: {
      quickCreate: 'True',
      userType: 'Member',
    },
    json: true,
    headers: {
      ...HEADERS,
      referer: `${BASE_URL}${guidSessionId}/Manager/Dashboard?DashboardType=2`,
    },
    form: pick(
      {
        ...defaultUserOption,
        ...form,
        fromUserDetail: false,
        ...([true, false].includes(IsActive) && {
          UserStatus: IsActive ? '261' : '264', // 264=disable 261=active
        }),
        ...(Remarks && { Remarks }),
        ...(Password && { Password, PasswordConfirm: Password }),
        ...(DisplayName && { DisplayName }),
      },
      createUserKeys,
    ),
  })
  if (get(res, 'AjaxReturn') || get(res, 'ModelState[0]')) {
    // @ TODO: create custom error for this and return translated model state back to frontend
    throw new Error(INPUT_INVALID)
  }
  const userId = get(get(res, 'url', '').match(/userId=([0-9]+)/), '[1]')
  if (!userId) throw new Error(TOO_MANY_REQUEST)
  return {
    userId,
    userName: form.Username,
  }
}
