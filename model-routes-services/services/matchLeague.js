const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const UserLeagueModel = require('../models/userLeagueModel')
const MyMatchesModel = require('../models/myMatchesModel')
const AdminLogModel = require('../models/adminLogModel')
const MatchLeagueModel = require('../models/matchLeagueModel')
const userBalanceServices = require('./userBalance')
const { handleCatchError } = require('../../helper/utilities.services')
const { queuePush } = require('../../helper/redis')

class MatchLeague {
  async processPlayReturn(matchLeague, type, iAdminId = null, sIP = '', sOperationBy = 'CRON', nJoined, uniqueUserJoinCount) {
    try {
      // const transactionOptions = {
      //   readPreference: 'primary',
      //   readConcern: { level: 'majority' },
      //   writeConcern: { w: 'majority' }
      // }

      // const session = await GamesDBConnect.startSession()
      // session.startTransaction(transactionOptions)

      // try {
      let userLeagues = []

      if (type === 'MATCHLEAGUE' || type === 'MANUALLY') {
        // await MatchLeagueModel.findByIdAndUpdate(matchLeague._id, { bCancelled: true }, { runValidators: true, new: true }).session(session).lean()
        userLeagues = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(matchLeague._id) }).lean()

        // await MyMatchesModel.updateMany({ iMatchId: ObjectId(matchLeague.iMatchId), aMatchLeagueId: { $in: [ObjectId(matchLeague._id)] } }, { $pull: { aMatchLeagueId: ObjectId(matchLeague._id) }, $inc: { nJoinedLeague: -1 }, $push: { aCMatchLeagueId: ObjectId(matchLeague._id) } })
      } else if (type === 'OVERFLOW') {
        userLeagues = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(matchLeague._id) }).sort({ dCreatedAt: -1 }).limit(Number(matchLeague.nJoined - matchLeague.nMax)).lean()

        // const aUserIds = userLeagues.map(({ iUserId }) => ObjectId(iUserId))
        // await MyMatchesModel.updateMany({ iMatchId: ObjectId(matchLeague.iMatchId), aMatchLeagueId: { $in: [ObjectId(matchLeague._id)] }, iUserId: { $in: aUserIds } }, { $pull: { aMatchLeagueId: ObjectId(matchLeague._id) }, $inc: { nJoinedLeague: -1 }, $push: { aCMatchLeagueId: ObjectId(matchLeague._id) } }, { session: session })
      }

      let bBonusUtil = false
      const nBonusUtil = Number(matchLeague.nBonusUtil)
      const nPrice = Number(matchLeague.nPrice)
      if (nBonusUtil && nBonusUtil > 0 && nPrice > 0) bBonusUtil = true
      const result = await userBalanceServices.userPlayReturn({ bBonusUtil, nActualBonus: 0, nPrice, eCategory: matchLeague.eCategory, userLeagues, iMatchLeagueId: matchLeague._id.toString(), iMatchId: matchLeague.iMatchId.toString() })
      // const result = await userBalanceServices.playReturn({ bBonusUtil, nActualBonus: 0, nPrice, eCategory: matchLeague.eCategory, userLeagues })

      console.log('result :: ', result)
      if (result.isSuccess) {
        // const session = await GamesDBConnect.startSession()
        // session.startTransaction(transactionOptions)

        try {
          if (type === 'MATCHLEAGUE' || type === 'MANUALLY') {
            const logData = {
              oOldFields: { _id: matchLeague._id, sName: matchLeague.sName, bCancelled: false },
              oNewFields: { _id: matchLeague._id, sName: matchLeague.sName, bCancelled: true },
              oDetails: { sOperationBy, nJoined, uniqueUserJoinCount },
              sIP: sIP,
              iAdminId: iAdminId,
              iUserId: null,
              eKey: 'ML'
            }
            const userLeagueIds = userLeagues.map(({ _id }) => _id)

            await Promise.all([
              MyMatchesModel.updateMany({ iMatchId: ObjectId(matchLeague.iMatchId), aMatchLeagueId: { $in: [ObjectId(matchLeague._id)] } }, { $pull: { aMatchLeagueId: ObjectId(matchLeague._id) }, $inc: { League: -1 }, $push: { aCMatchLeagueId: ObjectId(matchLeague._id) } }),
              // MyMatchesModel.updateMany({ iMatchId: ObjectId(matchLeague.iMatchId), aMatchLeagueId: { $in: [ObjectId(matchLeague._id)] } }, { $pull: { aMatchLeagueId: ObjectId(matchLeague._id) }, $inc: { League: -1 }, $push: { aCMatchLeagueId: ObjectId(matchLeague._id) } }, { session: session }),
              AdminLogModel.create(logData),
              UserLeagueModel.updateMany({ _id: { $in: userLeagueIds } }, { bCancelled: true })
              // UserLeagueModel.updateMany({ _id: { $in: userLeagueIds } }, { bCancelled: true }, { session: session })
            ])

            await MatchLeagueModel.updateOne({ _id: ObjectId(matchLeague._id) }, { bCancelled: true, nJoined: userLeagues.length })
            // await MatchLeagueModel.updateOne({ _id: ObjectId(matchLeague._id) }, { bCancelled: true, nJoined: userLeagues.length }).session(session)
          } else if (type === 'OVERFLOW') {
            const aUserIds = userLeagues.map(({ iUserId }) => ObjectId(iUserId))
            const userLeagueIds = userLeagues.map(({ _id }) => _id)

            await Promise.all([
              MyMatchesModel.updateMany({ iMatchId: ObjectId(matchLeague.iMatchId), aMatchLeagueId: { $in: [ObjectId(matchLeague._id)] }, iUserId: { $in: aUserIds } }, { $pull: { aMatchLeagueId: ObjectId(matchLeague._id) }, $inc: { nJoinedLeague: -1 }, $push: { aCMatchLeagueId: ObjectId(matchLeague._id) } }),
              // MyMatchesModel.updateMany({ iMatchId: ObjectId(matchLeague.iMatchId), aMatchLeagueId: { $in: [ObjectId(matchLeague._id)] }, iUserId: { $in: aUserIds } }, { $pull: { aMatchLeagueId: ObjectId(matchLeague._id) }, $inc: { nJoinedLeague: -1 }, $push: { aCMatchLeagueId: ObjectId(matchLeague._id) } }, { session: session }),
              UserLeagueModel.updateMany({ _id: { $in: userLeagueIds } }, { bCancelled: true })
              // UserLeagueModel.updateMany({ _id: { $in: userLeagueIds } }, { bCancelled: true }, { session: session })
            ])

            await MatchLeagueModel.updateOne({ _id: ObjectId(matchLeague._id) }, { $inc: { nJoined: -(userLeagues.length) } })
            // await MatchLeagueModel.updateOne({ _id: ObjectId(matchLeague._id) }, { $inc: { nJoined: -(userLeagues.length) } }).session(session)
          }
          // await session.commitTransaction()

          const { bCashbackEnabled, bIsProcessed, nMinCashbackTeam } = matchLeague

          if (bCashbackEnabled && bIsProcessed && nMinCashbackTeam) {
            const userLeague = userLeagues.map(({ _id }) => { return { _id } })
            const { _id, iMatchId, nMinCashbackTeam: nMinTeam, nCashbackAmount, eCashbackType, eCategory } = matchLeague
            await queuePush('ProcessUsersCashbackReturn', { _id, iMatchId, nMinTeam, nCashbackAmount, eCashbackType, eCategory, userLeague })
          }
        } catch (error) {
          // await session.abortTransaction()
          handleCatchError(error)
          return { isSuccess: false }
        } finally {
          // session.endSession()
        }
      }

      return { isSuccess: true }
      // } catch (error) {
      //   await session.abortTransaction()
      //   handleCatchError(error)
      //   return { isSuccess: false }
      // } finally {
      //   session.endSession()
      // }
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }
}

module.exports = new MatchLeague()
