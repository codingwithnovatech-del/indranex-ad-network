(function () {
  'use strict';

  var FIREBASE_URL = 'https://indranex-ads-network-default-rtdb.firebaseio.com';
  var AD_NETWORK = 'Indranex AdNet';

  var scriptEl = document.currentScript || document.scripts[document.scripts.length - 1];
  var siteId = scriptEl.getAttribute('data-site-id');

  if (!siteId) {
    console.error(AD_NETWORK + ': Missing data-site-id attribute. Usage: <script src="ad.js" data-site-id="YOUR_SITE_ID"></script>');
    return;
  }

  var trackedImpressions = {};
  var popunderShown = false;
  var interstitialShown = false;

  function fetchJSON(path) {
    return fetch(FIREBASE_URL + path + '.json')
      .then(function (r) { return r.json(); })
      .catch(function () { return null; });
  }

  function postJSON(path, data) {
    return fetch(FIREBASE_URL + path + '.json', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    }).catch(function () {});
  }

  function getDomain() { return window.location.hostname; }

  function normalizeDomain(d) {
    if (!d) return '';
    return d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase();
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function extractYouTubeId(url) {
    var match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  function trackImpression(adId, position) {
    var data = {
      adId: adId || 'unknown',
      siteId: siteId,
      position: position || 'unknown',
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer || ''
    };
    postJSON('/analytics/impressions', data);
  }

  function trackClick(adId, position) {
    var data = {
      adId: adId || 'unknown',
      siteId: siteId,
      position: position || 'unknown',
      timestamp: Date.now(),
      url: window.location.href
    };
    postJSON('/analytics/clicks', data);
  }

  function getAds() {
    return fetchJSON('/ads').then(function (adsData) {
      if (!adsData) return [];
      var ads = [];
      for (var key in adsData) {
        if (adsData.hasOwnProperty(key)) {
          var a = adsData[key];
          a._key = key;
          ads.push(a);
        }
      }
      return ads.filter(function (a) {
        if (a.status !== 'active') return false;
        if (!a.sites) return false;
        for (var s in a.sites) {
          if (a.sites.hasOwnProperty(s) && a.sites[s] === true && (s === siteId || s === 'all')) return true;
        }
        return false;
      });
    });
  }

  function checkPublisher() {
    return fetchJSON('/publishers/' + siteId).then(function (p) {
      if (!p) {
        console.warn(AD_NETWORK + ': Site ID "' + siteId + '" is not registered.');
        return false;
      }
      var normCurrent = normalizeDomain(getDomain());
      var normAllowed = normalizeDomain(p.domain);
      if (p.domain && p.domain !== '*' && normCurrent !== normAllowed && normCurrent !== 'localhost') {
        console.warn(AD_NETWORK + ': Domain ' + getDomain() + ' not authorized for site ID ' + siteId);
        return false;
      }
      return true;
    });
  }

  function findAds(ads, position) {
    return ads.filter(function (a) {
      if (!a.positions) return false;
      for (var p in a.positions) {
        if (a.positions.hasOwnProperty(p) && a.positions[p] === true && p === position) return true;
      }
      return false;
    });
  }

  function renderSlotAd(slot, ad, position, slotId) {
    var wrapper = document.createElement('div');
    wrapper.className = 'adnet-container';
    var adId = ad._key || ad.id || '';

    var linkUrl = ad.targetUrl || '#';

    if (ad.type === 'banner') {
      if (ad.imageUrl) {
        wrapper.innerHTML = '<a href="' + escapeHtml(linkUrl) + '" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow"><img src="' + escapeHtml(ad.imageUrl) + '" alt="' + escapeHtml(ad.title || 'Ad') + '" style="max-width:100%;height:auto;border:0;display:block;border-radius:6px;"></a>';
      } else {
        wrapper.innerHTML = '<a href="' + escapeHtml(linkUrl) + '" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow" style="display:block;padding:20px;background:linear-gradient(135deg,#6C5CE7,#a29bfe);border-radius:10px;text-decoration:none;color:#fff;text-align:center;font-family:Arial,sans-serif;"><strong style="font-size:16px;">' + escapeHtml(ad.title || 'Sponsored') + '</strong><span style="display:block;font-size:12px;margin-top:6px;opacity:0.8;">Advertisement</span></a>';
      }
    } else if (ad.type === 'video') {
      var vh = '<div style="position:relative;max-width:100%;border-radius:8px;overflow:hidden;background:#000;">';
      if (ad.videoUrl && (ad.videoUrl.indexOf('youtube.com') !== -1 || ad.videoUrl.indexOf('youtu.be') !== -1)) {
        var vid = extractYouTubeId(ad.videoUrl);
        if (vid) vh += '<iframe src="https://www.youtube.com/embed/' + vid + '?autoplay=0&rel=0" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;display:block;"></iframe>';
      } else if (ad.videoUrl) {
        vh += '<video controls muted playsinline style="width:100%;display:block;aspect-ratio:16/9;" poster="' + escapeHtml(ad.imageUrl || '') + '"><source src="' + escapeHtml(ad.videoUrl) + '" type="video/mp4"></video>';
      }
      if (ad.targetUrl) vh += '<a href="' + escapeHtml(ad.targetUrl) + '" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow" style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;"></a>';
      vh += '</div>';
      wrapper.innerHTML = vh;
    } else if (ad.type === 'native') {
      var nh = '<div style="border:1px solid #e0e0e0;border-radius:12px;overflow:hidden;background:#fff;">';
      nh += '<a href="' + escapeHtml(linkUrl) + '" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow" style="text-decoration:none;color:inherit;display:block;">';
      if (ad.imageUrl) nh += '<img src="' + escapeHtml(ad.imageUrl) + '" alt="' + escapeHtml(ad.title || '') + '" style="width:100%;max-height:200px;object-fit:cover;display:block;">';
      nh += '<div style="padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;color:#999;letter-spacing:0.5px;margin-bottom:4px;">Sponsored</div>';
      if (ad.title) nh += '<h4 style="margin:0 0 6px;font-size:16px;font-weight:600;color:#222;">' + escapeHtml(ad.title) + '</h4>';
      if (ad.description) nh += '<p style="margin:0;font-size:13px;color:#666;">' + escapeHtml(ad.description) + '</p>';
      nh += '</div></a></div>';
      wrapper.innerHTML = nh;
    }

    slot.appendChild(wrapper);

    var impKey = adId + '_' + position + '_' + (slotId || '0');
    if (!trackedImpressions[impKey]) {
      trackedImpressions[impKey] = true;
      trackImpression(adId, position);
    }

    var links = wrapper.querySelectorAll('.adnet-link');
    [].forEach.call(links, function (l) {
      l.addEventListener('click', function () { trackClick(adId, position); });
    });
  }

  function showPopunder(ad) {
    if (popunderShown || !ad || !ad.targetUrl) return;
    popunderShown = true;
    var adId = ad._key || ad.id || '';
    trackImpression(adId, 'popunder');
    trackClick(adId, 'popunder');
    try {
      var w = window.open(ad.targetUrl, '_blank');
      if (w) w.blur();
      window.focus();
    } catch (e) {
      window.location.href = ad.targetUrl;
    }
  }

  function showInterstitial(ad) {
    if (interstitialShown || !ad) return;
    interstitialShown = true;
    var adId = ad._key || ad.id || '';

    var overlay = document.createElement('div');
    overlay.id = 'adnet-interstitial';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.4s;';

    var imgHtml = ad.imageUrl ? '<img src="' + escapeHtml(ad.imageUrl) + '" style="max-width:100%;max-height:70vh;border-radius:12px;display:block;margin:0 auto;">' : '';
    var titleHtml = ad.title ? '<h3 style="color:#fff;font-size:22px;margin:16px 0 8px;text-align:center;">' + escapeHtml(ad.title) + '</h3>' : '';
    var descHtml = ad.description ? '<p style="color:rgba(255,255,255,0.7);font-size:14px;text-align:center;margin:0 0 16px;">' + escapeHtml(ad.description) + '</p>' : '';

    overlay.innerHTML = '<div style="max-width:500px;width:90%;text-align:center;padding:20px;">' +
      (ad.targetUrl ? '<a href="' + escapeHtml(ad.targetUrl) + '" target="_blank" rel="noopener noreferrer nofollow" id="adnet-interstitial-link" style="text-decoration:none;">' : '') +
      imgHtml + titleHtml + descHtml +
      (ad.targetUrl ? '</a>' : '') +
      '<button id="adnet-interstitial-close" style="margin-top:12px;padding:10px 32px;background:#fff;color:#333;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Close Ad</button>' +
      '<p style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:8px;">Ad will close in <span id="adnet-interstitial-timer">5</span>s</p>' +
      '</div>';

    document.body.appendChild(overlay);
    trackImpression(adId, 'interstitial');

    var closeBtn = document.getElementById('adnet-interstitial-close');
    var timerEl = document.getElementById('adnet-interstitial-timer');
    var seconds = 5;

    var timer = setInterval(function () {
      seconds--;
      if (timerEl) timerEl.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(timer);
        if (closeBtn) closeBtn.disabled = false;
      }
    }, 1000);

    if (closeBtn) closeBtn.disabled = true;
    setTimeout(function () {
      if (closeBtn) {
        closeBtn.disabled = false;
        closeBtn.textContent = 'Close Ad';
      }
    }, 5000);

    closeBtn.addEventListener('click', function () {
      trackClick(adId, 'interstitial');
      overlay.style.opacity = '0';
      setTimeout(function () { overlay.remove(); }, 400);
    });

    document.getElementById('adnet-interstitial-link').addEventListener('click', function () {
      trackClick(adId, 'interstitial');
    });

    setTimeout(function () { overlay.style.opacity = '1'; }, 50);
  }

  function init() {
    checkPublisher().then(function (valid) {
      if (valid === false) return;
      getAds().then(function (ads) {
        if (!ads.length) return;

        var slots = document.querySelectorAll('.adnet-slot');
        [].forEach.call(slots, function (slot) {
          var position = slot.getAttribute('data-position') || 'inline';
          var slotId = slot.getAttribute('data-slot-id') || '';
          var eligible = findAds(ads, position);
          if (!eligible.length) {
            if (slot.getAttribute('data-fallback') !== 'false') {
              slot.innerHTML = '<!-- ' + AD_NETWORK + ': no ad for "' + position + '" -->';
            }
            return;
          }
          var ad = eligible[Math.floor(Math.random() * eligible.length)];
          renderSlotAd(slot, ad, position, slotId);
        });

        var popunderAds = findAds(ads, 'popunder');
        if (popunderAds.length) {
          var popDelay = parseInt(scriptEl.getAttribute('data-popunder-delay')) || 3000;
          setTimeout(function () {
            showPopunder(popunderAds[Math.floor(Math.random() * popunderAds.length)]);
          }, popDelay);
        }

        var interstitialAds = findAds(ads, 'interstitial');
        if (interstitialAds.length && !sessionStorage.getItem('adnet_interstitial_shown')) {
          var intDelay = parseInt(scriptEl.getAttribute('data-interstitial-delay')) || 2000;
          setTimeout(function () {
            showInterstitial(interstitialAds[Math.floor(Math.random() * interstitialAds.length)]);
            try { sessionStorage.setItem('adnet_interstitial_shown', '1'); } catch (e) {}
          }, intDelay);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
