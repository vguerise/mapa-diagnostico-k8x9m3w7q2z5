<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>O Perfumista</title>
<meta name="viewport" content="width=device-width, initial-scale=1">

<style>
:root{
  --gold:#d4af37;
  --bg:#0b0b0c;
  --card:rgba(0,0,0,.32);
  --stroke:rgba(212,175,55,.18);
  --stroke2:rgba(212,175,55,.28);
  --text:rgba(255,255,255,.92);
  --muted:rgba(255,255,255,.68);
}
*{box-sizing:border-box}
body{
  margin:0;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
  color:var(--text);
  background:
    radial-gradient(900px 500px at 50% -20%, rgba(212,175,55,.18), transparent 55%),
    radial-gradient(900px 500px at 50% 120%, rgba(212,175,55,.10), transparent 55%),
    linear-gradient(#0b0b0c,#0a0a0a);
  min-height:100vh;
  padding:28px 16px;
}
.container{max-width:980px;margin:auto}
h1{
  text-align:center;
  color:var(--gold);
  letter-spacing:3px;
}
.subtitle{
  text-align:center;
  color:var(--muted);
  margin-top:6px;
}
.card{
  margin-top:20px;
  border:1px solid var(--stroke2);
  background:var(--card);
  border-radius:18px;
  padding:20px;
}
#status{opacity:.7;margin-bottom:10px}
.rec{
  border:1px solid var(--stroke);
  border-radius:14px;
  padding:14px;
  margin-top:12px;
}
.rec b{color:var(--gold)}
.rec ul{margin:8px 0 0 18px;color:var(--muted)}
textarea{
  width:100%;
  min-height:110px;
  margin-top:12px;
  background:#000;
  color:white;
  border:1px solid rgba(255,255,255,.15);
  border-radius:12px;
  padding:12px;
  font-size:16px;
}

textarea::placeholder{color:#fff;opacity:0.85;}

button{
  margin-top:10px;
  padding:12px 18px;
  border:none;
  border-radius:12px;
  background:var(--gold);
  color:#000;
  font-weight:700;
  cursor:pointer;
}

@keyframes newGlow {
  0% { box-shadow: 0 0 0 rgba(212,175,55,0); transform: translateY(0); }
  30% { box-shadow: 0 0 22px rgba(212,175,55,0.55); transform: translateY(-2px); }
  100% { box-shadow: 0 0 0 rgba(212,175,55,0); transform: translateY(0); }
}
.rec.fresh{
  animation:newGlow 1s ease-out 1;
  border-color: rgba(212,175,55,0.9);
}

</style>
</head>

<body>
<div class="container">
  <h1>O PERFUMISTA</h1>
  <div class="subtitle">Recomendações personalizadas</div>

  <div class="card">
    <div id="status">Pronto.</div>
    <div id="cards"></div>

    <textarea id="prompt" placeholder="Deseja mais alguma sugestão? Me diz a ocasião, o clima, se é ambiente fechado, ou até qual perfume inspirado você precisa!"></textarea>
    <div style="display:flex; gap:12px; align-items:center;">
<button id="sendBtn">Gerar</button>
<button id="openChatGPT" style="background:#2b2b2b;color:#fff;border:1px solid rgba(212,175,55,.4);">Abrir no ChatGPT</button>
</div>
  </div>
</div>

<script>
const API = "https://operfumista-api.vercel.app/api/perfumista";
const WARMUP_URL = "https://operfumista-api.vercel.app/api/warmup"; // ✅ NOVO
const MAPA_ORIGIN = "https://vguerise.github.io";

let contextoMapa="";

const cards = document.getElementById("cards");
const status = document.getElementById("status");
const prompt = document.getElementById("prompt");
const btn = document.getElementById("sendBtn");

function setStatus(t){
  status.textContent=t;
  resize();
}
function resize(){
  if(window.parent!==window){
    window.parent.postMessage(
      {source:"operfumista",type:"height",height:document.body.scrollHeight},
      MAPA_ORIGIN
    );
  }
}

/* 🟡 WARM-UP (corrigido: não chama OpenAI) */

function notifyParent(type, extra = {}){
  if(window.parent!==window){
    window.parent.postMessage(
      Object.assign({ source:"operfumista", type }, extra),
      MAPA_ORIGIN
    );
  }
}

function warmupPerfumista(){
  try{
    fetch(WARMUP_URL, { method:"GET" }).catch(()=>{});
  }catch(e){}
}

async function chamarIA(text){
  if(!text.trim()) return;
  
  notifyParent("loading");
setStatus("Consultando o Perfumista…");
  try{
    const r = await fetch(API,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({diagnostico:text,prompt:text})
    });
  applyGlow();
    const data = await r.json();
    if(!r.ok) throw new Error(data.error||"Erro");

    render(data);
    setStatus("Pronto.");
  
    notifyParent("done");
}catch(e){
    cards.innerHTML = `<div class="rec">Erro: ${e.message}</div>`;
    setStatus("Erro.");
  
    notifyParent("error", { message: e.message });
}
  resize();
}


const chatBtn = document.getElementById("openChatGPT");
chatBtn.onclick=()=>{ window.open("https://chatgpt.com", "_blank"); };

function applyGlow(){
  const recs = Array.from(document.querySelectorAll(".rec"));
  recs.forEach(r=>r.classList.remove("fresh"));
  recs.slice(-3).forEach(r=>r.classList.add("fresh"));
  setTimeout(()=>{ document.querySelectorAll(".rec.fresh").forEach(r=>r.classList.remove("fresh")); },1100);
}

function render(data){
  cards.innerHTML="";
  data.recomendacoes.forEach((r)=>{
    const d=document.createElement("div");
    d.className="rec";
    d.innerHTML=`
      <b>${r.nome}</b>
      <ul>
        <li>${r.por_que}</li>
        <li>${r.quando_usar}</li>
        <li>${r.familia} • ${r.faixa_preco}</li>
      </ul>
    `;
    cards.appendChild(d);
  });
  applyGlow();
}

btn.onclick=()=>{
  const t = contextoMapa? contextoMapa+"\n"+prompt.value:prompt.value;
  chamarIA(t);
  prompt.value="";
};

window.addEventListener("message",e=>{
  if(e.origin!==MAPA_ORIGIN) return;
  if(e.data?.source==="mapa"){
    contextoMapa = e.data.text || "";
    chamarIA(contextoMapa);
  }
});

/* 🟡 AQUI chamamos o warm-up */
window.addEventListener("load", ()=>{
  warmupPerfumista();
  resize();
});
</script>
</body>
</html>
