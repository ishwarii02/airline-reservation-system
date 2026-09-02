const express = require('express');
const controller = require('../controllers/analytics.controller');

const router = express.Router();

router.get('/occupancy', controller.occupancy);
router.get('/revenue', controller.revenue);
router.post('/release-expired-locks', controller.releaseExpiredLocks);

module.exports = router;
