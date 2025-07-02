const mongoose = require('mongoose');

const PendingUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profileImageUrl: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    organizationCode: { type: String, required: true },
    registrationOTP: { type: String, required: true },
    registrationOTPExpires: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PendingUser', PendingUserSchema); 