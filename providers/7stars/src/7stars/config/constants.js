export const BASE_URL = 'https://mmr1.my7stars.com:8443/'

export const HEADERS = {
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
  'accept-language': 'en-US,en;q=0.9,th;q=0.8,ja;q=0.7',
  'cache-control': 'max-age=0',
  'content-type': 'application/x-www-form-urlencoded',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  referrer: `${BASE_URL}/User/Login`,
}

export const ERRORS = {
  ANOTHER_LOGGING_IN: 'concurrency_login',
  LOGIN_FAILED: 'login_failed',
  LOGIN_REQUIRED: 'login_required',
  CREDIT_NOT_MATCH: 'credit_not_synchonized',
  TOO_MANY_REQUEST: 'too_many_request',
  INPUT_INVALID: 'input_validation_failed',
  TURNOVER_REQUIED: 'turnover_not_enough',
  UNKNOWN: 'unknown',
}
