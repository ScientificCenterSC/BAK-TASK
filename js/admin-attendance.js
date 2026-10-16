document.addEventListener('DOMContentLoaded', async () => {
    Auth.requireAdmin();
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
        window.location.href = 'admin-login.html';
    });

    await loadInitialData();

    document.getElementById('curriculumSelect').addEventListener('change', renderSessions);
    document.getElementById('addSessionBtn').addEventListener('click', showAddSessionModal);
    document.getElementById('backToSessionsBtn').addEventListener('click', () => {
        document.getElementById('view-attendance').style.display = 'none';
        document.getElementById('view-sessions').style.display = 'block';
        document.getElementById('curriculumSelect').disabled = false;
    });
    document.getElementById('saveAttendanceBtn').addEventListener('click', saveAttendance);
});

let globalSessions = [];
let globalCurricula = [];
let currentSessionId = null;

async function loadInitialData() {
    try {
        UI.showLoading();
        // Since getAdminSessions expects curriculum_id optionally, we just fetch them all or wait, doGetAdminSessions returns all.
        const res = await API.call('getAdminSessions');
        globalSessions = res.sessions || [];
        globalCurricula = res.curricula || [];
        
        const select = document.getElementById('curriculumSelect');
        select.innerHTML = '<option value="">-- Select a Group --</option>' + globalCurricula.map(c => `<option value="${c.curriculum_id}">${c.name}</option>`).join('');
    } catch (e) {
        UI.showToast(e.message, 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderSessions() {
    const curId = document.getElementById('curriculumSelect').value;
    const addBtn = document.getElementById('addSessionBtn');
    const tbody = document.getElementById('sessionsTableBody');
    
    if (!curId) {
        addBtn.style.display = 'none';
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Please select a group above.</td></tr>';
        return;
    }
    
    addBtn.style.display = 'inline-block';
    const filtered = globalSessions.filter(s => s.curriculum_id === curId);
    
    // Sort by date descending
    filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No sessions recorded for this group.</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td>${s.date}</td>
            <td>${s.topic}</td>
            <td>${s.curriculum_name}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openAttendance('${s.session_id}', '${s.date}', '${s.topic}')">Attendance</button>
                <button class="btn btn-sm btn-outline" onclick="editSession('${s.session_id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSession('${s.session_id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function showAddSessionModal() {
    const curId = document.getElementById('curriculumSelect').value;
    if (!curId) return;
    
    UI.showModal('Add Session', `
        <div class='form-group' style='margin-bottom:1rem;'>
            <label>Date</label>
            <input type='date' id='sessionDate' class='form-control' required>
        </div>
        <div class='form-group'>
            <label>Topic / Notes</label>
            <input type='text' id='sessionTopic' class='form-control' placeholder='e.g. Lesson 1 Intro' required>
        </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
        { label: 'Save', class: 'btn-primary', onClick: async () => {
            const date = document.getElementById('sessionDate').value;
            const topic = document.getElementById('sessionTopic').value;
            if(!date || !topic) return UI.showToast('All fields are required', 'error');
            
            try {
                UI.showLoading();
                await API.call('createSession', { curriculum_id: curId, date: date, topic: topic });
                UI.showToast('Session created successfully', 'success');
                UI.closeModal();
                await loadInitialData();
                document.getElementById('curriculumSelect').value = curId;
                renderSessions();
            } catch(e) {
                UI.showToast(e.message, 'error');
            } finally {
                UI.hideLoading();
            }
        }}
    ]);
}

window.openAttendance = async function(sessionId, date, topic) {
    currentSessionId = sessionId;
    document.getElementById('currentSessionInfo').textContent = `${date} - ${topic}`;
    document.getElementById('view-sessions').style.display = 'none';
    document.getElementById('curriculumSelect').disabled = true;
    document.getElementById('view-attendance').style.display = 'block';
    
    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading students...</td></tr>';
    
    try {
        UI.showLoading();
        const res = await API.call('getAttendance', { session_id: sessionId });
        const students = res.students || [];
        
        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No students enrolled in this group.</td></tr>';
            return;
        }
        
        tbody.innerHTML = students.map(s => `
            <tr data-studentid="${s.student_id}">
                <td>${s.code}</td>
                <td>${s.name}</td>
                <td>
                    <select class="status-select">
                        <option value="present" ${s.status === 'present' ? 'selected' : ''}>حاضر</option>
                        <option value="absent" ${s.status === 'absent' ? 'selected' : ''}>غائب</option>
                    </select>
                </td>
                <td>
                    <input type="text" class="form-control note-input" placeholder="ملاحظة..." value="${s.note || ''}">
                </td>
            </tr>
        `).join('');
    } catch(e) {
        UI.showToast(e.message, 'error');
    } finally {
        UI.hideLoading();
    }
};

async function saveAttendance() {
    if (!currentSessionId) return;
    
    const rows = document.querySelectorAll('#attendanceTableBody tr[data-studentid]');
    const data = [];
    rows.forEach(r => {
        const sid = r.getAttribute('data-studentid');
        const status = r.querySelector('.status-select').value;
        const note = r.querySelector('.note-input').value;
        data.push({ student_id: sid, status: status, note: note });
    });
    
    try {
        UI.showLoading('Saving...');
        await API.call('saveAttendance', { session_id: currentSessionId, attendance: data });
        UI.showToast('Attendance saved successfully', 'success');
    } catch (e) {
        UI.showToast(e.message, 'error');
    } finally {
        UI.hideLoading();
    }
}

window.editSession = (id) => {
    const sess = globalSessions.find(s => s.session_id === id);
    if (!sess) return;
    UI.showModal('Edit Session', `
        <div class='form-group' style='margin-bottom:1rem;'>
            <label>Date</label>
            <input type='date' id='editSessDate' class='form-control' value="${sess.date}" required>
        </div>
        <div class='form-group'>
            <label>Topic</label>
            <input type='text' id='editSessTopic' class='form-control' value="${sess.topic}" required>
        </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
        { label: 'Save', class: 'btn-primary', onClick: async () => {
            const date = document.getElementById('editSessDate').value;
            const topic = document.getElementById('editSessTopic').value;
            try {
                UI.showLoading();
                await API.call('editSession', { session_id: id, date: date, topic: topic });
                UI.showToast('Updated successfully', 'success');
                UI.closeModal();
                await loadInitialData();
                renderSessions();
            } catch(e) { UI.showToast(e.message, 'error'); } finally { UI.hideLoading(); }
        }}
    ]);
};

window.deleteSession = (id) => {
    if(!confirm('Are you sure you want to completely delete this session and all its attendance?')) return;
    UI.showLoading();
    API.call('deleteSession', { session_id: id }).then(async () => {
        UI.showToast('Deleted', 'success');
        await loadInitialData();
        renderSessions();
    }).catch(e => UI.showToast(e.message, 'error')).finally(() => UI.hideLoading());
};
