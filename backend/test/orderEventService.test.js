const test = require('node:test');
const assert = require('node:assert/strict');
const { broadcastOrderUpdate, registerOrderListener } = require('../src/services/orderEventService');

test('order event listeners receive updates and can unsubscribe', () => {
  const received = [];
  const unsubscribe = registerOrderListener('order-test', (payload) => received.push(payload));

  broadcastOrderUpdate('order-test', { status: 'processing' });
  unsubscribe();
  broadcastOrderUpdate('order-test', { status: 'completed' });

  assert.deepEqual(received, [{ status: 'processing' }]);
});
