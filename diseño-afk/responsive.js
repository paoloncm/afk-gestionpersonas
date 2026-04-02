/**
 * AFK RRHH - responsive.js
 * Handles sidebar toggle and mobile interactions
 */
(function() {
    const d = document;
    
    function init() {
        const btnMenu = d.querySelector('.btn-menu');
        const sidebar = d.querySelector('.sidebar');
        
        // Create overlay if not exists
        let overlay = d.querySelector('.sidebar-overlay');
        if (!overlay && sidebar) {
            overlay = d.createElement('div');
            overlay.className = 'sidebar-overlay';
            d.body.appendChild(overlay);
        }

        if (btnMenu && sidebar && overlay) {
            const toggleMenu = () => {
                sidebar.classList.toggle('is-open');
                overlay.classList.toggle('is-active');
                d.body.style.overflow = sidebar.classList.contains('is-open') ? 'hidden' : '';
            };

            btnMenu.onclick = toggleMenu;
            overlay.onclick = toggleMenu;

            // Close menu on link click (mobile)
            sidebar.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 880) {
                        sidebar.classList.remove('is-open');
                        overlay.classList.remove('is-active');
                        d.body.style.overflow = '';
                    }
                });
            });
        }
    }

    if (d.readyState === 'loading') {
        d.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
