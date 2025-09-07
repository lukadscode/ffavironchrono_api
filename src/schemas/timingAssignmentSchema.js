const Joi = require("joi");

exports.assignSchema = Joi.object({
  timing_id: Joi.string().required(),
  crew_id: Joi.string().required(),
});
