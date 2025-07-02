const multer = require("multer")

const storage = multer.diskStorage({
    destination : function (req , res , cb) {
        cb(null , 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, `${uniqueSuffix}-${file.originalname}`)
      }
    })


    // file filter
    const fileFilter = (req , file, cb) => {
        const allowedTypes = ["image/jpeg" , "image/png" , "image/jpg"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null , true);
        } else {
            cb (new Error('Only .jpeg , .jpg , .png formats are allowed') , false);
        }
    }
    
 const upload = multer({ storage: storage })

 module.exports = upload

