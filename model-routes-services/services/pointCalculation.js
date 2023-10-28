const UserTeamModel = require('../models/userTeamModel')
const PlayerRoleModel = require('../models/playerRoleModel')
const UserLeagueModel = require('../models/userLeagueModel')
const MatchTeamsModel = require('../models/matchTeamModel')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { handleCatchError } = require('../../helper/utilities.services')
const { queuePush, queuePop } = require('../../helper/redis')

/*
  Calculate total score point for each match team
  Update userteam point which belongs to this match teams
  Update User league point
*/
// async function calculateTotalScorePointV2() {
//   let data
//   try {
//     data = await queuePop('MatchTeams')
//     if (!data) {
//       setTimeout(() => { calculateTotalScorePointV2() }, 2000)
//       return
//     }
//     data = JSON.parse(data)
//     const { eCategory } = data

//     const putData = { queueName: 'MatchTeams', queueData: data }
//     const fileName = `${data.iMatchId}-scorePoints`
//     // queuePush('ProcessBucketLogs', { fileName, putData })

//     const points = await PlayerRoleModel.findOne({ eCategory: eCategory }).lean()
//     const players = await MatchTeamsModel.findOne({ iMatchId: data.iMatchId, sHash: data.sHash }, { aPlayers: 1 }).populate('aPlayers.iMatchPlayerId', 'nScoredPoints').read('primary').readConcern('majority').lean()

//     let totalPoint = 0
//     const point = players.aPlayers.map((player) => { // calculate total team point
//       const { _id, nScoredPoints } = player.iMatchPlayerId || { nScoredPoints: 0 }
//       totalPoint = totalPoint + nScoredPoints
//       return { iTeamId: player.iTeamId, iMatchPlayerId: _id, nScoredPoints }
//     })

//     await MatchTeamsModel.updateOne({ _id: ObjectId(players._id) }, { nTotalPoint: totalPoint, aPlayers: point }).w('majority')

//     const userTeams = await UserTeamModel.find({ iMatchId: data.iMatchId, sHash: data.sHash, bPointCalculated: false }).populate('iCaptainId', 'nScoredPoints').populate('iViceCaptainId', 'nScoredPoints').read('primary').readConcern('majority').lean()
//     for (const team of userTeams) {
//       try {
//         let nTotalPoints = totalPoint - (team.iViceCaptainId.nScoredPoints + team.iCaptainId.nScoredPoints)
//         // calculate and update captain and viceCaption point
//         nTotalPoints = nTotalPoints + (team.iViceCaptainId.nScoredPoints * points.nViceCaptainPoint) + (team.iCaptainId.nScoredPoints * points.nCaptainPoint)
//         await UserTeamModel.updateOne({ _id: ObjectId(team._id) }, { nTotalPoints, bPointCalculated: true }).w('majority')
//         await UserLeagueModel.updateMany({ iUserTeamId: ObjectId(team._id) }, { nTotalPoints, bPointCalculated: true }).w('majority')
//       } catch (err) {
//         handleCatchError(err)
//       }
//     }
//     const userPointCalculateCount = await UserTeamModel.countDocuments({ iMatchId: data.iMatchId, sHash: data.sHash, bPointCalculated: false })
//     if (!userPointCalculateCount) {
//       const UserTeams = await UserTeamModel.find({ iMatchId: data.iMatchId, sHash: data.sHash, bPointCalculated: true }, { nTotalPoints: 1 }).read('primary').readConcern('majority').lean()
//       for (const team of UserTeams) {
//         await UserLeagueModel.updateMany({ iUserTeamId: ObjectId(team._id) }, { nTotalPoints: team.nTotalPoints, bPointCalculated: true }).w('majority')
//       }
//     }
//     calculateTotalScorePointV2()
//   } catch (error) {
//     await queuePush('dead:MatchTeams', data)
//     handleCatchError(error)
//     setTimeout(() => { calculateTotalScorePointV2() }, 2000)
//   }
// }

// migrated to node-backend repo
async function calculateTotalScorePointV2() {
  let data
  try {
    data = await queuePop('MatchTeams')
    if (!data) {
      setTimeout(() => { calculateTotalScorePointV2() }, 2000)
      return
    }
    data = JSON.parse(data)
    const { eCategory } = data

    const points = await PlayerRoleModel.findOne({ eCategory: eCategory }).lean()
    const players = await MatchTeamsModel.findOne({ iMatchId: data.iMatchId, sHash: data.sHash }, { aPlayers: 1 }).populate('aPlayers.iMatchPlayerId', 'nScoredPoints').read('primary').readConcern('majority').lean()

    let totalPoint = 0
    const point = players.aPlayers.map((player) => { // calculate total team point
      const { _id, nScoredPoints } = player.iMatchPlayerId || { nScoredPoints: 0 }
      totalPoint = totalPoint + nScoredPoints
      return { iTeamId: player.iTeamId, iMatchPlayerId: _id, nScoredPoints }
    })

    await MatchTeamsModel.updateOne({ _id: ObjectId(players._id) }, { nTotalPoint: totalPoint, aPlayers: point }).w('majority')

    UserTeamModel.find({ iMatchId: data.iMatchId, sHash: data.sHash, bPointCalculated: false }).populate('iCaptainId', 'nScoredPoints').populate('iViceCaptainId', 'nScoredPoints').read('primary').readConcern('majority').cursor()
      .on('data', async (team) => {
        try {
          let nTotalPoints = totalPoint - (team.iViceCaptainId.nScoredPoints + team.iCaptainId.nScoredPoints)
          // calculate and update captain and viceCaption point
          nTotalPoints = nTotalPoints + (team.iViceCaptainId.nScoredPoints * points.nViceCaptainPoint) + (team.iCaptainId.nScoredPoints * points.nCaptainPoint)
          await UserTeamModel.updateOne({ _id: ObjectId(team._id) }, { nTotalPoints, bPointCalculated: true }).w('majority')
          await UserLeagueModel.updateMany({ iUserTeamId: ObjectId(team._id) }, { nTotalPoints, bPointCalculated: true }).w('majority')
        } catch (err) {
          handleCatchError(err)
        }
      })
      .on('end', async () => {
        try {
          const userPointCalculateCount = await UserTeamModel.countDocuments({ iMatchId: data.iMatchId, sHash: data.sHash, bPointCalculated: false })
          if (!userPointCalculateCount) {
            UserTeamModel.find({ iMatchId: data.iMatchId, sHash: data.sHash, bPointCalculated: true }, { nTotalPoints: 1 }).read('primary').readConcern('majority').cursor()
              .on('data', async (team) => {
                try {
                  await UserLeagueModel.updateMany({ iUserTeamId: ObjectId(team._id) }, { nTotalPoints: team.nTotalPoints, bPointCalculated: true }).w('majority')
                } catch (err) {
                  handleCatchError(err)
                }
              })
          }
          calculateTotalScorePointV2()
        } catch (err) {
          handleCatchError(err)
        }
      })
  } catch (error) {
    await queuePush('dead:MatchTeams', data)
    handleCatchError(error)
    setTimeout(() => { calculateTotalScorePointV2() }, 2000)
  }
}

module.exports = {
  calculateTotalScorePointV2
}
