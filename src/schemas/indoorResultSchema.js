const Joi = require("joi");

// Schéma pour l'import des résultats ErgRace
exports.importSchema = Joi.object({
  results: Joi.object({
    race_id: Joi.string()
      .required()
      .description("ID de la course dans ErgRace (UUID)"),
    c2_race_id: Joi.string()
      .uuid()
      .optional()
      .description("ID de la course dans notre plateforme"),
    ergrace_version: Joi.string().optional(),
    race_start_time: Joi.string().optional(),
    race_end_time: Joi.string().optional(),
    duration: Joi.number().integer().optional(),
    time_cap: Joi.number().integer().optional(),
    race_file_name: Joi.string().optional(),
    participants: Joi.array()
      .items(
        Joi.object({
          id: Joi.string()
            .required()
            .description("ID du participant (UUID ou 'Lane X')"),
          place: Joi.number().integer().optional(),
          time: Joi.string().optional(),
          score: Joi.string().optional(),
          distance: Joi.number().integer().optional(),
          avg_pace: Joi.string().optional(),
          spm: Joi.number().integer().optional(),
          calories: Joi.number().integer().optional(),
          serial_number: Joi.number().optional(),
          machine_type: Joi.string().optional(),
          logged_time: Joi.string().optional(),
          splits: Joi.array().optional(),
        }).unknown(true) // Permettre d'autres champs du format ErgRace
      )
      .optional(),
  })
    .unknown(true) // Permettre d'autres champs du format ErgRace
    .required(),
});

// Schéma pour la création / mise à jour d'un résultat indoor manuel
exports.manualResultSchema = Joi.object({
  race_id: Joi.string()
    .uuid()
    .optional()
    .description("ID de la course (obligatoire si non présent dans l'URL)"),
  crew_id: Joi.string()
    .uuid()
    .required()
    .description("ID de l'équipage FFA"),
  lane: Joi.number().integer().optional(),
  time_display: Joi.string()
    .required()
    .description("Temps formaté, ex: '7:21.1'"),
  time_ms: Joi.number()
    .integer()
    .min(1)
    .required()
    .description("Temps en millisecondes, > 0"),
  distance: Joi.number()
    .integer()
    .min(1)
    .required()
    .description("Distance parcourue en mètres, > 0"),
  avg_pace: Joi.string().optional(),
  spm: Joi.number().integer().optional(),
  calories: Joi.number().integer().optional(),
  machine_type: Joi.string().optional(),
  logged_time: Joi.string().isoDate().optional(),
  splits_data: Joi.array().optional(),
});

