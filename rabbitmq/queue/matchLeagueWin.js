
/**
 * MatchLeagueWin queue in RabbitMQ
 */
const connectionEvent = require('../../events/connection')
const { rabbitMqInstance, getChannel } = require('../connection/amqplib')
// const { winDistributionByLeagueOld } = require('../../model-routes-services/services/winDistribution')
const routingQueueKey = 'MatchLeagueWin'
const { queuePush } = require('../../helper/redis')

/**
 * consuming data, start after all connections established
 */
connectionEvent.on('ready', () => {
  console.log(`#####STARTED CONSUMING ${routingQueueKey} QUEUE#####`)
  rabbitMqInstance.consume(getChannel(), routingQueueKey, (data) => {
    data = JSON.parse(data)
    console.log('Received', data)
    queuePush('MatchLeagueWin', data)
  })
})

const publish = async (msg) => {
  rabbitMqInstance.publish(getChannel(), routingQueueKey, msg)
}

module.exports = {
  publish
}
