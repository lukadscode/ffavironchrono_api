const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const ensureActiveUser = require("../middlewares/ensureActiveUser");
const validate = require("../middlewares/validateSchema");
const authSchema = require("../schemas/authSchema");
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_LOGIN_PER_15M || 30),
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_RESET_PER_15M || 10),
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.post(
  "/register",
  validate(authSchema.registerSchema),
  authController.register
);
router.post("/login", loginLimiter, validate(authSchema.loginSchema), authController.login);
router.post(
  "/refresh-token",
  validate(authSchema.refreshTokenSchema),
  authController.refreshToken
);
router.post(
  "/logout",
  authMiddleware,
  validate(authSchema.logoutSchema),
  authController.logout
);
router.post(
  "/request-password-reset",
  resetLimiter,
  validate(authSchema.passwordResetRequestSchema),
  authController.requestPasswordReset
);
router.post(
  "/reset-password",
  resetLimiter,
  validate(authSchema.passwordResetSchema),
  authController.resetPassword
);
router.post(
  "/change-password",
  authMiddleware,
  validate(authSchema.changePasswordSchema),
  authController.changePassword
);

// Non-body params
router.get("/verify-email", authController.verifyEmail);
router.get("/me", authMiddleware, ensureActiveUser, authController.getProfile);
router.get("/sessions", authMiddleware, authController.getSessions);
router.delete("/sessions/:id", authMiddleware, authController.deleteSession);

module.exports = router;
