import { get } from 'lodash'
import { BASE_URL } from '../config/constants'

export const getOnlineUser = (rp, guidSessionId) =>
  rp.get(`${BASE_URL}${guidSessionId}/Manager/User/GetOnlineUserInformation`, {
    json: true,
  })

export const getOnlineUserOption = async (rp, guidSessionId) => {
  const agentUserId = get(await getOnlineUser(rp, guidSessionId), 'UserId')
  return await rp.get(
    `${BASE_URL}${guidSessionId}/Manager/User/GetUserInformation/${agentUserId}`,
  )
}
