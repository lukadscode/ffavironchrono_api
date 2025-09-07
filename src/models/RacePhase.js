const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const RacePhase = sequelize.define(
  "RacePhase",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    order_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "race_phases",
    timestamps: false,
    underscored: true,
  }
);

module.exports = RacePhase;
