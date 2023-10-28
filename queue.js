const { processUserTds, winBySeriesV2, winDistributionByLeagueOld } = require('./model-routes-services/services/winDistribution')
const PrizeDistributionLogModel = require('./model-routes-services/models/prizeDistributionLogModel')
const { queuePush, queuePop, redisClient } = require('./helper/redis')
const { handleCatchError } = require('./helper/utilities.services')
// const { calculateTotalScorePointV2 } = require('./model-routes-services/services/pointCalculation')
// const { generateUserTeamRankByLeague } = require('./model-routes-services/services/rankCalculation')
// const { prizeDistributionByLeague } = require('./model-routes-services/services/prizeDistribution')
const { bAllowDiskUse } = require('./config/config')
const matchLeagueServices = require('./model-routes-services/services/matchLeague')
let dSchedulerCalledAt = new Date()

async function putLogsQueue() {
  let data
  try {
    // data = await queuePop('ProcessBucketLogs')
    // if (!data) {
    //   setTimeout(() => { putLogsQueue() }, 2000)
    //   return
    // }
    // // data = JSON.parse(data)

    // // const { fileName, putData } = data
    // // await storePrizeDistributionLogs(fileName, putData)

    // putLogsQueue()
  } catch (error) {
    // await queuePush('dead:ProcessBucketLogs', data)
    // handleCatchError(error)
    // setTimeout(() => { putLogsQueue() }, 2000)
  }
}

async function storePrizeDistributionLogs(sKey, oLogData) {
  try {
    const data = await PrizeDistributionLogModel.aggregate(
      [
        { $match: { sKey } },
        { $project: { size: { $size: '$aData' }, dCreatedAt: 1 } },
        { $sort: { dCreatedAt: -1 } },
        { $limit: 1 }
      ])
      .allowDiskUse(bAllowDiskUse).exec()
    // const data = await PrizeDistributionLogModel.countDocuments({ sKey, aData: { $size: { $lte: 1000 } } })
    if (!data.length || data[0].size > 1000) {
      await PrizeDistributionLogModel.create({ sKey, aData: [oLogData] })
    } else {
      await PrizeDistributionLogModel.updateOne({ sKey }, { $push: { aData: oLogData } })
    }
  } catch (error) {
    handleCatchError(error)
  }
}

// shceduler - used for bot
async function taskScheduler() {
  let data
  try {
    dSchedulerCalledAt = new Date()
    data = await redisClient.zrevrangebyscore([
      'scheduler',
      Math.floor(+new Date()),
      0,
      'WITHSCORES',
      'LIMIT',
      0,
      100
    ])

    if (!data.length) {
      setTimeout(() => { taskScheduler() }, 2000)
      return
    }

    const parsedData = []
    for (let i = 0; i < data.length; i++) {
      if (i % 2 === 0) parsedData.push(JSON.parse([data[i]]))
    }

    const obj = {}
    parsedData.forEach((data) => {
      const { queueName } = data
      if (obj[queueName]) obj[queueName] = [...obj[queueName], JSON.stringify(data)]
      else obj[queueName] = [JSON.stringify(data)]
    })

    const queuePushData = []
    const removeData = []
    Object.keys(obj).forEach((queue) => {
      queuePushData.push(redisClient.rpush(queue, ...obj[queue]))
      removeData.push(redisClient.zrem('scheduler', ...obj[queue]))
    })
    await Promise.all(queuePushData)
    await Promise.all(removeData)

    taskScheduler()
  } catch (error) {
    await queuePush('dead:scheduler', data)
    taskScheduler()
  }
}

// function reInvokeTaskScheduler() {
//   try {
//     const timeDiff = (new Date().getTime() - dSchedulerCalledAt.getTime()) / 1000
//     if (timeDiff > 20) {
//       console.log(`%c********************* Reinvoking taskScheduler at ${new Date()} *************************`, 'color: red; background: yellow; font-size: 30px')
//       taskScheduler()
//     }
//   } catch (error) {
//     handleCatchError(error)
//   }
// }

// eslint-disable-next-line no-unused-vars
async function processMatchLeaguePlayReturn() {
  let data
  try {
    data = await queuePop('ProcessPlayReturn')
    if (!data) {
      setTimeout(() => { processMatchLeaguePlayReturn() }, 2000)
      return
    }
    const { matchLeague, type, iAdminId = null, sIP = '', sOperationBy = 'CRON', nJoined = '', uniqueUserJoinCount = '' } = data
    await matchLeagueServices.processPlayReturn(matchLeague, type, iAdminId, sIP, sOperationBy, nJoined, uniqueUserJoinCount)
    processMatchLeaguePlayReturn()
  } catch (error) {
    await queuePush('dead:ProcessPlayReturn', data)
    processMatchLeaguePlayReturn()
  }
}

setTimeout(() => {
  putLogsQueue()
  // calculateTotalScorePointV2()
  // generateUserTeamRankByLeague()
  // prizeDistributionByLeague()
  // winDistributionByLeague()
  winDistributionByLeagueOld()
  winBySeriesV2()
  taskScheduler()
  processUserTds()
}, 2000)

// setInterval(() => {
//   reInvokeTaskScheduler()
// }, 5000)
