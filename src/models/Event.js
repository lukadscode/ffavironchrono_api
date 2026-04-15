const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const Event = sequelize.define(
  "Event",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    race_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    created_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    website_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    organiser_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    organiser_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    manifestation_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      description: "ID de la manifestation dans l'API FFAviron",
    },
    is_visible: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_finished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    progression_template_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    season: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Saison sportive (ex. 2025-2026) pour classements agrégés indoor",
    },
    indoor_ranking_scope: {
      type: DataTypes.STRING(40),
      allowNull: true,
      comment:
        "standard | championnat_france_indoor | defi_capitaux — pour agrégation saison",
    },
  },
  {
    tableName: "events",
    underscored: true,
    timestamps: false,
  }
);

module.exports = Event;
