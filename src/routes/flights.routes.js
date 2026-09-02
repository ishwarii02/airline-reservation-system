const express = require('express');
const controller = require('../controllers/flights.controller');

const router = express.Router();

router.get('/', controller.search);
router.get('/:id/seats', controller.seatAvailability);

module.exports = router;
