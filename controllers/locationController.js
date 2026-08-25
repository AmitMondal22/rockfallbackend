const { Location, Device, Organization, Asset, Project } = require('../db/models');

const getAllLocations = async (req, res, next) => {
  try {
    const whereClause = {};
    const orgId = req.query.organizationId || req.query.org_id;
    const projectId = req.query.projectId || req.query.project_id;

    const currentUserRole = req.user?.role;
    if (currentUserRole === 'ORG_ADMIN') {
      whereClause.org_id = req.user.org_id;
    } else if (currentUserRole === 'PROJECT_ADMIN' || currentUserRole === 'PROJECT_USER') {
      whereClause.project_id = req.user.project_id;
    } else if (currentUserRole === 'LOCATION_USER' || currentUserRole === 'SITE_USER') {
      whereClause.id = req.user.location_id;
    } else if (orgId) {
      whereClause.org_id = orgId;
    }

    if (projectId) {
      whereClause.project_id = projectId;
    }

    const locations = await Location.findAll({
      where: whereClause,
      include: [
        {
          model: Asset,
          as: 'assets',
          include: [{ model: Device, as: 'devices' }]
        },
        { model: Device, as: 'devices' },
        { model: Project, as: 'project', attributes: ['id', 'name', 'status'] },
        { model: Organization, as: 'organization', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const formattedLocations = locations.map(loc => {
      const plain = loc.toJSON();
      return {
        ...plain,
        _id: plain.id,
        organizationId: plain.org_id,
        projectId: plain.project_id,
        assetsCount: plain.assets?.length || 0,
        devicesCount: plain.devices?.length || 0,
        isActive: plain.is_active
      };
    });

    return res.json({ success: true, count: formattedLocations.length, locations: formattedLocations });
  } catch (error) {
    next(error);
  }
};

const getLocationById = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id, {
      include: [
        {
          model: Asset,
          as: 'assets',
          include: [{ model: Device, as: 'devices' }]
        },
        { model: Device, as: 'devices' },
        { model: Project, as: 'project' },
        { model: Organization, as: 'organization' }
      ]
    });

    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found.' });
    }

    const plain = location.toJSON();
    const formatted = {
      ...plain,
      _id: plain.id,
      organizationId: plain.org_id,
      projectId: plain.project_id,
      assetsCount: plain.assets?.length || 0,
      devicesCount: plain.devices?.length || 0,
      isActive: plain.is_active
    };

    return res.json({ success: true, location: formatted });
  } catch (error) {
    next(error);
  }
};

const createLocation = async (req, res, next) => {
  try {
    const { id, _id, name, organizationId, org_id, projectId, project_id, description, address, lat, lng, isActive, is_active } = req.body;
    const locId = id || _id || `loc_${Date.now()}`;

    const existing = await Location.findByPk(locId);
    if (existing) {
      return res.status(400).json({ success: false, message: `Location with ID ${locId} already exists.` });
    }

    const location = await Location.create({
      id: locId,
      name,
      org_id: org_id || organizationId || (req.user ? req.user.org_id : 'org_default'),
      project_id: project_id || projectId || 'prj_kuppavalasa',
      description: description || '',
      address: address || '',
      lat: lat !== undefined && lat !== null && lat !== '' ? parseFloat(lat) : null,
      lng: lng !== undefined && lng !== null && lng !== '' ? parseFloat(lng) : null,
      is_active: isActive !== undefined ? isActive : (is_active !== undefined ? is_active : true)
    });

    const plain = location.toJSON();
    return res.status(201).json({
      success: true,
      message: 'Location created successfully',
      location: { ...plain, _id: plain.id, organizationId: plain.org_id, projectId: plain.project_id }
    });
  } catch (error) {
    next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found.' });
    }

    const { name, organizationId, org_id, projectId, project_id, description, address, lat, lng, isActive, is_active } = req.body;

    if (name !== undefined) location.name = name;
    if (organizationId !== undefined || org_id !== undefined) location.org_id = org_id || organizationId;
    if (projectId !== undefined || project_id !== undefined) location.project_id = project_id || projectId;
    if (description !== undefined) location.description = description;
    if (address !== undefined) location.address = address;
    if (lat !== undefined) location.lat = lat !== '' && lat !== null ? parseFloat(lat) : null;
    if (lng !== undefined) location.lng = lng !== '' && lng !== null ? parseFloat(lng) : null;
    if (isActive !== undefined || is_active !== undefined) location.is_active = isActive !== undefined ? isActive : is_active;

    await location.save();

    const plain = location.toJSON();
    return res.json({
      success: true,
      message: 'Location updated successfully',
      location: { ...plain, _id: plain.id, organizationId: plain.org_id, projectId: plain.project_id }
    });
  } catch (error) {
    next(error);
  }
};

const deleteLocation = async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, message: 'Location not found.' });
    }

    await Device.update({ location_id: null }, { where: { location_id: location.id } });
    await Asset.update({ location_id: null }, { where: { location_id: location.id } });
    await location.destroy();

    return res.json({ success: true, message: 'Location deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation
};
