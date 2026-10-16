document.addEventListener('DOMContentLoaded', async () => {
    Auth.requireAdmin();
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
        window.location.href = 'admin-login.html';
    });

    await loadInitialData();

    document.getElementById('curriculumSelect').addEventListener('change', renderExams);
    document.getElementById('addExamBtn').addEventListener('click', showAddExamModal);
    document.getElementById('backToExamsBtn').addEventListener('click', () => {
        document.getElementById('view-scores').style.display = 'none';
        document.getElementById('view-exams').style.display = 'block';
        document.getElementById('curriculumSelect').disabled = false;
    });
    document.getElementById('saveScoresBtn').addEventListener('click', saveScores);
});

let globalExams = [];
let globalCurricula = [];
let currentExamId = null;

async function loadInitialData() {
    try {
        UI.showLoading();
        const res = await API.call('getAdminExams');
        globalExams = res.exams || [];
        globalCurricula = res.curricula || [];
        
        const select = document.getElementById('curriculumSelect');
        select.innerHTML = '<option value="">-- Select a Group --</option>' + globalCurricula.map(c => `<option value="${c.curriculum_id}">${c.name}</option>`).join('');
    } catch (e) {
        UI.showToast(e.message, 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderExams() {
    const curId = document.getElementById('curriculumSelect').value;
    const addBtn = document.getElementById('addExamBtn');
    const tbody = document.getElementById('examsTableBody');
    
    if (!curId) {
        addBtn.style.display = 'none';
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Please select a group above.</td></tr>';
        return;
    }
    
    addBtn.style.display = 'inline-block';
    const filtered = globalExams.filter(e => e.curriculum_id === curId);
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No exams recorded for this group.</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(e => `
        <tr>
            <td>${e.name}</td>
            <td>${e.curriculum_name}</td>
            <td>${e.max_score}</td>
            <td>${new Date(e.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openExamScores('${e.exam_id}', '${e.name}')">Enter Scores</button>
                <button class="btn btn-sm btn-outline" onclick="editExam('${e.exam_id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteExam('${e.exam_id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function showAddExamModal() {
    const curId = document.getElementById('curriculumSelect').value;
    if (!curId) return;
    
    UI.showModal('Add Offline Exam', `
        <div class='form-group' style='margin-bottom:1rem;'>
            <label>Exam Name (e.g. Midterm)</label>
            <input type='text' id='examName' class='form-control' required>
        </div>
        <div class='form-group'>
            <label>Max Score</label>
            <input type='number' id='examMax' class='form-control' value='100' required>
        </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
        { label: 'Save', class: 'btn-primary', onClick: async () => {
            const name = document.getElementById('examName').value;
            const max = document.getElementById('examMax').value;
            if(!name) return UI.showToast('Exam name is required', 'error');
            
            try {
                UI.showLoading();
                await API.call('createExam', { curriculum_id: curId, name: name, max_score: max });
                UI.showToast('Exam created successfully', 'success');
                UI.closeModal();
                await loadInitialData();
                document.getElementById('curriculumSelect').value = curId;
                renderExams();
            } catch(e) {
                UI.showToast(e.message, 'error');
            } finally {
                UI.hideLoading();
            }
        }}
    ]);
}

window.openExamScores = async function(examId, examName) {
    currentExamId = examId;
    document.getElementById('currentExamName').textContent = examName;
    document.getElementById('view-exams').style.display = 'none';
    document.getElementById('curriculumSelect').disabled = true;
    document.getElementById('view-scores').style.display = 'block';
    
    const tbody = document.getElementById('scoresTableBody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading students...</td></tr>';
    
    try {
        UI.showLoading();
        const res = await API.call('getExamScores', { exam_id: examId });
        const students = res.students || [];
        
        if (students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No students enrolled in this group.</td></tr>';
            return;
        }
        
        tbody.innerHTML = students.map(s => `
            <tr data-studentid="${s.student_id}">
                <td>${s.code}</td>
                <td>${s.name}</td>
                <td>
                    <input type="number" class="form-control score-input" value="${s.score}" style="max-width:100px;">
                </td>
            </tr>
        `).join('');
    } catch(e) {
        UI.showToast(e.message, 'error');
    } finally {
        UI.hideLoading();
    }
};

async function saveScores() {
    if (!currentExamId) return;
    
    const rows = document.querySelectorAll('#scoresTableBody tr[data-studentid]');
    const scores = [];
    rows.forEach(r => {
        const sid = r.getAttribute('data-studentid');
        const val = r.querySelector('.score-input').value;
        scores.push({ student_id: sid, score: val });
    });
    
    try {
        UI.showLoading('Saving scores...');
        await API.call('saveExamScores', { exam_id: currentExamId, scores: scores });
        UI.showToast('Scores saved successfully', 'success');
    } catch (e) {
        UI.showToast(e.message, 'error');
    } finally {
        UI.hideLoading();
    }
}

window.editExam = (id) => {
    const exam = globalExams.find(e => e.exam_id === id);
    if (!exam) return;
    UI.showModal('Edit Exam', `
        <div class='form-group' style='margin-bottom:1rem;'>
            <label>Exam Name</label>
            <input type='text' id='editExamName' class='form-control' value="${exam.name}" required>
        </div>
        <div class='form-group'>
            <label>Max Score</label>
            <input type='number' id='editExamMax' class='form-control' value="${exam.max_score}" required>
        </div>
    `, [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
        { label: 'Save', class: 'btn-primary', onClick: async () => {
            const name = document.getElementById('editExamName').value;
            const max = document.getElementById('editExamMax').value;
            if(!name) return UI.showToast('Required', 'error');
            try {
                UI.showLoading();
                await API.call('editExam', { exam_id: id, name: name, max_score: max });
                UI.showToast('Updated successfully', 'success');
                UI.closeModal();
                await loadInitialData();
                renderExams();
            } catch(e) { UI.showToast(e.message, 'error'); } finally { UI.hideLoading(); }
        }}
    ]);
};

window.deleteExam = (id) => {
    if(!confirm('Are you sure you want to completely delete this exam and all its scores?')) return;
    UI.showLoading();
    API.call('deleteExam', { exam_id: id }).then(async () => {
        UI.showToast('Deleted', 'success');
        await loadInitialData();
        renderExams();
    }).catch(e => UI.showToast(e.message, 'error')).finally(() => UI.hideLoading());
};
