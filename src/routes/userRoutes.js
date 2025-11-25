const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");
const requireAdmin = require("../middlewares/requireAdmin");
const validate = require("../middlewares/validateSchema");
const userSchema = require("../schemas/userSchema");

// GET /users - Liste des utilisateurs (admin uniquement)
router.get(
  "/",
  authMiddleware,
  requireAdmin,
  validate(userSchema.listSchema, "query"),
  userController.getUsers
);

// POST /users - Créer un utilisateur (admin uniquement)
router.post(
  "/",
  authMiddleware,
  requireAdmin,
  validate(userSchema.createSchema),
  userController.createUser
);

// POST /users/assign-club - Associer un utilisateur à un club (admin uniquement)
// Doit être avant /:id pour éviter les conflits
router.post(
  "/assign-club",
  authMiddleware,
  requireAdmin,
  validate(userSchema.assignClubSchema),
  userController.assignClub
);

// GET /users/me/session-summary - Résumé des sessions pour l'utilisateur connecté
// Doit être avant /:id pour éviter les conflits
router.get(
  "/me/session-summary",
  authMiddleware,
  userController.getMySessionSummary
);

// GET /users/{id}/session-summary - Résumé des sessions (admin uniquement)
// Doit être avant /:identifier pour éviter les conflits
router.get(
  "/:id/session-summary",
  authMiddleware,
  requireAdmin,
  userController.getUserSessionSummary
);

// GET /users/{userId}/sessions - Liste des sessions (admin uniquement)
// Doit être avant /:identifier pour éviter les conflits
router.get(
  "/:userId/sessions",
  authMiddleware,
  requireAdmin,
  userController.getUserSessions
);

// PATCH /users/{id} - Modifier un utilisateur (admin uniquement)
router.patch(
  "/:id",
  authMiddleware,
  requireAdmin,
  validate(userSchema.updateSchema),
  userController.updateUser
);

// DELETE /users/{id} - Désactiver un utilisateur (admin uniquement)
router.delete(
  "/:id",
  authMiddleware,
  requireAdmin,
  userController.deleteUser
);

// GET /users/{identifier} - Détail d'un utilisateur (admin uniquement)
// Doit être EN DERNIER car il capture tout ce qui n'a pas été matché avant
router.get(
  "/:identifier",
  authMiddleware,
  requireAdmin,
  userController.getUserByIdentifier
);

module.exports = router;

