import re

with open('backend/Code.gs', 'r', encoding='utf-8') as f:
    content = f.read()

helper = """
function getStudentSpreadsheet(studentId, studentName) {
  var folder = getStudentFolder(studentId, studentName);
  var fileName = studentId + '_' + studentName + '_Data';
  var files = folder.getFilesByName(fileName);
  
  if (files.hasNext()) {
    var file = files.next();
    if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
      return SpreadsheetApp.openById(file.getId());
    }
  }
  
  var ss = SpreadsheetApp.create(fileName);
  var file = DriveApp.getFileById(ss.getId());
  file.moveTo(folder);
  
  ss.insertSheet('Submissions').appendRow(['task_id', 'score', 'time_spent', 'submitted_at']);
  ss.insertSheet('Cheating_Logs').appendRow(['lesson_id', 'task_id', 'event_type', 'event_time', 'details']);
  
  var sheet1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('ورقة 1') || ss.getSheetByName('Sheet 1');
  if (sheet1) ss.deleteSheet(sheet1);
  
  return ss;
}
"""

content = content.replace("// ===================== DRIVE HELPERS ========================", "// ===================== DRIVE HELPERS ========================\n" + helper)

submit_hook = """  saveStudentSubmissions(studentId, student.name, mySubs);
  try {
    var ss = getStudentSpreadsheet(studentId, student.name);
    var subSheet = ss.getSheetByName('Submissions');
    if (subSheet) subSheet.appendRow([taskId, isCorrect ? 'Pass' : totalScore, timeSpent, nowISO()]);
  } catch(e) {}
"""
content = content.replace("saveStudentSubmissions(studentId, student.name, mySubs);", submit_hook)


report_hook = """  var logId = generateId('ACL');
  
  logSheet.appendRow([
    logId, studentId, lessonId, eventType, nowISO(), details, taskId || ''
  ]);
  
  try {
    var students = sheetToObjects(getOrCreateSheet('Students'));
    var student = students.find(function(s) { return s.student_id === studentId; });
    if (student) {
      var ss = getStudentSpreadsheet(studentId, student.name);
      var cheatSheet = ss.getSheetByName('Cheating_Logs');
      if (cheatSheet) cheatSheet.appendRow([lessonId, taskId || '', eventType, nowISO(), details]);
    }
  } catch(e) {}
"""
content = re.sub(r"var logId = generateId\('ACL'\);\s*logSheet\.appendRow\(\[\s*logId, studentId, lessonId, eventType, nowISO\(\), details, taskId \|\| ''\s*\]\);", report_hook, content)

with open('backend/Code.gs', 'w', encoding='utf-8') as f:
    f.write(content)
