const Joi = require("joi");

exports.registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  num_license: Joi.string().optional(),
});

exports.loginSchema = Joi.object({
  identifier: Joi.string().required(),
  password: Joi.string().required(),
});

exports.refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required(),
});

exports.passwordResetRequestSchema = Joi.object({
  identifier: Joi.string().required(),
});

exports.passwordResetSchema = Joi.object({
  token: Joi.string().required(),
  new_password: Joi.string().min(6).required(),
});

exports.changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

exports.logoutSchema = Joi.object({
  refresh_token: Joi.string().required(),
});
