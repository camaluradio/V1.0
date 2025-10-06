// PLAYER JS ==========================================================================



document.addEventListener("DOMContentLoaded", () => {
  const btnPlay = document.getElementById("btnPlay");
  const btnMute = document.getElementById("btnMute");
  const playGroup = document.getElementById("playGroup");
  const playLabel = document.getElementById("playLabel");

  // Spinner dentro del botón de play
  const btnSpinner = document.createElement("div");
  btnSpinner.className = "spinner";
  btnSpinner.style.width = "35px";
  btnSpinner.style.height = "35px";
  btnSpinner.style.zIndex = 5;
  btnSpinner.style.display = "none";
  btnSpinner.style.opacity = 0;
  if(btnPlay) btnPlay.appendChild(btnSpinner);

  function showBtnSpinner(show){
    btnSpinner.style.display = show ? "block" : "none";
    btnSpinner.style.opacity = show ? 1 : 0;
    const icon = btnPlay.querySelector("i");
    if(icon) icon.style.display = show ? "none" : "inline-block";
  }

  const radio = document.getElementById("CML_radio-player");
  if(!radio){
    console.error("No se encontró #CML_radio-player");
    return;
  }

  const sourceEl = radio.querySelector('source');
  const originalSrc = (sourceEl && (sourceEl.getAttribute('data-base') || sourceEl.getAttribute('src') || sourceEl.src))
                      || radio.getAttribute('data-base') || radio.src || radio.getAttribute('src') || "";

  let isConnected = false;
  let desiredPlaying = false;

  function updateButtonUI(connected, playing){
    if(connected && playing){
      if(playGroup) playGroup.classList.remove('blink');
      if(playLabel) playLabel.textContent = "PAUSA";
      btnPlay.classList.remove('btn-primary');
      btnPlay.classList.add('btn-active');
      btnPlay.setAttribute("aria-pressed", "true");
      const icon = btnPlay.querySelector("i");
      if(icon) icon.className = "bi bi-pause-fill";
    } else {
      if(playGroup) playGroup.classList.add('blink');
      if(playLabel) playLabel.textContent = "REPRODUCIR";
      btnPlay.classList.remove('btn-active');
      btnPlay.classList.add('btn-primary');
      btnPlay.setAttribute("aria-pressed", "false");
      const icon = btnPlay.querySelector("i");
      if(icon) icon.className = "bi bi-play-fill";
    }
  }

  function setSourceAndLoad(freshSrc){
    if(sourceEl){
      sourceEl.src = freshSrc;
    } else {
      radio.src = freshSrc;
    }
    radio.load();
  }

  function connectStream(){
    if(!originalSrc){
      console.error("No se encontró URL de streaming (originalSrc vacío).");
      return Promise.reject(new Error("No streaming URL"));
    }
    const base = originalSrc.split('?')[0];
    const fresh = base + "?t=" + Date.now();
    setSourceAndLoad(fresh);
    showBtnSpinner(true);
    return radio.play().then(()=> {
      isConnected = true;
      desiredPlaying = true;
      showBtnSpinner(false);
      return true;
    }).catch(err=>{
      isConnected = false;
      desiredPlaying = false;
      console.error("Error al conectar/repoducir stream:", err);
      showBtnSpinner(false);
      throw err;
    });
  }

  function disconnectStream(){
    try {
      desiredPlaying = false;
      radio.pause();
      if(sourceEl){
        sourceEl.removeAttribute('src');
      } else {
        radio.removeAttribute('src');
      }
      radio.load();
    } catch(e){
      console.warn("Error al desconectar stream:", e);
    } finally {
      isConnected = false;
      showBtnSpinner(false);
    }
  }

  radio.addEventListener('playing', () => {
    updateButtonUI(true, true);
    isConnected = true;
    showBtnSpinner(false);
  });

  radio.addEventListener('pause', () => {
    updateButtonUI(isConnected, false);
    showBtnSpinner(false);
  });

  radio.addEventListener('error', (ev) => {
    console.error("Audio error event:", ev);
    disconnectStream();
    updateButtonUI(false, false);
    showBtnSpinner(false);
  });

  if(btnPlay){
    btnPlay.addEventListener("click", async () => {
      if(!isConnected){
        updateButtonUI(false, false);
        try {
          await connectStream();
        } catch(err){
          updateButtonUI(false, false);
          showBtnSpinner(false);
        }
      } else {
        disconnectStream();
        updateButtonUI(false, false);
        showBtnSpinner(false);
      }
    });
  }

  if(btnMute){
    btnMute.addEventListener("click", () => {
      radio.muted = !radio.muted;
      btnMute.setAttribute("aria-pressed", radio.muted ? "true" : "false");
      const icon = btnMute.querySelector("i");
      if(icon){
        icon.className = radio.muted ? "bi bi-volume-mute-fill" : "bi bi-volume-up-fill";
      }
    });
  }

  updateButtonUI(false, false);
});


// YOUTUBE JS ==========================================================================



let CML_radio = document.getElementById("CML_radio-player");
let players = [];

// =================== FADE ===================
const fadeIntervals = new WeakMap();
function fade(audio, target, duration = 500) {
  if(fadeIntervals.has(audio)) clearInterval(fadeIntervals.get(audio));
  const stepTime = 50;
  const steps = duration / stepTime;
  const step = (target - audio.volume) / steps;
  let current = 0;
  const interval = setInterval(() => {
    current++;
    audio.volume = Math.min(Math.max(audio.volume + step, 0), 1);
    if (current >= steps) {
      clearInterval(interval);
      fadeIntervals.delete(audio);
    }
  }, stepTime);
  fadeIntervals.set(audio, interval);
}

// =================== FORMAT HELPERS ===================
function formatDuration(iso){
  if(!iso) return "";
  const m = iso.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  if(!m) return "";
  const min = m[1]||0, sec = m[2]||0;
  return `${min}:${sec.toString().padStart(2,'0')}`;
}

// =================== FULLSCREEN HELPERS ===================
function openFullscreen(el) {
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  else if (el.msRequestFullscreen) el.msRequestFullscreen();
}
function closeFullscreen() {
  if (document.exitFullscreen) document.exitFullscreen();
  else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  else if (document.msExitFullscreen) document.msExitFullscreen();
}

// =================== RENDER VIDEOS ===================
function renderFlashes(data){
  const container = document.getElementById("videos");
  container.innerHTML = "";
  players = [];

  if(!data.items || data.items.length===0){
    container.innerHTML = `<p class="no-videos">Todavía no hay videos.</p>`;
    return;
  }

  let count = 0;
  data.items.forEach((item,index)=>{
    if(count >= MAX_VIDEOS) return;

    const videoId = item.snippet?.resourceId?.videoId;
    if(!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return;

    const contenedor = document.createElement("div");
    contenedor.className="yt-frame rounded contenedor_de_video";
    const thumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    contenedor.innerHTML = `
      <div id="player-${index}" class="yt-frame rounded"></div>
      <div class="overlay" style="background-image:url('${thumb}'); background-size:cover; background-position:center;">
        <div class="spinner"></div>
        <div class="controles">
          <button class="icons play-icon"><i class="bi bi-play-fill"></i></button>
          <button class="icons restart-icon"><i class="bi bi-skip-backward-fill"></i></button>
          <button class="icons fullscreen-icon"><i class="bi bi-arrows-move"></i></button>
          <button class="icons close-fullscreen-icon" style="display:none;"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="duration-tag">${formatDuration(item.contentDetails?.duration)}</div>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
      <h5 class="card-title">${item.snippet.title}</h5>
      <p class="card-text text-truncate-3">${item.snippet.description || ''}</p>
    `;

    const cardContainer = document.createElement("div");
    cardContainer.className = "card sombra video-card";
    cardContainer.style.maxWidth = "540px";
    cardContainer.appendChild(contenedor);
    cardContainer.appendChild(body);
    container.appendChild(cardContainer);

    // =================== PLAYER ===================
    const player = new YT.Player(`player-${index}`,{
      videoId: videoId,
      playerVars: { autoplay:0, controls:0, modestbranding:1, rel:0 },
      events: { 'onStateChange': e => handleStateChange(e,index,thumb) }
    });

    const overlayEl = contenedor.querySelector(".overlay");
    const spinner = overlayEl.querySelector(".spinner");
    const playIcon = overlayEl.querySelector(".play-icon");
    const restart = overlayEl.querySelector(".restart-icon");
    const fullscreenBtn = overlayEl.querySelector(".fullscreen-icon");
    const closeFullscreenBtn = overlayEl.querySelector(".close-fullscreen-icon");
    const durationTag = overlayEl.querySelector(".duration-tag");

    spinner.style.display="none";
    spinner.style.opacity=0;

    // Hacer que todo el contenedor sea clickeable para play/pause
    contenedor.addEventListener("click", (e)=>{
      if(e.target.closest(".icons")) return; // Ignorar clicks sobre los botones
      const state = player.getPlayerState();
      if(state === YT.PlayerState.PLAYING){
        player.pauseVideo();
      } else {
        players.forEach((o,j)=>{ if(j!==index) o.player.pauseVideo(); });
        spinner.style.display="block";
        spinner.style.opacity=1;
        player.playVideo();
      }
    });

    // Eventos existentes
    playIcon.addEventListener("click",(e)=>{
      e.stopPropagation();
      const state = player.getPlayerState();
      if(state === YT.PlayerState.PLAYING){
        player.pauseVideo();
      } else {
        players.forEach((o,j)=>{ if(j!==index) o.player.pauseVideo(); });
        spinner.style.display="block";
        spinner.style.opacity=1;
        player.playVideo();
      }
    });

    restart.addEventListener("click",(e)=>{
      e.stopPropagation();
      spinner.style.display="block";
      spinner.style.opacity=1;
      player.seekTo(0); player.playVideo();
    });

    fullscreenBtn.addEventListener("click", (e)=>{
      e.stopPropagation();
      openFullscreen(contenedor);
      fullscreenBtn.style.display = "none";
      closeFullscreenBtn.style.display = "block";
    });

    closeFullscreenBtn.addEventListener("click", (e)=>{
      e.stopPropagation();
      closeFullscreen();
      closeFullscreenBtn.style.display = "none";
      fullscreenBtn.style.display = "block";
    });

    players.push({player,overlay:overlayEl,spinner,playIcon,durationTag,thumb});
    count++;
  });

  if(players.length===0){
    container.innerHTML = `<p class="no-videos">No hay videos disponibles para mostrar.</p>`;
  }
}

// =================== STATE CHANGE ===================
function handleStateChange(event,index,thumb){
  const p = players[index]; if(!p) return;
  switch(event.data){
    case YT.PlayerState.UNSTARTED:
    case YT.PlayerState.BUFFERING:
      p.spinner.style.display="block";
      p.spinner.style.opacity=1;
      break;
    case YT.PlayerState.PLAYING:
      p.overlay.style.background="rgba(0,0,0,0)";
      p.spinner.style.display="none";
      p.spinner.style.opacity=0;
      p.playIcon.innerHTML = `<i class="bi bi-pause-fill"></i>`;
      p.durationTag.style.opacity=0;
      fade(CML_radio,0,300);
      break;
    case YT.PlayerState.PAUSED:
      p.overlay.style.backgroundImage=`url('${thumb}')`;
      p.overlay.style.backgroundSize="cover";
      p.overlay.style.backgroundPosition="center";
      p.spinner.style.display="none";
      p.spinner.style.opacity=0;
      p.playIcon.innerHTML = `<i class="bi bi-play-fill"></i>`;
      p.durationTag.style.opacity=1;
      fade(CML_radio,1,2000);
      break;
    case YT.PlayerState.ENDED:
      p.playIcon.innerHTML = `<i class="bi bi-play-fill"></i>`;
      p.spinner.style.display="none";
      p.spinner.style.opacity=0;
      p.durationTag.style.opacity=1;
      fade(CML_radio,1,2000);
      break;
  }
}

// =================== MOCK DATA ===================
const mockData = {
  items:[
    {snippet:{resourceId:{videoId:"dQw4w9WgXcQ"}, title:"Video 1", description:"Desc 1: Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).", publishedAt:"2025-01-01T00:00:00Z"}, contentDetails:{duration:"PT3M33S"}},
    {snippet:{resourceId:{videoId:"3JZ_D3ELwOQ"}, title:"Video 2", description:"Desc 2: Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident.", publishedAt:"2025-01-02T00:00:00Z"}, contentDetails:{duration:"PT4M12S"}},
    {snippet:{resourceId:{videoId:"L_jWHffIx5E"}, title:"Video 3", description:"Desc 3: Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident.", publishedAt:"2025-01-03T00:00:00Z"}, contentDetails:{duration:"PT2M50S"}}
  ]
};

// =================== API READY ===================
window.onYouTubeIframeAPIReady = function(){
  if(USE_MOCK) renderFlashes(mockData);
  else {
    fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${PLAYLIST_ID}&key=${API_KEY}`)
      .then(res=>res.json())
      .then(res=>{
        // Invertir el orden para mostrar el último agregado primero
        const itemsReversed = res.items.reverse().slice(0, MAX_VIDEOS);
        const ids = itemsReversed.map(it=>it.snippet.resourceId.videoId).join(",");
        return fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${API_KEY}`)
          .then(r=>r.json())
          .then(det=>{ 
            itemsReversed.forEach((it,i)=>it.contentDetails=det.items[i].contentDetails); 
            return { items: itemsReversed }; 
          });
      })
      .then(data=>renderFlashes(data))
      .catch(err=>{
        document.getElementById("videos").innerHTML=`<p class="no-videos">Error al cargar videos</p>`;
        console.error(err);
      });
  }
};



// BLOGGER JS ==========================================================================



document.addEventListener("DOMContentLoaded", function(){

  // ========================= Botón de copiar enlace del home =========================
  const copyBtnHome = document.getElementById('copyLink');
  if(copyBtnHome){
    copyBtnHome.addEventListener('click', function(){
      navigator.clipboard.writeText(window.location.href)
        .then(() => { alert('¡Enlace copiado al portapapeles!'); })
        .catch(() => { alert('No se pudo copiar el enlace.'); });
    });
  }

  // ========================= Variables principales =========================
  const ALL_POSTS = [];
  const ALL_PAGES = [];
  let ALL_TAGS = new Set();
  let currentTag = null;
  let renderedCount = 0;

  const feedsWrapper = document.getElementById("feedsWrapper");
  const feedCards = document.getElementById("feedCards");
  const tagTitleDiv = document.getElementById("currentTagTitle");

  // ========================= Función para normalizar URLs =========================
  function normalizeUrl(url){ 
    try{ return new URL(url, location.origin).href.replace(/\/$/,""); } 
    catch(e){ return url; } 
  }

  // ========================= Cargar posts =========================
  async function loadPosts(){
    for(const feed of FEEDS){
      try{
        const res = await fetch(feed.url);
        const data = await res.json();
        const entries = data.feed.entry || [];
        entries.forEach(e=>{
          const content = e.content?e.content.$t:e.summary?e.summary.$t:"";
          const image = (/<img[^>]+src="([^">]+)"/i.exec(content)||[])[1] || PLACEHOLDER_IMG;
          const summary = content.replace(/<[^>]*>/g,"").slice(0,150);
          const fecha = e.published ? new Date(e.published.$t).toLocaleDateString("es-AR") : "";
          const autor = e.author && e.author[0] ? e.author[0].name.$t : "";
          const etiquetas = e.category ? e.category.map(c=>c.term).join(", ") : "";
          const post = {
            id: e.id.$t.split(feed.pages?"page-":"post-")[1] || e.id.$t,
            title: e.title.$t,
            link: (e.link.find(l=>l.rel==="alternate")||{}).href||"#",
            content: content,
            image: image,
            summary: summary,
            fecha: fecha,
            autor: autor,
            etiquetas: etiquetas,
            isPage: !!feed.pages
          };
          if(feed.pages) ALL_PAGES.push(post);
          else {
            ALL_POSTS.push(post);
            etiquetas.split(", ").forEach(tag => {
              if(tag.trim()) ALL_TAGS.add(tag.trim());
            });
          }
        });
      }catch(err){console.warn("Error cargando feed",err);}
    }

    renderTagMenu();
    updateTagTitle();
    renderPosts(true);

    const params = new URLSearchParams(window.location.search);
    const postUrl = params.get("post");
    if(postUrl){
      const normUrl = normalizeUrl(decodeURIComponent(postUrl));
      const entry = ALL_POSTS.find(p=>normalizeUrl(p.link)===normUrl) || ALL_PAGES.find(p=>normalizeUrl(p.link)===normUrl);
      if(entry){ openPost(entry.id); return; }
    }
  }

  // ========================= Menú de tags =========================
  function renderTagMenu(){
    let html = `
 <nav class="navbar navbar-expand-lg navbar-dark bg-secondary rounded w-100 sombra">
  <div class="container-fluid">
    ${HEADER_TAG_HTML}
    <button class="navbar-toggler ms-auto" type="button" data-bs-toggle="collapse" data-bs-target="#tagMenuCollapse" aria-controls="tagMenuCollapse" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse" id="tagMenuCollapse">
      <div class="navbar-nav flex-wrap justify-content-end w-100">
        <a href="#" onclick="window.scrollTo({top:0,behavior:'smooth'}); return false;" class="btn btn-primary btn-sm m-1">
          <i class="bi bi-house-fill"></i> Inicio
        </a>
        <a href="#" data-tag="" class="btn btn-primary btn-sm m-1 ${!currentTag?'active':''}">
          <i class="bi bi-newspaper"></i> ${NEW_POSTS_LABEL}
        </a>
        ${[...ALL_TAGS].sort().map(tag => `
          <a href="#" data-tag="${tag}" class="btn btn-primary btn-sm m-1 ${currentTag===tag?'active':''}">${tag}</a>
        `).join("")}
      </div>
    </div>
  </div>
</nav>
    `;
    document.getElementById("tagMenu").innerHTML = html;
  }

  function updateTagTitle(){ tagTitleDiv.textContent = currentTag ? currentTag : DEFAULT_TAG_TITLE; }

  function getFilteredPosts(){ if(!currentTag) return ALL_POSTS; return ALL_POSTS.filter(p=>p.etiquetas.split(", ").includes(currentTag)); }

  // ========================= Render de posts =========================
  function renderPosts(reset=false){
    const filtered = getFilteredPosts();
    if(reset) renderedCount = 0;
    const nextPosts = filtered.slice(renderedCount, renderedCount + POSTS_PER_PAGE);
    renderedCount += nextPosts.length;

    const html = nextPosts.map(p=>{
      const tagsHTML = p.etiquetas.split(", ").map(tag=>`<a href="#" class="post-tag" data-tag="${tag}">${tag}</a>`).join(", ");
      return `
        <div class="post-item rounded sombra">
          <img src="${p.image}" alt="${p.title}" onerror="this.src='${PLACEHOLDER_IMG}'"/>
          <div class="post-overlay">
            <h2 class="pb-1">${p.title}</h2>
            ${!p.isPage ? `<p class="small"><i class="bi bi-calendar-fill"></i> ${p.fecha} <i class="bi bi-person-square"></i> ${p.autor}</p>` : ""}
            <p class="d-none">Etiquetas: ${tagsHTML}</p>
            <p class="d-none">${p.summary}...</p>
            <p class="text-end"><a class="btn btn-primary btn-sm m-0" href="#" data-postid="${p.id}"><i class="bi bi-box-arrow-right"></i> ${READ_MORE_LABEL}</a></p>
          </div>
        </div>
      `;
    }).join("");

    if(reset) feedCards.innerHTML = html;
    else feedCards.insertAdjacentHTML("beforeend", html);

    const moreBtnId = "loadMoreBtn";
    const existingBtn = document.getElementById(moreBtnId);
    if(renderedCount < filtered.length){
      if(!existingBtn){
        const btn = document.createElement("button");
        btn.className = "btn btn-primary mt-4";
        btn.id = moreBtnId;
        btn.innerHTML = '<i class="bi bi-cloud-download-fill"></i> ' + LOAD_MORE_LABEL;
        feedCards.insertAdjacentElement("afterend", btn);
      }
    } else if(existingBtn) existingBtn.remove();
  }

  // ========================= Abrir post en modal =========================
  function openPost(id){
    const entry = ALL_POSTS.find(p=>p.id===id) || ALL_PAGES.find(p=>p.id===id);
    if(!entry) return;

    const tagsHTML = entry.etiquetas.split(", ").map(tag=>`<a style="cursor:pointer" class="post-tag badge bg-primary" data-tag="${tag}">${tag}</a>`).join(", ");
    const modalTitle = document.querySelector("#postModal .modal-title");
    const modalBody = document.getElementById("postModalBody");
    const modalFooter = document.querySelector("#postModal .modal-footer");

    modalTitle.innerHTML = MODAL_TITLE_HTML;
    modalBody.innerHTML = `
      <div class="text-center" style="text-align:center;">
      <h3>${entry.title}</h3>
      ${!entry.isPage ? `<p class="small"><i class="bi bi-calendar-fill"></i> ${entry.fecha} <i class="bi bi-person-square"></i> ${entry.autor}</p>` : ""}
      <p class="small text-white">${tagsHTML}</p>
      </div>
      <div class="post-body">${entry.content}
      <div class="text-center mt-3"><button type="button" class="btn btn-primary mb-4" data-bs-dismiss="modal">Cerrar</button></div>
      </div>
    `;

    const url = encodeURIComponent(entry.link);
    const title = encodeURIComponent(entry.title);
    modalFooter.innerHTML = `
      <div class="d-flex flex-wrap justify-content-center align-items-center gap-2">Compartir 
        <a class='share-btn btn-facebook' href='https://www.facebook.com/sharer/sharer.php?u=${url}' target='_blank'><i class='text-white bi bi-facebook'></i></a>
        <a class='share-btn btn-twitter' href='https://twitter.com/intent/tweet?url=${url}&amp;text=${title}' target='_blank'><i class='text-white bi bi-twitter'></i></a>
        <a class='share-btn btn-whatsapp' href='https://api.whatsapp.com/send?text=${title}%20${url}' target='_blank'><i class='text-white bi bi-whatsapp'></i></a>
        <a class='share-btn btn-linkedin' href='https://www.linkedin.com/sharing/share-offsite/?url=${url}' target='_blank'><i class='text-white bi bi-linkedin'></i></a>
        <a class='share-btn btn-telegram' href='https://t.me/share/url?url=${url}&text=${title}' target='_blank'><i class='text-white bi bi-telegram'></i></a>
        <a class='share-btn btn-copy' style='cursor:pointer;'><i class='text-white bi bi-link-45deg'></i></a>
      </div>
    `;

    const copyBtn = modalFooter.querySelector(".btn-copy");
    if(copyBtn){
      copyBtn.addEventListener("click", function(){
        navigator.clipboard.writeText(entry.link)
          .then(() => alert("¡Enlace copiado al portapapeles!"))
          .catch(() => alert("No se pudo copiar el enlace."));
      });
    }

    modalBody.querySelectorAll(".post-body a").forEach(a=>{
      a.setAttribute("target","_blank");
      a.setAttribute("rel","noopener noreferrer");
      a.href = new URL(a.getAttribute("href"), location.origin).href;
    });

    const modalEl = document.getElementById("postModal");
    const modalInstance = new bootstrap.Modal(modalEl);
    modalEl.addEventListener("show.bs.modal", () => document.body.style.overflow = "hidden");
    modalEl.addEventListener("hidden.bs.modal", () => document.body.style.overflow = "");
    modalInstance.show();

    // ========================= Lightbox de imágenes =========================
    modalBody.querySelectorAll(".post-body img").forEach(img=>{
      img.style.cursor = "zoom-in";
      img.addEventListener("click", ev=>{
        ev.preventDefault(); ev.stopPropagation();
        const overlay = document.getElementById("modalImgLightbox");
        const lightImg = document.getElementById("modalLightboxImage");
        if(!overlay || !lightImg) return;
        lightImg.src = img.src;
        lightImg.style.transform = "translate(0px,0px) scale(1)";
        overlay.style.display = "flex";
        overlay.setAttribute("aria-hidden","false");
        document.body.style.overflow = "hidden";
        let scale=1, startX=0, startY=0, lastX=0, lastY=0, dragging=false, lastTouchDist=null;

        function getTransform(){
          const m=lightImg.style.transform.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)\s*scale\((-?\d+(?:\.\d+)?)\)/);
          return m?{x:parseFloat(m[1]),y:parseFloat(m[2]),s:parseFloat(m[3])}:{x:0,y:0,s:1};
        }

        function onPointerDown(e){dragging=true;lightImg.setPointerCapture&&lightImg.setPointerCapture(e.pointerId);startX=e.clientX;startY=e.clientY;const t=getTransform();lastX=t.x;lastY=t.y;scale=t.s;lightImg.style.cursor="grabbing";}
        function onPointerMove(e){if(!dragging) return; const dx=e.clientX-startX, dy=e.clientY-startY; const t=getTransform(); lightImg.style.transform=`translate(${lastX+dx}px, ${lastY+dy}px) scale(${scale})`;}
        function onPointerUp(e){dragging=false;lightImg.style.cursor="grab";try{lightImg.releasePointerCapture&&lightImg.releasePointerCapture(e.pointerId);}catch(_){}} 
        function onWheel(e){e.preventDefault();const delta=e.deltaY<0?1.1:0.9; const t=getTransform(); scale=Math.min(Math.max(t.s*delta,0.5),5); lightImg.style.transform=`translate(${t.x}px, ${t.y}px) scale(${scale})`;}
        function distance(touches){return Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);}
        function onTouchStart(e){if(e.touches.length===2){lastTouchDist=distance(e.touches);}else{startX=e.touches[0].clientX; startY=e.touches[0].clientY; const t=getTransform(); lastX=t.x; lastY=t.y; scale=t.s; dragging=true;}}
        function onTouchMove(e){if(e.touches.length===2&&lastTouchDist){const newDist=distance(e.touches); const t=getTransform(); scale=Math.min(Math.max(t.s*(newDist/lastTouchDist),0.5),5); lightImg.style.transform=`translate(${t.x}px, ${t.y}px) scale(${scale})`; lastTouchDist=newDist;}else if(dragging){const dx=e.touches[0].clientX-startX,dy=e.touches[0].clientY-startY; lightImg.style.transform=`translate(${lastX+dx}px, ${lastY+dy}px) scale(${scale})`;}}
        function onTouchEnd(e){if(e.touches.length===0){dragging=false;lastTouchDist=null;}}

        lightImg.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        lightImg.addEventListener("wheel", onWheel,{passive:false});
        lightImg.addEventListener("touchstart", onTouchStart,{passive:false});
        lightImg.addEventListener("touchmove", onTouchMove,{passive:false});
        lightImg.addEventListener("touchend", onTouchEnd);

        function closeOverlay(){
          overlay.style.display="none";
          overlay.setAttribute("aria-hidden","true");
          document.body.style.overflow="hidden";
          lightImg.removeEventListener("pointerdown", onPointerDown);
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          lightImg.removeEventListener("wheel", onWheel);
          lightImg.removeEventListener("touchstart", onTouchStart);
          lightImg.removeEventListener("touchmove", onTouchMove);
          lightImg.removeEventListener("touchend", onTouchEnd);
          lightImg.style.transform="translate(0px,0px) scale(1)";
          lastTouchDist=null; dragging=false;
        }

        overlay.onclick = function(ev){if(ev.target===overlay) closeOverlay();}
        const closeBtn=overlay.querySelector(".closeBtn"); if(closeBtn) closeBtn.onclick=closeOverlay;
      });
    });
  }

  // ========================= Abrir página estática =========================
  window.openStaticPage = function(url){
    const normUrl = normalizeUrl(url);
    const entry = ALL_PAGES.find(p=>normalizeUrl(p.link)===normUrl) || ALL_POSTS.find(p=>normalizeUrl(p.link)===normUrl);
    if(entry) openPost(entry.id);
    else console.warn("Página/post no encontrado:", url);
  }

  // ========================= Click global =========================
  document.addEventListener("click", function(e){
    const a = e.target.closest("a");
    if(a){
      const postId = a.dataset.postid;
      const tag = a.dataset.tag;

      if(postId){ e.preventDefault(); openPost(postId); }
      else if(tag !== undefined){
        e.preventDefault();
        const modalEl = document.getElementById("postModal");
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if(modalInstance) modalInstance.hide();

        currentTag = tag || null;
        renderTagMenu();
        updateTagTitle();
        renderPosts(true);
        feedsWrapper.style.display = "block";

        const tagMenuEl = document.getElementById("CML_blogjs");
        if(tagMenuEl){
          tagMenuEl.scrollIntoView({behavior:"smooth", block:"start"});
          const activeBtn = tagMenuEl.querySelector(".btn.active");
          if(activeBtn) activeBtn.focus({preventScroll:true});
        }
      }
    }

    const btn = e.target.closest("button");
    if(btn && btn.id === "loadMoreBtn") renderPosts();
  });

  // ========================= Cargar posts al inicio =========================
  loadPosts();

});



// TIMER JS ==========================================================================



document.addEventListener("DOMContentLoaded", async () => {
  let offset = 0; // diferencia entre API y reloj local en ms
  const API_URL = "https://worldtimeapi.org/api/timezone/America/Argentina/Buenos_Aires";

  async function syncWithAPI(reintentos = 3) {
    for (let i = 0; i < reintentos; i++) {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const fechaAPI = new Date(data.datetime);
        const fechaLocal = new Date();
        offset = fechaAPI.getTime() - fechaLocal.getTime();
        console.log(`Sincronizado con API. Offset: ${offset / 1000} seg.`);
        return;
      } catch (e) {
        console.warn(`Error obteniendo hora (intento ${i + 1}):`, e);
        await new Promise(r => setTimeout(r, 1000)); // espera 1s antes de reintentar
      }
    }
    console.error("No se pudo sincronizar con la API después de varios intentos.");
  }

  function actualizarProgramacion() {
    const bloques = document.querySelectorAll(".bloque");
    if (!bloques.length) return; // no hay elementos que mostrar

    const ahora = new Date(Date.now() + offset);
    const horaHHMM = ahora.getHours() * 100 + ahora.getMinutes();
    const diaSemana = ahora.getDay();

    bloques.forEach(b => {
      const inicio = parseInt(b.dataset.inicio) || 0;
      const fin = parseInt(b.dataset.fin) || 2400;
      const dias = b.dataset.dias ? b.dataset.dias.split(",").map(n => parseInt(n)) : null;

      let mostrar = horaHHMM >= inicio && horaHHMM < fin;
      if (dias) mostrar = mostrar && dias.includes(diaSemana);

      b.style.display = mostrar ? "grid" : "none";
    });
  }

  // Sincroniza al inicio
  await syncWithAPI();
  actualizarProgramacion();

  // Actualiza cada minuto
  setInterval(actualizarProgramacion, 60 * 1000);

  // Re-sincroniza con la API cada hora
  setInterval(syncWithAPI, 60 * 60 * 1000);
});



// FRASESJS ==========================================================================



(function(){
  const frases = [
    'Quien canta, su mal espanta.',
    'La música amansa las fieras.',
    'A ritmo de la zamba, todo se arregla.',
    'Guitarra que suena, corazón que siente.',
    'Donde hay canto, hay alegría.',
    'No hay mal que un acorde no pueda calmar.',
    'Canto que une, nunca divide.',
    'Al que buen son toca, la vida le sonríe.',
    'Quien toca con alma, toca para todos.',
    'El que sabe escuchar, encuentra melodía en todo.',
    'Quien siembra con paciencia, cosecha con alegría.',
    'Tierra que se cuida, da frutos que perduran.',
    'El que labra con amor, cosecha con corazón.',
    'Campo que habla, sabio enseña.',
    'El sol no se apresura, y la cosecha llega a tiempo.',
    'Agua que corre, vida que fluye.',
    'La semilla que cae, sabe esperar.',
    'Quien escucha el viento, aprende del cielo.',
    'La tierra no se engaña; devuelve lo que recibe.',
    'El surco profundo da fruto duradero.'
  ];

  let intervalo;
  const mensaje = document.getElementById('mensaje');
  const frasesBox = document.getElementById('frasesBox');

  function mostrarFrase(){
    if(!mensaje) return;
    mensaje.style.opacity = 0;
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * frases.length);
      mensaje.textContent = frases[randomIndex];
      mensaje.style.opacity = 1;
    }, 600);
  }

  document.addEventListener("DOMContentLoaded", () => {
    mostrarFrase();
    intervalo = setInterval(mostrarFrase, 10000);
  });

  if(frasesBox){
    frasesBox.addEventListener("click", () => {
      mostrarFrase();
      clearInterval(intervalo);
      intervalo = setInterval(mostrarFrase, 10000);
    });
  }
})();



// SHARE JS ==========================================================================



(function(){
  const url = encodeURIComponent(window.location.href);
  const title = encodeURIComponent(document.title);
  document.getElementById('shareFacebook').href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  document.getElementById('shareTwitter').href = `https://twitter.com/intent/tweet?url=${url}&amp;text=${title}`;
  document.getElementById('shareWhatsApp').href = `https://api.whatsapp.com/send?text=${title}%20${url}`;
  document.getElementById('shareLinkedIn').href = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
  document.getElementById('shareTelegram').href = `https://t.me/share/url?url=${url}&amp;text=${title}`;
  document.getElementById('shareDiscord').href = `https://discord.com/channels/@me?text=${title}%20${url}`;
  document.getElementById('copyLink').addEventListener('click', function(){
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('¡Enlace copiado al portapapeles!');
    }).catch(() => {
      alert('No se pudo copiar el enlace.');
    });
  });

})();



// CONTACTO JS ==========================================================================



document.addEventListener("DOMContentLoaded", function() {
  const form = document.getElementById("my-form");
  const status = document.getElementById("my-form-status");
  const emailField = document.getElementById("email");
  const messageField = document.getElementById("message");
  const submitButton = document.getElementById("my-form-button");
  const formActionURL = "https://formspree.io/f/xqayloaa";

  if (form && status && emailField && messageField && submitButton) {
    function verificarCampos() {
      submitButton.disabled = !(emailField.value.trim() && messageField.value.trim());
    }

    emailField.addEventListener("input", verificarCampos);
    messageField.addEventListener("input", verificarCampos);

    form.addEventListener("submit", async function(e) {
      e.preventDefault();

      if (!emailField.value.trim() || !messageField.value.trim()) {
        status.innerHTML = "❌ Por favor completa todos los campos.";
        return;
      }

      submitButton.disabled = true;
      status.innerHTML = "Enviando...";

      const formData = new FormData();
      formData.append("email", emailField.value.trim());
      formData.append("message", messageField.value.trim());

      try {
        const response = await fetch(formActionURL, {
          method: "POST",
          body: formData,
          headers: { "Accept": "application/json" }
        });

        if (response.ok) {
          form.style.display = "none";
          status.innerHTML = "<h3>✅ Gracias por tu mensaje!</h3>";
        } else {
          const data = await response.json();
          if (data.errors) {
            status.innerHTML = data.errors.map(e => e.message).join(", ");
          } else {
            status.innerHTML = "❌ Hubo un problema al enviar tu mensaje.";
          }
          submitButton.disabled = false;
        }
      } catch (err) {
        status.innerHTML = "❌ Error de conexión, intenta nuevamente.";
        submitButton.disabled = false;
      }
    });
  }
});




