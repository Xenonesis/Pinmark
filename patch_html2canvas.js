const fs = require('fs');
const path = require('path');
const dir = 'packages/extension/dist-firefox/assets';
const files = fs.readdirSync(dir);
for (const file of files) {
  if (file.endsWith('.js')) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('innerHTML=')) {
      console.log('Patching innerHTML in', file);
      // Replace html2canvas innerHTML check
      content = content.replace(/t\.innerHTML=typeof""\.repeat=="function"\?"&#128104;":"";/g, 't.textContent=typeof"".repeat=="function"?"&#128104;":"";');
      content = content.replace(/innerHTML\s*=/g, 'textContent=');
      fs.writeFileSync(filePath, content);
    }
  }
}
