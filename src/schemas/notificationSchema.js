const Joi = require("joi");

exports.createSchema = Joi.object({
  event_id: Joi.string().allow(null).optional(),
  race_id: Joi.string().allow(null).optional(),
  message: Joi.string().required().min(1).max(1000),
  importance: Joi.string()
    .valid("info", "warning", "error", "success")
    .default("info")
    .optional(),
  is_active: Joi.boolean().default(true).optional(),
  start_date: Joi.date().iso().allow(null).optional(),
  end_date: Joi.date().iso().allow(null).optional(),
}).custom((value, helpers) => {
  // Au moins event_id ou race_id doit être fourni
  if (!value.event_id && !value.race_id) {
    return helpers.error("any.custom", {
      message: "event_id ou race_id est requis",
    });
  }
  return value;
});

exports.updateSchema = Joi.object({
  message: Joi.string().min(1).max(1000).optional(),
  importance: Joi.string()
    .valid("info", "warning", "error", "success")
    .optional(),
  is_active: Joi.boolean().optional(),
  start_date: Joi.date().iso().allow(null).optional(),
  end_date: Joi.date().iso().allow(null).optional(),
});

