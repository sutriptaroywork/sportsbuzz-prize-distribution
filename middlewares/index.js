const bodyParser = require('body-parser')
const cors = require('cors')
const helmet = require('helmet')
const Sentry = require('@sentry/node')
const compression = require('compression')
const hpp = require('hpp')

const data = require('../data')

module.exports = (app) => {
  Sentry.init({
    dsn: 'https://ca4d3ad7705241a1acf8de77d9e85113@o4504490770235392.ingest.sentry.io/4504490774757376',
    tracesSampleRate: 1.0
  })

  // app.use(morgan('dev'))

  app.use(cors())
  app.use(helmet())
  app.disable('x-powered-by')
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(hpp())

  app.use(compression({
    filter: function (req, res) {
      if (req.headers['x-no-compression']) {
        // don't compress responses with this request header
        return false
      }
      // fallback to standard filter function
      return compression.filter(req, res)
    }
  }))

  // set language in request object
  app.use((req, res, next) => {
    if (!req.header('Language')) {
      req.userLanguage = 'English'
    } else if ((data.supportedLanguage).indexOf(req.header('Language')) !== -1) {
      req.userLanguage = req.header('Language')
    } else {
      req.userLanguage = 'English'
    }
    next()
  })
}
