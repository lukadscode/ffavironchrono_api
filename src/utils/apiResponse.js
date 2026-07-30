function getRequestId(req) {
  return req?.id || req?.headers?.["x-request-id"] || null;
}

function success(res, data, statusCode = 200) {
  const body = { status: "success", data };
  const requestId = getRequestId(res.req);
  if (requestId) body.request_id = requestId;
  return res.status(statusCode).json(body);
}

function message(res, message, statusCode = 200) {
  const body = { status: "success", message };
  const requestId = getRequestId(res.req);
  if (requestId) body.request_id = requestId;
  return res.status(statusCode).json(body);
}

function error(res, message, statusCode = 400, extra = {}) {
  const body = { status: "error", message, ...extra };
  const requestId = getRequestId(res.req);
  if (requestId) body.request_id = requestId;
  return res.status(statusCode).json(body);
}

function notFound(res, message = "Non trouvé") {
  return error(res, message, 404);
}

function forbidden(res, message = "Accès interdit") {
  return error(res, message, 403);
}

function unauthorized(res, message = "Non autorisé") {
  return error(res, message, 401);
}

function conflict(res, message = "Conflit") {
  return error(res, message, 409);
}

function locked(res, message = "Ressource verrouillée") {
  return error(res, message, 423);
}

function serverError(res, message = "Erreur serveur") {
  return error(res, message, 500);
}

module.exports = {
  success,
  message,
  error,
  notFound,
  forbidden,
  unauthorized,
  conflict,
  locked,
  serverError,
  getRequestId,
};
