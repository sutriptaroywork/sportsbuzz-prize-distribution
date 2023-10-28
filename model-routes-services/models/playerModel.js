const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const TeamModel = require('./teamModel')

const Player = new Schema({
  sKey: { type: String, trim: true, required: true },
  sName: { type: String, trim: true },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  sImage: { type: String, trim: true },
  sLogoUrl: { type: String, trim: true },
  nFantasyCredit: { type: Number }, // check
  eRole: { type: String, trim: true, enum: data.role, default: 'BATS' },
  iTeamId: { type: Schema.Types.ObjectId, ref: TeamModel }, // check
  eProvider: { type: String, enum: data.matchProvider, default: 'CUSTOM' },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String }
})

// Player.index({ sKey: 1 })
Player.index({ sKey: 1, eCategory: 1, eProvider: 1 }, { unique: true })

module.exports = MatchDBConnect.model('players', Player)
