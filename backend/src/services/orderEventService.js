const listenersByOrder = new Map();

function broadcastOrderUpdate(orderId, payload) {
  const listeners = listenersByOrder.get(orderId) || [];
  listeners.forEach((listener) => listener(payload));
}

function registerOrderListener(orderId, listener) {
  const listeners = listenersByOrder.get(orderId) || [];
  listeners.push(listener);
  listenersByOrder.set(orderId, listeners);
  return () => {
    const remaining = (listenersByOrder.get(orderId) || []).filter((item) => item !== listener);
    if (remaining.length) listenersByOrder.set(orderId, remaining);
    else listenersByOrder.delete(orderId);
  };
}

module.exports = { broadcastOrderUpdate, registerOrderListener };
