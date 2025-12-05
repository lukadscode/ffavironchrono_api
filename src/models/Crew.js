const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const Crew = sequelize.define(
  "Crew",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    category_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "registered",
        "dns",
        "dnf",
        "disqualified",
        "changed",
        "withdrawn",
        "scratch"
      ),
      defaultValue: "registered",
      allowNull: false,
    },
    club_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    club_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    coach_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    temps_pronostique: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Temps pronostique en secondes (somme des temps des rameurs)",
    },
  },
  {
    tableName: "crews",
    underscored: true,
    timestamps: false,
  }
);

module.exports = Crew;
