import { HEADERS as headers, ERRORS } from './constants'

const { LOGIN_REQUIRED } = ERRORS

export const sevenStarTransformCheckUnAuth = (
  body,
  response,
  resolveWithFullResponse,
) => {
  if (response.headers['content-type'].includes('json'))
    return resolveWithFullResponse ? response : response.body
  // if found login form change statuscode to 401
  if (
    response.statusCode === 200 &&
    response.headers['content-type'].includes('html') &&
    body.includes('login-form')
  ) {
    response.statusCode = 401
    if (!resolveWithFullResponse) throw new Error(LOGIN_REQUIRED)
  }

  if (resolveWithFullResponse) return response
  return response.body
}

export const options = {
  headers,
  timeout: 30000, // 30 sec
  transform: sevenStarTransformCheckUnAuth,
}
