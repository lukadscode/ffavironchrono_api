const Joi = require("joi");

exports.createSchema = Joi.object({
  event_id: Joi.string().required(),
  meters: Joi.number()
    .integer()
    .min(100)
    .when("is_time_based", {
      is: true,
      then: Joi.allow(null),
      otherwise: Joi.required(),
    }),
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
  is_time_based: Joi.boolean().default(false),
  duration_seconds: Joi.number()
    .integer()
    .min(1)
    .when("is_time_based", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.allow(null),
    }),
}).or("meters", "duration_seconds"); // Au moins un des deux doit être présent
