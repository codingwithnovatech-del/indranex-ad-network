(function () {
  'use strict';
  var FIREBASE_URL = 'https://indranex-ads-network-default-rtdb.firebaseio.com';
  var AD_NETWORK = 'Indranex AdNet';
  var scriptEl = document.currentScript || document.scripts[document.scripts.length - 1];
  var siteId = scriptEl.getAttribute('data-site-id');
  if (!siteId) { console.error(AD_NETWORK + ': Missing data-site-id'); return; }
  var tracked = {}, popunderShown = false, interstitialShown = false, socialBarShown = false;
  var session = sessionStorage.getItem('adnet_session') || Math.random().toString(36).slice(2);
  sessionStorage.setItem('adnet_session', session);
  var impKey = function(adId, pos) { return adId + '_' + pos; };
  function fetchJSON(p) { return fetch(FIREBASE_URL + p + '.json').then(function(r){return r.json()}).catch(function(){return null}); }
  function pushJSON(p, d) { return fetch(FIREBASE_URL + p + '.json',{method:'POST',body:JSON.stringify(d),headers:{'Content-Type':'application/json'}}).catch(function(){}); }
  function getDomain() { return window.location.hostname; }
  function normDomain(d) { if(!d)return ''; return d.replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/^www\./,'').toLowerCase(); }
  function esc(s) { if(!s)return ''; var d=document.createElement('div'); d.appendChild(document.createTextNode(s)); return d.innerHTML; }
  function trackImp(adId, pos) {
    var k = impKey(adId, pos);
    if (tracked[k]) return;
    tracked[k] = true;
    pushJSON('/analytics/impressions',{adId:adId,siteId:siteId,position:pos,timestamp:new Date().toISOString(),sessionId:session,pageUrl:window.location.href});
  }
  function trackClk(adId, pos, targetUrl) {
    pushJSON('/analytics/clicks',{adId:adId,siteId:siteId,position:pos,timestamp:new Date().toISOString(),sessionId:session,targetUrl:targetUrl||'',pageUrl:window.location.href});
  }
  function getAds() {
    return fetchJSON('/ads').then(function(d){
      if(!d)return[];
      var a=[];
      for(var k in d){if(d.hasOwnProperty(k)){var x=d[k];x._key=k;a.push(x)}}
      return a.filter(function(x){
        if(x.status!=='active')return false;
        if(!x.sites)return false;
        for(var s in x.sites)if(x.sites.hasOwnProperty(s)&&x.sites[s]===true&&(s===siteId||s==='all'))return true;
        return false;
      });
    });
  }
  function findAds(ads, pos) {
    var formatLimit = scriptEl.getAttribute('data-format');
    return ads.filter(function(a){
      if(formatLimit && a.type !== formatLimit) return false;
      if(!a.positions)return false;
      for(var p in a.positions)if(a.positions.hasOwnProperty(p)&&a.positions[p]===true&&p===pos)return true;
      return false;
    });
  }

  function attachClicks(el, adId, pos, targetUrl) {
    var links = el.querySelectorAll('a');
    [].forEach.call(links, function(l){
      l.addEventListener('click', function(e){
        trackClk(adId, pos, targetUrl || l.href);
      });
    });
  }

  function renderBanner(slot, ad, linkUrl, adId, pos) {
    var w=document.createElement('div');w.style.cssText='margin:0;padding:0;';
    if(ad.imageUrl){
      w.innerHTML='<a href="'+esc(linkUrl)+'" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow"><img src="'+esc(ad.imageUrl)+'" alt="'+esc(ad.title||'Ad')+'" style="max-width:100%;height:auto;border:0;display:block;border-radius:6px;"></a>';
    } else {
      w.innerHTML='<a href="'+esc(linkUrl)+'" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow" style="display:block;padding:18px;background:linear-gradient(135deg,#6C5CE7,#a29bfe);border-radius:8px;text-decoration:none;color:#fff;text-align:center;font-family:Arial,sans-serif;"><strong>'+esc(ad.title||'Sponsored')+'</strong><span style="display:block;font-size:12px;margin-top:4px;opacity:0.8;">Advertisement</span></a>';
    }
    slot.appendChild(w);
    trackImp(adId, pos);
    attachClicks(w, adId, pos, linkUrl);
  }

  function renderVideo(slot, ad, linkUrl, adId, pos) {
    var w=document.createElement('div');w.style.cssText='position:relative;max-width:100%;border-radius:8px;overflow:hidden;background:#000;';
    if(ad.videoUrl&&(ad.videoUrl.indexOf('youtube.com')!==-1||ad.videoUrl.indexOf('youtu.be')!==-1)){
      var m=ad.videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if(m)w.innerHTML='<iframe src="https://www.youtube.com/embed/'+m[1]+'?autoplay=0&rel=0" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;display:block;"></iframe>';
    } else if(ad.videoUrl){
      w.innerHTML='<video controls muted playsinline style="width:100%;display:block;aspect-ratio:16/9;" poster="'+esc(ad.imageUrl||'')+'"><source src="'+esc(ad.videoUrl)+'" type="video/mp4"></video>';
    }
    if(ad.targetUrl){var o=w.querySelector('iframe, video');if(o)o.style.pointerEvents='none';w.innerHTML+='<a href="'+esc(ad.targetUrl)+'" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow" style="position:absolute;top:0;left:0;right:0;bottom:0;z-index:2;"></a>';}
    slot.appendChild(w);
    trackImp(adId, pos);
    attachClicks(w, adId, pos, ad.targetUrl);
  }

  function renderNative(slot, ad, linkUrl, adId, pos) {
    var w=document.createElement('div');w.style.cssText='border:1px solid #e8e8e8;border-radius:12px;overflow:hidden;background:#fff;';
    w.innerHTML='<a href="'+esc(linkUrl)+'" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow" style="text-decoration:none;color:inherit;display:block;">'
      +(ad.imageUrl?'<img src="'+esc(ad.imageUrl)+'" alt="'+esc(ad.title||'')+'" style="width:100%;max-height:200px;object-fit:cover;display:block;">':'')
      +'<div style="padding:12px 14px;"><div style="font-size:10px;text-transform:uppercase;color:#999;letter-spacing:0.5px;margin-bottom:4px;">Sponsored</div>'
      +(ad.title?'<h4 style="margin:0 0 4px;font-size:15px;font-weight:600;color:#222;">'+esc(ad.title)+'</h4>':'')
      +(ad.description?'<p style="margin:0;font-size:13px;color:#666;line-height:1.4;">'+esc(ad.description)+'</p>':'')
      +'</div></a>';
    slot.appendChild(w);
    trackImp(adId, pos);
    attachClicks(w, adId, pos, linkUrl);
  }

  function renderSocialBar(ad) {
    if(socialBarShown||!ad)return;socialBarShown=true;
    var adId=ad._key||ad.id||'';
    var bar=document.createElement('div');bar.id='adnet-social-bar';
    bar.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#fff;border-top:1px solid #e0e0e0;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 -2px 10px rgba(0,0,0,0.1);transform:translateY(100%);transition:transform 0.4s ease;font-family:Arial,sans-serif;';
    var html='<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">';
    if(ad.imageUrl)html+='<img src="'+esc(ad.imageUrl)+'" style="width:40px;height:40px;border-radius:6px;object-fit:cover;flex-shrink:0;">';
    html+='<div style="min-width:0;"><div style="font-size:13px;font-weight:600;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(ad.title||'Advertisement')+'</div>';
    if(ad.description)html+='<div style="font-size:11px;color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(ad.description)+'</div>';
    html+='</div></div>';
    html+='<div style="display:flex;gap:8px;flex-shrink:0;">';
    if(ad.targetUrl)html+='<a href="'+esc(ad.targetUrl)+'" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow" style="padding:8px 18px;background:#6C5CE7;color:#fff;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap;">Learn More</a>';
    html+='<button id="adnet-bar-close" style="width:32px;height:32px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:16px;color:#999;display:flex;align-items:center;justify-content:center;">&times;</button></div>';
    bar.innerHTML=html;
    document.body.appendChild(bar);
    trackImp(adId,'social-bar');
    setTimeout(function(){bar.style.transform='translateY(0)';},100);
    document.getElementById('adnet-bar-close').addEventListener('click',function(){trackClk(adId,'social-bar');bar.style.transform='translateY(100%)';setTimeout(function(){bar.remove()},400);});
    var lnk=bar.querySelector('.adnet-link');if(lnk)lnk.addEventListener('click',function(){trackClk(adId,'social-bar');});
  }

  function showPopunder(ad) {
    if(popunderShown||!ad||!ad.targetUrl)return;
    popunderShown=true;
    var adId=ad._key||ad.id||'';
    trackImp(adId,'popunder');trackClk(adId,'popunder',ad.targetUrl);
    try{
      var w=window.open(ad.targetUrl,'_blank');
      if(w){try{w.blur();}catch(e){}window.focus();}
      else{var a=document.createElement('a');a.href=ad.targetUrl;a.target='_blank';a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();setTimeout(function(){a.remove()},100);}
    }catch(e){
      var a2=document.createElement('a');a2.href=ad.targetUrl;a2.target='_blank';a2.rel='noopener';a2.style.display='none';document.body.appendChild(a2);a2.click();setTimeout(function(){a2.remove()},100);
    }
  }

  function showInterstitial(ad) {
    if(interstitialShown||!ad)return;
    var already=sessionStorage.getItem('adnet_int_shown');
    if(already)return;
    interstitialShown=true;
    var adId=ad._key||ad.id||'';
    var ov=document.createElement('div');ov.id='adnet-int';
    ov.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:999999;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.4s;';
    var img=ad.imageUrl?'<img src="'+esc(ad.imageUrl)+'" style="max-width:100%;max-height:60vh;border-radius:12px;display:block;margin:0 auto;">':'';
    var tit=ad.title?'<h3 style="color:#fff;font-size:20px;margin:14px 0 6px;text-align:center;">'+esc(ad.title)+'</h3>':'';
    var desc=ad.description?'<p style="color:rgba(255,255,255,0.6);font-size:13px;text-align:center;margin:0 0 14px;">'+esc(ad.description)+'</p>':'';
    ov.innerHTML='<div style="max-width:460px;width:90%;text-align:center;padding:16px;">'
      +(ad.targetUrl?'<a href="'+esc(ad.targetUrl)+'" target="_blank" rel="noopener noreferrer nofollow" id="adnet-int-link" style="text-decoration:none;">':'')
      +img+tit+desc+(ad.targetUrl?'</a>':'')
      +'<button id="adnet-int-close" style="padding:10px 36px;background:#fff;color:#333;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Close <span id="adnet-int-timer">(5s)</span></button>'
      +'<p style="color:rgba(255,255,255,0.3);font-size:11px;margin-top:8px;">Advertisement</p></div>';
    document.body.appendChild(ov);trackImp(adId,'interstitial');
    var btn=document.getElementById('adnet-int-close'),tmr=document.getElementById('adnet-int-timer'),sec=5;
    btn.disabled=true;
    var t=setInterval(function(){sec--;if(tmr)tmr.textContent='('+sec+'s)';if(sec<=0){clearInterval(t);if(tmr)tmr.textContent='';btn.disabled=false;btn.textContent='Close Ad';}},1000);
    btn.addEventListener('click',function(){trackClk(adId,'interstitial');ov.style.opacity='0';setTimeout(function(){ov.remove()},400);try{sessionStorage.setItem('adnet_int_shown','1');}catch(e){}});
    var il=document.getElementById('adnet-int-link');if(il)il.addEventListener('click',function(){trackClk(adId,'interstitial');});
    setTimeout(function(){ov.style.opacity='1';},50);
  }

  function renderCustom(slot, ad, linkUrl, adId, pos) {
    var w = document.createElement('div'); w.style.cssText = 'margin:0;padding:0;';
    w.innerHTML = '<a href="'+esc(linkUrl)+'" class="adnet-link" target="_blank" rel="noopener noreferrer nofollow" style="display:inline-block;padding:14px 24px;background:linear-gradient(135deg,#6C5CE7,#00CEC9);border-radius:10px;color:#fff;text-decoration:none;font-weight:600;font-size:14px;font-family:Arial,sans-serif;">' + esc(ad.title||'Learn More') + ' →</a>';
    slot.appendChild(w);
    trackImp(adId, pos);
    attachClicks(w, adId, pos, linkUrl);
  }

  function init() {
    fetchJSON('/publishers/'+siteId).then(function(p){
      if(!p){console.warn(AD_NETWORK+': Site "'+siteId+'" not registered.');return;}
      var nc=normDomain(getDomain()),na=normDomain(p.domain);
      if(p.domain&&p.domain!=='*'&&nc!==na&&nc!=='localhost'){console.warn(AD_NETWORK+': Domain not authorized.');return;}
      getAds().then(function(ads){
        if(!ads.length)return;
        var slots=document.querySelectorAll('.adnet-slot');
        [].forEach.call(slots,function(slot){
          var pos=slot.getAttribute('data-position')||'inline',sid=slot.getAttribute('data-slot-id')||'';
          var eligible=findAds(ads,pos);
          if(!eligible.length){if(slot.getAttribute('data-fallback')!=='false')slot.innerHTML='<!-- '+AD_NETWORK+': no ad -->';return;}
          var ad=eligible[Math.floor(Math.random()*eligible.length)],adId=ad._key||ad.id||'',linkUrl=ad.targetUrl||'#';
          if(ad.type==='banner')renderBanner(slot,ad,linkUrl,adId,pos);
          else if(ad.type==='video')renderVideo(slot,ad,linkUrl,adId,pos);
          else if(ad.type==='native')renderNative(slot,ad,linkUrl,adId,pos);
          else if(ad.type==='custom')renderCustom(slot,ad,linkUrl,adId,pos);
          else slot.innerHTML='<!-- '+AD_NETWORK+': unknown type '+ad.type+' -->';
        });
        var sd=parseInt(scriptEl.getAttribute('data-social-delay'))||3000;
        var socials=findAds(ads,'social-bar');
        if(socials.length)setTimeout(function(){renderSocialBar(socials[Math.floor(Math.random()*socials.length)])},sd);
        var pd=parseInt(scriptEl.getAttribute('data-popunder-delay'))||4000;
        var pops=findAds(ads,'popunder');
        if(pops.length){
          document.addEventListener('click', function popTrigger(){
            setTimeout(function(){showPopunder(pops[Math.floor(Math.random()*pops.length)])}, 200);
            document.removeEventListener('click', popTrigger);
          }, {once: true});
        }
        var id=parseInt(scriptEl.getAttribute('data-interstitial-delay'))||3000;
        var ints=findAds(ads,'interstitial');
        if(ints.length)setTimeout(function(){showInterstitial(ints[Math.floor(Math.random()*ints.length)])},id);
      });
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
