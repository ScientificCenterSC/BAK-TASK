import re

with open('backend/Code.gs', 'r', encoding='utf-8') as f:
    code = f.read()

# Add the case statement
code = code.replace(
    "case 'setup':           return respond(true, 'Setup complete', doSetup());",
    "case 'setup':           return respond(true, 'Setup complete', doSetup());\n      case 'hardReset':       return hardReset();"
)

# Add the hardReset function at the end
hard_reset_fn = """
// ===================== RESET DATABASE =======================
function hardReset() {
  try {
    var ss = getSpreadsheet();
    var sheets = ss.getSheets();
    var temp = ss.insertSheet('TEMP_RESET_' + new Date().getTime());
    
    // Delete all old sheets
    for (var i = 0; i < sheets.length; i++) {
      ss.deleteSheet(sheets[i]);
    }
    
    // Run setup to create new ones with correct headers
    doSetup();
    
    // Delete the temp sheet
    ss.deleteSheet(temp);
    
    // Trash all files in the Drive folder
    var root = getRootFolder();
    var files = root.getFiles();
    while (files.hasNext()) files.next().setTrashed(true);
    var folders = root.getFolders();
    while (folders.hasNext()) folders.next().setTrashed(true);
    
    // Re-run setup to create the necessary Students and Lesson_Files folders
    doSetup();
    
    return respond(true, 'Database completely reset! All sheets and Drive files deleted and recreated from scratch.');
  } catch (err) {
    return respond(false, 'Reset failed: ' + err.message);
  }
}
"""

code += hard_reset_fn

with open('backend/Code.gs', 'w', encoding='utf-8') as f:
    f.write(code)

print("Added hardReset")
