const Joi = require("joi");

exports.createSchema = Joi.object({
  crew_id: Joi.string().required(),
  participant_id: Joi.string().required(),
  is_coxswain: Joi.boolean().optional(),
  coxswain_weight: Joi.number().min(20).max(100).optional(),
  seat_position: Joi.number().integer().min(1).optional(),
});
