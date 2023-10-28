const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { LeaguesDBConnect } = require('../../database/mongoose')

const LeagueCategory = new Schema({
  sTitle: { type: String, trim: true, required: true },
  nPosition: { type: Number, required: true },
  sRemark: { type: String, trim: true },
  dCreatedAt: { type: Date, default: Date.now },
  sKey: { type: String },
  sImage: { type: String },
  dUpdatedAt: { type: Date },
  sExternalId: { type: String }
})

LeagueCategory.index({ sKey: 1 })

module.exports = LeaguesDBConnect.model('leaguecategories', LeagueCategory)
