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

exports.generateRacesFromSeriesSchema = Joi.object({
  phase_id: Joi.string().required(),
  lane_count: Joi.number().integer().min(1).required(),
  start_time: Joi.date().iso().optional(),
  interval_minutes: Joi.number().integer().min(0).optional(),
  series: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        categories: Joi.object()
          .pattern(
            Joi.string(),
            Joi.number().integer().min(1)
          )
          .required()
          .description(
            "Objet avec les codes de catégories comme clés et le nombre d'équipages comme valeurs"
          ),
      })
    )
    .min(1)
    .required()
    .description("Tableau des séries à générer"),
});


