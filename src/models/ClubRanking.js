const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const ClubRanking = sequelize.define(
  "ClubRanking",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    club_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    club_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    total_points: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      allowNull: false,
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Rang dans le classement (1 = premier, etc.)",
    },
    ranking_type: {
      type: DataTypes.ENUM("indoor_points", "defis_capitaux", "custom"),
      allowNull: false,
      defaultValue: "indoor_points",
    },
  },
  {
    tableName: "club_rankings",
    timestamps: false,
    underscored: true,
  }
);

module.exports = ClubRanking;


