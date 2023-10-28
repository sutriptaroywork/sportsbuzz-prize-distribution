const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { FantasyTeamConnect } = require('../../database/mongoose')
const data = require('../../data')
const TeamModel = require('./teamModel')
const MatchModel = require('./matchModel')
const MatchPlayerModel = require('./matchPlayerModel')

const MatchTeams = new Schema({
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  aPlayers: [{
    iMatchPlayerId: { type: Schema.Types.ObjectId, ref: MatchPlayerModel },
    iTeamId: { type: Schema.Types.ObjectId, ref: TeamModel },
    nScoredPoints: { type: Number, default: 0 }
  }],
  nTotalPoint: { type: Number },
  nTotalCredit: { type: Number },
  sHash: { type: String, trim: true },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String }
})

MatchTeams.index({ iMatchId: 1, sHash: 1 })

MatchTeams.virtual('oMatchPlayer', {
  ref: MatchPlayerModel,
  localField: 'aPlayers.iMatchPlayerId',
  foreignField: '_id'
})

module.exports = FantasyTeamConnect.model('matchteams', MatchTeams)
