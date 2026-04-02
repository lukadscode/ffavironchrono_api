const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const ScoringTemplate = sequelize.define(
  "ScoringTemplate",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("indoor_points", "defis_capitaux", "custom", "endurance_mer"),
      allowNull: false,
    },
    config: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: "Configuration JSON des points (points_indoor, classement_defis_capitaux, endurance_mer, etc.)",
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    tableName: "scoring_templates",
    timestamps: false,
    underscored: true,
  }
);

module.exports = ScoringTemplate;