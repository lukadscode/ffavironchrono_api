const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment");

const Event = require("../models/Event");
const Category = require("../models/Category");
const EventCategory = require("../models/EventCategory");
const Crew = require("../models/Crew");
const Participant = require("../models/Participant");
const CrewParticipant = require("../models/CrewParticipant");

const fetchExternalData = require("../utils/fetchExternalData");

module.exports = async (manifestationId, req) => {
  const data = await fetchExternalData(`/manifestation/${manifestationId}`);

  const m = data.manifestation;
  const epreuves = data.epreuves;
  const inscriptions = data.inscriptions;

  // 1. Création de l’événement
  const event = await Event.create({
    id: uuidv4(),
    name: m.libelle,
    location: m.adresse?.adresse_complete,
    start_date: moment(m.date_debut, "DD/MM/YYYY").toDate(),
    end_date: moment(m.date_fin, "DD/MM/YYYY").toDate(),
    race_type: m.type?.disciplines?.[0]?.discipline_libelle,
    organiser_name: m.structure?.nom,
    organiser_code: m.structure?.code,
    created_by: req.user.userId,
  });

  const event_id = event.id;

  // 2. Création des catégories
  const categoryMap = {}; // code_epreuve => category_id

  for (const ep of epreuves) {
    const code = ep.code_epreuve;
    if (!code) continue;

    let category = await Category.findOne({ where: { code } });

    if (!category) {
      const boat_code = ep.bateau.code;
      const boat_seats = parseInt(boat_code.replace(/\D/g, ""));
      const has_cox = boat_code.includes("+");

      const gender =
        ep.sexe === "H" ? "Homme" : ep.sexe === "F" ? "Femme" : "Mixte";

      category = await Category.create({
        id: uuidv4(),
        code,
        label: ep.libelle_epreuve,
        age_group: ep.categorie?.code,
        gender,
        boat_seats,
        has_coxswain: has_cox,
      });
    }

    categoryMap[code] = category.id;

    // Lier à l’événement
    await EventCategory.findOrCreate({
      where: { event_id, category_id: category.id },
      defaults: { id: uuidv4() },
    });
  }

  // 3. Création des crews + participants + affectations
  for (const ins of inscriptions) {
    const catCode = ins.code_epreuve;
    const category_id = categoryMap[catCode];
    if (!category_id) continue;

    const crew = await Crew.create({
      id: uuidv4(),
      event_id,
      category_id,
      club_name: ins.nom_abrege_club_numero_equipage,
      club_code: ins.num_club_rameur_1,
    });

    const crew_id = crew.id;

    for (let i = 1; i <= 8; i++) {
      const nom = ins[`nom_rameur_${i}`];
      const prenom = ins[`prenom_rameur_${i}`];
      if (!nom || !prenom) continue;

      const participant = await Participant.findOrCreate({
        where: { license_number: ins[`numero_licence_rameur_${i}`] },
        defaults: {
          id: uuidv4(),
          first_name: prenom,
          last_name: nom,
          license_number: ins[`numero_licence_rameur_${i}`],
          gender: ins[`sexe_rameur_${i}`],
          club_name: ins[`club_abrege_rameur_${i}`],
        },
      });

      await CrewParticipant.create({
        id: uuidv4(),
        crew_id,
        participant_id: participant[0].id,
        is_coxswain: false,
        seat_position: i,
      });
    }

    // Barreur
    if (ins.nom_bareur && ins.numero_licence_barreur) {
      const barreur = await Participant.findOrCreate({
        where: { license_number: ins.numero_licence_barreur },
        defaults: {
          id: uuidv4(),
          first_name: ins.prenom_barreur,
          last_name: ins.nom_bareur,
          license_number: ins.numero_licence_barreur,
          gender: ins.sexe_barreur,
          club_name: ins.club_abrege_barreur,
        },
      });

      await CrewParticipant.create({
        id: uuidv4(),
        crew_id,
        participant_id: barreur[0].id,
        is_coxswain: true,
        coxswain_weight: null,
      });
    }
  }

  return { event_id, name: event.name };
};
