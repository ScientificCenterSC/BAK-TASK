// admin-curricula.js
document.addEventListener('DOMContentLoaded', async () => {
    Auth.requireAdmin();
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
        window.location.href = 'admin-login.html';
    });
    await loadCurricula();
    document.getElementById('addCurriculumBtn').addEventListener('click', () => showCurriculumModal());
});

let curriculaList = [];

async function loadCurricula() {
    try {
        UI.showLoading();
        const res = await API.call('getAllCurricula');
        curriculaList = res.curricula || [];
        renderTable();
    } catch (err) {
        UI.showToast('Failed to load curricula: ' + err.message, 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderTable() {
    const tbody = document.getElementById('curriculaTableBody');
    if (curriculaList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No curricula found.</td></tr>';
        return;
    }
    tbody.innerHTML = curriculaList.map(c => `
        <tr>
            <td style="font-size:1.5rem;">${c.icon || '📚'}</td>
            <td>${c.name || ''}</td>
            <td>${c.description || ''}</td>
            <td><span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-secondary'}">${c.status || 'inactive'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-primary" onclick="editCurriculum('${c.curriculum_id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCurriculum('${c.curriculum_id}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function showCurriculumModal(curriculum = null) {
    const isEdit = !!curriculum;
    const bodyHtml = `
        <form id="currForm">
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Name</label>
                <input type="text" id="cName" class="form-control" style="width:100%; padding:0.5rem;" required value="${curriculum ? curriculum.name : ''}">
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Description</label>
                <textarea id="cDesc" class="form-control" style="width:100%; padding:0.5rem;" rows="3">${curriculum ? curriculum.description : ''}</textarea>
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Icon (Emoji)</label>
                <input type="text" id="cIcon" class="form-control" style="width:100%; padding:0.5rem;" value="${curriculum ? curriculum.icon : '📚'}">
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>Status</label>
                <select id="cStatus" class="form-control" style="width:100%; padding:0.5rem;">
                    <option value="active" ${curriculum && curriculum.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${curriculum && curriculum.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                </select>
            </div>
        </form>
    `;

    UI.showModal(isEdit ? 'Edit Curriculum' : 'Add Curriculum', bodyHtml, [
        { label: 'Cancel', class: 'btn-secondary', onClick: () => UI.closeModal() },
        { label: 'Save', class: 'btn-primary', onClick: async () => {
            const data = {
                name: document.getElementById('cName').value,
                description: document.getElementById('cDesc').value,
                icon: document.getElementById('cIcon').value,
                status: document.getElementById('cStatus').value
            };
            if (isEdit) data.curriculum_id = curriculum.curriculum_id;

            try {
                UI.showLoading();
                await API.call(isEdit ? 'updateCurriculum' : 'addCurriculum', data);
                UI.showToast(`Curriculum ${isEdit ? 'updated' : 'added'} successfully`, 'success');
                UI.closeModal();
                await loadCurricula();
            } catch (err) {
                UI.showToast(err.message, 'error');
            } finally {
                UI.hideLoading();
            }
        }}
    ]);
}

window.editCurriculum = (id) => {
    const c = curriculaList.find(x => x.curriculum_id === id);
    if (c) showCurriculumModal(c);
};
window.deleteCurriculum = (id) => {
    UI.confirm('Are you sure you want to delete this curriculum?').then(async (confirmed) => {
        if (!confirmed) return;
        try {
            UI.showLoading();
            await API.call('deleteCurriculum', { curriculum_id: id });
            UI.showToast('Curriculum deleted', 'success');
            await loadCurricula();
        } catch (err) {
            UI.showToast(err.message, 'error');
        } finally {
            UI.hideLoading();
        }
    });
};

