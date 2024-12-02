// controllers/imageController.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { mkdir } = require('fs/promises');

const createDirectories = async () => {
	const dirs = [
		path.join(process.cwd(), 'uploads'),
		path.join(process.cwd(), 'public'),
		path.join(process.cwd(), 'public/uploads'),
	];

	for (const dir of dirs) {
		try {
			await mkdir(dir, { recursive: true });
		} catch (error) {
			if (error.code !== 'EEXIST') {
				throw error;
			}
		}
	}
};

const optimizeImage = async (req, res) => {
	try {
		// Ensure directories exist
		await createDirectories();

		if (!req.file) {
			return res.status(400).render('index', {
				error: 'Please upload an image file',
				success: false,
			});
		}

		const inputPath = req.file.path;
		const originalName = path.parse(req.file.originalname).name;
		const timestamp = Date.now();
		const outputFilename = `${originalName}-${timestamp}-optimized.webp`;
		const outputPath = path.join(
			process.cwd(),
			'public/uploads',
			outputFilename
		);

		// Validate input file exists
		try {
			await fs.access(inputPath);
		} catch (error) {
			return res.status(400).render('index', {
				error: 'Upload failed. Please try again.',
				success: false,
			});
		}

		// Create optimization options based on form data or defaults
		const options = {
			width: parseInt(req.body.width) || 800,
			quality: parseInt(req.body.quality) || 80,
		};

		// Validate options
		options.width = Math.min(Math.max(options.width, 100), 4000);
		options.quality = Math.min(Math.max(options.quality, 1), 100);

		// Optimize image using Sharp
		await sharp(inputPath)
			.resize(options.width)
			.webp({ quality: options.quality })
			.toFile(outputPath);

		// Get file sizes for comparison
		const inputSize = (await fs.stat(inputPath)).size;
		const outputSize = (await fs.stat(outputPath)).size;
		const savings = (((inputSize - outputSize) / inputSize) * 100).toFixed(2);

		// Clean up original upload
		try {
			await fs.unlink(inputPath);
		} catch (error) {
			console.error('Error deleting input file:', error);
			// Continue execution even if cleanup fails
		}

		// Return the optimization results
		return res.render('index', {
			success: true,
			originalSize: (inputSize / 1024).toFixed(2),
			optimizedSize: (outputSize / 1024).toFixed(2),
			savings: savings,
			outputPath: `/uploads/${outputFilename}`,
			downloadFilename: outputFilename,
			error: null,
		});
	} catch (error) {
		console.error('Image optimization error:', error);
		// Clean up any partial files
		if (req.file && req.file.path) {
			try {
				await fs.unlink(req.file.path);
			} catch (cleanupError) {
				console.error('Cleanup error:', cleanupError);
			}
		}
		return res.status(500).render('index', {
			error: 'Error optimizing image. Please try again.',
			success: false,
		});
	}
};

const downloadImage = async (req, res) => {
	try {
		const filename = req.params.filename;

		// Validate filename to prevent directory traversal
		if (filename.includes('..') || filename.includes('/')) {
			throw new Error('Invalid filename');
		}

		const filePath = path.join(process.cwd(), 'public/uploads', filename);

		// Check if file exists
		try {
			await fs.access(filePath);
		} catch (error) {
			return res.status(404).render('index', {
				error: 'File not found',
				success: false,
			});
		}

		// Set headers for download
		res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
		res.setHeader('Content-Type', 'image/webp');

		// Send file as download
		return res.download(filePath, filename, (err) => {
			if (err) {
				console.error('Download error:', err);
				return res.status(500).render('index', {
					error: 'Error downloading file',
					success: false,
				});
			}
		});
	} catch (error) {
		console.error('Download error:', error);
		return res.status(400).render('index', {
			error: 'Invalid download request',
			success: false,
		});
	}
};

module.exports = {
	optimizeImage,
	downloadImage,
};
