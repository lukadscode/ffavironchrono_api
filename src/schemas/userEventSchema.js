const Joi = require("joi");

exports.addUserToEventSchema = Joi.object({
  email: Joi.string().email().required(),
  event_id: Joi.string().required(),
  role: Joi.string()
    .valid("viewer", "editor", "referee", "timing", "organiser")
    .required(),
  name: Joi.string().optional(),
});


