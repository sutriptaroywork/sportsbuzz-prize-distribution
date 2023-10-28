const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { MatchDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const TeamModel = require('./teamModel')
const SeriesLeaderBoardModel = require('./seriesLeaderBoardModel')
const SeasonModel = require('./seasonModel')

const Match = new Schema({
  sKey: { type: String, trim: true },
  eFormat: { type: String, enum: data.format },
  sName: { type: String, trim: true },
  sSponsoredText: { type: String, trim: true },
  sSeasonKey: { type: String, trim: true },
  sVenue: { type: String, trim: true },
  eStatus: { type: String, enum: data.matchStatus, default: 'P' },
  dStartDate: { type: Date, required: true },
  oHomeTeam: {
    iTeamId: { type: Schema.Types.ObjectId, ref: TeamModel },
    sKey: { type: String, trim: true, required: true },
    sName: { type: String, trim: true },
    sShortName: { type: String },
    sImage: { type: String, trim: true },
    nScore: { type: String }
  },
  oAwayTeam: {
    iTeamId: { type: Schema.Types.ObjectId, ref: TeamModel },
    sKey: { type: String, trim: true, required: true },
    sName: { type: String, trim: true },
    sShortName: { type: String },
    sImage: { type: String, trim: true },
    nScore: { type: String }
  },
  sWinning: { type: String },
  iTossWinnerId: { type: Schema.Types.ObjectId, ref: TeamModel },
  eTossWinnerAction: { type: String, enum: data.matchTossWinnerAction },
  bMatchOnTop: { type: Boolean, default: false },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  sInfo: { type: String, trim: true },
  nLatestInningNumber: { type: Number },
  aPlayerRole: [{
    sName: { type: String, trim: true, required: true },
    nMax: { type: Number, required: true },
    nMin: { type: Number, required: true }
  }],
  bScorecardShow: { type: Boolean, default: false },
  sLeagueText: { type: String },
  sSeasonName: { type: String, trim: true },
  nMaxTeamLimit: { type: Number },
  iSeriesId: { type: Schema.Types.ObjectId, ref: SeriesLeaderBoardModel },
  iSeasonId: { type: Schema.Types.ObjectId, ref: SeasonModel },
  bDisabled: { type: Boolean, default: false },
  eProvider: { type: String, enum: data.matchProvider, default: 'CUSTOM' },
  bLineupsOut: { type: Boolean, default: false },
  sFantasyPost: { type: String },
  sStreamUrl: { type: String, trim: true },
  nRankCount: { type: Number, default: 0 },
  nPrizeCount: { type: Number, default: 0 },
  nWinDistCount: { type: Number, default: 0 },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String }
})

Match.index({ eCategory: 1, eStatus: 1, sKey: 1 })
Match.index({ eStatus: 1, dStartDate: 1 })

Match.virtual('oSeries', {
  ref: SeriesLeaderBoardModel,
  localField: 'iSeriesId',
  foreignField: '_id',
  justOne: true
})

Match.virtual('oSeason', {
  ref: SeasonModel,
  localField: 'iSeasonId',
  foreignField: '_id',
  justOne: true
})

module.exports = MatchDBConnect.model('matches', Match)
