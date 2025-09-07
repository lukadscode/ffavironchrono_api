const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const Race = sequelize.define(
  "Race",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    phase_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    race_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lane_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    race_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    distance_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "not_started",
        "non_official",
        "official",
        "in_progress",
        "delayed",
        "cancelled",
        "finished"
      ),
      defaultValue: "not_started",
      allowNull: false,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "races",
    timestamps: false,
    underscored: true,
  }
);

module.exports = Race;
