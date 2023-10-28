const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const UserLeagueModel = require('../models/userLeagueModel')
// const { queuePush, queuePop } = require('../../helper/redis')
const { handleCatchError } = require('../../helper/utilities.services')

/*
  Calculate rank for each matchLeague
*/
async function generateUserTeamRankByLeague(data) {
  // let data
  try {
    // data = await queuePop('MatchLeague')
    // if (!data) {
    //   setTimeout(() => { generateUserTeamRankByLeague() }, 2000)
    //   return
    // }
    console.log(`calculate rank ${data}`)
    data = JSON.parse(data)
    const { iMatchId, _id, bRankCalculateFlag } = data
    const rankQuery = bRankCalculateFlag === true ? { bRankCalculated: true } : {}
    if (bRankCalculateFlag === true) {
      // const putData = { queueName: 'MatchLeague', queueData: data }
      // queuePush('ProcessBucketLogs', { fileName: _id, putData })
    }
    const teams = await UserLeagueModel.find({ bCancelled: false, iMatchId: ObjectId(iMatchId), iMatchLeagueId: ObjectId(_id) }, { nTotalPoints: 1 }).sort({ nTotalPoints: -1 }).read('primary').readConcern('majority').lean()
    let r = 1
    if (teams.length === 1) {
      await UserLeagueModel.updateOne({ _id: ObjectId(teams[0]._id) }, { nRank: 1, ...rankQuery }).w('majority')

      // const putData = { _id: ObjectId(teams[0]._id), nRank: 1, ...rankQuery }
      // queuePush('ProcessBucketLogs', { fileName: _id, putData })
    } else if (teams.length === 2) {
      if (teams[0].nTotalPoints === teams[1].nTotalPoints) {
        await Promise.all([
          UserLeagueModel.updateOne({ _id: ObjectId(teams[0]._id) }, { nRank: 1, ...rankQuery }).w('majority'),
          UserLeagueModel.updateOne({ _id: ObjectId(teams[1]._id) }, { nRank: 1, ...rankQuery }).w('majority')
        ])
        // const putData = { ul1: { _id: ObjectId(teams[0]._id), nRank: 1, ...rankQuery }, ul2: { _id: ObjectId(teams[1]._id), nRank: 1, ...rankQuery } }
        // queuePush('ProcessBucketLogs', { fileName: _id, putData })
      } else if (teams[0].nTotalPoints > teams[1].nTotalPoints) {
        await Promise.all([
          UserLeagueModel.updateOne({ _id: ObjectId(teams[0]._id) }, { nRank: 1, ...rankQuery }).w('majority'),
          UserLeagueModel.updateOne({ _id: ObjectId(teams[1]._id) }, { nRank: 2, ...rankQuery }).w('majority')
        ])
        // const putData = { ul1: { _id: ObjectId(teams[0]._id), nRank: 1, ...rankQuery }, ul2: { _id: ObjectId(teams[1]._id), nRank: 2, ...rankQuery } }
        // queuePush('ProcessBucketLogs', { fileName: _id, putData })
      } else {
        await Promise.all([
          UserLeagueModel.updateOne({ _id: ObjectId(teams[0]._id) }, { nRank: 2, ...rankQuery }).w('majority'),
          UserLeagueModel.updateOne({ _id: ObjectId(teams[1]._id) }, { nRank: 1, ...rankQuery }).w('majority')
        ])
        // const putData = { ul1: { _id: ObjectId(teams[0]._id), nRank: 2, ...rankQuery }, ul2: { _id: ObjectId(teams[1]._id), nRank: 1, ...rankQuery } }
        // queuePush('ProcessBucketLogs', { fileName: _id, putData })
      }
    } else {
      const bulkArray = []

      for (const [i, team] of teams.entries()) {
        team.rank = r
        if (i + 1 >= teams.length) {
          teams[teams.length - 1].rank = teams[teams.length - 1].nTotalPoints === teams[teams.length - 2].nTotalPoints ? teams[teams.length - 1].rank : r++
        } else if (teams[i + 1].nTotalPoints !== team.nTotalPoints) {
          r = i + 2
        }

        bulkArray.push({
          updateOne: {
            filter: { _id: { $in: ObjectId(team._id) } },
            update: { $set: { nRank: team.rank, ...rankQuery } }
          }
        })
        // await UserLeagueModel.updateOne({ _id: ObjectId(team._id) }, { nRank: team.rank, ...rankQuery }).w('majority')
        // const putData = { _id: ObjectId(teams._id), nRank: team.rank, ...rankQuery }
        // queuePush('ProcessBucketLogs', { fileName: _id, putData })
      }

      await UserLeagueModel.bulkWrite(bulkArray, { writeConcern: { w: 'majority' }, ordered: false })
    }
    // generateUserTeamRankByLeague()
  } catch (error) {
    // await queuePush('dead:MatchLeague', data)
    handleCatchError(error)
    // setTimeout(() => { generateUserTeamRankByLeague() }, 2000)
  }
}

module.exports = {
  generateUserTeamRankByLeague
}
