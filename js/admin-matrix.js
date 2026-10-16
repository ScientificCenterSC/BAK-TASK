// js/admin-matrix.js
document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.requireAdmin()) return;

    // Mobile sidebar toggle
    const mobileBtn = document.getElementById('mobileMenuBtn');
    if (mobileBtn) {
        mobileBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('adminSidebar');
            if (sidebar) sidebar.classList.toggle('open');
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
            window.location.href = 'admin-login.html';
        });
    }

    // Initialize Group selection
    await loadCurricula();

    // Event listeners
    document.getElementById('curriculumSelect').addEventListener('change', onCurriculumChange);
    document.getElementById('selectAllTasksBtn').addEventListener('click', selectAllTasks);
    document.getElementById('deselectAllTasksBtn').addEventListener('click', deselectAllTasks);
    document.getElementById('taskSearchInput').addEventListener('input', filterTasksList);
    document.getElementById('generateMatrixBtn').addEventListener('click', generateMatrix);
    document.getElementById('studentSearchInput').addEventListener('input', filterStudentsTable);
    document.getElementById('printMatrixBtn').addEventListener('click', printMatrixReport);
    document.getElementById('downloadPdfBtn').addEventListener('click', downloadMatrixPDF);
});

let globalCurricula = [];
let currentGroupTasks = [];
let currentLessonsMap = {};
let currentMatrixData = null;

// 1. Load Curricula / Groups
async function loadCurricula() {
    try {
        UI.showLoading();
        const res = await API.call('getAllCurricula');
        globalCurricula = res.curricula || [];
        const select = document.getElementById('curriculumSelect');
        select.innerHTML = '<option value="">-- اختر الجروب / Select Group --</option>' + 
            globalCurricula.map(c => `<option value="${UI.escapeHTML(c.curriculum_id)}">${UI.escapeHTML(c.name)}</option>`).join('');
    } catch(err) {
        UI.showToast(err.message || 'فشل تحميل المناهج', 'error');
    } finally {
        UI.hideLoading();
    }
}

// 2. On Group Selection
async function onCurriculumChange() {
    const curId = document.getElementById('curriculumSelect').value;
    const taskSection = document.getElementById('tasksSelectionSection');
    const resultSection = document.getElementById('matrixResultSection');

    if (!curId) {
        taskSection.style.display = 'none';
        resultSection.style.display = 'none';
        return;
    }

    try {
        UI.showLoading();
        // Load tasks and lessons in parallel
        const [tasksRes, lessonsRes] = await Promise.all([
            API.call('getAllTasks'),
            API.call('getAllLessons')
        ]);

        const allTasks = tasksRes.tasks || [];
        const allLessons = lessonsRes.lessons || [];

        // Build lesson title map
        currentLessonsMap = {};
        allLessons.forEach(l => {
            currentLessonsMap[l.lesson_id] = l.title;
        });

        // Filter active tasks for this curriculum
        currentGroupTasks = allTasks.filter(t => t.curriculum_id === curId && t.status === 'active');

        renderTasksCheckboxes(currentGroupTasks);
        taskSection.style.display = 'block';
        resultSection.style.display = 'none'; // reset previous matrix until re-generated
    } catch(err) {
        UI.showToast(err.message || 'فشل تحميل التاسكات', 'error');
    } finally {
        UI.hideLoading();
    }
}

// 3. Render Task Checkboxes
function renderTasksCheckboxes(tasks) {
    const grid = document.getElementById('tasksCheckboxGrid');
    if (!grid) return;

    if (tasks.length === 0) {
        grid.innerHTML = '<div style="padding:1rem; color:var(--text-muted); text-align:center; grid-column:1/-1;">لا توجد تاسكات مضافة لهذا الجروب حتى الآن.</div>';
        updateSelectedCount();
        return;
    }

    grid.innerHTML = tasks.map(task => {
        const lessonTitle = currentLessonsMap[task.lesson_id] || 'عام';
        const points = Number(task.points) || 10;
        return `
            <label class="task-checkbox-item" data-title="${UI.escapeHTML(task.title || '').toLowerCase()}" data-lesson="${UI.escapeHTML(lessonTitle).toLowerCase()}">
                <input type="checkbox" class="chk-matrix-task" value="${UI.escapeHTML(task.task_id)}" checked onchange="updateSelectedCount()">
                <div class="task-info-block">
                    <div class="task-title-text" title="${UI.escapeHTML(task.title || 'Task')}">${UI.escapeHTML(task.title || 'Task')}</div>
                    <div class="task-meta-tag">
                        <span>📚 ${UI.escapeHTML(lessonTitle)}</span>
                        <span>⭐ ${points} درجات</span>
                    </div>
                </div>
            </label>
        `;
    }).join('');

    updateSelectedCount();
}

function updateSelectedCount() {
    const checked = document.querySelectorAll('.chk-matrix-task:checked').length;
    const badge = document.getElementById('selectedTasksCountBadge');
    if (badge) {
        badge.textContent = `${checked} تاسك محدد`;
    }
}

function selectAllTasks() {
    document.querySelectorAll('.chk-matrix-task').forEach(cb => {
        // Only select currently visible ones if searched
        const label = cb.closest('label');
        if (label && label.style.display !== 'none') {
            cb.checked = true;
        }
    });
    updateSelectedCount();
}

function deselectAllTasks() {
    document.querySelectorAll('.chk-matrix-task').forEach(cb => {
        const label = cb.closest('label');
        if (label && label.style.display !== 'none') {
            cb.checked = false;
        }
    });
    updateSelectedCount();
}

function filterTasksList() {
    const term = (document.getElementById('taskSearchInput').value || '').trim().toLowerCase();
    const items = document.querySelectorAll('.task-checkbox-item');
    items.forEach(item => {
        const title = item.dataset.title || '';
        const lesson = item.dataset.lesson || '';
        if (title.includes(term) || lesson.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// 4. Generate Matrix Data
async function generateMatrix() {
    const curId = document.getElementById('curriculumSelect').value;
    const selectedTaskCheckboxes = Array.from(document.querySelectorAll('.chk-matrix-task:checked'));
    const selectedTaskIds = selectedTaskCheckboxes.map(cb => cb.value);

    if (!curId) {
        return UI.showToast('الرجاء اختيار الجروب أولاً', 'warning');
    }
    if (selectedTaskIds.length === 0) {
        return UI.showToast('الرجاء تحديد تاسك واحد على الأقل لعرض الماتريكس', 'warning');
    }

    try {
        UI.showLoading('جاري تجميع بيانات الماتريكس...');

        let matrixData;
        try {
            // Attempt dedicated high-speed server endpoint
            matrixData = await API.call('getMatrixData', {
                curriculum_id: curId,
                task_ids: selectedTaskIds
            });
        } catch(serverErr) {
            console.warn('getMatrixData endpoint unavailable, using smart client-side aggregation fallback:', serverErr);
            matrixData = await generateMatrixClientFallback(curId, selectedTaskIds);
        }

        currentMatrixData = matrixData;
        renderMatrixTable(matrixData);

        const resultSection = document.getElementById('matrixResultSection');
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth' });

    } catch(err) {
        console.error('Matrix generation error:', err);
        UI.showToast(err.message || 'فشل إنشاء الماتريكس', 'error');
    } finally {
        UI.hideLoading();
    }
}

// Fallback in case backend endpoint is not yet updated
async function generateMatrixClientFallback(curId, selectedTaskIds) {
    const [allStudentsRes, lessonsRes, tasksRes] = await Promise.all([
        API.call('getAllStudents'),
        API.call('getAllLessons'),
        API.call('getAllTasks')
    ]);

    const curricula = globalCurricula;
    const group = curricula.find(c => c.curriculum_id === curId) || { name: 'Group' };
    const groupLessons = (lessonsRes.lessons || []).filter(l => l.curriculum_id === curId);
    const lessonIds = groupLessons.map(l => l.lesson_id);

    // Call group report data to fetch student answers
    const reportRes = await API.call('getGroupReportData', {
        curriculum_id: curId,
        lesson_ids: lessonIds
    });

    const reportStudents = reportRes.students || [];
    const selectedTasks = (tasksRes.tasks || []).filter(t => selectedTaskIds.includes(t.task_id));

    const students = reportStudents.map(st => {
        let studentTotal = 0;
        let totalMax = 0;
        const scores = {};

        selectedTasks.forEach(task => {
            let foundScore = null;
            let submitted = false;
            // Search inside lessons
            (st.lessons || []).forEach(les => {
                (les.tasks || []).forEach(t => {
                    if (t.title === task.title || (t.task_id && t.task_id === task.task_id)) {
                        foundScore = t.score;
                        submitted = t.submitted;
                    }
                });
            });

            const pts = Number(task.points) || 10;
            scores[task.task_id] = {
                score: foundScore,
                submitted: submitted,
                max_score: pts
            };

            if (foundScore !== null && foundScore !== undefined) {
                studentTotal += Number(foundScore) || 0;
            }
            totalMax += pts;
        });

        return {
            student_id: st.student_id,
            name: st.name,
            code: st.code,
            scores: scores,
            total_score: studentTotal,
            total_max: totalMax,
            percentage: totalMax > 0 ? Math.round((studentTotal / totalMax) * 100) : 0
        };
    });

    return {
        group_id: curId,
        group_name: group.name,
        tasks: selectedTasks.map(t => ({
            task_id: t.task_id,
            title: t.title || 'Task',
            points: Number(t.points) || 10,
            lesson_title: currentLessonsMap[t.lesson_id] || ''
        })),
        students: students
    };
}

// 5. Render Matrix Table & KPIs
function renderMatrixTable(data) {
    const tasks = data.tasks || [];
    const students = data.students || [];
    const groupName = data.group_name || 'Group';

    // Update Headers
    document.getElementById('matrixGroupHeader').textContent = `ماتريكس: ${groupName}`;
    document.getElementById('matrixSubHeader').textContent = `تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-EG', { dateStyle: 'medium' })} | ${students.length} طالب | ${tasks.length} تاسك`;
    
    // Update Print Header
    document.getElementById('printGroupTitle').textContent = `الجروب: ${groupName}`;
    document.getElementById('printDate').textContent = new Date().toLocaleString();
    document.getElementById('printStudentCount').textContent = students.length;
    document.getElementById('printTaskCount').textContent = tasks.length;

    // Calculate Max Possible Score
    let maxGroupScore = 0;
    tasks.forEach(t => { maxGroupScore += (Number(t.points) || 10); });

    // Calculate Average Score across all students
    let overallScoresSum = 0;
    students.forEach(s => { overallScoresSum += (Number(s.total_score) || 0); });
    const avgScore = students.length > 0 ? (overallScoresSum / students.length).toFixed(1) : 0;
    const avgPercent = maxGroupScore > 0 ? Math.round((avgScore / maxGroupScore) * 100) : 0;

    // Update KPI Badges
    document.getElementById('kpiStudentCount').textContent = students.length;
    document.getElementById('kpiTasksCount').textContent = tasks.length;
    document.getElementById('kpiMaxPoints').textContent = maxGroupScore;
    document.getElementById('kpiAverageScore').textContent = `${avgPercent}% (${avgScore}/${maxGroupScore})`;

    // Build Table Header
    const thead = document.getElementById('matrixTableHead');
    let headHtml = `
        <tr>
            <th style="width:40px;">#</th>
            <th class="col-sticky-name">اسم الطالب (Name)</th>
            <th class="col-sticky-code">الكود</th>
    `;

    tasks.forEach((t, i) => {
        headHtml += `
            <th title="${UI.escapeHTML(t.title)} (${UI.escapeHTML(t.lesson_title || '')})">
                <div style="max-width:140px; overflow:hidden; text-overflow:ellipsis;" title="${UI.escapeHTML(t.title)}">
                    ${UI.escapeHTML(t.title)}
                </div>
                <div style="font-size:0.75rem; color:#94A3B8; font-weight:normal; margin-top:2px;">
                    (${t.points} درجات)
                </div>
            </th>
        `;
    });

    headHtml += `
            <th style="background:#0F172A; color:#38BDF8; min-width:110px;">المجموع (${maxGroupScore})</th>
            <th style="background:#0F172A; color:#38BDF8; min-width:85px;">النسبة</th>
        </tr>
    `;
    thead.innerHTML = headHtml;

    // Build Table Body
    const tbody = document.getElementById('matrixTableBody');
    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${tasks.length + 5}" style="padding:2rem; text-align:center; color:var(--text-muted);">لا يوجد طلاب مسجلين في هذا الجروب.</td></tr>`;
        document.getElementById('matrixTableFoot').innerHTML = '';
        return;
    }

    // Task column sums for average calculation
    const taskSums = {};
    const taskSubmissionsCount = {};
    tasks.forEach(t => {
        taskSums[t.task_id] = 0;
        taskSubmissionsCount[t.task_id] = 0;
    });

    let bodyHtml = students.map((s, idx) => {
        let rowHtml = `
            <tr class="student-matrix-row" data-name="${UI.escapeHTML(s.name || '').toLowerCase()}" data-code="${UI.escapeHTML(s.code || '').toLowerCase()}">
                <td style="color:var(--text-muted);">${idx + 1}</td>
                <td class="col-sticky-name">${UI.escapeHTML(s.name)}</td>
                <td class="col-sticky-code">${UI.escapeHTML(s.code || '-')}</td>
        `;

        tasks.forEach(t => {
            const scoreObj = (s.scores && s.scores[t.task_id]) ? s.scores[t.task_id] : null;
            let displayScore = '—';
            let cellClass = 'score-missing';

            if (scoreObj && (scoreObj.score !== null && scoreObj.score !== undefined)) {
                const val = Number(scoreObj.score) || 0;
                const max = Number(scoreObj.max_score) || Number(t.points) || 10;
                displayScore = `${val} / ${max}`;
                taskSums[t.task_id] += val;
                taskSubmissionsCount[t.task_id]++;

                if (val >= max) {
                    cellClass = 'score-full';
                } else if (val > 0) {
                    cellClass = 'score-partial';
                } else {
                    cellClass = 'score-zero';
                }
            }

            rowHtml += `<td class="${cellClass}">${displayScore}</td>`;
        });

        // Total badge style
        let badgeClass = 'total-low';
        if (s.percentage >= 80) badgeClass = 'total-high';
        else if (s.percentage >= 50) badgeClass = 'total-mid';

        rowHtml += `
            <td style="font-weight:bold; font-size:0.95rem;">
                <span class="total-badge ${badgeClass}">${s.total_score} / ${maxGroupScore}</span>
            </td>
            <td>
                <span class="total-badge ${badgeClass}">${s.percentage}%</span>
            </td>
        </tr>
        `;
        return rowHtml;
    }).join('');

    tbody.innerHTML = bodyHtml;

    // Build Table Foot (Averages)
    const tfoot = document.getElementById('matrixTableFoot');
    let footHtml = `
        <tr class="matrix-summary-row">
            <td colspan="3" style="text-align:right; padding-right:1.5rem;">متوسط الدرجات (Class Average):</td>
    `;

    tasks.forEach(t => {
        const count = students.length;
        const avg = count > 0 ? (taskSums[t.task_id] / count).toFixed(1) : 0;
        const max = Number(t.points) || 10;
        footHtml += `<td>${avg} / ${max}</td>`;
    });

    footHtml += `
            <td>${avgScore} / ${maxGroupScore}</td>
            <td>${avgPercent}%</td>
        </tr>
    `;
    tfoot.innerHTML = footHtml;
}

// 6. Live Filter Students
function filterStudentsTable() {
    const term = (document.getElementById('studentSearchInput').value || '').trim().toLowerCase();
    const rows = document.querySelectorAll('.student-matrix-row');
    rows.forEach(r => {
        const name = r.dataset.name || '';
        const code = r.dataset.code || '';
        if (name.includes(term) || code.includes(term)) {
            r.style.display = '';
        } else {
            r.style.display = 'none';
        }
    });
}

// Helper to build a pristine, printable HTML table with adaptive column layout
function buildCleanMatrixHTML() {
    if (!currentMatrixData || !currentMatrixData.students || currentMatrixData.students.length === 0) {
        return null;
    }

    const groupName = currentMatrixData.group_name || 'Group';
    const tasks = currentMatrixData.tasks || [];
    const students = currentMatrixData.students || [];
    const totalMax = currentMatrixData.total_max_points || 0;

    // Use compact mode when tasks count > 8 so ALL columns fit neatly on A4 Landscape
    const isCompact = tasks.length > 8;

    let headerHtml = `
        <div style="border-bottom: 2.5px solid #1E293B; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl;">
            <div>
                <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0F172A;">تقرير درجات الطلاب - ماتريكس المهام</h1>
                <div style="font-size: 13px; margin-top: 3px; color: #334155; font-weight: 600;">المجموعة / الجروب: <strong style="color: #2563EB;">${UI.escapeHTML(groupName)}</strong></div>
            </div>
            <div style="text-align: left; font-size: 10px; color: #475569; line-height: 1.4;">
                <div>تاريخ التقرير: <strong>${new Date().toLocaleDateString('ar-EG')}</strong></div>
                <div>عدد الطلاب: <strong>${students.length}</strong> | المهام: <strong>${tasks.length}</strong> | الدرجة العظمى: <strong>${totalMax}</strong></div>
            </div>
        </div>
    `;

    // Dynamic column widths based on number of tasks
    const numW = isCompact ? '26px' : '35px';
    const codeW = isCompact ? (tasks.length > 20 ? '55px' : '65px') : '75px';
    const nameW = isCompact ? (tasks.length > 20 ? '110px' : '130px') : '160px';
    const totW = isCompact ? '48px' : '65px';
    const pctW = isCompact ? '40px' : '55px';

    const cellPadding = isCompact ? '3px 2px' : '6px 4px';
    const fontSize = isCompact ? (tasks.length > 20 ? '8.5px' : '9.5px') : '11px';

    let tableHtml = `
        <table style="width: 100%; border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: ${fontSize}; color: #0F172A; direction: rtl; table-layout: fixed;" border="1">
            <thead>
                <tr style="background: #F1F5F9; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                    <th style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: center; width: ${numW};">#</th>
                    <th style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: center; width: ${codeW};">الكود</th>
                    <th style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: right; width: ${nameW}; padding-right: 5px;">اسم الطالب</th>
    `;

    tasks.forEach((t, i) => {
        const shortName = isCompact ? `T${i + 1}` : UI.escapeHTML(t.title);
        tableHtml += `
            <th style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: center; background: #F8FAFC; overflow: hidden;">
                <div style="font-weight: 800; font-size: ${isCompact ? '9px' : '10px'}; color: #0F172A;">${shortName}</div>
                <div style="font-size: 7.5px; color: #64748B; font-weight: normal;">(${t.points})</div>
            </th>
        `;
    });

    tableHtml += `
                    <th style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: center; width: ${totW}; background: #E2E8F0;">المجموع<br><span style="font-size:7.5px; font-weight:normal;">(${totalMax})</span></th>
                    <th style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: center; width: ${pctW}; background: #E2E8F0;">النسبة</th>
                </tr>
            </thead>
            <tbody>
    `;

    students.forEach((s, idx) => {
        const bg = (idx % 2 === 0) ? '#FFFFFF' : '#F8FAFC';
        tableHtml += `
            <tr style="background: ${bg}; -webkit-print-color-adjust: exact; print-color-adjust: exact; page-break-inside: avoid;">
                <td style="padding: ${cellPadding}; border: 1px solid #CBD5E1; text-align: center; font-size: 8px;">${idx + 1}</td>
                <td style="padding: ${cellPadding}; border: 1px solid #CBD5E1; text-align: center; font-family: monospace; font-size: ${isCompact ? '8px' : '9.5px'}; font-weight: 600;">${UI.escapeHTML(s.code || '-')}</td>
                <td style="padding: ${cellPadding}; border: 1px solid #CBD5E1; text-align: right; padding-right: 5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${UI.escapeHTML(s.name)}</td>
        `;

        tasks.forEach(t => {
            const sc = s.scores[t.task_id];
            if (!sc || !sc.submitted) {
                tableHtml += `<td style="padding: ${cellPadding}; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>`;
            } else {
                let colorStyle = 'color: #0F172A; font-weight: 600;';
                if (sc.score >= sc.max_score) colorStyle = 'color: #15803D; font-weight: 800;';
                else if (sc.score === 0) colorStyle = 'color: #B91C1C; font-weight: 700;';
                tableHtml += `<td style="padding: ${cellPadding}; border: 1px solid #CBD5E1; text-align: center; ${colorStyle}">${sc.score}</td>`;
            }
        });

        tableHtml += `
                <td style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: center; font-weight: 800; background: #F1F5F9;">${s.total_score}</td>
                <td style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: center; font-weight: 800; background: #F1F5F9;">${s.percentage}%</td>
            </tr>
        `;
    });

    // Summary footer row
    tableHtml += `
            </tbody>
            <tfoot>
                <tr style="background: #E2E8F0; font-weight: 800; -webkit-print-color-adjust: exact; print-color-adjust: exact; page-break-inside: avoid; border-top: 2px solid #475569;">
                    <td colspan="3" style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: right; padding-right: 6px;">متوسط الجروب:</td>
    `;

    tasks.forEach(t => {
        let sum = 0, count = 0;
        students.forEach(s => {
            const sc = s.scores[t.task_id];
            if (sc && sc.submitted) {
                sum += sc.score;
                count++;
            }
        });
        const avg = count > 0 ? (sum / count).toFixed(1) : '-';
        tableHtml += `<td style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: center; font-weight: 800;">${avg}</td>`;
    });

    let totalAvg = 0;
    if (students.length > 0) {
        totalAvg = (students.reduce((acc, s) => acc + s.total_score, 0) / students.length).toFixed(1);
    }
    const overallPct = totalMax > 0 ? Math.round((totalAvg / totalMax) * 100) : 0;

    tableHtml += `
                    <td style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: center; font-weight: 800;">${totalAvg}</td>
                    <td style="padding: ${cellPadding}; border: 1px solid #94A3B8; text-align: center; font-weight: 800;">${overallPct}%</td>
                </tr>
            </tfoot>
        </table>
    `;

    // Tasks Directory Legend
    let legendHtml = '';
    if (isCompact) {
        legendHtml = `
            <div style="margin-top: 10px; padding: 6px 10px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 4px; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; page-break-inside: avoid;">
                <div style="font-weight: 700; font-size: 10px; color: #1E293B; margin-bottom: 4px;">📌 دليل ومفتاح المهام (Tasks Directory):</div>
                <div style="display: grid; grid-template-columns: repeat(${tasks.length > 15 ? 4 : 3}, 1fr); gap: 3px 8px; font-size: 8.5px; color: #334155;">
        `;
        tasks.forEach((t, i) => {
            legendHtml += `
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <strong style="color: #2563EB;">T${i + 1}:</strong> ${UI.escapeHTML(t.title)} <span style="color:#64748B;">(${t.points}د)</span>
                </div>
            `;
        });
        legendHtml += `
                </div>
            </div>
        `;
    }

    const footerNotice = `
        <div style="margin-top: 8px; font-size: 8.5px; color: #64748B; text-align: center; font-family: 'Segoe UI', Tahoma, Arial, sans-serif;">
            تم استخراج هذا التقرير آلياً من المنصة التعليمية • تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}
        </div>
    `;

    return headerHtml + tableHtml + legendHtml + footerNotice;
}

// 7. Print Matrix Report (Standalone Print Window with clean in-page fallback)
function printMatrixReport() {
    if (!currentMatrixData || !currentMatrixData.students || currentMatrixData.students.length === 0) {
        return UI.showToast('برجاء اختيار الجروب والتاسكات وعرض الماتريكس أولاً', 'warning');
    }

    const content = buildCleanMatrixHTML();
    if (!content) return;

    // Update in-page container as fallback
    const printContainer = document.getElementById('matrixPrintContainer');
    if (printContainer) {
        printContainer.innerHTML = content;
    }

    // Attempt clean popup window print
    try {
        const printWin = window.open('', '_blank', 'width=1150,height=750');
        if (printWin) {
            printWin.document.open();
            printWin.document.write(`
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>تقرير درجات الطلاب - ${UI.escapeHTML(currentMatrixData.group_name || 'Group')}</title>
                    <style>
                        @page {
                            size: landscape;
                            margin: 8mm 6mm;
                        }
                        * {
                            box-sizing: border-box;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        html, body {
                            margin: 0;
                            padding: 8px;
                            background: #ffffff !important;
                            color: #0f172a !important;
                            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                            direction: rtl;
                        }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
                </html>
            `);
            printWin.document.close();

            setTimeout(() => {
                printWin.focus();
                printWin.print();
            }, 300);
            return;
        }
    } catch (e) {
        console.warn('Popup window blocked, using in-page print:', e);
    }

    // Direct window.print() fallback
    setTimeout(() => {
        window.print();
    }, 150);
}

// 8. Download Direct PDF via html2pdf
function downloadMatrixPDF() {
    if (!currentMatrixData || !currentMatrixData.students || currentMatrixData.students.length === 0) {
        return UI.showToast('لا توجد بيانات للطباعة، برجاء عرض الماتريكس أولاً', 'warning');
    }

    if (typeof html2pdf === 'undefined') {
        UI.showToast('مكتبة PDF غير محملة، جاري فتح نافذة الطباعة...', 'info');
        printMatrixReport();
        return;
    }

    UI.showLoading('جاري إنشاء ملف PDF وتنسيقه بدقة عالية...');

    const groupName = currentMatrixData.group_name || 'Group';
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Matrix_${groupName.replace(/\s+/g, '_')}_${dateStr}.pdf`;

    const container = document.createElement('div');
    container.style.padding = '8px';
    container.style.backgroundColor = '#FFFFFF';
    container.style.color = '#0F172A';
    container.style.fontFamily = "'Segoe UI', Tahoma, Arial, sans-serif";
    container.style.width = '1120px';
    container.dir = 'rtl';

    const content = buildCleanMatrixHTML();
    container.innerHTML = content || '';

    document.body.appendChild(container);

    const opt = {
        margin: [5, 5, 5, 5],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#FFFFFF', windowWidth: 1200 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(container).save()
        .then(() => {
            if (container && container.parentNode) container.parentNode.removeChild(container);
            UI.hideLoading();
            UI.showToast('تم تحميل ملف PDF بنجاح!', 'success');
        })
        .catch(err => {
            if (container && container.parentNode) container.parentNode.removeChild(container);
            UI.hideLoading();
            console.error('PDF generation error:', err);
            UI.showToast('تعذر تنزيل PDF تلقائياً، يمكنك استخدام زر الطباعة (Print) واختيار حفظ كـ PDF', 'warning');
        });
}
