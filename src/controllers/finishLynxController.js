const {
  buildFinishLynxPreview,
  importFinishLynxToRace,
} = require("../services/finishLynxImportService");
const { writeAuditLog } = require("../services/auditLogService");
const Race = require("../models/Race");
const RacePhase = require("../models/RacePhase");

async function getEventIdFromRace(raceId) {
  const race = await Race.findByPk(raceId, {
    include: [{ model: RacePhase, as: "race_phase" }],
  });
  return race?.race_phase?.event_id || null;
}

function readLifFile(req, res) {
  if (!req.file?.buffer) {
    res.status(400).json({
      status: "error",
      message: "Fichier .lif requis",
    });
    return null;
  }
  return req.file.buffer.toString("utf8");
}

exports.previewFinishLynx = async (req, res) => {
  try {
    const content = readLifFile(req, res);
    if (content == null) return;

    const preview = await buildFinishLynxPreview(req.params.id, content);
    res.json({ status: "success", data: preview });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};

exports.importFinishLynx = async (req, res) => {
  try {
    const content = readLifFile(req, res);
    if (content == null) return;

    const replaceExisting =
      req.body?.replace_existing === true ||
      req.body?.replace_existing === "true";

    const eventId = await getEventIdFromRace(req.params.id);
    const io = req.app.get("io");

    const result = await importFinishLynxToRace(req.params.id, content, {
      userId: req.user?.userId,
      replaceExisting,
      io,
    });

    await writeAuditLog({
      userId: req.user?.userId,
      action: "import_finishlynx",
      entityType: "race",
      entityId: req.params.id,
      eventId,
      metadata: {
        imported: result.imported,
        replace_existing: replaceExisting,
        summary: result,
      },
      req,
    });

    res.json({ status: "success", data: result });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ status: "error", message: err.message });
  }
};
