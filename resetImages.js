const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const resetImages = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');

    // Default avatar URL (you can use any default image)
    const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

    // Find and update users with local image URLs
    const result = await User.updateMany(
      { profileImageUrl: { $regex: /^http:\/\/localhost:5000\/uploads\// } },
      { profileImageUrl: defaultAvatar }
    );

    console.log(`✅ Reset ${result.modifiedCount} users to default avatar`);
    process.exit(0);
  } catch (error) {
    console.error('Reset failed:', error);
    process.exit(1);
  }
};

resetImages(); 