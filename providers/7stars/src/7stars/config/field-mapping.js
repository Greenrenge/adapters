import { fromPairs, entries } from 'lodash'

import { text, float, number } from '../../helpers/normalizer'

export const MAPPER = {
  'No.': ['no', number],
  Online: ['isOnline'],
  UserId: ['userId', text],
  'User Name': ['userName', text],
  Username: ['userName', text],
  'Member ID': ['userName', text],
  'Display Name': ['displayName', text],
  DisplayName: ['displayName', text],
  'Member Name': ['displayName', text],
  Status: ['status', text],
  UserStatus: [
    'status',
    s => (number(text(s)) === 261 ? 'Active' : 'Disabled'),
  ],
  'Credit Limit': ['creditLimit', float],
  Credit: ['credit', float],
  'PVP Credit': ['pvpCredit', float],
  Currency: ['currency', text],
  'Last Login IP': ['lastLoginIP', text],
  'Date Joined': ['createdDate'],
  'Date Created': ['createdDate'],
  Brand: ['providerName', text],
  'Credit Balance': ['credit', float],
  CreditBalance: ['credit', float],
  'Credit Balance PVP': ['pvpCredit', float],
  CreditBalanceItg: ['pvpCredit', float],
  'Total Deposit': ['depositTotal', float],
  'Total Deposit PVP': ['pvpDepositTotal', float],
  'Total Deposit Bonus': ['bonusTotal', float],
  'Total Deposit Bonus PVP': ['pvpBonusTotal', float],
  'Total Withdraw': ['withdrawTotal', float],
  'Total Withdraw PVP': ['pvpWithdrawTotal', float],
  'Deposit / Withdraw Total': ['depositWithdrawRatio', float],
  'Deposit / Withdraw Total (PVP)': ['pvpDepositWithdrawRatio', float],
  Remarks: ['remark'],
  targetRollOver: ['targetTurnover', float],
  currentRollOver: ['turnover', float],
}

export const translate = t => (MAPPER[t] ? MAPPER[t][0] : undefined)

export const normalize = (obj, exclude) =>
  obj &&
  fromPairs(
    entries(obj)
      .map(([k, v]) => {
        if (!MAPPER[k]) return exclude ? undefined : [k, v]
        const [newKey, normalizer] = MAPPER[k]
        return [newKey, normalizer ? normalizer(v) : v]
      })
      .filter(a => !!a),
  )
