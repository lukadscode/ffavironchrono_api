const { v4: uuidv4 } = require("uuid");
const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");
const apiResponse = require("../utils/apiResponse");

async function writeAuditLog({
  userId = null,
  action,
  entityType = null,
  entityId = null,
  eventId = null,
  metadata = null,
  req = null,
}) {
  try {
    await AuditLog.create({
      id: uuidv4(),
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      event_id: eventId,
      metadata,
      ip_address: req?.ip || null,
      request_id: apiResponse.getRequestId(req),
    });
  } catch (err) {
    logger.warn({ err, action, entityType, entityId }, "Audit log write failed");
  }
}

module.exports = { writeAuditLog };
