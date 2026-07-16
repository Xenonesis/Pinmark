const fs = require('fs');
let manifest = JSON.parse(fs.readFileSync('packages/extension/dist-firefox/manifest.json', 'utf8'));
manifest.browser_specific_settings.gecko.strict_min_version = "109.0";
delete manifest.browser_specific_settings.gecko.data_collection_permissions;
fs.writeFileSync('packages/extension/dist-firefox/manifest.json', JSON.stringify(manifest, null, 2));
