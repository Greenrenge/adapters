// https://mmr1.my7stars.com:8443/982b47b78f044c7097e357fae7c3bc14/Manager/Dashboard?DashboardType=2&ItemsPerPage=1000&filterName=green&filterNameType=UserName&filterStartdate=2020-09-10&filterEnddate=2020-09-17&userId=2082&CurrentPage=1`
import cheerio from 'cheerio'
import { get, fromPairs, entries } from 'lodash'
import { BASE_URL } from '../config/constants'
import { float as f, text as t } from '../../helpers/normalizer'
import { translate } from '../config/field-mapping'

const text = v => v.text()
const number = v => +v.text()
const float = v => f(v.text())

const CONFIGS = fromPairs(
  entries({
    'No.': [number, ''],
    Online: [a => !a.attribs.src.includes('offline'), 'img'],
    'User Name': [a => get(a.children[0], 'data'), 'a'],
    'Display Name': [text, ''],
    Status: [
      a =>
        get(a.children[0], 'data', '')
          .split(/[\n\s+|]/g)
          .filter(s => !!s)[0],
      'span',
    ],
    'Credit Limit': [float],
    Credit: [float],
    'PVP Credit': [float],
    Currency: [text],
    'Last Login IP': [text],
    'Date Joined': [text],
  }).map(([k, v]) => v.unshift(translate(k)) && [k, v]),
)

const extractPage = html => {
  const $ = cheerio.load(html)
  const table = $('table.table tr')
  const COLUMNS_MAPPER = []
  const header = table.first()

  header.find('th').each(function() {
    COLUMNS_MAPPER.push(CONFIGS[t($(this).text())])
  })

  const rows = table.filter(i => i !== 0) // remove header
  return rows
    .map(function(_, elm) {
      const userId = get(elm.attribs, 'id').split('_')[1]
      const pairs = []
      $('td', this).each(function(i) {
        if (!COLUMNS_MAPPER[i]) return
        const [fieldName, valueExtractFn, selector] = COLUMNS_MAPPER[i]
        const value = valueExtractFn(
          selector ? $(selector, this).get(0) : $(this),
        )
        pairs.push([fieldName, value])
      })
      return {
        ...fromPairs(pairs),
        userId,
      }
    })
    .get()
}

export const listUsers = async (
  rp,
  guidSessionId,
  {
    ItemsPerPage = 100,
    filterName = '',
    filterNameType = 'UserName', // DisplayName
    filterStartdate = '',
    filterEnddate = '',
    CurrentPage = 1,
  } = {
    ItemsPerPage: 100,
    filterName: '',
    filterNameType: 'UserName', // DisplayName
    filterStartdate: '', // 2020-09-17
    filterEnddate: '',
    CurrentPage: 1,
  },
) => {
  const res = await rp.get(
    `${BASE_URL}${guidSessionId}/Manager/Dashboard?DashboardType=2`,
    {
      qs: {
        ...(ItemsPerPage && { ItemsPerPage }),
        ...(filterName && { filterName }),
        ...(filterNameType && { filterNameType }),
        ...(filterStartdate && { filterStartdate }),
        ...(filterEnddate && { filterEnddate }),
        ...(CurrentPage && { CurrentPage }),
      },
    },
  )
  return extractPage(res)
}
