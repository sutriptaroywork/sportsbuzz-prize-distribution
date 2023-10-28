const enums = {
  category: ['CRICKET', 'FOOTBALL', 'KABADDI', 'BASEBALL', 'BASKETBALL'],
  format: ['T10', 'T20', 'ODI', 'BASEBALL', '100BALL', 'FOOTBALL', 'BASKETBALL', 'KABADDI', 'TEST'],
  role: ['BATS', 'BWL', 'ALLR', 'WK', 'IF', 'OF', 'P', 'CT', 'GK', 'DEF', 'MID', 'FWD', 'PG', 'SG', 'PF', 'SF', 'C'],
  platform: ['A', 'I', 'W', 'O', 'AD'], // A = Android, I = iOS, W = Web, O = Other, AD = Admin

  status: ['Y', 'N'],

  adminLogTypes: ['L', 'PC', 'RP'], // L = Login, PC = Password Change, RP = Reset Password
  adminStatus: ['Y', 'B', 'D'],
  adminType: ['SUPER', 'SUB'],
  adminLogKeys: ['D', 'W', 'P', 'KYC', 'BD', 'SUB'], // D = DEPOSIT, W = WITHDRAW, P = PROFILE, BD = BANK DETAILS, SA = SUBADMIN

  adminPay: ['PAY'],

  bannerType: ['S', 'L'], // S = SCREEN, l = lINK, CR = CONTEST REDIRECT
  bannerScreen: ['D', 'S', 'CR'], // D = DEPOSIT S = SHARE
  bannerPlace: ['D', 'H'], // D = DEPOSIT H = HOME

  popupAdsType: ['I', 'E'], // I = INTERNAL, E = EXTERNAL
  popupAdsPlatform: ['ALL', 'W', 'A', 'I'], // I = IOS, A = ANDROID, W = WEB

  commonRule: ['RB', 'RCB', 'RR', 'DB', 'PLC', 'LCC', 'LCG'], // RB = REGISTER_BONUS, RCB = REFER_CODE_BONUS, RR = REGISTER_REFER, DB = DEPOSIT_BONUS, PLC = PRIVATE_LEAGUE_COMMISSION, LCC =LEAGUE_CREATOR_COMMISSION, LCG = LEAGUE_CREATOR_GST
  ruleType: ['C', 'B'], // C = CASH, B = BONUS

  kycStatus: ['P', 'A', 'R', 'N'], // P = Pending, A = Accepted, R = Rejected, N = Not uploaded
  bankStatus: ['P', 'A', 'R', 'N'], // P = Pending, A = Accepted, R = Rejected, N = Not uploaded

  leagueRankType: ['R', 'B', 'E'], // R = REAL_MONEY, B = BONUS, E = EXTRA

  matchStatus: ['P', 'U', 'L', 'CMP', 'CNCL', 'I'], // P = Pending, U = Upcoming, L = Live, CMP = Completed, CNCL = Cancel, I = Inreview
  matchTossWinnerAction: ['BAT', 'BOWLING'],
  matchProvider: ['SPORTSRADAR', 'CUSTOM', 'ENTITYSPORT'],

  notificationStatus: [0, 1],
  notificationTopic: ['All', 'Web', 'IOS', 'Android'],

  authLogType: ['R', 'L', 'PC', 'RP'],

  userType: ['U', 'B'],
  userGender: ['M', 'F', 'O'],
  socialType: ['G', 'F', 'A'],
  userStatus: ['Y', 'N', 'D'],

  otpType: ['E', 'M'], // Email | Mobile
  otpAuth: ['R', 'F', 'V', 'L'], // Register | ForgotPass | Verification

  // paymentOptionsKey, paymentGetaways and withdrawPaymentGetaways all must be same ( except type ADMIN  )
  paymentOptionsKey: ['PAYTM', 'AMAZON', 'CASHFREE'],
  paymentGetaways: ['PAYTM', 'ADMIN', 'CASHFREE'],
  payoutOptionKey: ['PAYTM', 'AMAZON', 'CASHFREE'],
  withdrawPaymentGetaways: ['ADMIN', 'PAYTM', 'AMAZON', 'CASHFREE'],

  payoutOptionType: ['INSTANT', 'STD'],

  paymentStatus: ['P', 'S', 'C', 'R'], // pending success cancelled refunded

  transactionType: ['Bonus', 'Refer-Bonus', 'Deposit', 'Withdraw', 'Win', 'Play', 'Bonus-Expire', 'Play-Return', 'Win-Return', 'Opening', 'Creator-Bonus', 'TDS', 'Withdraw-Return', 'Cashback-Contest', 'Cashback-Return', 'Loyalty-Point'],
  userLeagueTransactionType: ['Win', 'Play', 'Loyalty-Point'],
  passbookType: ['Dr', 'Cr'],
  passbookStatus: ['P', 'CMP', 'C'],

  seriesLBCategoriesTemplateType: ['CONTEST_JOIN', 'PRIZE_WON', 'LOYALTY_POINTS'],
  reportsKeys: ['TU', 'RU', 'LU', 'TUT', 'W', 'BE', 'UB'],
  sportsReportsKeys: ['TP', 'TT', 'TB', 'UT', 'LP', 'TW', 'CNCLL', 'CMPL', 'CL', 'PR', 'PL', 'CC', 'CR', 'CB'],
  allReportKeys: ['TU', 'RU', 'LU', 'TUT', 'W', 'BE', 'UB', 'TP', 'TT', 'TB', 'UT', 'LP', 'TW', 'CNCLL', 'CMPL', 'CL', 'PR', 'PL', 'CC', 'CR', 'CB'],

  seriesStatus: ['P', 'L', 'CMP'],

  adminPermissionType: ['R', 'W', 'N'],
  adminPermission: [
    'SUBADMIN',
    'PERMISSION',
    'BANNER',
    'CMS',
    'RULE',
    'KYC',
    'LEAGUE',
    'MATCH',
    'MATCHLEAGUE',
    'MATCHPLAYER',
    'NOTIFICATION',
    'OFFER',
    'PASSBOOK',
    'PAYMENT_OPTION',
    'PLAYER',
    'ROLES',
    'PREFERENCES',
    'PROMO',
    'REPORT',
    'SCORE_POINT',
    'SERIES_LEADERBOARD',
    'SETTING',
    'TEAM',
    'BANKDETAILS',
    'USERS',
    'STATISTICS',
    'SYSTEM_USERS',
    'BALANCE',
    'DEPOSIT',
    'USERLEAGUE',
    'USERTEAM',
    'WITHDRAW',
    'VERSION',
    'VALIDATION',
    'SPORT',
    'PUSHNOTIFICATION',
    'EMAIL_TEMPLATES',
    'POPUP_ADS',
    'LEADERSHIP_BOARD',
    'COMPLAIN',
    'PAYOUT_OPTION',
    'MAINTENANCE',
    'ADMIN_ROLE'
  ],
  supportedLanguage: ['English', 'Hindi'],
  promocodeTypes: ['DEPOSIT', 'MATCH'],
  complainStatus: ['P', 'I', 'D', 'R'], // Pending In-Progress Declined Resolved
  issueType: ['C', 'F'], // Complain Feedback
  settingKeys: ['BG', 'IMG'],
  cssTypes: ['COMMON', 'CONDITION'],
  versionType: ['A', 'I'], // A = Android, I = iOS
  rewardOn: ['REGISTER', 'FIRST_DEPOSIT', 'FIRST_LEAGUE_JOIN'],
  botType: ['N', 'CP'], // N = Normal Bot, CP = Copy Bot
  copyTeamTypes: ['SAME', 'ROTATE', 'RANDOM'],
  userTypeForJoinLeague: ['U', 'B', 'CB', 'CMB'] // U = USER, B = BOT, CB = COPY_BOT, CMB = COMBINATION_BOT
}

module.exports = enums
