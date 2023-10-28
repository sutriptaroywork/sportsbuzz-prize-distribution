/**
 * This file is for all the response Messages and status so we can change it easily at any time.
 * @method messages contains all the messages[req.userLanguage].
 * @method status is for response status.
 * @method jsonStatus is for internal json status. we can change response status to 200 only for all response because browsers logs the 4** errors to console
 */

const messages = {
  English: {
    error: 'Something went wrong.',
    error_with: 'Something went wrong with ##.',
    reg_success: 'Welcome! You are registered successfully.',
    deposit_amount: 'You must add ## rupees to purchase the tickets',
    already_assigned: '## is already assigned to a user, and cannot be reassigned',
    success: '## fetched successfully.',
    successfully: '## successfully.',
    action_success: '##  successful.',
    action_failure: '##  failed.'
  }
}

const status = {
  OK: 200,
  Create: 201,
  Deleted: 204,
  BadRequest: 400,
  Unauthorized: 401,
  NotFound: 404,
  Forbidden: 403,
  NotAcceptable: 406,
  ExpectationFailed: 417,
  Locked: 423,
  InternalServerError: 500,
  UnprocessableEntity: 422,
  ResourceExist: 409,
  TooManyRequest: 429
}

const jsonStatus = {
  OK: 200,
  Create: 201,
  Deleted: 204,
  BadRequest: 400,
  Unauthorized: 401,
  NotFound: 404,
  Forbidden: 403,
  NotAcceptable: 406,
  ExpectationFailed: 417,
  Locked: 423,
  InternalServerError: 500,
  UnprocessableEntity: 422,
  ResourceExist: 409,
  TooManyRequest: 429
}

const notifications = {
}

const notificationsHeadings = {
}

module.exports = {
  messages,
  status,
  jsonStatus,
  notifications,
  notificationsHeadings
}
