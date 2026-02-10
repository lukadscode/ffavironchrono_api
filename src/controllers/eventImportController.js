const { v4: uuidv4 } = require("uuid");
const XLSX = require("xlsx");
const { Op } = require("sequelize");
const Event = require("../models/Event");
const Category = require("../models/Category");
const EventCategory = require("../models/EventCategory");
const Crew = require("../models/Crew");
const Participant = require("../models/Participant");
const CrewParticipant = require("../models/CrewParticipant");
const Club = require("../models/Club");
const CREW_STATUS = require("../constants/crewStatus");

function normalizeString(value) {
  if (!value) return null;
  return String(value).trim();
}

function parseBoolean(value) {
  if (value === null || value === undefined) return false;
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "oui" || v === "yes" || v === "y";
}

function parseSeatPosition(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

function parseTempsPronostique(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Math.round(value);
  }

  const str = String(value).trim();

  // Format MM:SS ou HH:MM:SS
  const parts = str.split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseFloat(parts[1]);
    if (!Number.isNaN(m) && !Number.isNaN(s)) {
      return Math.round(m * 60 + s);
    }
  }
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseFloat(parts[2]);
    if (!Number.isNaN(h) && !Number.isNaN(m) && !Number.isNaN(s)) {
      return Math.round(h * 3600 + m * 60 + s);
    }
  }

  // Tentative dernière chance : nombre brut
  const asNumber = Number(str.replace(",", "."));
  if (!Number.isNaN(asNumber)) return Math.round(asNumber);

  return null;
}

function getSheetRowsFromBuffer(buffer, originalName) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  let sheetName = "Participants";
  if (!workbook.Sheets[sheetName]) {
    // Fallback sur la première feuille (utile pour CSV ou fichiers simples)
    sheetName = workbook.SheetNames[0];
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(
      "Feuille 'Participants' introuvable dans le fichier (et aucune feuille par défaut)"
    );
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  return rows;
}

async function resolveClub({ club_code, club_name }) {
  const result = { club_code: null, club_name: null, error: null };

  const code = normalizeString(club_code);
  const name = normalizeString(club_name);

  result.club_name = name || null;

  if (code) {
    const club = await Club.findOne({ where: { code: code } });
    if (!club) {
      result.error = `Club code "${code}" introuvable`;
      return result;
    }
    result.club_code = code;
    if (!name) {
      result.club_name = club.nom || club.nom_court || null;
    }
  } else if (name) {
    // On ne crée pas de club, on stocke juste le nom
    result.club_code = null;
  } else {
    result.error = "club_name manquant";
  }

  return result;
}

async function resolveCategoryForEvent(event_id, category_code) {
  const code = normalizeString(category_code);
  if (!code) {
    return { category: null, error: "category_code manquant" };
  }

  const category = await Category.findOne({
    where: { code: { [Op.eq]: code } },
  });
  if (!category) {
    return { category: null, error: `Catégorie "${code}" introuvable` };
  }

  const ec = await EventCategory.findOne({
    where: { event_id, category_id: category.id },
  });
  if (!ec) {
    return {
      category: null,
      error: `La catégorie "${code}" n'est pas liée à cet événement`,
    };
  }

  return { category, error: null };
}

async function resolveParticipant(row, event_id) {
  const first_name = normalizeString(row["participant_first_name"]);
  const last_name = normalizeString(row["participant_last_name"]);
  const license_number = normalizeString(row["participant_license_number"]);
  const gender = normalizeString(row["participant_gender"]);
  const email = normalizeString(row["participant_email"]);
  const participant_club_name =
    normalizeString(row["participant_club_name"]) ||
    normalizeString(row["club_name"]) ||
    null;

  if (!first_name || !last_name) {
    return { participant: null, created: false, error: "Prénom/nom manquant" };
  }

  // 1) Par numéro de licence
  if (license_number) {
    const [participant, created] = await Participant.findOrCreate({
      where: { license_number },
      defaults: {
        id: uuidv4(),
        first_name,
        last_name,
        license_number,
        gender: gender || "Homme",
        email: email || null,
        club_name: participant_club_name,
      },
    });
    return { participant, created, error: null };
  }

  // 2) Optionnel : par nom/prénom/club
  const existing = await Participant.findOne({
    where: {
      first_name,
      last_name,
      ...(participant_club_name ? { club_name: participant_club_name } : {}),
    },
  });
  if (existing) {
    return { participant: existing, created: false, error: null };
  }

  // 3) Création sans licence
  const tempLicense = `TEMP_${last_name}_${first_name}_${(
    participant_club_name || "UNKNOWN"
  )
    .replace(/\s+/g, "_")
    .toUpperCase()}`;

  const [participant, created] = await Participant.findOrCreate({
    where: { license_number: tempLicense },
    defaults: {
      id: uuidv4(),
      first_name,
      last_name,
      license_number: tempLicense,
      gender: gender || "Homme",
      email: email || null,
      club_name: participant_club_name,
    },
  });

  return { participant, created, error: null };
}

/**
 * POST /events/:event_id/import-participants
 *
 * Import CSV/Excel : 1 ligne = 1 participant dans un équipage
 */
exports.importParticipantsFromFile = async (req, res) => {
  try {
    const { event_id } = req.params;
    const mode = req.body.mode === "update_or_create" ? "update_or_create" : "create_only";
    const dryRun = String(req.body.dry_run || "")
      .toLowerCase()
      .trim() === "true";

    if (!event_id) {
      return res.status(400).json({
        status: "error",
        message: "event_id manquant dans l'URL",
      });
    }

    // Vérifier que l'événement existe
    const event = await Event.findByPk(event_id);
    if (!event) {
      return res.status(404).json({
        status: "error",
        message: "Événement introuvable",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Aucun fichier fourni (champ 'file')",
      });
    }

    let rows;
    try {
      rows = getSheetRowsFromBuffer(req.file.buffer, req.file.originalname);
    } catch (e) {
      return res.status(400).json({
        status: "error",
        message: `Erreur de lecture du fichier: ${e.message}`,
      });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Le fichier ne contient aucune ligne exploitable",
      });
    }

    const errors = [];
    const groups = new Map();

    // Pré-validation et grouping par équipage
    rows.forEach((row, index) => {
      const rowNumber = index + 2; // 1 pour header + 1 pour index 0

      const crew_external_id = normalizeString(row["crew_external_id"]);
      const category_code = normalizeString(row["category_code"]);
      const club_name = normalizeString(row["club_name"]);
      const club_code = normalizeString(row["club_code"]);
      const seat_position = parseSeatPosition(row["seat_position"]);
      const is_coxswain = parseBoolean(row["is_coxswain"]);
      const participant_first_name = normalizeString(
        row["participant_first_name"]
      );
      const participant_last_name = normalizeString(
        row["participant_last_name"]
      );

      if (!crew_external_id) {
        errors.push({
          row: rowNumber,
          message: "champ 'crew_external_id' manquant",
        });
        return;
      }
      if (!category_code) {
        errors.push({
          row: rowNumber,
          message: "champ 'category_code' manquant",
        });
        return;
      }
      if (!club_name && !club_code) {
        errors.push({
          row: rowNumber,
          message: "champ 'club_name' ou 'club_code' requis",
        });
        return;
      }
      if (!seat_position && !is_coxswain) {
        errors.push({
          row: rowNumber,
          message:
            "champ 'seat_position' requis (sauf si is_coxswain=true pour le barreur)",
        });
        return;
      }
      if (!participant_first_name || !participant_last_name) {
        errors.push({
          row: rowNumber,
          message:
            "champs 'participant_first_name' et 'participant_last_name' requis",
        });
        return;
      }

      const key = [
        crew_external_id,
        category_code.toLowerCase(),
        (club_code || "").toLowerCase(),
        (club_name || "").toLowerCase(),
      ].join("||");

      if (!groups.has(key)) {
        groups.set(key, {
          crew_external_id,
          category_code,
          club_name,
          club_code,
          temps_pronostique: parseTempsPronostique(row["temps_pronostique"]),
          rows: [],
        });
      }

      groups.get(key).rows.push({
        row,
        rowNumber,
        seat_position,
        is_coxswain,
      });
    });

    if (groups.size === 0) {
      return res.status(400).json({
        status: "error",
        message: "Aucune ligne valide après pré-validation",
        errors,
      });
    }

    let crewsCreated = 0;
    let crewsUpdated = 0;
    let participantsCreated = 0;
    let participantsMatched = 0;

    // Traitement groupé par équipage
    for (const [key, group] of groups.entries()) {
      const { crew_external_id, category_code, club_name, club_code } = group;

      // 1) Résolution catégorie
      // eslint-disable-next-line no-await-in-loop
      const { category, error: catError } = await resolveCategoryForEvent(
        event_id,
        category_code
      );
      if (!category) {
        errors.push({
          row: group.rows[0].rowNumber,
          message: catError,
        });
        continue;
      }

      // 2) Résolution club
      // eslint-disable-next-line no-await-in-loop
      const clubInfo = await resolveClub({ club_code, club_name });
      if (clubInfo.error) {
        errors.push({
          row: group.rows[0].rowNumber,
          message: clubInfo.error,
        });
        continue;
      }

      const resolvedClubName = clubInfo.club_name;
      const resolvedClubCode = clubInfo.club_code;

      // 3) Recherche d'un équipage existant (par event + catégorie + club)
      // eslint-disable-next-line no-await-in-loop
      let crew = await Crew.findOne({
        where: {
          event_id,
          category_id: category.id,
          club_name: resolvedClubName,
          ...(resolvedClubCode ? { club_code: resolvedClubCode } : {}),
        },
      });

      const isExisting = !!crew;

      if (isExisting && mode === "create_only") {
        // On signale mais on ne modifie rien
        errors.push({
          row: group.rows[0].rowNumber,
          message: `Équipage déjà existant pour category="${category_code}", club="${resolvedClubName}" (mode=create_only)`,
        });
        continue;
      }

      if (!dryRun) {
        // Création ou mise à jour de l'équipage
        if (!crew) {
          // eslint-disable-next-line no-await-in-loop
          crew = await Crew.create({
            id: uuidv4(),
            event_id,
            category_id: category.id,
            club_name: resolvedClubName,
            club_code: resolvedClubCode,
            status: CREW_STATUS.REGISTERED,
            temps_pronostique: group.temps_pronostique,
          });
          crewsCreated++;
        } else {
          // Mise à jour simple
          // eslint-disable-next-line no-await-in-loop
          await crew.update({
            club_name: resolvedClubName,
            club_code: resolvedClubCode,
            temps_pronostique: group.temps_pronostique,
          });
          crewsUpdated++;

          // On remet à zéro les participants si on est en mode update_or_create
          if (mode === "update_or_create") {
            // eslint-disable-next-line no-await-in-loop
            await CrewParticipant.destroy({ where: { crew_id: crew.id } });
          }
        }
      }

      // 4) Traitement des participants de ce groupe
      for (const entry of group.rows) {
        const { row, rowNumber, seat_position, is_coxswain } = entry;

        // eslint-disable-next-line no-await-in-loop
        const { participant, created, error: pError } =
          await resolveParticipant(row, event_id);
        if (pError || !participant) {
          errors.push({
            row: rowNumber,
            message: pError || "Impossible de résoudre le participant",
          });
          continue;
        }

        if (created) {
          participantsCreated++;
        } else {
          participantsMatched++;
        }

        if (!dryRun) {
          // Lier participant -> équipage
          // eslint-disable-next-line no-await-in-loop
          const existingLink = await CrewParticipant.findOne({
            where: {
              crew_id: crew.id,
              participant_id: participant.id,
            },
          });

          if (!existingLink) {
            // eslint-disable-next-line no-await-in-loop
            await CrewParticipant.create({
              id: uuidv4(),
              crew_id: crew.id,
              participant_id: participant.id,
              is_coxswain: !!is_coxswain,
              seat_position: seat_position || null,
              coxswain_weight: null,
            });
          }
        }
      }
    }

    const summary = {
      rows_total: rows.length,
      crews_created: crewsCreated,
      crews_updated: crewsUpdated,
      participants_created: participantsCreated,
      participants_matched: participantsMatched,
      dry_run: dryRun,
      mode,
    };

    return res.json({
      status: "success",
      summary,
      errors,
    });
  } catch (err) {
    console.error("Erreur lors de l'import de participants:", err);
    return res.status(500).json({
      status: "error",
      message:
        err.message || "Erreur inconnue lors de l'import de participants",
    });
  }
};

