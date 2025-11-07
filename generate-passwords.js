const bcrypt = require('bcryptjs');

// Generar hashes reales
async function generateHashes() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const hermanaHash = await bcrypt.hash('hermana123', 10);
  
  console.log('Hashes generados:');
  console.log('admin123 ->', adminHash);
  console.log('hermana123 ->', hermanaHash);
}

generateHashes();