const mongoose = require('mongoose')
const Schema = mongoose.Schema
const data = require('../../data')
const { GamesDBConnect } = require('../../database/mongoose')
const UserModel = require('./userModel')
const MatchModel = require('./matchModel')
const UserTeamModel = require('./userTeamModel')
const MatchLeagueModel = require('./matchLeagueModel')
const PromocodeModel = require('./promocodeModel')

const UserLeague = new Schema({
  iUserTeamId: { type: Schema.Types.ObjectId, ref: UserTeamModel },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  iMatchLeagueId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  nTotalPayout: { type: Number },
  nPoolPrice: { type: Boolean, default: false },
  nTotalPoints: { type: Number },
  sPayoutBreakupDesign: { type: String },
  nRank: { type: Number },
  nPrice: { type: Number }, // Real Money win
  aExtraWin: [{
    sInfo: { type: String },
    sImage: { type: String, trim: true }
  }],
  nBonusWin: { type: Number, default: 0 }, // Bonus win
  sUserName: { type: String, trim: true },
  eType: { type: String, enum: data.userTypeForJoinLeague, default: 'U' }, // U = USER B = BOT CB = COPY BOT, CMB = COMBINATION BOT
  sProPic: { type: String, trim: true },
  sTeamName: { type: String, trim: true },
  sMatchName: { type: String, trim: true },
  sLeagueName: { type: String, trim: true },
  ePlatform: { type: String, enum: data.platform, required: true }, // A = Android, I = iOS, W = Web, O = Other, AD = Admin
  iPromocodeId: { type: Schema.Types.ObjectId, ref: PromocodeModel },
  nPromoDiscount: { type: Number },
  nOriginalPrice: { type: Number },
  nPricePaid: { type: Number },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  bPointCalculated: { type: Boolean, default: false },
  bRankCalculated: { type: Boolean, default: false },
  bPrizeCalculated: { type: Boolean, default: false },
  bWinDistributed: { type: Boolean, default: false },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String },
  bCancelled: { type: Boolean, default: false },
  sType: { type: String }
})

UserLeague.index({ iMatchId: 1, iUserId: 1, iMatchLeagueId: 1, nRank: 1 })
UserLeague.index({ iMatchLeagueId: 1, nRank: 1 })
UserLeague.index({ iUserTeamId: 1, nRank: 1 })

module.exports = GamesDBConnect.model('userleagues', UserLeague)
