const fs = require('fs')
const path = require('path')
const prettierOptions = JSON.parse(
  fs.readFileSync(path.join(__dirname, './.prettierrc'), 'utf8'),
)

module.exports = {
  parser: '@babel/eslint-parser',
  parserOptions: {
    allowImportExportEverywhere: false,
  },
  extends: ['airbnb-base', 'prettier'],
  env: {
    mocha: true,
    node: true,
    es6: true,
  },
  rules: {
    'no-await-in-loop:': 'off',
    'no-restricted-syntax': [
      'error',
      'ForInStatement',
      'LabeledStatement',
      'WithStatement',
    ],
    'no-return-await': 'off',
    'prettier/prettier': [2, prettierOptions],
    'no-console': 'error',
    'func-names': ['error', 'never'],
    quotes: ['error', 'single'],
    semi: ['error', 'never'],
    'import/prefer-default-export': 'off',
    'no-underscore-dangle': 'off',
    'no-param-reassign': 'off',
    'max-len': 'off',
    'linebreak-style': 'off',
    'func-names': ['error', 'never'],
    'no-nested-ternary': 'off',
  },
  plugins: ['prettier', 'mocha'],
}
