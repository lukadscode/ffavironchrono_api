const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const Distance = sequelize.define(
  "Distance",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    meters: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "distances",
    timestamps: false,
    underscored: true,
  }
);

module.exports = Distance;
