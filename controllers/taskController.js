const Task = require("../models/Task");
const sendEmail = require('../utils/sendEmail');
const User = require('../models/User');

const getTasks = async (req, res) => {
    try {
        const {status} = req.query;
        let filter = {};

        if (status) {
            filter.status = status;
        }
    
        let tasks;
        if (req.user.role === 'admin') {
            // Admin can see all tasks
            tasks = await Task.find(filter)
                .populate('assignedTo', 'name email profileImageUrl')
                .populate('createdBy', 'name email profileImageUrl');
        } else {
            // Users can only see tasks assigned to them
            tasks = await Task.find({ assignedTo: req.user._id , ...filter })
                .populate('assignedTo', 'name email profileImageUrl')
                .populate('createdBy', 'name email profileImageUrl');
        }

        //Add completed todoCheckList count to each task
        tasks = await Promise.all(
            tasks.map(async (task) => {
                const completedCount = task.todoChecklist.filter(
                    (item) => item.completed
                ).length;
                return { ...task._doc, completedTodoCount : completedCount };
            })
        )

        //Status Summary Count
        const allTasks = await Task.countDocuments(
            req.user.role === 'admin' ? {} : {assignedTo :req.user._id}
        )

        const pendingTasks = await Task.countDocuments({
            ...filter , 
            status : 'Pending',
            ...(req.user.role !== 'admin' ? {assignedTo :req.user._id} : {})
        })

        const inProgressTasks = await Task.countDocuments({
            ...filter , 
            status : 'In-Progress',
            ...(req.user.role !== 'admin' ? {assignedTo :req.user._id} : {})
        })

        const completedTasks = await Task.countDocuments({
            ...filter , 
            status : 'Completed',
            ...(req.user.role !== 'admin' ? {assignedTo :req.user._id} : {})
        })
        
        res.status(200).json({tasks , statusSummary : {
            all : allTasks , pendingTasks , inProgressTasks , completedTasks
        }, });
    } catch (error) {
        res.status(500).json({message : "Server error" , error : error.message})
    }
};

const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('assignedTo', 'name email profileImageUrl')
            .populate('createdBy', 'name email profileImageUrl');
        
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        
        // Check if user has access to this task
        if (req.user.role !== 'admin' && !task.assignedTo.some(user => user._id.toString() === req.user._id.toString())) {
            return res.status(403).json({ message: "Access denied" });
        }
        
        res.status(200).json(task);
    } catch (error) {
        res.status(500).json({message : "Server error" , error : error.message}) 
    }
};

const createTask = async (req, res) => {
    try {
        const { title, description, priority, dueDate, assignedTo, attachments, todoChecklist } = req.body;

        if (!Array.isArray(assignedTo)) {
            return res.status(400).json({message :"assignedTo must be an array of user ids" })
        }
        
        const task = new Task({
            title,
            description,
            priority,
            dueDate,
            assignedTo,
            createdBy: [req.user._id],
            todoChecklist: todoChecklist || [],
            attachments
        });
        
        const savedTask = await task.save();
        const populatedTask = await Task.findById(savedTask._id)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email');

        // Send email to each assigned user
        for (const user of populatedTask.assignedTo) {
            const subject = '🎉 New Task Just Landed On Your Desk!';
            const dashboardUrl = "http://your-app-url.com/user/dashboard"; // Update as needed
            const html = `
<div style=\"background:#f3f0ff;padding:0;margin:0;font-family:sans-serif;\">
  <div style=\"max-width:420px;margin:30px auto;background:#181828;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\">
    <div style=\"padding:32px 32px 0 32px;text-align:center;\">
      <img src=\"https://cdn-icons-png.flaticon.com/512/3135/3135715.png\" alt=\"Task Assigned\" style=\"width:80px;margin-bottom:16px;\" />
      <h2 style=\"color:#fff;font-size:1.5rem;margin-bottom:8px;\">🎉 New Task Assigned!</h2>
    </div>
    <div style=\"background:#23233b;padding:24px 32px;border-radius:12px;margin:24px 24px 0 24px;\">
      <p style=\"color:#fff;font-size:1rem;margin:0 0 12px 0;\">Hi <b>${user.name}</b> 👋,</p>
      <p style=\"color:#fff;font-size:1rem;margin:0 0 12px 0;\">
        You've just been assigned a new task!
      </p>
      <ul style=\"color:#fff;font-size:1rem;padding-left:18px;margin:0 0 12px 0;\">
        <li><b>Task:</b> ${task.title}</li>
        <li><b>Due Date:</b> ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</li>
        <li><b>Priority:</b> ${task.priority}</li>
      </ul>
      <p style=\"color:#fff;font-size:1rem;margin:0 0 18px 0;\">
        Head over to your dashboard to check out the details and get started!
      </p>
      <a href=\"${dashboardUrl}\" style=\"display:inline-block;background:#4f8cff;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:bold;font-size:1rem;margin-bottom:12px;\">Go to Dashboard</a>
    </div>
    <div style=\"padding:24px 32px 32px 32px;text-align:center;\">
      <p style=\"color:#fff;font-size:0.95rem;margin:0 0 8px 0;\">Let's get it done! 🚀</p>
      <p style=\"color:#fff;font-size:0.95rem;margin:0;\">Best,<br/>Task Manager Team</p>
    </div>
  </div>
  <div style=\"text-align:center;margin:18px 0 0 0;\">
    <small style=\"color:#888;\">Task Manager &copy; ${new Date().getFullYear()}</small>
  </div>
</div>
`;
            const text = `Hey ${user.name} 👋,\n\nYou've just been assigned a new task!\n\nTask: ${task.title}\nDue Date: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}\nPriority: ${task.priority}\n\nHead over to your dashboard to check out the details and get started!\n\nLet's get it done! 🚀\n\nBest,\nThe Task Manager Team`;
            sendEmail(user.email, subject, text, html).catch(() => {});
        }
        
        res.status(201).json({message : "Task created successfully" , task : populatedTask});
    } catch (error) {
        res.status(500).json({message : "Server error" , error : error.message})
    }
};

const updateTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        // Save original assignedTo for comparison
        const originalAssignedTo = task.assignedTo.map(id => id.toString());
        // Check if user has permission to update this task
        if (req.user.role !== 'admin' && !task.assignedTo.some(user => user.toString() === req.user._id.toString())) {
            return res.status(403).json({ message: "Access denied" });
        }
        task.title = req.body.title || task.title
        task.description = req.body.description || task.description
        task.priority = req.body.priority || task.priority
        task.dueDate = req.body.dueDate || task.dueDate
        task.todoChecklist = req.body.todoChecklist || task.todoChecklist
        task.attachments = req.body.attachments || task.attachments
        if (req.body.assignedTo) {
            if (!Array.isArray(req.body.assignedTo)) {
                return res.status(400).json({message : "assignedTo must be an array of user ids" })
            }
            // If assignedTo changes, reset all checkpoints
            const assignedToChanged = JSON.stringify(task.assignedTo.map(String).sort()) !== JSON.stringify(req.body.assignedTo.map(String).sort());
            task.assignedTo = req.body.assignedTo
            if (assignedToChanged) {
                task.todoChecklist.forEach(todo => {
                    todo.completed = false;
                    todo.completedBy = null;
                });
            }
        }
        const updatedTask = await task.save();
        // Find newly assigned users
        const newAssignedTo = task.assignedTo.map(id => id.toString());
        const newlyAssignedUserIds = newAssignedTo.filter(id => !originalAssignedTo.includes(id));
        if (newlyAssignedUserIds.length > 0) {
            // Fetch user details for new assignees
            const newUsers = await User.find({ _id: { $in: newlyAssignedUserIds } });
            for (const user of newUsers) {
                const subject = '🎉 New Task Just Landed On Your Desk!';
                const dashboardUrl = "http://your-app-url.com/user/dashboard"; // Update as needed
                const html = `
<div style=\"background:#f3f0ff;padding:0;margin:0;font-family:sans-serif;\">
  <div style=\"max-width:420px;margin:30px auto;background:#181828;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\">
    <div style=\"padding:32px 32px 0 32px;text-align:center;\">
      <img src=\"https://cdn-icons-png.flaticon.com/512/3135/3135715.png\" alt=\"Task Assigned\" style=\"width:80px;margin-bottom:16px;\" />
      <h2 style=\"color:#fff;font-size:1.5rem;margin-bottom:8px;\">🎉 New Task Assigned!</h2>
    </div>
    <div style=\"background:#23233b;padding:24px 32px;border-radius:12px;margin:24px 24px 0 24px;\">
      <p style=\"color:#fff;font-size:1rem;margin:0 0 12px 0;\">Hi <b>${user.name}</b> 👋,</p>
      <p style=\"color:#fff;font-size:1rem;margin:0 0 12px 0;\">
        You've just been assigned a new task!
      </p>
      <ul style=\"color:#fff;font-size:1rem;padding-left:18px;margin:0 0 12px 0;\">
        <li><b>Task:</b> ${task.title}</li>
        <li><b>Due Date:</b> ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</li>
        <li><b>Priority:</b> ${task.priority}</li>
      </ul>
      <p style=\"color:#fff;font-size:1rem;margin:0 0 18px 0;\">
        Head over to your dashboard to check out the details and get started!
      </p>
      <a href=\"${dashboardUrl}\" style=\"display:inline-block;background:#4f8cff;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:bold;font-size:1rem;margin-bottom:12px;\">Go to Dashboard</a>
    </div>
    <div style=\"padding:24px 32px 32px 32px;text-align:center;\">
      <p style=\"color:#fff;font-size:0.95rem;margin:0 0 8px 0;\">Let's get it done! 🚀</p>
      <p style=\"color:#fff;font-size:0.95rem;margin:0;\">Best,<br/>Task Manager Team</p>
    </div>
  </div>
  <div style=\"text-align:center;margin:18px 0 0 0;\">
    <small style=\"color:#888;\">Task Manager &copy; ${new Date().getFullYear()}</small>
  </div>
</div>
`;
                const text = `Hey ${user.name} 👋,\n\nYou've just been assigned a new task!\n\nTask: ${task.title}\nDue Date: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}\nPriority: ${task.priority}\n\nHead over to your dashboard to check out the details and get started!\n\nLet's get it done! 🚀\n\nBest,\nThe Task Manager Team`;
                sendEmail(user.email, subject, text, html).catch(() => {});
            }
        }
        res.status(200).json({message : "Task Updated Successfully" , updatedTask});
    } catch (error) {
        res.status(500).json({message : "Server error" , error : error.message})
    }
};

const deleteTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        
        await Task.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
        res.status(500).json({message : "Server error" , error : error.message})
    }
};

const updateTaskStatus = async (req, res) => {
    try {
        
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        
        // Check if user has permission to update this task
        if (req.user.role !== 'admin' && !task.assignedTo.some(user => user.toString() === req.user._id.toString())) {
            return res.status(403).json({ message: "Access denied" });
        }
        
        task.status = req.body.status || task.status

        if (task.status === "Completed") {
            task.todoChecklist.forEach((item) => (item.completed = true));
            task.progress = 100;
        }

        await task.save();
        res.status(200).json({message : "Task status updated successfully", task});
    } catch (error) {
        res.status(500).json({message : "Server error" , error : error.message})
    }
};

const updateTaskCheckList = async (req, res) => {
    try {
        const { todoChecklist } = req.body;
        
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }
        
        // Check if user has permission to update this task
        if (req.user.role !== 'admin' && !task.assignedTo.some(user => user.toString() === req.user._id.toString())) {
            return res.status(403).json({ message: "Access denied" });
        }
        
        // Enforce per-user checkpoint completion
        for (let i = 0; i < todoChecklist.length; i++) {
            const incoming = todoChecklist[i];
            const existing = task.todoChecklist[i];
            if (!existing) continue;
            // If trying to complete
            if (incoming.completed && !existing.completed) {
                if (!existing.completedBy) {
                    existing.completed = true;
                    existing.completedBy = req.user._id;
                } else if (existing.completedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                    return res.status(403).json({ message: 'This checkpoint is already completed by another member.' });
                }
            }
            // If trying to uncheck
            if (!incoming.completed && existing.completed) {
                if (existing.completedBy && existing.completedBy.toString() === req.user._id.toString()) {
                    existing.completed = false;
                    existing.completedBy = null;
                } else if (req.user.role !== 'admin') {
                    return res.status(403).json({ message: 'You cannot uncheck this checkpoint.' });
                } else {
                    existing.completed = false;
                    existing.completedBy = null;
                }
            }
        }

        //Auto-upgrade progress based on checklist completion
        const completeCount = task.todoChecklist.filter(
            (item) => item.completed
        ).length;
        const totalItems  = task.todoChecklist.length;

        task.progress = totalItems > 0 ? Math.round((completeCount / totalItems) * 100) : 0;

        //Auto-mark test as completed if all checks are passed
        if (task.progress === 100) {
            task.status = "Completed"
        } else if (task.progress > 0) {
            task.status= "In-Progress"
        } else {
            task.status = "Pending"
        }

        await task.save();
        const updatedTask = await Task.findById(req.params.id).populate(
            "assignedTo",
            "name email profileImageUrl"
        )
        
        res.status(200).json({message : "Task checklist updated successfully" , task : updatedTask});
    } catch (error) {
        res.status(500).json({message : "Server error" , error : error.message})
    }
};

const getDashboardData = async (req, res) => {
    try {
        //Fetch statistics
        const totalTasks = await Task.countDocuments();
        const pendingTasks = await Task.countDocuments({ status: 'Pending' });
        const inProgressTasks = await Task.countDocuments({ status: 'In-Progress' });
        const completedTasks = await Task.countDocuments({ status: 'Completed' });
        const overdueTasks = await Task.countDocuments({
            status : {$ne : "Completed"},
            dueDate : {$lt : new Date()},
        })

        //Ensure all Possible statuses are included
        const taskStatuses = ["Pending" , "In-Progress" , "Completed"] 
        
        const taskDistributionRaw = await Task.aggregate([
            {
                $group : {
                    _id : "$status",
                    count : {$sum : 1},
                }
            }
        ]);

        const taskDistribution = taskStatuses.reduce((acc, status) => {
            const formattedKey = status.replace(/[\s-]+/g, ""); //Remove spaces and hyphens for response keys
            acc[formattedKey] = taskDistributionRaw.find((item) =>
                item._id === status)?.count || 0;
            return acc
        } , {})
        taskDistribution["All"] = totalTasks; //add total count to task distribution

        //Ensure all priority levels are included
        const taskPriorities =  ["Low" , "Medium" , "High"];
        const taskPriorityLevelsRaw =  await Task.aggregate([
            {
                $group : {
                    _id : "$priority",
                    count : {$sum : 1},
                },
            },
        ]);

        const taskPriorityLevels = taskPriorities.reduce((acc , priority) => {
            acc[priority] = taskPriorityLevelsRaw.find((item) => item._id === priority)?.count || 0;
            return acc
        } , {});

        //Fetch 10 recent Tasks
        const recentTasks = await Task.find()
        .sort({createdAt : -1 })
        .limit(10)
        .select("title status priority dueDate createdAt");

        res.status(200).json({
            statistics : {
                totalTasks , 
                pendingTasks,
                inProgressTasks,
                completedTasks , 
                overdueTasks,
            },
            charts : {
                taskDistribution,
                taskPriorityLevels,
            },
            recentTasks,
        })


    } catch (error) {
        res.status(500).json({message : "Server error" , error : error.message})
    }
};

const getUserDashboardData = async (req, res) => {
    try {
        const userId = req.user._id; //Fetch data for logged-in user only

        const totalTasks = await Task.countDocuments({ assignedTo: userId });
        const pendingTasks = await Task.countDocuments({ 
            assignedTo: userId, 
            status: 'Pending' 
        });
        const completedTasks = await Task.countDocuments({ 
            assignedTo: userId, 
            status: 'Completed' 
        });
        const overdueTasks = await Task.countDocuments({
            assignedTo : userId , 
            status : {$ne : 'Completed'},
            dueDate : {$lt : new Date() },
        });

        //Task Distribution by status
        const taskStatuses = ["Pending" , "In-Progress" , "Completed"];
        const taskDistributionRaw = await Task.aggregate([
            {$match : {assignedTo : userId}},
            {$group : {_id : "$status" , count : {$sum : 1}}},
        ]);
        
        const taskDistribution = taskStatuses.reduce((acc, status) => {
            const formattedKey = status.replace(/[\s-]+/g, ""); //Remove spaces and hyphens for response keys
            acc[formattedKey] = taskDistributionRaw.find((item) =>
                item._id === status)?.count || 0;
            return acc
        } , {});
        taskDistribution["All"] = totalTasks;

        //Task Distribution by priority
        const taskPriorities =  ["Low" , "Medium" , "High"];
        const taskPriorityLevelsRaw =  await Task.aggregate([
            {$match : {assignedTo : userId}},
            {$group : {_id : "$priority" , count : {$sum : 1}}},
        ]);

        const taskPriorityLevels = taskPriorities.reduce((acc , priority) => {
            acc[priority] = taskPriorityLevelsRaw.find((item) => item._id === priority)?.count || 0;
            return acc
        } , {});

        const recentTasks = await Task.find({ assignedTo: userId })
        .sort({createdAt : -1 })
        .limit(10)
        .select("title status priority dueDate createdAt");

        res.status(200).json({
            statistics : {
                totalTasks , 
                pendingTasks,
                completedTasks , 
                overdueTasks,
            },
            charts : {
                taskDistribution,
                taskPriorityLevels,
            },
            recentTasks,
        });
        
        
    } catch (error) {
        res.status(500).json({message : "Server error" , error : error.message})
    }
};

// Get per-user checkpoint completion for a task
const getTaskCheckpointStats = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id).populate('todoChecklist.completedBy', 'name email profileImageUrl');
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        // Aggregate per-user completion
        const userStats = {};
        task.todoChecklist.forEach((todo) => {
            if (todo.completed && todo.completedBy) {
                const userId = todo.completedBy._id.toString();
                if (!userStats[userId]) {
                    userStats[userId] = {
                        user: todo.completedBy,
                        count: 0,
                        checkpoints: [],
                    };
                }
                userStats[userId].count += 1;
                userStats[userId].checkpoints.push({ text: todo.text });
            }
        });
        res.status(200).json({ stats: Object.values(userStats) });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  updateTaskCheckList,
  getDashboardData,
  getUserDashboardData,
  getTaskCheckpointStats,
};
