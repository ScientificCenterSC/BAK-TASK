// js/student-lesson.js

document.addEventListener('DOMContentLoaded', () => {
    Auth.requireStudent();
    
    const params = new URLSearchParams(window.location.search);
    const lessonId = params.get('id');
    
    if(!lessonId) {
        UI.showToast('Invalid lesson ID', 'error');
        setTimeout(() => window.history.back(), 1500);
        return;
    }

    document.getElementById('backBtn').addEventListener('click', () => {
        window.history.back(); // or use a specific curriculum url if maintained in history/session
    });
    
    loadTasks(lessonId);
});

async function loadTasks(lessonId) {
    try {
        UI.showLoading();
        
        // Start the lesson to track student progress
        try {
            await API.call('startLesson', { lesson_id: lessonId });
        } catch (e) {
            if (e.message && e.message.startsWith('CHEATING_BLOCKED')) {
                UI.showToast('Cheating detected. Some tasks are locked.', 'warning');
            } else {
                throw e;
            }
        }
        
        const data = await API.call('getTasks', { lesson_id: lessonId });
        const tasks = data.tasks || [];
        
        document.getElementById('lessonName').textContent = data.lessonTitle || 'Lesson';
        if(data.lessonDescription) document.getElementById('lessonDesc').textContent = data.lessonDescription;
        
        renderTasks(tasks);
        
        loadLessonFiles(lessonId);
        
    } catch (error) {
        UI.showToast(error.message || 'Failed to load tasks', 'error');
    } finally {
        UI.hideLoading();
    }
}

async function loadLessonFiles(lessonId) {
    try {
        const data = await API.call('getLessonFiles', { lesson_id: lessonId });
        const files = data.files || [];
        if (files.length > 0) {
            document.getElementById('lessonMaterialsContainer').style.display = 'block';
            const list = document.getElementById('lessonMaterialsList');
            list.innerHTML = files.map(file => {
                const size = formatBytes(file.file_size);
                const icon = getFileIcon(file.file_type);
                return `
                    <div class="card" style="display:flex; flex-direction:column; gap:0.5rem; padding: 1rem;">
                        <div style="font-size:2rem; text-align:center;">${icon}</div>
                        <h4 style="margin:0; text-align:center; word-break:break-word;">${file.file_name}</h4>
                        <div style="text-align:center;">
                            <span class="badge" style="background:#e2e8f0; color:#475569; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${file.file_type || 'Unknown'}</span>
                        </div>
                        <div style="text-align:center; font-size:0.8rem; color:#64748b;">${size}</div>
                        <a href="${file.file_url}" target="_blank" class="btn btn-sm btn-primary" style="margin-top:auto; text-align:center; display:block; padding: 0.4rem; text-decoration: none;">⬇ Download</a>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Failed to load lesson files:', error);
    }
}

function formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('pdf')) return '📕';
    if (t.includes('word') || t.includes('doc')) return '📘';
    if (t.includes('powerpoint') || t.includes('ppt')) return '📙';
    if (t.includes('excel') || t.includes('xls') || t.includes('csv')) return '📗';
    if (t.includes('image') || t.includes('jpg') || t.includes('png') || t.includes('jpeg')) return '🖼️';
    if (t.includes('zip') || t.includes('rar') || t.includes('tar')) return '📦';
    return '📄';
}

function renderTasks(tasks) {
    const list = document.getElementById('tasksList');
    
    if(tasks.length === 0) {
        list.innerHTML = `<div class="card"><p class="text-muted">No tasks available in this lesson yet.</p></div>`;
        return;
    }
    
    list.innerHTML = tasks.map(task => {
        let statusClass = 'available';
        let statusIcon = '📝';
        let statusText = 'Available';
        let clickHandler = `onclick="window.location.href='student-task.html?id=${task.task_id}'"`;
        
        if(task.status === 'completed' || task.isCompleted) {
            statusClass = 'completed';
            statusIcon = task.isCorrect ? '✅' : '❌';
            statusText = `Completed - Score: ${task.score || 0}/${task.points}`;
        } else if (task.status === 'locked') {
            statusClass = 'locked';
            statusIcon = '🔒';
            statusText = 'Locked';
            clickHandler = ''; // disabled
        } else if (task.status === 'expired') {
            statusClass = 'expired';
            statusIcon = '⏳';
            statusText = 'Expired';
            clickHandler = ''; // disabled unless you want to let them view read-only
        }
        
        let countdownHtml = '';
        if (task.deadline && task.status === 'available') {
            countdownHtml = `
            <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0,0,0,0.03); border: 1px solid var(--border-color); border-radius: 8px; text-align: center;">
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Time Remaining</div>
                <div class="task-countdown-timer" data-deadline="${task.deadline}" style="font-family: monospace; font-weight: bold; font-size: 1.1rem; color: var(--text-main);">
                    Loading...
                </div>
            </div>`;
        }
        
        return `
        <div class="task-card ${statusClass}" ${clickHandler}>
            <div class="task-header">
                <span class="task-status">${statusIcon} ${statusText}</span>
                <span class="task-points">${task.points || 0} pts</span>
            </div>
            <h4>${task.title || 'Task'}</h4>
            <p class="text-muted" style="font-size: 0.85rem; margin-top: 0.5rem; margin-bottom: 0;">
                ${task.type === 'multiple_choice' ? 'Multiple Choice' : (task.type === 'quiz' ? 'Quiz' : 'Short Answer')}
            </p>
            ${countdownHtml}
        </div>
    `}).join('');
    
    startGlobalCountdowns();
}

let globalCountdownInterval = null;

function startGlobalCountdowns() {
    if (globalCountdownInterval) clearInterval(globalCountdownInterval);
    
    const timers = document.querySelectorAll('.task-countdown-timer');
    if (timers.length === 0) return;
    
    function updateTimers() {
        const now = new Date().getTime();
        timers.forEach(timer => {
            const dl = new Date(timer.dataset.deadline).getTime();
            const distance = dl - now;
            
            if(distance <= 0) {
                timer.textContent = '00 Days : 00 Hours : 00 Minutes : 00 Seconds';
                timer.style.color = 'var(--danger)';
                // Optionally visually lock the card without refresh
            } else {
                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                
                const pad = n => n.toString().padStart(2, '0');
                timer.textContent = pad(days) + ' Days : ' + pad(hours) + ' Hours : ' + pad(minutes) + ' Minutes : ' + pad(seconds) + ' Seconds';
                
                if(distance < 3600000) {
                    timer.style.color = 'var(--danger)';
                } else if(distance < 86400000) {
                    timer.style.color = 'var(--warning)';
                } else {
                    timer.style.color = 'var(--success)';
                }
            }
        });
    }
    
    updateTimers();
    globalCountdownInterval = setInterval(updateTimers, 1000);
}
