const { DataTypes } = require("sequelize");
const sequelize = require("./index");

// Modes de capture disponibles côté mobile (liberté organisateur : chaque profil
// choisit lesquels sont proposés au poste de chronométrage).
const CAPTURE_MODES = ["lane_first", "top_first", "free_read", "crew_follow"];

const TimingProfile = sequelize.define(
  "TimingProfile",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: "NULL = modèle générique réutilisable pour tout événement",
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    allowed_capture_modes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: CAPTURE_MODES,
    },
    default_capture_mode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "lane_first",
    },
    requires_lane_selection: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    allow_raw_capture: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    allow_status_shortcuts: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    allow_penalties: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    auto_start_on_first_detection: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    auto_dns_after_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    splits_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "timing_profiles",
    underscored: true,
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

TimingProfile.CAPTURE_MODES = CAPTURE_MODES;

module.exports = TimingProfile;
