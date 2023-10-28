const mongoose = require('mongoose')
const { handleCatchError } = require('../helper/utilities.services')

const config = require('../config/config')
const connectionEvent = require('../events/connection')

const UsersDBConnect = connection(config.USERS_DB_URL, 'Users')
const LeaguesDBConnect = connection(config.LEAGUES_DB_URL, 'Leagues')
const StatisticsDBConnect = connection(config.STATISTICS_DB_URL, 'Statistics')
const FantasyTipsDBConnect = connection(config.FANTASYTIPS_DB_URL, 'FantasyTips')
const PromocodesDBConnect = connection(config.PROMOCODES_DB_URL, 'Promocodes')
const AdminsDBConnect = connection(config.ADMINS_DB_URL, 'Admins')
const GamesDBConnect = connection(config.GAME_DB_URL, 'Game')

const MatchDBConnect = connection(config.MATCH_DB_URL, 'Match')
const FantasyTeamConnect = connection(config.FANTASY_TEAM_DB_URL, 'FantasyTeam')
const SeriesLBDBConnect = connection(config.SERIES_LB_DB_URL, 'Series Leader-Board')

function connection(DB_URL, DB) {
  try {
    // const conn = mongoose.createConnection(DB_URL, { promiseLibrary: global.Promise, useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true })
    const conn = mongoose.createConnection(DB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    conn.on('connected', () => {
      console.log(`Connected to ${DB} database...`)
      connectionEvent.ready('MongoDB')
    })

    conn.on('disconnected', () => {
      console.log(`Disconnected to ${DB} database...`)
      connectionEvent.lost()
    })
    return conn
  } catch (error) {
    handleCatchError(error)
  }
}

// mongoose.set('useFindAndModify', false)
// mongoose.set('debug', true)

module.exports = {
  UsersDBConnect,
  LeaguesDBConnect,
  StatisticsDBConnect,
  FantasyTipsDBConnect,
  PromocodesDBConnect,
  AdminsDBConnect,
  GamesDBConnect,
  MatchDBConnect,
  FantasyTeamConnect,
  SeriesLBDBConnect
}
