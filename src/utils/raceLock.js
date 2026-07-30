const Race = require("../models/Race");
const RaceCrew = require("../models/RaceCrew");

async function getRaceForCrew(crewId) {
  const raceCrew = await RaceCrew.findOne({
    where: { crew_id: crewId },
    include: [Race],
    order: [["id", "ASC"]],
  });
  return raceCrew?.Race || null;
}

async function assertCrewRaceMutable(crewId) {
  const race = await getRaceForCrew(crewId);
  if (race?.status === "official") {
    const err = new Error("Course officielle verrouillée");
    err.statusCode = 423;
    throw err;
  }
  return race;
}

async function assertRaceMutable(raceId) {
  const race = await Race.findByPk(raceId);
  if (!race) {
    const err = new Error("Course non trouvée");
    err.statusCode = 404;
    throw err;
  }
  if (race.status === "official") {
    const err = new Error("Course officielle verrouillée");
    err.statusCode = 423;
    throw err;
  }
  return race;
}

module.exports = {
  getRaceForCrew,
  assertCrewRaceMutable,
  assertRaceMutable,
};
