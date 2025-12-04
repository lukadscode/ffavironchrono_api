const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const Club = sequelize.define(
  "Club",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    nom: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nom_court: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true, // Le code doit être unique
    },
    etat: {
      type: DataTypes.STRING(1), // "A" pour actif, etc.
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING(10), // "CLU", "DEP", "ZON", etc.
      allowNull: true,
    },
    logo_url: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
  },
  {
    tableName: "clubs",
    timestamps: true, // Pour avoir created_at et updated_at
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["code"], // Index unique sur le code
      },
      {
        fields: ["nom_court"], // Index pour recherche par nom_court
      },
      {
        fields: ["type"], // Index pour filtrer par type
      },
    ],
  }
);

module.exports = Club;
