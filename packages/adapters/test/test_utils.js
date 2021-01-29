const _ = require('lodash')

function copyTime(master, clone, prop) {
  if (_.get(clone, prop) && _.get(master, prop)) {
    _.set(clone, prop, _.get(master, prop))
  }
}
function userTemplateCloneUpdate(userMaster, userClone) {
  copyTime(userMaster, userClone, 'updated')
}
function normalizeMessageTime(msgMaster, msgClone) {
  userTemplateCloneUpdate(msgMaster.info.from, msgClone.info.from)
  userTemplateCloneUpdate(msgMaster.info.on, msgClone.info.on)
  userTemplateCloneUpdate(msgMaster.info.to, msgClone.info.to)
  _.each(msgClone.info.participates, user => {
    const userInMaster = _.find(msgMaster.info.participates, { _id: user._id })
    if (userInMaster) {
      userTemplateCloneUpdate(userInMaster, user)
    }
  })
  copyTime(msgMaster, msgClone, 'sys_time')
  copyTime(msgMaster, msgClone, 'cts')
  copyTime(msgMaster, msgClone, 'stat.sys_time')
}
module.exports = {
  normalizeMessageTime,
  copyTime,
}
