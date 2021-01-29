import cheerio from 'cheerio'
import { isArray } from 'lodash'

export const getFormsParams = (
  html,
  selector = 'form',
  { valueAttribute = 'data-real-data', inputSelectors = ['input'] } = {
    valueAttribute: 'data-real-data',
    inputSelectors: ['input'],
  },
) => {
  const $ = cheerio.load(html)
  const form = {}
  const selectOptions = {}
  const node = $(selector).first()
  const method = node.attr('method') || 'POST'
  const path = node.attr('action') || ''
  if (!isArray(valueAttribute)) valueAttribute = [valueAttribute]

  const makeMockInput = (root, fieldName, attrValName) =>
    function(i, elm) {
      fieldName = fieldName || elm.attribs.name || elm.attribs.id
      attrValName = attrValName || valueAttribute[0] || 'value'
      const valueFromSelector = valueAttribute
        .map(a => elm.attribs[a])
        .filter(a => !!a)
      const val = valueFromSelector.length
        ? valueFromSelector[0]
        : elm.attribs.value || $(elm).text() || ''
      root.append(`<input name="${fieldName}" ${attrValName}="${val}" />`)
    }
  $('textarea').each(makeMockInput(node))
  $('select').each(function(i, elm) {
    const fieldName = elm.attribs.name || elm.attribs.id
    const attrValName = valueAttribute[0] || 'value'
    const selectRoot = $(this)
    const options = $('option', selectRoot)

    const mockInput = makeMockInput(selectRoot, fieldName, attrValName)

    // append the selected first for default value
    options.filter('[selected]').each(mockInput)
    options.filter(':not([selected])').each(mockInput)
  })

  inputSelectors.forEach(inputSelector =>
    node.find(inputSelector).each(function(i, elm) {
      const fieldName = elm.attribs.name || elm.attribs.id
      const valueFromSelector = valueAttribute
        .map(a => elm.attribs[a])
        .filter(a => !!a)
      const val = valueFromSelector.length
        ? valueFromSelector[0]
        : elm.attribs.value || $(elm).text() || ''

      if (!form[fieldName]) {
        form[fieldName] = val
        return
      }

      if (elm.attribs.type === 'hidden') {
        return
      }

      if (selectOptions[fieldName]) {
        selectOptions[fieldName].push(val) // exclude if its hidden
        return
      }
      selectOptions[fieldName] = [form[fieldName], val]
    }),
  )
  return {
    method,
    path,
    selectOptions,
    form,
  }
}

export const transform = (
  defaultTransforms,
  selector = 'form',
  { valueAttribute = 'data-real-data', inputSelectors = ['input'] } = {
    valueAttribute: 'data-real-data',
    inputSelectors: ['input'],
  },
) => (body, response, resolveWithFullResponse) => {
  const transformedBody = defaultTransforms
    ? defaultTransforms(body, response, resolveWithFullResponse)
    : body
  return getFormsParams(transformedBody, selector, {
    valueAttribute,
    inputSelectors,
  })
}
