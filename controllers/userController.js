const { User, Organization, Project, Location } = require('../db/models');

const getAllUsers = async (req, res, next) => {
  try {
    const whereClause = {};
    const currentUserRole = req.user.role;

    if (currentUserRole === 'ORG_ADMIN') {
      whereClause.org_id = req.user.org_id;
    } else if (currentUserRole === 'PROJECT_ADMIN' || currentUserRole === 'PROJECT_USER') {
      whereClause.project_id = req.user.project_id;
    } else if (currentUserRole === 'LOCATION_USER' || currentUserRole === 'SITE_USER') {
      whereClause.location_id = req.user.location_id;
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      include: [
        { model: Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: Project, as: 'project', attributes: ['id', 'name'] },
        { model: Location, as: 'location', attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });

    const normalizedUsers = users.map(u => {
      const plain = u.toJSON ? u.toJSON() : u;
      return {
        ...plain,
        organizationId: plain.org_id,
        projectId: plain.project_id,
        locationId: plain.location_id,
        organizationName: plain.organization?.name || plain.org_id || 'General',
        projectName: plain.project?.name || plain.project_id || '',
        locationName: plain.location?.name || plain.location_id || ''
      };
    });

    return res.json({ success: true, count: normalizedUsers.length, users: normalizedUsers });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: Project, as: 'project', attributes: ['id', 'name'] },
        { model: Location, as: 'location', attributes: ['id', 'name'] }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const plain = user.toJSON ? user.toJSON() : user;
    return res.json({
      success: true,
      user: {
        ...plain,
        organizationId: plain.org_id,
        projectId: plain.project_id,
        locationId: plain.location_id,
        organizationName: plain.organization?.name || plain.org_id || 'General',
        projectName: plain.project?.name || plain.project_id || '',
        locationName: plain.location?.name || plain.location_id || ''
      }
    });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      org_id,
      organizationId,
      project_id,
      projectId,
      location_id,
      locationId,
      assigned_assets,
      assignedAssets,
      phone
    } = req.body;

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User email already exists.' });
    }

    let effectiveOrgId = organizationId || org_id || req.user.org_id || null;
    if (req.user.role === 'ORG_ADMIN') {
      if (role === 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'Org Admin cannot create Super Admin users.' });
      }
      effectiveOrgId = req.user.org_id;
    }

    const effectiveProjectId = projectId || project_id || (req.user.role === 'PROJECT_ADMIN' ? req.user.project_id : null);
    const effectiveLocationId = locationId || location_id || (['LOCATION_USER', 'SITE_USER'].includes(req.user.role) ? req.user.location_id : null);

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const user = await User.create({
      id: userId,
      name,
      email,
      password,
      role: role || 'USER',
      org_id: effectiveOrgId,
      project_id: effectiveProjectId,
      location_id: effectiveLocationId,
      assigned_assets: assignedAssets || assigned_assets || [],
      phone: phone || null
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.org_id,
        projectId: user.project_id,
        locationId: user.location_id
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (req.user.role === 'ORG_ADMIN' && user.org_id !== req.user.org_id) {
      return res.status(403).json({ success: false, message: 'Access forbidden. You can only update users within your organization.' });
    }

    const {
      name,
      email,
      role,
      org_id,
      organizationId,
      project_id,
      projectId,
      location_id,
      locationId,
      assigned_assets,
      assignedAssets,
      phone,
      is_active,
      isActive,
      password
    } = req.body;

    if (req.user.role === 'ORG_ADMIN' && role === 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Org Admin cannot assign Super Admin role.' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (req.user.role === 'SUPER_ADMIN') {
      if (org_id !== undefined || organizationId !== undefined) {
        user.org_id = org_id !== undefined ? org_id : organizationId;
      }
    }
    if (project_id !== undefined || projectId !== undefined) {
      user.project_id = project_id !== undefined ? project_id : projectId;
    }
    if (location_id !== undefined || locationId !== undefined) {
      user.location_id = location_id !== undefined ? location_id : locationId;
    }
    if (assigned_assets !== undefined || assignedAssets !== undefined) {
      user.assigned_assets = assignedAssets !== undefined ? assignedAssets : assigned_assets;
    }
    if (phone !== undefined) user.phone = phone;
    if (is_active !== undefined || isActive !== undefined) {
      user.is_active = is_active !== undefined ? is_active : isActive;
    }
    if (password && password.trim()) {
      user.password = password.trim();
    }

    await user.save();

    return res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.org_id,
        projectId: user.project_id,
        locationId: user.location_id,
        phone: user.phone,
        isActive: user.is_active
      }
    });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Role safety: Only Super Admin or Org Admin of same org can delete users
    if (req.user.role === 'ORG_ADMIN' && user.org_id !== req.user.org_id) {
      return res.status(403).json({ success: false, message: 'Access forbidden. You can only delete users within your organization.' });
    }
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ORG_ADMIN') {
      return res.status(403).json({ success: false, message: 'Access forbidden. Insufficient permissions to delete users.' });
    }

    await user.destroy();
    return res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
