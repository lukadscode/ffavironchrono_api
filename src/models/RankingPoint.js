const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const RankingPoint = sequelize.define(
  "RankingPoint",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    club_ranking_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    race_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: "ID de la course (null pour classement général)",
    },
    crew_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: "ID de l'équipage qui a gagné les points",
    },
    place: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Place dans la course (1 = premier, etc.)",
    },
    points: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Points attribués pour cette place",
    },
    points_type: {
      type: DataTypes.ENUM("individuel", "relais"),
      allowNull: false,
      comment: "Type de points (individuel ou relais)",
    },
    participant_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Nombre de participants dans la course (pour déterminer le barème)",
    },
  },
  {
    tableName: "ranking_points",
    timestamps: false,
    underscored: true,
  }
);

module.exports = RankingPoint;



