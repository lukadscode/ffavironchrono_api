const YAML = require("yamljs");
const path = require("path");

const authDoc = YAML.load(path.join(__dirname, "auth.yaml"));
const eventDoc = YAML.load(path.join(__dirname, "event.yaml"));
const participantDoc = YAML.load(path.join(__dirname, "participant.yaml"));
const categoryDoc = YAML.load(path.join(__dirname, "category.yaml"));
const eventCategoryDoc = YAML.load(path.join(__dirname, "eventCategory.yaml"));
const crewDoc = YAML.load(path.join(__dirname, "crew.yaml"));
const crewParticipantDoc = YAML.load(
  path.join(__dirname, "crewParticipant.yaml")
);
const raceDoc = YAML.load(path.join(__dirname, "race.yaml"));
const racePhaseDoc = YAML.load(path.join(__dirname, "racePhase.yaml"));
const raceCrewDoc = YAML.load(path.join(__dirname, "raceCrew.yaml"));
const distanceDoc = YAML.load(path.join(__dirname, "distance.yaml"));
const timingDoc = YAML.load(path.join(__dirname, "timing.yaml"));
const timingPointDoc = YAML.load(path.join(__dirname, "timingPoint.yaml"));
const timingAssignmentDoc = YAML.load(
  path.join(__dirname, "timingAssignment.yaml")
);
const userDoc = YAML.load(path.join(__dirname, "user.yaml"));
const importDoc = YAML.load(path.join(__dirname, "import.yaml"));
const userEventDoc = YAML.load(path.join(__dirname, "userEvent.yaml"));
const miscDoc = YAML.load(path.join(__dirname, "misc.yaml"));
const rankingDoc = YAML.load(path.join(__dirname, "ranking.yaml"));
const notificationDoc = YAML.load(path.join(__dirname, "notification.yaml"));
const clubDoc = YAML.load(path.join(__dirname, "club.yaml"));
const indoorResultsDoc = YAML.load(path.join(__dirname, "indoorResults.yaml"));

// Fusionner les chemins
const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "AvironApp API",
    version: "1.0.0",
  },
  paths: {
    ...authDoc.paths,
    ...eventDoc.paths,
    ...participantDoc.paths,
    ...categoryDoc.paths,
    ...eventCategoryDoc.paths,
    ...crewDoc.paths,
    ...crewParticipantDoc.paths,
    ...raceDoc.paths,
    ...racePhaseDoc.paths,
    ...raceCrewDoc.paths,
    ...distanceDoc.paths,
    ...timingDoc.paths,
    ...timingPointDoc.paths,
    ...timingAssignmentDoc.paths,
    ...userDoc.paths,
    ...importDoc.paths, // Ajouter les chemins d'importation
    ...userEventDoc.paths, // Ajouter les chemins pour les événements utilisateurs
    ...miscDoc.paths, // Ajouter les chemins pour les routes diverses
    ...rankingDoc.paths, // Ajouter les chemins pour les classements
    ...notificationDoc.paths, // Ajouter les chemins pour les notifications
    ...clubDoc.paths, // Ajouter les chemins pour les clubs
    ...indoorResultsDoc.paths, // Ajouter les chemins pour les résultats indoor
  },
  components: {
    ...authDoc.components,
    ...eventDoc.components,
    ...participantDoc.components,
    ...categoryDoc.components,
    ...eventCategoryDoc.components,
    ...crewDoc.components,
    ...crewParticipantDoc.components,
    ...raceDoc.components,
    ...racePhaseDoc.components,
    ...raceCrewDoc.components,
    ...distanceDoc.components,
    ...timingDoc.components,
    ...timingPointDoc.components,
    ...timingAssignmentDoc.components,
    ...userDoc.components,
    ...importDoc.components, // Ajouter les composants d'importation
    ...userEventDoc.components, // Ajouter les composants pour les événements utilisateurs
    ...miscDoc.components, // Ajouter les composants pour les routes diverses
    ...rankingDoc.components, // Ajouter les composants pour les classements
    ...notificationDoc.components, // Ajouter les composants pour les notifications
    ...clubDoc.components, // Ajouter les composants pour les clubs
    ...indoorResultsDoc.components, // Ajouter les composants pour les résultats indoor
  },
  tags: [
    ...(authDoc.tags || []),
    ...(eventDoc.tags || []),
    ...(participantDoc.tags || []),
    ...(categoryDoc.tags || []),
    ...(eventCategoryDoc.tags || []),
    ...(crewDoc.tags || []),
    ...(crewParticipantDoc.tags || []),
    ...(raceDoc.tags || []),
    ...(racePhaseDoc.tags || []),
    ...(raceCrewDoc.tags || []),
    ...(distanceDoc.tags || []),
    ...(timingDoc.tags || []),
    ...(timingPointDoc.tags || []),
    ...(timingAssignmentDoc.tags || []),
    ...(userDoc.tags || []),
    ...(importDoc.tags || []), // Ajouter les tags d'importation
    ...(userEventDoc.tags || []), // Ajouter les tags pour les événements utilisateurs
    ...(miscDoc.tags || []), // Ajouter les tags pour les routes diverses
    ...(rankingDoc.tags || []), // Ajouter les tags pour les classements
    ...(notificationDoc.tags || []), // Ajouter les tags pour les notifications
    ...(clubDoc.tags || []), // Ajouter les tags pour les clubs
    ...(indoorResultsDoc.tags || []), // Ajouter les tags pour les résultats indoor
  ],
  security: authDoc.security || [],
};

module.exports = swaggerDocument;
