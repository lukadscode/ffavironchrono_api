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

/**
 * Récupère une colonne en étant tolérant sur les espaces et la casse
 * Exemple : "category_name " (avec espace insécable) sera vu comme "category_name"
 */
function getField(row, candidateNames) {
  if (!row || typeof row !== "object") return null;

  const entries = Object.entries(row);
  for (const [key, value] of entries) {
    const normalizedKey = String(key).trim().toLowerCase();
    for (const name of candidateNames) {
      if (normalizedKey === String(name).trim().toLowerCase()) {
        return value;
      }
    }
  }
  return null;
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

async function resolveClub({ club_code, club_name, participant_club_name }) {
  const result = { club_code: null, club_name: null, error: null };

  const code = normalizeString(club_code);
  const name = normalizeString(club_name);
  const participantName = normalizeString(participant_club_name);

  // 1. Priorité au club_code s'il est fourni
  if (code) {
    const club = await Club.findOne({ where: { code: code } });
    if (!club) {
      result.error = `Club code "${code}" introuvable`;
      return result;
    }
    result.club_code = code;
    result.club_name = name || club.nom || club.nom_court || null;
    return result;
  }

  // 2. Sinon, utiliser club_name si présent (nom texte libre)
  if (name) {
    result.club_name = name;
    result.club_code = null;
    return result;
  }

  // 3. Sinon, utiliser participant_club_name si présent
  if (participantName) {
    result.club_name = participantName;
    result.club_code = null;
    return result;
  }

  // 4. Aucune information club : ne pas bloquer l'import
  result.club_name = null;
  result.club_code = null;
  result.error = null;
  return result;
}

async function resolveCategoryForEvent(event_id, category_code_or_name) {
  const value = normalizeString(category_code_or_name);
  if (!value) {
    return {
      category: null,
      error: "category_code ou category_name manquant",
    };
  }

  // 1) D'abord par code exact
  let category = await Category.findOne({
    where: { code: { [Op.eq]: value } },
  });

  // 2) Si non trouvé, tenter par label (nom de catégorie)
  if (!category) {
    category = await Category.findOne({
      where: { label: { [Op.eq]: value } },
    });
  }

  if (!category) {
    return { category: null, error: `Catégorie "${value}" introuvable` };
  }

  const ec = await EventCategory.findOne({
    where: { event_id, category_id: category.id },
  });
  if (!ec) {
    return {
      category: null,
      error: `La catégorie "${value}" n'est pas liée à cet événement`,
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

  // 1) Par numéro de licence (identifiant fort)
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

  // 2) Optionnel : par nom/prénom/club (sans licence)
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

  // 3) Création sans licence (license_number = null)
  const participant = await Participant.create({
    id: uuidv4(),
    first_name,
    last_name,
    license_number: null,
    gender: gender || "Homme",
    email: email || null,
    club_name: participant_club_name,
  });

  return { participant, created: true, error: null };
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

      const crew_external_id = normalizeString(
        getField(row, ["crew_external_id"])
      );
      // Accepter soit category_code soit category_name (tolérant aux espaces)
      const rawCategory = getField(row, ["category_code", "category_name"]);
      const category_code = normalizeString(rawCategory);
      const club_name = normalizeString(getField(row, ["club_name"]));
      const club_code = normalizeString(getField(row, ["club_code"]));
      const seat_position = parseSeatPosition(getField(row, ["seat_position"]));
      const is_coxswain = parseBoolean(getField(row, ["is_coxswain"]));
      const participant_first_name = normalizeString(
        getField(row, ["participant_first_name"])
      );
      const participant_last_name = normalizeString(
        getField(row, ["participant_last_name"])
      );

      if (!category_code) {
        errors.push({
          row: rowNumber,
          message: "champ 'category_code' manquant",
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

      // Si crew_external_id est absent, on génère un identifiant auto par ligne
      const effectiveCrewId =
        crew_external_id && crew_external_id.trim() !== ""
          ? crew_external_id
          : `AUTO_ROW_${rowNumber}`;

      const key = [
        effectiveCrewId,
        category_code.toLowerCase(),
        (club_code || "").toLowerCase(),
        (club_name || "").toLowerCase(),
      ].join("||");

      if (!groups.has(key)) {
        groups.set(key, {
          crew_external_id: effectiveCrewId,
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
      const firstRowRaw = group.rows[0]?.row || {};
      const clubInfo = await resolveClub({
        club_code,
        club_name,
        participant_club_name: getField(firstRowRaw, ["participant_club_name"]),
      });
      if (clubInfo.error) {
        errors.push({
          row: group.rows[0].rowNumber,
          message: clubInfo.error,
        });
        continue;
      }

      const resolvedClubName = clubInfo.club_name;
      const resolvedClubCode = clubInfo.club_code;

      // 3) Déduplication : si un équipage avec les mêmes participants existe déjà,
      // on ne crée rien de nouveau (quelle que soit la valeur de "mode")
      let crew = null;
      if (!dryRun && group.rows.length === 1) {
        const firstEntry = group.rows[0];
        const { row: firstRowForDedup, rowNumber: firstRowNumber } = firstEntry;

        // eslint-disable-next-line no-await-in-loop
        const { participant: firstParticipant, error: firstPError } =
          await resolveParticipant(firstRowForDedup, event_id);
        if (!firstPError && firstParticipant) {
          // Chercher un équipage existant pour cet event + catégorie + club + participant
          // eslint-disable-next-line no-await-in-loop
          const existingCrewWithSameParticipant = await Crew.findOne({
            where: {
              event_id,
              category_id: category.id,
              club_name: resolvedClubName,
              ...(resolvedClubCode ? { club_code: resolvedClubCode } : {}),
            },
            include: [
              {
                model: CrewParticipant,
                as: "crew_participants", // alias défini dans relations.js
                required: true,
                where: { participant_id: firstParticipant.id },
              },
            ],
          });

          if (existingCrewWithSameParticipant) {
            // On considère que l'équipage existe déjà avec ce participant : on ne recrée pas
            participantsMatched += 1;
            continue;
          }
        } else if (firstPError) {
          errors.push({
            row: firstRowNumber,
            message: firstPError,
          });
          continue;
        }
      }

      // 4) Recherche d'un équipage existant (par event + catégorie + club) uniquement
      // en mode update_or_create
      if (mode === "update_or_create") {
        // eslint-disable-next-line no-await-in-loop
        crew = await Crew.findOne({
          where: {
            event_id,
            category_id: category.id,
            club_name: resolvedClubName,
            ...(resolvedClubCode ? { club_code: resolvedClubCode } : {}),
          },
        });
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
        } else if (mode === "update_or_create") {
          // Mise à jour simple uniquement en mode update_or_create
          // eslint-disable-next-line no-await-in-loop
          await crew.update({
            club_name: resolvedClubName,
            club_code: resolvedClubCode,
            temps_pronostique: group.temps_pronostique,
          });
          crewsUpdated++;

          // On remet à zéro les participants si on est en mode update_or_create
          // eslint-disable-next-line no-await-in-loop
          await CrewParticipant.destroy({ where: { crew_id: crew.id } });
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

