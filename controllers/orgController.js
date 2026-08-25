const { Organization, User, Device } = require('../db/models');

const getAllOrganizations = async (req, res, next) => {
  try {
    const orgs = await Organization.findAll({
      include: [
        { model: Device, as: 'devices', attributes: ['id', 'name', 'status'] },
        { model: User, as: 'users', attributes: ['id', 'name', 'email', 'role'] }
      ]
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
    const { id, name, description, address } = req.body;
    const orgId = id || `org_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    const org = await Organization.create({
      id: orgId,
      name,
      description,
      address
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

    const { name, description, address } = req.body;
    if (name) org.name = name;
    if (description !== undefined) org.description = description;
    if (address !== undefined) org.address = address;

    await org.save();
    return res.json({ success: true, message: 'Organization updated', organization: org });
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
  deleteOrganization
};
