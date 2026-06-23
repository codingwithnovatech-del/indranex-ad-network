(function () {
  'use strict';

  var FIREBASE_URL = 'https://indranex-ads-network-default-rtdb.firebaseio.com';
  var AD_NETWORK = 'AdNet Pro';

  var scriptEl = document.currentScript || document.scripts[document.scripts.length - 1];
  var siteId = scriptEl.getAttribute('data-site-id');

  if (!siteId) {
    console.error(AD_NETWORK + ': Missing data-site-id attribute. Usage: <script src="ad.js" data-site-id="YOUR_SITE_ID"></script>');
    return;
  }

  var trackedImpressions = {};

  function fetchJSON(path) {
    return fetch(FIREBASE_URL + path + '.json')
      .then(function (r) { return r.json(); })
      .catch(function (e) { console.warn(AD_NETWORK + ': fetch error', e); return null; });
  }

  function postJSON(path, data) {
    return fetch(FIREBASE_URL + path + '.json', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' }
    }).catch(function () {});
  }

  function getDomain() {
    return window.location.hostname;
  }

  function normalizeDomain(d) {
    if (!d) return '';
    return d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase();
  }

  function init() {
    var slots = document.querySelectorAll('.adnet-slot');
    if (!slots.length) {
      console.warn(AD_NETWORK + ': No .adnet-slot elements found on page.');
      return;
    }

    fetchJSON('/publishers/' + siteId).then(function (publisher) {
      if (!publisher) {
        console.warn(AD_NETWORK + ': Site ID "' + siteId + '" is not registered.');
      } else {
        var allowedDomain = publisher.domain;
        var normCurrent = normalizeDomain(getDomain());
        var normAllowed = normalizeDomain(allowedDomain);
        if (allowedDomain && allowedDomain !== '*' && normCurrent !== normAllowed && normCurrent !== 'localhost') {
          console.warn(AD_NETWORK + ': Domain ' + getDomain() + ' not authorized for site ID ' + siteId);
          return;
        }
      }

      fetchJSON('/ads').then(function (adsData) {
        if (!adsData) return;
        var ads = [];
        for (var key in adsData) {
          if (adsData.hasOwnProperty(key)) ads.push(adsData[key]);
        }

        var matched = ads.filter(function (a) {
          if (a.status !== 'active') return false;
          if (!a.sites) return false;
          var siteMatch = false;
          for (var s in a.sites) {
            if (a.sites.hasOwnProperty(s) && a.sites[s] === true && (s === siteId || s === 'all')) {
              siteMatch = true;
              break;
            }
          }
          return siteMatch;
        });

        [].forEach.call(slots, function (slot) {
          var position = slot.getAttribute('data-position') || 'inline';
          var slotId = slot.getAttribute('data-slot-id') || '';
          var eligible = matched.filter(function (a) {
            if (!a.positions) return false;
            for (var p in a.positions) {
              if (a.positions.hasOwnProperty(p) && a.positions[p] === true && p === position) return true;
            }
            return false;
          });

          if (!eligible.length) {
            if (slot.getAttribute('data-fallback') !== 'false') {
              slot.innerHTML = '<!-- ' + AD_NETWORK + ': no matching ad for position "' + position + '" -->';
            }
            return;
          }

          var ad = eligible[Math.floor(Math.random() * eligible.length)];
          renderAd(slot, ad, position, slotId);
        });
      });
    });
  }

  function renderAd(slot, ad, position, slotId) {
    var wrapper = document.createElement('div');
    wrapper.className = 'adnet-container';
    wrapper.setAttribute('data-ad-id', ad.id || '');
    wrapper.setAttribute('data-position', position);

    var linkUrl = ad.targetUrl || '#';
    var useNewTab = linkUrl !== '#';

    if (ad.type === 'banner') {
      var bannerHtml = '';
      if (ad.imageUrl) {
        bannerHtml = '<a href="' + escapeHtml(linkUrl) + '" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow"><img src="' + escapeHtml(ad.imageUrl) + '" alt="' + escapeHtml(ad.title || 'Advertisement') + '" class="adnet-image" style="max-width:100%;height:auto;border:0;display:block"></a>';
      } else {
        bannerHtml = '<a href="' + escapeHtml(linkUrl) + '" class="adnet-link adnet-text-ad" target="_blank" rel="noopener noreferrer nofollow" style="display:block;padding:20px;background:linear-gradient(135deg,#6C5CE7,#a29bfe);border-radius:10px;text-decoration:none;color:#fff;text-align:center;font-family:Arial,sans-serif;"><strong style="font-size:16px;">' + escapeHtml(ad.title || 'Sponsored') + '</strong><span style="display:block;font-size:12px;margin-top:6px;opacity:0.8;">Advertisement</span></a>';
      }
      wrapper.innerHTML = bannerHtml;
    } else if (ad.type === 'video') {
      var videoHtml = '<div class="adnet-video-wrapper" style="position:relative;max-width:100%;border-radius:8px;overflow:hidden;background:#000;">';
      if (ad.videoUrl && ad.videoUrl.indexOf('youtube.com') !== -1 || ad.videoUrl && ad.videoUrl.indexOf('youtu.be') !== -1) {
        var videoId = extractYouTubeId(ad.videoUrl);
        if (videoId) {
          videoHtml += '<iframe src="https://www.youtube.com/embed/' + videoId + '?autoplay=0&rel=0" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;display:block"></iframe>';
        }
      } else if (ad.videoUrl) {
        videoHtml += '<video controls muted playsinline style="width:100%;display:block;aspect-ratio:16/9;" poster="' + escapeHtml(ad.imageUrl || '') + '"><source src="' + escapeHtml(ad.videoUrl) + '" type="video/mp4">Your browser does not support video.</video>';
      }
      if (ad.targetUrl) {
        videoHtml += '<a href="' + escapeHtml(ad.targetUrl) + '" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow" style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:1;display:block;"></a>';
      }
      videoHtml += '</div>';
      wrapper.innerHTML = videoHtml;
    } else if (ad.type === 'native') {
      var nativeHtml = '<div class="adnet-native" style="border:1px solid #e0e0e0;border-radius:12px;overflow:hidden;background:#fff;transition:box-shadow 0.2s;">';
      nativeHtml += '<a href="' + escapeHtml(linkUrl) + '" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow" style="text-decoration:none;color:inherit;display:block;">';
      if (ad.imageUrl) {
        nativeHtml += '<img src="' + escapeHtml(ad.imageUrl) + '" alt="' + escapeHtml(ad.title || '') + '" class="adnet-native-image" style="width:100%;height:auto;max-height:200px;object-fit:cover;display:block;">';
      }
      nativeHtml += '<div class="adnet-native-content" style="padding:14px 16px;">';
      nativeHtml += '<div class="adnet-native-label" style="font-size:11px;text-transform:uppercase;color:#999;letter-spacing:0.5px;margin-bottom:4px;">Sponsored</div>';
      if (ad.title) {
        nativeHtml += '<h4 class="adnet-native-title" style="margin:0 0 6px;font-size:16px;font-weight:600;color:#222;">' + escapeHtml(ad.title) + '</h4>';
      }
      if (ad.description) {
        nativeHtml += '<p class="adnet-native-desc" style="margin:0;font-size:13px;color:#666;line-height:1.4;">' + escapeHtml(ad.description) + '</p>';
      }
      nativeHtml += '</div></a></div>';
      wrapper.innerHTML = nativeHtml;
    } else {
      wrapper.innerHTML = '<!-- ' + AD_NETWORK + ': unknown ad type "' + ad.type + '" -->';
    }

    slot.appendChild(wrapper);

    var adId = ad['.key'] || ad.id || '';
    var impressionKey = adId + '_' + position + '_' + (slotId || '0');
    if (!trackedImpressions[impressionKey]) {
      trackedImpressions[impressionKey] = true;
      trackImpression(adId, position);
    }

    var links = wrapper.querySelectorAll('.adnet-link');
    [].forEach.call(links, function (link) {
      link.addEventListener('click', function (e) {
        trackClick(adId, position);
      });
    });
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
