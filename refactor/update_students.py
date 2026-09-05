import re

with open('../backend/Code.gs', 'r', encoding='utf-8') as f:
    code = f.read()

new_add_student = """function doAddStudent(payload, session) {
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
}"""

new_update_student = """function doUpdateStudent(payload, session) {
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
}"""

new_get_all_students = """function doGetAllStudents(payload, session) {
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
}"""

def replace_function(source, func_name, new_code):
    pattern = r"function\s+" + func_name + r"\s*\("
    match = re.search(pattern, source)
    if not match:
        print(f"Warning: function {func_name} not found!")
        return source
    
    start_idx = match.start()
    brace_start = source.find("{", start_idx)
    
    brace_count = 1
    i = brace_start + 1
    in_string = False
    string_char = ''
    while i < len(source) and brace_count > 0:
        c = source[i]
        if not in_string:
            if c in ('"', "'", '`'):
                in_string = True
                string_char = c
            elif c == '{':
                brace_count += 1
            elif c == '}':
                brace_count -= 1
        else:
            if c == string_char and source[i-1] != '\\':
                in_string = False
        i += 1
        
    end_idx = i
    return source[:start_idx] + new_code + source[end_idx:]

code = replace_function(code, 'doAddStudent', new_add_student)
code = replace_function(code, 'doUpdateStudent', new_update_student)
code = replace_function(code, 'doGetAllStudents', new_get_all_students)

with open('../backend/Code.gs', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated students API")
