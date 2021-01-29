/**
 * shut the MongoDB down
 */
module.exports = async function() {
  await global.__MONGOD__.stop()
  process.exit()
}
