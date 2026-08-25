const Joi = require('joi');

const createDeviceSchema = Joi.object({
  id: Joi.string().optional().allow(''),
  _id: Joi.string().optional().allow(''),
  name: Joi.string().trim().required().min(2).max(255),
  dev_eui: Joi.string().optional().allow(null, ''),
  org_id: Joi.string().optional().allow(null, ''),
  organizationId: Joi.string().optional().allow(null, ''),
  location_id: Joi.string().optional().allow(null, ''),
  locationId: Joi.string().optional().allow(null, ''),
  location: Joi.string().optional().allow(null, ''),
  description: Joi.string().optional().allow(null, ''),
  lat: Joi.number().optional().allow(null, ''),
  lng: Joi.number().optional().allow(null, ''),
  battery: Joi.number().optional().allow(null),
  csq: Joi.number().integer().optional().allow(null),
  ratedLoadKn: Joi.number().optional().allow(null, ''),
  rated_load_kn: Joi.number().optional().allow(null, ''),
  communication_type: Joi.string().valid('HTTP', 'LORAWAN', 'MQTT', 'HYBRID').default('HYBRID'),
  motion_g: Joi.number().default(0.05),
  peak_g: Joi.number().default(0.20),
  rock_peak_g: Joi.number().default(1.50),
  rock_dur_ms: Joi.number().integer().default(200),
  human_peak_max_g: Joi.number().default(1.60),
  human_dur_ms: Joi.number().integer().default(500),
  human_peaks: Joi.number().integer().default(3)
}).unknown(true);

const updateDeviceThresholdSchema = Joi.object({
  motion_g: Joi.number().optional(),
  peak_g: Joi.number().optional(),
  rock_peak_g: Joi.number().optional(),
  rock_dur_ms: Joi.number().integer().optional(),
  human_peak_max_g: Joi.number().optional(),
  human_dur_ms: Joi.number().integer().optional(),
  human_peaks: Joi.number().integer().optional(),
  communication_type: Joi.string().valid('HTTP', 'LORAWAN', 'MQTT', 'HYBRID').optional()
}).unknown(true);

module.exports = {
  createDeviceSchema,
  updateDeviceThresholdSchema
};
