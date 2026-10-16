// admin-import.js
document.addEventListener('DOMContentLoaded', async () => {
    Auth.requireAdmin();
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
        window.location.href = 'admin-login.html';
    });

    initDragAndDrop();
    await loadDropdowns();

    document.getElementById('confirmImportBtn').addEventListener('click', confirmImport);
});

let parsedTasks = [];

async function loadDropdowns() {
    try {
        const res = await API.call('getAllCurricula');
        const currSelect = document.getElementById('currSelect');
        currSelect.innerHTML = '<option value="">-- Select Curriculum --</option>' + (res.curricula || []).map(c => `<option value="${c.curriculum_id}">${c.name}</option>`).join('');
        
        currSelect.addEventListener('change', async (e) => {
            const cid = e.target.value;
            const lesSelect = document.getElementById('lessonSelect');
            if(!cid) { lesSelect.innerHTML = ''; return; }
            const lRes = await API.call('getAllLessons'); // ideally pass curriculum_id
            const lessons = (lRes.lessons || []).filter(l => l.curriculum_id === cid);
            lesSelect.innerHTML = '<option value="">-- Select Lesson --</option>' + lessons.map(l => `<option value="${l.lesson_id}">${l.title}</option>`).join('');
        });
    } catch(e) {
        console.error(e);
    }
}

function initDragAndDrop() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });
}

function handleFile(file) {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        UI.showToast('Please upload a valid JSON file', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error("JSON must be an array of tasks");
            parsedTasks = data;
            showPreview();
        } catch (err) {
            UI.showToast('Invalid JSON format: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}

function showPreview() {
    document.getElementById('step1').classList.remove('active');
    document.getElementById('step2').classList.add('active');
    const tbody = document.getElementById('previewBody');
    tbody.innerHTML = parsedTasks.map(t => `
        <tr>
            <td>${t.type || 'unknown'}</td>
            <td>${t.question || t.title || 'No question text'}</td>
            <td>${t.points || 1}</td>
        </tr>
    `).join('');
}

async function confirmImport() {
    const cid = document.getElementById('currSelect').value;
    const lid = document.getElementById('lessonSelect').value;
    const taskTitle = document.getElementById('importTaskTitle').value;
    if (!cid || !lid) {
        UI.showToast('Please select a curriculum and lesson', 'error');
        return;
    }
    
    try {
        UI.showLoading();
        const res = await API.call('importTasks', {
            curriculum_id: cid,
            lesson_id: lid,
            task_title: taskTitle,
            tasks: parsedTasks.map(t => ({...t, deadline: document.getElementById('importDeadline').value, allow_late: document.getElementById('importAllowLate').checked}))
        });
        
        document.getElementById('step2').classList.remove('active');
        document.getElementById('step3').classList.add('active');
        document.getElementById('resultsMsg').innerHTML = `
            <span style="color:green">Successfully imported: ${res.imported_count || parsedTasks.length} tasks</span><br>
        `;
    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.hideLoading();
    }
}

window.resetWizard = () => {
    parsedTasks = [];
    document.getElementById('fileInput').value = '';
    document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
    document.getElementById('step1').classList.add('active');
};

