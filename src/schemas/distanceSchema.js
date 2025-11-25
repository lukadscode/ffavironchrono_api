const Joi = require("joi");

exports.createSchema = Joi.object({
  event_id: Joi.string().required(),
  meters: Joi.number().integer().min(100).required(),
  is_relay: Joi.boolean().default(false),
  relay_count: Joi.number()
    .integer()
    .min(2)
    .max(20)
    .when("is_relay", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.allow(null),
    }),
});
