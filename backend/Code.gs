// ============================================================
// Student Learning Management Platform — Google Apps Script
// ============================================================
// INSTRUCTIONS:
// 1. Copy this entire file into your Google Apps Script editor
// 2. Deploy as Web App (Execute as: Me, Who has access: Anyone)
// 3. Call ?action=setup once to initialize the database
// ============================================================

// ===================== CONFIGURATION ========================
const CONFIG = {
  SPREADSHEET_ID: '1orvcYfNgzoZD9lj3LRZMO_EMq-X1tYvWcdYhcyNNkM0',
  DRIVE_FOLDER_ID: '1o783H4iGBUaxpYlZV2fRyIoCpPSQUVGS',
  SESSION_EXPIRY_HOURS: 24,
  DEFAULT_ADMIN_USER: 'admin',
  DEFAULT_ADMIN_PASS: 'admin123'
};

// ===================== SHEET DEFINITIONS ====================
const SHEETS = {
  Students: [
    'student_id', 'name', 'code', 'password_hash', 'email', 'status', 'total_submissions', 'total_score', 'created_at'
  ],
  Curricula: [
    'curriculum_id', 'name', 'description', 'icon', 'status', 'created_at'
  ],
  Student_Curricula: [
    'student_id', 'curriculum_id'
  ],
  Lessons: [
    'lesson_id', 'curriculum_id', 'title', 'description', 'lesson_order', 'status', 'created_at'
  ],
  Lesson_Files: [
    'file_id', 'lesson_id', 'file_name', 'file_url', 'file_type', 'file_size', 'drive_file_id', 'created_at'
  ],
  Task_Extensions: [
    'extension_id', 'student_id', 'task_id', 'new_deadline', 'created_at', 'late_penalty'
  ],
  Student_Lessons: [
    'student_id', 'lesson_id', 'status', 'started_at', 'completed_at', 'total_time', 'cheating_status'
  ],
  Anti_Cheat_Logs: [
    'log_id', 'student_id', 'lesson_id', 'event_type', 'event_time', 'details'
  ],
  Admin: [
    'username', 'password_hash', 'created_at'
  ],
  Sessions: [
    'token', 'user_id', 'role', 'created_at', 'expires_at'
  ]
};

// ===================== UTILITIES ============================

function getTaskDeadline(task, studentId) {
  var deadline = task.deadline ? new Date(task.deadline) : null;
  var extensions = sheetToObjects(getOrCreateSheet('Task_Extensions'));
  for (var i = 0; i < extensions.length; i++) {
    if (extensions[i].student_id === studentId && extensions[i].task_id === task.task_id && extensions[i].new_deadline) {
      deadline = new Date(extensions[i].new_deadline);
      break;
    }
  }
  return deadline;
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getOrCreateSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var headers = SHEETS[name];
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    results.push(obj);
  }
  return results;
}

function findRowIndex(sheet, colName, value) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;
  var headers = data[0];
  var colIdx = headers.indexOf(colName);
  if (colIdx === -1) return -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(value)) {
      return i + 1;
    }
  }
  return -1;
}

function generateId(prefix) {
  if (prefix === 'TASK' || prefix === 'SUB') {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5).toUpperCase();
  }
  var sheetName =
    prefix === 'STU' ? 'Students' :
    prefix === 'CUR' ? 'Curricula' :
    prefix === 'LES' ? 'Lessons' :
    prefix === 'FILE' ? 'Lesson_Files' :
    prefix === 'SLSN' ? 'Student_Lessons' :
    prefix === 'ACL' ? 'Anti_Cheat_Logs' :
    'Sessions';
  var sheet = getOrCreateSheet(sheetName);
  var lastRow = sheet.getLastRow();
  var padded = ('000' + lastRow).slice(-3);
  return prefix + '_' + padded + '_' + Math.random().toString(36).substr(2, 3).toUpperCase();
}

function hashPassword(password) {
  return String(password);
}

function generateToken() {
  return Utilities.getUuid();
}

function nowISO() {
  return new Date().toISOString();
}

function serverTime() {
  return new Date();
}

// ===================== DRIVE HELPERS ========================

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


function getTasksData() {
  var root = getRootFolder();
  var data = readJsonFromFolder(root, 'tasks.json');
  return data || [];
}

function saveTasksData(tasks) {
  var root = getRootFolder();
  writeJsonToFolder(root, 'tasks.json', tasks);
}

function getStudentSubmissions(studentId, studentName) {
  var folder = getStudentFolder(studentId, studentName);
  var data = readJsonFromFolder(folder, 'submissions.json');
  return data || [];
}

function saveStudentSubmissions(studentId, studentName, submissions) {
  var folder = getStudentFolder(studentId, studentName);
  writeJsonToFolder(folder, 'submissions.json', submissions);
}

function getOrCreateSubfolder(parentFolder, name) {
  var folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parentFolder.createFolder(name);
}

function getRootFolder() {
  return DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
}

function getTasksMainFolder() {
  // Use the exact ID requested by the user for ROOT TASKS FOLDER
  return DriveApp.getFolderById('1o783H4iGBUaxpYlZV2fRyIoCpPSQUVGS');
}

function getStudentsFolder() {
  return getOrCreateSubfolder(getRootFolder(), 'Students');
}

function getStudentFolder(studentId, studentName) {
  var studentsFolder = getStudentsFolder();
  var folderName = studentId + '_' + studentName.replace(/\s+/g, '_');
  return getOrCreateSubfolder(studentsFolder, folderName);
}

function getLessonFilesFolder() {
  return getOrCreateSubfolder(getRootFolder(), 'Lesson_Files');
}

function getLessonFolder(lessonId) {
  return getOrCreateSubfolder(getLessonFilesFolder(), lessonId);
}


function getTaskDriveFolder(curriculumName, lessonName, taskNumber) {
  var root = getTasksMainFolder();
  var cFolder = getOrCreateSubfolder(root, (curriculumName||'Unknown').replace(/[\\/:*?"<>|]/g, '_'));
  var lFolder = getOrCreateSubfolder(cFolder, (lessonName||'Unknown').replace(/[\\/:*?"<>|]/g, '_'));
  return getOrCreateSubfolder(lFolder, 'Task_' + taskNumber);
}

function writeJsonToFolder(folder, fileName, data) {
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
    } catch (e) {
      return null;
    }
  }
  return null;
}

// ===================== SESSION MANAGEMENT ===================

function createSession(userId, role) {
  var sheet = getOrCreateSheet('Sessions');
  var token = generateToken();
  var now = new Date();
  var expires = new Date(now.getTime() + CONFIG.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  sheet.appendRow([token, userId, role, now.toISOString(), expires.toISOString()]);
  return token;
}

function validateSession(token) {
  if (!token) return null;
  var sheet = getOrCreateSheet('Sessions');
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
  var sheet = getOrCreateSheet('Sessions');
  var rowIdx = findRowIndex(sheet, 'token', token);
  if (rowIdx > 0) {
    sheet.deleteRow(rowIdx);
    return true;
  }
  return false;
}

function requireStudent(token) {
  var session = validateSession(token);
  if (!session || session.role !== 'student') return null;
  return session;
}

function requireAdmin(token) {
  var session = validateSession(token);
  if (!session || session.role !== 'admin') return null;
  return session;
}

// ===================== API ROUTER ===========================

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var action = '';
  var payload = {};

  try {
    // Auto-setup if Admin sheet is missing
    var ss = getSpreadsheet();
    if (!ss.getSheetByName('Admin')) {
      doSetup();
    }

    action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
        if (payload.action) action = payload.action;
      } catch (parseErr) {
        return respond(false, 'Invalid JSON in request body');
      }
    }

    if (e && e.parameter) {
      for (var key in e.parameter) {
        if (key !== 'action' && !payload[key]) {
          payload[key] = e.parameter[key];
        }
      }
    }

    switch (action) {
      // ---- Setup ----
      case 'setup':           return respond(true, 'Setup complete', doSetup());
      case 'hardReset':       return hardReset();

      // ---- Auth ----
      case 'login':           return respond(true, 'OK', doLogin(payload));
      case 'adminLogin':      return respond(true, 'OK', doAdminLogin(payload));
      case 'logout':          return respond(true, 'OK', doLogout(payload));

      // ---- Student ----
      case 'getStudentDashboard':  return guardStudent(payload, doGetStudentDashboard);
      case 'getStudentCurricula':  return guardStudent(payload, doGetStudentCurricula);
      case 'getLessons':           return guardStudent(payload, doGetLessons);
      case 'getTasks':             return guardStudent(payload, doGetTasks);
      case 'getTaskDetail':        return guardStudent(payload, doGetTaskDetail);
      case 'submitAnswer':         return guardStudent(payload, doSubmitAnswer);
      case 'getStudentReport':     return guardStudent(payload, doGetStudentReport);
      case 'startLesson':          return guardStudent(payload, doStartLesson);
      case 'completeLesson':       return guardStudent(payload, doCompleteLesson);
      case 'reportCheating':       return guardStudent(payload, doReportCheating);
      case 'getLessonStatus':      return guardStudent(payload, doGetLessonStatus);
      case 'getLessonFiles':       return guardStudent(payload, doGetLessonFilesStudent);

      // ---- Admin ----
      case 'getAdminDashboard':    return guardAdmin(payload, doGetAdminDashboard);
      case 'getAllStudents':       return guardAdmin(payload, doGetAllStudents);
      case 'addStudent':          return guardAdmin(payload, doAddStudent);
      case 'updateStudent':       return guardAdmin(payload, doUpdateStudent);
      case 'deleteStudent':       return guardAdmin(payload, doDeleteStudent);
      case 'resetPassword':       return guardAdmin(payload, doResetPassword);
      case 'getStudentProfile':   return guardAdmin(payload, doGetStudentProfile);
      case 'getLessonTracking':   return guardAdmin(payload, doGetLessonTracking);
      case 'getStudentAnswer':    return guardAdmin(payload, doGetStudentAnswer);
      case 'getCurriculaAndLessons': return guardAdmin(payload, doGetCurriculaAndLessons);

      case 'getStudentAnswers':   return guardAdmin(payload, doGetStudentAnswers);
      case 'getAllCurricula':     return guardAdmin(payload, doGetAllCurricula);
      case 'addCurriculum':      return guardAdmin(payload, doAddCurriculum);
      case 'updateCurriculum':   return guardAdmin(payload, doUpdateCurriculum);
      case 'deleteCurriculum':   return guardAdmin(payload, doDeleteCurriculum);
      case 'assignCurriculum':   return guardAdmin(payload, doAssignCurriculum);
      case 'removeCurriculum':   return guardAdmin(payload, doRemoveCurriculum);
      case 'getAllLessons':      return guardAdmin(payload, doGetAllLessons);
      case 'addLesson':          return guardAdmin(payload, doAddLesson);
      case 'updateLesson':       return guardAdmin(payload, doUpdateLesson);
      case 'deleteLesson':       return guardAdmin(payload, doDeleteLesson);
      case 'getAllTasks':        return guardAdmin(payload, doGetAllTasks);
      case 'addTask':           return guardAdmin(payload, doAddTask);
      case 'updateTask':        return guardAdmin(payload, doUpdateTask);
      case 'deleteTask':        return guardAdmin(payload, doDeleteTask);
      case 'importTasks':       return guardAdmin(payload, doImportTasks);
      case 'getAdminReport':    return guardAdmin(payload, doGetAdminReport);
      case 'uploadLessonFile':  return guardAdmin(payload, doUploadLessonFile);
      case 'deleteLessonFile':  return guardAdmin(payload, doDeleteLessonFile);
      case 'getAdminLessonFiles': return guardAdmin(payload, doGetLessonFilesAdmin);
      case 'getAntiCheatLogs':  return guardAdmin(payload, doGetAntiCheatLogs);
      case 'clearCheatingStatus': return guardAdmin(payload, doClearCheatingStatus);
      case 'extendTaskDeadline': return guardAdmin(payload, doExtendTaskDeadline);

      default:
        return respond(false, 'Unknown action: ' + action);
    }
  } catch (err) {
    return respond(false, 'Server error: ' + err.message);
  }
}

function guardStudent(payload, fn) {
  var session = requireStudent(payload.token);
  if (!session) return respond(false, 'Unauthorized. Please login again.', null, 401);
  return respond(true, 'OK', fn(payload, session));
}

function guardAdmin(payload, fn) {
  var session = requireAdmin(payload.token);
  if (!session) return respond(false, 'Unauthorized. Admin access required.', null, 401);
  return respond(true, 'OK', fn(payload, session));
}

function respond(success, message, data, code) {
  var result = {
    success: success,
    message: message,
    data: data || null,
    serverTime: nowISO()
  };
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================== SETUP ================================

function doSetup() {
  var sheetNames = Object.keys(SHEETS);
  for (var i = 0; i < sheetNames.length; i++) {
    getOrCreateSheet(sheetNames[i]);
  }

  getStudentsFolder();
  getLessonFilesFolder();

  var adminSheet = getOrCreateSheet('Admin');
  var admins = sheetToObjects(adminSheet);
  if (admins.length === 0) {
    adminSheet.appendRow([
      CONFIG.DEFAULT_ADMIN_USER,
      hashPassword(CONFIG.DEFAULT_ADMIN_PASS),
      nowISO()
    ]);
  }

  return {
    sheetsCreated: sheetNames,
    driveFolderReady: true,
    defaultAdminCreated: admins.length === 0
  };
}

// ===================== AUTH =================================

function doLogin(payload) {
  var code = payload.code;
  var password = payload.password;
  if (!code || !password) throw new Error('Student code and password are required');

  var sheet = getOrCreateSheet('Students');
  var students = sheetToObjects(sheet);
  var hash = hashPassword(password);

  for (var i = 0; i < students.length; i++) {
    if (String(students[i].code) === String(code) && students[i].password_hash === hash) {
      if (students[i].status !== 'active') {
        throw new Error('Your account is deactivated. Contact your administrator.');
      }
      var token = createSession(students[i].student_id, 'student');
      return {
        token: token,
        studentId: students[i].student_id,
        name: students[i].name,
        code: students[i].code
      };
    }
  }
  throw new Error('Invalid student code or password');
}

function doAdminLogin(payload) {
  var username = payload.username;
  var password = payload.password;
  if (!username || !password) throw new Error('Username and password are required');

  var sheet = getOrCreateSheet('Admin');
  var admins = sheetToObjects(sheet);
  var hash = hashPassword(password);

  for (var i = 0; i < admins.length; i++) {
    if (admins[i].username === username && admins[i].password_hash === hash) {
      var token = createSession('ADMIN', 'admin');
      return { token: token };
    }
  }
  throw new Error('Invalid admin credentials');
}

function doLogout(payload) {
  destroySession(payload.token);
  return { loggedOut: true };
}

// ===================== LESSON FILES =========================

function doUploadLessonFile(payload, session) {
  var lessonId = payload.lesson_id;
  var fileName = payload.file_name;
  var fileData = payload.file_data; // base64
  var fileType = payload.file_type || 'application/octet-stream';
  var fileSize = payload.file_size || 0;

  if (!lessonId || !fileName || !fileData) {
    throw new Error('lesson_id, file_name, and file_data (base64) are required');
  }

  // Verify lesson exists
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var lesson = null;
  for (var i = 0; i < lessons.length; i++) {
    if (lessons[i].lesson_id === lessonId) { lesson = lessons[i]; break; }
  }
  if (!lesson) throw new Error('Lesson not found');

  // Decode base64 and save to Drive
  var decoded = Utilities.base64Decode(fileData);
  var blob = Utilities.newBlob(decoded, fileType, fileName);
  var folder = getLessonFolder(lessonId);
  var driveFile = folder.createFile(blob);
  driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileUrl = 'https://drive.google.com/uc?export=download&id=' + driveFile.getId();

  // Log in Lesson_Files sheet
  var sheet = getOrCreateSheet('Lesson_Files');
  var fileId = generateId('FILE');
  sheet.appendRow([
    fileId, lessonId, fileName, fileUrl, fileType, fileSize, driveFile.getId(), nowISO()
  ]);

  return {
    file_id: fileId,
    file_name: fileName,
    file_url: fileUrl,
    file_type: fileType,
    file_size: fileSize
  };
}

function doDeleteLessonFile(payload, session) {
  var fileId = payload.file_id;
  if (!fileId) throw new Error('file_id is required');

  var sheet = getOrCreateSheet('Lesson_Files');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxId = headers.indexOf('file_id');
  var idxDriveId = headers.indexOf('drive_file_id');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === String(fileId)) {
      // Delete from Drive
      try {
        var driveFileId = data[i][idxDriveId];
        if (driveFileId) {
          DriveApp.getFileById(driveFileId).setTrashed(true);
        }
      } catch (e) {
        Logger.log('Drive delete error: ' + e.message);
      }
      // Delete row from sheet
      sheet.deleteRow(i + 1);
      return { deleted: true };
    }
  }
  throw new Error('File not found');
}

function doGetLessonFilesAdmin(payload, session) {
  var lessonId = payload.lesson_id;
  if (!lessonId) throw new Error('lesson_id is required');

  var files = sheetToObjects(getOrCreateSheet('Lesson_Files'));
  var result = files.filter(function(f) { return f.lesson_id === lessonId; });

  return {
    files: result.map(function(f) {
      return {
        file_id: f.file_id,
        file_name: f.file_name,
        file_url: f.file_url,
        file_type: f.file_type,
        file_size: Number(f.file_size) || 0,
        created_at: f.created_at
      };
    })
  };
}

function doGetLessonFilesStudent(payload, session) {
  var lessonId = payload.lesson_id;
  if (!lessonId) throw new Error('lesson_id is required');

  var files = sheetToObjects(getOrCreateSheet('Lesson_Files'));
  var result = files.filter(function(f) { return f.lesson_id === lessonId; });

  return {
    files: result.map(function(f) {
      return {
        file_id: f.file_id,
        file_name: f.file_name,
        file_url: f.file_url,
        file_type: f.file_type,
        file_size: Number(f.file_size) || 0
      };
    })
  };
}

// ===================== STUDENT LESSON TRACKING ==============

function doStartLesson(payload, session) {
  var studentId = session.userId;
  var lessonId = payload.lesson_id;
  if (!lessonId) throw new Error('lesson_id is required');

  var sheet = getOrCreateSheet('Student_Lessons');
  var existing = sheetToObjects(sheet);

  // Check if already started
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].student_id === studentId && existing[i].lesson_id === lessonId) {
      // Check if CHEATING — block re-entry
            // Already started, return existing status
      return {
        status: existing[i].status,
        started_at: existing[i].started_at,
        cheating_status: existing[i].cheating_status || 'none'
      };
    }
  }

  // Create new entry
  var now = nowISO();
  sheet.appendRow([
    studentId, lessonId, 'in_progress', now, '', '', ''
  ]);

  return {
    status: 'in_progress',
    started_at: now,
    cheating_status: 'none'
  };
}

function doCompleteLesson(payload, session) {
  var studentId = session.userId;
  var lessonId = payload.lesson_id;
  if (!lessonId) throw new Error('lesson_id is required');

  var sheet = getOrCreateSheet('Student_Lessons');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][headers.indexOf('student_id')]) === String(studentId) &&
        String(data[i][headers.indexOf('lesson_id')]) === String(lessonId)) {

      
      var rowNum = i + 1;
      var startedAt = data[i][headers.indexOf('started_at')];
      var now = new Date();
      var completedAt = now.toISOString();

      // Calculate total time in seconds
      var totalTime = 0;
      if (startedAt) {
        totalTime = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);
      }

      sheet.getRange(rowNum, headers.indexOf('status') + 1).setValue('completed');
      sheet.getRange(rowNum, headers.indexOf('completed_at') + 1).setValue(completedAt);
      sheet.getRange(rowNum, headers.indexOf('total_time') + 1).setValue(totalTime);

      return {
        status: 'completed',
        completed_at: completedAt,
        total_time: totalTime
      };
    }
  }
  throw new Error('Lesson session not found. Did you call startLesson first?');
}

function doReportCheating(payload, session) {
  var studentId = session.userId;
  var lessonId = payload.lesson_id;
  var taskId = payload.task_id; // newly passed
  var eventType = payload.event_type || 'unknown';
  var details = payload.details || '';
  
  if (!lessonId) throw new Error('lesson_id is required');

  // Instead of marking the entire lesson as CHEATING, we just log it.
  var logSheet = getOrCreateSheet('Anti_Cheat_Logs');
  var logId = generateId('ACL');
  
  // We'll put task_id inside the details or as a new column at the end. 
  // Let's just append taskId at the end of the row.
  logSheet.appendRow([logId, studentId, lessonId, eventType, nowISO(), details + ' (task_id: ' + (taskId || '') + ')']);

  return {
    recorded: true,
    status: 'CHEATING_TASK',
    log_id: logId
  };
}

function doGetLessonStatus(payload, session) {
  var studentId = session.userId;
  var lessonId = payload.lesson_id;
  if (!lessonId) throw new Error('lesson_id is required');

  var existing = sheetToObjects(getOrCreateSheet('Student_Lessons'));
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].student_id === studentId && existing[i].lesson_id === lessonId) {
      return {
        status: existing[i].status,
        started_at: existing[i].started_at,
        completed_at: existing[i].completed_at,
        total_time: existing[i].total_time,
        cheating_status: existing[i].cheating_status || 'none'
      };
    }
  }

  return {
    status: 'not_started',
    cheating_status: 'none'
  };
}

// ===================== ANTI-CHEAT ADMIN =====================

function doGetAntiCheatLogs(payload, session) {
  var studentId = payload.student_id;
  var lessonId = payload.lesson_id;

  var logs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs'));
  var students = sheetToObjects(getOrCreateSheet('Students'));
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));

  if (studentId) {
    logs = logs.filter(function(l) { return l.student_id === studentId; });
  }
  if (lessonId) {
    logs = logs.filter(function(l) { return l.lesson_id === lessonId; });
  }

  return {
    logs: logs.map(function(log) {
      var stu = students.find(function(s) { return s.student_id === log.student_id; });
      var les = lessons.find(function(l) { return l.lesson_id === log.lesson_id; });
      return {
        log_id: log.log_id,
        student_id: log.student_id,
        student_name: stu ? stu.name : log.student_id,
        lesson_id: log.lesson_id,
        lesson_title: les ? les.title : log.lesson_id,
        event_type: log.event_type,
        event_time: log.event_time,
        details: log.details
      };
    })
  };
}

function doClearCheatingStatus(payload, session) {
  var studentId = payload.student_id;
  var lessonId = payload.lesson_id;
  var taskId = payload.task_id; // optional
  if (!studentId || !lessonId) throw new Error('student_id and lesson_id are required');

  var sheet = getOrCreateSheet('Anti_Cheat_Logs');
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { cleared: true };
  
  var headers = data[0];
  var idxStu = headers.indexOf('student_id');
  var idxLes = headers.indexOf('lesson_id');
  var idxDet = headers.indexOf('details');
  
  var rowsToDelete = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxStu]) === String(studentId) && String(data[i][idxLes]) === String(lessonId)) {
        if (taskId) {
            // Check if details contains taskId
            if (String(data[i][idxDet]).indexOf(taskId) !== -1 || (data[i].length > 6 && String(data[i][6]).indexOf(taskId) !== -1)) {
                rowsToDelete.push(i + 1);
            }
        } else {
            rowsToDelete.push(i + 1);
        }
    }
  }

  // Delete from bottom to top to preserve indices
  for (var i = rowsToDelete.length - 1; i >= 0; i--) {
      sheet.deleteRow(rowsToDelete[i]);
  }
  
  return { cleared: true, removedCount: rowsToDelete.length };
}

// ===================== STUDENT FUNCTIONS ====================

function doGetStudentDashboard(payload, session) {
  var studentId = session.userId;
  var students = sheetToObjects(getOrCreateSheet('Students'));
  var student = students.find(function(s) { return s.student_id === studentId; });
  if (!student) throw new Error('Student not found');

  var sc = sheetToObjects(getOrCreateSheet('Student_Curricula'));
  var assignedCurIds = sc.filter(function(x) { return x.student_id === studentId; }).map(function(x) { return x.curriculum_id; });

  var tasks = getTasksData();
  var myTasks = tasks.filter(function(t) { return assignedCurIds.indexOf(t.curriculum_id) !== -1 && t.status === 'active'; });

  var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  var completedTaskIds = [];
  var correctCount = 0, incorrectCount = 0, totalScore = 0, totalMaxScore = 0;

  for (var i = 0; i < mySubs.length; i++) {
    completedTaskIds.push(mySubs[i].task_id);
    if (String(mySubs[i].is_correct) === 'true' || mySubs[i].is_correct === true) correctCount++;
    else incorrectCount++;
    totalScore += Number(mySubs[i].score) || 0;
    totalMaxScore += Number(mySubs[i].max_score) || 0;
  }

  var sortedSubs = mySubs.slice().sort(function(a, b) { return new Date(b.submitted_at) - new Date(a.submitted_at); });
  var recentSubs = sortedSubs.slice(0, 5);

  var totalTasks = myTasks.length;
  var completedTasks = completedTaskIds.length;
  var progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  var overallScore = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var myLessons = lessons.filter(function(l) { return assignedCurIds.indexOf(l.curriculum_id) !== -1; });
  var completedLessons = 0;
  for (var i = 0; i < myLessons.length; i++) {
    var lessonTasks = myTasks.filter(function(t) { return t.lesson_id === myLessons[i].lesson_id; });
    var lessonCompleted = lessonTasks.filter(function(t) { return completedTaskIds.indexOf(t.task_id) !== -1; });
    if (lessonTasks.length > 0 && lessonCompleted.length === lessonTasks.length) completedLessons++;
  }

  return {
    student: { name: student.name, code: student.code, studentId: student.student_id },
    progress: progress,
    completedLessons: completedLessons,
    totalLessons: myLessons.length,
    completedTasks: completedTasks,
    totalTasks: totalTasks,
    correctAnswers: correctCount,
    incorrectAnswers: incorrectCount,
    overallScore: overallScore,
    totalScore: totalScore,
    totalMaxScore: totalMaxScore,
    remainingTasks: totalTasks - completedTasks,
    recentSubmissions: recentSubs
  };
}

function doGetStudentCurricula(payload, session) {
  var studentId = session.userId;
  var students = sheetToObjects(getOrCreateSheet('Students'));
  var student = students.find(function(s) { return s.student_id === studentId; });
  var sc = sheetToObjects(getOrCreateSheet('Student_Curricula'));
  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var tasks = getTasksData();
  var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });

  var assignedCurIds = sc.filter(function(x) { return x.student_id === studentId; }).map(function(x) { return x.curriculum_id; });
  var completedTaskIds = mySubs.map(function(s) { return s.task_id; });

  var result = curricula.filter(function(c) {
    return assignedCurIds.indexOf(c.curriculum_id) !== -1 && c.status === 'active';
  }).map(function(c) {
    var curLessons = lessons.filter(function(l) { return l.curriculum_id === c.curriculum_id && l.status === 'active'; });
    var curTasks = tasks.filter(function(t) { return t.curriculum_id === c.curriculum_id && t.status === 'active'; });
    var curCompleted = curTasks.filter(function(t) { return completedTaskIds.indexOf(t.task_id) !== -1; });
    return {
      curriculum_id: c.curriculum_id, name: c.name, description: c.description, icon: c.icon,
      totalLessons: curLessons.length, totalTasks: curTasks.length, completedTasks: curCompleted.length,
      progress: curTasks.length > 0 ? Math.round((curCompleted.length / curTasks.length) * 100) : 0
    };
  });
  return { curricula: result };
}

function doGetLessons(payload, session) {
  var studentId = session.userId;
  var curriculumId = payload.curriculum_id;
  if (!curriculumId) throw new Error('curriculum_id is required');

  var sc = sheetToObjects(getOrCreateSheet('Student_Curricula'));
  if (!sc.find(function(x) { return x.student_id === studentId && x.curriculum_id === curriculumId; })) {
    throw new Error('You do not have access to this curriculum');
  }

  var students = sheetToObjects(getOrCreateSheet('Students'));
  var student = students.find(function(s) { return s.student_id === studentId; });
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var tasks = getTasksData();
  var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  var completedTaskIds = mySubs.map(function(s) { return s.task_id; });
  var myLessonStatuses = sheetToObjects(getOrCreateSheet('Student_Lessons')).filter(function(sl) { return sl.student_id === studentId; });
  var allFiles = sheetToObjects(getOrCreateSheet('Lesson_Files'));

  var curLessons = lessons.filter(function(l) { return l.curriculum_id === curriculumId && l.status === 'active'; })
                          .sort(function(a, b) { return Number(a.lesson_order) - Number(b.lesson_order); });

  var result = curLessons.map(function(l) {
    var lessonTasks = tasks.filter(function(t) { return t.lesson_id === l.lesson_id && t.status === 'active'; });
    var completed = lessonTasks.filter(function(t) { return completedTaskIds.indexOf(t.task_id) !== -1; });
    var progress = lessonTasks.length > 0 ? Math.round((completed.length / lessonTasks.length) * 100) : 0;

    var now = serverTime();
    var hasExpired = false, nearestDeadline = null;
    lessonTasks.forEach(function(t) {
      var dl = getTaskDeadline(t, studentId);
      if (dl) {
        if (dl < now) hasExpired = true;
        if (!nearestDeadline || dl < nearestDeadline) nearestDeadline = dl;
      }
    });

    var status = progress === 100 ? 'completed' : (hasExpired ? 'expired' : 'available');
    var slRecord = myLessonStatuses.find(function(sl) { return sl.lesson_id === l.lesson_id; });
    var cheatingStatus = (slRecord && slRecord.cheating_status === 'CHEATING') ? 'CHEATING' : 'none';

    return {
      lesson_id: l.lesson_id, title: l.title, description: l.description, lesson_order: l.lesson_order,
      totalTasks: lessonTasks.length, completedTasks: completed.length, progress: progress,
      status: status, cheatingStatus: cheatingStatus,
      deadline: nearestDeadline ? nearestDeadline.toISOString() : null,
      filesCount: allFiles.filter(function(f) { return f.lesson_id === l.lesson_id; }).length
    };
  });

  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));
  var curObj = curricula.find(function(c) { return c.curriculum_id === curriculumId; });
  return { curriculumName: curObj ? curObj.name : '', lessons: result };
}

function doGetTasks(payload, session) {
  var studentId = session.userId;
  var lessonId = payload.lesson_id;
  if (!lessonId) throw new Error('lesson_id is required');

  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var lesson = lessons.find(function(l) { return l.lesson_id === lessonId; });
  if (!lesson) throw new Error('Lesson not found');

  var sl = sheetToObjects(getOrCreateSheet('Student_Lessons')).find(function(x) { return x.student_id === studentId && x.lesson_id === lessonId; });
  
  var sc = sheetToObjects(getOrCreateSheet('Student_Curricula'));
  if (!sc.find(function(x) { return x.student_id === studentId && x.curriculum_id === lesson.curriculum_id; })) {
    throw new Error('You do not have access to this lesson');
  }

  var students = sheetToObjects(getOrCreateSheet('Students'));
  var student = students.find(function(s) { return s.student_id === studentId; });
  var tasks = getTasksData();
  var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  var now = serverTime();

  var lessonTasks = tasks.filter(function(t) { return t.lesson_id === lessonId && t.status === 'active'; });
  var result = lessonTasks.map(function(t) {
    var sub = mySubs.find(function(s) { return s.task_id === t.task_id; });
    var status = 'available';
    var deadline = getTaskDeadline(t, studentId);
    var isCheated = cheatLogs.some(function(l) { return l.details.indexOf(t.task_id) !== -1; });
    if (isCheated) status = 'locked';
    else if (sub) status = 'completed';
    else if (deadline && now > deadline) status = 'expired';

    return {
      task_id: t.task_id, title: t.title, type: t.type, points: Number(t.points) || 0,
      deadline: t.deadline || null, status: status, isCompleted: !!sub,
      score: sub ? Number(sub.score) : null,
      isCorrect: sub ? (String(sub.is_correct) === 'true' || sub.is_correct === true) : null
    };
  });
  return { lessonTitle: lesson.title, lessonDescription: lesson.description, tasks: result };
}

function doGetTaskDetail(payload, session) {
  var studentId = session.userId;
  var taskId = payload.task_id;
  if (!taskId) throw new Error('task_id is required');
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  if (cheatLogs.some(function(l) { return l.details.indexOf(taskId) !== -1; })) throw new Error('CHEATING_BLOCKED: You cannot access this task. It has been locked due to a cheating violation.');

  var tasks = getTasksData();
  var task = tasks.find(function(t) { return t.task_id === taskId; });
  if (!task) throw new Error('Task not found');

  var sl = sheetToObjects(getOrCreateSheet('Student_Lessons')).find(function(x) { return x.student_id === studentId && x.lesson_id === task.lesson_id; });
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  if (cheatLogs.some(function(l) { return l.details.indexOf(taskId) !== -1; })) throw new Error('CHEATING_BLOCKED: Submission rejected. This task is locked due to cheating.');
  
  var sc = sheetToObjects(getOrCreateSheet('Student_Curricula'));
  if (!sc.find(function(x) { return x.student_id === studentId && x.curriculum_id === task.curriculum_id; })) {
    throw new Error('You do not have access to this task');
  }

  var students = sheetToObjects(getOrCreateSheet('Students'));
  var student = students.find(function(s) { return s.student_id === studentId; });
  var now = serverTime();
  var deadline = getTaskDeadline(task, studentId);
  var isExpired = deadline && now > deadline;
  var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  var sub = mySubs.find(function(s) { return s.task_id === taskId; });

  var options = [];
  try {
    if (task.file_id) {
      var file = DriveApp.getFileById(task.file_id);
      options = JSON.parse(file.getBlob().getDataAsString());
    } else if (task.options) {
      options = JSON.parse(task.options);
    }
  } catch (e) {
    console.error("Error loading task options:", e);
  }

  var result = {
    task_id: task.task_id, lesson_id: task.lesson_id, title: task.title, question: task.question,
    type: task.type, options: options, points: Number(task.points) || 0,
    deadline: task.deadline || null, isExpired: isExpired, isCompleted: !!sub
  };
  if (sub) {
    result.studentAnswer = sub.student_answer; result.correctAnswer = sub.correct_answer;
    result.isCorrect = String(sub.is_correct) === 'true' || sub.is_correct === true;
    result.score = Number(sub.score); result.explanation = task.explanation;
    result.originalScore = sub.original_score; result.latePenalty = sub.late_penalty;
    result.submittedAt = sub.submitted_at; result.timeSpent = Number(sub.time_spent) || 0;
  }
  
  // Do NOT expose correct answers BEFORE submission
  if (!sub && result.options) {
      if (result.type === 'quiz') {
          for (var i = 0; i < result.options.length; i++) {
              delete result.options[i].correct_answer;
          }
      }
  }

  return result;
}

function doSubmitAnswer(payload, session) {
  var studentId = session.userId;
  var taskId = payload.task_id;
  var studentAnswer = payload.answer;
  var timeSpent = Number(payload.time_spent) || 0;

  if (!taskId) throw new Error('task_id is required');
  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') throw new Error('Answer is required');

  var tasks = getTasksData();
  var task = tasks.find(function(t) { return t.task_id === taskId; });
  if (!task) throw new Error('Task not found');
  if (task.status !== 'active') throw new Error('This task is not available');

  var sl = sheetToObjects(getOrCreateSheet('Student_Lessons')).find(function(x) { return x.student_id === studentId && x.lesson_id === task.lesson_id; });
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  if (cheatLogs.some(function(l) { return l.details.indexOf(taskId) !== -1; })) throw new Error('CHEATING_BLOCKED: Submission rejected. This task is locked due to cheating.');

  var sc = sheetToObjects(getOrCreateSheet('Student_Curricula'));
  if (!sc.find(function(x) { return x.student_id === studentId && x.curriculum_id === task.curriculum_id; })) {
    throw new Error('You do not have access to this task');
  }

  var now = serverTime();
  var deadline = getTaskDeadline(task, studentId);
  var allowLate = String(task.allow_late) === 'TRUE' || String(task.allow_late) === 'true';
  if (deadline && now > deadline && !allowLate) throw new Error('TASK_EXPIRED: This task is no longer available because its deadline has expired.');

  var students = sheetToObjects(getOrCreateSheet('Students'));
  var student = students.find(function(s) { return s.student_id === studentId; });
  var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  if (mySubs.find(function(s) { return s.task_id === taskId; })) throw new Error('You have already submitted this task. Answers cannot be changed.');

  var isCorrect = false;
  var score = 0;
  var maxScore = Number(task.points) || 10;
  
  if (task.type === 'quiz') {
      var questions = [];
      try {
        if (task.file_id) {
          var file = DriveApp.getFileById(task.file_id);
          questions = JSON.parse(file.getBlob().getDataAsString());
        } else if (task.options) {
          questions = JSON.parse(task.options);
        }
      } catch(e) {}
      
      var parsedAnswer;
      try { parsedAnswer = typeof studentAnswer === 'string' ? JSON.parse(studentAnswer) : studentAnswer; } 
      catch(e) { parsedAnswer = {}; }
      
      for(var i=0; i<questions.length; i++) {
          var q = questions[i];
          var ans = parsedAnswer['q' + i] || '';
          if (String(ans).trim() === String(q.correct_answer).trim()) {
              score += (Number(q.points) || 10);
          }
      }
      isCorrect = (score === maxScore); // fully correct
      studentAnswer = JSON.stringify(parsedAnswer);
  } else {
      var correctAnswer = String(task.correct_answer);
      isCorrect = String(studentAnswer).trim() === correctAnswer.trim();
      score = isCorrect ? maxScore : 0;
  }

  var extensions = sheetToObjects(getOrCreateSheet('Task_Extensions'));
  var latePenalty = 0;
  for (var i = 0; i < extensions.length; i++) {
    if (extensions[i].student_id === studentId && extensions[i].task_id === taskId) {
      if (Number(extensions[i].late_penalty) > 0) {
         latePenalty = Number(extensions[i].late_penalty);
      }
      break;
    }
  }
  
  var originalScore = score;
  if (latePenalty > 0) {
      score = Math.max(0, score - latePenalty);
  }

  var submissionStatus = (deadline && now > deadline && allowLate) ? 'late' : 'on_time';
  var submissionId = generateId('SUB');
  var submittedAt = now.toISOString();

  mySubs.push({
    submission_id: submissionId, student_id: studentId, task_id: taskId,
    curriculum_id: task.curriculum_id, lesson_id: task.lesson_id,
    student_answer: String(studentAnswer), correct_answer: task.type === 'quiz' ? 'QUIZ_COLLECTION' : String(task.correct_answer),
    is_correct: isCorrect, score: score, max_score: maxScore,
    original_score: originalScore, late_penalty: latePenalty,
    submitted_at: submittedAt, deadline: task.deadline || '',
    submission_status: submissionStatus, time_spent: timeSpent
  });
    saveStudentSubmissions(studentId, student.name, mySubs);
  try {
    var ss = getStudentSpreadsheet(studentId, student.name);
    var subSheet = ss.getSheetByName('Submissions');
    if (subSheet) subSheet.appendRow([taskId, isCorrect ? 'Pass' : totalScore, timeSpent, nowISO()]);
  } catch(e) {}


  // Update total submissions/score in Students sheet
  var studentSheet = getOrCreateSheet('Students');
  var sData = studentSheet.getDataRange().getValues();
  var sHeaders = sData[0];
  var idxTotalSubs = sHeaders.indexOf('total_submissions');
  var idxTotalScore = sHeaders.indexOf('total_score');
  
  for (var i = 1; i < sData.length; i++) {
    if (sData[i][sHeaders.indexOf('student_id')] === studentId) {
      var currentSubs = Number(sData[i][idxTotalSubs]) || 0;
      var currentScore = Number(sData[i][idxTotalScore]) || 0;
      studentSheet.getRange(i + 1, idxTotalSubs + 1).setValue(currentSubs + 1);
      studentSheet.getRange(i + 1, idxTotalScore + 1).setValue(currentScore + score);
      break;
    }
  }

  return {
    submissionId: submissionId, isCorrect: isCorrect, score: score, maxScore: maxScore,
    correctAnswer: task.type === 'quiz' ? 'QUIZ' : String(task.correct_answer), 
    explanation: task.explanation || '', submissionStatus: submissionStatus
  };
}

function doGetStudentReport(payload, session) {
  var studentId = session.userId;
  var students = sheetToObjects(getOrCreateSheet('Students'));
  var student = students.find(function(s) { return s.student_id === studentId; });

  var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var tasks = getTasksData();

  var report = mySubs.map(function(s) {
    var taskObj = tasks.find(function(t) { return t.task_id === s.task_id; }) || {};
    var lessonObj = lessons.find(function(l) { return l.lesson_id === s.lesson_id; }) || {};
    var curObj = curricula.find(function(c) { return c.curriculum_id === s.curriculum_id; }) || {};
    return {
      curriculum: curObj.name || s.curriculum_id, lesson: lessonObj.title || s.lesson_id,
      task: taskObj.title || s.task_id, question: taskObj.question || '',
      studentAnswer: s.student_answer, correctAnswer: s.correct_answer,
      isCorrect: String(s.is_correct) === 'true' || s.is_correct === true,
      score: Number(s.score), maxScore: Number(s.max_score),
      timeSpent: Number(s.time_spent) || 0, submittedAt: s.submitted_at
    };
  });

  var totalScore = 0, totalMax = 0, correct = 0, incorrect = 0;
  mySubs.forEach(function(s) {
    totalScore += Number(s.score) || 0; totalMax += Number(s.max_score) || 0;
    if (String(s.is_correct) === 'true' || s.is_correct === true) correct++; else incorrect++;
  });

  return {
    student: { name: student.name, code: student.code },
    submissions: report,
    summary: {
      totalTasks: mySubs.length, correct: correct, incorrect: incorrect,
      totalScore: totalScore, totalMaxScore: totalMax,
      scorePercentage: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
    }
  };
}

// ===================== ADMIN FUNCTIONS ======================

function doGetAdminDashboard(payload, session) {
  var students = sheetToObjects(getOrCreateSheet('Students'));
  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var tasks = getTasksData();

  var activeStudents = students.filter(function(s) { return s.status === 'active'; });
  var activeTasks = tasks.filter(function(t) { return t.status === 'active'; });

  var totalSubs = 0, totalScore = 0;
  students.forEach(function(s) {
    totalSubs += Number(s.total_submissions) || 0;
    totalScore += Number(s.total_score) || 0;
  });
  
  // Approximate total max score if not available easily.
  // For admin dashboard, we can just show totalScore or we can fetch a few recent submissions.
  // Since fetching ALL submissions takes too long, we'll skip recent activity on the main dashboard
  // or fetch from the first 5 students just as an example.
  var slData = sheetToObjects(getOrCreateSheet('Student_Lessons'));
  var cheatingCount = slData.filter(function(sl) { return sl.cheating_status === 'CHEATING'; }).length;

  return {
    totalStudents: students.length,
    activeStudents: activeStudents.length,
    totalCurricula: curricula.length,
    totalLessons: lessons.length,
    totalTasks: activeTasks.length,
    totalSubmissions: totalSubs,
    averageScore: totalSubs > 0 ? Math.round(totalScore / totalSubs) : 0, // simple average per submission
    cheatingIncidents: cheatingCount,
    recentActivity: [] // Omitted for performance
  };
}

function doGetAllStudents(payload, session) {
  var students = sheetToObjects(getOrCreateSheet('Students'));
  var sc = sheetToObjects(getOrCreateSheet('Student_Curricula'));
  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));

  var result = students.map(function(s) {
    var assigned = sc.filter(function(x) { return x.student_id === s.student_id; });
    var assignedNames = assigned.map(function(a) {
      var cur = curricula.find(function(c) { return c.curriculum_id === a.curriculum_id; });
      return cur ? cur.name : a.curriculum_id;
    });
    var assignedIds = assigned.map(function(a) { return a.curriculum_id; });
    return {
      student_id: s.student_id, name: s.name, code: s.code, email: s.email || '',
      status: s.status, created_at: s.created_at, 
      assignedCurricula: assignedNames,
      assignedCurriculaIds: assignedIds,
      totalSubmissions: Number(s.total_submissions) || 0
    };
  });
  return { students: result };
}

function doAddStudent(payload, session) {
  var name = payload.name;
  var code = payload.code;
  var password = payload.password;
  var email = payload.email || '';
  var status = payload.status || 'active';
  var curriculaIds = payload.curricula_ids || [];

  if (!name || !code || !password) throw new Error('Name, code, and password are required');

  var sheet = getOrCreateSheet('Students');
  var existing = sheetToObjects(sheet);
  for (var i = 0; i < existing.length; i++) {
    if (String(existing[i].code) === String(code)) {
      throw new Error('A student with this code already exists');
    }
  }

  var studentId = generateId('STU');
  var hash = hashPassword(password);
  // include total_submissions and total_score default 0
  sheet.appendRow([studentId, name, code, hash, email, status, nowISO(), 0, 0]);

  // Handle assigned curricula
  if (curriculaIds && curriculaIds.length > 0) {
      var scSheet = getOrCreateSheet('Student_Curricula');
      for (var i=0; i<curriculaIds.length; i++) {
          scSheet.appendRow([studentId, curriculaIds[i], nowISO()]);
      }
  }

  try {
    var folder = getStudentFolder(studentId, name);
    writeJsonToFolder(folder, 'profile.json', {
      student_id: studentId, name: name, code: code, email: email, status: status, curricula: curriculaIds
    });
    writeJsonToFolder(folder, 'answers.json', {
      student_id: studentId, student_name: name, answers: []
    });
  } catch (e) {}

  return { student_id: studentId, name: name };
}

function doUpdateStudent(payload, session) {
  var studentId = payload.student_id;
  if (!studentId) throw new Error('student_id is required');

  var sheet = getOrCreateSheet('Students');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var found = false;
  var sName = '';

  for (var i = 1; i < data.length; i++) {
    if (data[i][headers.indexOf('student_id')] === studentId) {
      if (payload.name !== undefined) data[i][headers.indexOf('name')] = payload.name;
      if (payload.code !== undefined) {
        var existing = sheetToObjects(sheet);
        for (var j = 0; j < existing.length; j++) {
          if (existing[j].student_id !== studentId && String(existing[j].code) === String(payload.code)) {
            throw new Error('Another student already uses this code');
          }
        }
        data[i][headers.indexOf('code')] = payload.code;
      }
      if (payload.email !== undefined) data[i][headers.indexOf('email')] = payload.email;
      if (payload.status !== undefined) data[i][headers.indexOf('status')] = payload.status;
      sName = data[i][headers.indexOf('name')];
      found = true;
      break;
    }
  }

  if (!found) throw new Error('Student not found');
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);

  // Update curricula assignments
  if (payload.curricula_ids !== undefined) {
      var newIds = payload.curricula_ids;
      var scSheet = getOrCreateSheet('Student_Curricula');
      var scData = scSheet.getDataRange().getValues();
      var scHeaders = scData[0];
      
      // Delete old
      for (var i = scData.length - 1; i > 0; i--) {
          if (scData[i][scHeaders.indexOf('student_id')] === studentId) {
              scSheet.deleteRow(i + 1);
          }
      }
      
      // Add new
      for (var i = 0; i < newIds.length; i++) {
          scSheet.appendRow([studentId, newIds[i], nowISO()]);
      }
  }

  try {
    var folder = getStudentFolder(studentId, sName);
    var p = readJsonFromFolder(folder, 'profile.json');
    if (p) {
      if (payload.name !== undefined) p.name = payload.name;
      if (payload.code !== undefined) p.code = payload.code;
      if (payload.email !== undefined) p.email = payload.email;
      if (payload.status !== undefined) p.status = payload.status;
      if (payload.curricula_ids !== undefined) p.curricula = payload.curricula_ids;
      writeJsonToFolder(folder, 'profile.json', p);
    }
  } catch(e) {}

  return { updated: true };
}

function doDeleteStudent(payload, session) {
  var studentId = payload.student_id;
  if (!studentId) throw new Error('student_id is required');

  var sheet = getOrCreateSheet('Students');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxId = headers.indexOf('student_id');

  for (var i = 1; i < data.length; i++) {
    if (data[i][idxId] === studentId) {
      sheet.deleteRow(i + 1);
      return { deleted: true };
    }
  }
  throw new Error('Student not found');
}

function doResetPassword(payload, session) {
  var studentId = payload.student_id;
  var newPassword = payload.new_password;
  if (!studentId || !newPassword) throw new Error('student_id and new_password are required');

  var sheet = getOrCreateSheet('Students');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxId = headers.indexOf('student_id');

  for (var i = 1; i < data.length; i++) {
    if (data[i][idxId] === studentId) {
      sheet.getRange(i + 1, headers.indexOf('password_hash') + 1).setValue(hashPassword(newPassword));
      return { reset: true };
    }
  }
  throw new Error('Student not found');
}

function doGetStudentProfile(payload, session) {
  var studentId = payload.student_id;
  if (!studentId) throw new Error('student_id is required');

  var students = sheetToObjects(getOrCreateSheet('Students'));
  var student = students.find(function(s) { return s.student_id === studentId; });
  if (!student) throw new Error('Student not found');

  var sc = sheetToObjects(getOrCreateSheet('Student_Curricula'));
  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var tasks = getTasksData();
  var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  var studentLessonsData = sheetToObjects(getOrCreateSheet('Student_Lessons'));
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs'));

  var assignedCurIds = sc.filter(function(x) { return x.student_id === studentId; }).map(function(x) { return x.curriculum_id; });
  var completedTaskIds = mySubs.map(function(s) { return s.task_id; });

  var totalScore = 0, totalMax = 0, correct = 0, incorrect = 0;
  for (var i = 0; i < mySubs.length; i++) {
    totalScore += Number(mySubs[i].score) || 0; totalMax += Number(mySubs[i].max_score) || 0;
    if (String(mySubs[i].is_correct) === 'true' || mySubs[i].is_correct === true) correct++; else incorrect++;
  }

  var myLessonStatuses = studentLessonsData.filter(function(sl) { return sl.student_id === studentId; });
  var curriculumProgress = [];

  for (var i = 0; i < assignedCurIds.length; i++) {
    var curId = assignedCurIds[i];
    var curObj = curricula.find(function(c) { return c.curriculum_id === curId; });
    var curTasks = tasks.filter(function(t) { return t.curriculum_id === curId && t.status === 'active'; });
    var curCompleted = curTasks.filter(function(t) { return completedTaskIds.indexOf(t.task_id) !== -1; });
    var curSubs = mySubs.filter(function(s) { return s.curriculum_id === curId; });
    var curScore = 0, curMax = 0;
    curSubs.forEach(function(s) { curScore += Number(s.score) || 0; curMax += Number(s.max_score) || 0; });

    var curLessons = lessons.filter(function(l) { return l.curriculum_id === curId && l.status === 'active'; });
    var lessonProgress = curLessons.map(function(l) {
      var lTasks = curTasks.filter(function(t) { return t.lesson_id === l.lesson_id; });
      var lCompleted = lTasks.filter(function(t) { return completedTaskIds.indexOf(t.task_id) !== -1; });
      var lSubs = curSubs.filter(function(s) { return s.lesson_id === l.lesson_id; });
      var lScore = 0, lMax = 0, lTimeTotal = 0;
      lSubs.forEach(function(s) { lScore += Number(s.score) || 0; lMax += Number(s.max_score) || 0; lTimeTotal += Number(s.time_spent) || 0; });
      var slRecord = myLessonStatuses.find(function(sl) { return sl.lesson_id === l.lesson_id; });

      return {
        lesson_id: l.lesson_id, title: l.title, totalTasks: lTasks.length, completedTasks: lCompleted.length,
        progress: lTasks.length > 0 ? Math.round((lCompleted.length / lTasks.length) * 100) : 0,
        score: lMax > 0 ? Math.round((lScore / lMax) * 100) : 0, totalTimeSpent: lTimeTotal,
        lessonStatus: slRecord ? slRecord.status : 'not_started',
        cheatingStatus: slRecord ? (slRecord.cheating_status || 'none') : 'none',
        startedAt: slRecord ? slRecord.started_at : null, completedAt: slRecord ? slRecord.completed_at : null,
        totalLessonTime: slRecord ? slRecord.total_time : null
      };
    });

    curriculumProgress.push({
      curriculum_id: curId, curriculumName: curObj ? curObj.name : curId,
      totalTasks: curTasks.length, completedTasks: curCompleted.length,
      progress: curTasks.length > 0 ? Math.round((curCompleted.length / curTasks.length) * 100) : 0,
      score: curMax > 0 ? Math.round((curScore / curMax) * 100) : 0, lessons: lessonProgress
    });
  }

  var allMyTasks = tasks.filter(function(t) { return assignedCurIds.indexOf(t.curriculum_id) !== -1 && t.status === 'active'; });
  var studentCheatLogs = cheatLogs.filter(function(log) { return log.student_id === studentId; });

  return {
    student: { student_id: student.student_id, name: student.name, code: student.code, email: student.email || '', status: student.status, created_at: student.created_at },
    overall: {
      totalTasks: allMyTasks.length, completedTasks: mySubs.length, correctAnswers: correct, incorrectAnswers: incorrect,
      progress: allMyTasks.length > 0 ? Math.round((mySubs.length / allMyTasks.length) * 100) : 0,
      totalScore: totalScore, totalMaxScore: totalMax, scorePercentage: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
    },
    curricula: curriculumProgress,
    cheatingLogs: studentCheatLogs, hasCheating: studentCheatLogs.length > 0,
    assignedCurricula: assignedCurIds.map(function(id) { var c = curricula.find(function(x) { return x.curriculum_id === id; }); return c ? c.name : id; })
  };
}

function doGetStudentAnswers(payload, session) {
  var studentId = payload.student_id;
  if (!studentId) throw new Error('student_id is required');

  var students = sheetToObjects(getOrCreateSheet('Students'));
  var student = students.find(function(s) { return s.student_id === studentId; });
  if (!student) throw new Error('Student not found');
  var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs')).filter(function(x) { return x.student_id === studentId; });
  var tasks = getTasksData();
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));

  var result = mySubs.map(function(s) {
    var task = tasks.find(function(t) { return t.task_id === s.task_id; }) || {};
    var lesson = lessons.find(function(l) { return l.lesson_id === s.lesson_id; }) || {};
    var cur = curricula.find(function(c) { return c.curriculum_id === s.curriculum_id; }) || {};
    var taskOptions = task.options || '';
    if (task.file_id) {
      try {
        var file = DriveApp.getFileById(task.file_id);
        taskOptions = file.getBlob().getDataAsString();
      } catch(e) {}
    }
    return {
      task_id: s.task_id, taskTitle: task.title || s.task_id, question: task.question || '',
      options: taskOptions, type: task.type || 'text',
      curriculum_id: s.curriculum_id, lesson_id: s.lesson_id,
      curriculum: cur.name || s.curriculum_id, lesson: lesson.title || s.lesson_id,
      studentAnswer: s.student_answer, correctAnswer: s.correct_answer,
      isCorrect: String(s.is_correct) === 'true' || s.is_correct === true,
      score: Number(s.score), maxScore: Number(s.max_score),
      timeSpent: Number(s.time_spent) || 0, submittedAt: s.submitted_at,
      deadline: s.deadline, submissionStatus: s.submission_status
    };
  });
  return { answers: result };
}

// ---- Curriculum CRUD ----

function doGetAllCurricula(payload, session) {
  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var tasks = getTasksData();

  var result = curricula.map(function(c) {
    var curLessons = lessons.filter(function(l) { return l.curriculum_id === c.curriculum_id; });
    var curTasks = tasks.filter(function(t) { return t.curriculum_id === c.curriculum_id; });
    return {
      curriculum_id: c.curriculum_id, name: c.name, description: c.description, icon: c.icon,
      status: c.status, created_at: c.created_at, totalLessons: curLessons.length, totalTasks: curTasks.length
    };
  });
  return { curricula: result };
}

function doAddCurriculum(payload, session) {
  var name = payload.name;
  if (!name) throw new Error('Curriculum name is required');

  var sheet = getOrCreateSheet('Curricula');
  var curId = generateId('CUR');
  sheet.appendRow([
    curId, name, payload.description || '', payload.icon || '📚',
    payload.status || 'active', nowISO()
  ]);

  return { curriculum_id: curId, name: name };
}

function doUpdateCurriculum(payload, session) {
  var curId = payload.curriculum_id;
  if (!curId) throw new Error('curriculum_id is required');

  var sheet = getOrCreateSheet('Curricula');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxId = headers.indexOf('curriculum_id');

  for (var i = 1; i < data.length; i++) {
    if (data[i][idxId] === curId) {
      var rowNum = i + 1;
      if (payload.name !== undefined) sheet.getRange(rowNum, headers.indexOf('name') + 1).setValue(payload.name);
      if (payload.description !== undefined) sheet.getRange(rowNum, headers.indexOf('description') + 1).setValue(payload.description);
      if (payload.icon !== undefined) sheet.getRange(rowNum, headers.indexOf('icon') + 1).setValue(payload.icon);
      if (payload.status !== undefined) sheet.getRange(rowNum, headers.indexOf('status') + 1).setValue(payload.status);
      return { updated: true };
    }
  }
  throw new Error('Curriculum not found');
}

function doDeleteCurriculum(payload, session) {
  var curId = payload.curriculum_id;
  if (!curId) throw new Error('curriculum_id is required');

  var sheet = getOrCreateSheet('Curricula');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxId = headers.indexOf('curriculum_id');

  for (var i = 1; i < data.length; i++) {
    if (data[i][idxId] === curId) {
      sheet.deleteRow(i + 1);
      return { deleted: true };
    }
  }
  throw new Error('Curriculum not found');
}

function doAssignCurriculum(payload, session) {
  var studentId = payload.student_id;
  var curriculumId = payload.curriculum_id;
  if (!studentId || !curriculumId) throw new Error('student_id and curriculum_id are required');

  var sheet = getOrCreateSheet('Student_Curricula');
  var existing = sheetToObjects(sheet);
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].student_id === studentId && existing[i].curriculum_id === curriculumId) {
      throw new Error('Curriculum already assigned to this student');
    }
  }

  sheet.appendRow([studentId, curriculumId]);

  try {
    var students = sheetToObjects(getOrCreateSheet('Students'));
    var student = students.find(function(s) { return s.student_id === studentId; });
    if (student) {
      var folder = getStudentFolder(studentId, student.name);
      var profile = readJsonFromFolder(folder, 'profile.json') || { student_id: studentId, curricula: [] };
      if (profile.curricula.indexOf(curriculumId) === -1) profile.curricula.push(curriculumId);
      writeJsonToFolder(folder, 'profile.json', profile);
    }
  } catch (e) { Logger.log('Drive error: ' + e.message); }

  return { assigned: true };
}

function doRemoveCurriculum(payload, session) {
  var studentId = payload.student_id;
  var curriculumId = payload.curriculum_id;
  if (!studentId || !curriculumId) throw new Error('student_id and curriculum_id are required');

  var sheet = getOrCreateSheet('Student_Curricula');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];

  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][headers.indexOf('student_id')] === studentId &&
        data[i][headers.indexOf('curriculum_id')] === curriculumId) {
      sheet.deleteRow(i + 1);
      return { removed: true };
    }
  }
  throw new Error('Assignment not found');
}

// ---- Lesson CRUD ----

function doGetAllLessons(payload, session) {
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));
  var tasks = getTasksData();
  var lessonFiles = sheetToObjects(getOrCreateSheet('Lesson_Files'));

  if (payload.curriculum_id) lessons = lessons.filter(function(l) { return l.curriculum_id === payload.curriculum_id; });

  var result = lessons.map(function(l) {
    var cur = curricula.find(function(c) { return c.curriculum_id === l.curriculum_id; });
    var lessonTasks = tasks.filter(function(t) { return t.lesson_id === l.lesson_id; });
    var files = lessonFiles.filter(function(f) { return f.lesson_id === l.lesson_id; });
    return {
      lesson_id: l.lesson_id, curriculum_id: l.curriculum_id, curriculumName: cur ? cur.name : l.curriculum_id,
      title: l.title, description: l.description, lesson_order: l.lesson_order, status: l.status,
      created_at: l.created_at, totalTasks: lessonTasks.length, filesCount: files.length
    };
  });
  return { lessons: result };
}

function doAddLesson(payload, session) {
  var curriculumId = payload.curriculum_id;
  var title = payload.title;
  if (!curriculumId || !title) throw new Error('curriculum_id and title are required');

  var sheet = getOrCreateSheet('Lessons');
  var lessonId = generateId('LES');
  sheet.appendRow([
    lessonId, curriculumId, title, payload.description || '',
    payload.lesson_order || 1, payload.status || 'active', nowISO()
  ]);

  return { lesson_id: lessonId, title: title };
}

function doUpdateLesson(payload, session) {
  var lessonId = payload.lesson_id;
  if (!lessonId) throw new Error('lesson_id is required');

  var sheet = getOrCreateSheet('Lessons');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxId = headers.indexOf('lesson_id');

  for (var i = 1; i < data.length; i++) {
    if (data[i][idxId] === lessonId) {
      var rowNum = i + 1;
      if (payload.title !== undefined) sheet.getRange(rowNum, headers.indexOf('title') + 1).setValue(payload.title);
      if (payload.description !== undefined) sheet.getRange(rowNum, headers.indexOf('description') + 1).setValue(payload.description);
      if (payload.lesson_order !== undefined) sheet.getRange(rowNum, headers.indexOf('lesson_order') + 1).setValue(payload.lesson_order);
      if (payload.status !== undefined) sheet.getRange(rowNum, headers.indexOf('status') + 1).setValue(payload.status);
      return { updated: true };
    }
  }
  throw new Error('Lesson not found');
}

function doDeleteLesson(payload, session) {
  var lessonId = payload.lesson_id;
  if (!lessonId) throw new Error('lesson_id is required');

  var sheet = getOrCreateSheet('Lessons');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxId = headers.indexOf('lesson_id');

  for (var i = 1; i < data.length; i++) {
    if (data[i][idxId] === lessonId) {
      sheet.deleteRow(i + 1);
      return { deleted: true };
    }
  }
  throw new Error('Lesson not found');
}

// ---- Task CRUD ----

function doGetAllTasks(payload, session) {
  var tasks = getTasksData();
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));

  if (payload.lesson_id) tasks = tasks.filter(function(t) { return t.lesson_id === payload.lesson_id; });
  if (payload.curriculum_id) tasks = tasks.filter(function(t) { return t.curriculum_id === payload.curriculum_id; });

  var result = tasks.map(function(t) {
    var lesson = lessons.find(function(l) { return l.lesson_id === t.lesson_id; });
    var cur = curricula.find(function(c) { return c.curriculum_id === t.curriculum_id; });
    var options = [];
    try { if (t.options) options = JSON.parse(t.options); } catch(e) {}
    return {
      task_id: t.task_id, lesson_id: t.lesson_id, curriculum_id: t.curriculum_id,
      lessonTitle: lesson ? lesson.title : t.lesson_id, curriculumName: cur ? cur.name : t.curriculum_id,
      title: t.title, question: t.question, type: t.type, options: options,
      correct_answer: t.correct_answer, explanation: t.explanation, points: Number(t.points) || 0,
      deadline: t.deadline, allow_late: t.allow_late, status: t.status, created_at: t.created_at
    };
  });
  return { tasks: result };
}

function doAddTask(payload, session) {
  var lessonId = payload.lesson_id;
  var curriculumId = payload.curriculum_id;
  var title = payload.title;
  var question = payload.question;

  if (!lessonId || !title || !question) throw new Error('lesson_id, title, and question are required');
  
  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  
  if (!curriculumId) {
    var lesson = lessons.find(function(l) { return l.lesson_id === lessonId; });
    if (lesson) curriculumId = lesson.curriculum_id;
  }

  var c = curricula.find(function(x) { return x.curriculum_id === curriculumId; });
  var cName = c ? c.name : curriculumId;

  var l = lessons.find(function(x) { return x.lesson_id === lessonId; });
  var lName = l ? l.title : lessonId;

  var tasks = getTasksData();
  var taskId = payload.task_id || generateId('TASK');
  
  var lessonTasks = tasks.filter(function(t) { return t.lesson_id === lessonId; });
  var taskNumber = lessonTasks.length + 1;
  
  var taskFolder = getTaskDriveFolder(cName, lName, taskNumber);
  var file = writeJsonToFolder(taskFolder, 'questions.json', payload.options || []);
  var fileId = file.getId();

  tasks.push({
    task_id: taskId, 
    task_number: taskNumber,
    lesson_id: lessonId, 
    curriculum_id: curriculumId,
    title: title, 
    question: question, 
    type: payload.type || 'multiple_choice',
    options: "", 
    file_id: fileId,
    correct_answer: payload.correct_answer || '',
    explanation: payload.explanation || '', 
    points: payload.points || 10,
    deadline: payload.deadline || '', 
    allow_late: payload.allow_late || 'FALSE',
    status: payload.status || 'active', 
    created_at: nowISO()
  });
  saveTasksData(tasks);
  return { task_id: taskId, title: title, task_number: taskNumber, file_id: fileId };
}

function doUpdateTask(payload, session) {
  var taskId = payload.task_id;
  if (!taskId) throw new Error('task_id is required');
  
  var tasks = getTasksData();
  var found = false;
  
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].task_id === taskId) {
      if (payload.title !== undefined) tasks[i].title = payload.title;
      if (payload.question !== undefined) tasks[i].question = payload.question;
      if (payload.type !== undefined) tasks[i].type = payload.type;
      
      if (payload.options !== undefined) {
        if (tasks[i].file_id) {
           var file = DriveApp.getFileById(tasks[i].file_id);
           file.setContent(JSON.stringify(payload.options, null, 2));
        } else {
           var curricula = sheetToObjects(getOrCreateSheet('Curricula'));
           var c = curricula.find(function(x) { return x.curriculum_id === tasks[i].curriculum_id; });
           var cName = c ? c.name : tasks[i].curriculum_id;

           var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
           var l = lessons.find(function(x) { return x.lesson_id === tasks[i].lesson_id; });
           var lName = l ? l.title : tasks[i].lesson_id;
           
           var taskNumber = tasks[i].task_number || (i + 1);
           var taskFolder = getTaskDriveFolder(cName, lName, taskNumber);
           var newFile = writeJsonToFolder(taskFolder, 'questions.json', payload.options);
           tasks[i].file_id = newFile.getId();
        }
        tasks[i].options = ""; // clear old stringified
      }
      
      if (payload.correct_answer !== undefined) tasks[i].correct_answer = payload.correct_answer;
      if (payload.explanation !== undefined) tasks[i].explanation = payload.explanation;
      if (payload.points !== undefined) tasks[i].points = payload.points;
      if (payload.deadline !== undefined) tasks[i].deadline = payload.deadline;
      if (payload.allow_late !== undefined) tasks[i].allow_late = payload.allow_late;
      if (payload.status !== undefined) tasks[i].status = payload.status;
      found = true;
      break;
    }
  }
  if (!found) throw new Error('Task not found');
  saveTasksData(tasks);
  return { updated: true };
}

function doDeleteTask(payload, session) {
  var taskId = payload.task_id;
  if (!taskId) throw new Error('task_id is required');
  var tasks = getTasksData();
  var found = false;
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].task_id === taskId) {
      tasks.splice(i, 1);
      found = true;
      break;
    }
  }
  if (!found) throw new Error('Task not found');
  saveTasksData(tasks);
  return { deleted: true };
}

// ---- JSON Import ----

function doImportTasks(payload, session) {
  var tasksJson = payload.tasks;
  var curriculumId = payload.curriculum_id;
  var lessonId = payload.lesson_id;
  var taskTitle = payload.task_title;
  var deadline = payload.deadline || '';
  var allowLate = payload.allow_late || 'FALSE';

  if (!tasksJson || !curriculumId || !lessonId || !taskTitle) throw new Error('tasks, curriculum_id, lesson_id, and task_title are required');

  var tasksArray;
  if (typeof tasksJson === 'string') {
    try { tasksArray = JSON.parse(tasksJson); } catch (e) { throw new Error('Invalid JSON format: ' + e.message); }
  } else { tasksArray = tasksJson; }
  
  if (!Array.isArray(tasksArray)) throw new Error('tasks must be an array');
  if (tasksArray.length === 0) throw new Error('No tasks to import');

  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));
  var c = curricula.find(function(x) { return x.curriculum_id === curriculumId; });
  var cName = c ? c.name : curriculumId;

  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  var l = lessons.find(function(x) { return x.lesson_id === lessonId; });
  var lName = l ? l.title : lessonId;

  var tasks = getTasksData();
  var lessonTasks = tasks.filter(function(t) { return t.lesson_id === lessonId; });
  var taskNumber = lessonTasks.length + 1;
  
  var taskId = payload.task_id || generateId('TASK');
  var totalPoints = 0;
  for(var i=0; i<tasksArray.length; i++) {
     totalPoints += Number(tasksArray[i].points) || 10;
  }

  var taskFolder = getTaskDriveFolder(cName, lName, taskNumber);
  var file = writeJsonToFolder(taskFolder, 'questions.json', tasksArray);
  var fileId = file.getId();

  tasks.push({
    task_id: taskId,
    task_number: taskNumber,
    lesson_id: lessonId,
    curriculum_id: curriculumId,
    title: taskTitle,
    question: "QUIZ_COLLECTION",
    type: "quiz",
    options: "", 
    file_id: fileId,
    correct_answer: "",
    explanation: "",
    points: totalPoints,
    deadline: deadline,
    allow_late: allowLate,
    status: 'active',
    created_at: nowISO()
  });

  saveTasksData(tasks);
  
  return { 
    totalReceived: tasksArray.length, 
    imported: tasksArray.length, 
    failed: 0, 
    importedTasks: [{task_id: taskId, title: taskTitle}], 
    errors: [] 
  };
}

// ---- Admin Report ----

function doGetAdminReport(payload, session) {
  var studentId = payload.student_id;
  if (!studentId) throw new Error('student_id is required');
  return doGetStudentProfile(payload, session);
}

function doExtendTaskDeadline(payload, session) {
  var studentId = payload.student_id;
  var taskId = payload.task_id;
  var newDeadline = payload.new_deadline;
  if (!studentId || !taskId || !newDeadline) throw new Error('student_id, task_id, and new_deadline are required');
  
  var sheet = getOrCreateSheet('Task_Extensions');
  var extensions = sheetToObjects(sheet);
  var existingRow = -1;
  for (var i = 0; i < extensions.length; i++) {
    if (extensions[i].student_id === studentId && extensions[i].task_id === taskId) {
      existingRow = i + 2;
      break;
    }
  }
  
  // 10-point late penalty for unlocking/extending
  var penalty = 10;
  
  if (existingRow > 0) {
    sheet.getRange(existingRow, 4).setValue(newDeadline);
    sheet.getRange(existingRow, 6).setValue(penalty); // late_penalty column
  } else {
    sheet.appendRow([generateId('EXT'), studentId, taskId, newDeadline, nowISO(), penalty]);
  }
  
  // Also clear any cheating logs for this task
  var cheatSheet = getOrCreateSheet('Anti_Cheat_Logs');
  var cheatLogs = sheetToObjects(cheatSheet);
  for (var j = cheatLogs.length - 1; j >= 0; j--) {
    if (cheatLogs[j].student_id === studentId && String(cheatLogs[j].details).indexOf(taskId) !== -1) {
      cheatSheet.deleteRow(j + 2);
    }
  }
  
  return { success: true, message: 'Task unlocked and deadline extended' };
}

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


function doGetCurriculaAndLessons(payload, session) {
  var curricula = sheetToObjects(getOrCreateSheet('Curricula'));
  var lessons = sheetToObjects(getOrCreateSheet('Lessons'));
  return { curricula: curricula, lessons: lessons };
}

function doGetLessonTracking(payload, session) {
  var lessonId = payload.lesson_id;
  if (!lessonId) throw new Error('lesson_id is required');

  var students = sheetToObjects(getOrCreateSheet('Students'));
  var tasks = getTasksData().filter(function(t) { return t.lesson_id === lessonId && t.status === 'active'; });
  var cheatLogs = sheetToObjects(getOrCreateSheet('Anti_Cheat_Logs'));
  var tracking = [];
  var now = serverTime();

  // For each student, get their submissions. Doing this in a loop could be slow if there are many students.
  // We'll collect all submissions at once if possible, but Google Drive files are per-student.
  // Let's just fetch them for all students assigned to this curriculum.
  var sc = sheetToObjects(getOrCreateSheet('Student_Curricula'));
  
  var lesson = sheetToObjects(getOrCreateSheet('Lessons')).find(function(l) { return l.lesson_id === lessonId; });
  var curriculumId = lesson ? lesson.curriculum_id : null;
  
  var assignedStudents = students.filter(function(st) {
    return sc.some(function(x) { return x.student_id === st.student_id && x.curriculum_id === curriculumId; });
  });

  assignedStudents.forEach(function(student) {
    var mySubs = getStudentSubmissions(student.student_id, student.name) || [];
    var studentCheat = cheatLogs.filter(function(l) { return l.student_id === student.student_id && l.lesson_id === lessonId; });
    
    tasks.forEach(function(task) {
      var sub = mySubs.find(function(s) { return s.task_id === task.task_id; });
      var isCheated = studentCheat.some(function(l) { return String(l.details).indexOf(task.task_id) !== -1; });
      var deadline = getTaskDeadline(task, student.student_id);
      
      var status = 'available';
      if (isCheated) status = 'locked';
      else if (sub) status = 'completed';
      else if (deadline && now > deadline) status = 'expired';
      
      if (status !== 'available') {
        tracking.push({
          student_id: student.student_id,
          task_id: task.task_id,
          status: status,
          score: sub ? sub.score : 0
        });
      }
    });
  });

  return { students: assignedStudents, tasks: tasks, tracking: tracking };
}

function doGetStudentAnswer(payload, session) {
  var studentId = payload.student_id;
  var taskId = payload.task_id;
  if (!studentId || !taskId) throw new Error('student_id and task_id are required');
  
  var students = sheetToObjects(getOrCreateSheet('Students'));
  var student = students.find(function(s) { return s.student_id === studentId; });
  if (!student) throw new Error('Student not found');
  
  var mySubs = getStudentSubmissions(studentId, student.name) || [];
  var sub = mySubs.find(function(s) { return s.task_id === taskId; });
  
  return { answer: sub || null };
}
