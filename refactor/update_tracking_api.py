import re

with open('backend/Code.gs', 'r', encoding='utf-8') as f:
    content = f.read()

# Add routing for new APIs
routes = """      case 'getLessonTracking':   return guardAdmin(payload, doGetLessonTracking);
      case 'getStudentAnswer':    return guardAdmin(payload, doGetStudentAnswer);
      case 'getCurriculaAndLessons': return guardAdmin(payload, doGetCurriculaAndLessons);
"""

content = content.replace("case 'getStudentProfile':   return guardAdmin(payload, doGetStudentProfile);", "case 'getStudentProfile':   return guardAdmin(payload, doGetStudentProfile);\n" + routes)

# Add function implementations
funcs = """
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
"""

content = content + "\n" + funcs

with open('backend/Code.gs', 'w', encoding='utf-8') as f:
    f.write(content)
