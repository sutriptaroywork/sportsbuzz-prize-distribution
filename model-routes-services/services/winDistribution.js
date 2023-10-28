const { queuePush, queuePop, queueLPush, bulkQueuePush, setWinData, getWinData } = require('../../helper/redis')
const { handleCatchError, getStatisticsSportsKey, convertToDecimal } = require('../../helper/utilities.services')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { Op, literal, Transaction } = require('sequelize')
const db = require('../../database/sequelize')
const UserLeagueModel = require('../models/userLeagueModel')
const { GamesDBConnect } = require('../../database/mongoose')
const userBalanceServices = require('./userBalance')
const MyMatchesModel = require('../models/myMatchesModel')
const UserModel = require('../models/userModel')
const StatisticsModel = require('../models/statisticsModel')
const MatchLeagueModel = require('../models/matchLeagueModel')
const MatchModel = require('../models/matchModel')
const SeriesLBUserRankModel = require('../models/seriesLBUserRankModel')
const SeriesLeaderBoardModel = require('../models/seriesLeaderBoardModel')
const PassbookModel = require('../models/passbookModel')
const UserBalanceModel = require('../models/userBalanceModel')
const { bAllowDiskUse } = require('../../config/config')
const SettingModel = require('../models/settingModel')
const UserTdsModel = require('../models/userTdsModel')
const { publish } = require('../../rabbitmq/queue/winNotification')

// Currently not used
async function winByLeagueV3() {
  let data
  try {
    data = await queuePop('MatchLeagueWin')
    if (!data) {
      setTimeout(() => { winByLeagueV3() }, 2000)
      return
    }
    data = JSON.parse(data)

    const transactionOptions = {
      readPreference: 'primary',
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority' }
    }

    const { _id, eCategory, bPrivateLeague, nCreatorCommission, iUserId, sName: sLeagueName, iMatchId, nLoyaltyPoint = 0 } = data

    const matchCategory = getStatisticsSportsKey(eCategory)
    let nWinDistCounter = 0
    const projection = { nPrice: 1, nBonusWin: 1, iUserId: 1, _id: 1, iMatchId: 1, iMatchLeagueId: 1, sMatchName: 1, sLeagueName: 1, sUserName: 1, nPricePaid: 1, eType: 1, aExtraWin: 1 }
    let success = 0
    let failed = 0
    let bProcessFull = true

    const userLeagues = UserLeagueModel.find({ $or: [{ nPrice: { $gt: 0 } }, { nBonusWin: { $gt: 0 } }, { 'aExtraWin.0': { $exists: true } }], iMatchLeagueId: ObjectId(_id), bCancelled: false }, projection, { readPreference: 'primary' }).cursor()

    for await (const userLeague of userLeagues) {
      const userTransaction = await GamesDBConnect.startSession()
      userTransaction.startTransaction(transactionOptions)

      let statisticObj = {}
      try {
        let response = { isSuccess: true }
        if (userLeague.nPrice > 0 || userLeague.nBonusWin > 0) {
          response = await userBalanceServices.win(userLeague)
        }

        if (response.isSuccess) {
          await UserLeagueModel.updateOne({ _id: ObjectId(userLeague._id) }, { bWinDistributed: true }, { session: userTransaction })
          // await UserLeagueModel.findByIdAndUpdate(userLeague._id, { bWinDistributed: true }, { new: true }).session(userTransaction).lean()

          statisticObj = {
            [`${matchCategory}.nWinCount`]: 1,
            [`${matchCategory}.nWinAmount`]: Number(parseFloat(userLeague.nPrice).toFixed(2)),
            nWinnings: Number(parseFloat(userLeague.nPrice).toFixed(2)),
            nTotalWinnings: Number(parseFloat(userLeague.nPrice).toFixed(2)),
            nBonus: Number(parseFloat(userLeague.nBonusWin).toFixed(2)),
            nActualBonus: Number(parseFloat(userLeague.nBonusWin).toFixed(2))
          }

          const aMatchLeagueWins = {
            iMatchLeagueId: userLeague.iMatchLeagueId,
            iUserLeagueId: userLeague._id,
            nRealCash: userLeague.nPrice,
            nBonus: userLeague.nBonusWin
          }
          const myMatchUpdate = {
            $inc: {
              nWinnings: userLeague.nPrice,
              nBonusWin: userLeague.nBonusWin
            },
            $push: {
              aExtraWin: { $each: userLeague.aExtraWin },
              aMatchLeagueWins: aMatchLeagueWins
            }
          }
          console.log(myMatchUpdate)
          await MyMatchesModel.updateOne({ iMatchId: ObjectId(iMatchId), iUserId: ObjectId(userLeague.iUserId) }, myMatchUpdate)
        }
        nWinDistCounter += 1

        if (bPrivateLeague === true && nCreatorCommission) {
          const user = await UserModel.findOne({ _id: iUserId }, { sUsername: 1, _id: 0 }, { session: userTransaction }).lean()
          const { sUsername = '', eType } = user
          const userDetails = { sLeagueName, sUsername, iUserId, _id, eType }
          const nCreatorBonus = Number(parseFloat(nCreatorCommission).toFixed(2))

          const data = await userBalanceServices.creatorBonus({ nCreatorCommission: nCreatorBonus, userDetails, iMatchId })

          if (data.isSuccess) {
            if (statisticObj.nWinnings) {
              statisticObj.nWinnings += nCreatorBonus
            } else {
              statisticObj.nWinnings = nCreatorBonus
            }
            if (statisticObj.nTotalWinnings) {
              statisticObj.nTotalWinnings += nCreatorBonus
            } else {
              statisticObj.nTotalWinnings = nCreatorBonus
            }
            statisticObj[`${matchCategory}.nCreatePLeagueSpend`] = nCreatorBonus
            statisticObj.nActualWinningBalance = Number(parseFloat(response.nCash + nCreatorBonus).toFixed(2))
            if (data.sValue === 'DEPOSIT') {
              statisticObj[`${matchCategory}.nCreatePLeagueSpend`] = nCreatorBonus
              statisticObj.nDeposits = nCreatorBonus
              statisticObj.nDepositCount = 1
              statisticObj.nActualDepositBalance = Number(parseFloat(nCreatorBonus).toFixed(2))
            } else if (data.sValue === 'BONUS') {
              statisticObj[`${matchCategory}.nCreatePLeagueSpend`] = nCreatorBonus
              statisticObj.nBonus = nCreatorBonus
              statisticObj.nActualBonus = Number(parseFloat(userLeague.nBonusWin + nCreatorBonus).toFixed(2))
            }
          }
        }

        await StatisticsModel.updateOne(
          { iUserId: userLeague.iUserId },
          {
            $inc: statisticObj
          }, { upsert: true, session: userTransaction })

        await userTransaction.commitTransaction()
        success++
      } catch (err) {
        failed++
        bProcessFull = false
        await userTransaction.abortTransaction()
        handleCatchError(err)
      } finally {
        await userTransaction.endSession()
      }
    }

    // only updates when all useLeagues are distribution
    if (bProcessFull) {
      const session = await GamesDBConnect.startSession()
      session.startTransaction(transactionOptions)
      try {
        if (nLoyaltyPoint > 0) {
          const userLeagues = await UserLeagueModel.aggregate([
            {
              $match: {
                iMatchLeagueId: ObjectId(_id), bCancelled: false
              }
            }, {
              $addFields: {
                eType: { $cond: [{ $eq: ['$eType', 'U'] }, 'U', 'B'] }
              }
            }, {
              $group: {
                _id: '$iUserId',
                sUserName: { $first: '$sUserName' },
                eType: { $first: '$eType' }
              }
            }
          ]).exec()
          const aUserLeagues = Array.isArray(userLeagues) && userLeagues.length ? userLeagues : []
          const userIds = aUserLeagues.map((ul) => ObjectId(ul._id))

          await db.sequelize.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
          }, async (t) => {
            for (const user of aUserLeagues) {
              await UserBalanceModel.update({
                nTotalLoyaltyPoints: literal(`nTotalLoyaltyPoints + ${nLoyaltyPoint}`)
              },
                {
                  where: { iUserId: user._id.toString() }, transaction: t, lock: true
                })

              await PassbookModel.create(
                {
                  iUserId: user._id.toString(),
                  nLoyaltyPoint: nLoyaltyPoint,
                  eTransactionType: 'Loyalty-Point',
                  eType: 'Cr',
                  eUserType: user.eType,
                  iMatchLeagueId: _id.toString(),
                  iMatchId,
                  sRemarks: `${user.sUserName} earned ${nLoyaltyPoint} loyalty points for match League`,
                  dActivityDate: new Date()
                },
                {
                  transaction: t, lock: true
                })
            }
            await UserModel.updateMany({ _id: { $in: userIds } }, { $inc: { nLoyaltyPoints: nLoyaltyPoint } })
          })
        }

        await MatchLeagueModel.updateOne({ _id }, { bWinningDone: true, bPrizeDone: true }, { session })
        await MatchModel.updateOne({ _id: iMatchId }, { $inc: { nWinDistCount: nWinDistCounter } }, { session })

        await session.commitTransaction()
      } catch (err) {
        handleCatchError(err)
        await session.abortTransaction()
      }
    }

    console.log(`Success: ${success} | Failed: ${failed}`)

    winByLeagueV3()
  } catch (error) {
    await queuePush('dead:MatchLeagueWin', data)
    handleCatchError(error)
    winByLeagueV3()
  }
}

// To provide prize distribution to MatchLeagues
async function winDistributionByLeague() {
  let data
  try {
    data = await queuePop('MatchLeagueWin')
    if (!data) {
      setTimeout(() => { winDistributionByLeague() }, 2000)
      return
    }
    data = JSON.parse(data)

    const { _id, eCategory, bPrivateLeague, nCreatorCommission, iUserId, sName: sLeagueName, iMatchId, nLoyaltyPoint = 0 } = data

    // queuePush('ProcessBucketLogs', { fileName: `wd-${data._id}`, putData: { _id, sNote: 'Win distribution started' } })
    console.log(`wd-${data._id}`)

    const matchCategory = getStatisticsSportsKey(eCategory)
    let nWinDistCounter = 0
    const projection = { nPrice: 1, nBonusWin: 1, iUserId: 1, _id: 1, iMatchId: 1, iMatchLeagueId: 1, sMatchName: 1, sLeagueName: 1, sUserName: 1, nPricePaid: 1, eType: 1, aExtraWin: 1 }
    let bProcessFull = true
    const matchLeague = await MatchLeagueModel.findOne({ _id: ObjectId(_id) }, { bPrizeDone: 1, bCancelled: 1 }).lean()
    if (matchLeague && (matchLeague.bPrizeDone || matchLeague.bCancelled)) {
      winDistributionByLeague()
      return
    }

    const userLeagues = await UserLeagueModel.find({ $or: [{ nPrice: { $gt: 0 } }, { nBonusWin: { $gt: 0 } }, { 'aExtraWin.0': { $exists: true } }], iMatchLeagueId: ObjectId(_id), bCancelled: false }, projection).read('primary').readConcern('majority')
    try {
      let response = { isSuccess: true }
      console.log('Response Object ========>', response)
      console.log('isSuccess field in response object ========>', response.isSuccess)
      // For TDS calculation
      const userTeams = {}
      for (const userLeague of userLeagues) {
        if (!userLeague.actualCashUsed) {
          const passBook = await PassbookModel.findOne({ where: { iUserLeagueId: userLeague._id.toString(), iMatchLeagueId: _id.toString(), iUserId: userLeague.iUserId.toString() } })
          if (passBook) {
            userLeague.actualCashUsed = (passBook.nCash) ? passBook.nCash : 0
            userLeague.actualBonusUsed = (passBook.nBonus) ? passBook.nBonus : 0
          }
        }
        if (Array.isArray(userTeams[`${userLeague.iUserId.toString()}`])) {
          userTeams[`${userLeague.iUserId.toString()}`].push(userLeague)
        } else {
          userTeams[`${userLeague.iUserId.toString()}`] = [userLeague]
        }
      }
      response = await userBalanceServices.calculateAndUpdateTDS(_id.toString(), iMatchId.toString(), userTeams, matchCategory)
      // response = await userBalanceServices.winV2(userLeague, matchCategory)
      // queuePush('ProcessBucketLogs', { fileName: `wd-${data._id}`, putData: { response, sNote: 'response from winV2' } })
      console.log('2 isSuccess field in response object=====>', response.isSuccess)
      if (response.isSuccess) {
        nWinDistCounter += 1
      } else {
        bProcessFull = false
        await queueLPush('MatchLeagueWin', data)
        // queuePush('ProcessBucketLogs', { fileName: `wd-${data._id}`, putData: { userTeams, bProcessFull: false, sNote: 'win not distributed' } })
      }

      if (bPrivateLeague && nCreatorCommission && bProcessFull) {
        const user = await UserModel.findOne({ _id: iUserId }, { sUsername: 1, _id: 0 }).lean()
        const { sUsername = '', eType } = user
        const userDetails = { sLeagueName, sUsername, iUserId, _id, eType }
        const nCreatorBonus = Number(parseFloat(nCreatorCommission).toFixed(2))

        const data = await userBalanceServices.creatorBonusV2({ nCreatorCommission: nCreatorBonus, userDetails, iMatchId, matchCategory, eCategory })
        if (!data.isSuccess) {
          bProcessFull = false
          await queueLPush('MatchLeagueWin', data)
          // queuePush('ProcessBucketLogs', { fileName: `wd-${data._id}`, putData: { userTeams, bProcessFull: false, sNote: 'creator bonus not distributed' } })
        }
      }
    } catch (err) {
      bProcessFull = false
      await queueLPush('MatchLeagueWin', data)
      // queuePush('ProcessBucketLogs', { fileName: `wd-${data._id}`, putData: { userTeams, err, sNote: 'win not distributed catch for loop' } })
      handleCatchError(err)
      // eslint-disable-next-line no-undef
      userTeams = {}
    }

    // only updates when all useLeagues are distribution
    if (bProcessFull) {
      try {
        if (nLoyaltyPoint > 0) {
          const userLeagues = await UserLeagueModel.aggregate([
            {
              $match: { iMatchLeagueId: ObjectId(_id), bCancelled: false, bWinDistributed: true }
            }, {
              $addFields: { eType: { $cond: [{ $eq: ['$eType', 'U'] }, 'U', 'B'] } }
            }, {
              $group: {
                _id: '$iUserId',
                sUserName: { $first: '$sUserName' },
                eType: { $first: '$eType' }
              }
            }
          ]).allowDiskUse(bAllowDiskUse).exec()
          const aUserLeagues = Array.isArray(userLeagues) && userLeagues.length ? userLeagues : []

          const aLoyaltyUserIds = await userBalanceServices.loyaltyPointsDistribution({ aUserLeagues, nLoyaltyPoint, sLeagueName, iMatchId, iMatchLeagueId: _id, eCategory })
          if (Array.isArray(aLoyaltyUserIds) && aLoyaltyUserIds.length) {
            await UserModel.updateMany({ _id: { $in: aLoyaltyUserIds } }, { $inc: { nLoyaltyPoints: nLoyaltyPoint } })
          }
        }

        await MatchLeagueModel.updateOne({ _id }, { bWinningDone: true, bPrizeDone: true }).w('majority')
        await MatchModel.updateOne({ _id: iMatchId }, { $inc: { nWinDistCount: nWinDistCounter } }).w('majority')
        // queuePush('ProcessBucketLogs', { fileName: `wd-${data._id}`, putData: { sNote: '*** SuccessFully distributed ***' } })
      } catch (err) {
        handleCatchError(err)
        // queuePush('ProcessBucketLogs', { fileName: `wd-${data._id}`, putData: { err, sNote: '*** Loyalty points not distributed ***' } })
      }
    }

    winDistributionByLeague()
  } catch (error) {
    await queuePush('dead:MatchLeagueWin', data)
    handleCatchError(error)
    winDistributionByLeague()
  }
}

// Currently not used
async function winBySeries() {
  let data
  try {
    data = await queuePop('MatchSeriesWin')
    if (!data) {
      setTimeout(() => { winBySeries() }, 2000)
      return
    }
    data = JSON.parse(data)
    const { _id, iCategoryId, sName, eCategory } = data
    const userRank = await SeriesLBUserRankModel.find({ $or: [{ nPrize: { $gt: 0 } }, { nBonusWin: { $gt: 0 } }], iSeriesId: ObjectId(_id), iCategoryId: ObjectId(iCategoryId) }).populate({ path: 'oUser', select: ['eType', 'sUsername'] }).lean()
    for (const user of userRank) {
      const { nPrize, iUserId, oUser, nBonusWin } = user
      if (nPrize > 0 || nBonusWin > 0) {
        const payload = { sName, sUsername: oUser.sUsername, nPrize, iUserId: oUser._id, iSeriesId: _id, iCategoryId, eType: oUser.eType, nBonusWin }
        const matchCategory = getStatisticsSportsKey(eCategory)
        await userBalanceServices.seriesWin(payload)
        await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, {
          $inc: {
            nWinnings: Number(parseFloat(nPrize).toFixed(2)),
            nTotalWinnings: Number(parseFloat(nPrize).toFixed(2)),
            nBonus: Number(parseFloat(nBonusWin).toFixed(2)),
            [`${matchCategory}.nWinCount`]: 1,
            [`${matchCategory}.nWinAmount`]: Number(parseFloat(nPrize).toFixed(2))
          }
        }, { upsert: true })

        await SeriesLBUserRankModel.updateOne({ _id: ObjectId(user._id) }, { bWinDistribution: true })
      }
    }
    await SeriesLeaderBoardModel.updateOne({ _id: ObjectId(_id), aSeriesCategory: { $elemMatch: { _id: ObjectId(iCategoryId) } } }, { 'aSeriesCategory.$.bWinningDone': true })
    winBySeries()
  } catch (error) {
    await queuePush('dead:MatchSeriesWin', data)
    handleCatchError(error)
    winBySeries()
  }
}

// To provide prize distribution series wise
async function winBySeriesV2() {
  let data
  try {
    data = await queuePop('MatchSeriesWin')
    if (!data) {
      setTimeout(() => { winBySeriesV2() }, 2000)
      return
    }
    data = JSON.parse(data)
    const { _id, iCategoryId, sName, eCategory } = data
    const userRank = await SeriesLBUserRankModel.find({ $or: [{ nPrize: { $gt: 0 } }, { nBonusWin: { $gt: 0 } }], iSeriesId: ObjectId(_id), iCategoryId: ObjectId(iCategoryId) }).populate({ path: 'oUser', select: ['eType', 'sUsername'] }).read('primary').readConcern('majority').lean()
    for (const user of userRank) {
      const { nPrize, oUser, nBonusWin } = user
      if (nPrize > 0 || nBonusWin > 0) {
        const payload = { sName, sUsername: oUser.sUsername, nPrize, iUserId: oUser._id, iSeriesId: _id, iCategoryId, eType: oUser.eType, nBonusWin, eCategory }
        const matchCategory = getStatisticsSportsKey(eCategory)
        await userBalanceServices.seriesWinV2(payload, matchCategory)
      }
      await SeriesLBUserRankModel.updateOne({ _id: ObjectId(user._id) }, { bWinDistribution: true })
    }
    await SeriesLeaderBoardModel.updateOne({ _id: ObjectId(_id), aSeriesCategory: { $elemMatch: { _id: ObjectId(iCategoryId) } } }, { 'aSeriesCategory.$.bWinningDone': true })
    winBySeriesV2()
  } catch (error) {
    await queuePush('dead:MatchSeriesWin', data)
    handleCatchError(error)
    winBySeriesV2()
  }
}

async function winDistributionByLeagueOld() {
  let data

  try {
    data = await queuePop('MatchLeagueWin')
    if (!data) {
      setTimeout(() => { winDistributionByLeagueOld() }, 2000)
      return
    }
    data = JSON.parse(data)

    const { _id, eCategory, bPrivateLeague, nCreatorCommission, iUserId, sName: sLeagueName, iMatchId, nLoyaltyPoint = 0 } = data
    console.log(`wd-${data._id}`)

    let nDistributedPayout = 0
    // const aWinPushNotification = []

    const matchCategory = getStatisticsSportsKey(eCategory)
    let nWinDistCounter = 0
    const projection = { nPrice: 1, nBonusWin: 1, iUserId: 1, _id: 1, iMatchId: 1, iMatchLeagueId: 1, sMatchName: 1, sLeagueName: 1, sUserName: 1, nPricePaid: 1, eType: 1, aExtraWin: 1, eCategory: 1 }
    let bProcessFull = true
    const matchLeague = await MatchLeagueModel.findOne({ _id: ObjectId(_id) }, { bWinningDone: 1, bCancelled: 1, iMatchId: 1 }).lean()
    if (matchLeague && (matchLeague.bWinningDone || matchLeague.bCancelled)) {
      winDistributionByLeagueOld()
      return
    }

    const userLeagues = await UserLeagueModel.find({ $or: [{ nPrice: { $gt: 0 } }, { nBonusWin: { $gt: 0 } }, { 'aExtraWin.0': { $exists: true } }], iMatchLeagueId: ObjectId(_id), bCancelled: false }, projection).read('primary').readConcern('majority')
    const userLeagueId = userLeagues.map(({ _id }) => _id.toString())

    const oUserLeagues = {}
    const passbooks = await PassbookModel.findAll({ where: { eTransactionType: 'Win', iUserLeagueId: { [Op.in]: userLeagueId } }, attributes: ['iUserLeagueId', 'bWinReturn'], raw: true })
    passbooks.forEach((pbk, i) => { oUserLeagues[pbk.iUserLeagueId] = i })
    console.log('Passbooks Win Entry ::', passbooks.length)
    const aTDS = await calculateTotalNetAmountMatchLeagueWise(_id)

    const tempData = []
    const aMyMatchUpdate = []
    const aStatisticUpdate = []
    let nTdsPercentage = 0
    const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
    if (tdsSetting) nTdsPercentage = tdsSetting.nMax
    console.log('For loop started ::', userLeagues.length)
    for (const userLeague of userLeagues) {
      const passBook = oUserLeagues[userLeague._id.toString()] ? passbooks[oUserLeagues[userLeague._id.toString()]] : false

      nDistributedPayout += userLeague.nPrice

      if (!passBook || passBook.bWinReturn) {
        let { nPrice = 0, iUserId, _id, sMatchName, sUserName, iMatchId, iMatchLeagueId, nPricePaid, eType, nBonusWin } = userLeague
        eType = (eType === 'U') ? 'U' : 'B'
        iUserId = iUserId.toString()
        const iUserLeagueId = _id.toString()
        iMatchId = iMatchId.toString()
        iMatchLeagueId = iMatchLeagueId.toString()
        nPrice = Number(nPrice)
        // const nNetWinAmount = nPrice - Number(nPricePaid)

        let league = {
          nBonusWin,
          nFinalAmount: convertToDecimal(nPrice),
          nPricePaid,
          iMatchLeagueId,
          iUserLeagueId,
          iMatchId,
          eUserType: (eType === 'U') ? 'U' : 'B',
          iUserId,
          sMatchName,
          sUserName,
          nPrice,
          bTds: false,
          eTransactionType: 'Win',
          eCategory
        }
        const tds = aTDS.find((tds) => tds._id.toString() === iUserId)
        if (tds) {
          league = {
            ...league,
            nTdsFee: convertToDecimal(tds.nTotalTDSFee) || 0,
            nTdsPercentage,
            bTds: false // true
          }
        }
        tempData.push(league)

        const aMatchLeagueWins = {
          iMatchLeagueId: userLeague.iMatchLeagueId,
          iUserLeagueId: userLeague._id,
          nRealCash: userLeague.nPrice,
          nBonus: userLeague.nBonusWin
        }
        const myMatchUpdate = {
          $inc: { nWinnings: userLeague.nPrice, nBonusWin: userLeague.nBonusWin },
          $push: { aExtraWin: { $each: userLeague.aExtraWin }, aMatchLeagueWins: aMatchLeagueWins }
        }
        aMyMatchUpdate.push({
          updateOne: {
            filter: { iMatchId: ObjectId(iMatchId), iUserId: ObjectId(userLeague.iUserId) },
            update: { ...myMatchUpdate }
          }
        })
        const statisticObj = {
          [`${matchCategory}.nWinCount`]: 1,
          [`${matchCategory}.nWinAmount`]: convertToDecimal(nPrice),
          nWinnings: convertToDecimal(nPrice),
          nTotalWinnings: convertToDecimal(nPrice),
          nBonus: convertToDecimal(userLeague.nBonusWin),
          nActualBonus: convertToDecimal(userLeague.nBonusWin),
          nActualWinningBalance: convertToDecimal(nPrice)
        }
        aStatisticUpdate.push({
          updateOne: {
            filter: { iUserId: ObjectId(userLeague.iUserId) },
            update: { $inc: statisticObj }
          }
        })
        // if (eType === 'U') aWinPushNotification.push({ iUserId, iMatchId, matchCategory })
      }
      const winData = await getWinData(userLeague.iMatchLeagueId.toString())
      if (userLeague.eType === 'U' && !winData.includes(userLeague.iUserId.toString())) {
        winData.push(userLeague.iUserId.toString())
        await setWinData(userLeague.iMatchLeagueId, winData)
      }
    }

    try {
      console.log('SP called ::', tempData.length)
      const result = await userBalanceServices.winStoredProcedure(_id.toString(), tempData)
      console.log('result :: ', result)
      if (result.isSuccess) {
        [nWinDistCounter] = await Promise.all([
          PassbookModel.count({ where: { eTransactionType: 'Win', iMatchLeagueId: _id.toString() } }),
          UserLeagueModel.updateMany({ _id: { $in: userLeagueId } }, { bWinDistributed: true }).w('majority'),
          MyMatchesModel.bulkWrite(aMyMatchUpdate, { ordered: false }),
          StatisticsModel.bulkWrite(aStatisticUpdate, { ordered: false }),
          // bulkQueuePush('pushNotification:Win', aWinPushNotification, 5000)
        ])
        if (bPrivateLeague && nCreatorCommission && bProcessFull) {
          const user = await UserModel.findOne({ _id: iUserId }, { sUsername: 1, _id: 0 }).lean()
          const { sUsername = '', eType } = user
          const userDetails = { sLeagueName, sUsername, iUserId, _id, eType }
          const nCreatorBonus = convertToDecimal(nCreatorCommission)

          const data = await userBalanceServices.creatorBonusV2({ nCreatorCommission: nCreatorBonus, userDetails, iMatchId, matchCategory, eCategory })
          if (!data.isSuccess) {
            bProcessFull = false
            await queueLPush('MatchLeagueWin', data)
          }
        }
        const winNotification = await getWinData(_id)
        if (winNotification && winNotification.length) {
          await publish(winNotification.map(eachUserId => { return { iUserId: eachUserId, iMatchId: userLeagues[0].iMatchId.toString(), matchCategory: userLeagues[0].eCategory } }), 5000)
        }
      } else {
        bProcessFull = false
        await queueLPush('MatchLeagueWin', data)
      }
    } catch (error) {
      bProcessFull = false
      await queueLPush('MatchLeagueWin', data)
      handleCatchError(error)
    }
    // }

    // only updates when all useLeagues are distribution
    if (bProcessFull) {
      try {
        console.log('Distribution Process Completed ::', bProcessFull)
        if (nLoyaltyPoint > 0) {
          console.time('LoyaltyDistributionTime')
          console.log('LoyaltyPoint ::', nLoyaltyPoint)
          let passbooks = await PassbookModel.findAll({
            where: {
              iMatchLeagueId: _id.toString(),
              eTransactionType: 'Loyalty-Point'
            },
            attributes: ['iUserId'],
            raw: true
          })
          if (passbooks && passbooks.length) {
            passbooks = passbooks.map(s => s.iUserId)
          }

          const userLeagues = await UserLeagueModel.aggregate([
            {
              $match: { iMatchLeagueId: ObjectId(_id), bCancelled: false, bWinDistributed: true }
            }, {
              $addFields: { eType: { $cond: [{ $eq: ['$eType', 'U'] }, 'U', 'B'] } }
            }, {
              $group: {
                _id: '$iUserId',
                sUserName: { $first: '$sUserName' },
                eType: { $first: '$eType' }
              }
            }
          ]).allowDiskUse(bAllowDiskUse).exec()
          const aUserLeagues = Array.isArray(userLeagues) && userLeagues.length ? userLeagues : []
          // need to run for loop to bulkCreate data in userLeague
          const aUserLeagueData = []
          for await (const oUser of aUserLeagues) {
            if (passbooks.includes(oUser._id.toString())) {
              continue
            }
            const oData = {
              iUserId: oUser._id.toString(),
              eUserType: oUser.eType,
              nFinalAmount: nLoyaltyPoint,
              sUserName: oUser.sUserName,
              iMatchId: iMatchId.toString(),
              iMatchLeagueId: _id.toString(),
              eCategory,
              eTransactionType: 'Loyalty-Point'
            }
            aUserLeagueData.push(oData)
          }
          const aUserIds = aUserLeagueData.map(({ iUserId }) => ObjectId(iUserId))
          

          try {
            console.log('Loyalty Distribution Started ::', aUserLeagueData.length)
            const oResult = await userBalanceServices.loyaltyPointStoredProcedure(_id.toString(), aUserLeagueData)
            console.log('Loyalty Result ::', oResult)
            if (oResult.isSuccess) {
              if (Array.isArray(aUserIds) && aUserIds.length) {
                await UserModel.updateMany({ _id: { $in: aUserIds } }, { $inc: { nLoyaltyPoints: nLoyaltyPoint } })
              }
            }
          } catch (error) {
            // await queueLPush('MatchLeagueWin', data)
            handleCatchError(error)
          }

          console.timeEnd('LoyaltyDistributionTime')
          // const aLoyaltyUserIds = await userBalanceServices.loyaltyPointsDistribution({ aUserLeagues, nLoyaltyPoint, sLeagueName, iMatchId, iMatchLeagueId: _id, eCategory })
          // if (Array.isArray(aLoyaltyUserIds) && aLoyaltyUserIds.length) {
          //   await UserModel.updateMany({ _id: { $in: aLoyaltyUserIds } }, { $inc: { nLoyaltyPoints: nLoyaltyPoint } })
          // }
        }

        const [nTotalPrizeCalculated, nTotalWinDistributed] = await Promise.all([
          MatchLeagueModel.countDocuments({ iMatchId, bPrizeDone: true }),
          MatchLeagueModel.countDocuments({ iMatchId, bWinningDone: true })
        ])
        nDistributedPayout = Number(parseFloat(nDistributedPayout).toFixed(2))

        await Promise.all([
          MatchLeagueModel.updateOne({ _id }, { bWinningDone: true, bPrizeDone: true, nDistributedPayout }).w('majority'),
          MatchModel.updateOne({ _id: iMatchId }, { $inc: { nWinDistCount: nWinDistCounter } }).w('majority')
        ])
        if (nTotalPrizeCalculated === (nTotalWinDistributed + 1)) await queuePush('processUserTds', { iMatchId, matchCategory, eCategory })
        console.log(`done-${data._id}`)
      } catch (err) {
        handleCatchError(err)
      }
    }

    winDistributionByLeagueOld()
  } catch (error) {
    await queuePush('dead:MatchLeagueWin', data)
    handleCatchError(error)
    winDistributionByLeagueOld()
  }
}

// New Changes With Pagination
// async function winDistributionByLeagueOld() {
//   let data

//   try {
//     data = await queuePop('MatchLeagueWin')
//     if (!data) {
//       setTimeout(() => { winDistributionByLeagueOld() }, 2000)
//       return
//     }
//     data = JSON.parse(data)
//     console.time('sTime')

//     const { _id, eCategory, bPrivateLeague, nCreatorCommission, iUserId, sName: sLeagueName, iMatchId, nLoyaltyPoint = 0 } = data
//     console.log(`wd-${data._id}`)

//     let nDistributedPayout = 0
//     // const aWinPushNotification = []

//     const matchCategory = getStatisticsSportsKey(eCategory)
//     let nWinDistCounter = 0
//     const projection = { nPrice: 1, nBonusWin: 1, iUserId: 1, _id: 1, iMatchId: 1, iMatchLeagueId: 1, sMatchName: 1, sLeagueName: 1, sUserName: 1, nPricePaid: 1, eType: 1, aExtraWin: 1, eCategory:1 }
//     let bProcessFull = true
//     const matchLeague = await MatchLeagueModel.findOne({ _id: ObjectId(_id) }, { bWinningDone: 1, bCancelled: 1, iMatchId: 1 }).lean()
//     if (matchLeague && (matchLeague.bWinningDone || matchLeague.bCancelled)) {
//       winDistributionByLeagueOld()
//       return
//     }
//     const aTDS = await calculateTotalNetAmountMatchLeagueWise(_id)
//     const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
//         if (tdsSetting) nTdsPercentage = tdsSetting.nMax
//     let userLeagueEndLoop = true;
//     let page = 0 ;
//     let countv = 0
//     while (userLeagueEndLoop) {
//       const limit = 50000;
//       const skip = page ? page * limit : page;
//       console.log('LS', limit, skip)
//       const userLeagues = await UserLeagueModel.find({ $or: [{ nPrice: { $gt: 0 } }, { nBonusWin: { $gt: 0 } }, { 'aExtraWin.0': { $exists: true } }], iMatchLeagueId: ObjectId(_id), bCancelled: false }, projection).skip(skip).limit(limit).read('primary').readConcern('majority');
//       page++;
//       if(!userLeagues || !userLeagues.length){
//         userLeagueEndLoop = false;
//         continue;
//       }
//       const userLeagueId = userLeagues.map(({ _id }) => _id.toString())

//       const oUserLeagues = {}
//       const passbooks = await PassbookModel.findAll({ where: { eTransactionType: 'Win', iUserLeagueId: { [Op.in]: userLeagueId } }, attributes: ['iUserLeagueId', 'bWinReturn'], raw: true })
//       passbooks.forEach((pbk, i) => { oUserLeagues[pbk.iUserLeagueId] = i })

//       const tempData = []
//       const aMyMatchUpdate = []
//       const aStatisticUpdate = []
//       let nTdsPercentage = 0
     
//       for (const userLeague of userLeagues) {
//         const passBook = oUserLeagues[userLeague._id.toString()] ? passbooks[oUserLeagues[userLeague._id.toString()]] : false
//         nDistributedPayout += userLeague.nPrice
//         if (!passBook || passBook.bWinReturn) {
//           let { nPrice = 0, iUserId, _id, sMatchName, sUserName, iMatchId, iMatchLeagueId, nPricePaid, eType, nBonusWin } = userLeague
//           eType = (eType === 'U') ? 'U' : 'B'
//           iUserId = iUserId.toString()
//           const iUserLeagueId = _id.toString()
//           iMatchId = iMatchId.toString()
//           iMatchLeagueId = iMatchLeagueId.toString()
//           nPrice = Number(nPrice)
//           // const nNetWinAmount = nPrice - Number(nPricePaid)

//           let league = {
//             nBonusWin,
//             nFinalAmount: convertToDecimal(nPrice),
//             nPricePaid,
//             iMatchLeagueId,
//             iUserLeagueId,
//             iMatchId,
//             eUserType: (eType === 'U') ? 'U' : 'B',
//             iUserId,
//             sMatchName,
//             sUserName,
//             nPrice,
//             bTds: false,
//             eTransactionType: 'Win',
//             eCategory
//           }
//           const tds = aTDS.find((tds) => tds._id.toString() === iUserId)
//           if (tds) {
//             league = {
//               ...league,
//               nTdsFee: convertToDecimal(tds.nTotalTDSFee) || 0,
//               nTdsPercentage,
//               bTds: false // true
//             }
//           }
//           tempData.push(league)

//           const aMatchLeagueWins = {
//             iMatchLeagueId: userLeague.iMatchLeagueId,
//             iUserLeagueId: userLeague._id,
//             nRealCash: userLeague.nPrice,
//             nBonus: userLeague.nBonusWin
//           }
//           const myMatchUpdate = {
//             $inc: { nWinnings: userLeague.nPrice, nBonusWin: userLeague.nBonusWin },
//             $push: { aExtraWin: { $each: userLeague.aExtraWin }, aMatchLeagueWins: aMatchLeagueWins }
//           }
//           aMyMatchUpdate.push({
//             updateOne: {
//               filter: { iMatchId: ObjectId(iMatchId), iUserId: ObjectId(userLeague.iUserId) },
//               update: { ...myMatchUpdate }
//             }
//           })
//           const statisticObj = {
//             [`${matchCategory}.nWinCount`]: 1,
//             [`${matchCategory}.nWinAmount`]: convertToDecimal(nPrice),
//             nWinnings: convertToDecimal(nPrice),
//             nTotalWinnings: convertToDecimal(nPrice),
//             nBonus: convertToDecimal(userLeague.nBonusWin),
//             nActualBonus: convertToDecimal(userLeague.nBonusWin),
//             nActualWinningBalance: convertToDecimal(nPrice)
//           }
//           aStatisticUpdate.push({
//             updateOne: {
//               filter: { iUserId: ObjectId(userLeague.iUserId) },
//               update: { $inc: statisticObj }
//             }
//           })
//           // if (eType === 'U') aWinPushNotification.push({ iUserId, iMatchId, matchCategory })        
//         }
//         countv++
//       }

//       try {
//         console.time('WinDistributionTime')
//         const result = await userBalanceServices.winStoredProcedure(_id.toString(), tempData)
//         if (result.isSuccess) {
//           [nWinDistCounter] = await Promise.all([
//             PassbookModel.count({ where: { eTransactionType: 'Win', iMatchLeagueId: _id.toString() } }),
//             UserLeagueModel.updateMany({ _id: { $in: userLeagueId } }, { bWinDistributed: true }).w('majority'),
//             MyMatchesModel.bulkWrite(aMyMatchUpdate, { ordered: false }),
//             StatisticsModel.bulkWrite(aStatisticUpdate, { ordered: false }),
//             // bulkQueuePush('pushNotification:Win', aWinPushNotification, 5000)
//           ])
        
//         } else {
//           bProcessFull = false
//           await queueLPush('MatchLeagueWin', data)
//         }
//         console.timeEnd('WinDistributionTime')
//       } catch (error) {
//         console.log(error)
//         bProcessFull = false
//         await queueLPush('MatchLeagueWin', data)
//         handleCatchError(error)
//       }
//     }
   
//     // }
//     if (bPrivateLeague && nCreatorCommission && bProcessFull) {
//       const user = await UserModel.findOne({ _id: iUserId }, { sUsername: 1, _id: 0 }).lean()
//       const { sUsername = '', eType } = user
//       const userDetails = { sLeagueName, sUsername, iUserId, _id, eType }
//       const nCreatorBonus = convertToDecimal(nCreatorCommission)

//       const data = await userBalanceServices.creatorBonusV2({ nCreatorCommission: nCreatorBonus, userDetails, iMatchId, matchCategory, eCategory })
//       if (!data.isSuccess) {
//         bProcessFull = false
//         await queueLPush('MatchLeagueWin', data)
//       }
//     }
//     // only updates when all useLeagues are distribution
//     if (bProcessFull) {
//       try {
//         console.log('Completed Process', bProcessFull, nLoyaltyPoint)
//         if (nLoyaltyPoint > 0) {
//           // separate function for loyalty distribution
//           const oArgs = { _id, nLoyaltyPoint, iMatchId, eCategory }
//           processLoyaltyPoint(oArgs).then(console.log({ isSuccess: true })).catch(console.log)
//         }

//         const [nTotalPrizeCalculated, nTotalWinDistributed] = await Promise.all([
//           MatchLeagueModel.countDocuments({ iMatchId, bPrizeDone: true }),
//           MatchLeagueModel.countDocuments({ iMatchId, bWinningDone: true })
//         ])
//         nDistributedPayout = Number(parseFloat(nDistributedPayout).toFixed(2))

//         await Promise.all([
//           MatchLeagueModel.updateOne({ _id }, { bWinningDone: true, bPrizeDone: true, nDistributedPayout }).w('majority'),
//           MatchModel.updateOne({ _id: iMatchId }, { $inc: { nWinDistCount: nWinDistCounter } }).w('majority')
//         ])
//         if (nTotalPrizeCalculated === (nTotalWinDistributed + 1)) await queuePush('processUserTds', { iMatchId, matchCategory, eCategory })
//         console.log(`done-${iMatchId}`)
//       } catch (err) {
//         handleCatchError(err)
//       }
//     }
//     console.timeEnd('sTime')
//     winDistributionByLeagueOld()
//   } catch (error) {
//     await queuePush('dead:MatchLeagueWin', data)
//     handleCatchError(error)
//     winDistributionByLeagueOld()
//   }
// }


async function calculateTotalNetAmount(iMatchId, matchCategory) {
  const aData = []
  try {
    const matchLeague = await MatchLeagueModel.find({ iMatchId: ObjectId(iMatchId), bCancelled: false, bPrizeDone: true, bWinningDone: true }, { _id: 1 }).lean()

    for (const ml of matchLeague) {
      const data = await calculateTotalNetAmountMatchLeagueWise(ml._id)
      aData.push(data)
    }

    // const aTotalUserLeague = await UserLeagueModel.aggregate([
    //   {
    //     $match: {
    //       iMatchId: ObjectId(iMatchId)
    //     }
    //   },
    //   {
    //     $group: {
    //       _id: {
    //         iMatchLeagueId: '$iMatchLeagueId',
    //         iUserId: '$iUserId'
    //       },
    //       nTotalWinning: {
    //         $sum: '$nPrice'
    //       },
    //       eType: { $first: '$eType' },
    //       sUserName: { $first: '$sUserName' },
    //       sMatchName: { $first: '$sMatchName' }
    //     }
    //   },
    //   {
    //     $match: {
    //       nTotalWinning: {
    //         $gt: 10000
    //       }
    //     }
    //   }
    // ]).allowDiskUse(bAllowDiskUse)

    // for (const pb of aTotalUserLeague) {
    //   console.log('pb :: ', pb)
    //   const { _id: { iMatchLeagueId, iUserId }, eType, sUserName, sMatchName, nTotalWinning } = pb

    //   const nPaidByUser = await PassbookModel.sum('nCash', {
    //     group: ['iMatchLeagueId'],
    //     where: { iMatchLeagueId: iMatchLeagueId.toString(), iUserId: iUserId.toString(), eTransactionType: 'Play' },
    //     raw: true
    //   })
    //   const obj = {
    //     _id: iUserId,
    //     nTotalWinning,
    //     nNetWinningAmount: convertToDecimal(nTotalWinning - nPaidByUser),
    //     nPaidByUser,
    //     eType,
    //     sUserName,
    //     sMatchName
    //   }
    //   if (!(obj.nNetWinningAmount > 10000)) continue
    //   console.log('obj.nTotalWinning', nPaidByUser, obj.nTotalWinning, obj.nNetWinningAmount)
    //   obj.nTotalTDSFee = convertToDecimal((nPercentage / 100) * obj.nNetWinningAmount)
    //   // console.log('nTotalTDSFee', obj.nTotalTDSFee)
    //   obj.nAmountAfterTDS = (obj.nNetWinningAmount - obj.nTotalTDSFee)
    //   // console.log('nTotalTDSFee', obj.nTotalTDSFee)
    //   // obj.nTotalPaidToUser = (obj.nAmountAfterTDS + obj.nPaidByUser)
    //   // nTotalTDSFee, nPaidByUser, nTotalWinning
    //   aData.push(obj)
    // }
  } catch (error) {
    handleCatchError(error)
    await queuePush('processUserTds', { iMatchId, matchCategory })
  }
  return aData
}

async function calculateTotalNetAmountMatchWise(iMatchId) {
  const aData = []
  try {
    let nPercentage = 0

    const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
    if (tdsSetting) nPercentage = tdsSetting.nMax

    const aTotalUserLeague = await UserLeagueModel.aggregate([
      {
        $match: {
          iMatchId: ObjectId(iMatchId)
        }
      },
      {
        $group: {
          _id: {
            iMatchLeagueId: '$iMatchLeagueId',
            iUserId: '$iUserId'
          },
          nTotalWinning: {
            $sum: '$nPrice'
          },
          eType: { $first: '$eType' },
          sUserName: { $first: '$sUserName' },
          sMatchName: { $first: '$sMatchName' }
        }
      },
      {
        $match: {
          nTotalWinning: {
            $gt: 10000
          }
        }
      }
    ]).allowDiskUse(bAllowDiskUse)

    for (const pb of aTotalUserLeague) {
      const { _id: { iMatchLeagueId, iUserId }, nTotalWinning, eType, sUserName, sMatchName } = pb

      const nPaidByUser = await PassbookModel.sum('nCash', {
        group: ['iMatchLeagueId'],
        where: { iMatchLeagueId: iMatchLeagueId.toString(), iUserId: iUserId.toString(), eTransactionType: 'Play' },
        raw: true
      })
      const obj = {
        _id: iUserId,
        iMatchLeagueId: iMatchLeagueId.toString(),
        eType,
        sUserName,
        sMatchName,
        nPaidByUser,
        nTotalWinning,
        nNetWinningAmount: convertToDecimal(nTotalWinning - nPaidByUser)
      }
      if (!(obj.nNetWinningAmount > 10000)) continue
      obj.nTotalTDSFee = convertToDecimal((nPercentage / 100) * obj.nNetWinningAmount)
      aData.push(obj)
    }
  } catch (error) {
    handleCatchError(error)
  }
  return aData
}

async function calculateTotalNetAmountMatchLeagueWise(iMatchLeagueId) {
  const aData = []
  try {
    let nPercentage = 0
    // const aFinal = []

    const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
    if (tdsSetting) nPercentage = tdsSetting.nMax

    const aTotalUserLeague = await UserLeagueModel.aggregate([
      {
        $match: {
          iMatchLeagueId: ObjectId(iMatchLeagueId)
        }
      },
      {
        $group: {
          _id: {
            iMatchLeagueId: '$iMatchLeagueId',
            iUserId: '$iUserId'
          },
          nTotalWinning: {
            $sum: '$nPrice'
          }
        }
      },
      {
        $match: {
          nTotalWinning: {
            $gt: 10000
          }
        }
      }
    ]).allowDiskUse(bAllowDiskUse)

    // let aUserId = aTotalUserLeague.map(({ _id }) => _id.iUserId.toString())
    // aUserId = [...new Set(aUserId)]
    for (const pb of aTotalUserLeague) {
      const { _id: { iMatchLeagueId, iUserId }, nTotalWinning } = pb

      const nPaidByUser = await PassbookModel.sum('nCash', {
        group: ['iMatchLeagueId'],
        where: { iMatchLeagueId: iMatchLeagueId.toString(), iUserId: iUserId.toString(), eTransactionType: 'Play' },
        raw: true
      })
      const obj = {
        _id: iUserId,
        nNetWinningAmount: convertToDecimal(nTotalWinning - nPaidByUser)
      }
      if (!(obj.nNetWinningAmount > 10000)) continue
      obj.nTotalTDSFee = convertToDecimal((nPercentage / 100) * obj.nNetWinningAmount)
      aData.push(obj)
    }
    // return aFinal
    // for (const id of aUserId) {
    //   const nTotalTDSFee = aFinal.filter((obj) => obj._id.toString() === id).reduce((acc, tds) => acc + tds.nTotalTDSFee, 0)
    //   aData.push({
    //     _id: ObjectId(id),
    //     nTotalTDSFee
    //   })
    // }
  } catch (error) {
    handleCatchError(error)
  }
  return aData
}

async function calculateTotalNetAmount2(iMatchId, matchCategory) {
  const aData = []
  try {
    let nPercentage = 0
    const aFinal = []

    const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
    if (tdsSetting) nPercentage = tdsSetting.nMax

    const aTotalUserLeague = await UserLeagueModel.aggregate([
      {
        $match: {
          iMatchId: ObjectId(iMatchId)
        }
      },
      {
        $group: {
          _id: {
            iMatchLeagueId: '$iMatchLeagueId',
            iUserId: '$iUserId'
          },
          nTotalWinning: {
            $sum: '$nPrice'
          },
          eType: { $first: '$eType' },
          sUserName: { $first: '$sUserName' },
          sMatchName: { $first: '$sMatchName' }
        }
      },
      {
        $match: {
          nTotalWinning: {
            $gt: 10000
          }
        }
      }
    ]).allowDiskUse(bAllowDiskUse)

    for (const pb of aTotalUserLeague) {
      const { _id: { iMatchLeagueId, iUserId }, nTotalWinning, eType, sUserName, sMatchName } = pb

      const nPaidByUser = await PassbookModel.sum('nCash', {
        group: ['iMatchLeagueId'],
        where: { iMatchLeagueId: iMatchLeagueId.toString(), iUserId: iUserId.toString(), eTransactionType: 'Play' },
        raw: true
      })
      const obj = {
        _id: iUserId,
        eType,
        sUserName,
        sMatchName,
        nPaidByUser,
        nTotalWinning,
        nNetWinningAmount: convertToDecimal(nTotalWinning - nPaidByUser)
      }
      if (!(obj.nNetWinningAmount > 10000)) continue
      obj.nTotalTDSFee = convertToDecimal((nPercentage / 100) * obj.nNetWinningAmount)
      obj.nAmountAfterTDS = obj.nNetWinningAmount - obj.nTotalTDSFee
      aFinal.push({
        ...obj,
        nTotalPaidToUser: (obj.nAmountAfterTDS + obj.nPaidByUser)
      })
    }

    let aUserId = aFinal.map(({ _id }) => _id.toString())
    aUserId = [...new Set(aUserId)]

    for (const id of aUserId) {
      const aUser = aFinal.filter((obj) => obj._id.toString() === id)
      if (!aUser.length) console.log('aFinal, iUserId ', aFinal, id)

      const [nTotalTDSFee, nTotalWinning, nPaidByUser] = aUser.reduce((acc, p) => {
        acc[0] += p.nTotalTDSFee
        acc[1] += p.nTotalWinning
        acc[2] += p.nPaidByUser
        return acc
      }, [0, 0, 0])

      // const nTotalTDSFee = aUser.reduce((acc, tds) => acc + tds.nTotalTDSFee, 0)
      // const nTotalWinning = aUser.reduce((acc, tds) => acc + tds.nTotalWinning, 0)
      // const nPaidByUser = aUser.reduce((acc, tds) => acc + tds.nPaidByUser, 0)

      const { eType, sUserName, sMatchName } = aUser[0]
      aData.push({
        _id: ObjectId(id),
        eType,
        sUserName,
        sMatchName,
        nTotalTDSFee,
        nTotalWinning,
        nPaidByUser
      })
    }
  } catch (error) {
    handleCatchError(error)
    await queuePush('processUserTds', { iMatchId, matchCategory })
  }
  return aData
}

async function calculateTotalNetAmountMatchLeagueWise(iMatchLeagueId) {
  const aData = []
  try {
    let nPercentage = 0
    // const aFinal = []

    const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
    if (tdsSetting) nPercentage = tdsSetting.nMax

    const aTotalUserLeague = await UserLeagueModel.aggregate([
      {
        $match: {
          iMatchLeagueId: ObjectId(iMatchLeagueId)
        }
      },
      {
        $group: {
          _id: {
            iMatchLeagueId: '$iMatchLeagueId',
            iUserId: '$iUserId'
          },
          nTotalWinning: {
            $sum: '$nPrice'
          }
        }
      },
      {
        $match: {
          nTotalWinning: {
            $gt: 10000
          }
        }
      }
    ]).allowDiskUse(bAllowDiskUse)

    // let aUserId = aTotalUserLeague.map(({ _id }) => _id.iUserId.toString())
    // aUserId = [...new Set(aUserId)]
    for (const pb of aTotalUserLeague) {
      const { _id: { iMatchLeagueId, iUserId }, nTotalWinning } = pb

      const nPaidByUser = await PassbookModel.sum('nCash', {
        group: ['iMatchLeagueId'],
        where: { iMatchLeagueId: iMatchLeagueId.toString(), iUserId: iUserId.toString(), eTransactionType: 'Play' },
        raw: true
      })
      const obj = {
        _id: iUserId,
        nNetWinningAmount: convertToDecimal(nTotalWinning - nPaidByUser)
      }
      if (!(obj.nNetWinningAmount > 10000)) continue
      obj.nTotalTDSFee = convertToDecimal((nPercentage / 100) * obj.nNetWinningAmount)
      aData.push(obj)
    }
    // return aFinal
    // for (const id of aUserId) {
    //   const nTotalTDSFee = aFinal.filter((obj) => obj._id.toString() === id).reduce((acc, tds) => acc + tds.nTotalTDSFee, 0)
    //   aData.push({
    //     _id: ObjectId(id),
    //     nTotalTDSFee
    //   })
    // }
  } catch (error) {
    handleCatchError(error)
  }
  return aData
}

async function calculateTotalNetAmount2(iMatchId, matchCategory) {
  const aData = []
  try {
    let nPercentage = 0
    const aFinal = []

    const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
    if (tdsSetting) nPercentage = tdsSetting.nMax

    const aTotalUserLeague = await UserLeagueModel.aggregate([
      {
        $match: {
          iMatchId: ObjectId(iMatchId)
        }
      },
      {
        $group: {
          _id: {
            iMatchLeagueId: '$iMatchLeagueId',
            iUserId: '$iUserId'
          },
          nTotalWinning: {
            $sum: '$nPrice'
          },
          eType: { $first: '$eType' },
          sUserName: { $first: '$sUserName' },
          sMatchName: { $first: '$sMatchName' }
        }
      },
      {
        $match: {
          nTotalWinning: {
            $gt: 10000
          }
        }
      }
    ]).allowDiskUse(bAllowDiskUse)

    for (const pb of aTotalUserLeague) {
      const { _id: { iMatchLeagueId, iUserId }, nTotalWinning, eType, sUserName, sMatchName } = pb

      const nPaidByUser = await PassbookModel.sum('nCash', {
        group: ['iMatchLeagueId'],
        where: { iMatchLeagueId: iMatchLeagueId.toString(), iUserId: iUserId.toString(), eTransactionType: 'Play' },
        raw: true
      })
      const obj = {
        _id: iUserId,
        eType,
        sUserName,
        sMatchName,
        nPaidByUser,
        nTotalWinning,
        nNetWinningAmount: convertToDecimal(nTotalWinning - nPaidByUser)
      }
      if (!(obj.nNetWinningAmount > 10000)) continue
      obj.nTotalTDSFee = convertToDecimal((nPercentage / 100) * obj.nNetWinningAmount)
      obj.nAmountAfterTDS = obj.nNetWinningAmount - obj.nTotalTDSFee
      aFinal.push({
        ...obj,
        nTotalPaidToUser: (obj.nAmountAfterTDS + obj.nPaidByUser)
      })
    }

    let aUserId = aFinal.map(({ _id }) => _id.toString())
    aUserId = [...new Set(aUserId)]

    for (const id of aUserId) {
      const aUser = aFinal.filter((obj) => obj._id.toString() === id)
      if (!aUser.length) console.log('aFinal, iUserId ', aFinal, id)

      const [nTotalTDSFee, nTotalWinning, nPaidByUser] = aUser.reduce((acc, p) => {
        acc[0] += p.nTotalTDSFee
        acc[1] += p.nTotalWinning
        acc[2] += p.nPaidByUser
        return acc
      }, [0, 0, 0])

      // const nTotalTDSFee = aUser.reduce((acc, tds) => acc + tds.nTotalTDSFee, 0)
      // const nTotalWinning = aUser.reduce((acc, tds) => acc + tds.nTotalWinning, 0)
      // const nPaidByUser = aUser.reduce((acc, tds) => acc + tds.nPaidByUser, 0)

      const { eType, sUserName, sMatchName } = aUser[0]
      aData.push({
        _id: ObjectId(id),
        eType,
        sUserName,
        sMatchName,
        nTotalTDSFee,
        nTotalWinning,
        nPaidByUser
      })
    }
  } catch (error) {
    handleCatchError(error)
    await queuePush('processUserTds', { iMatchId, matchCategory })
  }
  return aData
}

async function processUserTds() {
  let data
  try {
    data = await queuePop('processUserTds')
    if (!data) {
      setTimeout(() => { processUserTds() }, 3000)
      return
    }
    data = JSON.parse(data)
    let { iMatchId, matchCategory, eCategory } = data

    const [nTotalPrizeCalculated, nTotalWinDistributed] = await Promise.all([
      MatchLeagueModel.countDocuments({ iMatchId, bPrizeDone: true }),
      MatchLeagueModel.countDocuments({ iMatchId, bWinningDone: true })
    ])

    if (nTotalPrizeCalculated === nTotalWinDistributed) {
      let nPercentage = 0
      const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
      if (tdsSetting) nPercentage = tdsSetting.nMax

      // const aUserTotalNetAmount = await calculateTotalNetAmount2(iMatchId, matchCategory)
      const aUserTotalNetAmount = await calculateTotalNetAmountMatchWise(iMatchId, matchCategory)

      for (const user of aUserTotalNetAmount) {
        let { sUserName, sMatchName, _id: iUserId, iMatchLeagueId, nTotalTDSFee, nPaidByUser: nEntryFee, nTotalWinning: nOriginalAmount, eType } = user

        iMatchId = iMatchId.toString()
        iUserId = iUserId.toString()
        iMatchLeagueId = iMatchLeagueId.toString()

        // const tdsExist = await PassbookModel.count({ where: { eTransactionType: 'TDS', iUserId, iMatchId } })
        const tdsExist = await PassbookModel.count({ where: { eTransactionType: 'TDS', iUserId, iMatchLeagueId } })

        if (!tdsExist) {
          await db.sequelize.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
          }, async (t) => {
            const userBalance = await UserBalanceModel.findOne({
              where: { iUserId },
              attributes: ['nCurrentWinningBalance', 'nCurrentDepositBalance', 'nCurrentTotalBalance', 'nCurrentBonus'], transaction: t, lock: true
            })
            const { nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = userBalance

            const nBonusWin = 0

            await UserBalanceModel.update({
              nCurrentWinningBalance: literal(`nCurrentWinningBalance - ${nTotalTDSFee}`),
              nTotalWinningAmount: literal(`nTotalWinningAmount - ${nTotalTDSFee}`),
              nCurrentTotalBalance: literal(`nCurrentTotalBalance - ${nTotalTDSFee}`)
            }, { where: { iUserId }, transaction: t, lock: true })

            const passbook = await PassbookModel.create({
              iUserId,
              eTransactionType: 'TDS',
              eUserType: (eType === 'U') ? 'U' : 'B',
              eType: 'Dr',
              nBonus: nBonusWin,
              nAmount: nTotalTDSFee + nBonusWin,
              nCash: nTotalTDSFee,
              iMatchId,
              iMatchLeagueId,
              eCategory,
              nOldWinningBalance: nCurrentWinningBalance,
              nOldDepositBalance: nCurrentDepositBalance,
              nOldTotalBalance: nCurrentTotalBalance,
              nOldBonus: nCurrentBonus,
              sRemarks: `${sUserName} total win amount: ${nOriginalAmount} with TDS fee: ${nTotalTDSFee} for ${sMatchName} Match`,
              dActivityDate: new Date()
            }, { transaction: t, lock: true })
            await UserTdsModel.create({
              iUserId,
              nPercentage,
              nOriginalAmount,
              nAmount: nTotalTDSFee,
              nActualAmount: convertToDecimal(nOriginalAmount - nTotalTDSFee),
              nEntryFee,
              eCategory,
              iPassbookId: passbook.id,
              eUserType: (eType === 'U') ? 'U' : 'B',
              // iMatchId: iMatchId.toString(),
              iMatchLeagueId: iMatchLeagueId.toString()
            }, { transaction: t, lock: true })

            const statisticObj = {
              [`${matchCategory}.nWinCount`]: -1,
              [`${matchCategory}.nWinAmount`]: -(nTotalTDSFee),
              nWinnings: -(nTotalTDSFee),
              nTotalWinnings: -(nTotalTDSFee),
              nActualWinningBalance: -(nTotalTDSFee),
              [`${matchCategory}.nTDSAmount`]: nTotalTDSFee,
              [`${matchCategory}.nTDSCount`]: 1,
              nTDSAmount: nTotalTDSFee,
              nTDSCount: 1
            }
            await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: statisticObj }, { upsert: true }).w('majority')
          })
        }
      }
    }

    processUserTds()
  } catch (error) {
    await queuePush('dead:processUserTds', data)
    handleCatchError(error)
    setTimeout(() => { processUserTds() }, 3000)
  }
}

// New Loyalty Distribution change based on new Win change
// async function processLoyaltyPoint(data) {
//   try {
//     console.time('LoyaltyPointTime')
//       const { _id, nLoyaltyPoint, iMatchId, eCategory } = data
//       let userLeagueEndLoop = true;
//       let page = 0 ;         
//       while (userLeagueEndLoop) {
//         const limit = 50000;
//         const skip = page ? page * limit : page;
        
//         const userLeagues = await UserLeagueModel.aggregate([
//           {
//             $match: { iMatchLeagueId: ObjectId(_id), bCancelled: false, bWinDistributed: true }
//           }, {
//             $addFields: { eType: { $cond: [{ $eq: ['$eType', 'U'] }, 'U', 'B'] } }
//           }, {
//             $group: {
//               _id: '$iUserId',
//               sUserName: { $first: '$sUserName' },
//               eType: { $first: '$eType' }
//             }
//           },
//           { $skip: skip },
//           { $limit: limit }
//         ]).allowDiskUse(bAllowDiskUse).exec()
        
//         page++;
//         if(!userLeagues || !userLeagues.length){
//           userLeagueEndLoop = false;
//           continue;
//         }
//         const aUserLeagues = Array.isArray(userLeagues) && userLeagues.length ? userLeagues : []
//         const aUserData = []
//         const aUserIds = aUserLeagues.map(({ _id }) => {
//           aUserData.push(_id.toString())
//           return ObjectId(_id)
//         })
//         console.log(aUserIds.length, 'length')
//         // Fetch all distributed loyalty point entry of users
//         let passbooks = await PassbookModel.findAll({
//           where: {
//             iMatchLeagueId: _id.toString(),
//             eTransactionType: 'Loyalty-Point',
//             iUserId: { [Op.in]: aUserData}
//           },
//           attributes: ['iUserId'],
//           raw: true
//         })
//         const oDistributedUser = {}
//         if (passbooks && passbooks.length) {
//           passbooks = passbooks.map((s, i) => {
//             oDistributedUser[s.iUserId] = i
//           })
//         }
//         // need to run for loop to bulkCreate data in userLeague
//         const aUserLeagueData = []
//         for await (const oUser of aUserLeagues) {
//             // Skip distributed entry
//             if (oDistributedUser[oUser._id.toString()]) {
//               continue
//             }
//             const oData = {
//               iUserId: oUser._id.toString(),
//               eUserType: oUser.eType,
//               nFinalAmount: nLoyaltyPoint,
//               sUserName: oUser.sUserName,
//               iMatchId: iMatchId.toString(),
//               iMatchLeagueId: _id.toString(),
//               eCategory,
//               eTransactionType: 'Loyalty-Point'
//             }
//             aUserLeagueData.push(oData)
//         }
//         console.log('aUserLeagueData', aUserLeagueData.length)

//         try {
//             const oResult = await userBalanceServices.loyaltyPointStoredProcedure(_id.toString(), aUserLeagueData)
//             console.log('Loyalty Result ::', oResult)
//             if (oResult.isSuccess) {
//               if (Array.isArray(aUserIds) && aUserIds.length) {
//                 await UserModel.updateMany({ _id: { $in: aUserIds } }, { $inc: { nLoyaltyPoints: nLoyaltyPoint } })
//               }                
//             }
//         } catch (error) {
//           console.log(error)
//           // await queueLPush('MatchLeagueWin', data)
//           handleCatchError(error)
//         }
      
//         // const aLoyaltyUserIds = await userBalanceServices.loyaltyPointsDistribution({ aUserLeagues, nLoyaltyPoint, sLeagueName, iMatchId, iMatchLeagueId: _id, eCategory })
//         // if (Array.isArray(aLoyaltyUserIds) && aLoyaltyUserIds.length) {
//         //   await UserModel.updateMany({ _id: { $in: aLoyaltyUserIds } }, { $inc: { nLoyaltyPoints: nLoyaltyPoint } })
//         // }
//     }
//     console.timeEnd('LoyaltyPointTime')

//   } catch (error) {
//     console.log(error)
//     return { isSuccess: false }
//   }
// }

module.exports = {
  winByLeagueV3,
  winBySeries,
  winBySeriesV2,
  winDistributionByLeague,
  winDistributionByLeagueOld,
  processUserTds
}
