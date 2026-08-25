const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN'), projectController.createProject);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), projectController.updateProject);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), projectController.deleteProject);

module.exports = router;
