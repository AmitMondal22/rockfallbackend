const Joi = require('joi');

const createAlertRuleSchema = Joi.object({
  name: Joi.string().required().min(2).max(255),
  org_id: Joi.string().optional().allow(null, ''),
  device_id: Joi.string().optional().allow(null, ''),
  event_type: Joi.string().default('ROCKFALL'),
  min_peak_g: Joi.number().default(1.50),
  max_peak_g: Joi.number().optional().allow(null),
  min_dur_ms: Joi.number().integer().default(100),
  severity: Joi.string().valid('INFO', 'WARNING', 'CRITICAL').default('CRITICAL'),
  enabled: Joi.boolean().default(true)
});

module.exports = {
  createAlertRuleSchema
};
