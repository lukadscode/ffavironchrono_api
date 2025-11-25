const Joi = require("joi");

exports.recalculateRanksSchema = Joi.object({
  ranking_type: Joi.string()
    .valid("indoor_points", "defis_capitaux", "custom")
    .optional()
    .default("indoor_points"),
});

exports.createScoringTemplateSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string()
    .valid("indoor_points", "defis_capitaux", "custom")
    .required(),
  config: Joi.object().required(),
  is_default: Joi.boolean().optional().default(false),
});



