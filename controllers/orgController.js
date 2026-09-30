const fs = require('fs');
const path = require('path');
const { Organization, User, Device } = require('../db/models');

const saveLogoFile = (orgId, rawLogo) => {
  if (!rawLogo || typeof rawLogo !== 'string') return null;
  const trimmed = rawLogo.trim();
  if (!trimmed) return null;

  // If it's already an http(s) URL or relative /uploads path, return as is
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || (trimmed.startsWith('/uploads/') && !trimmed.startsWith('data:'))) {
    return trimmed;
  }

  // Handle data URL (e.g. data:image/png;base64,....)
  const matches = trimmed.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  let ext = 'png';
  let buffer;
  if (matches) {
    ext = matches[1] === 'svg+xml' ? 'svg' : (matches[1] || 'png');
    buffer = Buffer.from(matches[2], 'base64');
  } else if (trimmed.length > 100 && !trimmed.includes(' ')) {
    buffer = Buffer.from(trimmed, 'base64');
  } else {
    return trimmed;
  }

  const uploadDir = path.join(__dirname, '..', 'uploads', 'logos');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const safeOrgId = (orgId || 'org').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `logo_${safeOrgId}_${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/logos/${filename}`;
};

const getAllOrganizations = async (req, res, next) => {
  try {
    const orgs = await Organization.findAll({
      include: [
        { model: Device, as: 'devices', attributes: ['id', 'name', 'status'] },
        { model: User, as: 'users', attributes: ['id', 'name', 'email', 'role'] }
      ],
      order: [['created_at', 'DESC']]
    });
    return res.json({ success: true, count: orgs.length, organizations: orgs });
  } catch (error) {
    next(error);
  }
};

const getOrganizationById = async (req, res, next) => {
  try {
    const org = await Organization.findByPk(req.params.id, {
      include: [
        { model: Device, as: 'devices' },
        { model: User, as: 'users', attributes: { exclude: ['password'] } }
      ]
    });

    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    return res.json({ success: true, organization: org });
  } catch (error) {
    next(error);
  }
};

const createOrganization = async (req, res, next) => {
  try {
    const { id, name, description, address, logo, logo_url } = req.body;
    const orgId = id || `org_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const savedLogo = saveLogoFile(orgId, logo || logo_url);

    const org = await Organization.create({
      id: orgId,
      name,
      description,
      address,
      logo_url: savedLogo
    });

    return res.status(201).json({ success: true, message: 'Organization created', organization: org });
  } catch (error) {
    next(error);
  }
};

const updateOrganization = async (req, res, next) => {
  try {
    const org = await Organization.findByPk(req.params.id);
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    const { name, description, address, logo, logo_url } = req.body;
    if (name) org.name = name;
    if (description !== undefined) org.description = description;
    if (address !== undefined) org.address = address;
    if (logo !== undefined || logo_url !== undefined) {
      const newLogo = saveLogoFile(org.id, logo !== undefined ? logo : logo_url);
      org.logo_url = newLogo;
    }

    await org.save();
    return res.json({ success: true, message: 'Organization updated', organization: org });
  } catch (error) {
    next(error);
  }
};

const uploadOrganizationLogo = async (req, res, next) => {
  try {
    const orgId = req.params.id || req.body.org_id || req.body.id;
    const { logo, logo_url } = req.body;
    const rawLogo = logo || logo_url;

    if (!rawLogo) {
      return res.status(400).json({ success: false, message: 'No logo image data provided.' });
    }

    const savedLogoUrl = saveLogoFile(orgId, rawLogo);

    if (orgId) {
      const org = await Organization.findByPk(orgId);
      if (org) {
        org.logo_url = savedLogoUrl;
        await org.save();
      }
    }

    return res.json({
      success: true,
      message: 'Logo uploaded successfully',
      logo_url: savedLogoUrl
    });
  } catch (error) {
    next(error);
  }
};

const deleteOrganization = async (req, res, next) => {
  try {
    const org = await Organization.findByPk(req.params.id);
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found.' });
    }

    await org.destroy();
    return res.json({ success: true, message: 'Organization deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  uploadOrganizationLogo,
  deleteOrganization
};
