const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const EnduranceMerTerritorialBonus = sequelize.define(
  "EnduranceMerTerritorialBonus",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    season: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "2026",
    },
    club_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    club_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    points: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 67.5,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "endurance_mer_territorial_bonus",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = EnduranceMerTerritorialBonus;