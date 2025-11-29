const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const IndoorRaceResult = sequelize.define(
  "IndoorRaceResult",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    race_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      description: "ID de la course dans la plateforme (peut être NULL si course non créée)",
    },
    ergrace_race_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      description: "ID de la course dans ErgRace (UUID)",
    },
    ergrace_version: {
      type: DataTypes.STRING(50),
      allowNull: true,
      description: "Version du logiciel ErgRace",
    },
    race_start_time: {
      type: DataTypes.DATE,
      allowNull: true,
      description: "Heure de début de la course (peut différer de races.start_time)",
    },
    race_end_time: {
      type: DataTypes.DATE,
      allowNull: true,
      description: "Heure de fin de la course",
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      description: "Durée totale en millisecondes",
    },
    time_cap: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      description: "Time cap en millisecondes (0 si pas de limite)",
    },
    race_file_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      description: "Nom du fichier .rac2 source",
    },
    raw_data: {
      type: DataTypes.JSON,
      allowNull: true,
      description: "JSON complet du fichier ErgRace (backup/traçabilité)",
    },
  },
  {
    tableName: "indoor_race_results",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = IndoorRaceResult;

