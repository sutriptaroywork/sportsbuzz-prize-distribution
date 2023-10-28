const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const UserModel = require('./userModel')
const MatchModel = require('./matchModel')
const LeagueModel = require('./leagueModel')
const LeagueCategoryModel = require('./leagueCategoryModel')
const FilterCategoryModel = require('./filterCategoryModel')

const MatchLeague = new Schema({
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel, index: true },
  iLeagueId: { type: Schema.Types.ObjectId, ref: LeagueModel },
  iLeagueCatId: { type: Schema.Types.ObjectId, ref: LeagueCategoryModel },
  iFilterCatId: { type: Schema.Types.ObjectId, ref: FilterCategoryModel },
  sShareLink: { type: String, trim: true },
  sName: { type: String, trim: true, required: true },
  nMax: { type: Number, required: true },
  nMin: { type: Number, required: true },
  nPrice: { type: Number },
  nTotalPayout: { type: Number },
  nDeductPercent: { type: Number },
  nBonusUtil: { type: Number },
  aLeaguePrize: [{
    nRankFrom: { type: Number },
    nRankTo: { type: Number },
    nPrize: { type: Number },
    eRankType: { type: String, enum: data.leagueRankType, default: 'R' }, // R = REAL_MONEY, B = BONUS, E = EXTRA
    sInfo: { type: String },
    sImage: { type: String, trim: true }
  }],
  sLeagueCategory: { type: String },
  sFilterCategory: { type: String },
  sPayoutBreakupDesign: { type: String },
  bConfirmLeague: { type: Boolean, default: false },
  bMultipleEntry: { type: Boolean, default: false },
  bAutoCreate: { type: Boolean, default: false },
  bCancelled: { type: Boolean, default: false },
  bPoolPrize: { type: Boolean, default: false },
  bUnlimitedJoin: { type: Boolean, default: false },
  bCopyLeague: { type: Boolean },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  nPosition: { type: Number },
  nLeaguePrice: { type: Number },
  bPrizeDone: { type: Boolean, default: false },
  bWinningDone: { type: Boolean, default: false },
  nWinnersCount: { type: Number },
  nTeamJoinLimit: { type: Number, default: 1 },
  nJoined: { type: Number, default: 0 },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  bPrivateLeague: { type: Boolean, default: false },
  sFairPlay: { type: String },
  nAdminCommission: { type: Number },
  nCreatorBonusGst: { type: Number, default: 0 },
  nCreatorCommission: { type: Number },
  nLoyaltyPoint: { type: Number, default: 0 },
  bCashbackEnabled: { type: Boolean, default: false },
  nMinCashbackTeam: { type: Number, default: 0 },
  nCashbackAmount: { type: Number },
  eCashbackType: { type: String, enum: data.ruleType, default: 'B', nullable: true }, // C = CASH, B = BONUS
  bIsProcessed: { type: Boolean, default: false },
  sShareCode: { type: String },
  dCreatedAt: { type: Date, default: Date.now },
  dUpdatedAt: { type: Date },
  bInternalLeague: { type: Boolean, default: false },
  nMinTeamCount: { type: Number },
  nBotsCount: { type: Number },
  nCopyBotsPerTeam: { type: Number },
  eMatchStatus: { type: String, enum: data.matchStatus, default: 'P' },
  bBotCreate: { type: Boolean, default: false },
  nDistributedPayout: { type: Number, default: 0 },
  bCopyBotInit: { type: Boolean, default: false },
  sExternalId: { type: String }
}, {
  toObject: { virtuals: true }
})

MatchLeague.virtual('oLeagueCategory', {
  ref: LeagueCategoryModel,
  localField: 'iLeagueCatId',
  foreignField: '_id'
})

MatchLeague.index({ iMatchId: 1, bCancelled: 1, bPrizeDone: 1, eCategory: 1 })
MatchLeague.index({ iMatchId: 1, bPrivateLeague: 1, sShareCode: 1 })

module.exports = GamesDBConnect.model('matchleagues', MatchLeague)
