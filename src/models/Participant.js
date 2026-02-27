const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const Participant = sequelize.define(
  "Participant",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    license_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    gender: {
      type: DataTypes.ENUM("Homme", "Femme"),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    club_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    nationality: {
      type: DataTypes.STRING(3),
      allowNull: true,
      comment: "Code pays ISO 3166-1 alpha-3 (ex: FRA, USA, GBR)",
    },
  },
  {
    tableName: "participants",
    timestamps: false,
    underscored: true,
  }
);

module.exports = Participant;
