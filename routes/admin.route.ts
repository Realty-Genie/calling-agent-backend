import express from 'express';
import { AdminController } from '../controllers/admin.controller';
import { superAdminAuthMiddleware } from '../middlewares/superAdminAuth.middleware';

const router = express.Router();

router.post("/register", AdminController.register);
router.post("/login", AdminController.login);

router.post("/agent", superAdminAuthMiddleware, AdminController.addAgent);
router.post("/assign-agent", superAdminAuthMiddleware, AdminController.assignAgentToUser);
router.get("/users", superAdminAuthMiddleware, AdminController.getUsers);
router.get("/agents", superAdminAuthMiddleware, AdminController.getAgents);
router.post("/update-credits", superAdminAuthMiddleware, AdminController.updateUserCredits);
router.post("/remove-agent", superAdminAuthMiddleware, AdminController.removeAgentFromUser);

export default router;
