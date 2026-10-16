import re

with open('backend/Code.gs', 'r', encoding='utf-8') as f:
    content = f.read()

# Add a check to doGetTasks to mark task as locked if cheated
doGetTasks_replacement = """
  var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  var now = serverTime();

  var lessonTasks = tasks.filter(function(t) { return t.lesson_id === lessonId && t.status === 'active'; });
  var result = lessonTasks.map(function(t) {
    var sub = mySubs.find(function(s) { return s.task_id === t.task_id; });
    var hasCheated = cheatLogs.some(function(l) { return l.details.indexOf(t.task_id) !== -1 || l.task_id === t.task_id || (l.details && l.details.indexOf(t.task_id) > -1); }); 
    // Actually wait, earlier I appended taskId at the end of the row, so it might not be in 'details'.
    // The schema says: ['log_id', 'student_id', 'lesson_id', 'event_type', 'event_time', 'details']
    // So if it's the 7th column, sheetToObjects won't map it unless the header has it.
    // Let's rely on adding task_id to the headers in doSetup or just search 'details'.
    // Let's modify the python script to also fix doReportCheating to put taskId inside details as JSON or appended string.
"""

# Let's fix doReportCheating first properly.
def fix_doReportCheating(content):
    # Change the logSheet.appendRow to put taskId inside details.
    pattern = r"logSheet\.appendRow\(\[\s*logId,\s*studentId,\s*lessonId,\s*eventType,\s*nowISO\(\),\s*details,\s*taskId\s*\|\|\s*''\s*\]\);"
    replacement = r"logSheet.appendRow([logId, studentId, lessonId, eventType, nowISO(), details + ' (task_id: ' + (taskId || '') + ')']);"
    return re.sub(pattern, replacement, content)

content = fix_doReportCheating(content)

# Now doGetTasks
def fix_doGetTasks(content):
    pattern = r"var mySubs = getStudentSubmissions\(studentId, student\.name\) \|\| \[\];\s*var now = serverTime\(\);\s*var lessonTasks = tasks\.filter\(function\(t\) \{ return t\.lesson_id === lessonId && t\.status === 'active'; \}\);\s*var result = lessonTasks\.map\(function\(t\) \{\s*var sub = mySubs\.find\(function\(s\) \{ return s\.task_id === t\.task_id; \}\);\s*var status = 'available';\s*var deadline = getTaskDeadline\(t, studentId\);\s*if \(sub\) status = 'completed';\s*else if \(deadline && now > deadline\) status = 'expired';"
    
    replacement = """var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  var now = serverTime();

  var lessonTasks = tasks.filter(function(t) { return t.lesson_id === lessonId && t.status === 'active'; });
  var result = lessonTasks.map(function(t) {
    var sub = mySubs.find(function(s) { return s.task_id === t.task_id; });
    var isCheated = cheatLogs.some(function(l) { return l.details.indexOf(t.task_id) !== -1; });
    var status = 'available';
    var deadline = getTaskDeadline(t, studentId);
    
    if (isCheated) status = 'locked';
    else if (sub) status = 'completed';
    else if (deadline && now > deadline) status = 'expired';"""
    return content.replace(pattern, replacement)

# wait, the pattern might fail if spaces are different. Let's use re.sub with robust regex.

# doGetTaskDetail
def fix_doGetTaskDetail(content):
    # Find: var mySubs = getStudentSubmissions(studentId, student.name) || [];
    # Add check for cheated
    pattern = r"(var studentId = session\.userId;\s*var taskId = payload\.task_id;\s*if \(!taskId\) throw new Error\('task_id is required'\);)"
    replacement = r"\1\n  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });\n  if (cheatLogs.some(function(l) { return l.details.indexOf(taskId) !== -1; })) throw new Error('CHEATING_BLOCKED: You cannot access this task. It has been locked due to a cheating violation.');"
    return re.sub(pattern, replacement, content)

def fix_doSubmitAnswer(content):
    pattern = r"(var sl = sheetToObjects\(getOrCreateSheet\('Student_Lessons'\)\)\.find\(function\(x\) \{ return x\.student_id === studentId && x\.lesson_id === task\.lesson_id; \}\);)"
    replacement = r"\1\n  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });\n  if (cheatLogs.some(function(l) { return l.details.indexOf(taskId) !== -1; })) throw new Error('CHEATING_BLOCKED: Submission rejected. This task is locked due to cheating.');"
    return re.sub(pattern, replacement, content)

content = fix_doGetTaskDetail(content)
content = fix_doSubmitAnswer(content)

# Regex for doGetTasks:
pattern_getTasks = r"(var mySubs = getStudentSubmissions\(studentId, student\.name\) \|\| \[\];[^]*?var deadline = getTaskDeadline\(t, studentId\);\s*)(if \(sub\) status = 'completed';\s*else if \(deadline && now > deadline\) status = 'expired';)"

content = re.sub(r"var mySubs = getStudentSubmissions\(studentId, student\.name\) \|\| \[\];", "var mySubs = getStudentSubmissions(studentId, student.name) || [];\n  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });", content)

content = re.sub(r"if \(sub\) status = 'completed';\s*else if \(deadline && now > deadline\) status = 'expired';", "var isCheated = cheatLogs.some(function(l) { return l.details.indexOf(t.task_id) !== -1; });\n    if (isCheated) status = 'locked';\n    else if (sub) status = 'completed';\n    else if (deadline && now > deadline) status = 'expired';", content)

with open('backend/Code.gs', 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied cheating logic to doGetTasks, doGetTaskDetail, doSubmitAnswer")
