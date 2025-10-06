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
      player.seekTo(0,true);
      spinner.style.display="block";
      spinner.style.opacity=1;
      player.playVideo();
    });

    fullscreenBtn.addEventListener("click",(e)=>{
      e.stopPropagation();
      openFullscreen(contenedor);
      fullscreenBtn.style.display="none";
      closeFullscreenBtn.style.display="inline-block";
    });

    closeFullscreenBtn.addEventListener("click",(e)=>{
      e.stopPropagation();
      closeFullscreen();
      closeFullscreenBtn.style.display="none";
      fullscreenBtn.style.display="inline-block";
    });

    players.push({player,overlay:overlayEl});
    count++;
  });
}

function handleStateChange(event,index,thumb){
  const overlay = players[index]?.overlay;
  if(!overlay) return;
  const spinner = overlay.querySelector(".spinner");
  const playIcon = overlay.querySelector(".play-icon i");
  if(event.data === YT.PlayerState.PLAYING){
    fade(CML_radio,0.2,200);
    spinner.style.display="none";
    playIcon.className="bi bi-pause-fill";
  } else if(event.data === YT.PlayerState.PAUSED){
    fade(CML_radio,1,200);
    playIcon.className="bi bi-play-fill";
  } else if(event.data === YT.PlayerState.ENDED){
    fade(CML_radio,1,200);
    playIcon.className="bi bi-play-fill";
  }
}

// =================== TIMER ===================
function startTimer(){
  const timerEl = document.getElementById("CML_timer");
  if(!timerEl) return;
  setInterval(()=>{
    const now = new Date();
    timerEl.textContent = now.toLocaleTimeString('es-AR',{hour12:false});
  },1000);
}

// =================== FRASES ===================
function loadFrases(frases){
  const container = document.getElementById("CML_frases");
  if(!container) return;
  container.innerHTML = "";
  frases.forEach(f=>{
    const p = document.createElement("p");
    p.textContent = f;
    container.appendChild(p);
  });
}

// =================== SHARE ===================
function setupShare(){
  const buttons = document.querySelectorAll(".CML_share");
  buttons.forEach(btn=>{
    btn.addEventListener("click",()=>{
      const url = btn.dataset.url || window.location.href;
      if(navigator.share){
        navigator.share({url}).catch(console.error);
      } else {
        prompt("Copiar link:",url);
      }
    });
  });
}

// =================== INIT ===================
document.addEventListener("DOMContentLoaded",()=>{
  startTimer();
  setupShare();
});
