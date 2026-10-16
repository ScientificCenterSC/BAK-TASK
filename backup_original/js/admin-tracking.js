document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAdmin()) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
    });

    UI.showLoading();
    try {
        const data = await API.call('getCurriculaAndLessons');
        populateFilters(data.curricula, data.lessons);
    } catch(err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.hideLoading();
    }

    document.getElementById('loadTrackingBtn').addEventListener('click', loadTrackingData);
});

let globalTasks = [];

function populateFilters(curricula, lessons) {
    const curSelect = document.getElementById('curriculumSelect');
    const lesSelect = document.getElementById('lessonSelect');

    curSelect.innerHTML = '<option value="">-- Select Curriculum --</option>' + curricula.map(c => `<option value="${c.curriculum_id}">${c.name}</option>`).join('');
    
    curSelect.addEventListener('change', () => {
        const cid = curSelect.value;
        lesSelect.innerHTML = '<option value="">-- Select Lesson --</option>' + 
            lessons.filter(l => l.curriculum_id === cid).map(l => `<option value="${l.lesson_id}">${l.title}</option>`).join('');
    });
}

async function loadTrackingData() {
    const lessonId = document.getElementById('lessonSelect').value;
    if (!lessonId) return UI.showToast('Please select a lesson first', 'error');

    UI.showLoading();
    try {
        const data = await API.call('getLessonTracking', { lesson_id: lessonId });
        renderMatrix(data.students, data.tasks, data.tracking);
    } catch (e) {
        UI.showToast(e.message, 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderMatrix(students, tasks, tracking) {
    globalTasks = tasks;
    var countEl = document.getElementById('trackingCount');
    if(countEl) countEl.textContent = students.length + ' Students × ' + tasks.length + ' Tasks';
    const thead = document.getElementById('trackingTableHeader');
    const tbody = document.getElementById('trackingTableBody');

    if (tasks.length === 0) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td class="empty-state">No tasks found for this lesson.</td></tr>';
        return;
    }

    // Build Header
    let headHtml = `<th style="padding:0.75rem 1rem; background:rgba(0,0,0,0.3); color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; position:sticky; top:0; white-space:nowrap;">Student Name</th>`;
    tasks.forEach(t => {
        headHtml += `<th style="padding:0.75rem 1rem; background:rgba(0,0,0,0.3); color:var(--text-muted); font-size:0.8rem; text-transform:uppercase; letter-spacing:0.05em; position:sticky; top:0; text-align:center; min-width:120px;" title="${t.title}">${t.title.substring(0, 18)}${t.title.length > 18 ? '...' : ''}<br><small style="color:var(--primary-light); font-weight:700;">(${t.points} pts)</small></th>`;
    });
    thead.innerHTML = headHtml;

    // Build Rows
    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${tasks.length + 1}" class="empty-state">No students found.</td></tr>`;
        return;
    }

    let bodyHtml = students.map(student => {
        let row = `<td style="padding:0.75rem 1rem; border-bottom:1px solid var(--border-color); white-space:nowrap;"><strong style="color:var(--text-main);">${student.name}</strong><br><small style="color:var(--text-muted); font-size:0.8rem;">${student.email || student.code}</small></td>`;
        
        tasks.forEach(task => {
            const record = tracking.find(r => r.student_id === student.student_id && r.task_id === task.task_id);
            let cellContent = '-';
            let cellStyle = '';
            
            if (record) {
                if (record.status === 'completed') {
                    cellContent = `<a href="#" onclick="PerformanceDetails.viewStudentPerformance('${student.student_id}', document.getElementById('curriculumSelect').value, document.getElementById('lessonSelect').value, '${student.name}', '${task.task_id}'); return false;" style="color:#10B981; font-weight:bold; text-decoration:underline; font-size:0.95rem;">${record.score} / ${task.points}</a>`;
                    cellStyle = 'background: rgba(16, 185, 129, 0.08);';
                } else if (record.status === 'locked') {
                    cellContent = `<a href="#" onclick="openUnlockModal('${student.student_id}', '${task.task_id}', '${task.deadline || ''}'); return false;" style="display:inline-flex; align-items:center; gap:0.25rem; padding:0.2rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:600; background:rgba(239,68,68,0.15); color:#EF4444; text-decoration:none;" title="Click to Unlock">🔒 Cheating</a>`;
                    cellStyle = 'background: rgba(239, 68, 68, 0.06); cursor:pointer;';
                } else if (record.status === 'expired') {
                    cellContent = `<a href="#" onclick="openUnlockModal('${student.student_id}', '${task.task_id}', '${task.deadline || ''}'); return false;" style="display:inline-flex; align-items:center; gap:0.25rem; padding:0.2rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:600; background:rgba(148,163,184,0.15); color:var(--text-muted); text-decoration:none;" title="Click to Unlock">⏳ Expired</a>`;
                    cellStyle = 'background: rgba(148,163,184,0.05); cursor:pointer;';
                }
            }
            
            row += `<td style="text-align:center; vertical-align:middle; padding:0.6rem 0.75rem; border-bottom:1px solid var(--border-color); ${cellStyle}">${cellContent}</td>`;
        });
        return `<tr>${row}</tr>`;
    }).join('');

    tbody.innerHTML = bodyHtml;
}

window.openUnlockModal = (studentId, taskId, currentDeadline) => {
    let dlStr = currentDeadline ? new Date(currentDeadline).toLocaleString() : 'None';
    UI.showModal('Unlock Task & Extend Deadline', `
        <div style="margin-bottom: 1rem; color: #555;">
            <p><strong>Original Global Deadline:</strong> ${dlStr}</p>
            <p style="color: red; font-size: 0.9em;">⚠️ Unlocking this task will apply a 10-point late penalty.</p>
        </div>
        <div class='form-group'>
            <label>New Custom Deadline for this Student</label>
            <input type='datetime-local' id='unlockNewDeadline' class='form-control'>
        </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
        { label: 'Unlock & Save Deadline', class: 'btn-warning', onClick: async () => {
            const dl = document.getElementById('unlockNewDeadline').value;
            if(!dl) return UI.showToast('Please select a new deadline', 'error');
            try {
                UI.showLoading();
                await API.call('extendTaskDeadline', { student_id: studentId, task_id: taskId, new_deadline: dl });
                UI.showToast('Task unlocked and deadline extended!', 'success');
                UI.closeModal();
                loadTrackingData(); // refresh matrix
            } catch(e) { 
                UI.showToast(e.message, 'error'); 
            } finally { 
                UI.hideLoading(); 
            }
        }}
    ]);
};
