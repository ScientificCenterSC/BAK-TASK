// admin-lessons.js
document.addEventListener('DOMContentLoaded', async () => {
    Auth.requireAdmin();
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
        window.location.href = 'admin-login.html';
    });

    await loadFilters();
    await loadLessons();

    document.getElementById('addLessonBtn').addEventListener('click', () => showLessonModal());
    document.getElementById('filterCurriculum').addEventListener('change', loadLessons);
});

let lessonsList = [];
let curriculaList = [];

async function loadFilters() {
    try {
        const res = await API.call('getAllCurricula');
        curriculaList = res.curricula || [];
        const filter = document.getElementById('filterCurriculum');
        filter.innerHTML = '<option value="">All Curricula</option>' + curriculaList.map(c => `<option value="${c.curriculum_id}">${c.name}</option>`).join('');
    } catch(e) { console.error(e); }
}

async function loadLessons() {
    try {
        UI.showLoading();
        const res = await API.call('getAllLessons');
        lessonsList = res.lessons || [];
        renderTable();
    } catch (err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderTable() {
    const filterId = document.getElementById('filterCurriculum').value;
    const filtered = filterId ? lessonsList.filter(l => l.curriculum_id === filterId) : lessonsList;
    
    const tbody = document.getElementById('lessonsTableBody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No lessons found.</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(l => {
        const curr = curriculaList.find(c => c.curriculum_id === l.curriculum_id);
        return `
            <tr>
                <td>${l.lesson_order || 0}</td>
                <td>${l.title || ''}</td>
                <td>${curr ? curr.name : 'Unknown'}</td>
                <td><button class="btn btn-sm btn-info" onclick="manageLessonFiles('${l.lesson_id}', '${(l.title||'').replace(/'/g, "\\'")}')">📁 Files (${l.filesCount || 0})</button></td>
                <td><span class="badge ${l.status === 'active' ? 'badge-success' : 'badge-secondary'}">${l.status || 'inactive'}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-sm btn-primary" onclick="editLesson('${l.lesson_id}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteLesson('${l.lesson_id}')">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showLessonModal(lesson = null) {
    const isEdit = !!lesson;
    const currOptions = curriculaList.map(c => `<option value="${c.curriculum_id}" ${lesson && lesson.curriculum_id === c.curriculum_id ? 'selected' : ''}>${c.name}</option>`).join('');
    
    const bodyHtml = `
        <form id="lessonForm">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Curriculum</label>
                <select id="lCurr" class="form-control" style="width:100%; padding:0.5rem;" required>
                    <option value="">Select...</option>
                    ${currOptions}
                </select>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Title</label>
                <input type="text" id="lTitle" class="form-control" style="width:100%; padding:0.5rem;" required value="${lesson ? lesson.title : ''}">
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Description</label>
                <textarea id="lDesc" class="form-control" style="width:100%; padding:0.5rem;" rows="3">${lesson ? (lesson.description||'') : ''}</textarea>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Order</label>
                <input type="number" id="lOrder" class="form-control" style="width:100%; padding:0.5rem;" value="${lesson ? (lesson.lesson_order||0) : 0}">
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Status</label>
                <select id="lStatus" class="form-control" style="width:100%; padding:0.5rem;">
                    <option value="active" ${lesson && lesson.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${lesson && lesson.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                </select>
            </div>
        </form>
    `;

    UI.showModal(isEdit ? 'Edit Lesson' : 'Add Lesson', bodyHtml, [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
        { label: 'Save', class: 'btn-primary', onClick: async () => {
            const data = {
                curriculum_id: document.getElementById('lCurr').value,
                title: document.getElementById('lTitle').value,
                description: document.getElementById('lDesc').value,
                lesson_order: parseInt(document.getElementById('lOrder').value),
                status: document.getElementById('lStatus').value
            };
            if (isEdit) data.lesson_id = lesson.lesson_id;

            try {
                UI.showLoading();
                await API.call(isEdit ? 'updateLesson' : 'addLesson', data);
                UI.showToast(`Lesson ${isEdit ? 'updated' : 'added'} successfully`, 'success');
                UI.closeModal();
                await loadLessons();
            } catch (err) {
                UI.showToast(err.message, 'error');
            } finally {
                UI.hideLoading();
            }
        }}
    ]);
}

window.editLesson = (id) => {
    const l = lessonsList.find(x => x.lesson_id === id);
    if (l) showLessonModal(l);
};

window.deleteLesson = (id) => {
    UI.confirm('Are you sure you want to delete this lesson?').then(async (confirmed) => {
        if (!confirmed) return;
        try {
            UI.showLoading();
            await API.call('deleteLesson', { lesson_id: id });
            UI.showToast('Lesson deleted', 'success');
            await loadLessons();
        } catch (err) {
            UI.showToast(err.message, 'error');
        } finally {
            UI.hideLoading();
        }
    });
};

window.manageLessonFiles = async (lessonId, lessonTitle) => {
    let files = [];
    
    const renderFiles = () => {
        const tbody = document.getElementById('lessonFilesTableBody');
        if (!tbody) return;
        
        if (files.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No files found.</td></tr>';
            return;
        }
        
        tbody.innerHTML = files.map(f => `
            <tr>
                <td><a href="${f.file_url}" target="_blank">${f.file_name}</a></td>
                <td>${f.file_type}</td>
                <td>${f.file_size < 1024*1024 ? (f.file_size/1024).toFixed(1) + ' KB' : (f.file_size/(1024*1024)).toFixed(1) + ' MB'}</td>
                <td>${new Date(f.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteLessonFile('${f.file_id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    };

    const loadFiles = async () => {
        try {
            UI.showLoading();
            const res = await API.call('getAdminLessonFiles', { lesson_id: lessonId });
            files = res.files || [];
            renderFiles();
            
            // Update the count in the main table if possible
            const lesson = lessonsList.find(l => l.lesson_id === lessonId);
            if(lesson) {
                lesson.filesCount = files.length;
                renderTable(); // re-render table in background
            }
        } catch (err) {
            UI.showToast(err.message, 'error');
        } finally {
            UI.hideLoading();
        }
    };

    window.deleteLessonFile = async (fileId) => {
        const confirmed = await UI.confirm('Are you sure you want to delete this file?');
        if (!confirmed) return;
        
        try {
            UI.showLoading();
            await API.call('deleteLessonFile', { file_id: fileId });
            UI.showToast('File deleted', 'success');
            await loadFiles();
        } catch(err) {
            UI.showToast(err.message, 'error');
        } finally {
            UI.hideLoading();
        }
    };

    const modalBody = `
        <div style="margin-bottom: 1rem;">
            <input type="file" id="lessonFileInput" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.gif,.mp4,.mp3" class="form-control" style="margin-bottom: 0.5rem;">
            <button id="uploadFilesBtn" class="btn btn-primary">Upload</button>
        </div>
        <div class="admin-table-container" style="max-height: 400px; overflow-y: auto;">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>File Name</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Upload Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="lessonFilesTableBody">
                    <tr><td colspan="5" style="text-align: center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    UI.showModal('Manage Files: ' + lessonTitle, modalBody, [
        { label: 'Close', class: 'btn-secondary', onClick: () => UI.closeModal() }
    ]);

    await loadFiles();

    document.getElementById('uploadFilesBtn').addEventListener('click', async () => {
        const input = document.getElementById('lessonFileInput');
        if (!input.files || input.files.length === 0) {
            UI.showToast('Please select at least one file.', 'error');
            return;
        }

        UI.showLoading();
        let successCount = 0;
        let failCount = 0;

        for (const file of input.files) {
            try {
                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = error => reject(error);
                    reader.readAsDataURL(file);
                });

                await API.call('uploadLessonFile', {
                    lesson_id: lessonId,
                    file_name: file.name,
                    file_type: file.type || 'application/octet-stream',
                    file_size: file.size,
                    file_data: base64Data
                });
                successCount++;
            } catch (err) {
                console.error('File upload error:', err);
                failCount++;
            }
        }
        
        UI.hideLoading();
        
        if(successCount > 0) UI.showToast(`Successfully uploaded ${successCount} files`, 'success');
        if(failCount > 0) UI.showToast(`Failed to upload ${failCount} files`, 'error');
        
        input.value = '';
        await loadFiles();
    });
};


