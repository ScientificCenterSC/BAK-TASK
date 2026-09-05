import re

with open('../backend/Code.gs', 'r', encoding='utf-8') as f:
    code = f.read()

new_submit_answer = """function doSubmitAnswer(payload, session) {
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
  if (sl && sl.cheating_status === 'CHEATING') throw new Error('CHEATING_BLOCKED: Submission rejected. This lesson has been terminated due to cheating.');

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
  if (mySubs.find(function(s) { return s.task_id === taskId; })) throw new Error('You have already submitted this task. Answers cannot be changed.');

  var isCorrect = false;
  var score = 0;
  var maxScore = Number(task.points) || 10;
  
  if (task.type === 'quiz') {
      var questions = [];
      try { questions = JSON.parse(task.options); } catch(e) {}
      
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

  var submissionStatus = (deadline && now > deadline && allowLate) ? 'late' : 'on_time';
  var submissionId = generateId('SUB');
  var submittedAt = now.toISOString();

  mySubs.push({
    submission_id: submissionId, student_id: studentId, task_id: taskId,
    curriculum_id: task.curriculum_id, lesson_id: task.lesson_id,
    student_answer: String(studentAnswer), correct_answer: task.type === 'quiz' ? 'QUIZ_COLLECTION' : String(task.correct_answer),
    is_correct: isCorrect, score: score, max_score: maxScore,
    submitted_at: submittedAt, deadline: task.deadline || '',
    submission_status: submissionStatus, time_spent: timeSpent
  });
  saveStudentSubmissions(studentId, student.name, mySubs);

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


code = replace_function(code, 'doSubmitAnswer', new_submit_answer)

with open('../backend/Code.gs', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated doSubmitAnswer")
