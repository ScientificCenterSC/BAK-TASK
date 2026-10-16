import re

with open('backend/Code.gs', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. In doStartLesson, remove:
# if (existing[i].cheating_status === 'CHEATING') {
#   throw new Error('CHEATING_BLOCKED: You cannot access this lesson. It has been terminated due to cheating.');
# }
content = re.sub(
    r"if\s*\(existing\[i\]\.cheating_status\s*===\s*'CHEATING'\)\s*\{\s*throw new Error\('CHEATING_BLOCKED:[^\}]+\}\n",
    "",
    content,
    flags=re.MULTILINE
)

# 2. In doCompleteLesson, remove:
# if (String(data[i][headers.indexOf('cheating_status')]) === 'CHEATING') {
#   throw new Error('Cannot complete — lesson terminated due to cheating');
# }
content = re.sub(
    r"if\s*\(String\(data\[i\]\[headers\.indexOf\('cheating_status'\)\]\)\s*===\s*'CHEATING'\)\s*\{\s*throw new Error\('Cannot complete — lesson terminated due to cheating'\);\s*\}\n",
    "",
    content,
    flags=re.MULTILINE
)

# 3. In doGetTasks, remove:
# if (sl && sl.cheating_status === 'CHEATING') throw new Error('CHEATING_BLOCKED: You cannot access this lesson. It has been terminated due to cheating.');
content = re.sub(
    r"if\s*\(sl && sl\.cheating_status === 'CHEATING'\)\s*throw new Error\('CHEATING_BLOCKED: You cannot access this lesson[^\n]+\n",
    "",
    content
)

# 4. In doGetTaskDetail, remove:
# if (sl && sl.cheating_status === 'CHEATING') throw new Error('CHEATING_BLOCKED: You cannot access this task. The lesson has been terminated due to cheating.');
content = re.sub(
    r"if\s*\(sl && sl\.cheating_status === 'CHEATING'\)\s*throw new Error\('CHEATING_BLOCKED: You cannot access this task[^\n]+\n",
    "",
    content
)

# Now, we want doGetTasks and doGetTaskDetail to mark a task as 'locked' if it's in the Anti_Cheat_Logs for this student and task.
# Let's add a helper function `isTaskCheated(studentId, taskId)` or fetch the logs.
# Actually, the logs have `task_id` at index 6.
# Let's write the modified content back.
with open('backend/Code.gs', 'w', encoding='utf-8') as f:
    f.write(content)

print("Removed CHEATING_BLOCKED logic from Code.gs")
