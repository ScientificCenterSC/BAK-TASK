const fs = require('fs');
let code = fs.readFileSync('backend/Code.gs', 'utf8');

code = code.replace(/getOrCreateSheet\('Sessions'\)/g, "getOrCreateSheet('Attendance_Sessions')");
code = code.replace(/cachedSheetData\['Sessions'\]/g, "cachedSheetData['Attendance_Sessions']");

fs.writeFileSync('backend/Code.gs', code);
console.log('Replaced successfully');
