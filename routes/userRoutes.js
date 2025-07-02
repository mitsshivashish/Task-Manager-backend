const express = require("express");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const { getUsers, getUserById, deleteUser } = require("../controllers/userController");

const Router = express.Router();

// User Managment Routes
Router.get('/' , protect , adminOnly , getUsers)
Router.get('/:id' , protect , getUserById)
Router.delete('/:id' , protect , adminOnly , deleteUser)

module.exports = Router