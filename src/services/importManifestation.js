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
 * Ex: "500 m" => { meters: 500, isRelay: false, relayCount: null, isTimeBased: false }
 * Ex: "8x250m" => { meters: 250, isRelay: true, relayCount: 8, isTimeBased: false }
 * Ex: "4x500 m" => { meters: 500, isRelay: true, relayCount: 4, isTimeBased: false }
 * Ex: "2 min" => { durationSeconds: 120, isTimeBased: true, isRelay: false }
 * Ex: "5 minutes" => { durationSeconds: 300, isTimeBased: true, isRelay: false }
 * Ex: "120s" => { durationSeconds: 120, isTimeBased: true, isRelay: false }
 */
function extractDistance(libelle) {
  if (!libelle) return null;
  
  // 1. Détecter les relais (format: "8x250m", "4x500 m", "8 x 250 m", etc.)
  const relayMatch = libelle.match(/(\d+)\s*x\s*(\d+)\s*m/i);
  if (relayMatch) {
    return {
      meters: parseInt(relayMatch[2], 10),
      isRelay: true,
      relayCount: parseInt(relayMatch[1], 10),
      isTimeBased: false,
      durationSeconds: null,
    };
  }

  // 2. Vérifier si c'est une course basée sur le temps (format: "2 min", "5 minutes", "120s", etc.)
  // Format avec "min" ou "minutes"
  const timeMatchMinutes = libelle.match(/(\d+)\s*(?:min|minutes?)/i);
  if (timeMatchMinutes) {
    const minutes = parseInt(timeMatchMinutes[1], 10);
    return {
      meters: null,
      isRelay: false,
      relayCount: null,
      isTimeBased: true,
      durationSeconds: minutes * 60,
    };
  }

  // Format avec "s" ou "secondes"
  const timeMatchSeconds = libelle.match(/(\d+)\s*(?:s|secondes?)/i);
  if (timeMatchSeconds) {
    return {
      meters: null,
      isRelay: false,
      relayCount: null,
      isTimeBased: true,
      durationSeconds: parseInt(timeMatchSeconds[1], 10),
    };
  }

  // 3. Distance normale (format: "500 m", "2000m", etc.)
  const normalMatch = libelle.match(/(\d+)\s*m/i);
  if (normalMatch) {
    return {
      meters: parseInt(normalMatch[1], 10),
      isRelay: false,
      relayCount: null,
      isTimeBased: false,
      durationSeconds: null,
    };
  }
  
  return null;
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
  // Optimisation: chercher d'abord simplement par nom/prénom, puis vérifier s'il est dans l'événement
  const CrewParticipantModel = require("../models/CrewParticipant");
  const CrewModel = require("../models/Crew");

  // Chercher d'abord les participants avec ce nom/prénom
  const candidates = await Participant.findAll({
    where: {
      first_name: prenom,
      last_name: nom,
    },
    limit: 10, // Limiter pour éviter trop de résultats
  });

  // Pour chaque candidat, vérifier s'il est lié à un équipage de cet événement
  for (const candidate of candidates) {
    const crewParticipant = await CrewParticipant.findOne({
      where: { participant_id: candidate.id },
      include: [
        {
          model: CrewModel,
          where: { event_id },
          required: true,
        },
      ],
    });

    if (crewParticipant) {
      // Participant trouvé dans l'événement, le réutiliser
      return candidate;
    }
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
    const { data } = await axios.get(url, { 
      headers,
      timeout: 60000, // 60 secondes de timeout pour l'API externe
    });

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
      manifestation_id: manifestationId.toString(), // Enregistrer l'ID de la manifestation
      created_by: req.user?.userId || null,
    });

    const event_id = event.id;
    console.log(`✅ Événement créé: ${event.id}`);

    // 3. Création des distances (basées sur les épreuves)
    console.log("📏 Création des distances...");
    const distanceMap = {}; // clé unique => distance_id
    const uniqueDistances = new Map(); // Map pour stocker les distances avec leurs métadonnées

    epreuves.forEach((ep) => {
      const distanceInfo = extractDistance(ep.libelle_epreuve);
      if (distanceInfo) {
        // Créer une clé unique pour chaque combinaison
        let key;
        if (distanceInfo.isTimeBased) {
          key = `time_${distanceInfo.durationSeconds}`;
        } else if (distanceInfo.isRelay) {
          key = `${distanceInfo.meters}_relay_${distanceInfo.relayCount}`;
        } else {
          key = `${distanceInfo.meters}_normal`;
        }
        uniqueDistances.set(key, distanceInfo);
      }
    });

    for (const [key, distanceInfo] of uniqueDistances) {
      // Chercher une distance existante avec les mêmes caractéristiques
      const whereClause = {
        event_id,
        is_relay: distanceInfo.isRelay,
        is_time_based: distanceInfo.isTimeBased || false,
      };
      
      // Pour les distances basées sur les mètres
      if (distanceInfo.isTimeBased) {
        whereClause.duration_seconds = distanceInfo.durationSeconds;
        whereClause.meters = null;
      } else {
        whereClause.meters = distanceInfo.meters;
        whereClause.duration_seconds = null;
      }
      
      // Pour les relais, inclure relay_count dans la recherche
      if (distanceInfo.isRelay) {
        whereClause.relay_count = distanceInfo.relayCount;
      } else {
        whereClause.relay_count = null;
      }

      const [distance] = await Distance.findOrCreate({
        where: whereClause,
        defaults: {
          id: uuidv4(),
          event_id,
          meters: distanceInfo.meters,
          is_relay: distanceInfo.isRelay,
          relay_count: distanceInfo.relayCount,
          is_time_based: distanceInfo.isTimeBased || false,
          duration_seconds: distanceInfo.durationSeconds,
        },
      });
      
      // Log pour indiquer le type de distance créée
      if (distanceInfo.isTimeBased) {
        const minutes = Math.floor(distanceInfo.durationSeconds / 60);
        const seconds = distanceInfo.durationSeconds % 60;
        let timeLabel;
        if (minutes > 0 && seconds > 0) {
          timeLabel = `${minutes}min ${seconds}s`;
        } else if (minutes > 0) {
          timeLabel = `${minutes}min`;
        } else {
          timeLabel = `${distanceInfo.durationSeconds}s`;
        }
        console.log(`  ✅ Course basée sur le temps créée: ${timeLabel}`);
      } else if (distanceInfo.isRelay) {
        console.log(
          `  ✅ Relais créé: ${distanceInfo.relayCount}x${distanceInfo.meters}m`
        );
      } else {
        console.log(`  ✅ Distance créée: ${distanceInfo.meters}m`);
      }
      
      // Utiliser la clé unique pour le mapping
      distanceMap[key] = distance.id;
      // Aussi mapper par meters pour compatibilité (si nécessaire)
      if (distanceInfo.meters && !distanceMap[distanceInfo.meters]) {
        distanceMap[distanceInfo.meters] = distance.id;
      }
    }
    
    console.log(`✅ ${uniqueDistances.size} distance(s) unique(s) créée(s)`);

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
      const distanceInfo = extractDistance(ep.libelle_epreuve);
      let codeWithDistance = code;
      let distanceId = null;

      if (distanceInfo) {
        if (distanceInfo.isTimeBased) {
          // Pour les courses basées sur le temps: "CODE_120s" ou "CODE_2min"
          const minutes = Math.floor(distanceInfo.durationSeconds / 60);
          const seconds = distanceInfo.durationSeconds % 60;
          if (minutes > 0 && seconds > 0) {
            codeWithDistance = `${code}_${minutes}min${seconds}s`;
          } else if (minutes > 0) {
            codeWithDistance = `${code}_${minutes}min`;
          } else {
            codeWithDistance = `${code}_${distanceInfo.durationSeconds}s`;
          }
        } else if (distanceInfo.isRelay) {
          // Pour les relais: "CODE_8x250m"
          codeWithDistance = `${code}_${distanceInfo.relayCount}x${distanceInfo.meters}m`;
        } else {
          // Pour les courses normales: "CODE_2000m"
          codeWithDistance = `${code}_${distanceInfo.meters}m`;
        }

        // Trouver la distance correspondante dans l'événement
        let key;
        if (distanceInfo.isTimeBased) {
          key = `time_${distanceInfo.durationSeconds}`;
        } else if (distanceInfo.isRelay) {
          key = `${distanceInfo.meters}_relay_${distanceInfo.relayCount}`;
        } else {
          key = `${distanceInfo.meters}_normal`;
        }
        distanceId = distanceMap[key] || null;
      }

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
          distance_id: distanceId, // Lier directement à la distance
        });
        
        const distanceLabel = distanceId
          ? distanceInfo.isRelay
            ? ` (${distanceInfo.relayCount}x${distanceInfo.meters}m)`
            : ` (${distanceInfo.meters}m)`
          : "";
        console.log(
          `  ✅ Catégorie créée: ${codeWithDistance} - ${category.label}${distanceLabel}`
        );
      } else if (!category.distance_id && distanceId) {
        // Mettre à jour la catégorie existante si elle n'a pas de distance_id
        await category.update({ distance_id: distanceId });
        console.log(
          `  ✅ Distance assignée à la catégorie existante: ${codeWithDistance}`
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
    const totalInscriptions = inscriptions.length;
    let processedInscriptions = 0;

    for (const ins of inscriptions) {
      processedInscriptions++;
      
      // Log de progression tous les 50 équipages
      if (processedInscriptions % 50 === 0 || processedInscriptions === totalInscriptions) {
        console.log(
          `  📊 Progression: ${processedInscriptions}/${totalInscriptions} inscriptions traitées (${crewCount} équipages créés)`
        );
      }
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
      let crew;
      try {
        crew = await Crew.create({
          id: uuidv4(),
          event_id,
          category_id,
          club_name: club_name || "Non spécifié",
          club_code: club_code,
          status: 8, // Statut par défaut
        });
        crewCount++;
      } catch (crewError) {
        console.error(
          `❌ Erreur lors de la création de l'équipage pour ${club_name} (catégorie ${category_id}):`,
          crewError.message
        );
        // Continuer avec l'inscription suivante
        continue;
      }

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

        try {
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
        } catch (participantError) {
          console.error(
            `❌ Erreur lors de la création du participant ${i} pour l'équipage ${crew.id}:`,
            participantError.message
          );
          // Continuer avec les autres participants plutôt que de tout arrêter
          continue;
        }
      }

      // Créer le barreur si présent
      if (ins.nom_bareur && ins.prenom_barreur) {
        try {
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
        } catch (barreurError) {
          console.error(
            `❌ Erreur lors de la création du barreur pour l'équipage ${crew.id}:`,
            barreurError.message
          );
          // Continuer avec les autres équipages
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

/**
 * Met à jour un événement existant en ajoutant uniquement les nouveaux éléments
 * (catégories, participants, équipages) sans toucher à l'existant
 */
module.exports.updateEventFromManifestation = async (manifestationId, event_id, req) => {
  try {
    // 1. Vérifier que l'événement existe
    const event = await Event.findByPk(event_id);
    if (!event) {
      throw new Error(`Événement ${event_id} introuvable`);
    }

    // 2. Récupérer les données depuis l'API externe
    const url = `https://intranet.ffaviron.fr/api/v1/manifestation/${manifestationId}`;
    const headers = {
      Authorization: `Bearer ${process.env.EXTERNAL_API_TOKEN}`,
    };

    console.log(`📥 Mise à jour de l'événement ${event_id} depuis la manifestation ${manifestationId}...`);
    const { data } = await axios.get(url, { 
      headers,
      timeout: 60000,
    });

    const m = data.manifestation;
    const epreuves = data.epreuves || [];
    const inscriptions = data.inscriptions || [];

    console.log(`✅ Manifestation récupérée: ${m.libelle}`);
    console.log(`📊 ${epreuves.length} épreuves, ${inscriptions.length} inscriptions`);

    // 3. Récupérer les catégories existantes pour cet événement
    const existingEventCategories = await EventCategory.findAll({
      where: { event_id },
      include: [{ model: Category }],
    });
    const existingCategoryCodes = new Set(
      existingEventCategories.map((ec) => ec.Category?.code).filter(Boolean)
    );

    // 4. Récupérer les équipages existants pour cet événement (pour éviter les doublons)
    const existingCrews = await Crew.findAll({
      where: { event_id },
      attributes: ['id', 'category_id', 'club_name', 'club_code'],
    });
    
    // Créer un Set pour vérifier rapidement si un équipage existe déjà
    // Clé: "category_id|club_name|club_code"
    const existingCrewKeys = new Set();
    existingCrews.forEach((crew) => {
      const key = `${crew.category_id}|${crew.club_name || ''}|${crew.club_code || ''}`;
      existingCrewKeys.add(key);
    });

    // 5. Création des distances (uniquement les nouvelles)
    console.log("📏 Vérification des distances...");
    const distanceMap = {};
    const uniqueDistances = new Map();
    const newDistances = []; // Pour stocker les détails des nouvelles distances

    epreuves.forEach((ep) => {
      const distanceInfo = extractDistance(ep.libelle_epreuve);
      if (distanceInfo) {
        let key;
        if (distanceInfo.isTimeBased) {
          key = `time_${distanceInfo.durationSeconds}`;
        } else if (distanceInfo.isRelay) {
          key = `${distanceInfo.meters}_relay_${distanceInfo.relayCount}`;
        } else {
          key = `${distanceInfo.meters}_normal`;
        }
        uniqueDistances.set(key, distanceInfo);
      }
    });

    let newDistancesCount = 0;
    for (const [key, distanceInfo] of uniqueDistances) {
      const whereClause = {
        event_id,
        is_relay: distanceInfo.isRelay,
        is_time_based: distanceInfo.isTimeBased || false,
      };
      
      // Pour les distances basées sur les mètres
      if (distanceInfo.isTimeBased) {
        whereClause.duration_seconds = distanceInfo.durationSeconds;
        whereClause.meters = null;
      } else {
        whereClause.meters = distanceInfo.meters;
        whereClause.duration_seconds = null;
      }
      
      if (distanceInfo.isRelay) {
        whereClause.relay_count = distanceInfo.relayCount;
      } else {
        whereClause.relay_count = null;
      }

      const [distance, created] = await Distance.findOrCreate({
        where: whereClause,
        defaults: {
          id: uuidv4(),
          event_id,
          meters: distanceInfo.meters,
          is_relay: distanceInfo.isRelay,
          relay_count: distanceInfo.relayCount,
          is_time_based: distanceInfo.isTimeBased || false,
          duration_seconds: distanceInfo.durationSeconds,
        },
      });
      
      if (created) {
        newDistancesCount++;
        let label;
        if (distanceInfo.isTimeBased) {
          const minutes = Math.floor(distanceInfo.durationSeconds / 60);
          const seconds = distanceInfo.durationSeconds % 60;
          if (minutes > 0 && seconds > 0) {
            label = `${minutes}min ${seconds}s`;
          } else if (minutes > 0) {
            label = `${minutes}min`;
          } else {
            label = `${distanceInfo.durationSeconds}s`;
          }
        } else if (distanceInfo.isRelay) {
          label = `${distanceInfo.relayCount}x${distanceInfo.meters}m`;
        } else {
          label = `${distanceInfo.meters}m`;
        }
        
        newDistances.push({
          id: distance.id,
          meters: distance.meters,
          is_relay: distance.is_relay,
          relay_count: distance.relay_count,
          is_time_based: distance.is_time_based,
          duration_seconds: distance.duration_seconds,
          label: label,
        });
        
        if (distanceInfo.isTimeBased) {
          console.log(`  ✅ Nouvelle course basée sur le temps créée: ${label}`);
        } else if (distanceInfo.isRelay) {
          console.log(`  ✅ Nouvelle distance créée: ${distanceInfo.relayCount}x${distanceInfo.meters}m`);
        } else {
          console.log(`  ✅ Nouvelle distance créée: ${distanceInfo.meters}m`);
        }
      }
      
      distanceMap[key] = distance.id;
      if (distanceInfo.meters && !distanceMap[distanceInfo.meters]) {
        distanceMap[distanceInfo.meters] = distance.id;
      }
    }

    // 6. Création des catégories (uniquement les nouvelles)
    console.log("🏷️  Vérification des catégories...");
    const categoryMap = {};
    let newCategoriesCount = 0;
    const newCategories = []; // Pour stocker les détails des nouvelles catégories

    for (const ep of epreuves) {
      const identifiant = ep.identifiant_epreuve;
      const code = ep.code_epreuve;

      if (!identifiant || !code) {
        console.warn(`⚠️  Épreuve sans identifiant ou code:`, ep);
        continue;
      }

      const distanceInfo = extractDistance(ep.libelle_epreuve);
      let codeWithDistance = code;
      let distanceId = null;

      if (distanceInfo) {
        if (distanceInfo.isTimeBased) {
          // Pour les courses basées sur le temps
          const minutes = Math.floor(distanceInfo.durationSeconds / 60);
          const seconds = distanceInfo.durationSeconds % 60;
          if (minutes > 0 && seconds > 0) {
            codeWithDistance = `${code}_${minutes}min${seconds}s`;
          } else if (minutes > 0) {
            codeWithDistance = `${code}_${minutes}min`;
          } else {
            codeWithDistance = `${code}_${distanceInfo.durationSeconds}s`;
          }
        } else if (distanceInfo.isRelay) {
          codeWithDistance = `${code}_${distanceInfo.relayCount}x${distanceInfo.meters}m`;
        } else {
          codeWithDistance = `${code}_${distanceInfo.meters}m`;
        }

        let key;
        if (distanceInfo.isTimeBased) {
          key = `time_${distanceInfo.durationSeconds}`;
        } else if (distanceInfo.isRelay) {
          key = `${distanceInfo.meters}_relay_${distanceInfo.relayCount}`;
        } else {
          key = `${distanceInfo.meters}_normal`;
        }
        distanceId = distanceMap[key] || null;
      }

      // Chercher si la catégorie existe déjà
      let category = await Category.findOne({
        where: { code: codeWithDistance },
      });

      if (!category) {
        const boatSeats = extractBoatSeats(ep.bateau?.code);
        const hasCox = hasCoxswain(ep.bateau?.code);
        const gender = mapGender(ep.sexe);

        category = await Category.create({
          id: uuidv4(),
          code: codeWithDistance,
          label: ep.libelle_epreuve || ep.code_epreuve,
          age_group: ep.categorie?.code || null,
          gender,
          boat_seats: boatSeats,
          has_coxswain: hasCox,
          distance_id: distanceId,
        });
        
        newCategoriesCount++;
        newCategories.push({
          id: category.id,
          code: category.code,
          label: category.label,
          age_group: category.age_group,
          gender: category.gender,
          boat_seats: category.boat_seats,
          has_coxswain: category.has_coxswain,
          distance_id: category.distance_id,
        });
        const distanceLabel = distanceId
          ? distanceInfo.isRelay
            ? ` (${distanceInfo.relayCount}x${distanceInfo.meters}m)`
            : ` (${distanceInfo.meters}m)`
          : "";
        console.log(`  ✅ Nouvelle catégorie créée: ${codeWithDistance} - ${category.label}${distanceLabel}`);
      } else if (!category.distance_id && distanceId) {
        // Mettre à jour la catégorie existante si elle n'a pas de distance_id
        await category.update({ distance_id: distanceId });
        console.log(`  ✅ Distance assignée à la catégorie existante: ${codeWithDistance}`);
      }

      categoryMap[identifiant] = category.id;

      // Lier la catégorie à l'événement (findOrCreate pour éviter les doublons)
      await EventCategory.findOrCreate({
        where: { event_id, category_id: category.id },
        defaults: { id: uuidv4() },
      });
    }

    console.log(`✅ ${newCategoriesCount} nouvelle(s) catégorie(s) créée(s)`);

    // 7. Création des équipages et participants (uniquement les nouveaux)
    console.log("👥 Vérification des équipages et participants...");
    let newCrewCount = 0;
    let newParticipantCount = 0;
    let totalParticipantCount = 0;
    const totalInscriptions = inscriptions.length;
    let processedInscriptions = 0;
    const newCrews = []; // Pour stocker les détails des nouveaux équipages
    const newParticipants = []; // Pour stocker les détails des nouveaux participants

    for (const ins of inscriptions) {
      processedInscriptions++;
      
      if (processedInscriptions % 50 === 0 || processedInscriptions === totalInscriptions) {
        console.log(
          `  📊 Progression: ${processedInscriptions}/${totalInscriptions} inscriptions traitées (${newCrewCount} nouveaux équipages)`
        );
      }

      const identifiantEpreuve = ins.identifiant_epreuve;
      const category_id = categoryMap[identifiantEpreuve];

      if (!category_id) {
        console.warn(
          `⚠️  Catégorie non trouvée pour identifiant_epreuve ${identifiantEpreuve} (code: ${ins.code_epreuve})`
        );
        continue;
      }

      // Extraire le nom du club
      const clubInfo = ins.nom_abrege_club_numero_equipage || "";
      const clubParts = clubInfo.trim().split(/\s+/);
      const lastPart = clubParts[clubParts.length - 1];
      const isNumber = /^\d+$/.test(lastPart);
      const club_name = isNumber ? clubParts.slice(0, -1).join(" ") : clubInfo;
      const club_code = ins.num_club_rameur_1 || ins.club_abrege_rameur_1 || club_name || "";

      // Vérifier si l'équipage existe déjà
      const crewKey = `${category_id}|${club_name || ''}|${club_code || ''}`;
      if (existingCrewKeys.has(crewKey)) {
        // Équipage déjà existant, on passe
        continue;
      }

      // Créer le nouvel équipage
      let crew;
      try {
        crew = await Crew.create({
          id: uuidv4(),
          event_id,
          category_id,
          club_name: club_name || "Non spécifié",
          club_code: club_code,
          status: 8,
        });
        newCrewCount++;
        existingCrewKeys.add(crewKey); // Ajouter à la liste pour éviter les doublons dans cette session
        
        // Récupérer la catégorie pour les détails
        const category = await Category.findByPk(category_id);
        newCrews.push({
          id: crew.id,
          category_id: crew.category_id,
          category_code: category?.code || null,
          category_label: category?.label || null,
          club_name: crew.club_name,
          club_code: crew.club_code,
          status: crew.status,
        });
      } catch (crewError) {
        console.error(
          `❌ Erreur lors de la création de l'équipage pour ${club_name}:`,
          crewError.message
        );
        continue;
      }

      // Créer les participants (rameurs 1 à 8)
      for (let i = 1; i <= 8; i++) {
        const nom = ins[`nom_rameur_${i}`];
        const prenom = ins[`prenom_rameur_${i}`];
        const licenseNumber = ins[`numero_licence_rameur_${i}`];

        if (!nom || !prenom) continue;

        try {
          const participant = await findOrCreateParticipant({
            nom,
            prenom,
            licenseNumber,
            gender: mapGender(ins[`sexe_rameur_${i}`]),
            club_name: ins[`club_abrege_rameur_${i}`] || club_name,
            event_id,
          });

          if (participant.isNewRecord) {
            newParticipantCount++;
            newParticipants.push({
              id: participant.id,
              first_name: participant.first_name,
              last_name: participant.last_name,
              license_number: participant.license_number,
              gender: participant.gender,
              club_name: participant.club_name,
              crew_id: crew.id,
              crew_club: club_name,
              is_coxswain: false,
              seat_position: i,
            });
          }
          totalParticipantCount++;

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
          console.error(
            `❌ Erreur lors de la création du participant ${i} pour l'équipage ${crew.id}:`,
            participantError.message
          );
          continue;
        }
      }

      // Créer le barreur si présent
      if (ins.nom_bareur && ins.prenom_barreur) {
        try {
          const barreur = await findOrCreateParticipant({
            nom: ins.nom_bareur,
            prenom: ins.prenom_barreur,
            licenseNumber: ins.numero_licence_barreur,
            gender: mapGender(ins.sexe_barreur),
            club_name: ins.club_abrege_barreur || club_name,
            event_id,
          });

          if (barreur.isNewRecord) {
            newParticipantCount++;
            newParticipants.push({
              id: barreur.id,
              first_name: barreur.first_name,
              last_name: barreur.last_name,
              license_number: barreur.license_number,
              gender: barreur.gender,
              club_name: barreur.club_name,
              crew_id: crew.id,
              crew_club: club_name,
              is_coxswain: true,
              seat_position: null,
            });
          }
          totalParticipantCount++;

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
        } catch (barreurError) {
          console.error(
            `❌ Erreur lors de la création du barreur pour l'équipage ${crew.id}:`,
            barreurError.message
          );
        }
      }
    }

    console.log(`✅ ${newCrewCount} nouveaux équipages créés`);
    console.log(`✅ ${newParticipantCount} nouveaux participants créés`);
    console.log(`✅ ${totalParticipantCount} participants totaux liés aux nouveaux équipages`);

    return {
      event_id,
      name: event.name,
      new_categories_count: newCategoriesCount,
      new_crews_count: newCrewCount,
      new_participants_count: newParticipantCount,
      total_participants_count: totalParticipantCount,
      new_distances_count: newDistancesCount,
      // Détails complets
      new_categories: newCategories,
      new_distances: newDistances,
      new_crews: newCrews,
      new_participants: newParticipants,
    };
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour:", error);
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