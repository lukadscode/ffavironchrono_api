// Import des modèles
const User = require("./User");
const UserSession = require("./UserSession");
const Category = require("./Category");
const Crew = require("./Crew");
const Event = require("./Event");
const EventCategory = require("./EventCategory");
const CrewParticipant = require("./CrewParticipant");
const Participant = require("./Participant");
const Race = require("./Race");
const RacePhase = require("./RacePhase");
const Distance = require("./Distance");
const RaceCrew = require("./RaceCrew");
const TimingPoint = require("./TimingPoint");
const Timing = require("./Timing");
const TimingAssignment = require("./TimingAssignment");
const IndoorRaceResult = require("./IndoorRaceResult");
const IndoorParticipantResult = require("./IndoorParticipantResult");

// Relations User
User.hasMany(UserSession, { foreignKey: "user_id" });
UserSession.belongsTo(User, { foreignKey: "user_id" });

// Relations Category / Crew / Event
Category.hasMany(Crew, { foreignKey: "category_id" });
Crew.belongsTo(Category, { foreignKey: "category_id", as: "category" });

Category.belongsToMany(Event, {
  through: EventCategory,
  foreignKey: "category_id",
});
Event.belongsToMany(Category, {
  through: EventCategory,
  foreignKey: "event_id",
});

Crew.belongsTo(Event, { foreignKey: "event_id" });

// Relations Crew / Participant
Crew.hasMany(CrewParticipant, { foreignKey: "crew_id", as: "crew_participants" });
CrewParticipant.belongsTo(Crew, { foreignKey: "crew_id" });

Participant.hasMany(CrewParticipant, { foreignKey: "participant_id" });
CrewParticipant.belongsTo(Participant, { foreignKey: "participant_id", as: "participant" });

// Relations Race / Phase / Distance
Race.belongsTo(RacePhase, { foreignKey: "phase_id" });
RacePhase.hasMany(Race, { foreignKey: "phase_id" });

Race.belongsTo(Distance, { foreignKey: "distance_id" });
Distance.hasMany(Race, { foreignKey: "distance_id" });

// Relation Category / Distance
Category.belongsTo(Distance, { foreignKey: "distance_id", as: "distance" });
Distance.hasMany(Category, { foreignKey: "distance_id" });

// Relation RacePhase / Event
RacePhase.belongsTo(Event, { foreignKey: "event_id" });
Event.hasMany(RacePhase, { foreignKey: "event_id" });

// Relations Race / RaceCrew / Crew
Race.hasMany(RaceCrew, { foreignKey: "race_id", as: "race_crews" });
RaceCrew.belongsTo(Race, { foreignKey: "race_id" });

Crew.hasMany(RaceCrew, { foreignKey: "crew_id", as: "RaceCrews" });
RaceCrew.belongsTo(Crew, { foreignKey: "crew_id", as: "crew" });

TimingPoint.hasMany(Timing, { foreignKey: "timing_point_id" });
Timing.belongsTo(TimingPoint, { foreignKey: "timing_point_id" });

// Relations TimingAssignment
Timing.hasOne(TimingAssignment, { foreignKey: "timing_id" });
TimingAssignment.belongsTo(Timing, { foreignKey: "timing_id", as: "timing" });

Crew.hasMany(TimingAssignment, { foreignKey: "crew_id" });
TimingAssignment.belongsTo(Crew, { foreignKey: "crew_id" });

const UserEvent = require("./UserEvent");

User.belongsToMany(Event, {
  through: UserEvent,
  foreignKey: "user_id",
  as: "events",
});

Event.belongsToMany(User, {
  through: UserEvent,
  foreignKey: "event_id",
  as: "users",
});

UserEvent.belongsTo(User, { foreignKey: "user_id" });
UserEvent.belongsTo(Event, { foreignKey: "event_id" });
UserEvent.belongsTo(User, { foreignKey: "user_id", as: "user" });
UserEvent.belongsTo(Event, { foreignKey: "event_id", as: "event" });

Event.hasMany(Distance, { foreignKey: "event_id" });
Distance.belongsTo(Event, { foreignKey: "event_id" });

Event.hasMany(TimingPoint, { foreignKey: "event_id", as: "timing_points" });
TimingPoint.belongsTo(Event, { foreignKey: "event_id" });

Category.hasMany(Crew, { foreignKey: "category_id" });

Category.belongsToMany(Event, {
  through: EventCategory,
  foreignKey: "category_id",
});
Event.belongsToMany(Category, {
  through: EventCategory,
  foreignKey: "event_id",
});

// Ajoute ces lignes si tu veux faire des `include` sur EventCategory
EventCategory.belongsTo(Category, { foreignKey: "category_id" });
Category.hasMany(EventCategory, { foreignKey: "category_id" });

EventCategory.belongsTo(Event, { foreignKey: "event_id" });
Event.hasMany(EventCategory, { foreignKey: "event_id" });


Race.hasMany(RaceCrew, { foreignKey: "race_id" });
RaceCrew.belongsTo(Race, { foreignKey: "race_id" });

Race.belongsTo(RacePhase, { foreignKey: "phase_id", as: "race_phase" });
RacePhase.hasMany(Race, { foreignKey: "phase_id" });

RacePhase.belongsTo(Event, { foreignKey: "event_id", as: "event" });
Event.hasMany(RacePhase, { foreignKey: "event_id" });

// Relations pour le système de classement
const ScoringTemplate = require("./ScoringTemplate");
const ClubRanking = require("./ClubRanking");
const RankingPoint = require("./RankingPoint");

Event.hasMany(ClubRanking, { foreignKey: "event_id" });
ClubRanking.belongsTo(Event, { foreignKey: "event_id" });

ClubRanking.hasMany(RankingPoint, { foreignKey: "club_ranking_id", as: "ranking_points" });
RankingPoint.belongsTo(ClubRanking, { foreignKey: "club_ranking_id" });

RankingPoint.belongsTo(Race, { foreignKey: "race_id" });
RankingPoint.belongsTo(Crew, { foreignKey: "crew_id" });

// Relations pour le système de notifications
const Notification = require("./Notification");

Event.hasMany(Notification, { foreignKey: "event_id", as: "notifications" });
Notification.belongsTo(Event, { foreignKey: "event_id", as: "event" });

Race.hasMany(Notification, { foreignKey: "race_id", as: "notifications" });
Notification.belongsTo(Race, { foreignKey: "race_id", as: "race" });

Notification.belongsTo(User, { foreignKey: "created_by", as: "creator" });
User.hasMany(Notification, { foreignKey: "created_by" });

// Relations Indoor Results
const IndoorRaceResult = require("./IndoorRaceResult");
const IndoorParticipantResult = require("./IndoorParticipantResult");

IndoorRaceResult.belongsTo(Race, { foreignKey: "race_id", as: "race" });
Race.hasMany(IndoorRaceResult, { foreignKey: "race_id", as: "indoor_results" });

IndoorParticipantResult.belongsTo(IndoorRaceResult, { 
  foreignKey: "indoor_race_result_id", 
  as: "indoor_race_result" 
});
IndoorRaceResult.hasMany(IndoorParticipantResult, { 
  foreignKey: "indoor_race_result_id", 
  as: "participant_results" 
});

IndoorParticipantResult.belongsTo(Crew, { foreignKey: "crew_id", as: "crew" });
Crew.hasMany(IndoorParticipantResult, { foreignKey: "crew_id", as: "indoor_results" });
