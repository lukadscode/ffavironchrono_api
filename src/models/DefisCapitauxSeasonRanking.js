const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const DefisCapitauxSeasonRanking = sequelize.define(
  "DefisCapitauxSeasonRanking",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    season: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    imported_rank: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    club_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    club_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    points: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    club_matched: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    source_filename: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    import_batch_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    imported_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    imported_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "defis_capitaux_season_rankings",
    underscored: true,
    timestamps: false,
  }
);

module.exports = DefisCapitauxSeasonRanking;
