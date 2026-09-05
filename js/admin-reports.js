// admin-reports.js
document.addEventListener('DOMContentLoaded', async () => {
    Auth.requireAdmin();
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
        window.location.href = 'admin-login.html';
    });

    try {
        const res = await API.call('getAllStudents');
        const select = document.getElementById('reportStudent');
        select.innerHTML = '<option value="">-- Select Student --</option>' + (res.students || []).map(s => `<option value="${s.student_id}">${s.name} (${s.code})</option>`).join('');
    } catch(e) {
        console.error(e);
    }

    document.getElementById('downloadPdfBtn').addEventListener('click', () => {
        const studentId = document.getElementById('reportStudent').value;
        if (!studentId) {
            UI.showToast('Please select a student first', 'warning');
            return;
        }
        
        if (typeof PDF !== 'undefined' && PDF.downloadStudentReport) {
            PDF.downloadStudentReport(studentId);
        } else {
            UI.showToast('PDF module not loaded', 'error');
        }
    });
});
