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
            root.classList.add('theme-vt');
            var vt = document.startViewTransition(function () { applyTheme(mode); });
            var done = function () { root.classList.remove('theme-vt'); };
            if (vt && vt.finished) { vt.finished.then(done, done); } else { setTimeout(done, 900); }
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
    var REVEAL = '.metric, .chart-card, .theme, .record-card, .sv-card, .sv-stat, .gallery-item, .aside-box, .feature-block, .contact-info, .contact-form-wrap, .cert-thumb, .section-head, .tl-item, .pub-item, .news-item, .page-section > h2, .meta-strip, .tabs, .definition, .pub-controls, .gallery-filters';
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

    /* ---------- Rotating focus areas in the hero ---------- */
    $all('[data-rotator]').forEach(function (el) {
        var words;
        try { words = JSON.parse(el.getAttribute('data-words') || '[]'); } catch (e) { words = []; }
        var word = el.querySelector('.rotator-word');
        if (!word || words.length < 2 || reduceMotion) { return; }
        var hues = ['var(--accent-text)', 'var(--accent-2)', 'var(--accent-3)', 'var(--accent-4)', 'var(--accent-5)', 'var(--accent-6)'];
        var i = 0;
        setInterval(function () {
            if (document.hidden) { return; }
            word.classList.add('is-out');
            setTimeout(function () {
                i = (i + 1) % words.length;
                word.textContent = words[i];
                word.style.setProperty('--hue', hues[i % hues.length]);
                word.classList.remove('is-out');
                word.classList.add('is-in');
                void word.offsetWidth;
                word.classList.remove('is-in');
            }, 380);
        }, 2800);
    });

    /* ---------- Cursor spotlight on cards (mouse / trackpad only) ---------- */
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        var SPOT = '.metric, .theme, .record-card, .sv-card, .sv-stat, .chart-card';
        document.addEventListener('pointermove', function (e) {
            var card = e.target && e.target.closest ? e.target.closest(SPOT) : null;
            if (!card) { return; }
            var r = card.getBoundingClientRect();
            card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        }, { passive: true });
    }

    /* ---------- Sliding underline for tabs ---------- */
    $all('[data-tabs] .tab-list').forEach(function (listEl) {
        var ink = document.createElement('span');
        ink.className = 'tab-ink';
        ink.setAttribute('aria-hidden', 'true');
        listEl.appendChild(ink);
        listEl.classList.add('has-ink');
        var place = function () {
            var active = listEl.querySelector('.tab.is-active');
            if (!active) { return; }
            ink.style.width = active.offsetWidth + 'px';
            ink.style.transform = 'translateX(' + active.offsetLeft + 'px)';
        };
        place();
        listEl.addEventListener('click', function () { window.requestAnimationFrame(place); });
        listEl.addEventListener('keydown', function () { window.requestAnimationFrame(place); });
        if (listEl.parentNode) { listEl.parentNode.addEventListener('click', function (e) { if (e.target.closest('[data-open-tab]')) { window.requestAnimationFrame(place); } }); }
        window.addEventListener('resize', place);
        if (document.fonts && document.fonts.ready) { document.fonts.ready.then(place); }
    });

    /* ---------- Gallery category filter ---------- */
    var gFilters = document.querySelector('[data-gallery-filters]');
    if (gFilters) {
        var gItems = $all('.gallery-item');
        var gEmpty = document.querySelector('[data-gallery-empty]');
        var gBtns = $all('[data-gallery-filter]', gFilters);
        var setCategory = function (cat, animate) {
            var shown = 0;
            gBtns.forEach(function (b) {
                var on = b.getAttribute('data-gallery-filter') === cat;
                b.classList.toggle('is-active', on);
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            gItems.forEach(function (it) {
                var ok = !cat || it.getAttribute('data-category') === cat;
                it.hidden = !ok;
                if (ok) { shown++; }
            });
            if (gEmpty) { gEmpty.hidden = shown !== 0; }
            if (animate) {
                var vis = gItems.filter(function (it) { return !it.hidden; });
                vis.forEach(function (it) { it.classList.remove('gi-in'); });
                void gFilters.offsetWidth;
                vis.forEach(function (it, n) { it.style.setProperty('--gi', String(Math.min(n, 12))); it.classList.add('gi-in'); });
            }
        };
        gBtns.forEach(function (b) { b.addEventListener('click', function () { setCategory(b.getAttribute('data-gallery-filter'), true); }); });
        var wanted = window.URLSearchParams ? new URLSearchParams(window.location.search).get('category') : null;
        if (wanted && gBtns.some(function (b) { return b.getAttribute('data-gallery-filter') === wanted; })) { setCategory(wanted, false); }
    }

    /* ---------- Lightbox (gallery & certificates) ---------- */
    var lb = document.getElementById('lightbox');
    if (lb) {
        var lbImg = lb.querySelector('.lb-img'), lbTitle = lb.querySelector('.lb-title'), lbMeta = lb.querySelector('.lb-meta');
        var lbText = lb.querySelector('.lb-text'), lbCount = lb.querySelector('.lb-count');
        var lbItems = [], lbIndex = 0, lbReturn = null, touchX = null;
        var lbShow = function (i) {
            if (!lbItems.length) { return; }
            lbIndex = (i + lbItems.length) % lbItems.length;
            var a = lbItems[lbIndex];
            var href = a.getAttribute('href');
            if (lbImg.getAttribute('src') === href && lbImg.complete) {
                lb.classList.add('is-loaded');
            } else {
                lb.classList.remove('is-loaded');
                lbImg.onload = lbImg.onerror = function () { lb.classList.add('is-loaded'); };
                lbImg.setAttribute('src', href);
            }
            lbImg.alt = a.getAttribute('data-title') || '';
            lbTitle.textContent = a.getAttribute('data-title') || '';
            lbMeta.textContent = a.getAttribute('data-meta') || '';
            lbText.textContent = a.getAttribute('data-caption') || '';
            lbCount.textContent = lbItems.length > 1 ? (lbIndex + 1) + ' / ' + lbItems.length : '';
            lb.classList.toggle('is-single', lbItems.length < 2);
            [lbIndex + 1, lbIndex - 1].forEach(function (j) {
                var n = lbItems[(j + lbItems.length) % lbItems.length];
                if (n && n !== a) { var pre = new Image(); pre.src = n.getAttribute('href'); }
            });
        };
        var lbOpen = function (link) {
            var group = link.closest('[data-lightbox-group]') || document;
            lbItems = $all('a[data-lightbox]', group).filter(function (a) { var fig = a.closest('.gallery-item'); return !(fig && fig.hidden); });
            lbReturn = link;
            lb.hidden = false;
            document.body.classList.add('lb-open');
            window.requestAnimationFrame(function () { lb.classList.add('is-open'); });
            lbShow(Math.max(0, lbItems.indexOf(link)));
            var closeBtn = lb.querySelector('.lb-close');
            if (closeBtn) { closeBtn.focus(); }
        };
        var lbClose = function () {
            if (lb.hidden) { return; }
            lb.classList.remove('is-open');
            document.body.classList.remove('lb-open');
            setTimeout(function () { lb.hidden = true; }, reduceMotion ? 0 : 250);
            if (lbReturn && lbReturn.focus) { lbReturn.focus(); }
        };
        document.addEventListener('click', function (e) {
            var link = e.target.closest('a[data-lightbox]');
            if (link) { e.preventDefault(); lbOpen(link); return; }
            if (lb.hidden) { return; }
            if (e.target.closest('[data-lb-close]')) { lbClose(); }
            else if (e.target.closest('[data-lb-prev]')) { lbShow(lbIndex - 1); }
            else if (e.target.closest('[data-lb-next]')) { lbShow(lbIndex + 1); }
        });
        document.addEventListener('keydown', function (e) {
            if (lb.hidden) { return; }
            if (e.key === 'Escape') { lbClose(); }
            else if (e.key === 'ArrowRight') { lbShow(lbIndex + 1); }
            else if (e.key === 'ArrowLeft') { lbShow(lbIndex - 1); }
            else if (e.key === 'Tab') {
                var f = $all('.lb-btn', lb).filter(function (b) { return b.offsetParent !== null || !b.closest('.is-single'); });
                if (!f.length) { return; }
                var first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
        lb.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
        lb.addEventListener('touchend', function (e) {
            if (touchX === null) { return; }
            var dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 45) { lbShow(lbIndex + (dx < 0 ? 1 : -1)); }
            touchX = null;
        });
    }
})();
