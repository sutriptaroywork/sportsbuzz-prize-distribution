const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const Team = new Schema({
  sKey: { type: String, trim: true, required: true },
  sName: { type: String, trim: true },
  sShortName: { type: String, trim: true },
  sThumbUrl: { type: String, trim: true },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  sLogoUrl: { type: String, trim: true },
  sImage: { type: String, trim: true },
  eProvider: { type: String, enum: data.matchProvider, default: 'CUSTOM' },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String }
})

Team.index({ sKey: 1, eCategory: 1, eProvider: 1 }, { unique: true })

module.exports = MatchDBConnect.model('teams', Team)
