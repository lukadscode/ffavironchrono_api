const Joi = require("joi");

exports.listSchema = Joi.object({
  search: Joi.string().optional(),
  role: Joi.string().valid("user", "commission", "admin", "superadmin").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

exports.createSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  num_license: Joi.string().optional(),
  role: Joi.string().valid("user", "commission", "admin", "superadmin").optional(),
});

exports.updateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  num_license: Joi.string().optional(),
  avatar: Joi.string().optional(),
  status: Joi.string().valid("active", "inactive").optional(),
  role: Joi.string().valid("user", "commission", "admin", "superadmin").optional(),
});

exports.assignClubSchema = Joi.object({
  user_id: Joi.string().required(),
  club_id: Joi.string().required(),
  role: Joi.string().valid("member", "coach", "admin").optional(),
});

