const { Project, Organization, Location, Asset, Device, Alert, Telemetry } = require('../db/models');

const getAllProjects = async (req, res, next) => {
  try {
    const whereClause = { is_active: true };
    const currentUserRole = req.user?.role;
    if (currentUserRole === 'ORG_ADMIN') {
      whereClause.org_id = req.user.org_id;
    } else if (currentUserRole === 'PROJECT_ADMIN' || currentUserRole === 'PROJECT_USER') {
      whereClause.id = req.user.project_id;
    }
    if (req.query.org_id) {
      whereClause.org_id = req.query.org_id;
    }

    const projects = await Project.findAll({
      where: whereClause,
      include: [
        { model: Organization, as: 'organization', attributes: ['id', 'name'] },
        { model: Location, as: 'locations', attributes: ['id', 'name', 'lat', 'lng'] },
        { model: Asset, as: 'assets', attributes: ['id', 'name', 'asset_type', 'status'] },
        { model: Device, as: 'devices', attributes: ['id', 'name', 'status', 'battery'] }
      ],
      order: [['created_at', 'DESC']]
    });

    // Compute nested counts for each project
    const formatted = projects.map(p => {
      const pJson = p.toJSON();
      return {
        ...pJson,
        locationsCount: pJson.locations?.length || 0,
        assetsCount: pJson.assets?.length || 0,
        devicesCount: pJson.devices?.length || 0
      };
    });

    return res.json({ success: true, count: formatted.length, projects: formatted });
  } catch (error) {
    next(error);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        { model: Organization, as: 'organization' },
        {
          model: Location,
          as: 'locations',
          include: [
            {
              model: Asset,
              as: 'assets',
              include: [{ model: Device, as: 'devices' }]
            },
            { model: Device, as: 'devices' }
          ]
        },
        {
          model: Asset,
          as: 'assets',
          include: [{ model: Device, as: 'devices' }]
        },
        { model: Device, as: 'devices' }
      ]
    });

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    // Collect all devices attached across project
    const allDevices = project.devices || [];
    const deviceIds = allDevices.map(d => d.id);

    return res.json({
      success: true,
      project,
      summary: {
        locationsCount: project.locations?.length || 0,
        assetsCount: project.assets?.length || 0,
        devicesCount: allDevices.length
      }
    });
  } catch (error) {
    next(error);
  }
};

const createProject = async (req, res, next) => {
  try {
    const { name, org_id, description, status, client_name, start_date, end_date } = req.body;
    const orgId = org_id || req.user.org_id || 'org_default';

    const projectId = `prj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const project = await Project.create({
      id: projectId,
      name,
      org_id: orgId,
      description,
      status: status || 'ACTIVE',
      client_name,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null
    });

    return res.status(201).json({
      success: true,
      message: 'Project created successfully.',
      project
    });
  } catch (error) {
    next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const { name, description, status, client_name, start_date, end_date, org_id } = req.body;
    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (status) project.status = status;
    if (client_name !== undefined) project.client_name = client_name;
    if (start_date) project.start_date = new Date(start_date);
    if (end_date) project.end_date = new Date(end_date);
    if (org_id) project.org_id = org_id;

    await project.save();

    return res.json({
      success: true,
      message: 'Project updated successfully.',
      project
    });
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    project.is_active = false;
    await project.save();

    return res.json({ success: true, message: 'Project archived successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
};
