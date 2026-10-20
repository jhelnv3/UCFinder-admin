// js/dropdown.js
// Shared behavior for the topbar admin dropdown.
(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const menu = document.getElementById('adminMenu');
        const toggle = document.getElementById('adminMenuToggle');
        const logoutBtn = document.getElementById('logoutBtn');

        if (menu && toggle) {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('open');
            });

            document.addEventListener('click', (e) => {
                if (!menu.contains(e.target)) menu.classList.remove('open');
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') menu.classList.remove('open');
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    // Tear down the admin doc watch before signing out
                    if (window._adminUnsubscribe) {
                        try { window._adminUnsubscribe(); } catch (_) {}
                        window._adminUnsubscribe = null;
                    }
                    window._adminSignedOut = true;
                    await firebase.auth().signOut();
                    window.location.href = 'index.html';
                } catch (err) {
                    alert('Logout failed: ' + err.message);
                }
            });
        }
    });
})();