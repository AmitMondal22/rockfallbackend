const express = require('express');
const router = express.Router();
const orgController = require('../controllers/orgController');
const validate = require('../middleware/validateMiddleware');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { createOrgSchema, updateOrgSchema } = require('../validators/orgValidator');

router.use(authenticate);

router.get('/', orgController.getAllOrganizations);
router.get('/:id', orgController.getOrganizationById);
router.post('/upload-logo', authorize('SUPER_ADMIN', 'ORG_ADMIN'), orgController.uploadOrganizationLogo);
router.post('/:id/logo', authorize('SUPER_ADMIN', 'ORG_ADMIN'), orgController.uploadOrganizationLogo);
router.post('/', authorize('SUPER_ADMIN'), validate(createOrgSchema), orgController.createOrganization);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), validate(updateOrgSchema), orgController.updateOrganization);
router.delete('/:id', authorize('SUPER_ADMIN'), orgController.deleteOrganization);

module.exports = router;
