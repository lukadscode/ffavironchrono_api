const { DataTypes } = require("sequelize");
const sequelize = require("./index");

const Notification = sequelize.define(
  "Notification",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: "Notification pour un événement spécifique (null = globale)",
    },
    race_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: "Notification pour une course spécifique (null = pour tout l'événement)",
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: "Message de la notification",
    },
    importance: {
      type: DataTypes.ENUM("info", "warning", "error", "success"),
      defaultValue: "info",
      allowNull: false,
      comment: "Niveau d'importance de la notification",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: "Si false, la notification n'est pas affichée",
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date de début d'affichage (null = immédiat)",
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date de fin d'affichage (null = pas d'expiration)",
    },
    created_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: "ID de l'utilisateur qui a créé la notification",
    },
  },
  {
    tableName: "notifications",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["event_id"],
      },
      {
        fields: ["race_id"],
      },
      {
        fields: ["is_active"],
      },
      {
        fields: ["start_date", "end_date"],
      },
    ],
  }
);

module.exports = Notification;

