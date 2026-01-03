const Joi = require("joi");

exports.createSchema = Joi.object({
  event_id: Joi.string().required(),
  label: Joi.string().required(),
  order_index: Joi.number().integer().required(),
  distance_m: Joi.number().integer().required(),
});

exports.updateSchema = Joi.object({
  label: Joi.string().optional(),
  order_index: Joi.number().integer().optional(),
});

exports.resolveTokenSchema = Joi.object({
  token: Joi.string().required(),
  device_id: Joi.string().required(),
});