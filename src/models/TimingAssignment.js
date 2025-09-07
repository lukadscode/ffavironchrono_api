const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const TimingAssignment = sequelize.define(
  "TimingAssignment",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    timing_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    crew_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
  },
  {
    tableName: "timing_assignments",
    timestamps: false,
    underscored: true,
  }
);

module.exports = TimingAssignment;
