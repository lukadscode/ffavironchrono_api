const Joi = require("joi");

exports.createSchema = Joi.object({
  event_id: Joi.string().required(),
  name: Joi.string().required(),
  order_index: Joi.number().integer().required(),
});

exports.updateSchema = Joi.object({
  name: Joi.string().optional(),
  order_index: Joi.number().integer().optional(),
});
