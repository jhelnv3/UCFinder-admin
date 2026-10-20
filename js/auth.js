// js/auth.js
// Shared auth guard for all admin pages.
//
// Responsibilities:
//   1. Redirect to index.html if the user is not signed in.
//   2. Verify the user has a Firestore user document with is_admin == true.
//   3. Watch that document in real time so a revoked admin loses access
//      immediately, without needing a page reload.
//
// It does NOT touch Firebase Authentication signup/login itself, so the
// Unity app's signup/login flow is completely unaffected.

(function () {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Expose to page scripts
    window.auth = auth;
    window.db = db;

    // Optional hook so a page can clean up if needed
    window._adminUnsubscribe = null;
    window._adminSignedOut = false;

    // Centralized sign-out-with-redirect so all revocation paths behave the same
    async function revokeAndRedirect(message) {
        if (window._adminSignedOut) return;
        window._adminSignedOut = true;

        if (window._adminUnsubscribe) {
            try { window._adminUnsubscribe(); } catch (_) { /* ignore */ }
            window._adminUnsubscribe = null;
        }

        if (message) {
            try { alert(message); } catch (_) { /* ignore */ }
        }

        try { await auth.signOut(); } catch (_) { /* ignore */ }

        window.location.href = 'index.html';
    }

    // Called by every protected page. Wraps the page's init logic so it
    // only runs after the admin check passes.
    window.requireAdmin = function (onReady) {
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }

            let snap;
            try {
                snap = await db.collection('users')
                    .where('email', '==', user.email)
                    .where('is_admin', '==', true)
                    .limit(1)
                    .get();
            } catch (err) {
                console.error('[auth] Admin check failed:', err);
                await revokeAndRedirect('Could not verify admin status: ' + err.message);
                return;
            }

            if (snap.empty) {
                await revokeAndRedirect('Access denied. Admin accounts only.');
                return;
            }

            const adminDoc = snap.docs[0];
            const adminDocId = adminDoc.id;
            const adminData = adminDoc.data();

            // Expose to page scripts
            window.adminDocId = adminDocId;
            window.adminData = adminData;

            // ---- Real-time watch: revoke as soon as is_admin flips to false ----
            // We watch the doc by ID (not by query) so the listener stays attached
            // even if the email field is changed.
            if (window._adminUnsubscribe) {
                try { window._adminUnsubscribe(); } catch (_) { /* ignore */ }
            }
            window._adminUnsubscribe = db.collection('users').doc(adminDocId)
                .onSnapshot(
                    (doc) => {
                        if (!doc.exists) {
                            revokeAndRedirect('Your admin account has been removed.');
                            return;
                        }
                        const d = doc.data();
                        if (d.is_admin !== true) {
                            revokeAndRedirect('Your admin access has been revoked.');
                        }
                    },
                    (err) => {
                        console.error('[auth] Admin doc watch failed:', err);
                        // Permission errors here usually mean the rules already
                        // blocked us. Treat as revocation.
                        if (err && (err.code === 'permission-denied' || err.code === 'unauthenticated')) {
                            revokeAndRedirect('Your admin access is no longer valid.');
                        }
                    }
                );

            // Everything checks out — let the page render
            onReady(user, adminDocId, adminData);
        });
    };

    // Bonus: if the auth token itself is revoked (password change, admin disabled, etc.)
    auth.onIdTokenChanged((user) => {
        if (!user && window._adminSignedOut === false && !window.location.pathname.endsWith('index.html')) {
            // Someone signed out elsewhere or auth was revoked server-side
            window.location.href = 'index.html';
        }
    });
})();