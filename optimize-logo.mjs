import sharp from 'sharp';
sharp('public/logo.png')
  .resize(600, null, { withoutEnlargement: true })
  .png({ quality: 80, compressionLevel: 9 })
  .toFile('public/logo-optimized.png')
  .then(() => console.log('Logo optimized!'))
  .catch(err => console.error('Error:', err));
