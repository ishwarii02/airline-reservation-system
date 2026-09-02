const express = require('express');
const controller = require('../controllers/bookings.controller');

const router = express.Router();

router.post('/lock', controller.lockSeats);
router.post('/:id/confirm', controller.confirm);
router.post('/:id/cancel', controller.cancel);
router.get('/:id', controller.getOne);

module.exports = router;
