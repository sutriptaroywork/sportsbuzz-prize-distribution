
/**
 * MatchLeague queue in RabbitMQ
 */
const connectionEvent = require('../../events/connection')
const { rabbitMqInstance, getChannel } = require('../connection/amqplib')
const { generateUserTeamRankByLeague } = require('../../model-routes-services/services/rankCalculation')
const routingQueueKey = 'MatchLeague'

/**
 * consuming data, start after all connections established
 */
connectionEvent.on('ready', () => {
  console.log(`#####STARTED CONSUMING ${routingQueueKey} QUEUE#####`)
  rabbitMqInstance.consume(getChannel(), routingQueueKey, generateUserTeamRankByLeague)
})

module.exports = {}
