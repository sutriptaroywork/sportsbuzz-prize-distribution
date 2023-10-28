
/**
 * MatchLeagueRank queue in RabbitMQ
 */
const connectionEvent = require('../../events/connection')
const { rabbitMqInstance, getChannel } = require('../connection/amqplib')
const { prizeDistributionByLeague } = require('../../model-routes-services/services/prizeDistribution')
const routingQueueKey = 'MatchLeagueRank'

/**
 * consuming data, start after all connections established
 */
connectionEvent.on('ready', () => {
  console.log(`#####STARTED CONSUMING ${routingQueueKey} QUEUE#####`)
  rabbitMqInstance.consume(getChannel(), routingQueueKey, prizeDistributionByLeague)
})

module.exports = {}
