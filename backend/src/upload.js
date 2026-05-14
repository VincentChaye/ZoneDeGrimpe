import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "zonedegrimpe/spots",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1920, height: 1080, crop: "limit", quality: "auto:good" }],
  },
});

const routeImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "zonedegrimpe/routes",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1920, height: 1080, crop: "limit", quality: "auto:good" }],
  },
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "zonedegrimpe/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face", quality: "auto:good" }],
  },
});

const fileFilter = (_, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("format_invalide"));
};

const coverStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "zonedegrimpe/covers",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1280, height: 320, crop: "fill", quality: "auto:good" }],
  },
});

const messageMediaStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith("video/");
    return {
      folder: "zonedegrimpe/messages",
      resource_type: isVideo ? "video" : "image",
      ...(isVideo
        ? {}
        : { transformation: [{ width: 1920, height: 1080, crop: "limit", quality: "auto:good" }] }),
    };
  },
});

const messageMediaFilter = (_, file, cb) => {
  const allowed = [
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/quicktime", "video/webm", "video/avi",
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("format_invalide"));
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

export const uploadRouteImage = multer({
  storage: routeImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

export const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

export const uploadMessageMedia = multer({
  storage: messageMediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: messageMediaFilter,
});

export { cloudinary };
