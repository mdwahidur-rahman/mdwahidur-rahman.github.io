/* Public site behaviour — small, dependency-free, progressive enhancement.
   Everything still reads correctly without JavaScript. */
(function () {
    'use strict';
    window.__siteJs = true;

    var root = document.documentElement;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

    /* ---------- Theme: system -> light -> dark -> system (persisted) ---------- */
    var GLYPH = { system: '◐', light: '☀', dark: '☾' };
    var NEXT = { system: 'light', light: 'dark', dark: 'system' };
    function storedTheme() {
        try { var t = localStorage.getItem('theme'); return (t === 'light' || t === 'dark') ? t : 'system'; } catch (e) { return 'system'; }
    }
    function paintThemeButtons(mode) {
        $all('[data-theme-toggle]').forEach(function (btn) {
            var glyph = btn.querySelector('.theme-glyph');
            if (glyph) { glyph.textContent = GLYPH[mode]; }
            var label = 'Color theme: ' + mode + '. Switch to ' + NEXT[mode] + '.';
            btn.setAttribute('aria-label', label);
            btn.setAttribute('title', label);
        });
    }
    function applyTheme(mode) {
        if (mode === 'system') { root.removeAttribute('data-theme'); } else { root.setAttribute('data-theme', mode); }
        try { if (mode === 'system') { localStorage.removeItem('theme'); } else { localStorage.setItem('theme', mode); } } catch (e) { /* private mode */ }
        paintThemeButtons(mode);
    }
    paintThemeButtons(storedTheme());
    // Theme switch animates as a circular colour wipe from the toggle (View Transitions API),
    // falling back to a short cross-fade of colours in other browsers.
    function switchTheme(mode, btn) {
        if (reduceMotion) { applyTheme(mode); return; }
        if (document.startViewTransition && btn) {
            var r = btn.getBoundingClientRect();
            var x = r.left + r.width / 2, y = r.top + r.height / 2;
            root.style.setProperty('--vt-x', x + 'px');
            root.style.setProperty('--vt-y', y + 'px');
            root.style.setProperty('--vt-r', Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 'px');
            document.startViewTransition(function () { applyTheme(mode); });
            return;
        }
        root.classList.add('theme-anim');
        applyTheme(mode);
        setTimeout(function () { root.classList.remove('theme-anim'); }, 500);
    }
    document.addEventListener('click', function (e) {
        var toggle = e.target.closest('[data-theme-toggle]');
        if (toggle) { switchTheme(NEXT[storedTheme()], toggle); }
    });

    /* ---------- Mobile drawer (focus-trapped dialog) ---------- */
    var drawer = document.getElementById('site-drawer');
    var openBtn = document.querySelector('[data-drawer-open]');
    var lastFocus = null;
    function focusables() { return drawer ? $all('a[href], button:not([disabled])', drawer) : []; }
    function openDrawer() {
        if (!drawer) { return; }
        lastFocus = document.activeElement;
        drawer.hidden = false;
        document.body.classList.add('drawer-open');
        if (openBtn) { openBtn.setAttribute('aria-expanded', 'true'); }
        var f = focusables(); if (f.length) { f[0].focus(); }
    }
    function closeDrawer() {
        if (!drawer || drawer.hidden) { return; }
        drawer.hidden = true;
        document.body.classList.remove('drawer-open');
        if (openBtn) { openBtn.setAttribute('aria-expanded', 'false'); }
        if (lastFocus && lastFocus.focus) { lastFocus.focus(); }
    }
    if (openBtn) { openBtn.addEventListener('click', openDrawer); }
    if (drawer) {
        drawer.addEventListener('click', function (e) { if (e.target.closest('[data-drawer-close]')) { closeDrawer(); } });
        drawer.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { closeDrawer(); return; }
            if (e.key !== 'Tab') { return; }
            var f = focusables(); if (!f.length) { return; }
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
        window.addEventListener('resize', function () { if (window.innerWidth > 1180) { closeDrawer(); } });
    }

    /* ---------- Copy (citation / BibTeX) + toast ---------- */
    var toastEl = null, toastTimer = null;
    function toast(message) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'toast';
            toastEl.setAttribute('role', 'status');
            toastEl.setAttribute('aria-live', 'polite');
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = message;
        toastEl.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 1800);
    }
    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.top = '-1000px';
        document.body.appendChild(ta); ta.select();
        var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
    }
    function copyText(text, onDone) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(function () { onDone(true); }, function () { onDone(fallbackCopy(text)); });
        } else {
            onDone(fallbackCopy(text));
        }
    }
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-copy-text], [data-copy-target]');
        if (!btn) { return; }
        var text = btn.getAttribute('data-copy-text');
        if (text === null) {
            var target = document.getElementById(btn.getAttribute('data-copy-target'));
            text = target ? target.textContent.trim() : '';
        }
        if (!text) { return; }
        copyText(text, function (ok) { toast(ok ? (btn.getAttribute('data-copy-label') || 'Copied') : 'Copy failed — select the text manually'); });
    });

    /* ---------- Share ---------- */
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-share]');
        if (!btn) { return; }
        var url = btn.getAttribute('data-share-url') || window.location.href;
        var title = btn.getAttribute('data-share-title') || document.title;
        if (navigator.share) {
            navigator.share({ title: title, url: url }).catch(function () { /* dismissed */ });
        } else {
            copyText(url, function (ok) { toast(ok ? 'Link copied' : 'Copy failed'); });
        }
    });

    /* ---------- Accessible tabs (WAI-ARIA pattern, arrow keys, #hash) ---------- */
    $all('[data-tabs]').forEach(function (container) {
        var tabs = $all('[role="tab"]', container);
        function select(tab, focus) {
            tabs.forEach(function (t) {
                var on = t === tab;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.setAttribute('tabindex', on ? '0' : '-1');
                var panel = document.getElementById(t.getAttribute('aria-controls'));
                if (panel) { panel.classList.toggle('is-active', on); }
            });
            if (focus) { tab.focus(); }
        }
        tabs.forEach(function (tab, i) {
            tab.addEventListener('click', function () {
                select(tab, false);
                if (window.history && history.replaceState) { history.replaceState(null, '', '#' + tab.id.replace(/^tab-/, '')); }
            });
            tab.addEventListener('keydown', function (e) {
                var idx = null;
                if (e.key === 'ArrowRight') { idx = (i + 1) % tabs.length; }
                else if (e.key === 'ArrowLeft') { idx = (i - 1 + tabs.length) % tabs.length; }
                else if (e.key === 'Home') { idx = 0; }
                else if (e.key === 'End') { idx = tabs.length - 1; }
                if (idx !== null) { e.preventDefault(); select(tabs[idx], true); }
            });
        });
        var hash = window.location.hash.replace('#', '');
        var initial = hash ? document.getElementById('tab-' + hash) : null;
        if (initial && tabs.indexOf(initial) !== -1) { select(initial, false); }
        container.addEventListener('click', function (e) {
            var opener = e.target.closest('[data-open-tab]');
            if (!opener) { return; }
            var t = document.getElementById('tab-' + opener.getAttribute('data-open-tab'));
            if (t) { select(t, true); }
        });
    });

    /* ---------- Publication search / filter / sort (no reload) ---------- */
    var browser = document.querySelector('[data-pub-browser]');
    if (browser) {
        var list = browser.querySelector('[data-pub-list]');
        var items = list ? $all('.pub-item', list) : [];
        var search = browser.querySelector('[data-filter-search]');
        var yearSel = browser.querySelector('[data-filter-year]');
        var areaSel = browser.querySelector('[data-filter-area]');
        var sortSel = browser.querySelector('[data-sort]');
        var typeBtns = $all('[data-filter-type]', browser);
        var countEl = browser.querySelector('[data-result-count]');
        var emptyEl = browser.querySelector('[data-empty]');
        var activeType = 'all';
        items.forEach(function (el, i) { el.setAttribute('data-order', String(i)); });

        var apply = function (animate) {
            var terms = (search && search.value ? search.value : '').toLowerCase().trim().split(/\s+/).filter(Boolean);
            var year = yearSel ? yearSel.value : '';
            var area = areaSel ? areaSel.value : '';
            var shown = 0;
            items.forEach(function (el) {
                var hay = el.getAttribute('data-search') || '';
                var areas = (el.getAttribute('data-areas') || '').split('|');
                var ok = (activeType === 'all' || el.getAttribute('data-type') === activeType)
                    && (!year || el.getAttribute('data-year') === year)
                    && (!area || areas.indexOf(area) !== -1)
                    && terms.every(function (t) { return hay.indexOf(t) !== -1; });
                el.hidden = !ok;
                if (ok) { shown++; }
            });
            var sort = sortSel ? sortSel.value : 'newest';
            items.slice().sort(function (a, b) {
                if (sort === 'title') { return (a.getAttribute('data-title') || '').localeCompare(b.getAttribute('data-title') || '', undefined, { sensitivity: 'base' }); }
                var ya = parseInt(a.getAttribute('data-year'), 10) || 0, yb = parseInt(b.getAttribute('data-year'), 10) || 0;
                var oa = parseInt(a.getAttribute('data-order'), 10), ob = parseInt(b.getAttribute('data-order'), 10);
                if (ya !== yb) { return sort === 'oldest' ? ya - yb : yb - ya; }
                return sort === 'oldest' ? ob - oa : oa - ob;
            }).forEach(function (el) { list.appendChild(el); });
            if (countEl) { countEl.textContent = 'Showing ' + shown + ' of ' + items.length + ' publications'; }
            if (emptyEl) { emptyEl.hidden = shown !== 0; }
            if (animate === true) {
                // Re-flow animation so visitors see the list respond to the filter
                var visible = items.filter(function (el) { return !el.hidden; });
                visible.forEach(function (el) { el.classList.remove('pub-in'); });
                void list.offsetWidth;
                visible.forEach(function (el, i) { el.style.setProperty('--pi', String(Math.min(i, 12))); el.classList.add('pub-in'); });
            }
        };

        var setType = function (type) {
            activeType = type;
            typeBtns.forEach(function (b) {
                var on = b.getAttribute('data-filter-type') === type;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
        };
        typeBtns.forEach(function (btn) {
            btn.addEventListener('click', function () { setType(btn.getAttribute('data-filter-type')); apply(true); });
        });
        [yearSel, areaSel, sortSel].forEach(function (el) { if (el) { el.addEventListener('change', function () { apply(true); }); } });
        if (search) { search.addEventListener('input', function () { apply(true); }); }
        var reset = browser.querySelector('[data-filter-reset]');
        if (reset) {
            reset.addEventListener('click', function () {
                if (search) { search.value = ''; }
                if (yearSel) { yearSel.value = ''; }
                if (areaSel) { areaSel.value = ''; }
                setType('all'); apply(true);
                if (search) { search.focus(); }
            });
        }

        // Deep links such as publications/?area=Federated%20Learning or ?type=journal
        var params = window.URLSearchParams ? new URLSearchParams(window.location.search) : null;
        if (params) {
            if (areaSel && params.get('area')) { areaSel.value = params.get('area'); }
            if (params.get('type') && typeBtns.some(function (b) { return b.getAttribute('data-filter-type') === params.get('type'); })) { setType(params.get('type')); }
            if (search && params.get('q')) { search.value = params.get('q'); }
        }
        apply();
    }

    /* ---------- Reading progress, header shadow, back to top ---------- */
    var progress = document.querySelector('.scroll-progress span');
    var header = document.querySelector('.site-header');
    var toTop = document.querySelector('[data-to-top]');
    var ticking = false;
    function onScroll() {
        var y = window.scrollY || window.pageYOffset || 0;
        var max = document.documentElement.scrollHeight - window.innerHeight;
        if (progress) { progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0).toFixed(4) + ')'; }
        if (header) { header.classList.toggle('is-scrolled', y > 8); }
        if (toTop) { toTop.classList.toggle('is-visible', y > 700); }
        ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); } }, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    if (toTop) {
        toTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
            var main = document.getElementById('main');
            if (main) { main.focus({ preventScroll: true }); }
        });
    }

    /* ---------- Scroll reveal (only when the <head> script set html.motion) ---------- */
    var REVEAL = '.section-head, .metric, .year-chart, .theme, .record-card, .tl-item, .pub-item, .news-item, .aside-box, .page-section > h2, .feature-block, .meta-strip, .tabs, .contact-info, .contact-form-wrap, .definition, .pub-controls';
    if (root.classList.contains('motion') && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            var n = 0;
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) { return; }
                entry.target.style.setProperty('--rd', (Math.min(n++, 8) * 70) + 'ms');
                entry.target.classList.add('is-visible');
                io.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -40px 0px', threshold: 0 });
        $all(REVEAL).forEach(function (el) { io.observe(el); });
    }
})();
