const Joi = require('joi');

const createOrgSchema = Joi.object({
  id: Joi.string().optional(),
  name: Joi.string().trim().required().min(2).max(255),
  description: Joi.string().optional().allow(null, ''),
  address: Joi.string().optional().allow(null, ''),
  location: Joi.string().optional().allow(null, ''),
  contactEmail: Joi.string().optional().allow(null, ''),
  contactPhone: Joi.string().optional().allow(null, ''),
  logo: Joi.string().optional().allow(null, ''),
  logo_url: Joi.string().optional().allow(null, '')
});

const updateOrgSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255),
  description: Joi.string().optional().allow(null, ''),
  address: Joi.string().optional().allow(null, ''),
  location: Joi.string().optional().allow(null, ''),
  contactEmail: Joi.string().optional().allow(null, ''),
  contactPhone: Joi.string().optional().allow(null, ''),
  logo: Joi.string().optional().allow(null, ''),
  logo_url: Joi.string().optional().allow(null, '')
});

module.exports = {
  createOrgSchema,
  updateOrgSchema
};
