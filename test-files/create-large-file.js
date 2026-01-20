const fs = require('fs');
const path = require('path');

// Creo un file da 5MB per testare il limite dimensione (ConsulPro = 3MB)
const content = 'A'.repeat(5 * 1024 * 1024); // 5MB di caratteri 'A'

fs.writeFileSync(path.join(__dirname, 'large-size-file.txt'), content);

console.log('✅ File grande creato:');
console.log('- large-size-file.txt (5MB) - per testare superamento limite dimensione');
