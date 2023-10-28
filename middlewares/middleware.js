/**
 * Auth middleware containes the common methods to authenticate user or admin by token.
 * @method {validateAdmin('MATCH','R')} is for authenticating the token and make sure its a admin.
 * @method {isUserAuthenticated} is for authenticating the token.
 * @method {findByToken} is specified in user.model.js
 */
const AdminsModel = require('../model-routes-services/models/adminModel')
const RolesModel = require('../model-routes-services/models/roleModel')
const { messages, status, jsonStatus } = require('../helper/api.responses')
const { validationResult } = require('express-validator')
const mongoose = require('mongoose')
const Sentry = require('@sentry/node')

const validateAdmin = (sKey, eType) => {
  return async (req, res, next) => {
    try {
      const token = req.header('Authorization')
      req.userLanguage = 'English'
      if (!token) {
        return res.status(status.Unauthorized).jsonp({
          status: jsonStatus.Unauthorized,
          message: messages[req.userLanguage].err_unauthorized
        })
      }
      let admin
      try {
        admin = await AdminsModel.findByToken(token)
      } catch (err) {
        return res.status(status.Unauthorized).jsonp({
          status: jsonStatus.Unauthorized,
          message: messages[req.userLanguage].err_unauthorized
        })
      }
      if (!admin) {
        return res.status(status.Unauthorized).jsonp({
          status: jsonStatus.Unauthorized,
          message: messages[req.userLanguage].err_unauthorized
        })
      }
      req.admin = admin

      let errors
      if (req.admin.eType === 'SUPER') {
        errors = validationResult(req)
        if (!errors.isEmpty()) {
          return res.status(status.UnprocessableEntity).jsonp({
            status: jsonStatus.UnprocessableEntity,
            errors: errors.array()
          })
        }

        return next(null, null)
      } else {
        if (!req.admin.iRoleId) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].access_denied })

        const role = await RolesModel.findOne({ _id: mongoose.Types.ObjectId(req.admin.iRoleId), eStatus: 'Y' }, { aPermissions: 1 }).lean()
        if (!role) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].access_denied })

        const hasPermission = role.aPermissions.find((permission) => {
          return (
            permission.sKey === sKey &&
              (permission.eType === eType ||
                (eType === 'R' && permission.eType === 'W'))
          )
        })
        /* const hasPermission = req.admin.aPermissions.find((permission) => {
          return (
            permission.eKey === sKey &&
              (permission.eType === eType ||
                (eType === 'R' && permission.eType === 'W'))
          )
        }) */

        if (!hasPermission) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].access_denied
          })
        }
        errors = validationResult(req)
        if (!errors.isEmpty()) {
          return res.status(status.UnprocessableEntity).jsonp({
            status: jsonStatus.UnprocessableEntity,
            errors: errors.array()
          })
        }

        return next(null, null)
      }
    } catch (error) {
      Sentry.captureMessage(error)
      return res.status(status.InternalServerError).jsonp({
        status: jsonStatus.InternalServerError,
        message: messages[req.userLanguage].error
      })
    }
  }
}

const isAdminAuthenticated = async (req, res, next) => {
  try {
    const token = req.header('Authorization')
    const lang = req.header('Language')
    if (lang === 'English') {
      req.userLanguage = 'English'
    }
    req.userLanguage = 'English'
    if (!token) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage].err_unauthorized
      })
    }
    const admin = await AdminsModel.findByToken(token)
    if (!admin) {
      return res.status(status.Unauthorized).jsonp({
        status: jsonStatus.Unauthorized,
        message: messages[req.userLanguage].err_unauthorized
      })
    }
    req.admin = admin

    return next(null, null)
  } catch (error) {
    Sentry.captureMessage(error)
    return res.status(status.InternalServerError).jsonp({
      status: jsonStatus.InternalServerError,
      message: messages[req.userLanguage].error
    })
  }
}

const setLanguage = (req, res, next) => {
  const lang = req.header('Language')
  if (lang === 'English') {
    req.userLanguage = 'English'
  }
  req.userLanguage = 'English'

  return next(null, null)
}

const isAdminAuthorized = (sKey, eType) => {
  return async function (req, res, next) {
    if (req.admin.eType === 'SUPER') {
      next()
    } else {
      if (!req.admin.iRoleId) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].access_denied })

      const role = await RolesModel.findOne({ _id: mongoose.Types.ObjectId(req.admin.iRoleId), eStatus: 'Y' }, { aPermissions: 1 }).lean()
      if (!role) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].access_denied })

      const hasPermission = role.aPermissions.find((permission) => {
        return (
          permission.sKey === sKey &&
            (permission.eType === eType ||
              (eType === 'R' && permission.eType === 'W'))
        )
      })

      /* const hasPermission = req.admin.aPermissions.find((permission) => {
        return (
          permission.sKey === sKey &&
          (permission.eType === eType ||
            (eType === 'R' && permission.eType === 'W'))
        )
      }) */

      if (!hasPermission) {
        return res.status(status.Unauthorized).jsonp({
          status: jsonStatus.Unauthorized,
          message: messages[req.userLanguage].access_denied
        })
      }
      next()
    }
  }
}

const validate = function (req, res, next) {
  const lang = req.header('Language')
  if (lang === 'English') {
    req.userLanguage = 'English'
  }
  req.userLanguage = 'English'
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res
      .status(status.UnprocessableEntity)
      .jsonp({ status: jsonStatus.UnprocessableEntity, errors: errors.array() })
  }
  next()
}

module.exports = {
  validateAdmin,
  setLanguage,
  validate,
  isAdminAuthorized,
  isAdminAuthenticated
}
