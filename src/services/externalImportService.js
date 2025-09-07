const axios = require("axios");
const {
  Event,
  Category,
  EventCategory,
  Crew,
  Participant,
  CrewParticipant,
} = require("../models");

exports.importManifestation = async (externalId, bearerToken) => {
  const headers = { Authorization: bearerToken };
  const url = `https://intranet.ffaviron.fr/api/v1/manifestation/${externalId}`;

  const { data } = await axios.get(url, { headers });
  const manifest = data.manifestation;

  // 1. Créer l’événement
  const event = await Event.create({
    name: manifest.libelle,
    location: manifest.adresse.adresse_complete,
    start_date: manifest.date_debut,
    end_date: manifest.date_fin,
    race_type: manifest.type.disciplines[0].discipline_libelle,
    organiser_name: manifest.structure.nom,
    organiser_code: manifest.structure.code,
  });

  const eventId = event.id;

  // 2. Gérer les catégories
  const createdCategories = {};
  for (const epreuve of data.epreuves) {
    const categoryCode = epreuve.code_epreuve;

    let category = await Category.findOne({ where: { code: categoryCode } });

    if (!category) {
      category = await Category.create({
        code: epreuve.code_epreuve,
        label: epreuve.libelle_epreuve,
        age_group: epreuve.categorie.code,
        gender: mapGender(epreuve.sexe),
        boat_seats: extractSeats(epreuve.bateau.code),
        has_coxswain: epreuve.bateau.code.includes("+"),
      });
    }

    createdCategories[categoryCode] = category.id;

    // Lier catégorie à événement
    await EventCategory.findOrCreate({
      where: { event_id: eventId, category_id: category.id },
    });
  }

  // 3. Créer les équipages et participants
  for (const inscription of data.inscriptions) {
    const categoryId = createdCategories[inscription.code_epreuve];

    const crew = await Crew.create({
      event_id: eventId,
      category_id: categoryId,
      club_name: inscription.nom_abrege_club_numero_equipage,
      club_code: inscription.num_club_rameur_1,
    });

    const crewId = crew.id;

    for (let i = 1; i <= 8; i++) {
      const nom = inscription[`nom_rameur_${i}`];
      if (!nom) continue;

      const participantData = {
        first_name: inscription[`prenom_rameur_${i}`],
        last_name: nom,
        license_number: inscription[`numero_licence_rameur_${i}`],
        gender: mapGender(inscription[`sexe_rameur_${i}`]),
        club_name: inscription[`club_abrege_rameur_${i}`],
      };

      const [participant] = await Participant.findOrCreate({
        where: { license_number: participantData.license_number },
        defaults: participantData,
      });

      await CrewParticipant.create({
        crew_id: crewId,
        participant_id: participant.id,
        seat_position: i,
      });
    }

    // Barreur
    if (inscription.nom_bareur) {
      const cox = {
        first_name: inscription.prenom_barreur,
        last_name: inscription.nom_bareur,
        license_number: inscription.numero_licence_barreur,
        gender: mapGender(inscription.sexe_barreur),
        club_name: inscription.club_abrege_barreur,
      };

      const [coxParticipant] = await Participant.findOrCreate({
        where: { license_number: cox.license_number },
        defaults: cox,
      });

      await CrewParticipant.create({
        crew_id: crewId,
        participant_id: coxParticipant.id,
        is_coxswain: true,
      });
    }
  }

  return { message: "Importation réussie", eventId };
};

// Helpers
function extractSeats(code) {
  const match = code.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function mapGender(code) {
  return { H: "Homme", F: "Femme", M: "Mixte" }[code] || "Inconnu";
}
