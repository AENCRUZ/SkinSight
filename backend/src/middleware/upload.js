import multer from 'multer';
import { HttpError } from './validateChat.js';

// In-memory storage: photos are never written to disk by SkinSight.
const storage = multer.memoryStorage();

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (req, file, cb) => {
  const mime = (file.mimetype || '').toLowerCase();
  // 'image/jpg' is a common non-standard alias of image/jpeg
  if (ALLOWED_MIME.includes(mime) || mime === 'image/jpg') {
    cb(null, true);
  } else {
    cb(new HttpError(400, 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

const multerUpload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1, fields: 10 },
  fileFilter,
});

/** Detect the real image type from file signature bytes (the client-declared MIME type is not trusted). */
export function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/**
 * Middleware: accepts one optional image in field "image", converts multer errors into
 * friendly 400/413 responses and verifies the file signature. The verified type replaces
 * the client-declared mimetype before the image is forwarded to Gemini.
 */
export function uploadSkinPhoto(req, res, next) {
  multerUpload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new HttpError(413, 'Image is too large. Please upload a photo smaller than 5 MB.'));
        }
        return next(new HttpError(400, 'Invalid upload. Attach a single JPEG, PNG or WebP image.'));
      }
      return next(err);
    }
    if (req.file) {
      const real = detectImageType(req.file.buffer);
      if (!real) {
        return next(new HttpError(400, 'That file is not a valid JPEG, PNG or WebP image.'));
      }
      req.file.mimetype = real;
    }
    return next();
  });
}
