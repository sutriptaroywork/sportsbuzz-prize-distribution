const prod = {
  PORT: process.env.PORT || 1340,
  USERS_DB_URL: process.env.USERS_DB_URL || 'mongodb://localhost:27017/fantasy_users',
  LEAGUES_DB_URL: process.env.LEAGUES_DB_URL || 'mongodb://localhost:27017/fantasy_leagues',
  NOTIFICATION_DB_URL: process.env.NOTIFICATION_DB_URL || 'mongodb://localhost:27017/fantasy_notifications',
  STATISTICS_DB_URL: process.env.STATISTICS_DB_URL || 'mongodb://localhost:27017/fantasy_statistics',
  BANNERS_DB_URL: process.env.BANNERS_DB_URL || 'mongodb://localhost:27017/fantasy_banners',
  COMPLAINS_DB_URL: process.env.COMPLAINS_DB_URL || 'mongodb://localhost:27017/fantasy_complains',
  FANTASYTIPS_DB_URL: process.env.FANTASYTIPS_DB_URL || 'mongodb://localhost:27017/fantasy_tips',
  PROMOCODES_DB_URL: process.env.PROMOCODES_DB_URL || 'mongodb://localhost:27017/fantasy_promocodes',
  ADMINS_DB_URL: process.env.ADMINS_DB_URL || 'mongodb://localhost:27017/fantasy_admins',
  GEO_DB_URL: process.env.GEO_DB_URL || 'mongodb://localhost:27017/fantasy_geo',
  GAME_DB_URL: process.env.GAME_DB_URL || 'mongodb://localhost:27017/fantasy_game',
  MATCH_DB_URL: process.env.MATCH_DB_URL || 'mongodb://localhost:27017/fantasy_match',
  FANTASY_TEAM_DB_URL: process.env.FANTASY_TEAM_DB_URL || 'mongodb://localhost:27017/fantasy_teams',
  SERIES_LB_DB_URL: process.env.SERIES_LB_DB_URL || 'mongodb://localhost:27017/fantasy_seriesLB',

  DB_SQL_NAME: process.env.DB_SQL_NAME || 'fantasy_development',
  DB_SQL_USER: process.env.DB_SQL_USER || 'root',
  DB_SQL_PASSWORD: process.env.DB_SQL_PASSWORD || 'root',
  DB_SQL_PORT: process.env.DB_SQL_PORT || 3306,
  DB_SQL_HOST: process.env.DB_SQL_HOST || '127.0.0.1',
  DB_SQL_DIALECT: process.env.DB_SQL_DIALECT || 'mysql',

  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,

  JWT_SECRET: process.env.JWT_SECRET || 'aAbBcC@test_123',

  CACHE_1: 10, // 10 seconds
  CACHE_2: 60, // 1 minute
  CACHE_3: 3600, // 1 hour
  CACHE_4: 86400, // 1 day
  CACHE_5: 864000, // 10 days
  CACHE_6: 21600, // 6 Hours
  CACHE_7: 300, // 5 minute
  CACHE_8: 600, // 10 minute
  CACHE_9: 5, // 5 seconds,
  CACHE_10: 1800, // 30 minute

  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || 'your aws access key',
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY || 'your aws secretAccessKey',
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'yudiz-fantasy-media',
  S3_BUCKET_URL: process.env.S3_BUCKET_URL || 'https://yudiz-fantasy-media.s3.ap-south-1.amazonaws.com/',

  s3PriceDistributionLog: process.env.S3_PRICE_DISTRIBUTION_PATH || 'priceDistributionLogs/',
  bAllowDiskUse: process.env.MONGODB_ALLOW_DISK_USE || true,
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost'
}

module.exports = prod
