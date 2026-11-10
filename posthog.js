/* posthog.js: PostHog loader and dataLayer bridge. Key and host are placeholders filled at deploy. */
(function () {
  var KEY = 'phc_kKsaZbRt2hgQG4a24VW7VFEPxkcESnKWWWHaYRwyYc2v', HOST = 'https://us.i.posthog.com';
  var EVENTS = { sample_open: 1, lead_submit: 1, lookup: 1 }; /* buy_click is sent by the click listener below, not the dataLayer bridge. A dataLayer event missing from this list is dropped, so list every bridged event here. */
  var REF = '';
  /* Opt-out: a browser Do Not Track or Global Privacy Control signal means PostHog is never loaded, so nothing is sent to it at all.
     respect_dnt in the init options is a second guard that makes the library itself check the same signals. */
  var OPTOUT = false;
  try {
    var nv = navigator;
    OPTOUT = nv.globalPrivacyControl === true || nv.doNotTrack === '1' || nv.doNotTrack === 'yes' || window.doNotTrack === '1' || nv.msDoNotTrack === '1';
  } catch (e) {}
  try {
    var qs = new URLSearchParams(location.search);
    if (qs.get('ref') && !qs.get('utm_source')) REF = qs.get('ref').slice(0, 100);
  } catch (e) {}
  try {
    if (!OPTOUT) !function (t, e) {
      var o, n, p, r;
      e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) {
        function g(t, e) { var o = e.split('.'); 2 == o.length && (t = t[o[0]], e = o[1]); t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; }
        (p = t.createElement('script')).type = 'text/javascript'; p.crossOrigin = 'anonymous'; p.async = !0;
        p.src = s.api_host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
        (r = t.getElementsByTagName('script')[0]).parentNode.insertBefore(p, r);
        var u = e; for (void 0 !== a ? u = e[a] = [] : a = 'posthog', u.people = u.people || [], u.toString = function (t) { var e = 'posthog'; return 'posthog' !== a && (e += '.' + a), t || (e += ' (stub)'), e; }, u.people.toString = function () { return u.toString(1) + '.people (stub)'; }, o = 'capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId'.split(' '), n = 0; n < o.length; n++) g(u, o[n]);
        e._i.push([i, s, a]);
      }, e.__SV = 1);
    }(document, window.posthog || []);
    /* Replay: inputs masked, never on /thanks/ (the recorder starts only if the project replay setting is on; sampling is that setting's rate).
       capture_exceptions: unhandled errors and rejections. capture_heatmaps: aggregate clicks and scroll, no autocapture needed (enable_heatmaps is its deprecated name). */
    var NOREC = /^\/thanks(\/|$)/.test(location.pathname);
    if (!OPTOUT) window.posthog.init(KEY, { api_host: HOST, capture_pageview: true, autocapture: false, persistence: 'localStorage+cookie',
      respect_dnt: true,
      capture_exceptions: true, capture_heatmaps: true, disable_session_recording: NOREC, session_recording: { maskAllInputs: true },
      loaded: function (ph) { try { if (REF) ph.register({ ref_param: REF }); } catch (e) {} } });
    if (REF && !OPTOUT) window.posthog.register({ ref_param: REF });
  } catch (e) {}
  /* Experiment scaffold, off by default. Acts only if PostHog serves the flag "home-cta-test" for this visitor; with the flag absent nothing runs or changes.
     "test" swaps the home page primary button label to approved copy already on the site; "control" leaves the page as is (exposure still logged). */
  try {
    var FK = 'home-cta-test', host = location.hostname.replace(/^www\./, ''), home = location.pathname === '/' || location.pathname === '/index.html';
    var CTA = { 'namebeam.ai': ['.cta-row a.btn[href="#explorer"]', 'Explore every market', 'Look up my market'],
                'markets.namebeam.ai': ['header nav a.btn[href="/check/"]', 'Free check', 'Run my free check'] }[host];
    if (CTA && home) window.posthog.onFeatureFlags(function (flags, variants) {
      try {
        if (!variants || !variants[FK]) return;
        var v = window.posthog.getFeatureFlag(FK), el = document.querySelector(CTA[0]);
        if (v === 'test' && el && el.textContent.trim() === CTA[1]) el.textContent = CTA[2];
      } catch (e) {}
    });
  } catch (e) {}
  /* buy_click: delegated listener. The click leaves the page, so the event is sent at once (send_instantly) over sendBeacon
     instead of waiting in the batch queue, which the navigation drops. Never blocks the click.
     The selector also takes any /buy link: the markets.namebeam.ai/buy/ buttons have no data attributes, so without it they were never selected. */
  try {
    document.addEventListener('click', function (e) {
      try {
        var a = e.target && e.target.closest ? e.target.closest('a[data-price], a[data-market], a[href*="buy.stripe.com"], a[href*="/buy"]') : null;
        if (!a || !window.posthog) return;
        if (!/buy\.stripe\.com|\/buy(\/|$|[?#])/.test(a.href)) return; /* data-market also tags explorer and sample links; only buy links count */
        window.posthog.capture('buy_click', { price: a.dataset.price || null, market: a.dataset.market || null, href: a.href, path: location.pathname },
          { send_instantly: true, transport: 'sendBeacon' });
        /* checkout_started (PostHog P1, 2026-11-03): one event per Buy click with the product, price, the Stripe link id and the
           visit's utm values, so a sale can be traced to its source. A /buy page click is not a checkout and is not counted here. */
        if (/buy\.stripe\.com\//.test(a.href)) {
          var u = new URL(a.href), q = new URLSearchParams(location.search), utm = {};
          ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) { if (q.get(k)) utm[k] = q.get(k).slice(0, 100); });
          window.posthog.capture('checkout_started', Object.assign({ product: a.dataset.market || null, price: a.dataset.price || null,
            stripe_link: u.pathname.replace(/^\//, ''), referred: !!u.searchParams.get('client_reference_id') &&
            !/^receipt_/.test(u.searchParams.get('client_reference_id')), path: location.pathname }, utm),
            { send_instantly: true, transport: 'sendBeacon' });
        }
      } catch (err) {}
    }, true);
  } catch (e) {}
  /* Inline free-check form (namebeam.ai home, #check), PostHog P1 and P8, 2026-11-03.
     Flag 'inline-check-form': the form shows by default (visitors with Do Not Track get it too); only an explicit false from
     PostHog swaps it for a link to check.namebeam.ai, so the flag is a kill switch.
     The form is Brevo's, in a cross-origin frame, so the page cannot see the submit itself. Events: check_form_view (frame in
     view), check_form_started (focus moves into the frame), check_form_submitted (the frame loads a second time, which a
     form post that reloads the frame causes). The Brevo list stays the count of record for completions. */
  try {
    var box = document.getElementById('check'), fr = box && box.querySelector('iframe');
    if (fr && window.posthog) {
      var once = {}, cap = function (n, extra) { if (once[n]) return; once[n] = 1; try { window.posthog.capture(n, Object.assign({ form: 'brevo-free-check', path: location.pathname }, extra || {})); } catch (e) {} };
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es, ob) { es.forEach(function (x) { if (x.isIntersecting) { cap('check_form_view'); ob.disconnect(); } }); }, { threshold: 0.3 }).observe(fr);
      window.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement === fr) cap('check_form_started'); }, 0); });
      /* the frame counts its own loads (onload attribute in index.html), so a load before this deferred script ran is not lost */
      var seen = function () { if ((window.__nbCheckLoads || 0) > 1) cap('check_form_submitted', { signal: 'frame_reload' }); };
      window.__nbCheckOnLoad = seen; seen();
      window.posthog.onFeatureFlags(function () {
        try {
          if (window.posthog.isFeatureEnabled('inline-check-form') === false) {
            box.innerHTML = '<p class="nb-fallback"><a class="btn" href="https://check.namebeam.ai/?utm_source=namebeam&utm_medium=home">Run my free check</a></p>';
          }
        } catch (e) {}
      });
    }
  } catch (e) {}
  function fwd(d) {
    try {
      if (!d || typeof d !== 'object' || !EVENTS[d.event]) return;
      window.posthog.capture(d.event, { market: d.market, price: d.price, source: d.source, page: location.pathname });
    } catch (e) {}
  }
  try {
    var dl = window.dataLayer = window.dataLayer || [], i, orig = dl.push;
    for (i = 0; i < dl.length; i++) fwd(dl[i]);
    dl.push = function () {
      for (var j = 0; j < arguments.length; j++) fwd(arguments[j]);
      return orig.apply(dl, arguments);
    };
  } catch (e) {}
})();
