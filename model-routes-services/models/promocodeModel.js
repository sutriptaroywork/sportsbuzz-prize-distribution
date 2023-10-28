const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { PromocodesDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const LeagueModel = require('./leagueModel')
const MatchModel = require('./matchModel')

const Promocode = new Schema({
  sName: { type: String, required: true },
  sCode: { type: String, required: true },
  sInfo: { type: String, trim: true },
  bIsPercent: { type: Boolean, default: false },
  nAmount: { type: Number },
  eStatus: { type: String, enum: data.status, default: 'N' }, // Y = Active, N = Inactive
  nMinAmount: { type: Number },
  nMaxAmount: { type: Number },
  aLeagues: [{ type: Schema.Types.ObjectId, ref: LeagueModel }],
  aMatches: [{ type: Schema.Types.ObjectId, ref: MatchModel }],
  eType: { type: String, enum: data.promocodeTypes, default: 'DEPOSIT' },
  nMaxAllow: { type: Number },
  bMaxAllowForAllUser: { type: Boolean, default: false },
  // Promocode to be used Only N number of times by all the users so that i can generated limited use promocode
  nPerUserUsage: { type: Number, default: 1 },
  dStartTime: { type: Date },
  dExpireTime: { type: Date },
  nBonusExpireDays: { type: Number },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Promocode.index({ sCode: 1, eStatus: 1, eType: 1 })

module.exports = PromocodesDBConnect.model('promocodes', Promocode)
