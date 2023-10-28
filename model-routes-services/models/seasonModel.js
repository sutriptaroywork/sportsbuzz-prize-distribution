const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { GamesDBConnect } = require('../../database/mongoose')
const data = require('../../data')

const Season = new Schema({
  sName: { type: String },
  sKey: { type: String, required: true, unique: true },
  eCategory: { type: String, enum: data.category, default: 'CRICKET' },
  dStartDate: { type: Date },
  dEndDate: { type: Date },
  eProvider: { type: String, enum: data.matchProvider, default: 'CUSTOM' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = GamesDBConnect.model('seasons', Season)
