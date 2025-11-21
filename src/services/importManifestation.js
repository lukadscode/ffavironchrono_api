const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment");

const Event = require("../models/Event");
const Category = require("../models/Category");
const EventCategory = require("../models/EventCategory");
const Crew = require("../models/Crew");
const Participant = require("../models/Participant");
const CrewParticipant = require("../models/CrewParticipant");
const RacePhase = require("../models/RacePhase");
const Race = require("../models/Race");
const Distance = require("../models/Distance");

/**
 * Parse une date au format DD/MM/YYYY
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  return moment(dateStr, "DD/MM/YYYY").toDate();
}

/**
 * Convertit le sexe de l'API vers notre format
 */
function mapGender(sexe) {
  if (!sexe) return "Homme";
  if (sexe === "F" || sexe === "Femme") return "Femme";
  if (sexe === "H" || sexe === "Homme") return "Homme";
  if (sexe === "M" || sexe === "Mixte") return "Mixte";
  return "Homme"; // Par défaut
}

/**
 * Extrait le nombre de places du code bateau
 * Ex: "1I" => 1, "R4" => 4, "8+" => 8
 */
function extractBoatSeats(bateauCode) {
  if (!bateauCode) return null;
  const match = bateauCode.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Détermine si le bateau a un barreur
 */
function hasCoxswain(bateauCode) {
  if (!bateauCode) return false;
  return bateauCode.includes("+") || bateauCode.includes("C");
}

/**
 * Extrait la distance depuis le libellé de l'épreuve
 * Ex: "500 m" => 500, "2000 m" => 2000
 */
function extractDistance(libelle) {
  if (!libelle) return null;
  const match = libelle.match(/(\d+)\s*m/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Trouve ou crée un participant de manière cohérente
 * Si le participant existe déjà (même nom/prénom), il est réutilisé
 * pour éviter les doublons quand un participant participe à plusieurs courses
 */
async function findOrCreateParticipant({
  nom,
  prenom,
  licenseNumber,
  gender,
  club_name,
  event_id,
}) {
  // 1. Si un numéro de licence existe, l'utiliser (identifiant unique)
  if (licenseNumber) {
    const [participant] = await Participant.findOrCreate({
      where: { license_number: licenseNumber },
      defaults: {
        id: uuidv4(),
        first_name: prenom,
        last_name: nom,
        license_number: licenseNumber,
        gender: gender,
        club_name: club_name,
      },
    });
    return participant;
  }

  // 2. Si pas de numéro de licence, chercher par nom + prénom
  // dans les participants déjà créés pour cet événement
  // On cherche d'abord dans les participants qui sont liés à des équipages de l'événement
  const CrewParticipantModel = require("../models/CrewParticipant");
  const CrewModel = require("../models/Crew");

  const existingParticipant = await Participant.findOne({
    where: {
      first_name: prenom,
      last_name: nom,
    },
    include: [
      {
        model: CrewParticipantModel,
        include: [
          {
            model: CrewModel,
            where: { event_id },
            required: true,
          },
        ],
        required: true,
      },
    ],
  });

  if (existingParticipant) {
    // Participant trouvé dans l'événement, le réutiliser
    return existingParticipant;
  }

  // 3. Créer un nouveau participant avec un numéro temporaire basé sur nom + prénom + club
  // (sans crew.id pour éviter les doublons)
  const clubPart = club_name ? club_name.replace(/\s+/g, "_") : "UNKNOWN";
  const tempLicenseNumber = `TEMP_${nom}_${prenom}_${clubPart}`.toUpperCase();

  const [participant] = await Participant.findOrCreate({
    where: { license_number: tempLicenseNumber },
    defaults: {
      id: uuidv4(),
      first_name: prenom,
      last_name: nom,
      license_number: tempLicenseNumber,
      gender: gender,
      club_name: club_name,
    },
  });

  return participant;
}

module.exports = async (manifestationId, req) => {
  try {
    // 1. Récupérer les données depuis l'API externe
    const url = `https://intranet.ffaviron.fr/api/v1/manifestation/${manifestationId}`;
    const headers = {
      Authorization: `Bearer ${process.env.EXTERNAL_API_TOKEN}`,
    };

    console.log(`📥 Récupération de la manifestation ${manifestationId}...`);
    const { data } = await axios.get(url, { headers });

    const m = data.manifestation;
    const epreuves = data.epreuves || [];
    const inscriptions = data.inscriptions || [];

    console.log(`✅ Manifestation récupérée: ${m.libelle}`);
    console.log(
      `📊 ${epreuves.length} épreuves, ${inscriptions.length} inscriptions`
    );

    // Compter les participants dans les inscriptions pour comparaison
    let totalParticipantsInAPI = 0;
    for (const ins of inscriptions) {
      // Compter les rameurs (1 à 8)
      for (let i = 1; i <= 8; i++) {
        if (ins[`nom_rameur_${i}`] && ins[`prenom_rameur_${i}`]) {
          totalParticipantsInAPI++;
        }
      }
      // Compter le barreur si présent
      if (ins.nom_bareur && ins.prenom_barreur) {
        totalParticipantsInAPI++;
      }
    }
    console.log(
      `📊 ${totalParticipantsInAPI} participants trouvés dans l'API externe`
    );

    // 2. Création de l'événement
    console.log("📅 Création de l'événement...");
    const event = await Event.create({
      id: uuidv4(),
      name: m.libelle || "Manifestation importée",
      location:
        m.adresse?.adresse_complete || m.adresse?.nom_voie || "Non spécifié",
      start_date: parseDate(m.date_debut),
      end_date: parseDate(m.date_fin) || parseDate(m.date_debut),
      race_type: m.type?.disciplines?.[0]?.discipline_libelle || "Aviron",
      organiser_name: m.structure?.nom || null,
      organiser_code: m.structure?.code || null,
      created_by: req.user?.userId || null,
    });

    const event_id = event.id;
    console.log(`✅ Événement créé: ${event.id}`);

    // 3. Création des distances (basées sur les épreuves)
    const distanceMap = {}; // distance_m => distance_id
    const uniqueDistances = new Set();

    epreuves.forEach((ep) => {
      const distance = extractDistance(ep.libelle_epreuve);
      if (distance) uniqueDistances.add(distance);
    });

    for (const distanceValue of uniqueDistances) {
      const [distance] = await Distance.findOrCreate({
        where: { event_id, meters: distanceValue },
        defaults: {
          id: uuidv4(),
          event_id,
          meters: distanceValue,
        },
      });
      distanceMap[distanceValue] = distance.id;
    }

    // 4. Création des catégories à partir des épreuves
    console.log("🏷️  Création des catégories...");
    const categoryMap = {}; // identifiant_epreuve => category_id
    const createdCategories = new Set();

    // Créer une catégorie par épreuve unique (identifiant_epreuve)
    // Car le même code_epreuve peut avoir plusieurs distances différentes
    for (const ep of epreuves) {
      const identifiant = ep.identifiant_epreuve;
      const code = ep.code_epreuve;

      if (!identifiant || !code) {
        console.warn(`⚠️  Épreuve sans identifiant ou code:`, ep);
        continue;
      }

      // Utiliser identifiant_epreuve comme clé unique
      if (createdCategories.has(identifiant)) continue;

      // Extraire la distance pour créer un code unique
      const distance = extractDistance(ep.libelle_epreuve);
      const codeWithDistance = distance ? `${code}_${distance}m` : code;

      // Chercher si une catégorie avec ce code+distance existe déjà
      let category = await Category.findOne({
        where: { code: codeWithDistance },
      });

      if (!category) {
        const boatSeats = extractBoatSeats(ep.bateau?.code);
        const hasCox = hasCoxswain(ep.bateau?.code);
        const gender = mapGender(ep.sexe);

        category = await Category.create({
          id: uuidv4(),
          code: codeWithDistance, // Code unique avec distance (ex: "U17F1I_500m", "U17F1I_2000m")
          label: ep.libelle_epreuve || ep.code_epreuve,
          age_group: ep.categorie?.code || null,
          gender,
          boat_seats: boatSeats,
          has_coxswain: hasCox,
        });
        console.log(
          `  ✅ Catégorie créée: ${codeWithDistance} - ${category.label}`
        );
      }

      // Mapper par identifiant_epreuve pour lier aux inscriptions
      categoryMap[identifiant] = category.id;
      createdCategories.add(identifiant);

      // Lier la catégorie à l'événement
      await EventCategory.findOrCreate({
        where: { event_id, category_id: category.id },
        defaults: { id: uuidv4() },
      });
    }

    console.log(`✅ ${createdCategories.size} catégories créées/linkées`);

    // 5. Création d'une phase par défaut pour l'événement
    console.log("🏁 Création de la phase par défaut...");
    const [phase] = await RacePhase.findOrCreate({
      where: { event_id, name: "Phase principale" },
      defaults: {
        id: uuidv4(),
        event_id,
        name: "Phase principale",
        order_index: 1,
      },
    });
    console.log(`✅ Phase créée: ${phase.id}`);
    console.log(
      "ℹ️  Les courses peuvent être créées via generateInitialRaces après l'import"
    );

    // 7. Création des équipages et participants
    console.log("👥 Création des équipages et participants...");
    let crewCount = 0;
    let newParticipantCount = 0;
    let totalParticipantCount = 0; // Tous les participants liés aux équipages

    for (const ins of inscriptions) {
      const identifiantEpreuve = ins.identifiant_epreuve;
      const category_id = categoryMap[identifiantEpreuve];

      if (!category_id) {
        console.warn(
          `⚠️  Catégorie non trouvée pour identifiant_epreuve ${identifiantEpreuve} (code: ${ins.code_epreuve})`
        );
        continue;
      }

      // Extraire le nom du club depuis nom_abrege_club_numero_equipage
      // Format: "LE ROBERT ACR 1" => club_name = "LE ROBERT ACR", numéro = "1"
      const clubInfo = ins.nom_abrege_club_numero_equipage || "";
      const clubParts = clubInfo.trim().split(/\s+/);
      const lastPart = clubParts[clubParts.length - 1];
      const isNumber = /^\d+$/.test(lastPart);

      const club_name = isNumber ? clubParts.slice(0, -1).join(" ") : clubInfo;

      // Le code du club est dans num_club_rameur_1 (ex: "C972007")
      // ou dans club_abrege_rameur_1 (ex: "LE ROBERT ACR")
      const club_code =
        ins.num_club_rameur_1 || ins.club_abrege_rameur_1 || club_name || "";

      // Créer l'équipage
      const crew = await Crew.create({
        id: uuidv4(),
        event_id,
        category_id,
        club_name: club_name || "Non spécifié",
        club_code: club_code,
        status: 8, // Statut par défaut
      });

      crewCount++;

      // Créer les participants (rameurs 1 à 8)
      for (let i = 1; i <= 8; i++) {
        const nom = ins[`nom_rameur_${i}`];
        const prenom = ins[`prenom_rameur_${i}`];
        const licenseNumber = ins[`numero_licence_rameur_${i}`];

        // Ignorer si nom ou prénom manquant
        if (!nom || !prenom) {
          // Log pour debug si nécessaire
          if (nom || prenom) {
            console.warn(
              `⚠️  Participant ${i} de l'équipage ${crew.id} incomplet: nom=${nom}, prenom=${prenom}`
            );
          }
          continue;
        }

        // Trouver ou créer le participant (réutilise si déjà existant dans l'événement)
        const participant = await findOrCreateParticipant({
          nom,
          prenom,
          licenseNumber,
          gender: mapGender(ins[`sexe_rameur_${i}`]),
          club_name: ins[`club_abrege_rameur_${i}`] || club_name,
          event_id,
        });

        if (participant.isNewRecord) newParticipantCount++;
        totalParticipantCount++; // Compter tous les participants liés

        // Vérifier si le participant n'est pas déjà lié à cet équipage
        const existingLink = await CrewParticipant.findOne({
          where: {
            crew_id: crew.id,
            participant_id: participant.id,
          },
        });

        if (!existingLink) {
          // Lier le participant à l'équipage
          await CrewParticipant.create({
            id: uuidv4(),
            crew_id: crew.id,
            participant_id: participant.id,
            is_coxswain: false,
            seat_position: i,
          });
        }
      }

      // Créer le barreur si présent
      if (ins.nom_bareur && ins.prenom_barreur) {
        // Trouver ou créer le barreur (réutilise si déjà existant dans l'événement)
        const barreur = await findOrCreateParticipant({
          nom: ins.nom_bareur,
          prenom: ins.prenom_barreur,
          licenseNumber: ins.numero_licence_barreur,
          gender: mapGender(ins.sexe_barreur),
          club_name: ins.club_abrege_barreur || club_name,
          event_id,
        });

        if (barreur.isNewRecord) newParticipantCount++;
        totalParticipantCount++; // Compter tous les participants liés

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
            coxswain_weight: null,
          });
        }
      }
    }

    console.log(`✅ ${crewCount} équipages créés`);
    console.log(`✅ ${newParticipantCount} nouveaux participants créés`);
    console.log(
      `✅ ${totalParticipantCount} participants totaux liés aux équipages`
    );

    return {
      event_id,
      name: event.name,
      phase_id: phase.id,
      categories_count: createdCategories.size,
      crews_count: crewCount,
      participants_count: totalParticipantCount, // Retourner le total des participants liés
      new_participants_count: newParticipantCount, // Nouveaux participants créés
      distances_count: uniqueDistances.size,
    };
  } catch (error) {
    console.error("❌ Erreur lors de l'import:", error);
    if (error.response) {
      console.error("Réponse API:", error.response.status, error.response.data);
      throw new Error(
        `Erreur API: ${error.response.status} - ${JSON.stringify(
          error.response.data
        )}`
      );
    }
    throw error;
  }
};
