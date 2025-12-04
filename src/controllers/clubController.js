const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const Club = require("../models/Club");

/**
 * Synchroniser la liste des clubs depuis l'API FFAviron
 * Met à jour les clubs existants et ajoute les nouveaux
 *
 * POST /clubs/sync
 */
exports.syncClubs = async (req, res) => {
  try {
    const url = `https://intranet.ffaviron.fr/api/v1/ou_pratiquer/structures`;
    const headers = {
      Authorization: `Bearer ${process.env.EXTERNAL_API_TOKEN}`,
    };

    console.log("📥 Synchronisation de la liste des clubs depuis l'API FFA...");
    const response = await axios.get(url, {
      headers,
      timeout: 60000, // 60 secondes de timeout
    });

    const allStructures = response.data.data || [];

    // Filtrer uniquement les clubs (type === "CLU")
    const clubsFromAPI = allStructures.filter(
      (structure) => structure.type === "CLU"
    );

    console.log(`📊 ${clubsFromAPI.length} clubs trouvés dans l'API`);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Traiter chaque club
    for (const clubData of clubsFromAPI) {
      // Extraire uniquement les champs demandés
      const clubInfo = {
        nom: clubData.nom,
        nom_court: clubData.nom_court || null,
        code: clubData.code,
        etat: clubData.etat || null,
        type: clubData.type || "CLU",
        logo_url: clubData.logo_url || null,
      };

      // Vérifier si le club existe déjà (par code)
      const [club, created] = await Club.findOrCreate({
        where: { code: clubInfo.code },
        defaults: {
          id: uuidv4(),
          ...clubInfo,
        },
      });

      if (created) {
        createdCount++;
        console.log(
          `  ✅ Nouveau club créé: ${clubInfo.nom} (${clubInfo.code})`
        );
      } else {
        // Mettre à jour les informations si nécessaire
        let hasChanges = false;
        if (club.nom !== clubInfo.nom) {
          club.nom = clubInfo.nom;
          hasChanges = true;
        }
        if (club.nom_court !== clubInfo.nom_court) {
          club.nom_court = clubInfo.nom_court;
          hasChanges = true;
        }
        if (club.etat !== clubInfo.etat) {
          club.etat = clubInfo.etat;
          hasChanges = true;
        }
        if (club.type !== clubInfo.type) {
          club.type = clubInfo.type;
          hasChanges = true;
        }
        if (club.logo_url !== clubInfo.logo_url) {
          club.logo_url = clubInfo.logo_url;
          hasChanges = true;
        }

        if (hasChanges) {
          await club.save();
          updatedCount++;
          console.log(
            `  🔄 Club mis à jour: ${clubInfo.nom} (${clubInfo.code})`
          );
        } else {
          skippedCount++;
        }
      }
    }

    console.log(
      `✅ Synchronisation terminée: ${createdCount} créés, ${updatedCount} mis à jour, ${skippedCount} inchangés`
    );

    res.json({
      status: "success",
      message: "Synchronisation terminée",
      data: {
        total: clubsFromAPI.length,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
      },
    });
  } catch (err) {
    console.error(
      "❌ Erreur lors de la synchronisation des clubs:",
      err.message
    );
    res.status(500).json({
      status: "error",
      message: err.message || "Erreur lors de la synchronisation des clubs",
    });
  }
};

/**
 * Récupérer tous les clubs depuis la base de données
 *
 * GET /clubs
 */
exports.getClubs = async (req, res) => {
  try {
    const { code, nom_court, type } = req.query;

    const whereClause = {};

    // Filtrer par code si fourni
    if (code) {
      whereClause.code = code;
    }

    // Filtrer par nom_court si fourni
    if (nom_court) {
      whereClause.nom_court = nom_court;
    }

    // Filtrer par type si fourni
    if (type) {
      whereClause.type = type;
    }

    const clubs = await Club.findAll({
      where: whereClause,
      order: [["nom", "ASC"]],
    });

    res.json({
      status: "success",
      data: clubs,
      count: clubs.length,
    });
  } catch (err) {
    console.error("❌ Erreur lors de la récupération des clubs:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message || "Erreur lors de la récupération des clubs",
    });
  }
};

/**
 * Récupérer un club par son code
 *
 * GET /clubs/code/:code
 */
exports.getClubByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const club = await Club.findOne({
      where: { code },
    });

    if (!club) {
      return res.status(404).json({
        status: "error",
        message: "Club non trouvé",
      });
    }

    res.json({
      status: "success",
      data: club,
    });
  } catch (err) {
    console.error("❌ Erreur lors de la récupération du club:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message || "Erreur lors de la récupération du club",
    });
  }
};

/**
 * Récupérer un club par son nom_court
 *
 * GET /clubs/nom-court/:nom_court
 */
exports.getClubByNomCourt = async (req, res) => {
  try {
    const { nom_court } = req.params;

    const club = await Club.findOne({
      where: { nom_court },
    });

    if (!club) {
      return res.status(404).json({
        status: "error",
        message: "Club non trouvé",
      });
    }

    res.json({
      status: "success",
      data: club,
    });
  } catch (err) {
    console.error("❌ Erreur lors de la récupération du club:", err.message);
    res.status(500).json({
      status: "error",
      message: err.message || "Erreur lors de la récupération du club",
    });
  }
};
