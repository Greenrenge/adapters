
module.exports = {
  // collectCoverage: true,// equals to --coverage
  collectCoverageFrom: [
    '**/*.{js,jsx}',
    '!**/node_modules/**',
    '!**/server/helpers/lib/**',
    '!**/server/helpers/*{error,Error}.js',
    '!**/*firebase*.*',
    '!**/*mobile*.*',
    '!**/coverage/**',
    '!**/jest_env/**',
    '!**jest**',
    '!**/vendor/**'
  ],
  coverageDirectory: './coverage',
  globalSetup: './jest_env/setup.js',
  globalTeardown: './jest_env/teardown.js',
  testEnvironment: './jest_env/mongo-environment.js'
  // testEnvironment: 'node'
}
