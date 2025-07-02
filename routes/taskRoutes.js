const express = require("express");
const { getDashboardData, getUserDashboardData, getTasks, getTaskById, createTask, updateTask, deleteTask, updateTaskStatus, updateTaskCheckList, getTaskCheckpointStats } = require("../controllers/taskController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

const router = express.Router();

//Task Management Routes
router.get("/dashboard-data" , protect , getDashboardData)
router.get("/user-dashboard-data" , protect , getUserDashboardData)
router.get("/" , protect , getTasks) // Admin : All Tasks , Users : assigned Tasks
router.get("/:id" , protect , getTaskById) // Get Task by ID
router.post("/" , protect , adminOnly , createTask) // Admin : Create Task , Users : Can't Create Task
router.put("/:id" , protect , updateTask) // Update Task
router.delete("/:id" , protect , adminOnly , deleteTask) // Admin : Delete Task , Users : Can't Delete Task
router.put("/:id/status" , protect , updateTaskStatus) // Update Task Status
router.put("/:id/todo" , protect , updateTaskCheckList) // Update Task Check List
router.get("/:id/checkpoint-stats", protect, adminOnly, getTaskCheckpointStats); // Get per-user checkpoint completion for a task

module.exports = router;