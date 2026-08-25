const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { sequelize } = require('../config/database');
const {
  Organization,
  Location,
  User,
  Device,
  Asset,
  Telemetry,
  AlertRule,
  Alert,
  NotificationLog
} = require('../db/models');

const BACKUP_DIR = path.resolve(__dirname, '../../../backup mongodeb rockfall collection data');

const parseDate = (val) => {
  if (!val) return new Date();
  if (typeof val === 'string') return new Date(val);
  if (val.$date) return new Date(val.$date);
  if (typeof val === 'number') return new Date(val);
  return new Date();
};

const extractId = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (val.$oid) return val.$oid;
  return String(val);
};

const loadJson = (filename) => {
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] File not found: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  if (!content || content === '[]') return [];
  try {
    return JSON.parse(content);
  } catch (err) {
    console.error(`[ERROR] Failed to parse JSON in ${filename}:`, err.message);
    return [];
  }
};

const mapSeverity = (sev) => {
  if (!sev) return 'CRITICAL';
  const s = String(sev).toUpperCase();
  if (s === 'HIGH' || s === 'CRITICAL' || s === 'FATAL') return 'CRITICAL';
  if (s === 'MEDIUM' || s === 'WARN' || s === 'WARNING') return 'WARNING';
  if (s === 'LOW' || s === 'INFO') return 'INFO';
  return 'CRITICAL';
};

const mapStatus = (status) => {
  if (!status) return 'ACTIVE';
  const s = String(status).toUpperCase();
  if (s === 'ACKNOWLEDGED' || s === 'ACK') return 'ACKNOWLEDGED';
  if (s === 'RESOLVED' || s === 'CLOSED') return 'RESOLVED';
  return 'ACTIVE';
};

const mapDeviceStatus = (status) => {
  if (!status) return 'ONLINE';
  const s = String(status).toUpperCase();
  if (s === 'ONLINE') return 'ONLINE';
  if (s === 'OFFLINE') return 'OFFLINE';
  if (s === 'ALERT' || s === 'TAMPERED') return 'ALERT';
  return 'ONLINE';
};

async function runMigration() {
  console.log('====================================================');
  console.log('🚀 MONGODB BACKUP -> POSTGRESQL FULL MIGRATION');
  console.log(`📁 Backup directory: ${BACKUP_DIR}`);
  console.log('====================================================\n');

  await sequelize.authenticate();
  console.log('✅ Connected to PostgreSQL database.');

  // Sync schema including new columns & tables
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Database schema synchronized ({ alter: true }).');
  } catch (syncErr) {
    console.warn('⚠️ Schema alter warning, using basic sync:', syncErr.message);
    await sequelize.sync();
  }

  // 1. Migrate Organizations
  console.log('\n--- 1. Migrating Organizations ---');
  const orgDocs = loadJson('rockfall_platform.organizations.json');
  console.log(`Found ${orgDocs.length} organization records.`);

  const validOrgIds = new Set();
  for (const doc of orgDocs) {
    const id = extractId(doc._id) || '123';
    validOrgIds.add(id);
    const existing = await Organization.findByPk(id);
    const orgData = {
      id,
      name: doc.name || 'Default Organization',
      description: doc.location || doc.description || '',
      address: doc.address || '',
      created_at: parseDate(doc.createdAt),
      updated_at: parseDate(doc.updatedAt)
    };
    if (existing) {
      await existing.update(orgData);
      console.log(`  Updated organization: ${id} (${orgData.name})`);
    } else {
      await Organization.create(orgData);
      console.log(`  Created organization: ${id} (${orgData.name})`);
    }
  }

  // 2. Migrate Locations
  console.log('\n--- 2. Migrating Locations ---');
  const locationDocs = loadJson('rockfall_platform.locations.json');
  console.log(`Found ${locationDocs.length} location records.`);

  const locationMap = new Map();
  for (const doc of locationDocs) {
    const id = extractId(doc._id) || '1';
    const orgId = extractId(doc.organizationId);
    const resolvedOrgId = (orgId && validOrgIds.has(orgId)) ? orgId : null;

    const locData = {
      id,
      name: doc.name || 'Location',
      org_id: resolvedOrgId,
      description: doc.description || '',
      address: doc.address || '',
      lat: doc.lat !== undefined && doc.lat !== null ? parseFloat(doc.lat) : null,
      lng: doc.lng !== undefined && doc.lng !== null ? parseFloat(doc.lng) : null,
      is_active: doc.isActive !== false,
      created_at: parseDate(doc.createdAt),
      updated_at: parseDate(doc.updatedAt)
    };

    locationMap.set(id, locData);

    const existing = await Location.findByPk(id);
    if (existing) {
      await existing.update(locData);
      console.log(`  Updated location: ${id} - ${locData.name} (${locData.lat}, ${locData.lng})`);
    } else {
      await Location.create(locData);
      console.log(`  Created location: ${id} - ${locData.name} (${locData.lat}, ${locData.lng})`);
    }
  }

  // 3. Migrate Users
  console.log('\n--- 3. Migrating Users ---');
  const userDocs = loadJson('rockfall_platform.users.json');
  console.log(`Found ${userDocs.length} user records.`);

  for (const doc of userDocs) {
    const id = extractId(doc._id) || `user_${Date.now()}`;
    const email = doc.email;
    const orgId = extractId(doc.organizationId);
    const resolvedOrgId = (orgId && validOrgIds.has(orgId)) ? orgId : null;

    const existingByEmail = await User.findOne({ where: { email } });
    const existingById = await User.findByPk(id);
    const existing = existingByEmail || existingById;

    const userData = {
      id: existing ? existing.id : id,
      name: doc.name || 'User',
      email,
      password: doc.passwordHash || doc.password || '$2a$12$G4eGT7TxzEQBlVFYljkblOig21Cm1CFZidAEb290xsPhCJgrqg0KS',
      role: doc.role === 'SUPER_ADMIN' || doc.role === 'ORG_ADMIN' ? doc.role : 'USER',
      org_id: resolvedOrgId,
      created_at: parseDate(doc.createdAt),
      updated_at: parseDate(doc.updatedAt)
    };

    if (existing) {
      await existing.update(userData);
      console.log(`  Updated user: ${userData.email} (Role: ${userData.role})`);
    } else {
      await User.create(userData);
      console.log(`  Created user: ${userData.email} (Role: ${userData.role})`);
    }
  }

  // 4. Migrate Devices
  console.log('\n--- 4. Migrating Devices with Lat/Lng & Location Metadata ---');
  const deviceDocs = loadJson('rockfall_platform.devices.json');
  console.log(`Found ${deviceDocs.length} device records in devices.json.`);

  const validDeviceIds = new Set();

  for (const doc of deviceDocs) {
    const id = extractId(doc._id);
    if (!id) continue;
    validDeviceIds.add(id);

    const orgId = extractId(doc.organizationId);
    const resolvedOrgId = (orgId && validOrgIds.has(orgId)) ? orgId : null;
    const locId = extractId(doc.locationId);
    const locDoc = locationMap.get(locId);
    const locationName = locDoc ? locDoc.name : (doc.location || (doc.lat && doc.lng ? `${doc.lat}, ${doc.lng}` : ''));

    const threshold = doc.thresholdConfig || {};

    const latVal = doc.lat !== undefined && doc.lat !== null ? parseFloat(doc.lat) : (locDoc ? locDoc.lat : null);
    const lngVal = doc.lng !== undefined && doc.lng !== null ? parseFloat(doc.lng) : (locDoc ? locDoc.lng : null);

    const deviceData = {
      id,
      name: doc.name || id,
      dev_eui: doc.dev_eui || doc.devEui || null,
      org_id: resolvedOrgId,
      location_id: locId || null,
      location: locationName,
      description: doc.description || '',
      lat: latVal,
      lng: lngVal,
      status: mapDeviceStatus(doc.status),
      battery: doc.battery !== undefined && doc.battery !== null ? parseFloat(doc.battery) : null,
      csq: doc.csq !== undefined && doc.csq !== null ? parseInt(doc.csq) : null,
      motion_g: parseFloat(threshold.MOTION_G ?? 0.05),
      peak_g: parseFloat(threshold.PEAK_G ?? 0.20),
      rock_peak_g: parseFloat(threshold.ROCK_PEAK_G ?? 1.50),
      rock_dur_ms: parseInt(threshold.ROCK_DUR_MS ?? 200),
      human_peak_max_g: parseFloat(threshold.HUMAN_PEAK_MAX_G ?? 1.60),
      human_dur_ms: parseInt(threshold.HUMAN_DUR_MS ?? 500),
      human_peaks: parseInt(threshold.HUMAN_PEAKS ?? 3),
      threshold_version: parseInt(doc.thresholdVersion ?? 1),
      communication_type: 'HYBRID',
      is_active: doc.isActive !== false,
      last_seen: doc.lastSeen ? parseDate(doc.lastSeen) : null,
      last_event: doc.lastEvent || null,
      last_restart_at: doc.lastRestartAt ? parseDate(doc.lastRestartAt) : null,
      created_at: parseDate(doc.createdAt),
      updated_at: parseDate(doc.updatedAt)
    };

    const existing = await Device.findByPk(id);
    if (existing) {
      await existing.update(deviceData);
      console.log(`  Updated device: ${id} | Lat: ${deviceData.lat}, Lng: ${deviceData.lng} | Location: ${deviceData.location}`);
    } else {
      await Device.create(deviceData);
      console.log(`  Created device: ${id} | Lat: ${deviceData.lat}, Lng: ${deviceData.lng} | Location: ${deviceData.location}`);
    }
  }

  // Also check if telemetry has additional device IDs not in devices.json
  const eventDocs = loadJson('rockfall_platform.deviceevents.json');
  console.log(`\nFound ${eventDocs.length} telemetry / device event records.`);

  for (const ev of eventDocs) {
    const dId = ev.uid || ev.deviceId || ev.device_id;
    if (dId && !validDeviceIds.has(dId)) {
      const orgId = extractId(ev.org_id || ev.organizationId);
      const resolvedOrgId = (orgId && validOrgIds.has(orgId)) ? orgId : null;
      validDeviceIds.add(dId);
      const existing = await Device.findByPk(dId);
      if (!existing) {
        await Device.create({
          id: dId,
          name: dId,
          org_id: resolvedOrgId,
          status: 'ONLINE',
          communication_type: 'HYBRID'
        });
        console.log(`  Auto-created missing device reference: ${dId}`);
      }
    }
  }

  // 5. Migrate Alert Rules
  console.log('\n--- 5. Migrating Alert Rules ---');
  const ruleDocs = loadJson('rockfall_platform.alertrules.json');
  console.log(`Found ${ruleDocs.length} alert rule records.`);
  const validRuleIds = new Set();

  for (let i = 0; i < ruleDocs.length; i++) {
    const doc = ruleDocs[i];
    const id = extractId(doc._id) || `rule_${i + 1}`;
    validRuleIds.add(id);
    const orgId = extractId(doc.organizationId || doc.org_id);
    const resolvedOrgId = (orgId && validOrgIds.has(orgId)) ? orgId : null;
    const deviceId = doc.deviceId || doc.device_id;
    const resolvedDeviceId = (deviceId && validDeviceIds.has(deviceId)) ? deviceId : null;

    const ruleData = {
      id,
      name: doc.name || doc.ruleName || `Rule ${i + 1}`,
      org_id: resolvedOrgId,
      device_id: resolvedDeviceId,
      event_type: doc.eventType || doc.event_type || 'ROCKFALL',
      min_peak_g: parseFloat(doc.min_peak_g || doc.minPeakG || 1.50),
      max_peak_g: doc.max_peak_g ? parseFloat(doc.max_peak_g) : null,
      min_dur_ms: parseInt(doc.min_dur_ms || doc.minDurMs || 100),
      severity: mapSeverity(doc.severity),
      enabled: doc.enabled !== false,
      created_at: parseDate(doc.createdAt),
      updated_at: parseDate(doc.updatedAt)
    };

    const existing = await AlertRule.findByPk(id);
    if (existing) {
      await existing.update(ruleData);
    } else {
      await AlertRule.create(ruleData);
    }
  }

  // 6. Migrate Alerts / Alert Logs
  console.log('\n--- 6. Migrating Alerts ---');
  const alertDocs = loadJson('rockfall_platform.alertlogs.json');
  console.log(`Found ${alertDocs.length} alert records.`);

  const validAlertIds = new Set();
  let alertCount = 0;

  for (let i = 0; i < alertDocs.length; i++) {
    const doc = alertDocs[i];
    const id = extractId(doc._id) || `alert_${i + 1}`;
    validAlertIds.add(id);

    const deviceId = doc.deviceId || doc.device_id || doc.uid;
    if (deviceId && !validDeviceIds.has(deviceId)) {
      validDeviceIds.add(deviceId);
      await Device.findOrCreate({
        where: { id: deviceId },
        defaults: { id: deviceId, name: deviceId, status: 'ONLINE', communication_type: 'HYBRID' }
      });
    }

    const orgId = extractId(doc.organizationId || doc.org_id);
    const resolvedOrgId = (orgId && validOrgIds.has(orgId)) ? orgId : null;
    const ruleId = extractId(doc.ruleId);
    const resolvedRuleId = (ruleId && validRuleIds.has(ruleId)) ? ruleId : null;

    const alertData = {
      id,
      rule_id: resolvedRuleId,
      device_id: deviceId || 'UNKNOWN',
      org_id: resolvedOrgId,
      severity: mapSeverity(doc.severity),
      event_type: doc.eventType || doc.event_type || 'ROCKFALL',
      message: doc.message || 'Rockfall Alert',
      trigger_data: doc.triggerData || doc.trigger_data || {},
      status: mapStatus(doc.status),
      created_at: parseDate(doc.createdAt),
      updated_at: parseDate(doc.updatedAt)
    };

    const existing = await Alert.findByPk(id);
    if (existing) {
      await existing.update(alertData);
    } else {
      await Alert.create(alertData);
    }
    alertCount++;
  }
  console.log(`  Processed ${alertCount} alerts.`);

  // 7. Migrate Telemetry in batches
  console.log('\n--- 7. Migrating Telemetry Events ---');
  console.log(`Processing ${eventDocs.length} telemetry records...`);

  // Clear existing telemetry to avoid duplicates on re-run
  await Telemetry.destroy({ where: {}, truncate: { cascade: true } }).catch(() => {});

  const BATCH_SIZE = 200;
  let telemetryInsertedCount = 0;

  for (let i = 0; i < eventDocs.length; i += BATCH_SIZE) {
    const batch = eventDocs.slice(i, i + BATCH_SIZE);
    const telemetryBatch = batch.map((ev) => {
      const dId = ev.uid || ev.deviceId || ev.device_id || 'UNKNOWN';
      return {
        device_id: dId,
        uid: dId,
        battery: typeof ev.battery === 'number' ? ev.battery : (parseFloat(ev.battery) || null),
        csq: typeof ev.csq === 'number' ? ev.csq : (parseInt(ev.csq) || null),
        event_type: ev.event_type || ev.eventType || 'ROCKFALL',
        peak_g: parseFloat(ev.peak_g ?? ev.peakG ?? 0),
        duration_ms: parseInt(ev.duration_ms ?? ev.durationMs ?? 0),
        peaks: parseInt(ev.peaks ?? 0),
        energy_g2: parseFloat(ev.energy_g2 ?? ev.energyG2 ?? 0),
        mean_g: parseFloat(ev.mean_g ?? ev.meanG ?? 0),
        raw_payload: ev.raw_payload || ev.rawPayload || { processedAt: ev.processedAt },
        source: 'HTTP',
        timestamp: parseDate(ev.ts || ev.timestamp || ev.createdAt),
        created_at: parseDate(ev.createdAt || ev.ts),
        updated_at: parseDate(ev.updatedAt || ev.ts || ev.createdAt)
      };
    });

    await Telemetry.bulkCreate(telemetryBatch);
    telemetryInsertedCount += telemetryBatch.length;
    process.stdout.write(`  Progress: ${telemetryInsertedCount}/${eventDocs.length} records...\r`);
  }

  console.log(`\n  ✅ Successfully inserted ${telemetryInsertedCount} telemetry records.`);

  // 8. Final Counts Verification
  console.log('\n====================================================');
  console.log('📊 MIGRATION COMPLETE - FINAL POSTGRESQL COUNTS:');
  console.log('====================================================');
  console.log(`  Organizations:     ${await Organization.count()}`);
  console.log(`  Locations:         ${await Location.count()}`);
  console.log(`  Users:             ${await User.count()}`);
  console.log(`  Devices:           ${await Device.count()}`);
  console.log(`  Telemetry Events:  ${await Telemetry.count()}`);
  console.log(`  Alert Rules:       ${await AlertRule.count()}`);
  console.log(`  Alerts:            ${await Alert.count()}`);
  console.log(`  Notification Logs: ${await NotificationLog.count()}`);
  console.log('====================================================\n');

  // Verify device lat/lng display
  const devices = await Device.findAll();
  console.log('📍 Migrated Devices Coordinate Check:');
  devices.forEach((d) => {
    console.log(`  - ${d.id}: Name="${d.name}", Lat=${d.lat}, Lng=${d.lng}, Location="${d.location}", LocationId="${d.location_id}", Battery=${d.battery}V, CSQ=${d.csq}`);
  });
}

runMigration()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  });
