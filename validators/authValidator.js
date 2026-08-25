const Joi = require('joi');

const VALID_ROLES = [
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'PROJECT_ADMIN',
  'PROJECT_USER',
  'LOCATION_USER',
  'SITE_USER',
  'ASSET_USER',
  'USER'
];

const registerSchema = Joi.object({
  name: Joi.string().trim().required().min(2).max(100),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6),
  role: Joi.string().valid(...VALID_ROLES).default('USER'),
  org_id: Joi.string().optional().allow(null, ''),
  organizationId: Joi.string().optional().allow(null, ''),
  project_id: Joi.string().optional().allow(null, ''),
  projectId: Joi.string().optional().allow(null, ''),
  location_id: Joi.string().optional().allow(null, ''),
  locationId: Joi.string().optional().allow(null, '')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().required().min(6)
});

module.exports = {
  VALID_ROLES,
  registerSchema,
  loginSchema,
  changePasswordSchema
};
