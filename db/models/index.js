const Organization = require('./Organization');
const Project = require('./Project');
const User = require('./User');
const Location = require('./Location');
const Device = require('./Device');
const Asset = require('./Asset');
const Telemetry = require('./Telemetry');
const AlertRule = require('./AlertRule');
const Alert = require('./Alert');
const NotificationLog = require('./NotificationLog');

// Hierarchy Model Associations:
// SuperAdmin -> Organization -> Project -> Location (Site) -> Asset (Barrier) -> Device (Sensor)

// 1. Organization level
Organization.hasMany(User, { foreignKey: 'org_id', as: 'users' });
User.belongsTo(Organization, { foreignKey: 'org_id', as: 'organization' });

Organization.hasMany(Project, { foreignKey: 'org_id', as: 'projects' });
Project.belongsTo(Organization, { foreignKey: 'org_id', as: 'organization' });

Organization.hasMany(Location, { foreignKey: 'org_id', as: 'locations' });
Location.belongsTo(Organization, { foreignKey: 'org_id', as: 'organization' });

Organization.hasMany(Asset, { foreignKey: 'org_id', as: 'assets' });
Asset.belongsTo(Organization, { foreignKey: 'org_id', as: 'organization' });

Organization.hasMany(Device, { foreignKey: 'org_id', as: 'devices' });
Device.belongsTo(Organization, { foreignKey: 'org_id', as: 'organization' });

// 2. Project level
Project.hasMany(User, { foreignKey: 'project_id', as: 'users' });
User.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Project.hasMany(Location, { foreignKey: 'project_id', as: 'locations' });
Location.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Project.hasMany(Asset, { foreignKey: 'project_id', as: 'assets' });
Asset.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

Project.hasMany(Device, { foreignKey: 'project_id', as: 'devices' });
Device.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });

// 3. Location / Site level
Location.hasMany(User, { foreignKey: 'location_id', as: 'users' });
User.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });

Location.hasMany(Asset, { foreignKey: 'location_id', as: 'assets' });
Asset.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });

Location.hasMany(Device, { foreignKey: 'location_id', as: 'devices' });
Device.belongsTo(Location, { foreignKey: 'location_id', as: 'locationRef' });

// 4. Asset / Barrier level
Asset.hasMany(Device, { foreignKey: 'asset_id', as: 'devices' });
Device.belongsTo(Asset, { foreignKey: 'asset_id', as: 'asset' });

// 5. Alerts, Rules & Telemetry
Organization.hasMany(AlertRule, { foreignKey: 'org_id', as: 'alertRules' });
AlertRule.belongsTo(Organization, { foreignKey: 'org_id', as: 'organization' });

Device.hasMany(Telemetry, { foreignKey: 'device_id', as: 'telemetries' });
Telemetry.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

Device.hasMany(Alert, { foreignKey: 'device_id', as: 'alerts' });
Alert.belongsTo(Device, { foreignKey: 'device_id', as: 'device' });

AlertRule.hasMany(Alert, { foreignKey: 'rule_id', as: 'alerts' });
Alert.belongsTo(AlertRule, { foreignKey: 'rule_id', as: 'rule' });

Alert.hasMany(NotificationLog, { foreignKey: 'alert_id', as: 'notifications' });
NotificationLog.belongsTo(Alert, { foreignKey: 'alert_id', as: 'alert' });

module.exports = {
  Organization,
  Project,
  User,
  Location,
  Device,
  Asset,
  Telemetry,
  AlertRule,
  Alert,
  NotificationLog
};
