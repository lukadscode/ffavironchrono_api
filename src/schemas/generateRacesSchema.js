const Joi = require("joi");

exports.generateInitialRacesSchema = Joi.object({
  phase_id: Joi.string().required(),
  lane_count: Joi.number().integer().min(1).required(),
  start_time: Joi.date().iso().optional(),
  interval_minutes: Joi.number()
    .min(0)
    .optional()
    .description(
      "Minutes (flottant) entre chaque course. Utilisé uniquement si interval_seconds n'est pas fourni."
    ),
  interval_seconds: Joi.number()
    .integer()
    .min(1)
    .optional()
    .description(
      "Intervalle en secondes entre deux courses. Prioritaire sur interval_minutes si présent."
    ),
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
  interval_minutes: Joi.number()
    .min(0)
    .optional()
    .description(
      "Minutes (flottant) entre chaque course. Utilisé uniquement si interval_seconds n'est pas fourni."
    ),
  interval_seconds: Joi.number()
    .integer()
    .min(1)
    .optional()
    .description(
      "Intervalle en secondes entre deux courses. Prioritaire sur interval_minutes si présent."
    ),
  series: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        categories: Joi.object()
          .pattern(Joi.string(), Joi.number().integer().min(1))
          .required()
          .description(
            "Objet avec les codes de catégories comme clés et le nombre d'équipages comme valeurs"
          ),
      })
    )
    .min(1)
    .required()
    .description("Tableau des séries à générer"),
  save_only: Joi.boolean()
    .optional()
    .default(false)
    .description(
      "Si true, enregistre uniquement le schéma sans générer les courses (mode brouillon)"
    ),
});

// Parcours contre la montre : une course (ou créneau) par équipage, départs espacés
exports.generateTimeTrialRacesSchema = Joi.object({
  phase_id: Joi.string().required(),
  start_time: Joi.date()
    .iso()
    .required()
    .description("Heure de départ de la première course (ISO 8601)"),
  interval_seconds: Joi.number()
    .integer()
    .min(1)
    .required()
    .description("Intervalle en secondes entre deux départs"),
  categories: Joi.array()
    .items(
      Joi.object({
        category_id: Joi.string()
          .required()
          .description("ID de la catégorie"),
        order: Joi.number()
          .integer()
          .min(1)
          .required()
          .description(
            "Ordre de passage de la catégorie (1 = en premier, 2 = ensuite, etc.)"
          ),
      })
    )
    .min(1)
    .required()
    .description(
      "Liste ordonnée des catégories pour lesquelles générer les départs contre la montre"
    ),
});

exports.updateGenerationSchemaSchema = Joi.object({
  generation_schema: Joi.object({
    lane_count: Joi.number().integer().min(1).required(),
    start_time: Joi.date().iso().allow(null).optional(),
    interval_minutes: Joi.number().min(0).optional(),
    interval_seconds: Joi.number().integer().min(1).optional(),
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
    generated_at: Joi.string().isoDate().optional(),
    updated_at: Joi.string().isoDate().optional(),
  })
    .unknown(true) // Permettre d'autres champs comme generated_at, updated_at
    .required(),
});

