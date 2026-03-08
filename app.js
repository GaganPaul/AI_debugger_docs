/**
 * Smart Debugger Documentation App
 * Handles dynamic routing, fetching markdown files, rendering with marked.js,
 * and creating the interactive sidebar.
 */

document.addEventListener('DOMContentLoaded', () => {
    // === Core Configuration ===

    // The list of documentation files. In a real app we might fetch this from an API,
    // but here we hardcode the key files you have in your working directory.
    const docsStructure = [
        {
            title: "Getting Started",
            items: [
                { id: "readme", title: "Overview", path: "README.md" },
                { id: "architecture", title: "Architecture", path: "ARCHITECTURE.md" },
                { id: "troubleshooting", title: "Troubleshooting", path: "TROUBLESHOOTING.md" },
            ]
        },
        {
            title: "Caching",
            items: [
                { id: "caching-readme", title: "Caching System", path: "CACHING_README.md" },
                { id: "caching-strategy", title: "Strategy", path: "docs/CACHING_STRATEGY.md" },
                { id: "caching-flow", title: "Flow", path: "docs/caching_flow.md" },
            ]
        },
        {
            title: "Infrastructure & Cloud",
            items: [
                { id: "cloud-readiness", title: "Cloud Readiness", path: "CLOUD_READINESS_ASSESSMENT.md" },
                { id: "deployment", title: "Deployment Guide", path: "DEPLOYMENT.md" },
                { id: "offline-mode", title: "Offline Mode", path: "OFFLINE_MODE.md" },
            ]
        },
        {
            title: "Components",
            items: [
                { id: "cli", title: "CLI Implementation", path: "CLI_IMPLEMENTATION_SUMMARY.md" },
                { id: "ai-analyzer", title: "AI Analyzer", path: "lambda/ai_analyzer/README.md" },
                { id: "smart-debug", title: "Smart Debug Time Travel", path: "smart_debug/TIME_TRAVEL_README.md" },
            ]
        },
        {
            title: "Other",
            items: [
                { id: "contributing", title: "Contributing", path: "CONTRIBUTING.md" },
                { id: "implementation-notes", title: "Implementation Notes", path: "IMPLEMENTATION_NOTES.md" },
            ]
        }
    ];

    // Flatten items for easy lookup and search
    const allDocs = docsStructure.flatMap(group => group.items);

    // === DOM Elements ===
    const els = {
        navContainer: document.getElementById('nav-container'),
        docContent: document.getElementById('doc-content'),
        searchInput: document.getElementById('search-input'),
        mobileToggleBtn: document.getElementById('mobile-toggle'),
        mobileToggleOutBtn: document.querySelector('.mobile-toggle'),
        sidebar: document.getElementById('sidebar'),
        overlay: document.getElementById('sidebar-overlay'),
        footerNav: document.getElementById('footer-nav'),
    };

    // state
    let currentDocId = null;

    // === Marked.js Configuration ===
    marked.setOptions({
        highlight: function (code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-',
        gfm: true,
        breaks: true,
    });

    // === Initialization ===
    init();

    function init() {
        renderSidebar(docsStructure);
        setupEventListeners();
        handleRoute();
    }

    // === Routing ===
    function handleRoute() {
        const hash = window.location.hash.slice(1); // remove '#'

        let targetDoc = null;
        if (hash) {
            targetDoc = allDocs.find(doc => doc.id === hash);
        }

        // Default to first doc if no hash or invalid hash
        if (!targetDoc) {
            targetDoc = allDocs[0];
            // Don't replace state here to keep history clean, just set hash
            history.replaceState(null, null, `#${targetDoc.id}`);
        }

        loadDocument(targetDoc);
        updateActiveSidebarLink(targetDoc.id);
    }

    window.addEventListener('hashchange', handleRoute);

    // === Document Loading ===
    async function loadDocument(doc) {
        currentDocId = doc.id;

        // Show loading
        els.docContent.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading ${doc.title}...</p>
            </div>
        `;
        els.footerNav.innerHTML = ''; // Clear footer

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            const response = await fetch(doc.path);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${doc.path} (${response.status})`);
            }

            const markdownText = await response.text();

            // Artificial tiny delay for smooth transition feel if fetched instantly from cache
            setTimeout(() => {
                if (currentDocId === doc.id) { // Check if we haven't navigated away
                    renderContent(markdownText, doc);
                }
            }, 100);

        } catch (error) {
            console.error('Error loading document:', error);
            if (currentDocId === doc.id) {
                els.docContent.innerHTML = `
                    <div class="loading-state" style="color: var(--error);">
                        <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <p>Error loading document. Ensure you are running this via a local server (e.g., Live Server, Express, Python http.server) and not directly from the file system.</p>
                        <p style="font-size: 0.8rem; opacity: 0.7;">Details: ${error.message}</p>
                    </div>
                `;
            }
        }
    }

    function renderContent(markdownText, doc) {
        // Parse markdown to HTML
        const htmlContent = marked.parse(markdownText);

        // Wrap in animation container
        els.docContent.innerHTML = `<div style="animation: fadeIn var(--transition-normal)">${htmlContent}</div>`;

        // Render Footer nav
        renderFooterNav(doc);

        // Highlight code block inside the fully parsed HTML
        document.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        // Make simple tables scrollable
        els.docContent.querySelectorAll('table').forEach(table => {
            if (!table.parentElement.classList.contains('table-responsive')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-responsive';
                wrapper.style.overflowX = 'auto';
                wrapper.style.marginBottom = '1.5rem';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            }
        });
    }

    // === Sidebar Generation ===
    function renderSidebar(structure) {
        let html = '';

        structure.forEach(group => {
            html += `<div class="nav-group">`;
            html += `<div class="nav-group-title">${group.title}</div>`;
            html += `<ul class="nav-list">`;

            group.items.forEach(item => {
                html += `
                    <li class="nav-item">
                        <a href="#${item.id}" class="nav-link" data-id="${item.id}">
                            ${item.title}
                        </a>
                    </li>
                `;
            });

            html += `</ul></div>`;
        });

        els.navContainer.innerHTML = html;

        // Setup click handlers for generated links to handle mobile menu auto-close
        const links = els.navContainer.querySelectorAll('.nav-link');
        links.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    closeMobileMenu();
                }
            });
        });
    }

    function updateActiveSidebarLink(activeId) {
        const links = els.navContainer.querySelectorAll('.nav-link');
        links.forEach(link => {
            if (link.dataset.id === activeId) {
                link.classList.add('active');

                // Ensure the active link is visible in the sidebar scroll area
                const linkRect = link.getBoundingClientRect();
                const containerRect = els.navContainer.getBoundingClientRect();

                if (linkRect.top < containerRect.top || linkRect.bottom > containerRect.bottom) {
                    link.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else {
                link.classList.remove('active');
            }
        });
    }

    // === Footer Navigation ===
    function renderFooterNav(currentDoc) {
        const index = allDocs.findIndex(doc => doc.id === currentDoc.id);
        const prevDoc = index > 0 ? allDocs[index - 1] : null;
        const nextDoc = index < allDocs.length - 1 ? allDocs[index + 1] : null;

        let html = '';

        if (prevDoc) {
            html += `
                <a href="#${prevDoc.id}" class="footer-nav-link prev">
                    <span class="footer-nav-label">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                        Previous
                    </span>
                    <span class="footer-nav-title">${prevDoc.title}</span>
                </a>
            `;
        }

        if (nextDoc) {
            html += `
                <a href="#${nextDoc.id}" class="footer-nav-link next">
                    <span class="footer-nav-label">
                        Next
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                    </span>
                    <span class="footer-nav-title">${nextDoc.title}</span>
                </a>
            `;
        }

        els.footerNav.innerHTML = html;
    }

    // === Search Functionality ===
    function handleSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        const navGroups = document.querySelectorAll('.nav-group');

        if (query === '') {
            // Show all if empty
            navGroups.forEach(group => {
                group.style.display = 'block';
                const items = group.querySelectorAll('.nav-item');
                items.forEach(item => item.style.display = 'block');
            });
            return;
        }

        // Filter functionality
        navGroups.forEach(group => {
            const items = group.querySelectorAll('.nav-item');
            let hasVisibleItems = false;

            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(query)) {
                    item.style.display = 'block';
                    hasVisibleItems = true;
                } else {
                    item.style.display = 'none';
                }
            });

            group.style.display = hasVisibleItems ? 'block' : 'none';
        });
    }

    // === Mobile Menu Interaction ===
    function toggleMobileMenu() {
        els.sidebar.classList.toggle('open');
        els.overlay.classList.toggle('open');
    }

    function closeMobileMenu() {
        els.sidebar.classList.remove('open');
        els.overlay.classList.remove('open');
    }

    // === Event Listeners Setup ===
    function setupEventListeners() {
        els.searchInput.addEventListener('input', handleSearch);

        if (els.mobileToggleBtn) {
            els.mobileToggleBtn.addEventListener('click', toggleMobileMenu);
        }

        if (els.mobileToggleOutBtn) {
            els.mobileToggleOutBtn.addEventListener('click', toggleMobileMenu);
        }

        if (els.overlay) {
            els.overlay.addEventListener('click', closeMobileMenu);
        }

        // Escape key to close mobile menu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMobileMenu();
            }
        });
    }
});
