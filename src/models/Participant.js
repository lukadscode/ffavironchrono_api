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
  },
  {
    tableName: "participants",
    timestamps: false,
    underscored: true,
  }
);

module.exports = Participant;
