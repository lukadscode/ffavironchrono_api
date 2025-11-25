const axios = require("axios");

/**
 * Récupérer la liste des clubs depuis l'API FFA
 * Filtre uniquement les structures de type "CLU" (clubs)
 */
exports.getClubs = async (req, res) => {
  try {
    const url = `https://intranet.ffaviron.fr/api/v1/ou_pratiquer/structures`;
    const headers = {
      Authorization: `Bearer ${process.env.EXTERNAL_API_TOKEN}`,
    };

    console.log("📥 Récupération de la liste des clubs depuis l'API FFA...");
    const response = await axios.get(url, {
      headers,
      timeout: 60000, // 60 secondes de timeout
    });

    const allStructures = response.data.data || [];

    // Filtrer uniquement les clubs (type === "CLU")
    const clubs = allStructures
      .filter((structure) => structure.type === "CLU")
      .map((club) => ({
        nom: club.nom,
        nom_court: club.nom_court,
        code: club.code,
        etat: club.etat,
        type: club.type,
        logo: club.logo,
        logo_url: club.logo_url,
        code_region: club.code_region || null,
        nom_region: club.nom_region || null,
        code_departement: club.code_departement || null,
        nom_departement: club.nom_departement || null,
      }));

    console.log(`✅ ${clubs.length} clubs récupérés`);

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

