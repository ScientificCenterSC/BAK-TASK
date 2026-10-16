document.addEventListener('DOMContentLoaded', async () => {
    const session = Auth.requireAdmin();
    if(!session) return;

    await loadData();

    document.getElementById('addTaskBtn').addEventListener('click', () => showTaskModal());
    
    // Bulk actions
    const selectAllCb = document.getElementById('selectAllTasks');
    if (selectAllCb) {
        selectAllCb.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.task-checkbox');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
            updateSelectedTasksCount();
        });
    }

    document.getElementById('bulkOpenBtn').addEventListener('click', () => bulkUpdateTaskStatus('active'));
    document.getElementById('bulkCloseBtn').addEventListener('click', () => bulkUpdateTaskStatus('closed'));
});

let globalCurricula = [];
let globalLessons = [];
let globalTasks = [];

let currentView = 'curricula'; // curricula, lessons, tasks, questions
let currentCurriculumId = null;
let currentLessonId = null;
let currentTaskId = null;

async function loadData() {
    try {
        UI.showLoading();
        const [cRes, lRes, tRes] = await Promise.all([
            API.call('getAllCurricula'),
            API.call('getAllLessons'),
            API.call('getAllTasks')
        ]);
        globalCurricula = cRes.curricula || [];
        globalLessons = lRes.lessons || [];
        globalTasks = tRes.tasks || [];
        
        refreshView();
    } catch(e) {
        UI.showToast("Failed to load data", "error");
        console.error(e);
    } finally {
        UI.hideLoading();
    }
}

window.showView = (view, id = null) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    
    currentView = view;
    if(view === 'lessons') currentCurriculumId = id;
    if(view === 'tasks') currentLessonId = id;
    if(view === 'questions') currentTaskId = id;
    
    refreshView();
};

function refreshView() {
    updateBreadcrumb();
    if(currentView === 'curricula') renderCurriculaGrid();
    else if(currentView === 'lessons') renderLessonsGrid();
    else if(currentView === 'tasks') renderTasksGrid();
    else if(currentView === 'questions') renderQuestionsView();
}

function updateBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    let html = `<a onclick="showView('curricula')">All Curriculums</a>`;
    
    if(currentView === 'lessons' || currentView === 'tasks' || currentView === 'questions') {
        const cur = globalCurricula.find(c => c.curriculum_id === currentCurriculumId);
        if(cur) html += ` <span>/</span> <a onclick="showView('lessons', '${cur.curriculum_id}')">${cur.name}</a>`;
    }
    
    if(currentView === 'tasks' || currentView === 'questions') {
        const lesson = globalLessons.find(l => l.lesson_id === currentLessonId);
        if(lesson) html += ` <span>/</span> <a onclick="showView('tasks', '${lesson.lesson_id}')">${lesson.title}</a>`;
    }
    
    if(currentView === 'questions') {
        const task = globalTasks.find(t => t.task_id === currentTaskId);
        if(task) html += ` <span>/</span> <span>${task.title}</span>`;
    }
    
    bc.innerHTML = html;
}

function renderCurriculaGrid() {
    const grid = document.getElementById('curriculaGrid');
    if(globalCurricula.length === 0) {
        grid.innerHTML = '<div class="card">No Curriculums found.</div>';
        return;
    }
    
    grid.innerHTML = globalCurricula.map(c => {
        const lCount = globalLessons.filter(l => l.curriculum_id === c.curriculum_id).length;
        const tCount = globalTasks.filter(t => t.curriculum_id === c.curriculum_id).length;
        return `
            <div class="card" style="cursor:pointer;" onclick="showView('lessons', '${c.curriculum_id}')">
                <div style="font-size:2rem; margin-bottom:0.5rem;">${c.icon || '📚'}</div>
                <h4 style="margin:0 0 0.5rem 0;">${c.name}</h4>
                <p style="color:#666; font-size:0.9rem; margin:0 0 1rem 0;">${c.description || 'No description'}</p>
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#888;">
                    <span>${lCount} Lessons</span>
                    <span>${tCount} Tasks</span>
                </div>
            </div>
        `;
    }).join('');
}

function renderLessonsGrid() {
    const grid = document.getElementById('lessonsGrid');
    const cLessons = globalLessons.filter(l => l.curriculum_id === currentCurriculumId);
    
    if(cLessons.length === 0) {
        grid.innerHTML = '<div class="card">No Lessons in this Curriculum.</div>';
        return;
    }
    
    grid.innerHTML = cLessons.map(l => {
        const tCount = globalTasks.filter(t => t.lesson_id === l.lesson_id).length;
        return `
            <div class="card" style="cursor:pointer;" onclick="showView('tasks', '${l.lesson_id}')">
                <h4 style="margin:0 0 0.5rem 0;">${l.title}</h4>
                <p style="color:#666; font-size:0.9rem; margin:0 0 1rem 0;">${l.description || 'No description'}</p>
                <div style="font-size:0.85rem; color:var(--primary); font-weight:bold;">
                    ${tCount} Tasks
                </div>
            </div>
        `;
    }).join('');
}

function renderTasksGrid() {
    const grid = document.getElementById('tasksGrid');
    const lTasks = globalTasks.filter(t => t.lesson_id === currentLessonId);
    
    if(lTasks.length === 0) {
        grid.innerHTML = '<div class="card" style="grid-column: 1 / -1; text-align:center;">No tasks in this lesson. Click Add Task to create one.</div>';
        return;
    }
    
    grid.innerHTML = lTasks.map(t => {
        let qCount = 1;
        if(t.type === 'quiz') {
            qCount = UI.parseQuestions(t.options).length;
        }
        const isBlockEnabled = t.enable_block !== false && String(t.enable_block) !== 'false';
        const deadlineDisplay = t.deadline 
            ? `<strong>${new Date(t.deadline).toLocaleString()}</strong>` 
            : `<span class="badge" style="background:rgba(16,185,129,0.15); color:#10B981; border:1px solid rgba(16,185,129,0.3); font-size:0.75rem;">🔓 مفتوح دائماً (بدون ديد لاين)</span>`;

        return `
            <div class="card" style="position: relative; padding-left: 2.5rem;">
                <input type="checkbox" class="task-checkbox" data-task-id="${t.task_id}" style="position: absolute; left: 1rem; top: 1.5rem; width: 1.2rem; height: 1.2rem; cursor: pointer;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h4 style="margin:0 0 0.5rem 0;">${UI.escapeHTML(t.title)}</h4>
                    <span class="badge ${t.status === 'active' ? 'badge-success' : 'badge-secondary'}">${t.status}</span>
                </div>
                <div style="font-size:0.9rem; color:#666; margin-bottom:0.75rem;">
                    <div>Questions: <strong>${qCount}</strong></div>
                    <div>Points: <strong>${t.points}</strong></div>
                    <div style="margin-top:0.25rem;">Deadline: ${deadlineDisplay}</div>
                </div>
                <div style="display:flex; gap:0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-sm" 
                        style="flex: 1 1 100%; display: flex; align-items: center; justify-content: center; gap: 0.4rem; font-size: 0.8rem; font-weight: 600; padding: 0.4rem; border-radius: 6px; cursor: pointer; ${isBlockEnabled ? 'background: rgba(99,102,241,0.15); border: 1px solid #6366F1; color: #818CF8;' : 'background: rgba(148,163,184,0.1); border: 1px solid #64748B; color: #94A3B8;'}" 
                        onclick="toggleTaskBlock('${t.task_id}')">
                        ${isBlockEnabled ? '🛡️ نظام البلوك: مفعّل (انقر للتعطيل)' : '🔓 نظام البلوك: معطّل (انقر للتفعيل)'}
                    </button>
                    <button class="btn btn-sm btn-primary" style="flex:1 1 100%;" onclick="showView('questions', '${t.task_id}')">Details & Questions</button>
                    <button class="btn btn-sm btn-warning" style="flex:1;" onclick="editTask('${t.task_id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" style="flex:1;" onclick="deleteTask('${t.task_id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach event listeners to new checkboxes
    const checkboxes = grid.querySelectorAll('.task-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', updateSelectedTasksCount);
    });
    
    // Reset select all checkbox
    const selectAllCb = document.getElementById('selectAllTasks');
    if (selectAllCb) {
        selectAllCb.checked = false;
        updateSelectedTasksCount();
    }
}

function updateSelectedTasksCount() {
    const checkboxes = document.querySelectorAll('.task-checkbox:checked');
    const countSpan = document.getElementById('selectedTasksCount');
    if (countSpan) countSpan.textContent = checkboxes.length;
    
    const selectAllCb = document.getElementById('selectAllTasks');
    const allCheckboxes = document.querySelectorAll('.task-checkbox');
    if (selectAllCb && allCheckboxes.length > 0) {
        selectAllCb.checked = checkboxes.length === allCheckboxes.length;
    }
}

window.toggleTaskBlock = async (taskId) => {
    const task = globalTasks.find(t => t.task_id === taskId);
    if (!task) return;
    const currentBlock = task.enable_block !== false && String(task.enable_block) !== 'false';
    const newBlock = !currentBlock;
    try {
        UI.showLoading();
        await API.call('updateTask', {
            task_id: taskId,
            enable_block: newBlock
        });
        task.enable_block = newBlock;
        UI.showToast(newBlock ? 'تم تفعيل نظام البلوك لهذا التاسك 🛡️' : 'تم إلغاء نظام البلوك لهذا التاسك 🔓', 'success');
        renderTasksGrid();
    } catch (e) {
        UI.showToast(e.message || 'فشل تحديث حالة البلوك', 'error');
    } finally {
        UI.hideLoading();
    }
};

function renderQuestionsView() {
    const task = globalTasks.find(t => t.task_id === currentTaskId);
    if(!task) return;
    
    const cur = globalCurricula.find(c => c.curriculum_id === task.curriculum_id);
    const les = globalLessons.find(l => l.lesson_id === task.lesson_id);
    
    // Render Detail Card
    let qCount = 1;
    if(task.type === 'quiz') { 
        qCount = UI.parseQuestions(task.options).length;
    }
    
    document.getElementById('taskDetailCard').innerHTML = `
        <div style="display:flex; justify-content:space-between;">
            <div>
                <h3 style="margin-top:0; color:var(--primary);">${task.title}</h3>
                <p style="margin:0 0 0.5rem 0; color:#555;"><strong>Curriculum:</strong> ${cur ? cur.name : ''} &nbsp;|&nbsp; <strong>Lesson:</strong> ${les ? les.title : ''}</p>
                <p style="margin:0; color:#555;"><strong>Deadline:</strong> ${task.deadline ? new Date(task.deadline).toLocaleString() : 'No deadline'} &nbsp;|&nbsp; <strong>Total Points:</strong> ${task.points}</p>
            </div>
            <div style="text-align:right;">
                <span class="badge ${task.status === 'active' ? 'badge-success' : 'badge-secondary'}">${task.status}</span>
                <p style="margin-top:0.5rem; color:#777; font-size:0.9rem;">Created: ${new Date(task.created_at).toLocaleDateString()}</p>
            </div>
        </div>
    `;
    
    // Render Questions Table
    const tbody = document.getElementById('questionsTableBody');
    let questions = [];
    if(task.type === 'quiz') {
        questions = UI.parseQuestions(task.options);
    } else {
        questions = [task];
    }
    
    if(questions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No questions found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = questions.map((q, idx) => {
        let opts = [];
        try { opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []); } catch(e){}
        
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${q.question || q.title || ''}</td>
                <td>${q.type || 'N/A'}</td>
                <td>${opts.join(', ')}</td>
                <td><strong>${q.correct_answer || ''}</strong></td>
                <td>${q.points || 10}</td>
            </tr>
        `;
    }).join('');
}

window.deleteTask = (id) => {
    UI.confirm('Are you sure you want to delete this task?').then(async (confirmed) => {
        if (!confirmed) return;
        try {
            UI.showLoading();
            await API.call('deleteTask', { task_id: id });
            UI.showToast('Task deleted', 'success');
            await loadData();
        } catch (err) {
            UI.showToast(err.message, 'error');
        } finally {
            UI.hideLoading();
        }
    });
};

window.editTask = (id) => {
    const task = globalTasks.find(t => t.task_id === id);
    if(!task) return;
    
    const hasDeadline = !!task.deadline;
    const isBlockEnabled = task.enable_block !== false && String(task.enable_block) !== 'false';

    UI.showModal('تعديل التاسك / Edit Task', `
        <div class="form-group">
            <label>Task Title</label>
            <input type="text" id="editTaskTitle" class="form-control" value="${task.title.replace(/"/g, '&quot;')}">
        </div>
        <div class="form-group" style="margin-top:1rem;">
            <label>Total Points</label>
            <input type="number" id="editTaskPoints" class="form-control" value="${task.points}">
        </div>
        <div class="form-group" style="margin-top:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <label style="margin:0;">Deadline (تاريخ ووقت الانتهاء)</label>
                <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; font-weight:600; color:#10B981; font-size:0.85rem;">
                    <input type="checkbox" id="editTaskNoDeadline" ${!hasDeadline ? 'checked' : ''}>
                    بدون ديد لاين (مفتوح دائماً)
                </label>
            </div>
            <input type="datetime-local" id="editTaskDeadline" class="form-control" value="${task.deadline ? task.deadline.slice(0,16) : ''}" ${!hasDeadline ? 'disabled style="opacity:0.5;"' : ''}>
        </div>
        <div class="form-group" style="margin-top:1.25rem; padding:0.75rem; background:rgba(99,102,241,0.08); border-radius:8px; border:1px solid rgba(99,102,241,0.2);">
            <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; margin:0; font-weight:600;">
                <input type="checkbox" id="editTaskEnableBlock" style="width:18px; height:18px;" ${isBlockEnabled ? 'checked' : ''}>
                <span>🛡️ تفعيل نظام البلوك (قفل التاسك للطالب عند الخروج من النافذة أو تبديل التاب)</span>
            </label>
            <div style="font-size:0.8rem; color:#64748B; margin-top:0.3rem; margin-right:1.8rem;">
                عند إلغاء التحديد، لن يتم قفل التاسك على الطالب إذا خرج من الامتحان أو بدل الصفحة.
            </div>
        </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
        { label: 'Save Changes', class: 'btn-primary', onClick: async () => {
            const newTitle = document.getElementById('editTaskTitle').value;
            const newPoints = document.getElementById('editTaskPoints').value;
            const isNoDl = document.getElementById('editTaskNoDeadline').checked;
            const newDeadline = isNoDl ? '' : document.getElementById('editTaskDeadline').value;
            const newEnableBlock = document.getElementById('editTaskEnableBlock').checked;
            
            try {
                UI.showLoading();
                await API.call('updateTask', {
                    task_id: id,
                    title: newTitle,
                    points: newPoints,
                    deadline: newDeadline,
                    enable_block: newEnableBlock
                });
                task.title = newTitle;
                task.points = newPoints;
                task.deadline = newDeadline;
                task.enable_block = newEnableBlock;
                UI.closeModal();
                UI.showToast('تم تحديث المهمة بنجاح', 'success');
                refreshView();
            } catch(e) {
                UI.showToast(e.message, 'error');
            } finally {
                UI.hideLoading();
            }
        }}
    ]);

    // Handle no-deadline checkbox toggle
    const editNoDl = document.getElementById('editTaskNoDeadline');
    const editDl = document.getElementById('editTaskDeadline');
    if (editNoDl && editDl) {
        editNoDl.addEventListener('change', (e) => {
            if (e.target.checked) {
                editDl.value = '';
                editDl.disabled = true;
                editDl.style.opacity = '0.5';
            } else {
                editDl.disabled = false;
                editDl.style.opacity = '1';
            }
        });
    }
};

function showTaskModal() {
    const curOptions = globalCurricula.map(c => `<option value="${c.curriculum_id}">${c.name}</option>`).join('');

    const bodyHtml = `
        <div class="form-group" style="margin-bottom:1rem; display:flex; gap:1rem;">
            <div style="flex:1;">
                <label>Curriculum</label>
                <select id="tCurriculumId" class="form-control" style="width:100%; padding:0.5rem;" required>
                    <option value="">-- Select Curriculum --</option>
                    ${curOptions}
                </select>
            </div>
            <div style="flex:1;">
                <label>Lesson</label>
                <select id="tLessonId" class="form-control" style="width:100%; padding:0.5rem;" required disabled>
                    <option value="">-- Select Lesson --</option>
                </select>
            </div>
        </div>
        
        <div class="form-group" style="margin-bottom:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <label style="margin:0;">Global Deadline (تاريخ ووقت الانتهاء)</label>
                <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; font-weight:600; color:#10B981; font-size:0.85rem;">
                    <input type="checkbox" id="tNoDeadline">
                    بدون ديد لاين (تظل المهام مفتوحة دائماً)
                </label>
            </div>
            <div style="display:flex; gap:1rem;">
                <div style="flex:1;">
                    <input type="datetime-local" id="tDeadline" class="form-control" style="width:100%; padding:0.5rem;">
                </div>
                <div style="flex:1; display:flex; align-items:center;">
                    <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                        <input type="checkbox" id="tAllowLate" style="width:18px; height:18px;">
                        Allow Late Submissions
                    </label>
                </div>
            </div>
        </div>

        <div class="form-group" style="margin-bottom:1.25rem; padding:0.75rem; background:rgba(99,102,241,0.08); border-radius:8px; border:1px solid rgba(99,102,241,0.2);">
            <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; margin:0; font-weight:600;">
                <input type="checkbox" id="tEnableBlock" style="width:18px; height:18px;" checked>
                <span>🛡️ تفعيل نظام البلوك (قفل التاسك على الطالب في حال تبديل التاب أو الخروج من النافذة)</span>
            </label>
            <div style="font-size:0.8rem; color:#64748B; margin-top:0.3rem; margin-right:1.8rem;">
                إذا ألغيت التحديد، ستظل المهمة متاحة للطالب حتى لو قام بتبديل التاب أو فتح نافذة أخرى.
            </div>
        </div>

        <div style="padding:1rem; border:2px dashed #ccc; border-radius:8px; margin-bottom:1.5rem; background:#f9f9f9;">
            <h4 style="margin-top:0; color:#333;">Upload JSON Files (Bulk Import)</h4>
            <p style="font-size:0.9rem; color:#666;">Select one or more JSON files. Each file will become a separate Task.</p>
            <input type="file" id="tJsonFiles" accept=".json" multiple class="form-control" style="width:100%;">
        </div>

        <div id="bulkUploadPreview" style="display:none; margin-bottom: 1.5rem;">
            <h4 style="margin-top:0; color:#333;">Files to Upload</h4>
            <table style="width:100%; border-collapse: collapse; font-size: 0.9rem;" border="1">
                <thead style="background:#f1f5f9;">
                    <tr>
                        <th style="padding:0.5rem; text-align:left;">File Name</th>
                        <th style="padding:0.5rem; text-align:left;">Task Name</th>
                        <th style="padding:0.5rem; text-align:center;">Questions</th>
                        <th style="padding:0.5rem; text-align:left;">Status</th>
                    </tr>
                </thead>
                <tbody id="bulkUploadTableBody"></tbody>
            </table>
        </div>
    `;

    UI.showModal('Create Tasks', bodyHtml, [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
        { label: 'Create Tasks', class: 'btn-primary', onClick: async () => {
            const cid = document.getElementById('tCurriculumId').value;
            const lid = document.getElementById('tLessonId').value;
            const isNoDl = document.getElementById('tNoDeadline').checked;
            const dl = isNoDl ? '' : document.getElementById('tDeadline').value;
            const allowLate = document.getElementById('tAllowLate').checked;
            const enableBlock = document.getElementById('tEnableBlock').checked;

            if(!cid) return UI.showToast('Select a Curriculum', 'error');
            if(!lid) return UI.showToast('Select a Lesson', 'error');

            if (!window.bulkUploadFiles || window.bulkUploadFiles.length === 0) {
                return UI.showToast('Please select at least one valid JSON file', 'warning');
            }

            const validFiles = window.bulkUploadFiles.filter(f => f.valid);
            if (validFiles.length === 0) {
                return UI.showToast('No valid files to upload', 'error');
            }

            try {
                UI.showLoading();
                let successCount = 0;
                for (let fileData of validFiles) {
                    const taskNameInput = document.getElementById('taskName_' + fileData.id);
                    let taskName = taskNameInput ? taskNameInput.value.trim() : fileData.originalName;
                    if (!taskName) taskName = fileData.originalName;

                    await API.call('importTasks', {
                        curriculum_id: cid,
                        lesson_id: lid,
                        task_title: taskName,
                        deadline: dl,
                        allow_late: allowLate,
                        enable_block: enableBlock,
                        tasks: fileData.parsedJson
                    });
                    successCount++;
                }

                UI.showToast(`Successfully created ${successCount} Tasks!`, 'success');
                UI.closeModal();
                await loadData();
            } catch(err) {
                UI.showToast('Error: ' + err.message, 'error');
            } finally {
                UI.hideLoading();
            }
        }}
    ]);

    // Handle no-deadline checkbox toggle
    const noDlCb = document.getElementById('tNoDeadline');
    const dlInput = document.getElementById('tDeadline');
    if (noDlCb && dlInput) {
        noDlCb.addEventListener('change', (e) => {
            if (e.target.checked) {
                dlInput.value = '';
                dlInput.disabled = true;
                dlInput.style.opacity = '0.5';
            } else {
                dlInput.disabled = false;
                dlInput.style.opacity = '1';
            }
        });
    }

    const fileInput = document.getElementById('tJsonFiles');
    fileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        window.bulkUploadFiles = [];
        const tbody = document.getElementById('bulkUploadTableBody');
        tbody.innerHTML = '';
        document.getElementById('bulkUploadPreview').style.display = 'block';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            
            const filePromise = new Promise(resolve => {
                reader.onload = (evt) => {
                    let parsedJson = null;
                    let isValid = false;
                    let questionCount = 0;
                    let reason = '';

                    try {
                        parsedJson = JSON.parse(evt.target.result);
                        if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson) && Array.isArray(parsedJson.questions)) {
                            parsedJson = parsedJson.questions;
                        }
                        if (!Array.isArray(parsedJson)) {
                            reason = 'Root must be an array';
                        } else {
                            // Filter valid questions
                            const validQuestions = parsedJson.filter(q => {
                                if (!q || typeof q !== 'object' || Array.isArray(q)) return false;
                                if (!q.question && !q.title) return false;
                                if (q.correct_answer === undefined) return false;
                                return true;
                            });

                            if (validQuestions.length === 0) {
                                reason = 'No valid questions found';
                            } else {
                                isValid = true;
                                questionCount = validQuestions.length;
                                parsedJson = validQuestions; // only keep valid ones
                            }
                        }
                    } catch (err) {
                        reason = 'Invalid JSON format';
                    }

                    resolve({
                        id: i,
                        originalName: file.name,
                        parsedJson: parsedJson,
                        valid: isValid,
                        questionCount: questionCount,
                        reason: reason
                    });
                };
                reader.readAsText(file);
            });

            const fileData = await filePromise;
            window.bulkUploadFiles.push(fileData);

            let rowHtml = `<tr>
                <td style="padding:0.5rem;">${fileData.originalName}</td>
                <td style="padding:0.5rem;">
                    <input type="text" id="taskName_${fileData.id}" value="${fileData.originalName.replace(/\.json$/i, '')}" class="form-control" style="width:100%; padding:0.25rem;" ${fileData.valid ? '' : 'disabled'}>
                </td>
                <td style="padding:0.5rem; text-align:center;">${fileData.valid ? fileData.questionCount : '-'}</td>
                <td style="padding:0.5rem; color:${fileData.valid ? 'green' : 'red'}; font-weight:bold;">
                    ${fileData.valid ? 'Ready' : 'Invalid: ' + fileData.reason}
                </td>
            </tr>`;
            tbody.insertAdjacentHTML('beforeend', rowHtml);
        }
    });

    // Cascading Dropdown Logic
    const currSelect = document.getElementById('tCurriculumId');
    const lessSelect = document.getElementById('tLessonId');
    
    // Auto-select if we are already in a specific context
    if(currentCurriculumId) {
        currSelect.value = currentCurriculumId;
        updateLessonsDropdown(currentCurriculumId, lessSelect);
        if(currentLessonId) {
            lessSelect.value = currentLessonId;
        }
    }

    currSelect.addEventListener('change', (e) => {
        updateLessonsDropdown(e.target.value, lessSelect);
    });
}

function updateLessonsDropdown(cid, lessSelect) {
    if(!cid) {
        lessSelect.innerHTML = '<option value="">-- Select Lesson --</option>';
        lessSelect.disabled = true;
        return;
    }
    const filteredLessons = globalLessons.filter(l => l.curriculum_id === cid);
    lessSelect.innerHTML = '<option value="">-- Select Lesson --</option>' + 
        filteredLessons.map(l => `<option value="${l.lesson_id}">${l.title}</option>`).join('');
    lessSelect.disabled = false;
}

window.bulkUpdateTaskStatus = async function(status) {
    const checkboxes = document.querySelectorAll('.task-checkbox:checked');
    const taskIds = Array.from(checkboxes).map(cb => cb.dataset.taskId);
    if (taskIds.length === 0) {
        UI.showToast('Please select at least one task.', 'warning');
        return;
    }
    
    const actionWord = status === 'active' ? 'open' : 'close';
    if (!confirm('You are about to ' + actionWord + ' ' + taskIds.length + ' selected tasks. Continue?')) return;
    
    try {
        UI.showLoading();
        await API.call('bulkUpdateTaskStatus', { task_ids: taskIds, status: status });
        UI.showToast('Tasks updated successfully', 'success');
        await loadData();
        const selectAllCb = document.getElementById('selectAllTasks');
        if (selectAllCb) selectAllCb.checked = false;
        updateSelectedTasksCount();
    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.hideLoading();
    }
};
