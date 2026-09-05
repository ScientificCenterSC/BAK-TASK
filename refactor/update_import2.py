import re

with open('../backend/Code.gs', 'r', encoding='utf-8') as f:
    code = f.read()

new_import_tasks = """function doImportTasks(payload, session) {
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

  var tasks = getTasksData();
  var taskId = payload.task_id || generateId('TASK');
  
  var totalPoints = 0;
  for(var i=0; i<tasksArray.length; i++) {
     totalPoints += Number(tasksArray[i].points) || 10;
  }

  tasks.push({
    task_id: taskId,
    lesson_id: lessonId,
    curriculum_id: curriculumId,
    title: taskTitle,
    question: "QUIZ_COLLECTION",
    type: "quiz",
    options: JSON.stringify(tasksArray),
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
}"""

# Manual brace matching for replacement to be safe
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


code = replace_function(code, 'doImportTasks', new_import_tasks)

with open('../backend/Code.gs', 'w', encoding='utf-8') as f:
    f.write(code)

print("Updated doImportTasks")
