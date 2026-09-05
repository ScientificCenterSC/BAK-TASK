// js/admin-student-profile.js
document.addEventListener('DOMContentLoaded', async () => {
    Auth.requireAdmin();
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
        window.location.href = 'admin-login.html';
    });

    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');

    if (!studentId) {
        UI.showToast('No student ID provided', 'error');
        return;
    }

    try {
        UI.showLoading();
        
        const [profileRes, answersRes] = await Promise.all([
            API.call('getStudentProfile', { student_id: studentId }),
            API.call('getStudentAnswers', { student_id: studentId })
        ]);

        renderProfile(profileRes.student, profileRes.curricula, profileRes.overall, profileRes.hasCheating, studentId);
        renderAnswers(answersRes.answers);
        renderCheatingLogs(profileRes.cheatingLogs);

        const reportBtn = document.getElementById('downloadReportBtn');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                if (typeof PDF !== 'undefined' && PDF.downloadStudentReport) {
                    PDF.downloadStudentReport(studentId);
                } else {
                    UI.showToast('PDF module not loaded', 'error');
                }
            });
        }

    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.hideLoading();
    }
});

function formatTime(seconds) {
    if (seconds === undefined || seconds === null) return '—';
    const s = parseInt(seconds, 10);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
}

function renderProfile(student, curricula, overall, hasCheating, studentId) {
    if(!student) return;
    
    let cheatingBanner = '';
    if (hasCheating) {
        cheatingBanner = `
        <div style="background:#FEE2E2;border:2px solid #DC2626;border-radius:8px;padding:1rem;margin-top:1rem;">
            <span style="color:#DC2626;font-weight:bold;font-size:1.2rem;">🚫 غشاش / CHEATING DETECTED</span>
            <p style="color:#991B1B;margin:0.5rem 0 0;">This student has cheating incidents recorded.</p>
        </div>
        `;
    }

    document.getElementById('studentInfo').innerHTML = `
        <h2>${student.name} <small style="color:gray;">(${student.code})</small></h2>
        <p>Email: ${student.email || '—'}</p>
        <p>Status: <span class="badge ${student.status === 'active' ? 'badge-success' : 'badge-secondary'}">${student.status}</span></p>
        ${cheatingBanner}
        <hr style="margin: 1rem 0; border: none; border-top: 1px solid var(--gray-200);">
        <div class="grid-4">
          <div style="cursor:pointer;" onclick="PerformanceDetails.viewStudentPerformance('${studentId}', null, null, '${student.name}')" title="View Detailed Performance"><small>Score (Click for Details)</small><h4 style="color:var(--primary-light); text-decoration:underline;">${overall.scorePercentage || 0}%</h4></div>
          <div><small>Tasks</small><h4>${overall.completedTasks || 0} / ${overall.totalTasks || 0}</h4></div>
          <div><small>Correct</small><h4 style="color:var(--success)">${overall.correctAnswers || 0}</h4></div>
          <div><small>Incorrect</small><h4 style="color:var(--danger)">${overall.incorrectAnswers || 0}</h4></div>
        </div>
    `;

    const progDiv = document.getElementById('progressCards');
    if(curricula && curricula.length > 0) {
        progDiv.innerHTML = curricula.map(p => {
            const progress = p.totalTasks > 0 ? Math.round((p.completedTasks / p.totalTasks) * 100) : 0;
            
            let lessonsHtml = '';
            if (p.lessons && p.lessons.length > 0) {
                lessonsHtml = '<div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">' + p.lessons.map(l => {
                    const lProgress = l.totalTasks > 0 ? Math.round((l.completedTasks / l.totalTasks) * 100) : 0;
                    let cheatingBadge = '';
                    let clearBtn = '';
                    if (l.cheatingStatus === 'CHEATING') {
                        cheatingBadge = `<span class="badge badge-danger">CHEATING</span>`;
                        clearBtn = `<button class="btn btn-secondary btn-sm" onclick="clearCheating('${studentId}', '${l.lesson_id}')" style="margin-left:auto;">Clear Cheating</button>`;
                    }
                    
                    return `
                    <div style="border: 1px solid #E5E7EB; padding: 0.5rem; border-radius: 4px; display: flex; align-items: center; flex-wrap: wrap; gap: 1rem; background: #f9fafb;">
                        <strong style="min-width: 150px;">${l.title}</strong>
                        <span class="badge ${l.lessonStatus === 'completed' ? 'badge-success' : (l.lessonStatus === 'in_progress' ? 'badge-primary' : 'badge-secondary')}">${l.lessonStatus || 'pending'}</span>
                        ${cheatingBadge}
                        <span style="font-size:0.9rem; color:gray;" title="Time Spent">⏱️ ${formatTime(l.totalTimeSpent)}</span>
                        <span style="font-size:0.9rem;">Tasks: ${l.completedTasks}/${l.totalTasks}</span>
                        <span style="font-size:0.9rem;">Score: ${l.score || 0}</span>
                        ${clearBtn}
                    </div>
                    `;
                }).join('') + '</div>';
            }

            return `
            <div class="card" style="padding:1rem;">
                <h4>${p.curriculumName}</h4>
                <p>Completed Tasks: ${p.completedTasks} / ${p.totalTasks}</p>
                <div class="progress-bar-bg" style="background:#e5e7eb; height:10px; border-radius:5px; margin-top:0.5rem; width: 100%;">
                    <div class="progress-bar-fill" style="background:#2563EB; height:100%; border-radius:5px; width:${progress}%"></div>
                </div>
                ${lessonsHtml}
            </div>
        `}).join('');
    } else {
        progDiv.innerHTML = '<p class="empty-state">No curricula assigned.</p>';
    }
}

function renderAnswers(answers) {
    const tbody = document.getElementById('answersTableBody');
    if (!answers || answers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;" class="empty-state">No answers submitted yet.</td></tr>';
        return;
    }
    tbody.innerHTML = answers.map(a => `
        <tr>
            <td>${a.taskTitle || 'Unknown Task'}</td>
            <td>${a.curriculum || '—'}</td>
            <td>${a.studentAnswer || '—'}</td>
            <td>${a.isCorrect ? '<span class="badge badge-success">✓</span>' : '<span class="badge badge-danger">✕</span>'} ${a.score || 0} / ${a.maxScore || 0}</td>
            <td>${formatTime(a.timeSpent)}</td>
            <td>${UI.formatDate(a.submittedAt)}</td>
        </tr>
    `).join('');
}

function renderCheatingLogs(logs) {
    const section = document.getElementById('antiCheatSection');
    const tbody = document.getElementById('cheatingLogsTableBody');
    if (!logs || logs.length === 0) {
        if(section) section.style.display = 'none';
        return;
    }
    if(section) {
        section.style.display = 'block';
        const urlParams = new URLSearchParams(window.location.search);
        const studentId = urlParams.get('id');
        tbody.innerHTML = logs.map(l => {
            // Check if details has task_id
            let taskId = '';
            let match = l.details && l.details.match(/task_id:\s*(TASK_\d+)/);
            if (match) taskId = match[1];
            else if (l.task_id) taskId = l.task_id;
            else if (l.details && l.details.includes('TASK_')) {
                 match = l.details.match(/(TASK_\d+)/);
                 if (match) taskId = match[1];
            }
            // l is from Code.gs, it's an object from sheetToObjects. 
            // In Code.gs, Anti_Cheat_Logs row 6 is details, row 7 is task_id if we added it (but headers might not map it).
            // It's safer to extract it from details if we put it there.
            
            return `
            <tr>
                <td>${UI.formatDate(l.event_time) || l.event_time || '—'}</td>
                <td>${l.lesson_title || l.lesson_id || '—'}</td>
                <td><span class="badge badge-danger">${l.event_type || '—'}</span></td>
                <td>${l.details || '—'}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="clearTaskCheating('${studentId}', '${l.lesson_id}', '${taskId}')">Unlock</button>
                </td>
            </tr>
            `;
        }).join('');
    }
}

window.clearCheating = async function(studentId, lessonId) {
    if (!confirm('Are you sure you want to clear ALL cheating status for this lesson?')) return;
    try {
        UI.showLoading();
        await API.call('clearCheatingStatus', { student_id: studentId, lesson_id: lessonId });
        UI.showToast('Cheating status cleared successfully', 'success');
        setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.hideLoading();
    }
};

window.clearTaskCheating = (studentId, lessonId, taskId) => {
    // We don't have currentDeadline here easily, but we can just say "Original Deadline"
    UI.showModal('Unlock Task & Extend Deadline', `
        <div style="margin-bottom: 1rem; color: #555;">
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
                setTimeout(() => window.location.reload(), 1000);
            } catch(e) { 
                UI.showToast(e.message, 'error'); 
            } finally { 
                UI.hideLoading(); 
            }
        }}
    ]);
};

document.getElementById('extendDeadlineBtn').addEventListener('click', () => {
    UI.showModal('Unlock Task & Extend Deadline', `
            <div style="margin-bottom: 1rem; color: #555;">
                <p style="color: red; font-size: 0.9em;">⚠️ Unlocking this task will apply a 10-point late penalty.</p>
            </div>
            <div class='form-group'>
                <label>Task ID</label>
                <input type='text' id='extTaskId' class='form-control' placeholder='e.g., TASK_001'>
            </div>
            <div class='form-group' style='margin-top:1rem;'>
                <label>New Custom Deadline</label>
                <input type='datetime-local' id='extDeadline' class='form-control'>
            </div>
        `, [
            { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
            { label: 'Unlock & Save Deadline', class: 'btn-warning', onClick: async () => {
                const tid = document.getElementById('extTaskId').value;
                const dl = document.getElementById('extDeadline').value;
                if(!tid || !dl) return UI.showToast('All fields required', 'error');
                const urlParams = new URLSearchParams(window.location.search);
                const studentId = urlParams.get('id');
                try {
                    UI.showLoading();
                    await API.call('extendTaskDeadline', { student_id: studentId, task_id: tid, new_deadline: dl });
                    UI.showToast('Task unlocked and deadline extended', 'success');
                    UI.closeModal();
                } catch(e) { UI.showToast(e.message, 'error'); }
                finally { UI.hideLoading(); }
            }}
        ]
    );
});

document.getElementById('resetPwdBtn').addEventListener('click', () => {
    UI.showModal('Reset Password', `
            <div class='form-group'>
                <label>New Password</label>
                <input type='text' id='newPwdInput' class='form-control'>
            </div>
        `, [
            { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
            { label: 'Reset', class: 'btn-danger', onClick: async () => {
                const pwd = document.getElementById('newPwdInput').value;
                if(!pwd) return UI.showToast('Password is required', 'error');
                const urlParams = new URLSearchParams(window.location.search);
                const studentId = urlParams.get('id');
                try {
                    UI.showLoading();
                    await API.call('resetPassword', { student_id: studentId, new_password: pwd });
                    UI.showToast('Password reset successfully', 'success');
                    UI.closeModal();
                } catch(e) { UI.showToast(e.message, 'error'); }
                finally { UI.hideLoading(); }
            }}
        ]
    );
});

const assignCurriculumBtn = document.getElementById('assignCurriculumBtn');
if (assignCurriculumBtn) {
    assignCurriculumBtn.addEventListener('click', async () => {
        try {
            UI.showLoading();
            const res = await API.call('getAllCurricula');
            const curricula = res.curricula || [];
            UI.hideLoading();
            if (curricula.length === 0) return UI.showToast('No curricula available to assign.', 'warning');
            
            const optionsHtml = curricula.map(c => `<option value='${c.curriculum_id}'>${c.name}</option>`).join('');
            
            UI.showModal('Assign Curriculum', `<div class='form-group'><label>Select Curriculum</label><select id='assignCurSelect' class='form-control' style='width:100%; padding:0.5rem;'>${optionsHtml}</select></div>`, [
                    { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
                    { label: 'Assign', class: 'btn-primary', onClick: async () => {
                        const curId = document.getElementById('assignCurSelect').value;
                        if (!curId) return UI.showToast('Select a curriculum', 'error');
                        const urlParams = new URLSearchParams(window.location.search);
                        const studentId = urlParams.get('id');
                        try {
                            UI.showLoading();
                            await API.call('assignCurriculum', { student_id: studentId, curriculum_id: curId });
                            UI.showToast('Curriculum assigned successfully', 'success');
                            UI.closeModal();
                            window.location.reload();
                        } catch(e) {
                            UI.showToast(e.message, 'error');
                        } finally {
                            UI.hideLoading();
                        }
                    }}
                ]
            );
        } catch (e) {
            UI.hideLoading();
            UI.showToast(e.message, 'error');
        }
    });
}
