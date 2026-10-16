document.addEventListener('DOMContentLoaded', async () => {
    const session = Auth.requireAdmin();
    if(!session) return;

    await loadCurricula();
    await loadStudents();

    document.getElementById('addStudentBtn').addEventListener('click', () => {
        showStudentModal();
    });
});

let studentsList = [];
let globalCurricula = [];

async function loadCurricula() {
    try {
        const res = await API.call('getAllCurricula');
        globalCurricula = res.curricula || [];
    } catch(e) {
        console.error("Failed to load curricula", e);
    }
}

async function loadStudents() {
    try {
        UI.showLoading();
        const res = await API.call('getAllStudents');
        studentsList = res.students || [];
        renderTable();
    } catch (err) {
        UI.showToast('Failed to load students: ' + err.message, 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderTable() {
    const tbody = document.getElementById('studentsTableBody');
    if (studentsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No students found.</td></tr>';
        return;
    }
    tbody.innerHTML = studentsList.map(s => `
        <tr>
            <td>${s.code || ''}</td>
            <td>${s.name || ''}</td>
            <td>${s.email || ''}</td>
            <td><span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-secondary'}">${s.status || 'inactive'}</span></td>
            <td>
                <button class="btn btn-sm btn-outline" onclick="window.location.href='admin-student-profile.html?id=${s.student_id}'">Profile</button>
                <button class="btn btn-sm btn-outline" onclick="editStudent('${s.student_id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteStudent('${s.student_id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function showStudentModal(student = null) {
    const isEdit = !!student;
    
    // Create multiselect for curricula
    const currOptions = globalCurricula.map(c => `
        <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
            <input type="checkbox" name="stuCurricula" value="${c.curriculum_id}" 
                   ${isEdit && student.assignedCurriculaIds && student.assignedCurriculaIds.includes(c.curriculum_id) ? 'checked' : ''}>
            ${c.name}
        </label>
    `).join('');

    const bodyHtml = `
        <form id="studentForm">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Name</label>
                <input type="text" id="stuName" class="form-control" style="width:100%; padding:0.5rem;" required value="${student ? student.name : ''}">
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Code</label>
                <input type="text" id="stuCode" class="form-control" style="width:100%; padding:0.5rem;" required value="${student ? student.code : ''}">
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Email</label>
                <input type="email" id="stuEmail" class="form-control" style="width:100%; padding:0.5rem;" required value="${student ? student.email : ''}">
            </div>
            ${!isEdit ? `
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Password</label>
                <input type="password" id="stuPass" class="form-control" style="width:100%; padding:0.5rem;" required>
            </div>
            ` : ''}
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Status</label>
                <select id="stuStatus" class="form-control" style="width:100%; padding:0.5rem;">
                    <option value="active" ${student && student.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${student && student.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                </select>
            </div>
            <div class="form-group" style="margin-bottom:1rem; padding: 1rem; border: 1px solid #ccc; border-radius: 4px;">
                <label style="font-weight:bold; margin-bottom:0.5rem; display:block;">Assign Curricula</label>
                <div style="max-height: 150px; overflow-y: auto;">
                    ${currOptions || '<p>No curricula available. Please create some first.</p>'}
                </div>
            </div>
        </form>
    `;

    UI.showModal(isEdit ? 'Edit Student' : 'Add Student', bodyHtml, [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
        { label: 'Save', class: 'btn-primary', onClick: async () => {
            const name = document.getElementById('stuName').value.trim();
            const code = document.getElementById('stuCode').value.trim();
            const email = document.getElementById('stuEmail').value.trim();
            const status = document.getElementById('stuStatus').value;
            
            // Collect checked curricula
            const checkedCurricula = Array.from(document.querySelectorAll('input[name="stuCurricula"]:checked')).map(cb => cb.value);

            if (!name || !code || !email) {
                return UI.showToast('Please fill all required fields', 'error');
            }

            const payload = { name, code, email, status, curricula_ids: checkedCurricula };
            if (!isEdit) {
                const pass = document.getElementById('stuPass').value;
                if (!pass) return UI.showToast('Password is required', 'error');
                payload.password = pass;
            } else {
                payload.student_id = student.student_id;
            }

            try {
                UI.showLoading();
                await API.call(isEdit ? 'updateStudent' : 'addStudent', payload);
                UI.showToast(`Student ${isEdit ? 'updated' : 'added'} successfully`, 'success');
                UI.closeModal();
                await loadStudents();
            } catch (err) {
                UI.showToast(err.message, 'error');
            } finally {
                UI.hideLoading();
            }
        }}
    ]);
}

window.editStudent = (id) => {
    const student = studentsList.find(s => s.student_id === id);
    if (student) showStudentModal(student);
};

window.deleteStudent = (id) => {
    UI.confirm('Are you sure you want to delete this student?').then(async (confirmed) => {
        if (!confirmed) return;
        try {
            UI.showLoading();
            await API.call('deleteStudent', { student_id: id });
            UI.showToast('Student deleted', 'success');
            await loadStudents();
        } catch (err) {
            UI.showToast(err.message, 'error');
        } finally {
            UI.hideLoading();
        }
    });
};
