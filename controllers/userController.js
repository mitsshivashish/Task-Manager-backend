const Task = require("../models/Task")
const User = require("../models/User")
const bcrypt = require("bcryptjs")

const getUsers = async (req , res) => {
    try {
        const users = await User.find({role : "member"}).select("-password")

        const usersWithTaskCounts = await Promise.all(users.map(async(user) => {
            const pendingTasks = await Task.countDocuments({assignedTo : user._id , status : "Pending"})
            const inProgressTasks = await Task.countDocuments({assignedTo : user._id , status : "In-Progress"})
            const completedTasks = await Task.countDocuments({assignedTo : user._id , status : "Completed"})

            return {
                ...user._doc,
                pendingTasks,
                inProgressTasks,
                completedTasks
            }
        }))

        res.status(200).json(usersWithTaskCounts)
    } catch (error) {
        res.status(500).json({message : "Server error" , error : error.message})
    }
}
const getUserById = async(req , res) => {
    try{
        const user = await User.findById(req.params.id).select("-password")
        if(!user){
            return res.status(404).json({message : "User not found"})
        }
        res.status(200).json(user)
    }catch (error) {
        res.status(500).json({message : "Server error" , error : error.message})
    }
}
const deleteUser = async (req, res) => {
    try {
        // Only allow admins to delete users (double check)
        if (!req.user || req.user.role !== "admin") {
            return res.status(403).json({ message: "Access Denied, Only Admins can delete users" });
        }

        const userId = req.params.id;

        // Prevent admin from deleting themselves
        if (req.user._id.toString() === userId) {
            return res.status(400).json({ message: "Admins cannot delete themselves" });
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Prevent deleting another admin
        if (user.role === "admin") {
            return res.status(403).json({ message: "Cannot delete another admin" });
        }

        // Remove user from assignedTo and createdBy in all tasks
        await Task.updateMany(
            { assignedTo: userId },
            { $pull: { assignedTo: userId } }
        );
        // Delete the user
        await User.findByIdAndDelete(userId);

        res.status(200).json({
            message: "User deleted successfully",
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profileImageUrl: user.profileImageUrl
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

module.exports = {getUsers , getUserById , deleteUser}
