const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const RaceCrew = sequelize.define(
  "RaceCrew",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    race_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    crew_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    lane: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "race_crews",
    timestamps: false,
    underscored: true,
  }
);

module.exports = RaceCrew;
