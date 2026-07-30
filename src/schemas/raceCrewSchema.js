const Joi = require("joi");

exports.createSchema = Joi.object({
  race_id: Joi.string().required(),
  crew_id: Joi.string().required(),
  lane: Joi.number().integer().min(1).optional(),
  status: Joi.string().optional(),
});

exports.adjustmentSchema = Joi.object({
  adjustment_ms: Joi.number().integer().required(),
  adjustment_reason: Joi.string().max(255).allow("", null).optional(),
});

exports.statusSchema = Joi.object({
  status: Joi.string()
    .valid("registered", "dns", "dnf", "disqualified", "changed", "withdrawn")
    .required(),
});
