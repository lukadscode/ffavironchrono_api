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
  save_only: Joi.boolean().optional().default(false)
    .description("Si true, enregistre uniquement le schéma sans générer les courses (mode brouillon)"),
});

exports.updateGenerationSchemaSchema = Joi.object({
  generation_schema: Joi.object({
    lane_count: Joi.number().integer().min(1).required(),
    start_time: Joi.date().iso().allow(null).optional(),
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
            .required(),
        })
      )
      .min(1)
      .required(),
    generated_at: Joi.string().iso().optional(),
    updated_at: Joi.string().iso().optional(),
  })
    .unknown(true) // Permettre d'autres champs comme generated_at, updated_at
    .required(),
});

