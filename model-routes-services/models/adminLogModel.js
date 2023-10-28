const mongoose = require('mongoose')
const { AdminsDBConnect } = require('../../database/mongoose')
const Schema = mongoose.Schema
const { adminLogKeys } = require('../../data')
const AdminModel = require('./adminModel')
const UserModel = require('./userModel')

const AdminLogs = new Schema({
  eKey: { type: String, trim: true, required: true, enum: adminLogKeys },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  oOldFields: { type: Object },
  oNewFields: { type: Object },
  oDetails: { type: Object },
  sIP: { type: String },
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = AdminsDBConnect.model('adminlogs', AdminLogs)
