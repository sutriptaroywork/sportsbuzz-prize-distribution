const CommonRuleModel = require('../models/commonRuleModel')
const { CACHE_3 } = require('../../config/config')
class Rule {
  findRule (rule) {
    return CommonRuleModel.findOne({ eRule: rule.toUpperCase(), eStatus: 'Y' }).lean().cache(CACHE_3, `rule:${rule}`)
  }
}

module.exports = new Rule()
