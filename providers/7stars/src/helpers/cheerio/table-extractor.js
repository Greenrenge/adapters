const cheerio = require('cheerio')

// find tr(s) and th=key ; td=value
const horizontalTable = ({
  html,
  rootSelector = 'table',
  pairsSelector = 'tr',
  keySelector = 'th',
  valueSelector = 'td',
}) => {
  const result = {}
  const $ = cheerio.load(html)
  const findValueForKey = function(k) {
    const v = k.next(valueSelector)
    if (!v.length) return // not found value elm
    result[k.text()] = v.first().text()
    const nextKey = v.next(keySelector)
    return nextKey.length && findValueForKey(nextKey.first())
  }
  $(pairsSelector, rootSelector).each(function(i, elm) {
    const firstKey = $(keySelector, this)
    if (firstKey.length) return findValueForKey(firstKey.first())
  })
  return result
}

module.exports = {
  horizontalTable,
}
