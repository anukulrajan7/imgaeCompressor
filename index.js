// app.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const {
	optimizeImage,
	downloadImage,
} = require('./controllers/imageController');
const { mkdir } = require('fs/promises');

const app = express();

// Set up EJS
app.set('view engine', 'ejs');

// Create required directories
const initializeDirectories = async () => {
	const dirs = [
		path.join(__dirname, 'uploads'),
		path.join(__dirname, 'public'),
		path.join(__dirname, 'public/uploads'),
	];

	for (const dir of dirs) {
		try {
			await mkdir(dir, { recursive: true });
			console.log(`Directory created or verified: ${dir}`);
		} catch (error) {
			if (error.code !== 'EEXIST') {
				console.error(`Error creating directory ${dir}:`, error);
				throw error;
			}
		}
	}
};

// Initialize directories before setting up routes
initializeDirectories().catch((error) => {
	console.error('Failed to initialize directories:', error);
	process.exit(1);
});

// Serve static files from public directory
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const storage = multer.diskStorage({
	destination: async function (req, file, cb) {
		const uploadDir = path.join(__dirname, 'uploads');
		try {
			await mkdir(uploadDir, { recursive: true });
			cb(null, uploadDir);
		} catch (error) {
			cb(error);
		}
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
		const ext = path.extname(file.originalname);
		cb(null, file.fieldname + '-' + uniqueSuffix + ext);
	},
});

// File filter function
const fileFilter = (req, file, cb) => {
	// Allowed file types
	const allowedTypes = /jpeg|jpg|png|gif|webp/;
	const allowedMimeTypes = /^image\/(jpeg|png|gif|webp)$/;

	// Check extension and mime type
	const ext = path.extname(file.originalname).toLowerCase();
	const isValidExt = allowedTypes.test(ext);
	const isValidMime = allowedMimeTypes.test(file.mimetype);

	if (isValidExt && isValidMime) {
		cb(null, true);
	} else {
		cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed!'), false);
	}
};

// Configure multer
const upload = multer({
	storage: storage,
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit
		files: 1,
	},
	fileFilter: fileFilter,
});

// Routes
app.get('/', (req, res) => {
	res.render('index', { success: false, error: null });
});

// Handle file upload with error handling
app.post('/optimize', (req, res, next) => {
	upload.single('image')(req, res, (err) => {
		if (err) {
			if (err instanceof multer.MulterError) {
				if (err.code === 'LIMIT_FILE_SIZE') {
					return res.render('index', {
						error: 'File is too large. Maximum size is 10MB.',
						success: false,
					});
				}
			}
			return res.render('index', {
				error: err.message || 'Error uploading file.',
				success: false,
			});
		}
		// If upload successful, proceed to optimization
		optimizeImage(req, res).catch(next);
	});
});

app.get('/download/:filename', downloadImage);

// Global error handler
app.use((err, req, res, next) => {
	console.error('Global error:', err);
	res.status(500).render('index', {
		error: 'Something went wrong. Please try again.',
		success: false,
	});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});

process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
	console.error('Unhandled Rejection:', error);
});
