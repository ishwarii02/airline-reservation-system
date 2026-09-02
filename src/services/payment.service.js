const crypto = require('crypto');

/**
 * Simulates calling an external payment gateway.
 *
 * `forceOutcome` lets callers (tests, demos) pin the result to
 * 'SUCCESS' or 'FAILED' deterministically. Without it, the gateway
 * succeeds ~90% of the time, which is enough to exercise the
 * failure/rollback path without a real integration.
 */
async function charge({ amount, method = 'SIMULATED_CARD', forceOutcome }) {
  // Simulate network latency of a real gateway call.
  await new Promise((resolve) => setTimeout(resolve, 50));

  const outcome = forceOutcome || (Math.random() < 0.9 ? 'SUCCESS' : 'FAILED');
  const transactionRef = `TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  return {
    status: outcome,
    amount,
    method,
    transactionRef,
  };
}

module.exports = { charge };
