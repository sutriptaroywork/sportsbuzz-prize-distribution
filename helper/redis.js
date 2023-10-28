const Redis = require('ioredis')
const config = require('../config/config')
const { handleCatchError } = require('./utilities.services')

const connectionEvent = require('../events/connection')

const redisClient = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD
})

redisClient.on('error', function (error) {
  console.log('Error in Redis', error)
  handleCatchError(error)
  process.exit(1)
})

redisClient.on('connect', function () {
  console.log('redis connected')
  connectionEvent.ready('REDIS')
})

module.exports = {
  checkProcessed: function (sKey, nExpire = 15) {
    return new Promise((resolve, reject) => {
      // if (process.env.NODE_ENV === 'dev') return resolve()
      if (!sKey) return resolve()
      redisClient.incr(sKey).then(data => {
        if (data > 1) {
          return resolve('EXIST')
        } else {
          redisClient.expire(sKey, nExpire).then().catch()
          return resolve()
        }
      }).catch(error => {
        handleCatchError(error)
        return resolve()
      })
    })
  },

  setWinData: function(leagueId, data) {
    return new Promise((resolve, reject) => {
      (async () => {
        await redisClient.set(`winner:${leagueId}`, JSON.stringify(data))
        resolve()
      })()
    })
  },

  getWinData: function(leagueId) {
    return new Promise((resolve, reject) => {
      (async () => {
        const winner = await redisClient.get(`winner:${leagueId}`)
        if (winner && winner.length) return resolve(JSON.parse(winner))
        else return resolve([])
      })()
    })
  },

  queuePush: function (queueName, data) {
    return redisClient.rpush(queueName, JSON.stringify(data))
  },

  queueLPush: function (queueName, data) {
    return redisClient.lpush(queueName, JSON.stringify(data))
  },

  queuePop: function (queueName, data) {
    return redisClient.lpop(queueName)
  },

  bulkQueuePop: function (queueName, limit) {
    return redisClient.lpop(queueName, limit)
  },

  bulkQueuePush: async function (queueName, aData, limit) {
    const aStringData = aData.map(d => JSON.stringify(d))

    while (aStringData.length) {
      await redisClient.rpush(queueName, ...aStringData.splice(0, limit))
    }
  },

  queueLen: function (queueName) {
    return redisClient.llen(queueName)
  },
  redisClient
}
