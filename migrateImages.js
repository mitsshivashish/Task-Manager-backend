require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('./utils/cloudinary');
const User = require('./models/User');

const migrateImages = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');

    // Debug Cloudinary config
    console.log('Cloudinary config check:');
    console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
    console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET');
    console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET');

    // Find users with local image URLs
    const users = await User.find({
      profileImageUrl: { $regex: /^http:\/\/localhost:5000\/uploads\// }
    });

    console.log(`Found ${users.length} users with local images to migrate`);

    // Default avatar for users with missing files
    const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';

    for (const user of users) {
      try {
        console.log(`Processing user: ${user.name}`);
        
        // Extract filename from local URL
        const filename = user.profileImageUrl.split('/uploads/')[1];
        const localPath = `./uploads/${filename}`;

        // Check if local file exists
        const fs = require('fs');
        if (fs.existsSync(localPath)) {
          console.log(`Found local file: ${localPath}`);
          
          // Upload to Cloudinary
          const result = await cloudinary.uploader.upload(localPath, {
            folder: 'task-manager-profiles',
            width: 300,
            crop: "scale"
          });

          // Update user with Cloudinary URL using direct update
          await User.updateOne(
            { _id: user._id },
            { profileImageUrl: result.secure_url }
          );

          console.log(`✅ Migrated image for user: ${user.name}`);
        } else {
          console.log(`Local file not found: ${localPath}`);
          // File doesn't exist, set default avatar using direct update
          await User.updateOne(
            { _id: user._id },
            { profileImageUrl: defaultAvatar }
          );
          console.log(`⚠️  Local file not found for user: ${user.name} - Set to default avatar`);
        }
      } catch (error) {
        console.error(`❌ Error migrating image for user ${user.name}:`, error.message);
        
        // If Cloudinary fails, set default avatar using direct update
        try {
          await User.updateOne(
            { _id: user._id },
            { profileImageUrl: defaultAvatar }
          );
          console.log(`⚠️  Set default avatar for user: ${user.name} due to error`);
        } catch (updateError) {
          console.error(`❌ Failed to update user ${user.name}:`, updateError.message);
        }
      }
    }

    console.log('Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateImages(); 