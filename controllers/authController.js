const User = require('../models/User')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const sendEmail = require('../utils/sendEmail')
const PendingUser = require('../models/PendingUser')

// Generate JWT token 

const generateToken = (userId) => {
    return jwt.sign({id : userId} , process.env.JWT_SECRET , {expiresIn : '7d'})
}

// @desc Register a new user (with OTP verification)
// @route POST /api/v1/auth/register
// @access Public
const RegisterUser = async (req , res) => {
    try {
        const {name , email , password , profileImageUrl , adminInviteToken, organizationCode} = req.body

        // Require profile image
        if (!profileImageUrl) {
            return res.status(400).json({ message: "Profile image is required." });
        }

        // Require organization code
        if (!organizationCode) {
            return res.status(400).json({ message: "Organization code is required." });
        }
        if (!/^[0-9]{14}$/.test(organizationCode)) {
            return res.status(400).json({ message: "Organization code must be exactly 14 digits." });
        }
        if (organizationCode !== process.env.ORG_CODE) {
            return res.status(400).json({ message: "Invalid organization code." });
        }

        // if user already exists in User or PendingUser
        const userExists = await User.findOne({email})
        if (userExists) {
            return res.status(400).json({message : "User already exists"})
        }
        const pendingExists = await PendingUser.findOne({email})
        if (pendingExists) {
            return res.status(400).json({message : "Registration already pending for this email. Please verify OTP."})
        }

        // Check for admin role
        let role = 'member'
        if (adminInviteToken && adminInviteToken == process.env.ADMIN_INVITE_TOKEN){
            role = 'admin'
        }

        // Hash Password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password , salt)

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Store in PendingUser
        await PendingUser.create({
            name,
            email,
            password: hashedPassword,
            profileImageUrl,
            role,
            organizationCode,
            registrationOTP: otp,
            registrationOTPExpires: otpExpires
        });

        // Send OTP email
        const regHtml = `
<div style="background:#f3f0ff;padding:0;margin:0;font-family:sans-serif;">
  <div style="max-width:420px;margin:30px auto;background:#181828;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="padding:32px 32px 0 32px;text-align:center;">
      <img src=\"https://cdn-icons-png.flaticon.com/512/747/747545.png\" alt=\"Verify Email\" style=\"width:70px;margin-bottom:16px;\" />
      <h2 style=\"color:#fff;font-size:1.5rem;margin-bottom:8px;\">Verify Your Email</h2>
    </div>
    <div style=\"background:#23233b;padding:24px 32px;border-radius:12px;margin:24px 24px 0 24px;\">
      <p style=\"color:#fff;font-size:1rem;margin:0 0 12px 0;\">Hi <b>${name}</b> 👋,</p>
      <p style=\"color:#fff;font-size:1rem;margin:0 0 12px 0;\">
        Welcome to Task Manager! Please use the OTP below to verify your email address and complete your registration:
      </p>
      <div style=\"background:#fff;color:#23233b;font-size:2rem;font-weight:bold;letter-spacing:4px;padding:12px 0;border-radius:8px;margin:18px 0;\">
        ${otp}
      </div>
      <p style=\"color:#fff;font-size:1rem;margin:0 0 12px 0;\">
        This OTP is valid for 10 minutes. If you didn't sign up, you can safely ignore this email.
      </p>
    </div>
    <div style=\"padding:24px 32px 32px 32px;text-align:center;\">
      <p style=\"color:#fff;font-size:0.95rem;margin:0;\">Happy to have you on board! 🎉</p>
      <p style=\"color:#fff;font-size:0.95rem;margin:0;\">Task Manager Team</p>
    </div>
  </div>
  <div style=\"text-align:center;margin:18px 0 0 0;\">
    <small style=\"color:#888;\">Task Manager &copy; ${new Date().getFullYear()}</small>
  </div>
</div>
`;
        await sendEmail(
            email,
            'Your OTP for Registration',
            `Your OTP is: ${otp}. It is valid for 10 minutes.`,
            regHtml
        );

        res.status(200).json({ message: 'OTP sent to your email. Please verify to complete registration.' });
    } catch (error) {
        res.status(500).json({message : "server error" , error : error.message})       
    }
}

// @desc Verify Registration OTP
// @route POST /api/v1/auth/verify-registration-otp
// @access Public
const verifyRegistrationOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const pendingUser = await PendingUser.findOne({ email });
        if (!pendingUser) {
            return res.status(400).json({ message: 'No pending registration for this email.' });
        }
        if (pendingUser.registrationOTP !== otp || pendingUser.registrationOTPExpires < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }
        // Move to User collection
        const { name, password, profileImageUrl, role, organizationCode } = pendingUser;
        const user = await User.create({
            name,
            email,
            password,
            profileImageUrl,
            role,
            organizationCode
        });
        // Remove from PendingUser
        await PendingUser.deleteOne({ email });
        // Return user data with JWT
        res.status(201).json({
            id: user._id,
            name: user.name,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
            role: user.role,
            organizationCode: user.organizationCode,
            token: generateToken(user._id)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
}

// @desc Login User
// @route POST /api/v1/auth/login
// @access Public
const loginUser = async (req , res) => {
    try {
        const {email , password} = req.body
        
        const user = await User.findOne({email})
        if (!user) {
            return res.status(401).json({message : "User not found"})
        }

        const isMatch  = await bcrypt.compare(password , user.password)
        if (!isMatch) {
            return res.status(401).json({message : "Invalid User"})
        }

        res.json({
            id : user._id ,
            name : user.name ,
            email : user.email ,
            profileImageUrl : user.profileImageUrl ,
            role : user.role ,
            token : generateToken(user._id)
        })
    } catch (error) {
        res.status(500).json({message : "server error" , error : error.message})       
    }
}

// @desc Get user details
// @route GET /api/v1/auth/user
// @access Private (JWT token)
const getUserDetails = async (req , res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        const user = await User.findById(req.user.id).select("-password")   
        if (!user) {
        return res.status(401).json({message : "User not found"})
        }
        res.status(200).json(user)
    } catch (error) {
        res.status(500).json({message : "server error" , error : error.message})       
    }
}

// @desc Update user details
// @route PUT /api/v1/auth/user
// @access Private (JWT token)
const updateUserDetails = async (req , res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({message : "User not found"})
        }

        // Require profile image
        if (!req.body.profileImageUrl && !user.profileImageUrl) {
            return res.status(400).json({ message: "Profile image is required." });
        }

        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        user.profileImageUrl = req.body.profileImageUrl || user.profileImageUrl;

        if (req.body.password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(req.body.password , salt);
        }

        const updatedUser = await user.save();

        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role : updatedUser.role,
            profileImageUrl : updatedUser.profileImageUrl,
            token : generateToken(user._id)
        })
    } catch (error) {
        res.status(500).json({message : "server error" , error : error.message})       
    }
}

// @desc Forgot Password - send OTP
// @route POST /api/auth/forgot-password
// @access Public
const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordOTP = otp;
        user.resetPasswordOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        await user.save();
        // Send OTP via email (HTML)
        const resetHtml = `
<div style=\"background:#f3f0ff;padding:0;margin:0;font-family:sans-serif;\">
  <div style=\"max-width:420px;margin:30px auto;background:#181828;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);\">
    <div style=\"padding:32px 32px 0 32px;text-align:center;\">
      <img src=\"https://cdn-icons-png.flaticon.com/512/2910/2910791.png\" alt=\"Reset Password\" style=\"width:70px;margin-bottom:16px;\" />
      <h2 style=\"color:#fff;font-size:1.5rem;margin-bottom:8px;\">Reset Your Password</h2>
    </div>
    <div style=\"background:#23233b;padding:24px 32px;border-radius:12px;margin:24px 24px 0 24px;\">
      <p style=\"color:#fff;font-size:1rem;margin:0 0 12px 0;\">Hi <b>${user.name}</b> 👋,</p>
      <p style=\"color:#fff;font-size:1rem;margin:0 0 12px 0;\">
        We received a request to reset your password. Use the OTP below to proceed:
      </p>
      <div style=\"background:#fff;color:#23233b;font-size:2rem;font-weight:bold;letter-spacing:4px;padding:12px 0;border-radius:8px;margin:18px 0;\">
        ${otp}
      </div>
      <p style=\"color:#fff;font-size:1rem;margin:0 0 12px 0;\">
        This OTP is valid for 10 minutes. If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
    <div style=\"padding:24px 32px 32px 32px;text-align:center;\">
      <p style=\"color:#fff;font-size:0.95rem;margin:0;\">Stay secure! 🔒</p>
      <p style=\"color:#fff;font-size:0.95rem;margin:0;\">Task Manager Team</p>
    </div>
  </div>
  <div style=\"text-align:center;margin:18px 0 0 0;\">
    <small style=\"color:#888;\">Task Manager &copy; ${new Date().getFullYear()}</small>
  </div>
</div>
`;
        await sendEmail(
          user.email,
          'Your OTP for Password Reset',
          `Your OTP is: ${otp}. It is valid for 10 minutes.`,
          resetHtml
        );
        res.json({ message: 'OTP sent to your email.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc Verify OTP
// @route POST /api/auth/verify-otp
// @access Public
const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });
        if (!user || !user.resetPasswordOTP || !user.resetPasswordOTPExpires) {
            return res.status(400).json({ message: 'OTP not requested or expired' });
        }
        if (user.resetPasswordOTP !== otp || user.resetPasswordOTPExpires < Date.now()) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }
        // Generate a short-lived reset token (valid for 15 min)
        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
        // Clear OTP fields
        user.resetPasswordOTP = undefined;
        user.resetPasswordOTPExpires = undefined;
        await user.save();
        res.json({ message: 'OTP verified. Use this token to reset password.', resetToken });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc Reset Password
// @route POST /api/auth/reset-password
// @access Public
const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });
        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc Update user role and organization code (for Google users)
// @route POST /api/v1/auth/update-role-org
// @access Private (JWT token)
const updateRoleAndOrg = async (req, res) => {
    try {
        const { adminInviteToken, organizationCode } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Validate organization code
        if (!organizationCode) {
            return res.status(400).json({ message: 'Organization code is required.' });
        }
        if (!/^[0-9]{14}$/.test(organizationCode)) {
            return res.status(400).json({ message: 'Organization code must be exactly 14 digits.' });
        }
        if (organizationCode !== process.env.ORG_CODE) {
            return res.status(400).json({ message: 'Invalid organization code.' });
        }
        user.organizationCode = organizationCode;
        // Validate admin invite token if provided
        if (adminInviteToken) {
            if (adminInviteToken === process.env.ADMIN_INVITE_TOKEN) {
                user.role = 'admin';
            } else {
                return res.status(400).json({ message: 'Invalid admin invite token.' });
            }
        }
        await user.save();
        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            profileImageUrl: user.profileImageUrl,
            role: user.role,
            organizationCode: user.organizationCode,
            token: generateToken(user._id)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {RegisterUser , loginUser , getUserDetails , updateUserDetails, forgotPassword, resetPassword, verifyOTP, verifyRegistrationOTP, updateRoleAndOrg}