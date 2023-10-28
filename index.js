const express = require('express')

const config = require('./config/config')

const app = express()
global.appRootPath = __dirname

require('./database/mongoose')
require('./rabbitmq/connection/amqplib')
require('./rabbitmq/consumer')

require('./middlewares/index')(app)

require('./model-routes-services/routes/index')(app)

require('./queue')

app.listen(config.PORT, () => {
  console.log('Magic happens on port :' + config.PORT)
})

module.exports = app
