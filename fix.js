const fs = require('fs');
let code = fs.readFileSync('backend/Code.gs', 'utf8');

let idxStart = code.indexOf('function writeJsonToFolder');
let idxEnd = code.indexOf('function requireStudent');

if (idxStart !== -1 && idxEnd !== -1) {
  let before = code.substring(0, idxStart);
  let after = code.substring(idxEnd);
  
  let replacement = `function writeJsonToFolder(folder, fileName, data) {
  var content = JSON.stringify(data, null, 2);
  var files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    var file = files.next();
    file.setContent(content);
    return file;
  }
  return folder.createFile(fileName, content, 'application/json');
}

function readJsonFromFolder(folder, fileName) {
  var files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    var content = files.next().getBlob().getDataAsString();
    try {
      return JSON.parse(content);
    } catch(e) {
      return null;
    }
  }
  return null;
}

// ===================== SESSION MANAGEMENT ===================

function createSession(userId, role) {
  var sheet = getOrCreateSheet('Auth_Sessions');
  var token = generateToken();
  var now = new Date();
  var expires = new Date(now.getTime() + CONFIG.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  sheet.appendRow([token, userId, role, now.toISOString(), expires.toISOString()]);
  return token;
}

function validateSession(token) {
  if (!token) return null;
  var sheet = getOrCreateSheet('Auth_Sessions');
  var sessions = sheetToObjects(sheet);
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].token === token) {
      var expires = new Date(sessions[i].expires_at);
      if (new Date() < expires) {
        return {
          userId: sessions[i].user_id,
          role: sessions[i].role
        };
      }
      var rowIdx = findRowIndex(sheet, 'token', token);
      if (rowIdx > 0) sheet.deleteRow(rowIdx);
      return null;
    }
  }
  return null;
}

function destroySession(token) {
  var sheet = getOrCreateSheet('Auth_Sessions');
  var rowIdx = findRowIndex(sheet, 'token', token);
  if (rowIdx > 0) {
    sheet.deleteRow(rowIdx);
    return true;
  }
  return false;
}

`;
  
  fs.writeFileSync('backend/Code.gs', before + replacement + after);
  console.log('Fixed Code.gs block 1');
} else {
  console.log('Could not find indices!', idxStart, idxEnd);
}
