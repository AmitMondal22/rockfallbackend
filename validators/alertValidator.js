const Joi = require('joi');

const createAlertRuleSchema = Joi.object({
  name: Joi.string().required().min(2).max(255),
  org_id: Joi.string().optional().allow(null, ''),
  organizationId: Joi.string().optional().allow(null, ''),
  device_id: Joi.string().optional().allow(null, ''),
  deviceId: Joi.string().optional().allow(null, ''),
  device_ids: Joi.array().items(Joi.string().allow('', null)).optional(),
  deviceIds: Joi.array().items(Joi.string().allow('', null)).optional(),
  recipient_emails: Joi.array().items(Joi.string().allow('', null)).optional(),
  recipientEmails: Joi.array().items(Joi.string().allow('', null)).optional(),
  emails: Joi.array().items(Joi.string().allow('', null)).optional(),
  conditions: Joi.array().items(Joi.object()).optional(),
  condition_logic: Joi.string().valid('ALL', 'ANY', 'all', 'any').optional().default('ALL'),
  conditionLogic: Joi.string().valid('ALL', 'ANY', 'all', 'any').optional(),
  actions: Joi.array().items(Joi.string()).optional(),
  event_type: Joi.string().optional().allow(null, '').default('ROCKFALL'),
  eventType: Joi.string().optional().allow(null, ''),
  min_peak_g: Joi.number().optional().default(1.50),
  max_peak_g: Joi.number().optional().allow(null),
  min_dur_ms: Joi.number().integer().optional().default(100),
  severity: Joi.string().valid('INFO', 'WARNING', 'CRITICAL', 'LOW', 'MEDIUM', 'HIGH').default('CRITICAL'),
  enabled: Joi.boolean().optional().default(true),
  isActive: Joi.boolean().optional()
});

module.exports = {
  createAlertRuleSchema
};
