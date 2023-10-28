const mongoose = require('mongoose')
const { AdminsDBConnect } = require('../../database/mongoose')
const jwt = require('jsonwebtoken')
const config = require('../../config/config')
const bcrypt = require('bcryptjs')
const saltRounds = 10
const salt = bcrypt.genSaltSync(saltRounds)
const Schema = mongoose.Schema
const RoleModel = require('./roleModel')
const data = require('../../data')

const Admin = new Schema({
  sName: { type: String, trim: true, required: true },
  sUsername: { type: String, trim: true, required: true, unique: true },
  sEmail: { type: String, trim: true, required: true, unique: true },
  sMobNum: { type: String, trim: true, required: true },
  sProPic: { type: String, trim: true },
  eType: { type: String, enum: data.adminType, required: true },
  // aPermissions is no longer in used, it's deprecated. Use iRoleId instead.
  aPermissions: [{
    // change skey
    eKey: { type: String, enum: data.adminPermission },
    eType: { type: String, enum: data.adminPermissionType } // R = READ W = WRITE N = NONE
  }],
  iRoleId: { type: mongoose.Types.ObjectId, ref: RoleModel },
  sPassword: { type: String, trim: true, required: true },
  eStatus: { type: String, enum: data.adminStatus, default: 'Y' },
  aJwtTokens: [{
    sToken: { type: String },
    sPushToken: { type: String, trim: true },
    dTimeStamp: { type: Date, default: Date.now }
  }],
  dLoginAt: { type: Date },
  dPasswordchangeAt: { type: Date },
  sVerificationToken: { type: String },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String }
})

Admin.index({ sEmail: 1, sUsername: 1 })

Admin.pre('save', function (next) {
  var admin = this
  let i
  if (admin.isModified('sName')) {
    const sName = admin.sName
    var splitFullName = sName.toLowerCase().split(' ')
    for (i = 0; i < splitFullName.length; i++) {
      splitFullName[i] = splitFullName[i].charAt(0).toUpperCase() + splitFullName[i].substring(1)
    }
    admin.sName = splitFullName.join(' ')
  }
  if (admin.isModified('sPassword')) {
    admin.sPassword = bcrypt.hashSync(admin.sPassword, salt)
  }
  if (admin.isModified('sEmail')) {
    admin.sEmail = admin.sEmail.toLowerCase()
  }
  next()
})

Admin.statics.filterData = function (admin) {
  admin.__v = undefined
  admin.sVerificationToken = undefined
  admin.aJwtTokens = undefined
  admin.sPassword = undefined
  admin.dUpdatedAt = undefined
  return admin
}

Admin.statics.findByToken = function (token) {
  var admin = this
  var decoded
  try {
    decoded = jwt.verify(token, config.JWT_SECRET)
  } catch (e) {
    return Promise.reject(e)
  }
  var query = {
    _id: decoded._id,
    'aJwtTokens.sToken': token,
    eStatus: 'Y'
  }
  return admin.findOne(query)
}

module.exports = AdminsDBConnect.model('admins', Admin)
