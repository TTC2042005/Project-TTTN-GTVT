const { AdminAuditLog } = require('../models');

async function recordAdminAction(req, action, entityType, entityId, details = {}, transaction) {
  return AdminAuditLog.create({
    actorId: req.user.id,
    action,
    entityType,
    entityId: entityId || null,
    details,
  }, transaction ? { transaction } : undefined);
}

module.exports = { recordAdminAction };
