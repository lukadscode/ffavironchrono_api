const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const CrewParticipant = sequelize.define(
  "CrewParticipant",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    crew_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    participant_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    is_coxswain: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    coxswain_weight: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    seat_position: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "crew_participants",
    timestamps: false,
    underscored: true,
  }
);

module.exports = CrewParticipant;
