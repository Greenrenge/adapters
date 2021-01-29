import Debug from 'debug'
import cheerio from 'cheerio'
import { get } from 'lodash'
import { retryUntil } from '@kkg/async-packs'
import { Tesseract } from '@kkg/captcha-packs'
import { BASE_URL } from '../config/constants'
import { getFormsParams } from '../../helpers/cheerio/aspnet-forms-post'

const debug = Debug('7stars:login')

const extractPage = html => {
  const { form } = getFormsParams(html, 'fieldset.login-form form')
  return {
    ...form,
    captchaImgUrl: `${BASE_URL}BotDetectCaptcha.ashx?get=image&c=LoginCaptcha&t=${form.BDC_VCID_LoginCaptcha}`,
  }
}

const extractLoginInfo = html => {
  const $ = cheerio.load(html)
  const notiText = ($('div.notification[role="alert"]').text() || '')
    .replace(/\n*[^0-9a-zA-Z\s\\.]*/g, '')
    .split(/\s+/g)
    .join(' ')
  const captchaErrorText = $(
    'span.field-validation-error[data-valmsg-for="Captcha"]',
  ).text()
  const alertText = captchaErrorText || notiText
  const path = $('body').get(0).attribs['data-up-url'] || ''
  const loginInfo = path && {
    sessionGuid: path.split('/').filter(a => !!a)[0],
    userId: (
      path
        .split('/')
        .filter(a => !!a)
        .pop() || ''
    ).split('=')[1],
  }

  return {
    error: captchaErrorText
      ? 'captcha'
      : alertText.includes('locked')
      ? 'lock'
      : alertText.includes('Username')
      ? 'credential'
      : loginInfo
      ? undefined
      : 'member',
    errorText: alertText || undefined,
    loginInfo: loginInfo || undefined,
  }
}

// 'div.notification[role='alert']
// @TODO: translate the error to {error:'captcha'} or {error:'credential"}

const loggingIn = (rp, form) =>
  rp.post(`${BASE_URL}User/Login`, {
    followAllRedirects: true,
    resolveWithFullResponse: true,
    form,
  })

const tryCaptcha = (rp, imageUrl) =>
  retryUntil(
    async () => {
      const img = await rp.get(`${imageUrl}&d=${new Date().getTime()}`, {
        encoding: null,
      })
      const {
        data: { text, confidence },
      } = await Tesseract.captcha(img)
      debug('.. cracking captcha', text, ' at ', confidence)
      if (/^[0-9]{5}$/.test(+text) && confidence > 70) return String(+text)
      return ''
    },
    a => !!a,
    10,
  )

export const login = async (rp, Username, Password, canRetry) =>
  retryUntil(
    async () => {
      const { body: loginRes } = await rp.get(`${BASE_URL}User/Login`, {
        // prevent transform that solve to 401 throws an error
        resolveWithFullResponse: true,
      })
      const { captchaImgUrl, ...formValues } = extractPage(loginRes)
      const Captcha = await tryCaptcha(rp, captchaImgUrl)
      debug('select captcha', Captcha)
      if (!Captcha) return { error: 'captcha' } // retry
      const { body: html } = await loggingIn(rp, {
        ...formValues,
        Captcha,
        Username,
        Password,
      })
      const extractResult = extractLoginInfo(html)
      const { error, errorText, loginInfo } = extractResult
      if (!loginInfo) {
        debug('logging in failed')
        debug('error', error)
        debug('errorText', errorText)
      }
      return extractResult
    },
    async a => get(a, 'error') !== 'captcha' || !(await canRetry()),
    5,
  )

export const checkLoginValid = (rp, guidSessionId) =>
  rp
    .get(`${BASE_URL}${guidSessionId}/Manager/User/GetOnlineUserInformation`, {
      resolveWithFullResponse: true,
      followAllRedirects: false,
    })
    .then(res => {
      return res.statusCode === 200
    })
