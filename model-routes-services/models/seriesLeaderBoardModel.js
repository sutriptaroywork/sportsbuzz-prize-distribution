const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { SeriesLBDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const seriesLBCategoriesTemplateModel = require('./seriesLBCategoriesTemplateModel')

const SeriesLeaderBoard = new Schema({
  sName: { type: String, required: true },
  sKey: { type: String },
  sInfo: { type: String },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  eStatus: { type: String, enum: data.seriesStatus, default: 'P' },
  aSeriesCategory: [{
    sName: { type: String, required: true },
    eType: { type: String, enum: data.seriesLBCategoriesTemplateType, default: 'CONTEST_JOIN' },
    sInfo: { type: String },
    sImage: { type: String },
    sColumnText: { type: String },
    iCategoryId: { type: Schema.Types.ObjectId, ref: seriesLBCategoriesTemplateModel },
    sFirstPrize: { type: String },
    aPrizeBreakup: [{
      nRankFrom: { type: Number },
      nRankTo: { type: Number },
      nPrize: { type: Number },
      eRankType: { type: String, enum: data.leagueRankType, default: 'R' }, // R = REAL_MONEY, B = BONUS, E = EXTRA
      sInfo: { type: String },
      sImage: { type: String, trim: true }
    }],
    sContent: { type: String },
    nMaxRank: { type: Number },
    nTotalPayout: { type: Number },
    bPrizeDone: { type: Boolean, default: false },
    bWinningDone: { type: Boolean, default: false },
    sExternalId: { type: String }
  }],
  dWinDistributedAt: { type: Date },
  bPriceDone: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

SeriesLeaderBoard.index({ sKey: 1, eCategory: 1 }, { unique: true })
SeriesLeaderBoard.index({ eCategory: 1, eStatus: 1 })
SeriesLeaderBoard.index({ 'aSeriesCategory._id': 1 })

module.exports = SeriesLBDBConnect.model('seriesleaderboards', SeriesLeaderBoard)
