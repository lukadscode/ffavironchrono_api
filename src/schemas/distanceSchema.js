const Joi = require("joi");

exports.createSchema = Joi.object({
  event_id: Joi.string().required(),
  meters: Joi.number().integer().min(100).required(),
});
