const SQLUserLeagueModel = require('../models/userLeagueSqlModel')
const UserBalanceModel = require('../models/userBalanceModel')
const UserTdsModel = require('../models/userTdsModel')
const SettingModel = require('../models/settingModel')
const db = require('../../database/sequelize')
const mongoose = require('mongoose')
const PassbookModel = require('../models/passbookModel')
const { handleCatchError, convertToDecimal, getStatisticsSportsKey } = require('../../helper/utilities.services')
const CommonRuleModel = require('../models/commonRuleModel')
const { GamesDBConnect } = require('../../database/mongoose')
const ObjectId = mongoose.Types.ObjectId
const UserLeagueModel = require('../models/userLeagueModel')
const MyMatchesModel = require('../models/myMatchesModel')
const StatisticsModel = require('../models/statisticsModel')
const { queuePush, checkProcessed } = require('../../helper/redis')
const { Op, literal, Transaction } = require('sequelize')

// const UserLeagueWinModel = require('../models/userLeagueWinModel')

class UserBalance {
  // Currently not used
  async win(data) {
    return new Promise(async (resolve, reject) => {
      try {
        let { nPrice = 0, iUserId, _id, sMatchName, sUserName, iMatchId, iMatchLeagueId, nPricePaid, eType, nBonusWin = 0 } = data
        eType = (eType === 'U') ? 'U' : 'B'
        iUserId = iUserId.toString()
        const iUserLeagueId = _id.toString()
        iMatchId = iMatchId.toString()
        iMatchLeagueId = iMatchLeagueId.toString()
        nPrice = Number(nPrice)
        const nNetWinAmount = nPrice - Number(nPricePaid)
        let nFinalAmount = nPrice

        await db.sequelize.transaction(async (t) => {
          let tdsSetting
          let nTdsPercentage = 0
          let nTdsFee = 0
          // let nFinalAmount = nPrice

          if (nNetWinAmount > 10000) {
            tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }).lean()

            if (tdsSetting) nTdsPercentage = tdsSetting.nMax
            nTdsFee = Number(parseFloat((nTdsPercentage / 100) * nNetWinAmount).toFixed(2))
            nFinalAmount = nPrice - nTdsFee
          }

          const isProcessed = await PassbookModel.findOne({ where: { iUserId, eTransactionType: 'Win', iUserLeagueId, iMatchLeagueId, iMatchId }, raw: true, transaction: t, lock: true })
          if (!isProcessed || isProcessed.bWinReturn) {
            const userBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
            const { nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = userBalance
            await UserBalanceModel.update({
              nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${nFinalAmount}`),
              nTotalWinningAmount: literal(`nTotalWinningAmount + ${nFinalAmount}`),
              nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nFinalAmount}`),
              nCurrentBonus: literal(`nCurrentBonus + ${nBonusWin}`),
              nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonusWin}`)
            },
            {
              where: { iUserId },
              transaction: t,
              lock: true
            })
            const passbook = await PassbookModel.create({
              iUserId,
              eTransactionType: 'Win',
              eUserType: eType,
              eType: 'Cr',
              nBonus: nBonusWin,
              nAmount: nFinalAmount + nBonusWin,
              nCash: nFinalAmount,
              iUserLeagueId,
              iMatchId,
              iMatchLeagueId,
              nOldWinningBalance: nCurrentWinningBalance,
              nOldDepositBalance: nCurrentDepositBalance,
              nOldTotalBalance: nCurrentTotalBalance,
              nOldBonus: nCurrentBonus,
              sRemarks: `${sUserName} win amount: ${nPrice}, bonus amount: ${nBonusWin} with TDS fee: ${nTdsFee} for ${sMatchName} in League`,
              dActivityDate: new Date()
            }, { transaction: t, lock: true })

            if (nNetWinAmount > 10000) {
              await UserTdsModel.create({
                iUserId,
                nPercentage: nTdsPercentage,
                nAmount: nTdsFee,
                nOriginalAmount: nPrice,
                nActualAmount: nFinalAmount,
                iPassbookId: passbook.id,
                eUserType: eType,
                iMatchLeagueId,
                nEntryFee: Number(nPricePaid)
              }, { transaction: t, lock: true })
            }
          } else {
            return resolve({ isSuccess: false })
          }
        })
        return resolve({ isSuccess: true, nCash: nFinalAmount })
      } catch (error) {
        handleCatchError(error)
        return resolve({ isSuccess: false, error })
      }
    })
  }

  /**
   * this function is used to distribute win userLeague wise
   * @param  { object } userLeague
   * @param  { string } matchCategory
   * @return { object }
   */
  async winV2(userLeague, matchCategory) {
    try {
      let { nPrice = 0, iUserId, _id, sMatchName, sUserName, iMatchId, iMatchLeagueId, nPricePaid, eType, nBonusWin = 0 } = userLeague
      eType = (eType === 'U') ? 'U' : 'B'
      iUserId = iUserId.toString()
      const iUserLeagueId = _id.toString()
      iMatchId = iMatchId.toString()
      iMatchLeagueId = iMatchLeagueId.toString()
      nPrice = Number(nPrice)
      const nNetWinAmount = nPrice - Number(nPricePaid)

      const transactionOptions = {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
      }
      const session = await GamesDBConnect.startSession()
      session.startTransaction(transactionOptions)

      return db.sequelize.transaction(async (t) => {
        try {
          if (userLeague.nPrice > 0 || userLeague.nBonusWin > 0) {
            let tdsSetting
            let nTdsPercentage = 0
            let nTdsFee = 0

            if (nNetWinAmount > 10000) {
              tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }).lean()

              if (tdsSetting) nTdsPercentage = tdsSetting.nMax
              nTdsFee = Number(parseFloat((nTdsPercentage / 100) * nNetWinAmount).toFixed(2))
              nFinalAmount = nPrice - nTdsFee
            }

            const isProcessed = await PassbookModel.findOne({ where: { iUserId, eTransactionType: 'Win', iUserLeagueId, iMatchLeagueId, iMatchId }, raw: true, transaction: t, lock: true })

            if (!isProcessed || isProcessed.bWinReturn) {
              const userBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
              const { nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = userBalance

              await UserBalanceModel.update({
                nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${nFinalAmount}`),
                nTotalWinningAmount: literal(`nTotalWinningAmount + ${nFinalAmount}`),
                nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nFinalAmount}`),
                nCurrentBonus: literal(`nCurrentBonus + ${nBonusWin}`),
                nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonusWin}`)
              }, { where: { iUserId }, transaction: t, lock: true })

              const passbook = await PassbookModel.create({
                iUserId,
                eTransactionType: 'Win',
                eUserType: eType,
                eType: 'Cr',
                nBonus: nBonusWin,
                nAmount: nFinalAmount + nBonusWin,
                nCash: nFinalAmount,
                iUserLeagueId,
                iMatchId,
                iMatchLeagueId,
                nOldWinningBalance: nCurrentWinningBalance,
                nOldDepositBalance: nCurrentDepositBalance,
                nOldTotalBalance: nCurrentTotalBalance,
                nOldBonus: nCurrentBonus,
                sRemarks: `${sUserName} win amount: ${nPrice}, bonus amount: ${nBonusWin} with TDS fee: ${nTdsFee} for ${sMatchName} in League`,
                dActivityDate: new Date()
              }, { transaction: t, lock: true })

              if (nNetWinAmount > 10000) {
                await UserTdsModel.create({
                  iUserId,
                  nPercentage: nTdsPercentage,
                  nAmount: nTdsFee,
                  nOriginalAmount: nPrice,
                  nActualAmount: nFinalAmount,
                  iPassbookId: passbook.id,
                  eUserType: eType,
                  iMatchLeagueId,
                  nEntryFee: Number(nPricePaid)
                }, { transaction: t, lock: true })
              }
            } else {
              return { isSuccess: true }
            }

            await UserLeagueModel.updateOne({ _id: ObjectId(userLeague._id) }, { bWinDistributed: true }).w('majority')

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
            await MyMatchesModel.updateOne({ iMatchId: ObjectId(iMatchId), iUserId: ObjectId(userLeague.iUserId) }, myMatchUpdate)

            const statisticObj = {
              [`${matchCategory}.nWinCount`]: 1,
              [`${matchCategory}.nWinAmount`]: Number(parseFloat(nFinalAmount).toFixed(2)),
              nWinnings: Number(parseFloat(nFinalAmount).toFixed(2)),
              nTotalWinnings: Number(parseFloat(nFinalAmount).toFixed(2)),
              nBonus: Number(parseFloat(userLeague.nBonusWin).toFixed(2)),
              nActualBonus: Number(parseFloat(userLeague.nBonusWin).toFixed(2)),
              nActualWinningBalance: Number(parseFloat(nFinalAmount).toFixed(2))
            }
            await StatisticsModel.updateOne({ iUserId: ObjectId(userLeague.iUserId) }, { $inc: statisticObj }, { upsert: true }).w('majority')

            await session.commitTransaction()
            session.endSession()
          }
          return { isSuccess: true }
        } catch (error) {
          // await session.abortTransaction()
          // session.endSession()
          // queuePush('ProcessBucketLogs', { fileName: `wd-${userLeague.iMatchLeagueId}`, putData: { userLeague, error, sNote: 'inside of win distribution catch' } })
          handleCatchError(error)
          return { isSuccess: false, error }
        }
      })
    } catch (error) {
      // queuePush('ProcessBucketLogs', { fileName: `wd-${userLeague.iMatchLeagueId}`, putData: { userLeague, error, sNote: 'inside of win distribution catch2' } })
      handleCatchError(error)
      return { isSuccess: false, error }
    }
  }

  /**
   * this function is used for series wise win distribution
   * @param  {object} data
   * @param  {string} matchCategory
   */
  async seriesWinV2(data, matchCategory) {
    try {
      let { sName, sUsername, nPrize, iUserId, iSeriesId, iCategoryId, eType, nBonusWin = 0, eCategory } = data
      iUserId = iUserId.toString()
      iSeriesId = iSeriesId.toString()
      iCategoryId = iCategoryId.toString()
      const nAmount = Number(nPrize)

      return db.sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
      }, async (t) => {
        let tdsSetting
        let nTdsPercentage = 0
        let nTdsFee = 0
        let nFinalAmount = nAmount

        // if (nAmount > 10000) {
        //   tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }).lean()

        //   if (tdsSetting) nTdsPercentage = tdsSetting.nMax
        //   nTdsFee = Number(parseFloat((nTdsPercentage / 100) * nAmount).toFixed(2))
        //   nFinalAmount = nAmount - nTdsFee
        // }

        const isProcessed = await PassbookModel.findOne({ where: { iUserId, eTransactionType: 'Win', iSeriesId, iCategoryId }, transaction: t, lock: true })

        if (!isProcessed) {
          const userBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
          const { nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = userBalance

          await UserBalanceModel.update({
            nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${nFinalAmount}`),
            nTotalWinningAmount: literal(`nTotalWinningAmount + ${nFinalAmount}`),
            nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nFinalAmount}`),
            nCurrentBonus: literal(`nCurrentBonus + ${nBonusWin}`),
            nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonusWin}`)
          },
          { where: { iUserId }, transaction: t, lock: true })

          const passbook = await PassbookModel.create({
            iUserId,
            eTransactionType: 'Win',
            eType: 'Cr',
            nAmount: nFinalAmount,
            nBonus: nBonusWin,
            nCash: nFinalAmount,
            eUserType: eType,
            iSeriesId,
            iCategoryId,
            eCategory,
            nOldWinningBalance: nCurrentWinningBalance,
            nOldDepositBalance: nCurrentDepositBalance,
            nOldTotalBalance: nCurrentTotalBalance,
            nOldBonus: nCurrentBonus,
            sRemarks: `${sUsername} win amount: ${nAmount}, bonus amount: ${nBonusWin} with TDS fee: ${nTdsFee} in ${sName} Series`,
            dActivityDate: new Date()
          }, { transaction: t, lock: true })

          // if (nAmount > 10000) {
          //   await UserTdsModel.create({
          //     iUserId,
          //     nPercentage: nTdsPercentage,
          //     nAmount: nTdsFee,
          //     nOriginalAmount: nAmount,
          //     nActualAmount: nFinalAmount,
          //     iPassbookId: passbook.id,
          //     eUserType: eType,
          //     eCategory
          //   }, { transaction: t, lock: true })
          // }

          await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, {
            $inc: {
              nWinnings: Number(parseFloat(nFinalAmount).toFixed(2)),
              nTotalWinnings: Number(parseFloat(nFinalAmount).toFixed(2)),
              nBonus: Number(parseFloat(nBonusWin).toFixed(2)),
              [`${matchCategory}.nWinCount`]: 1,
              [`${matchCategory}.nWinAmount`]: Number(parseFloat(nFinalAmount).toFixed(2)),
              nActualWinningBalance: Number(parseFloat(nFinalAmount).toFixed(2)),
              nActualBonus: Number(parseFloat(nBonusWin).toFixed(2))
            }
          }, { upsert: true })
        }
      })
    } catch (error) {
      handleCatchError(error)
    }
  }

  // Currently not used
  async seriesWin(data) {
    return new Promise((resolve, reject) => {
      try {
        let { sName, sUsername, nPrize, iUserId, iSeriesId, iCategoryId, eType, nBonusWin = 0 } = data
        iUserId = iUserId.toString()
        iSeriesId = iSeriesId.toString()
        iCategoryId = iCategoryId.toString()
        const nAmount = Number(nPrize)

        return db.sequelize.transaction(async (t) => {
          let tdsSetting
          let nTdsPercentage = 0
          let nTdsFee = 0
          let nFinalAmount = nAmount

          if (nAmount > 10000) {
            tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }).lean()

            if (tdsSetting) nTdsPercentage = tdsSetting.nMax
            nTdsFee = (nTdsPercentage / 100) * nAmount
            nFinalAmount = nAmount - nTdsFee
          }

          const isProcessed = await PassbookModel.findOne({ where: { iUserId, eTransactionType: 'Win', iSeriesId, iCategoryId }, transaction: t, lock: true })

          if (!isProcessed) {
            const userBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
            const { nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = userBalance
            await UserBalanceModel.update({
              nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${nFinalAmount}`),
              nTotalWinningAmount: literal(`nTotalWinningAmount + ${nFinalAmount}`),
              nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nFinalAmount}`),
              nCurrentBonus: literal(`nCurrentBonus + ${nBonusWin}`),
              nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonusWin}`)
            },
            {
              where: { iUserId },
              transaction: t,
              lock: true
            })
            const passbook = await PassbookModel.create({
              iUserId,
              eTransactionType: 'Win',
              eType: 'Cr',
              nAmount: nFinalAmount,
              nCash: nFinalAmount,
              eUserType: eType,
              iSeriesId,
              iCategoryId,
              nOldWinningBalance: nCurrentWinningBalance,
              nOldDepositBalance: nCurrentDepositBalance,
              nOldTotalBalance: nCurrentTotalBalance,
              nOldBonus: nCurrentBonus,
              sRemarks: `${sUsername} win amount: ${nAmount}, bonus amount: ${nBonusWin} with TDS fee: ${nTdsFee} in ${sName} Series`,
              dActivityDate: new Date()
            }, { transaction: t, lock: true })

            if (nAmount > 10000) {
              await UserTdsModel.create({
                iUserId,
                nPercentage: nTdsPercentage,
                nAmount: nTdsFee,
                nOriginalAmount: nAmount,
                nActualAmount: nFinalAmount,
                iPassbookId: passbook.id,
                eUserType: eType
              }, { transaction: t, lock: true })
            }
          }
          resolve()
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  // Currently not used
  async creatorBonus(data) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let { nCreatorCommission, userDetails, iMatchId } = data
          let { iUserId, _id, sUsername, eType } = userDetails
          iUserId = iUserId.toString()
          const iMatchLeagueId = _id.toString()
          iMatchId = iMatchId.toString()

          const nAmount = parseFloat(nCreatorCommission)

          const lcc = await CommonRuleModel.findOne({ eRule: 'LCC', eStatus: 'Y' }, { eType: 1 }).lean()
          const lccType = lcc && lcc.eType ? lcc.eType : 'C'

          let sValue = 'WIN'
          if (lccType === 'D') {
            sValue = 'DEPOSIT'
          } else if (lccType === 'B') {
            sValue = 'BONUS'
          }

          await db.sequelize.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
          }, async (t) => {
            const isProcessed = await PassbookModel.findOne({ where: { iUserId, eTransactionType: 'Creator-Bonus', iMatchLeagueId, iMatchId }, raw: true, transaction: t, lock: true })
            if (!isProcessed || isProcessed.bCreatorBonusReturn) {
              const userBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
              const { nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = userBalance

              // sValue = enum ["DEPOSIT", "BONUS", "WIN"] , default will be win
              let updateBalance = {
                nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${nAmount}`),
                nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
                nTotalWinningAmount: literal(`nTotalWinningAmount + ${nAmount}`)
              }

              let updatePassBook = {
                iUserId,
                nAmount: nAmount,
                eTransactionType: 'Creator-Bonus',
                eType: 'Cr',
                eUserType: eType,
                nCash: nAmount,
                nBonus: 0,
                iMatchLeagueId,
                iMatchId,
                nOldWinningBalance: nCurrentWinningBalance,
                nOldDepositBalance: nCurrentDepositBalance,
                nOldTotalBalance: nCurrentTotalBalance,
                nOldBonus: nCurrentBonus,
                sRemarks: `${sUsername} earned creator bonus ${nAmount} cash win for private match League`,
                dActivityDate: new Date()
              }

              if (sValue === 'DEPOSIT') {
                updateBalance = {
                  nCurrentDepositBalance: literal(`nCurrentDepositBalance + ${nAmount}`),
                  nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
                  nTotalDepositAmount: literal(`nTotalDepositAmount + ${nAmount}`),
                  nTotalDepositCount: literal('nTotalDepositCount + 1')
                }

                updatePassBook = {
                  iUserId,
                  nAmount: nAmount,
                  eTransactionType: 'Creator-Bonus',
                  eType: 'Cr',
                  eUserType: eType,
                  nCash: nAmount,
                  nBonus: 0,
                  iMatchLeagueId,
                  iMatchId,
                  nOldWinningBalance: nCurrentWinningBalance,
                  nOldDepositBalance: nCurrentDepositBalance,
                  nOldTotalBalance: nCurrentTotalBalance,
                  nOldBonus: nCurrentBonus,
                  sRemarks: `${sUsername} earned creator bonus ${nAmount} cash deposit for private match League`,
                  dActivityDate: new Date()
                }
              } else if (sValue === 'BONUS') {
                updateBalance = {
                  nCurrentBonus: literal(`nCurrentBonus + ${nAmount}`),
                  nTotalBonusEarned: literal(`nTotalBonusEarned + ${nAmount}`)
                }

                updatePassBook = {
                  iUserId,
                  nAmount: nAmount,
                  eTransactionType: 'Creator-Bonus',
                  eType: 'Cr',
                  eUserType: eType,
                  nCash: 0,
                  nBonus: nAmount,
                  iMatchLeagueId,
                  iMatchId,
                  nOldWinningBalance: nCurrentWinningBalance,
                  nOldDepositBalance: nCurrentDepositBalance,
                  nOldTotalBalance: nCurrentTotalBalance,
                  nOldBonus: nCurrentBonus,
                  sRemarks: `${sUsername} earned creator bonus ${nAmount} bonus for private match League`,
                  dActivityDate: new Date()
                }
              }

              await UserBalanceModel.update(updateBalance,
                {
                  where: { iUserId },
                  transaction: t,
                  lock: true
                })

              await PassbookModel.create(updatePassBook, { transaction: t, lock: true })
            } else {
              return resolve({ isSuccess: false })
            }
          })
          return resolve({ isSuccess: true, sValue })
        } catch (error) {
          handleCatchError(error)
          return resolve({ isSuccess: false, error })
        }
      })()
    })
  }

  /**
   * Used to distribute creator bonus of private leagues to eligible users
   * @param  { object } data
   * @return { object }
   */
  async creatorBonusV2(data) {
    let { nCreatorCommission, userDetails, iMatchId, matchCategory, eCategory } = data
    let { iUserId, _id, sUsername, eType } = userDetails
    iUserId = iUserId.toString()
    const iMatchLeagueId = _id.toString()
    iMatchId = iMatchId.toString()

    try {
      const nAmount = Number(parseFloat(nCreatorCommission).toFixed(2))

      const lcc = await CommonRuleModel.findOne({ eRule: 'LCC', eStatus: 'Y' }, { eType: 1 }).lean()
      const lccType = lcc && lcc.eType ? lcc.eType : 'C'

      let sValue = 'WIN'
      if (lccType === 'D') {
        sValue = 'DEPOSIT'
      } else if (lccType === 'B') {
        sValue = 'BONUS'
      }

      // queuePush('ProcessBucketLogs', { fileName: `wd-${iMatchLeagueId}`, putData: { ...data, sValue, nAmount, iUserId, iMatchLeagueId } })

      // const transactionOptions = {
      //   readPreference: 'primary',
      //   readConcern: { level: 'majority' },
      //   writeConcern: { w: 'majority' }
      // }
      // const session = await GamesDBConnect.startSession()
      // session.startTransaction(transactionOptions)

      await db.sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
      }, async (t) => {
        const isProcessed = await PassbookModel.findOne({ where: { iUserId, eTransactionType: 'Creator-Bonus', iMatchLeagueId, iMatchId }, raw: true, transaction: t, lock: true })
        if (!isProcessed || isProcessed.bCreatorBonusReturn) {
          try {
            const userBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
            const { nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = userBalance

            // sValue = enum ["DEPOSIT", "BONUS", "WIN"] , default will be win
            let updateBalance = {
              nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${nAmount}`),
              nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
              nTotalWinningAmount: literal(`nTotalWinningAmount + ${nAmount}`)
            }

            let updatePassBook = {
              iUserId,
              nAmount: nAmount,
              eTransactionType: 'Creator-Bonus',
              eType: 'Cr',
              eUserType: eType,
              nCash: nAmount,
              nBonus: 0,
              iMatchLeagueId,
              iMatchId,
              eCategory,
              nOldWinningBalance: nCurrentWinningBalance,
              nOldDepositBalance: nCurrentDepositBalance,
              nOldTotalBalance: nCurrentTotalBalance,
              nOldBonus: nCurrentBonus,
              sRemarks: `${sUsername} earned creator bonus ${nAmount} cash win for private match League`,
              dActivityDate: new Date()
            }

            if (sValue === 'DEPOSIT') {
              updateBalance = {
                nCurrentDepositBalance: literal(`nCurrentDepositBalance + ${nAmount}`),
                nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
                nTotalDepositAmount: literal(`nTotalDepositAmount + ${nAmount}`),
                nTotalDepositCount: literal('nTotalDepositCount + 1')
              }

              updatePassBook = {
                iUserId,
                nAmount: nAmount,
                eTransactionType: 'Creator-Bonus',
                eType: 'Cr',
                eUserType: eType,
                nCash: nAmount,
                nBonus: 0,
                iMatchLeagueId,
                iMatchId,
                eCategory,
                nOldWinningBalance: nCurrentWinningBalance,
                nOldDepositBalance: nCurrentDepositBalance,
                nOldTotalBalance: nCurrentTotalBalance,
                nOldBonus: nCurrentBonus,
                sRemarks: `${sUsername} earned creator bonus ${nAmount} cash deposit for private match League`,
                dActivityDate: new Date()
              }
            } else if (sValue === 'BONUS') {
              updateBalance = {
                nCurrentBonus: literal(`nCurrentBonus + ${nAmount}`),
                nTotalBonusEarned: literal(`nTotalBonusEarned + ${nAmount}`)
              }

              updatePassBook = {
                iUserId,
                nAmount: nAmount,
                eTransactionType: 'Creator-Bonus',
                eType: 'Cr',
                eUserType: eType,
                nCash: 0,
                nBonus: nAmount,
                iMatchLeagueId,
                iMatchId,
                eCategory,
                nOldWinningBalance: nCurrentWinningBalance,
                nOldDepositBalance: nCurrentDepositBalance,
                nOldTotalBalance: nCurrentTotalBalance,
                nOldBonus: nCurrentBonus,
                sRemarks: `${sUsername} earned creator bonus ${nAmount} bonus for private match League`,
                dActivityDate: new Date()
              }
            }

            await UserBalanceModel.update(updateBalance, { where: { iUserId }, transaction: t, lock: true })
            await PassbookModel.create(updatePassBook, { transaction: t, lock: true })

            const statisticObj = {}
            if (sValue === 'DEPOSIT') {
              statisticObj[`${matchCategory}.nCreatePLeagueSpend`] = nCreatorCommission
              statisticObj.nDeposits = nAmount
              statisticObj.nDepositCount = 1
              statisticObj.nActualDepositBalance = nAmount
            } else if (sValue === 'BONUS') {
              statisticObj[`${matchCategory}.nCreatePLeagueSpend`] = nCreatorCommission
              statisticObj.nBonus = nAmount
              statisticObj.nActualBonus = nAmount
            } else {
              statisticObj.nWinnings = nCreatorCommission
              statisticObj.nTotalWinnings = nAmount
              statisticObj[`${matchCategory}.nCreatePLeagueSpend`] = nCreatorCommission
              statisticObj.nActualWinningBalance = nAmount
            }

            await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: statisticObj }, { upsert: true }).w('majority')

            // queuePush('ProcessBucketLogs', { fileName: `wd-${iMatchLeagueId}`, putData: { updateBalance, updatePassBook, statisticObj } })

            // await session.commitTransaction()
            // session.endSession()
          } catch (error) {
            // await session.abortTransaction()
            // session.endSession()

            // queuePush('ProcessBucketLogs', { fileName: `wd-${iMatchLeagueId}`, putData: { sNote: 'MySQL transaction failed in creator-bonus', iUserId, iMatchLeagueId, error } })
            throw new Error(error)
          }
        } else {
          return { isSuccess: false }
        }
      })
      return { isSuccess: true }
    } catch (error) {
      // queuePush('ProcessBucketLogs', { fileName: `wd-${iMatchLeagueId}`, putData: { sNote: 'creator-bonus distribution failed', error } })
      handleCatchError(error)
      return { isSuccess: false, error }
    }
  }

  /**
   * To distribute loyalty points to all eligible users
   * @param  { object } data
   * @return { array } aLoyaltyUserIds
   */
  async loyaltyPointsDistribution(data) {
    const aLoyaltyUserIds = []
    try {
      const { aUserLeagues, nLoyaltyPoint, iMatchId, iMatchLeagueId: _id, eCategory } = data

      for (const user of aUserLeagues) {
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          try {
            await UserBalanceModel.update({ nTotalLoyaltyPoints: literal(`nTotalLoyaltyPoints + ${nLoyaltyPoint}`) },
              { where: { iUserId: user._id.toString() }, transaction: t, lock: true })

            await PassbookModel.create(
              {
                iUserId: user._id.toString(),
                nLoyaltyPoint: nLoyaltyPoint,
                eTransactionType: 'Loyalty-Point',
                eType: 'Cr',
                eUserType: user.eType,
                iMatchLeagueId: _id.toString(),
                iMatchId,
                eCategory,
                sRemarks: `${user.sUserName} earned ${nLoyaltyPoint} loyalty points for match League`,
                dActivityDate: new Date()
              },
              { transaction: t, lock: true })

            aLoyaltyUserIds.push(ObjectId(user._id))
          } catch (error) {
            // queuePush('ProcessBucketLogs', { fileName: `wd-${data.iMatchLeagueId}`, putData: { sNote: 'loyalty points distribution failed - catch1', error } })
            handleCatchError(error)
          }
        })
      }
      return aLoyaltyUserIds
    } catch (error) {
      // queuePush('ProcessBucketLogs', { fileName: `wd-${data.iMatchLeagueId}`, putData: { sNote: 'loyalty points distribution failed - catch2', error } })
      handleCatchError(error)
      return aLoyaltyUserIds
    }
  }

  async winV2Old(userLeague, matchCategory) {
    try {
      let { nPrice = 0, iUserId, _id, sMatchName, sUserName, iMatchId, iMatchLeagueId, nPricePaid, eType, nBonusWin = 0 } = userLeague
      eType = (eType === 'U') ? 'U' : 'B'
      iUserId = iUserId.toString()
      const iUserLeagueId = _id.toString()
      iMatchId = iMatchId.toString()
      iMatchLeagueId = iMatchLeagueId.toString()
      nPrice = Number(nPrice)
      const nNetWinAmount = nPrice - Number(nPricePaid)

      return db.sequelize.transaction(async (t) => {
        try {
          if (userLeague.nPrice > 0 || userLeague.nBonusWin > 0) {
            let tdsSetting
            let nTdsPercentage = 0
            let nTdsFee = 0
            let nFinalAmount = convertToDecimal(nPrice)

            if (nNetWinAmount > 10000) {
              tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()

              if (tdsSetting) nTdsPercentage = tdsSetting.nMax
              nTdsFee = convertToDecimal((nTdsPercentage / 100) * nNetWinAmount)
              nFinalAmount = convertToDecimal(nPrice - nTdsFee)
            }

            // const isProcessed = await PassbookModel.findOne({ where: { iUserId, eTransactionType: 'Win', iUserLeagueId, iMatchLeagueId, iMatchId }, raw: true, transaction: t, lock: true })

            // if (!isProcessed || isProcessed.bWinReturn) {
            const userBalance = await UserBalanceModel.findOne({
              where: { iUserId },
              attributes: ['nCurrentWinningBalance', 'nCurrentDepositBalance', 'nCurrentTotalBalance', 'nCurrentBonus'],
              transaction: t,
              lock: true
            })
            const { nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = userBalance

            // await UserBalanceModel.update({
            //   nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${nFinalAmount}`),
            //   nTotalWinningAmount: literal(`nTotalWinningAmount + ${nFinalAmount}`),
            //   nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nFinalAmount}`),
            //   nCurrentBonus: literal(`nCurrentBonus + ${nBonusWin}`),
            //   nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonusWin}`)
            // }, { where: { iUserId }, transaction: t, lock: true })

            // const passbook = await PassbookModel.create({
            //   iUserId,
            //   eTransactionType: 'Win',
            //   eUserType: eType,
            //   eType: 'Cr',
            //   nBonus: nBonusWin,
            //   nAmount: nFinalAmount + nBonusWin,
            //   nCash: nFinalAmount,
            //   iUserLeagueId,
            //   iMatchId,
            //   iMatchLeagueId,
            //   nOldWinningBalance: nCurrentWinningBalance,
            //   nOldDepositBalance: nCurrentDepositBalance,
            //   nOldTotalBalance: nCurrentTotalBalance,
            //   nOldBonus: nCurrentBonus,
            //   sRemarks: `${sUserName} win amount: ${nPrice}, bonus amount: ${nBonusWin} with TDS fee: ${nTdsFee} for ${sMatchName} in League`,
            //   dActivityDate: new Date()
            // }, { transaction: t, lock: true })

            const [passbook] = await Promise.all([
              PassbookModel.create({
                iUserId,
                eTransactionType: 'Win',
                eUserType: eType,
                eType: 'Cr',
                nBonus: nBonusWin,
                nAmount: nFinalAmount + nBonusWin,
                nCash: nFinalAmount,
                iUserLeagueId,
                iMatchId,
                iMatchLeagueId,
                nOldWinningBalance: nCurrentWinningBalance,
                nOldDepositBalance: nCurrentDepositBalance,
                nOldTotalBalance: nCurrentTotalBalance,
                nOldBonus: nCurrentBonus,
                sRemarks: `${sUserName} win amount: ${nPrice}, bonus amount: ${nBonusWin} with TDS fee: ${nTdsFee} for ${sMatchName} in League`,
                dActivityDate: new Date()
              }, { transaction: t, lock: true }),
              UserBalanceModel.update({
                nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${nFinalAmount}`),
                nTotalWinningAmount: literal(`nTotalWinningAmount + ${nFinalAmount}`),
                nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nFinalAmount}`),
                nCurrentBonus: literal(`nCurrentBonus + ${nBonusWin}`),
                nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonusWin}`)
              }, { where: { iUserId }, transaction: t, lock: true })
            ])

            if (nNetWinAmount > 10000) {
              await UserTdsModel.create({
                iUserId,
                nPercentage: nTdsPercentage,
                nAmount: nTdsFee,
                nOriginalAmount: nPrice,
                nActualAmount: nFinalAmount,
                iPassbookId: passbook.id,
                eUserType: eType,
                iMatchLeagueId,
                nEntryFee: Number(nPricePaid)
              }, { transaction: t, lock: true })
            }
            // } else {
            // return { isSuccess: true }
            // }

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
            const statisticObj = {
              [`${matchCategory}.nWinCount`]: 1,
              [`${matchCategory}.nWinAmount`]: nFinalAmount,
              nWinnings: nFinalAmount,
              nTotalWinnings: nFinalAmount,
              nBonus: convertToDecimal(userLeague.nBonusWin),
              nActualBonus: convertToDecimal(userLeague.nBonusWin),
              nActualWinningBalance: nFinalAmount
            }

            await Promise.all([
              UserLeagueModel.updateOne({ _id: ObjectId(userLeague._id) }, { bWinDistributed: true }).w('majority'),
              MyMatchesModel.updateOne({ iMatchId: ObjectId(iMatchId), iUserId: ObjectId(userLeague.iUserId) }, myMatchUpdate),
              StatisticsModel.updateOne({ iUserId: ObjectId(userLeague.iUserId) }, { $inc: statisticObj }, { upsert: true }).w('majority')
            ])
          }
          return { isSuccess: true }
        } catch (error) {
          handleCatchError(error)
          return { isSuccess: false, error }
        }
      })
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false, error }
    }
  }

  /**
   * It will triggered after all the prize distribution is completed and then it will calculate the TDS
   * @param {String} iMatchLeagueId
   * @param {String} iMatchId
   * @param {Object} userTeams
   * @param {Object} matchCategory
   * @returns {Object}
   */
  async calculateAndUpdateTDS(iMatchLeagueId, iMatchId, userTeams, matchCategory) {
    try {
      let nPrice = 0; let sMatchName; let sUserName; let nPricePaid = 0; let eType; let nBonusWin = 0; let nNetWinAmount = 0; let actualCashUsed = 0; let actualBonusUsed = 0
      const transactionOptions = {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
      }
      const session = await GamesDBConnect.startSession()
      session.startTransaction(transactionOptions)

      return db.sequelize.transaction(async (t) => {
        for (const iUserId of Object.keys(userTeams)) {
          const userBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
          const isProcessed = await PassbookModel.findOne({ where: { iUserId, eTransactionType: 'Win', iMatchLeagueId, iMatchId }, raw: true, transaction: t, lock: true })
          const { nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = userBalance
          console.log('User Balance =======>', userBalance)
          for (const userLeague of userTeams[`${iUserId}`]) {
            if (userLeague.nPrice) {
              nPrice += userLeague.nPrice || 0
              nPricePaid += userLeague.nPricePaid || 0
              nBonusWin += userLeague.nBonusWin || 0
              actualCashUsed += userLeague.actualCashUsed || 0
              actualBonusUsed += userLeague.actualBonusUsed || 0
            }
            eType = (userLeague.eType === 'U') ? 'U' : 'B'
            sMatchName = userLeague.sMatchName.toString()
            sUserName = userLeague.sUserName.toString()
            if (userLeague.nPrice > 0 || userLeague.nBonusWin > 0) {
              if (!isProcessed || isProcessed.bWinReturn) {
                await PassbookModel.create({
                  iUserId,
                  eTransactionType: 'Win',
                  eUserType: eType,
                  eType: 'Cr',
                  nBonus: userLeague.nBonusWin,
                  nAmount: userLeague.nPrice + userLeague.nBonusWin,
                  nCash: userLeague.nPrice,
                  iUserLeagueId: userLeague._id.toString(),
                  iMatchId,
                  iMatchLeagueId,
                  nOldWinningBalance: nCurrentWinningBalance,
                  nOldDepositBalance: nCurrentDepositBalance,
                  nOldTotalBalance: nCurrentTotalBalance,
                  nOldBonus: nCurrentBonus,
                  sRemarks: `${sUserName} win amount: ${nPrice}, bonus amount: ${nBonusWin} for ${sMatchName} in League`,
                  dActivityDate: new Date()
                }, { transaction: t, lock: true })

                await UserLeagueModel.updateOne({ _id: ObjectId(userLeague._id) }, { bWinDistributed: true }).w('majority')
                const aMatchLeagueWins = {
                  iMatchLeagueId: userLeague.iMatchLeagueId,
                  iUserLeagueId: userLeague._id,
                  nRealCash: userLeague.nPrice,
                  nBonus: userLeague.nBonusWin
                }
                console.log('Object aMatchLeagueWins ========>', aMatchLeagueWins)
                const myMatchUpdate = {
                  $inc: { nWinnings: userLeague.nPrice, nBonusWin: userLeague.nBonusWin },
                  $push: { aExtraWin: { $each: userLeague.aExtraWin }, aMatchLeagueWins: aMatchLeagueWins }
                }
                console.log('myMatchUpdate object ========>', myMatchUpdate)
                await MyMatchesModel.updateOne({ iMatchId: ObjectId(iMatchId), iUserId: ObjectId(userLeague.iUserId) }, myMatchUpdate, { session: session })
              }
            } else {
              return { isSuccess: true }
            }
          }
          nNetWinAmount += nPrice - actualCashUsed
          if (nPrice > 0 || nBonusWin > 0) {
            let tdsSetting
            let nTdsPercentage = 0
            let nTdsFee = 0
            let nFinalAmount = nPrice

            if (nNetWinAmount > 10000) {
              tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }).lean()

              if (tdsSetting) nTdsPercentage = tdsSetting.nMax
              nTdsFee = Number(parseFloat((nTdsPercentage / 100) * nNetWinAmount).toFixed(2))
              nFinalAmount = nPrice - nTdsFee
            }

            if (!isProcessed || isProcessed.bWinReturn) {
              await UserBalanceModel.update({
                nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${nFinalAmount}`),
                nTotalWinningAmount: literal(`nTotalWinningAmount + ${nFinalAmount}`),
                nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nFinalAmount}`),
                nCurrentBonus: literal(`nCurrentBonus + ${nBonusWin}`),
                nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonusWin}`)
              }, { where: { iUserId }, transaction: t, lock: true })

              const passbook = await PassbookModel.create({
                iUserId,
                eTransactionType: 'Win',
                eUserType: eType,
                eType: 'Cr',
                nBonus: nBonusWin,
                nAmount: nFinalAmount + nBonusWin,
                nCash: nFinalAmount,
                iMatchId,
                iMatchLeagueId,
                nOldWinningBalance: nCurrentWinningBalance,
                nOldDepositBalance: nCurrentDepositBalance,
                nOldTotalBalance: nCurrentTotalBalance,
                nOldBonus: nCurrentBonus,
                sRemarks: `${sUserName} win amount: ${nPrice}, bonus amount: ${nBonusWin} with TDS fee: ${nTdsFee} for ${sMatchName} in League`,
                dActivityDate: new Date()
              }, { transaction: t, lock: true })

              if (nNetWinAmount > 10000) {
                await UserTdsModel.create({
                  iUserId,
                  nPercentage: nTdsPercentage,
                  nAmount: nTdsFee,
                  nOriginalAmount: nPrice,
                  nActualAmount: nFinalAmount,
                  iPassbookId: passbook.id,
                  eUserType: eType,
                  iMatchLeagueId,
                  nEntryFee: Number(nPricePaid)
                }, { transaction: t, lock: true })
              }
            } else {
              return { isSuccess: true }
            }
            const statisticObj = {
              [`${matchCategory}.nWinCount`]: 1,
              [`${matchCategory}.nWinAmount`]: Number(parseFloat(nFinalAmount).toFixed(2)),
              nWinnings: Number(parseFloat(nFinalAmount).toFixed(2)),
              nTotalWinnings: Number(parseFloat(nFinalAmount).toFixed(2)),
              nBonus: Number(parseFloat(nBonusWin).toFixed(2)),
              nActualBonus: Number(parseFloat(nBonusWin).toFixed(2)),
              nActualWinningBalance: Number(parseFloat(nFinalAmount).toFixed(2))
            }
            await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: statisticObj }, { upsert: true }, { session: session }).w('majority')
          }
        }
        await session.commitTransaction()
        session.endSession()
        return { isSuccess: true }
      })
    } catch (error) {
      // queuePush('ProcessBucketLogs', { fileName: `wd-${iMatchLeagueId}`, putData: { userTeams, error, sNote: 'inside of TDS calculation catch2' } })
      handleCatchError(error)
      return { isSuccess: false, error }
    }
  }

  async userPlayReturn(data) {
    try {
      let { iMatchId, iMatchLeagueId, userLeagues, eCategory } = data
      console.log('inside userPlayReturn....', iMatchId, iMatchLeagueId)

      iMatchLeagueId = iMatchLeagueId.toString()
      iMatchId = iMatchId.toString()
      const userLeagueId = userLeagues.map(({ _id }) => _id.toString())

      const [playReturnPassBooks, playPassBooks] = await Promise.all([
        PassbookModel.findAll({
          where: { eTransactionType: 'Play-Return', iUserLeagueId: { [Op.in]: userLeagueId } },
          attributes: ['iUserLeagueId']
        }),
        PassbookModel.findAll({
          where: { eTransactionType: 'Play', iUserLeagueId: { [Op.in]: userLeagueId } },
          attributes: ['nAmount', 'nBonus', 'nCash', 'nOldDepositBalance', 'nNewDepositBalance', 'nOldWinningBalance', 'nNewWinningBalance', 'iUserLeagueId']
        })
      ])

      console.time(`${iMatchLeagueId} Play Return`)
      for (const ul of userLeagues) {
        await db.sequelize.transaction(
          {
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
          },
          async (t) => {
            let {
              iUserId,
              _id: iUserLeagueId,
              sMatchName,
              sUserName,
              // iMatchId,
              // iMatchLeagueId,
              eType
            } = ul

            eType = eType === 'U' ? 'U' : 'B'
            iUserId = iUserId.toString()
            iUserLeagueId = iUserLeagueId.toString()
            // iMatchLeagueId = iMatchLeagueId.toString()
            // iMatchId = iMatchId.toString()

            const passbookProcessed = await checkProcessed(
              `playReturn:${iMatchLeagueId}:${iUserLeagueId}`,
              15
            )
            if (passbookProcessed !== 'EXIST') {
              // const isExist = await PassbookModel.findOne({
              //   where: {
              //     iUserId,
              //     eTransactionType: 'Play-Return',
              //     iUserLeagueId,
              //     iMatchLeagueId,
              //     iMatchId
              //   },
              //   transaction: t,
              //   lock: true
              // })
              const isExist = playReturnPassBooks.find(({ iUserLeagueId: _id }) => _id === iUserLeagueId)
              if (!isExist) {
                // const [userBalance, passBook] = await Promise.all([
                //   UserBalanceModel.findOne({
                //     where: { iUserId },
                //     transaction: t,
                //     lock: true
                //   }),
                //   PassbookModel.findOne({
                //     where: { iUserId, eTransactionType: 'Play', iUserLeagueId },
                //     transaction: t,
                //     lock: true
                //   })
                // ])
                const passBook = playPassBooks.find(({ iUserLeagueId: _id }) => _id === iUserLeagueId)

                if (passBook) {
                  const userBalance = await UserBalanceModel.findOne({
                    where: { iUserId },
                    attributes: [
                      'nCurrentWinningBalance',
                      'nCurrentDepositBalance',
                      'nCurrentTotalBalance',
                      'nCurrentBonus'
                    ],
                    transaction: t,
                    lock: true
                  })

                  const {
                    nAmount: passBookAmount,
                    nBonus: passBookBonus,
                    nCash: passBookCash
                  } = passBook
                  const {
                    nCurrentWinningBalance,
                    nCurrentDepositBalance,
                    nCurrentTotalBalance,
                    nCurrentBonus
                  } = userBalance

                  const matchCategory = getStatisticsSportsKey(eCategory)

                  const promises = [
                    UserBalanceModel.update(
                      {
                        nCurrentDepositBalance: literal(`nCurrentDepositBalance + ${passBook.nOldDepositBalance - passBook.nNewDepositBalance}`),
                        nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${passBook.nOldWinningBalance - passBook.nNewWinningBalance}`),
                        nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${passBookCash}`),
                        nCurrentBonus: literal(`nCurrentBonus + ${passBookBonus}`)
                      },
                      { where: { iUserId }, transaction: t, lock: true }
                    ),
                    PassbookModel.create(
                      {
                        iUserId,
                        nAmount: passBookAmount,
                        nCash: passBookCash,
                        nBonus: passBookBonus,
                        eTransactionType: 'Play-Return',
                        eUserType: eType,
                        eType: 'Cr',
                        iUserLeagueId,
                        iMatchLeagueId,
                        iMatchId,
                        nOldWinningBalance: nCurrentWinningBalance,
                        nOldDepositBalance: nCurrentDepositBalance,
                        nOldTotalBalance: nCurrentTotalBalance,
                        nOldBonus: nCurrentBonus,
                        sRemarks: `${sUserName} gets play return from ${sMatchName} (${eCategory})`,
                        dActivityDate: new Date()
                      },
                      { transaction: t, lock: true }
                    ),
                    StatisticsModel.updateOne(
                      { iUserId: ObjectId(ul.iUserId) },
                      {
                        $inc: {
                          nWinnings: Number(parseFloat(passBook.nOldWinningBalance - passBook.nNewWinningBalance).toFixed(2)),
                          nTotalPlayReturn: Number(parseFloat(passBookAmount).toFixed(2)),
                          nTotalPlayReturnBonus: Number(parseFloat(passBookBonus).toFixed(2)),
                          nTotalPlayReturnCash: Number(parseFloat(passBookCash).toFixed(2)),
                          nActualDepositBalance: Number(parseFloat(passBook.nOldDepositBalance - passBook.nNewDepositBalance).toFixed(2)),
                          nActualWinningBalance: Number(parseFloat(passBook.nOldWinningBalance - passBook.nNewWinningBalance).toFixed(2)),
                          nActualBonus: Number(parseFloat(passBookBonus).toFixed(2)),
                          [`${matchCategory}.nPlayReturn`]: Number(parseFloat(passBookAmount).toFixed(2)),
                          [`${matchCategory}.nSpendingCash`]: -Number(parseFloat(passBookCash).toFixed(2)),
                          [`${matchCategory}.nSpendingBonus`]: -Number(parseFloat(passBookBonus).toFixed(2))
                        }
                      },
                      { upsert: true }
                    )
                  ]

                  if (ul.eType === 'U') {
                    promises.push(
                      queuePush('pushNotification:playReturn', {
                        _id: ul.iUserId
                      })
                    )
                  }
                  await Promise.all(promises)
                }
              }
            }
          }
        )
      }
      console.timeEnd(`${iMatchLeagueId} Play Return`)

      return { isSuccess: true }
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  async winStoredProcedure(iId, userLeague) {
    try {
      const response = { isSuccess: true }
      if (userLeague && userLeague.length) {
        const procedureArgument = { replacements: { iId } }
        await SQLUserLeagueModel.destroy({ where: { iMatchLeagueId: iId, eTransactionType: 'Win' } })
        await SQLUserLeagueModel.bulkCreate(userLeague)
        response.data = await db.sequelize.query('CALL bulkWinDistribution(:iId)', procedureArgument)
      }
      return response
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  async loyaltyPointStoredProcedure(iId, userLeague) {
    try {
      const response = { isSuccess: true }
      if (userLeague && userLeague.length) {
        const _sRemark = '# earned ## loyalty points for match League'
        const procedureArgument = { replacements: { iId, _sRemark } }
        await SQLUserLeagueModel.destroy({ where: { iMatchLeagueId: iId, eTransactionType: 'Loyalty-Point' } })
        await SQLUserLeagueModel.bulkCreate(userLeague)
        response.data = db.sequelize.query('CALL bulkLoyaltyDistribution(:iId, :_sRemark)', procedureArgument).then(console.log).catch(console.log)
      }
      return response
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }
}
// test
module.exports = new UserBalance()
