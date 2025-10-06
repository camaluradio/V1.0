// ========================= PLAYER JS =========================
document.addEventListener("DOMContentLoaded", () => {
  const btnPlay = document.getElementById("btnPlay");
  const btnMute = document.getElementById("btnMute");
  const playGroup = document.getElementById("playGroup");
  const playLabel = document.getElementById("playLabel");
  const radio = document.getElementById("CML_radio-player");

  if (!radio) return console.error("No se encontró #CML_radio-player");

  const sourceEl = radio.querySelector('source');
  const originalSrc = (sourceEl?.getAttribute('data-base') || sourceEl?.getAttribute('src') || radio.getAttribute('data-base') || radio.src || radio.getAttribute('src') || "");

  let isConnected = false;
  let desiredPlaying = false;

  // Spinner en botón de play
  const btnSpinner = document.createElement("div");
  btnSpinner.className = "spinner";
  btnSpinner.style.width = "35px";
  btnSpinner.style.height = "35px";
  btnSpinner.style.zIndex = 5;
  btnSpinner.style.display = "none";
  btnSpinner.style.opacity = 0;
  btnPlay?.appendChild(btnSpinner);

  function showBtnSpinner(show){
    btnSpinner.style.display = show ? "block" : "none";
    btnSpinner.style.opacity = show ? 1 : 0;
    const icon = btnPlay.querySelector("i");
    if(icon) icon.style.display = show ? "none" : "inline-block";
  }

  function updateButtonUI(connected, playing){
    if(connected && playing){
      playGroup?.classList.remove('blink');
      if(playLabel) playLabel.textContent = "PAUSA";
      btnPlay.classList.remove('btn-primary');
      btnPlay.classList.add('btn-active');
      btnPlay.setAttribute("aria-pressed", "true");
      const icon = btnPlay.querySelector("i");
      if(icon) icon.className = "bi bi-pause-fill";
    } else {
      playGroup?.classList.add('blink');
      if(playLabel) playLabel.textContent = "REPRODUCIR";
      btnPlay.classList.remove('btn-active');
      btnPlay.classList.add('btn-primary');
      btnPlay.setAttribute("aria-pressed", "false");
      const icon = btnPlay.querySelector("i");
      if(icon) icon.className = "bi bi-play-fill";
    }
  }

  function setSourceAndLoad(freshSrc){
    if(sourceEl) sourceEl.src = freshSrc;
    else radio.src = freshSrc;
    radio.load();
  }

  async function connectStream(){
    if(!originalSrc) return Promise.reject(new Error("No streaming URL"));
    const fresh = originalSrc.split('?')[0] + "?t=" + Date.now();
    setSourceAndLoad(fresh);
    showBtnSpinner(true);
    try {
      await radio.play();
      isConnected = true;
      desiredPlaying = true;
      showBtnSpinner(false);
    } catch(err){
      isConnected = false;
      desiredPlaying = false;
      showBtnSpinner(false);
      console.error("Error al reproducir stream:", err);
      throw err;
    }
  }

  function disconnectStream(){
    try {
      desiredPlaying = false;
      radio.pause();
      if(sourceEl) sourceEl.removeAttribute('src');
      else radio.removeAttribute('src');
      radio.load();
    } catch(e){
      console.warn("Error al desconectar stream:", e);
    } finally {
      isConnected = false;
      showBtnSpinner(false);
    }
  }

  radio.addEventListener('playing', () => { updateButtonUI(true,true); isConnected=true; showBtnSpinner(false); });
  radio.addEventListener('pause', () => { updateButtonUI(isConnected,false); showBtnSpinner(false); });
  radio.addEventListener('error', (ev) => { console.error("Audio error:", ev); disconnectStream(); updateButtonUI(false,false); });

  btnPlay?.addEventListener("click", async () => {
    if(!isConnected){
      updateButtonUI(false,false);
      try { await connectStream(); } catch(e){ updateButtonUI(false,false); showBtnSpinner(false); }
    } else { disconnectStream(); updateButtonUI(false,false); showBtnSpinner(false); }
  });

  btnMute?.addEventListener("click", () => {
    radio.muted = !radio.muted;
    btnMute.setAttribute("aria-pressed", radio.muted ? "true" : "false");
    const icon = btnMute.querySelector("i");
    if(icon) icon.className = radio.muted ? "bi bi-volume-mute-fill" : "bi bi-volume-up-fill";
  });

  updateButtonUI(false,false);
});

// ========================= YOUTUBE JS =========================
let CML_radio = document.getElementById("CML_radio-player");
let players = [];
const fadeIntervals = new WeakMap();

function fade(audio, target, duration=500){
  if(fadeIntervals.has(audio)) clearInterval(fadeIntervals.get(audio));
  const stepTime=50, steps=duration/stepTime, step=(target-audio.volume)/steps;
  let current=0;
  const interval = setInterval(()=>{
    current++;
    audio.volume = Math.min(Math.max(audio.volume + step,0),1);
    if(current>=steps){ clearInterval(interval); fadeIntervals.delete(audio); }
  }, stepTime);
  fadeIntervals.set(audio, interval);
}

function formatDuration(iso){
  if(!iso) return "";
  const m = iso.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  if(!m) return "";
  const min = m[1]||0, sec = m[2]||0;
  return `${min}:${sec.toString().padStart(2,'0')}`;
}

function openFullscreen(el){ if(el.requestFullscreen) el.requestFullscreen(); else if(el.mozRequestFullScreen) el.mozRequestFullScreen(); else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen(); else if(el.msRequestFullscreen) el.msRequestFullscreen(); }
function closeFullscreen(){ if(document.exitFullscreen) document.exitFullscreen(); else if(document.mozCancelFullScreen) document.mozCancelFullScreen(); else if(document.webkitExitFullscreen) document.webkitExitFullscreen(); else if(document.msExitFullscreen) document.msExitFullscreen(); }

// Aquí iría todo tu código de renderFlashes, handleStateChange y mockData tal cual lo enviaste.
// Puedes copiar esos bloques directamente debajo de esta sección.

window.onYouTubeIframeAPIReady = function(){
  if(USE_MOCK) renderFlashes(mockData);
  else {
    fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${PLAYLIST_ID}&key=${API_KEY}`)
      .then(res=>res.json())
      .then(res=>{
        const itemsReversed = res.items.reverse().slice(0, MAX_VIDEOS);
        const ids = itemsReversed.map(it=>it.snippet.resourceId.videoId).join(",");
        return fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${API_KEY}`)
          .then(r=>r.json())
          .then(det=>{ itemsReversed.forEach((it,i)=>it.contentDetails=det.items[i].contentDetails); return {items: itemsReversed}; });
      })
      .then(data=>renderFlashes(data))
      .catch(err=>{ document.getElementById("videos").innerHTML=`<p class="no-videos">Error al cargar videos</p>`; console.error(err); });
  }
};

// ========================= BLOGGER JS =========================
document.addEventListener("DOMContentLoaded", function(){
  // TODO: copiar todo tu código de Blogger tal cual desde tu script original aquí.
});

// ========================= TIMER JS =========================
document.addEventListener("DOMContentLoaded", async () => {
  let offset = 0;
  const API_URL = "https://worldtimeapi.org/api/timezone/America/Argentina/Buenos_Aires";

  async function syncWithAPI(reintentos = 3) {
    for (let i = 0; i < reintentos; i++) {
      try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const fechaAPI = new Date(data.datetime);
        offset = fechaAPI.getTime() - new Date().getTime();
        console.log(`Sincronizado con API. Offset: ${offset / 1000} seg.`);
        return;
      } catch(e){
        console.warn(`Error obteniendo hora (intento ${i+1}):`, e);
        await new Promise(r=>setTimeout(r,1000));
      }
    }
    console.error("No se pudo sincronizar con la API después de varios intentos.");
  }

  function actualizarProgramacion(){
    const bloques = document.querySelectorAll(".bloque");
    if(!bloques.length) return;
    const ahora = new Date(Date.now() + offset);
    const horaHHMM = ahora.getHours()*100 + ahora.getMinutes();
    const diaSemana = ahora.getDay();
    bloques.forEach(b => {
      const inicio = parseInt(b.dataset.inicio) || 0;
      const fin = parseInt(b.dataset.fin) || 2400;
      const dias = b.dataset.dias ? b.dataset.dias.split(",").map(Number) : [0,1,2,3,4,5,6];
      b.style.display = (horaHHMM>=inicio && horaHHMM<=fin && dias.includes(diaSemana)) ? "" : "none";
    });
  }

  await syncWithAPI();
  actualizarProgramacion();
  setInterval(actualizarProgramacion, 30*1000);
});

// ========================= FRASES JS =========================
document.addEventListener("DOMContentLoaded", () => {
  const frases = document.querySelectorAll(".frase");
  if(!frases.length) return;
  let idx = 0;
  function mostrarFrase(){
    frases.forEach((f,i)=>f.style.display = i===idx ? "" : "none");
    idx = (idx+1)%frases.length;
  }
  mostrarFrase();
  setInterval(mostrarFrase, 5000);
});

// ========================= SHARE JS =========================
document.addEventListener("DOMContentLoaded", () => {
  const btns = document.querySelectorAll(".share-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", e=>{
      e.preventDefault();
      const url = btn.dataset.url || window.location.href;
      const tipo = btn.dataset.type || "facebook";
      let shareUrl = "";
      switch(tipo){
        case "facebook": shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`; break;
        case "twitter": shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`; break;
        case "whatsapp": shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(url)}`; break;
      }
      window.open(shareUrl,"_blank","width=600,height=400");
    });
  });
});
