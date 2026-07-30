const apiResponse = require("../utils/apiResponse");

function normalizeError(err) {
  if (err?.name === "SequelizeValidationError") {
    return { status: 400, message: err.errors?.[0]?.message || "Données invalides" };
  }
  if (err?.name === "SequelizeUniqueConstraintError") {
    return { status: 409, message: "Conflit : valeur déjà utilisée" };
  }
  if (err?.name === "SequelizeForeignKeyConstraintError") {
    return { status: 400, message: "Référence invalide" };
  }
  if (err?.message === "CORS blocked" || err?.message?.includes("CORS")) {
    return { status: 403, message: "CORS blocked" };
  }
  if (err?.message?.includes("Type de fichier non autorisé")) {
    return { status: 415, message: err.message };
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return { status: 413, message: "Fichier trop volumineux" };
  }

  const status = err?.statusCode || err?.status || 500;
  const message =
    status === 500 && process.env.NODE_ENV === "production"
      ? "Erreur serveur"
      : err?.message || "Erreur";
  return { status, message };
}

module.exports = function errorHandler(err, req, res, next) {
  const { status, message } = normalizeError(err);

  req.log?.error(
    {
      err,
      request_id: req.id,
      status,
    },
    "Unhandled error"
  );

  return apiResponse.error(res, message, status, {
    request_id: apiResponse.getRequestId(req),
  });
};
