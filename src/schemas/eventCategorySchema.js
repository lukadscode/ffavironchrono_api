const Joi = require("joi");

exports.linkSchema = Joi.object({
  event_id: Joi.string().required(),
  category_id: Joi.string().required(),
});
