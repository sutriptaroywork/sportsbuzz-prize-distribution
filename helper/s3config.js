// const config = require('../config/config')
// var AWS = require('aws-sdk')
// const { Buffer } = require('buffer')
// AWS.config.update({ accessKeyId: config.AWS_ACCESS_KEY, secretAccessKey: config.AWS_SECRET_KEY, signatureVersion: 'v4', region: 'ap-south-1' })
// var s3 = new AWS.S3()
// const { handleCatchError } = require('../helper/utilities.services')

// function putLogFile(sFileName, sContentType, path, fileStream) {
//   return new Promise((resolve, reject) => {
//     sFileName = sFileName.replace('/', '-')
//     sFileName = sFileName.replace(/\s/gi, '-')

//     const s3Path = path

//     const params = {
//       Bucket: config.S3_BUCKET_NAME,
//       Key: s3Path + sFileName,
//       ContentType: sContentType,
//       Body: fileStream
//     }
//     s3.upload(params, function (err, data) {
//       if (err) reject(err)
//       resolve(data)
//     })
//   })
// }

// function getFile(sFileName, path) {
//   return new Promise((resolve, reject) => {
//     const params = {
//       Bucket: config.S3_BUCKET_NAME,
//       Key: path + sFileName
//     }
//     s3.getObject(params, function (err, data) {
//       if (err) resolve(0)
//       resolve(data)
//     })
//   })
// }

// async function putLogs(filename, data) {
//   try {
//     const sFileName = `${filename}.json`
//     const file = await getFile(sFileName, config.s3PriceDistributionLog)
//     const sContentType = 'application/json'
//     const path = config.s3PriceDistributionLog
//     if (!file) {
//       const fileStream = Buffer.from(JSON.stringify([data]))
//       await putLogFile(sFileName, sContentType, path, fileStream)
//     } else {
//       const fileData = JSON.parse(file.Body.toString())
//       fileData.push(data)
//       const fileStream = Buffer.from(JSON.stringify(fileData))
//       await putLogFile(sFileName, sContentType, path, fileStream)
//     }
//   } catch (error) {
//     handleCatchError(error)
//   }
// }
// module.exports = {
//   putLogs
// }
