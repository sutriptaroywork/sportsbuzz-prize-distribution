const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const UserLeagueModel = require('../models/userLeagueModel')
const MatchLeagueModel = require('../models/matchLeagueModel')
// const { queuePush, queuePop } = require('../../helper/redis')
const { handleCatchError, convertToDecimal } = require('../../helper/utilities.services')
const { bAllowDiskUse } = require('../../config/config')

/**
 * It'll do calculate total payout and according that done price distribution in each league
 */
async function prizeDistributionByLeague(data) {
  // let data
  try {
    // data = await queuePop('MatchLeagueRank')
    // if (!data) {
    //   setTimeout(() => { prizeDistributionByLeague() }, 2000)
    //   return
    // }
    data = JSON.parse(data)
    let { _id, aLeaguePrize, nJoined, nMax, bPoolPrize, nPrice, nDeductPercent, bPrivateLeague, nAdminCommission, nCreatorCommission: nCreatorBonus } = data

    // const putData = { queueName: 'MatchLeagueRank', queueData: data }
    // queuePush('ProcessBucketLogs', { fileName: _id, putData })

    const updateObj = { bPrizeDone: true }

    if (bPoolPrize === true) {
      if (bPrivateLeague) {
        const actualFee = nPrice

        const nACommission = ((nJoined * nAdminCommission) / nMax).toFixed(2)
        nAdminCommission = Number(nACommission)
        updateObj.nAdminCommission = nAdminCommission

        const nCBonus = ((nJoined * nCreatorBonus) / nMax).toFixed(2)
        nCreatorBonus = Number(nCBonus)
        updateObj.nCreatorCommission = nCreatorBonus

        const newTotalPayout = (actualFee * nJoined) - nAdminCommission - nCreatorBonus

        updateObj.nTotalPayout = convertToDecimal(newTotalPayout)

        // const prizeBreakup = await PrivateLeaguePrizeModel.findOne({ nPrizeNo: nWinnersCount, eStatus: 'Y' }).lean()
        // if (!prizeBreakup) return false
        aLeaguePrize.forEach(({ nPrize, nRankTo, nRankFrom }, i) => {
          aLeaguePrize[i].nPrize = Number((((newTotalPayout * nPrize) / 100) / (nRankTo - nRankFrom + 1)).toFixed(2))
        })

        // queuePush('ProcessBucketLogs', { fileName: _id, putData: { nAdminCommission, nCreatorCommission: nCreatorBonus, nTotalPayout: newTotalPayout, aLeaguePrize } })
      } else {
        const nTotalPayout = parseFloat(Number(((nPrice * nJoined * 100) / ((nDeductPercent || 0) + 100))).toFixed(2))

        updateObj.nTotalPayout = nTotalPayout

        aLeaguePrize.forEach(({ nPrize, nRankTo, nRankFrom }, i) => {
          aLeaguePrize[i].nPrize = Number((((nTotalPayout * nPrize) / 100) / (nRankTo - nRankFrom + 1)).toFixed(2))
        })

        // queuePush('ProcessBucketLogs', { fileName: _id, putData: { nTotalPayout, aLeaguePrize } })
      }
    }

    const userTeamsRank = await UserLeagueModel.aggregate([
      {
        $match: {
          iMatchLeagueId: ObjectId(_id),
          bCancelled: false
        }
      }, {
        $group: {
          id: { $first: '$_id' },
          _id: '$nRank',
          count: { $sum: 1 },
          data: { $push: '$_id' }
        }
      }, {
        $project: {
          _id: '$id',
          nRank: '$_id',
          data: 1,
          count: 1
        }
      }, {
        $sort: { nRank: 1 }
      }
    ]).read('primary')
      .readConcern('majority')
      .allowDiskUse(bAllowDiskUse).exec()

    let bProcessFull = true

    // queuePush('ProcessBucketLogs', { fileName: _id, putData: { userTeamsRank } })

    for (const team of userTeamsRank) {
      try {
        let sameRankTeamCount = 1
        if (team.count > 1) {
          sameRankTeamCount = team.count
        }
        const prize = getPrice(aLeaguePrize, team.nRank, sameRankTeamCount)
        let { nTotalRealMoney, nTotalBonus, aTotalExtraWin } = prize

        nTotalRealMoney = sameRankTeamCount > 1 ? Number(((nTotalRealMoney / sameRankTeamCount).toFixed(2))) : nTotalRealMoney
        nTotalBonus = sameRankTeamCount > 1 ? Number(((nTotalBonus / sameRankTeamCount).toFixed(2))) : nTotalBonus

        await UserLeagueModel.updateMany({ _id: { $in: team.data } }, { nPrice: nTotalRealMoney, aExtraWin: aTotalExtraWin, nBonusWin: nTotalBonus, bPrizeCalculated: true }).w('majority')
      } catch (err) {
        bProcessFull = false
        // queuePush('ProcessBucketLogs', { fileName: _id, putData: { err } })
        handleCatchError(err)
        break
      }
    }
    if (bProcessFull) await MatchLeagueModel.updateOne({ _id: ObjectId(_id) }, updateObj).w('majority')
    // queuePush('ProcessBucketLogs', { fileName: _id, putData: updateObj })
    // prizeDistributionByLeague()
  } catch (error) {
    // await queuePush('dead:MatchLeagueRank', data)
    handleCatchError(error)
    // setTimeout(() => { prizeDistributionByLeague() }, 2000)
  }
}

/**
 * It'll calculate prize according user rank and same rank count
 * @param { array } aLeaguePrize
 * @param { Number } rank
 * @param { Number } count
 * @returns { object } of calculated totalRealMoney, totalBonus and totalExtraWin
 */
function getPrice(aLeaguePrize, rank, count) {
  let nTotalRealMoney = 0
  let nTotalBonus = 0
  const aTotalExtraWin = []

  for (const leaguePrice of aLeaguePrize) {
    const p = leaguePrice

    for (let i = rank; i < (rank + count); i++) {
      if (i >= p.nRankFrom && i <= p.nRankTo) {
        if (p.eRankType === 'E') {
          aTotalExtraWin.push({ sImage: p.sImage, sInfo: p.sInfo })
        } else if (p.eRankType === 'R') {
          nTotalRealMoney = nTotalRealMoney + Number(p.nPrize)
        } else if (p.eRankType === 'B') {
          nTotalBonus = nTotalBonus + Number(p.nPrize)
        }
      }
    }
  }

  return { nTotalRealMoney: Number(nTotalRealMoney.toFixed(2)), nTotalBonus: Number(nTotalBonus.toFixed(2)), aTotalExtraWin }
}

module.exports = {
  prizeDistributionByLeague
}
