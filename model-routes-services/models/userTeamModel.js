const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { FantasyTeamConnect } = require('../../database/mongoose')
const { category, userType } = require('../../data')
const UserModel = require('./userModel')
const MatchModel = require('./matchModel')
const MatchPlayerModel = require('./matchPlayerModel')

const UserTeam = new Schema({
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  sName: { type: String, trim: true, required: true },
  iCaptainId: { type: Schema.Types.ObjectId, ref: MatchPlayerModel, required: true },
  iViceCaptainId: { type: Schema.Types.ObjectId, ref: MatchPlayerModel, required: true },
  nTotalPoints: { type: Number },
  sHash: { type: String, trim: true },
  bPointCalculated: { type: Boolean, default: false },
  eCategory: { type: String, enum: category, default: 'CRICKET' },
  eType: { type: String, enum: userType, default: 'U' }, // U = USER B = BOT
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String }
})

// UserTeam.index({ iMatchId: 1, sHash: 1 })
// UserTeam.index({ iMatchId: 1, iUserId: 1 })
UserTeam.index({ iMatchId: 1, sHash: 1, bPointCalculated: 1 })
UserTeam.index({ iMatchId: 1, iUserId: 1, sName: 1, _id: 1 })

module.exports = FantasyTeamConnect.model('userteams', UserTeam)
