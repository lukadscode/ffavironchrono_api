const { DataTypes } = require("sequelize");
const sequelize = require("./index");

/**
 * Table intermédiaire pour lier Event et Distance
 *
 * Permet de savoir quelles distances sont utilisées dans un événement.
 * Les distances restent liées aux catégories via category.distance_id,
 * mais cette table permet de gérer les distances au niveau de l'événement.
 */
const EventDistance = sequelize.define(
  "EventDistance",
  {
    id: {
      type: DataTypes.STRING(36), // Utiliser STRING au lieu de CHAR pour plus de flexibilité
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.STRING(36), // Utiliser STRING au lieu de CHAR pour correspondre au type de events.id
      allowNull: false,
    },
    distance_id: {
      type: DataTypes.STRING(36), // Utiliser STRING au lieu de CHAR pour correspondre au type de distances.id
      allowNull: false,
    },
  },
  {
    tableName: "event_distances",
    timestamps: false,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["event_id", "distance_id"], // Une distance ne peut être liée qu'une fois à un événement
      },
    ],
  }
);

module.exports = EventDistance;
