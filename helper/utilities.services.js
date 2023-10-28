const data = require('../data')
/* eslint-disable no-prototype-builtins */
/**
 * Utilities Services is for common, simple & reusable methods,
 * @method {removenull} is for removing null key:value pair from the passed object
 * @method {sendmail} is for generating trasport and sending mail with specified mailOptions Object And returns a promise ex: { from:'', to:'',subject: '', html: '' }
 */

// const fs = require('fs')
const { messages, status, jsonStatus } = require('./api.responses')
// const errorLogs = fs.createWriteStream('error.log', { flags: 'a' })
const Sentry = require('@sentry/node')

const removenull = (obj) => {
  for (var propName in obj) {
    if (obj[propName] === null || obj[propName] === undefined || obj[propName] === '') {
      delete obj[propName]
    }
  }
}

const getStatisticsSportsKey = (categoryName) => {
  if (!data.category.includes(categoryName)) return ''
  return `o${categoryName.charAt(0).toUpperCase()}${categoryName.slice(1).toLowerCase()}`
}

const removeDuplicates = (arr) => {
  if (toString.call(arr) === '[object Array]') {
    const uniqueNumbersArray = []
    arr.map(number => {
      if (!uniqueNumbersArray.includes(number)) {
        uniqueNumbersArray.push(number)
      }
    })
    return uniqueNumbersArray
  }
  return []
}

const catchError = (name, error, req, res) => {
  handleCatchError(error)
  return res.status(status.InternalServerError).jsonp({
    status: jsonStatus.InternalServerError,
    message: messages[req.userLanguage].error
  })
}

const handleCatchError = (error) => {
  if (process.env.NODE_ENV !== 'dev') Sentry.captureMessage(error)
  console.log('**********ERROR************', error)
}

const pick = (object, keys) => {
  return keys.reduce((obj, key) => {
    if (object && object.hasOwnProperty(key)) {
      obj[key] = object[key]
    }
    return obj
  }, {})
}

const checkAlphanumeric = (input) => {
  var letters = /^[0-9a-zA-Z]+$/
  if (input.match(letters)) return true
  else return false
}

const randomStr = (len, type) => {
  let char = ''
  if (type === 'referral' || type === 'private') {
    char = '0123456789abcdefghijklmnopqrstuvwxyz'
  } else if (type === 'otp') {
    char = '0123456789'
  }
  let val = ''
  for (var i = len; i > 0; i--) {
    val += char[Math.floor(Math.random() * char.length)]
  }

  if (val.length === len) {
    return val
  } else {
    randomStr(len, type)
  }
}

/**
 * to convert string / number to fix length decimal value
 * @param  {number || string} number
 * @param  {number} length=2
 * @return  {number}
 */
const convertToDecimal = (number, length = 2) => Number(parseFloat(number).toFixed(length))

module.exports = {
  removenull,
  catchError,
  handleCatchError,
  pick,
  checkAlphanumeric,
  randomStr,
  removeDuplicates,
  getStatisticsSportsKey,
  convertToDecimal
}
