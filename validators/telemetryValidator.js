const Joi = require('joi');

const lorawanWebhookSchema = Joi.object({
  devEUI: Joi.string().optional(),
  dev_eui: Joi.string().optional(),
  deviceId: Joi.string().optional(),
  device_id: Joi.string().optional(),
  fPort: Joi.number().optional(),
  data: Joi.string().optional(),
  payload: Joi.object().optional(),
  object: Joi.object().optional(),
  rxInfo: Joi.array().optional(),
  txInfo: Joi.object().optional()
}).unknown(true);

const telemetrySchema = Joi.object({
  uid: Joi.string().required(),
  bv: Joi.number().optional(),
  csq: Joi.number().optional(),
  peak_g: Joi.number().optional(),
  dur_ms: Joi.number().optional(),
  peaks: Joi.number().optional(),
  energy_g2: Joi.number().optional(),
  mean_g: Joi.number().optional(),
  type: Joi.string().optional()
});

module.exports = {
  lorawanWebhookSchema,
  telemetrySchema
};
