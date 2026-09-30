(function(root) {
'use strict';
const TYPE = 'application/vnd.matesito.gallery+json';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function parse(media, type) {
 if (type !== TYPE) return media && /^(image|video|audio)\//.test(type || '') ? [{url:media,mediaType:type}] : [];
 try { const items=JSON.parse(media); return Array.isArray(items) ? items : []; } catch { return []; }
}
function valid(media) {
 const items=parse(media,TYPE);
 if (!items.every(x => x && typeof x.url === 'string' && typeof x.mediaType === 'string')) return false;
 return items.length>0 && items.length<=11 && items.filter(x=>x?.mediaType?.startsWith('audio/')).length<=1 && items.filter(x=>!x?.mediaType?.startsWith('audio/')).length<=10 && items.every(x=>x && typeof x.url==='string' && x.url.length<=4096 && /^(image|video|audio)\/[a-z0-9.+-]+(?:;.*)?$/i.test(x.mediaType || '') && (/^\/uploads\/[0-9a-f-]{36}\.(png|jpg|gif|webp|avif|wav|mp3|ogg|ogv|m4a|mp4|webm)$/.test(x.url) || /^https:\/\//.test(x.url))) && new Set(items.map(x=>x.url)).size===items.length;
}
function render(media,type) {
 const items=parse(media,type); const visuals=items.filter(x=>/^(image|video)\//.test(x.mediaType)); const audio=items.find(x=>x.mediaType.startsWith('audio/'));
 const asset=x=>x.mediaType.startsWith('image/') ? '<img loading="lazy" decoding="async" src="'+esc(x.url)+'" alt="Imagen de la publicación">' : '<video controls playsinline preload="none" src="'+esc(x.url)+'"></video>';
 let html='';
 if(visuals.length) html='<div class="media-gallery" role="region" aria-label="Archivos de la publicación"><div class="gallery-track" tabindex="0" aria-label="Deslizá para ver los archivos">'+visuals.map((x,i)=>'<div class="gallery-slide" role="group" aria-label="'+(i+1)+' de '+visuals.length+'">'+asset(x)+'</div>').join('')+'</div>'+(visuals.length>1?'<div class="gallery-controls"><button type="button" data-gallery-step="-1" disabled aria-label="Archivo anterior">&#8249;</button><span class="gallery-position" aria-live="polite">1 / '+visuals.length+'</span><button type="button" data-gallery-step="1" aria-label="Archivo siguiente">&#8250;</button></div>':'')+'</div>';
 if(audio) html+='<audio class="gallery-audio" controls preload="none" src="'+esc(audio.url)+'"></audio>';
 return html;
}
const api={TYPE,parse,valid,render};
if(typeof module!=='undefined' && module.exports) module.exports=api;
else {root.MediaGallery=api;
 document.addEventListener('click',event=>{const button=event.target.closest('[data-gallery-step]');if(!button)return;const gallery=button.closest('.media-gallery'),track=gallery.querySelector('.gallery-track'); const width=track.clientWidth;track.scrollTo({left:Math.round(track.scrollLeft/width)*width+Number(button.dataset.galleryStep)*width,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
 document.addEventListener('scroll',event=>{const track=event.target;if(!track.classList?.contains('gallery-track')||!track.clientWidth)return;const index=Math.round(track.scrollLeft/track.clientWidth);const gallery=track.parentElement;const label=gallery.querySelector('.gallery-position');if(label)label.textContent=(index+1)+' / '+track.children.length;track.querySelectorAll('video').forEach(video=>{if(video.closest('.gallery-slide')!==track.children[index])video.pause();});gallery.querySelectorAll('[data-gallery-step]').forEach(b=>b.disabled=Number(b.dataset.galleryStep)<0?index===0:index===track.children.length-1);},true);
}
})(typeof window==='undefined'?{}:window);
