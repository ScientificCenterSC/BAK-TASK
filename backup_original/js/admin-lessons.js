// admin-lessons.js
document.addEventListener('DOMContentLoaded', async () => {
    Auth.requireAdmin();
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
        window.location.href = 'admin-login.html';
    });

    await loadData();

    document.getElementById('addLessonBtn').addEventListener('click', () => showLessonModal());
    document.getElementById('uploadFilesBtn').addEventListener('click', () => uploadFiles());
});

let globalCurricula = [];
let globalLessons = [];
let currentCurriculumId = null;
let currentLessonId = null;
let currentLessonFiles = [];

async function loadData() {
    try {
        UI.showLoading();
        const res = await Promise.all([
            API.call('getAllCurricula'),
            API.call('getAllLessons')
        ]);
        globalCurricula = res[0].curricula || [];
        globalLessons = res[1].lessons || [];
        
        // If we are deep linked or returning to a view, refresh it, else default to courses
        if (currentLessonId) {
            showView('lesson-details', currentLessonId);
        } else if (currentCurriculumId) {
            showView('lessons', currentCurriculumId);
        } else {
            showView('courses');
        }
    } catch(e) { 
        console.error(e); 
        UI.showToast("Failed to load data", "error");
    } finally {
        UI.hideLoading();
    }
}

function updateBreadcrumb(view) {
    const breadcrumb = document.getElementById('breadcrumb');
    let html = '<a onclick="showView(\'courses\')">Courses</a>';
    
    if (view === 'lessons' || view === 'lesson-details') {
        const curr = globalCurricula.find(c => c.curriculum_id === currentCurriculumId);
        html += ` <span>&gt;</span> <a onclick="showView('lessons', '${currentCurriculumId}')">${curr ? curr.name : 'Unknown Course'}</a>`;
    }
    
    if (view === 'lesson-details') {
        const les = globalLessons.find(l => l.lesson_id === currentLessonId);
        html += ` <span>&gt;</span> <span>${les ? les.title : 'Lesson Details'}</span>`;
    }
    
    breadcrumb.innerHTML = html;
}

window.showView = async (view, id = null) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    
    if (view === 'courses') {
        currentCurriculumId = null;
        currentLessonId = null;
        renderCourses();
    } else if (view === 'lessons') {
        currentCurriculumId = id;
        currentLessonId = null;
        renderLessons();
    } else if (view === 'lesson-details') {
        currentLessonId = id;
        const les = globalLessons.find(l => l.lesson_id === currentLessonId);
        if (les) currentCurriculumId = les.curriculum_id;
        renderLessonDetails();
        await loadLessonFiles();
    }
    
    updateBreadcrumb(view);
};

function renderCourses() {
    const grid = document.getElementById('coursesGrid');
    if (globalCurricula.length === 0) {
        grid.innerHTML = '<div class="card" style="grid-column: 1 / -1; text-align:center;">No courses found.</div>';
        return;
    }
    
    grid.innerHTML = globalCurricula.map(c => {
        return `
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <h3 style="margin: 0 0 0.5rem 0; color: var(--primary);">${c.name}</h3>
                    <p style="color:#666; font-size:0.9rem; margin-bottom:1rem;">${c.totalLessons || 0} Lessons</p>
                </div>
                <button class="btn btn-primary" style="width:100%;" onclick="showView('lessons', '${c.curriculum_id}')">Open Course</button>
            </div>
        `;
    }).join('');
}

function renderLessons() {
    const curr = globalCurricula.find(c => c.curriculum_id === currentCurriculumId);
    document.getElementById('lessonsCourseTitle').textContent = curr ? curr.name : 'Lessons';
    
    const grid = document.getElementById('lessonsGrid');
    const filtered = globalLessons.filter(l => l.curriculum_id === currentCurriculumId);
    
    // Sort by order by default
    filtered.sort((a,b) => (a.lesson_order||0) - (b.lesson_order||0));
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="card" style="grid-column: 1 / -1; text-align:center;">No lessons in this course. Click Add Lesson to create one.</div>';
        return;
    }
    
    grid.innerHTML = filtered.map(l => {
        return `
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;" onclick="showView('lesson-details', '${l.lesson_id}')">
                <div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="font-size:0.8rem; color:#999; font-weight:bold;">ORDER: ${l.lesson_order || 0}</span>
                        <span class="badge ${l.status === 'active' ? 'badge-success' : 'badge-secondary'}">${l.status || 'inactive'}</span>
                    </div>
                    <h4 style="margin: 0.5rem 0;">${l.title}</h4>
                    <p style="color:#666; font-size:0.85rem; margin-bottom:1rem; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${l.description || 'No description'}</p>
                    <p style="color:var(--primary); font-size:0.85rem; font-weight:bold; margin-bottom:1rem;">📁 ${l.filesCount || 0} Files</p>
                </div>
                <div style="display:flex; gap:0.5rem;" onclick="event.stopPropagation();">
                    <button class="btn btn-sm btn-primary" style="flex:1;" onclick="showView('lesson-details', '${l.lesson_id}')">Open</button>
                    <button class="btn btn-sm btn-warning" style="flex:1;" onclick="editLesson('${l.lesson_id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" style="flex:1;" onclick="deleteLesson('${l.lesson_id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderLessonDetails() {
    const l = globalLessons.find(x => x.lesson_id === currentLessonId);
    if (!l) return;
    
    document.getElementById('lessonDetailCard').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
                <span style="font-size:0.8rem; color:#999; font-weight:bold;">LESSON ${l.lesson_order || 0}</span>
                <h2 style="margin:0.25rem 0 0.5rem 0; color:var(--primary);">${l.title}</h2>
                <p style="color:#555; margin:0;">${l.description || 'No description provided.'}</p>
            </div>
            <span class="badge ${l.status === 'active' ? 'badge-success' : 'badge-secondary'}">${l.status || 'inactive'}</span>
        </div>
    `;
}

window.showLessonModal = function(lesson = null) {
    const isEdit = !!lesson;
    // We don't need to show curriculum dropdown since we are already inside a course.
    
    const bodyHtml = `
        <form id="lessonForm">
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
                curriculum_id: lesson ? lesson.curriculum_id : currentCurriculumId,
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
                await loadData();
            } catch (err) {
                UI.showToast(err.message, 'error');
            } finally {
                UI.hideLoading();
            }
        }}
    ]);
};

window.editLesson = (id) => {
    const l = globalLessons.find(x => x.lesson_id === id);
    if (l) showLessonModal(l);
};

window.deleteLesson = (id) => {
    const l = globalLessons.find(x => x.lesson_id === id);
    const filesCount = l ? (l.filesCount || 0) : 0;
    
    let msg = 'Are you sure you want to delete this lesson?';
    if (filesCount > 0) {
        msg = `This lesson contains ${filesCount} files. Deleting the lesson may also remove its associated files.\n\nContinue?`;
    }
    
    UI.confirm(msg).then(async (confirmed) => {
        if (!confirmed) return;
        try {
            UI.showLoading();
            await API.call('deleteLesson', { lesson_id: id });
            UI.showToast('Lesson deleted', 'success');
            await loadData();
        } catch (err) {
            UI.showToast(err.message, 'error');
        } finally {
            UI.hideLoading();
        }
    });
};

async function loadLessonFiles() {
    if (!currentLessonId) return;
    
    const grid = document.getElementById('filesGrid');
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center;">Loading files...</div>';
    
    try {
        const res = await API.call('getAdminLessonFiles', { lesson_id: currentLessonId });
        currentLessonFiles = res.files || [];
        renderFilesGrid();
    } catch(err) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:red;">Failed to load files</div>';
        UI.showToast(err.message, 'error');
    }
}

function getFileIcon(type, filename) {
    const t = (type || '').toLowerCase();
    const f = (filename || '').toLowerCase();
    
    if (t.includes('pdf') || f.endsWith('.pdf')) return '📄 PDF';
    if (t.includes('image') || f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.gif') || f.endsWith('.webp')) return '🖼️ Image';
    if (t.includes('video') || f.endsWith('.mp4') || f.endsWith('.mov') || f.endsWith('.avi')) return '🎥 Video';
    if (t.includes('audio') || f.endsWith('.mp3') || f.endsWith('.wav')) return '🎵 Audio';
    if (t.includes('zip') || t.includes('compressed') || f.endsWith('.zip') || f.endsWith('.rar')) return '🗜️ Archive';
    if (f.endsWith('.doc') || f.endsWith('.docx')) return '📝 Word';
    if (f.endsWith('.xls') || f.endsWith('.xlsx') || f.endsWith('.csv')) return '📊 Excel';
    if (f.endsWith('.ppt') || f.endsWith('.pptx')) return '📊 PPT';
    if (f.endsWith('.js') || f.endsWith('.py') || f.endsWith('.html') || f.endsWith('.css') || f.endsWith('.json')) return '💻 Code';
    return '📁 File';
}

function renderFilesGrid() {
    const grid = document.getElementById('filesGrid');
    if (currentLessonFiles.length === 0) {
        grid.innerHTML = '<div class="card" style="grid-column: 1 / -1; text-align:center;">No files attached to this lesson.</div>';
        return;
    }
    
    grid.innerHTML = currentLessonFiles.map(f => {
        const sizeStr = f.file_size < 1024*1024 ? (f.file_size/1024).toFixed(1) + ' KB' : (f.file_size/(1024*1024)).toFixed(1) + ' MB';
        const icon = getFileIcon(f.file_type, f.file_name);
        
        return `
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div style="font-size:1.5rem; margin-bottom:0.5rem;">${icon}</div>
                    <h4 style="margin: 0 0 0.25rem 0; word-break: break-all;">${f.file_name}</h4>
                    <p style="color:#666; font-size:0.85rem; margin:0;">${sizeStr}</p>
                    <p style="color:#999; font-size:0.8rem; margin:0.25rem 0 1rem 0;">Uploaded: ${new Date(f.created_at).toLocaleDateString()}</p>
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <a href="${f.file_url}" target="_blank" class="btn btn-sm btn-primary" style="flex:1; text-align:center; text-decoration:none;">Open / Download</a>
                    <button class="btn btn-sm btn-danger" style="flex:0 0 auto;" onclick="deleteLessonFile('${f.file_id}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

window.deleteLessonFile = async (fileId) => {
    const confirmed = await UI.confirm('Are you sure you want to delete this file?');
    if (!confirmed) return;
    
    try {
        UI.showLoading();
        await API.call('deleteLessonFile', { file_id: fileId });
        UI.showToast('File deleted', 'success');
        await loadLessonFiles();
        
        // Update global count
        const l = globalLessons.find(x => x.lesson_id === currentLessonId);
        if (l) l.filesCount = Math.max(0, l.filesCount - 1);
        
    } catch(err) {
        UI.showToast(err.message, 'error');
    } finally {
        UI.hideLoading();
    }
};

async function uploadFiles() {
    const input = document.getElementById('lessonFileInput');
    if (!input.files || input.files.length === 0) {
        UI.showToast('Please select at least one file.', 'warning');
        return;
    }

    UI.showLoading('Uploading files...');
    let successCount = 0;
    let failCount = 0;

    for (const file of input.files) {
        try {
            // Apps script max payload size for string is ~50MB. Large files might fail.
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            });

            await API.call('uploadLessonFile', {
                lesson_id: currentLessonId,
                file_name: file.name,
                file_type: file.type || 'application/octet-stream',
                file_size: file.size,
                file_data: base64Data
            });
            successCount++;
        } catch (err) {
            console.error('File upload error for', file.name, err);
            failCount++;
        }
    }
    
    UI.hideLoading();
    
    if(successCount > 0) {
        UI.showToast(`Successfully uploaded ${successCount} files`, 'success');
        // Update global count
        const l = globalLessons.find(x => x.lesson_id === currentLessonId);
        if (l) l.filesCount = (l.filesCount || 0) + successCount;
    }
    if(failCount > 0) UI.showToast(`Failed to upload ${failCount} files (Check file size limits)`, 'error');
    
    input.value = '';
    await loadLessonFiles();
}


