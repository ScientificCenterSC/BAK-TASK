
document.getElementById('resetPwdBtn').addEventListener('click', () => {
    UI.showModal({
        title: 'Reset Password',
        content: `
            <div class='form-group'>
                <label>New Password</label>
                <input type='text' id='newPwdInput' class='form-control'>
            </div>
        `,
        actions: [
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
    });
});

document.getElementById('assignCurriculumBtn').addEventListener('click', async () => {
    try {
        UI.showLoading();
        const res = await API.call('getAllCurricula');
        const curricula = res.curricula || [];
        UI.hideLoading();
        if (curricula.length === 0) return UI.showToast('No curricula available to assign.', 'warning');
        
        const optionsHtml = curricula.map(c => `<option value='${c.curriculum_id}'>${c.name}</option>`).join('');
        
        UI.showModal({
            title: 'Assign Curriculum',
            content: `<div class='form-group'><label>Select Curriculum</label><select id='assignCurSelect' class='form-control' style='width:100%; padding:0.5rem;'>${optionsHtml}</select></div>`,
            actions: [
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
        });
    } catch (e) {
        UI.hideLoading();
        UI.showToast(e.message, 'error');
    }
});
