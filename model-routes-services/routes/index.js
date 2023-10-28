module.exports = (app) => {
  app.get('/health-check', (req, res) => {
    return res.status(200).send('200')
  })
  app.get('*', (req, res) => {
    return res.status(404).send('404')
  })
}
