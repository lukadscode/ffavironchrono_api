const Joi = require("joi");

exports.createSchema = Joi.object({
  event_id: Joi.string().required(),
  category_id: Joi.string().required(),
  status: Joi.number().optional(),
  club_name: Joi.string().optional(),
  club_code: Joi.string().optional(),
  coach_name: Joi.string().optional(),
});

exports.updateSchema = Joi.object({
  event_id: Joi.string().optional(),
  category_id: Joi.string().optional(),
  status: Joi.number().optional(),
  club_name: Joi.string().optional(),
  club_code: Joi.string().optional(),
  coach_name: Joi.string().optional(),
});
