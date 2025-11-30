const Joi = require("joi");
const { VALID_STATUSES } = require("../constants/crewStatus");

exports.createSchema = Joi.object({
  event_id: Joi.string().required(),
  category_id: Joi.string().required(),
  status: Joi.string()
    .valid(...VALID_STATUSES)
    .optional(),
  club_name: Joi.string().optional(),
  club_code: Joi.string().optional(),
  coach_name: Joi.string().optional(),
});

exports.updateSchema = Joi.object({
  event_id: Joi.string().optional(),
  category_id: Joi.string().optional(),
  status: Joi.string()
    .valid(...VALID_STATUSES)
    .optional(),
  club_name: Joi.string().optional(),
  club_code: Joi.string().optional(),
  coach_name: Joi.string().optional(),
});
