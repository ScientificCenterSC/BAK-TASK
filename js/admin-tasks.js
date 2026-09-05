document.addEventListener('DOMContentLoaded', async () => {
    const session = Auth.requireAdmin();
    if(!session) return;

    await loadData();

    document.getElementById('addTaskBtn').addEventListener('click', () => showTaskModal());
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
    const lTasks = globalTasks.filter(t => t.lesson_id === currentLessonId && t.status !== 'inactive');
    
    if(lTasks.length === 0) {
        grid.innerHTML = '<div class="card" style="grid-column: 1 / -1; text-align:center;">No tasks in this lesson. Click Add Task to create one.</div>';
        return;
    }
    
    grid.innerHTML = lTasks.map(t => {
        let qCount = 1;
        if(t.type === 'quiz') {
            try { 
                const opts = JSON.parse(t.options); 
                if (Array.isArray(opts)) {
                    qCount = opts.filter(q => q && typeof q === 'object' && !Array.isArray(q) && (q.question || q.title) && q.correct_answer !== undefined).length;
                }
            } catch(e){}
        }
        return `
            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <h4 style="margin:0 0 0.5rem 0;">${t.title}</h4>
                    <span class="badge ${t.status === 'active' ? 'badge-success' : 'badge-secondary'}">${t.status}</span>
                </div>
                <div style="font-size:0.9rem; color:#666; margin-bottom:1rem;">
                    <div>Questions: <strong>${qCount}</strong></div>
                    <div>Points: <strong>${t.points}</strong></div>
                    <div>Deadline: <strong>${t.deadline ? new Date(t.deadline).toLocaleString() : 'No deadline'}</strong></div>
                </div>
                <div style="display:flex; gap:0.5rem; flex-wrap: wrap;">
                    <button class="btn btn-sm btn-primary" style="flex:1 1 100%;" onclick="showView('questions', '${t.task_id}')">Details & Questions</button>
                    <button class="btn btn-sm btn-warning" style="flex:1;" onclick="editTask('${t.task_id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" style="flex:1;" onclick="deleteTask('${t.task_id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderQuestionsView() {
    const task = globalTasks.find(t => t.task_id === currentTaskId);
    if(!task) return;
    
    const cur = globalCurricula.find(c => c.curriculum_id === task.curriculum_id);
    const les = globalLessons.find(l => l.lesson_id === task.lesson_id);
    
    // Render Detail Card
    let qCount = 1;
    if(task.type === 'quiz') { 
        try { 
            const opts = JSON.parse(task.options); 
            if (Array.isArray(opts)) {
                qCount = opts.filter(q => q && typeof q === 'object' && !Array.isArray(q) && (q.question || q.title) && q.correct_answer !== undefined).length;
            }
        } catch(e){} 
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
        try { 
            let opts = typeof task.options === 'string' ? JSON.parse(task.options) : task.options; 
            if (Array.isArray(opts)) {
                questions = opts.filter(q => q && typeof q === 'object' && !Array.isArray(q) && (q.question || q.title) && q.correct_answer !== undefined);
            }
        } catch(e){}
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
    
    UI.showModal('Edit Task', `
        <div class="form-group">
            <label>Task Title</label>
            <input type="text" id="editTaskTitle" class="form-control" value="${task.title.replace(/"/g, '&quot;')}">
        </div>
        <div class="form-group" style="margin-top:1rem;">
            <label>Total Points</label>
            <input type="number" id="editTaskPoints" class="form-control" value="${task.points}">
        </div>
        <div class="form-group" style="margin-top:1rem;">
            <label>Deadline (Optional)</label>
            <input type="datetime-local" id="editTaskDeadline" class="form-control" value="${task.deadline ? task.deadline.slice(0,16) : ''}">
        </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
        { label: 'Save Changes', class: 'btn-primary', onClick: async () => {
            const newTitle = document.getElementById('editTaskTitle').value;
            const newPoints = document.getElementById('editTaskPoints').value;
            const newDeadline = document.getElementById('editTaskDeadline').value;
            
            try {
                UI.showLoading();
                await API.call('updateTask', {
                    task_id: id,
                    title: newTitle,
                    points: newPoints,
                    deadline: newDeadline
                });
                UI.closeModal();
                UI.showToast('Task updated', 'success');
                await loadData();
            } catch(e) {
                UI.showToast(e.message, 'error');
            } finally {
                UI.hideLoading();
            }
        }}
    ]);
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
        
        <div class="form-group" style="margin-bottom:1rem; display:flex; gap:1rem;">
            <div style="flex:1;">
                <label>Global Deadline (Optional, applies to all uploaded)</label>
                <input type="datetime-local" id="tDeadline" class="form-control" style="width:100%; padding:0.5rem;">
            </div>
            <div style="flex:1; display:flex; align-items:flex-end;">
                <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; cursor:pointer;">
                    <input type="checkbox" id="tAllowLate" style="width:20px; height:20px;">
                    Allow Late Submissions
                </label>
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
            const dl = document.getElementById('tDeadline').value;
            const allowLate = document.getElementById('tAllowLate').checked;

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
