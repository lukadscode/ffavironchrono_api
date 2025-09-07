const Joi = require("joi");

exports.createSchema = Joi.object({
  race_id: Joi.string().required(),
  crew_id: Joi.string().required(),
  lane: Joi.number().integer().min(1).optional(),
  status: Joi.string().optional(),
});
