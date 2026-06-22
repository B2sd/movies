const fs = require('fs');
let content = fs.readFileSync('src/data/enrichedMedia.ts', 'utf-8');
content = content.replaceAll('"posterUrl": null', '"posterUrl": ""');
content = content.replaceAll('"backdropUrl": null', '"backdropUrl": ""');
fs.writeFileSync('src/data/enrichedMedia.ts', content);
console.log('Fixed nulls');
