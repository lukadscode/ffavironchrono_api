const { v4: uuidv4 } = require("uuid");
const Crew = require("../models/Crew");
const Participant = require("../models/Participant");
const CrewParticipant = require("../models/CrewParticipant");
const Category = require("../models/Category");
const EventCategory = require("../models/EventCategory");
const { REGISTERED } = require("../constants/crewStatus");

/**
 * Parse un temps pronostique depuis une chaîne ou un nombre
 * Formats supportés :
 * - "8:00" => 480 secondes
 * - "1:08:00" => 4080 secondes
 * - 480 (déjà en secondes)
 * Retourne null si le format n'est pas reconnu
 */
function parseTempsPronostique(value) {
  if (!value) return null;

  // Si c'est déjà un nombre, le retourner
  if (typeof value === "number") {
    return Math.round(value);
  }

  // Si c'est une chaîne, la parser
  if (typeof value === "string") {
    const timeStr = value.trim();

    // Parser le format MM:SS ou HH:MM:SS
    const parts = timeStr.split(":");
    if (parts.length === 2) {
      // Format MM:SS
      const minutes = parseInt(parts[0], 10);
      const seconds = parseFloat(parts[1]);
      if (!isNaN(minutes) && !isNaN(seconds)) {
        return Math.round(minutes * 60 + seconds);
      }
    } else if (parts.length === 3) {
      // Format HH:MM:SS
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseFloat(parts[2]);
      if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
        return Math.round(hours * 3600 + minutes * 60 + seconds);
      }
    }
  }

  return null;
}

/**
 * Convertit le sexe vers notre format
 */
function mapGender(sexe) {
  if (!sexe) return "Homme";
  const sexeStr = String(sexe).trim();
  if (sexeStr === "F" || sexeStr === "Femme" || sexeStr === "Féminin")
    return "Femme";
  if (sexeStr === "H" || sexeStr === "Homme" || sexeStr === "Masculin")
    return "Homme";
  if (sexeStr === "M" || sexeStr === "Mixte") return "Mixte";
  return "Homme"; // Par défaut
}

/**
 * Valide et normalise une ligne d'import
 */
function validateAndNormalizeRow(row, rowIndex) {
  const errors = [];

  // Champs requis
  if (!row.code_categorie) {
    errors.push(`Ligne ${rowIndex + 2}: Le code de catégorie est requis`);
  }

  // Au moins un participant requis
  const hasParticipant = row.prenom_1 && row.nom_1;
  if (!hasParticipant) {
    errors.push(
      `Ligne ${
        rowIndex + 2
      }: Au moins un participant (prénom_1 et nom_1) est requis`
    );
  }

  // Vérifier que tous les participants ont prénom et nom
  for (let i = 1; i <= 8; i++) {
    const prenom = row[`prenom_${i}`];
    const nom = row[`nom_${i}`];
    if ((prenom && !nom) || (!prenom && nom)) {
      errors.push(
        `Ligne ${
          rowIndex + 2
        }: Le participant ${i} doit avoir à la fois un prénom et un nom`
      );
    }
  }

  // Vérifier le barreur
  const prenomBarreur = row.prenom_barreur;
  const nomBarreur = row.nom_barreur;
  if ((prenomBarreur && !nomBarreur) || (!prenomBarreur && nomBarreur)) {
    errors.push(
      `Ligne ${
        rowIndex + 2
      }: Le barreur doit avoir à la fois un prénom et un nom`
    );
  }

  return { errors, isValid: errors.length === 0 };
}

/**
 * Crée ou trouve un participant
 */
async function findOrCreateParticipant(participantData, event_id) {
  const { prenom, nom, numero_licence, sexe, club_name, email } =
    participantData;

  // 1) Si un numéro de licence existe, l'utiliser (identifiant fort)
  if (numero_licence) {
    const [participant] = await Participant.findOrCreate({
      where: { license_number: numero_licence },
      defaults: {
        id: uuidv4(),
        first_name: prenom,
        last_name: nom,
        license_number: numero_licence,
        gender: mapGender(sexe),
        club_name: club_name || null,
        email: email || null,
      },
    });
    return participant;
  }

  // 2) Sinon, tenter de retrouver un participant par nom/prénom/club
  const existing = await Participant.findOne({
    where: {
      first_name: prenom,
      last_name: nom,
      ...(club_name ? { club_name } : {}),
    },
  });
  if (existing) {
    return existing;
  }

  // 3) Création sans licence (license_number = null)
  const participant = await Participant.create({
    id: uuidv4(),
    first_name: prenom,
    last_name: nom,
    license_number: null,
    gender: mapGender(sexe),
    club_name: club_name || null,
    email: email || null,
  });

  return participant;
}

/**
 * Importe des équipages depuis des données JSON
 * Le frontend doit parser le fichier Excel/JSON et envoyer les données
 */
exports.importCrews = async (req, res) => {
  try {
    const { event_id, crews } = req.body;

    if (!event_id) {
      return res.status(400).json({
        status: "error",
        message: "event_id est requis dans le body",
      });
    }

    if (!crews || !Array.isArray(crews) || crews.length === 0) {
      return res.status(400).json({
        status: "error",
        message:
          "Le body doit contenir un tableau 'crews' avec au moins un équipage",
      });
    }

    const rows = crews;

    // Validation de toutes les lignes
    const validationErrors = [];
    rows.forEach((row, index) => {
      const { errors } = validateAndNormalizeRow(row, index);
      validationErrors.push(...errors);
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "Erreurs de validation",
        errors: validationErrors,
      });
    }

    // Traitement des équipages
    let createdCrews = 0;
    let updatedCrews = 0;
    let createdParticipants = 0;
    let errors = [];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];

      try {
        // Trouver la catégorie par code
        const category = await Category.findOne({
          where: { code: row.code_categorie },
        });

        if (!category) {
          errors.push({
            row: rowIndex + 2,
            error: `Catégorie "${row.code_categorie}" non trouvée`,
          });
          continue;
        }

        // Vérifier que la catégorie est liée à l'événement
        const eventCategory = await EventCategory.findOne({
          where: { event_id, category_id: category.id },
        });

        if (!eventCategory) {
          errors.push({
            row: rowIndex + 2,
            error: `La catégorie "${row.code_categorie}" n'est pas liée à cet événement`,
          });
          continue;
        }

        // Extraire les informations de l'équipage
        const club_name = row.nom_club || row.club_name || null;
        const club_code = row.code_club || row.club_code || null;
        const coach_name = row.nom_entraineur || row.coach_name || null;
        const temps_pronostique = parseTempsPronostique(
          row.temps_pronostique || row.temps_pronostique_crew
        );

        // Créer ou trouver l'équipage
        // On cherche par catégorie + club pour éviter les doublons
        // Construire la condition where dynamiquement
        const whereClause = {
          event_id,
          category_id: category.id,
        };

        // Ajouter les conditions de club si présentes
        if (club_name) {
          whereClause.club_name = club_name;
        }
        if (club_code) {
          whereClause.club_code = club_code;
        }

        let crew = await Crew.findOne({
          where: whereClause,
        });

        if (crew) {
          // Mettre à jour l'équipage existant
          await crew.update({
            club_name,
            club_code,
            coach_name,
            temps_pronostique,
          });
          updatedCrews++;
        } else {
          // Créer un nouvel équipage
          crew = await Crew.create({
            id: uuidv4(),
            event_id,
            category_id: category.id,
            club_name,
            club_code,
            coach_name,
            temps_pronostique,
            status: REGISTERED,
          });
          createdCrews++;
        }

        // Traiter les participants (rameurs 1 à 8)
        for (let i = 1; i <= 8; i++) {
          const prenom = row[`prenom_${i}`];
          const nom = row[`nom_${i}`];

          if (!prenom || !nom) continue;

          try {
            const participant = await findOrCreateParticipant(
              {
                prenom,
                nom,
                numero_licence:
                  row[`numero_licence_${i}`] || row[`licence_${i}`],
                sexe: row[`sexe_${i}`] || row[`genre_${i}`],
                club_name: row[`club_${i}`] || club_name,
                email: row[`email_${i}`],
              },
              event_id
            );

            if (participant.isNewRecord) {
              createdParticipants++;
            }

            // Vérifier si le participant n'est pas déjà lié à cet équipage
            const existingLink = await CrewParticipant.findOne({
              where: {
                crew_id: crew.id,
                participant_id: participant.id,
              },
            });

            if (!existingLink) {
              await CrewParticipant.create({
                id: uuidv4(),
                crew_id: crew.id,
                participant_id: participant.id,
                is_coxswain: false,
                seat_position: i,
              });
            }
          } catch (participantError) {
            errors.push({
              row: rowIndex + 2,
              participant: i,
              error: `Erreur lors de la création du participant ${i}: ${participantError.message}`,
            });
          }
        }

        // Traiter le barreur si présent
        if (row.prenom_barreur && row.nom_barreur) {
          try {
            const barreur = await findOrCreateParticipant(
              {
                prenom: row.prenom_barreur,
                nom: row.nom_barreur,
                numero_licence:
                  row.numero_licence_barreur || row.licence_barreur,
                sexe: row.sexe_barreur || row.genre_barreur,
                club_name: row.club_barreur || club_name,
                email: row.email_barreur,
              },
              event_id
            );

            if (barreur.isNewRecord) {
              createdParticipants++;
            }

            // Vérifier si le barreur n'est pas déjà lié à cet équipage
            const existingLink = await CrewParticipant.findOne({
              where: {
                crew_id: crew.id,
                participant_id: barreur.id,
              },
            });

            if (!existingLink) {
              await CrewParticipant.create({
                id: uuidv4(),
                crew_id: crew.id,
                participant_id: barreur.id,
                is_coxswain: true,
                coxswain_weight: row.poids_barreur || null,
                seat_position: null,
              });
            }
          } catch (barreurError) {
            errors.push({
              row: rowIndex + 2,
              participant: "barreur",
              error: `Erreur lors de la création du barreur: ${barreurError.message}`,
            });
          }
        }
      } catch (rowError) {
        errors.push({
          row: rowIndex + 2,
          error: `Erreur lors du traitement de la ligne: ${rowError.message}`,
        });
      }
    }

    res.json({
      status: "success",
      message: "Import terminé",
      data: {
        total_rows: rows.length,
        crews_created: createdCrews,
        crews_updated: updatedCrews,
        participants_created: createdParticipants,
        errors_count: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (err) {
    console.error("Erreur lors de l'import:", err);
    res.status(500).json({
      status: "error",
      message: err.message || "Erreur lors de l'import",
    });
  }
};
