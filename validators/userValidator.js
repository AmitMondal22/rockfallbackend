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

const createUserSchema = Joi.object({
  name: Joi.string().trim().required().min(2).max(100),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6),
  role: Joi.string().valid(...VALID_ROLES).default('USER'),
  org_id: Joi.string().optional().allow(null, ''),
  organizationId: Joi.string().optional().allow(null, ''),
  project_id: Joi.string().optional().allow(null, ''),
  projectId: Joi.string().optional().allow(null, ''),
  location_id: Joi.string().optional().allow(null, ''),
  locationId: Joi.string().optional().allow(null, ''),
  assigned_assets: Joi.array().items(Joi.string()).optional().allow(null),
  assignedAssets: Joi.array().items(Joi.string()).optional().allow(null),
  phone: Joi.string().optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
  isActive: Joi.boolean().optional()
});

const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  email: Joi.string().email(),
  password: Joi.string().min(6).optional().allow('', null),
  role: Joi.string().valid(...VALID_ROLES),
  org_id: Joi.string().optional().allow(null, ''),
  organizationId: Joi.string().optional().allow(null, ''),
  project_id: Joi.string().optional().allow(null, ''),
  projectId: Joi.string().optional().allow(null, ''),
  location_id: Joi.string().optional().allow(null, ''),
  locationId: Joi.string().optional().allow(null, ''),
  assigned_assets: Joi.array().items(Joi.string()).optional().allow(null),
  assignedAssets: Joi.array().items(Joi.string()).optional().allow(null),
  phone: Joi.string().optional().allow(null, ''),
  is_active: Joi.boolean().optional(),
  isActive: Joi.boolean().optional()
});

module.exports = {
  VALID_ROLES,
  createUserSchema,
  updateUserSchema
};
