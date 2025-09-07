const Joi = require("joi");

exports.createSchema = Joi.object({
  code: Joi.string().optional(),
  label: Joi.string().required(),
  age_group: Joi.string().optional(),
  gender: Joi.string().valid("Homme", "Femme", "Mixte").optional(),
  boat_seats: Joi.number().integer().min(1).max(8).optional(),
  has_coxswain: Joi.boolean().optional(),
});

exports.updateSchema = Joi.object({
  code: Joi.string().optional(),
  label: Joi.string().optional(),
  age_group: Joi.string().optional(),
  gender: Joi.string().valid("Homme", "Femme", "Mixte").optional(),
  boat_seats: Joi.number().integer().min(1).max(8).optional(),
  has_coxswain: Joi.boolean().optional(),
});
