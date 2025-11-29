const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const IndoorParticipantResult = sequelize.define(
  "IndoorParticipantResult",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    indoor_race_result_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      description: "ID du résultat de course indoor",
    },
    crew_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      description: "ID de l'équipage (si identifié). Normalement = ergrace_participant_id si c'est un UUID",
    },
    ergrace_participant_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      description: "ID dans ErgRace (UUID du crew_id ou 'Lane X' si participant non identifié)",
    },
    place: {
      type: DataTypes.INTEGER,
      allowNull: true,
      description: "Classement (1, 2, 3, ...)",
    },
    time_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      description: "Temps en millisecondes (pour tri/calculs)",
    },
    time_display: {
      type: DataTypes.STRING(20),
      allowNull: true,
      description: "Temps formaté '0:24.1'",
    },
    score: {
      type: DataTypes.STRING(20),
      allowNull: true,
      description: "Score formaté (identique à time_display généralement)",
    },
    distance: {
      type: DataTypes.INTEGER,
      allowNull: true,
      description: "Distance parcourue en mètres",
    },
    avg_pace: {
      type: DataTypes.STRING(20),
      allowNull: true,
      description: "Allure moyenne formatée '2:00.5'",
    },
    spm: {
      type: DataTypes.INTEGER,
      allowNull: true,
      description: "Strokes per minute (cadence)",
    },
    calories: {
      type: DataTypes.INTEGER,
      allowNull: true,
      description: "Calories brûlées",
    },
    serial_number: {
      type: DataTypes.BIGINT,
      allowNull: true,
      description: "Numéro de série de la machine ergomètre",
    },
    machine_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      description: "Type de machine : 'row', 'ski', etc.",
    },
    logged_time: {
      type: DataTypes.DATE,
      allowNull: true,
      description: "Heure d'enregistrement dans ErgRace",
    },
    splits_data: {
      type: DataTypes.JSON,
      allowNull: true,
      description: "Splits détaillés (optionnel, peut être NULL pour économiser l'espace)",
    },
  },
  {
    tableName: "indoor_participant_results",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false, // Pas de updated_at car les résultats ne changent pas
  }
);

module.exports = IndoorParticipantResult;

