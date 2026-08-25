const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const validate = require('../middleware/validateMiddleware');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { createUserSchema, updateUserSchema } = require('../validators/userValidator');

router.use(authenticate);

router.get('/', authorize('SUPER_ADMIN', 'ORG_ADMIN'), userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN'), validate(createUserSchema), userController.createUser);
router.put('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN'), validate(updateUserSchema), userController.updateUser);
router.delete('/:id', authorize('SUPER_ADMIN'), userController.deleteUser);

module.exports = router;
