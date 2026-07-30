const multer = require("multer");
const path = require("path");

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

const SPREADSHEET_MIMES = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

const SPREADSHEET_EXTENSIONS = new Set([".csv", ".xls", ".xlsx", ".txt"]);

function createUploadMiddleware({
  fieldName = "file",
  maxBytes = DEFAULT_MAX_BYTES,
  allowedMimes = SPREADSHEET_MIMES,
  allowedExtensions = SPREADSHEET_EXTENSIONS,
} = {}) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const mimeOk = allowedMimes.has(file.mimetype);
      const extOk = allowedExtensions.has(ext);

      if (!mimeOk && !extOk) {
        return cb(new Error("Type de fichier non autorisé"), false);
      }
      return cb(null, true);
    },
  });

  return upload.single(fieldName);
}

module.exports = { createUploadMiddleware, SPREADSHEET_MIMES, SPREADSHEET_EXTENSIONS };
