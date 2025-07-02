const express = require('express');
const { RegisterUser, loginUser, getUserDetails, updateUserDetails, forgotPassword, resetPassword, verifyOTP, verifyRegistrationOTP, updateRoleAndOrg } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const passport = require('passport');
const Router = express.Router();
const cloudinary = require('../utils/cloudinary');

//Auth Routes
Router.post('/register' , RegisterUser)
Router.post('/login' , loginUser)
Router.get('/profile' ,protect, getUserDetails)
Router.put('/profile' ,protect, updateUserDetails)

Router.post("/upload-image" , upload.single("image") , async (req , res) => {
    try {
        if (!req.file) {
            return res.status(400).json({message : "No File Uploaded"})
        }

        console.log('File uploaded to:', req.file.path);

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'task-manager-profiles',
            width: 300,
            crop: "scale"
        });

        // console.log('Cloudinary upload successful:', result.secure_url);

        // Delete local file after upload
        const fs = require('fs');
        try {
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
                // console.log('Local file deleted:', req.file.path);
            }
        } catch (deleteError) {
            console.error('Error deleting local file:', deleteError);
            // Continue anyway, the file will be cleaned up later
        }

        res.status(200).json({imageUrl: result.secure_url})
    } catch (error) {
        console.error('Upload error:', error);
        
        // Try to delete local file if it exists
        if (req.file && req.file.path) {
            const fs = require('fs');
            try {
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
            } catch (deleteError) {
                console.error('Error deleting local file after error:', deleteError);
            }
        }
        
        res.status(500).json({message: "Error uploading image", error: error.message})
    }
})

// Password Reset Routes
Router.post('/forgot-password', forgotPassword);
Router.post('/verify-otp', verifyOTP);
Router.post('/reset-password', resetPassword);

// Registration OTP verification
Router.post('/verify-registration-otp', verifyRegistrationOTP);

// Google OAuth Routes
Router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

Router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/login' }), (req, res) => {
    const user = req.user;
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    // Redirect to frontend with user info and token as query params
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/google-auth?token=${token}` +
        `&name=${encodeURIComponent(user.name)}` +
        `&email=${encodeURIComponent(user.email)}` +
        `&profileImageUrl=${encodeURIComponent(user.profileImageUrl)}` +
        `&role=${user.role}` +
        `&organizationCode=${user.organizationCode}`;
    res.redirect(redirectUrl);
});

// Update role and organization code for Google users
Router.post('/update-role-org', protect, updateRoleAndOrg);

module.exports = Router