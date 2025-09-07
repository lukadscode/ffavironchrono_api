const Joi = require("joi");

exports.createSchema = Joi.object({
  phase_id: Joi.string().required(),
  name: Joi.string().optional(),
  race_type: Joi.string().optional(),
  lane_count: Joi.number().integer().min(1).optional(),
  race_number: Joi.number().integer().optional(),
  distance_id: Joi.string().optional(),
  status: Joi.string()
    .valid(
      "not_started",
      "non_official",
      "official",
      "in_progress",
      "delayed",
      "cancelled",
      "finished"
    )
    .optional(),
  start_time: Joi.date().iso().optional(),
});

exports.updateSchema = Joi.object({
  phase_id: Joi.string().optional(),
  name: Joi.string().optional(),
  race_type: Joi.string().optional(),
  lane_count: Joi.number().integer().min(1).optional(),
  race_number: Joi.number().integer().optional(),
  distance_id: Joi.string().optional(),
  status: Joi.string()
    .valid(
      "not_started",
      "non_official",
      "official",
      "in_progress",
      "delayed",
      "cancelled",
      "finished"
    )
    .optional(),
  start_time: Joi.date().iso().optional(),
});
