const Joi = require("joi");

exports.eventCreateSchema = Joi.object({
  name: Joi.string().required(),
  location: Joi.string().required(),
  start_date: Joi.date().required(),
  end_date: Joi.date().required(),
  race_type: Joi.string().optional(),
  website_url: Joi.string().uri().optional(),
  image_url: Joi.string().uri().optional(),
  organiser_name: Joi.string().optional(),
  organiser_code: Joi.string().optional(),
  is_visible: Joi.boolean().optional(),
  is_finished: Joi.boolean().optional(),
  progression_template_id: Joi.string().optional(),
});

exports.eventUpdateSchema = Joi.object({
  name: Joi.string().optional(),
  location: Joi.string().optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  race_type: Joi.string().optional(),
  website_url: Joi.string().uri().optional(),
  image_url: Joi.string().uri().optional(),
  organiser_name: Joi.string().optional(),
  organiser_code: Joi.string().optional(),
  is_visible: Joi.boolean().optional(),
  is_finished: Joi.boolean().optional(),
  progression_template_id: Joi.string().optional(),
});
