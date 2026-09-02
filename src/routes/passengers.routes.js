const express = require('express');
const controller = require('../controllers/passengers.controller');

const router = express.Router();

router.post('/', controller.create);
router.get('/:id/bookings', controller.bookingHistory);

module.exports = router;
