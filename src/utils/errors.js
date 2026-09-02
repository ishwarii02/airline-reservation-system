class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

class SeatUnavailableError extends AppError {
  constructor(message = 'One or more requested seats are no longer available') {
    super(message, 409); // 409 Conflict: correct code for a lost race on a shared resource
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class PaymentFailedError extends AppError {
  constructor(message = 'Payment failed') {
    super(message, 402);
  }
}

module.exports = { AppError, SeatUnavailableError, NotFoundError, PaymentFailedError };
