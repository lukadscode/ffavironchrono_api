const Joi = require("joi");

exports.generateInitialRacesSchema = Joi.object({
  phase_id: Joi.string().required(),
  lane_count: Joi.number().integer().min(1).required(),
  start_time: Joi.date().iso().optional(),
  interval_minutes: Joi.number().integer().min(0).optional(),
  category_order: Joi.array()
    .items(Joi.string())
    .optional()
    .description(
      "Ordre personnalisé des catégories (tableau de codes). Les catégories non listées seront ajoutées à la fin."
    ),
});


