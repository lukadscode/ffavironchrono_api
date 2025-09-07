const Joi = require("joi");

exports.createSchema = Joi.object({
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  license_number: Joi.string().required(),
  gender: Joi.string().valid("Homme", "Femme").required(),
  email: Joi.string().email().optional(),
  club_name: Joi.string().optional(),
});

exports.updateSchema = Joi.object({
  first_name: Joi.string().optional(),
  last_name: Joi.string().optional(),
  license_number: Joi.string().optional(),
  gender: Joi.string().valid("Homme", "Femme").optional(),
  email: Joi.string().email().optional(),
  club_name: Joi.string().optional(),
});
