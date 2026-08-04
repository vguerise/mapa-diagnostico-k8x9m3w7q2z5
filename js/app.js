
// ===================================
// CONFIGURAÇÃO SUPABASE (TRACKING)
// ===================================

const SUPABASE_URL = 'https://frivahuiffxrxzcjrlom.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaXZhaHVpZmZ4cnh6Y2pybG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NzgxMTAsImV4cCI6MjA4MzA1NDExMH0.9cIQs8qhctqZsiNlh4hOVHCjOBMR7UBFpBXiVST6iL4';

// Inicializa Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const trackingEnabled = true;
// Gera ou recupera ID anônimo do usuário
function getAnonymousUserId() {
    let userId = localStorage.getItem('anonymousUserId');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('anonymousUserId', userId);
    }
    return userId;
}

const anonymousUserId = getAnonymousUserId();

// ===================================
// FUNÇÕES DE TRACKING
// ===================================

async function trackEvent(eventType, eventData = {}) {
    if (!trackingEnabled) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('user_events')
            .insert([{
                user_anonymous_id: anonymousUserId,
                event_type: eventType,
                event_data: eventData
            }]);
        
        if (error) {
        } else {
        }
    } catch (err) {
    }
}

async function trackProfile(perfil) {
    if (!trackingEnabled) return;
    
    try {
        // Remove nome antes de salvar (LGPD compliant)
        const { nome, ...perfilSemNome } = perfil;
        
        // Tenta fazer upsert (insert ou update)
        const { data, error } = await supabaseClient
            .from('user_profiles')
            .upsert([{
                user_anonymous_id: anonymousUserId,
                ...perfilSemNome,
                updated_at: new Date().toISOString()
            }], {
                onConflict: 'user_anonymous_id'
            });
        
        if (error) {
        } else {

            trackEvent('perfil_atualizado', { campos: Object.keys(perfilSemNome) });
        }
    } catch (err) {
    }
}

async function trackCollection(colecao, analise) {
    // ⚠️ DESABILITADA - Conflita com novo sistema de sincronização
    // Agora usamos supabase-sync.js para salvar coleções
    return;
    
    /* CÓDIGO ANTIGO COMENTADO
    if (!trackingEnabled) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('user_collections')
            .insert([{
                user_anonymous_id: anonymousUserId,
                perfumes: colecao,
                total_perfumes: colecao.length,
                familias_distribuicao: analise.perfumes_por_familia,
                familia_dominante: analise.familia_dominante.nome
            }]);
        
        if (error) {
        } else {
        }
    } catch (err) {
    }
    */
}

async function trackAnalysis(analiseData, nivel, recomendacoes) {
    if (!trackingEnabled) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('user_analyses')
            .insert([{
                user_anonymous_id: anonymousUserId,
                perfumes_analisados: minhaColecao,
                familias_lacunas: analiseData.top3_faltando || [],
                recomendacoes: recomendacoes || [],
                nivel_usuario: nivel ? nivel.nome : null,
                pontos_gamificacao: nivel ? nivel.pontos : 0
            }]);
        
        if (error) {
        } else {
            trackEvent('analise_completa', {
                total_perfumes: minhaColecao.length,
                nivel: nivel ? nivel.nome : null,
                pontos: nivel ? nivel.pontos : 0
            });
        }
    } catch (err) {
    }
}

// ===================================
// NAVEGAÇÃO ENTRE ABAS
// ===================================

// ===================================
// NAVEGAÇÃO — BOTTOM NAV
// ===================================

function goSection(section) {
    // Atualiza seções
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(section);
    if (el) el.classList.add('active');

    // Atualiza botões bottom nav
    document.querySelectorAll('.bn-item[data-section]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-section') === section);
    });

    // Scroll topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // FAB: visível em todas as abas exceto Perfumista
    const fab = document.getElementById('chat-fab');
    if (fab) fab.style.display = section === 'sugestoes' ? 'none' : 'flex';

    // Hooks por seção
    if (section === 'missao') carregarAnaliseCache();
    if (section === 'desejos') renderWish();
}

// Bind bottom nav buttons — usa window.goSection para pegar versão estendida
document.querySelectorAll('.bn-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => window.goSection(btn.getAttribute('data-section')));
});

// Função para carregar análise em cache ao abrir a aba Missão
function carregarAnaliseCache() {
    const ultimaAnalise = JSON.parse(localStorage.getItem('ultimaAnalise') || '{}');
    const colecaoAtualString = JSON.stringify(minhaColecao.sort());

    if (ultimaAnalise.colecao === colecaoAtualString && ultimaAnalise.dados) {
        window.dadosAnaliseAtual = ultimaAnalise.dados;
        window.missaoAtualIndex = 0;
        renderizarMissaoGameficada(ultimaAnalise.dados);
    }
}

// Redirects legados que usam querySelector direto
function _navTo(section) { goSection(section); }

// ===================================
// WISHLIST — LISTA DE DESEJOS
// ===================================

let wishes = [];
const WISH_KEY = () => 'pm_wishes_' + (localStorage.getItem('userEmail') || 'guest');

function loadWishes() {
    try { wishes = JSON.parse(localStorage.getItem(WISH_KEY()) || '[]'); } catch(_) { wishes = []; }
}
function saveWishes() {
    try { localStorage.setItem(WISH_KEY(), JSON.stringify(wishes)); } catch(_) {}
}

function addWish() {
    const inp = document.getElementById('wish-input');
    const nome = (inp.value || '').trim();
    if (!nome) return;
    if (wishes.some(w => w.nome.toLowerCase() === nome.toLowerCase())) { inp.value = ''; return; }
    wishes.push({ nome, prioridade: null, motivo: null });
    saveWishes();
    inp.value = '';
    renderWish();
    atualizarWishIAWrap();
    if (typeof atualizarChipWishlist === 'function') atualizarChipWishlist();
}

function removeWish(i) {
    wishes.splice(i, 1);
    saveWishes();
    renderWish();
    atualizarWishIAWrap();
    if (typeof atualizarChipWishlist === 'function') atualizarChipWishlist();
}

function atualizarWishIAWrap() {
    const wrap = document.getElementById('wish-ia-wrap');
    if (wrap) wrap.style.display = wishes.length >= 1 ? 'block' : 'none';
}

function renderWish() {
    const list = document.getElementById('wish-list');
    const empty = document.getElementById('wish-empty');
    if (!list) return;
    list.innerHTML = '';

    if (!wishes.length) {
        if (empty) empty.style.display = 'block';
        atualizarWishIAWrap();
        return;
    }
    if (empty) empty.style.display = 'none';
    atualizarWishIAWrap();

    const prioLabel = { top: '🔥 Alta prioridade', medio: '⭐ Médio', baixo: '💤 Baixo' };

    wishes.forEach((w, i) => {
        const item = document.createElement('div');
        item.className = 'wlist-item';

        const num = document.createElement('div');
        num.className = 'wlist-num';
        num.textContent = i + 1;

        const nome = document.createElement('div');
        nome.className = 'wlist-nome';
        nome.textContent = w.nome;

        const rm = document.createElement('button');
        rm.className = 'wlist-rm';
        rm.textContent = '✕';
        rm.addEventListener('click', () => removeWish(i));

        item.appendChild(num);
        item.appendChild(nome);

        if (w.prioridade) {
            const badge = document.createElement('span');
            badge.className = 'wlist-badge ' + w.prioridade;
            badge.textContent = prioLabel[w.prioridade] || w.prioridade;
            item.appendChild(badge);
        } else {
            item.appendChild(document.createElement('span')); // placeholder
        }

        item.appendChild(rm);

        if (w.motivo) {
            const mot = document.createElement('div');
            mot.className = 'wlist-motivo';
            mot.textContent = w.motivo;
            item.appendChild(mot);
        }

        list.appendChild(item);
    });
}

async function priorizarWish() {
    if (!wishes.length) return;
    const btn    = document.getElementById('wish-ia-btn');
    const result = document.getElementById('wish-ia-result');
    btn.disabled    = true;
    btn.textContent = '⏳ Analisando...';
    result.innerHTML = '';

    const perfil       = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
    const nomesColecao = minhaColecao.map(p => typeof p === 'string' ? p : p.nome).join(', ');
    const nomesWish    = wishes.map((w, i) => `${i+1}. ${w.nome}`).join('\n');
    const orcamento    = perfil.orcamento || 'não informado';

    const userMsg =
        `Coleção atual (${minhaColecao.length} perfumes): ${nomesColecao || 'vazia'}.\n` +
        `Orçamento: ${orcamento}.\n\n` +
        `Lista de desejos:\n${nomesWish}\n\n` +
        `Para cada perfume da lista avalie:\n` +
        `"top" = complementa com família/estilo novo\n` +
        `"medio" = interessante mas não urgente\n` +
        `"baixo" = repete estilos já existentes\n\n` +
        `Responda SOMENTE este JSON sem markdown:\n` +
        `{"prioridades":[{"indice":1,"prioridade":"top","motivo":"motivo em 1 frase"}],"resumo":"resumo em 1-2 frases"}`;

    try {
        const categoriaAdj = perfil.categoria === 'feminino' ? 'femininas' : perfil.categoria === 'compartilhavel' ? 'compartilháveis (unissex)' : 'masculinas';
        const res = await fetch('https://operfumista-api.vercel.app/api/perfumista', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            signal:  criarTimeoutSignal(),
            body:    JSON.stringify({
                _proxy:   true,
                system:   `Você é O Perfumista, consultor especialista em fragrâncias ${categoriaAdj}. Responda SOMENTE em JSON válido, sem markdown, sem texto fora do JSON.`,
                messages: [{ role: 'user', content: userMsg }],
                max_tokens: 600
            })
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        // _proxy retorna {text, content:[{type:'text',text:'...'}]}
        const rawText = data.text ||
            (Array.isArray(data.content) ? data.content.map(b => b.text || '').join('') : '') || '{}';
        const clean   = rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
        const match   = clean.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('sem JSON na resposta');
        const parsed  = JSON.parse(match[0]);

        if (parsed.prioridades && parsed.prioridades.length) {
            parsed.prioridades.forEach(p => {
                const idx = p.indice - 1;
                if (wishes[idx]) {
                    wishes[idx].prioridade = p.prioridade;
                    wishes[idx].motivo     = p.motivo;
                }
            });
            const ordem = { top: 0, medio: 1, baixo: 2 };
            wishes.sort((a, b) => (ordem[a.prioridade] ?? 3) - (ordem[b.prioridade] ?? 3));
            saveWishes();
            renderWish();
        }

        if (parsed.resumo) {
            result.innerHTML = `<div class="w-ia-card">${parsed.resumo.replace(/</g,'&lt;').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')}</div>`;
        }
        btn.textContent = '✨ Repriorizar com I.A.';
    } catch(e) {
        result.innerHTML = '<div class="w-ia-card" style="border-color:var(--er);color:var(--er)">Erro ao conectar. Tente novamente.</div>';
        btn.textContent  = '✨ Priorizar com I.A. — qual comprar primeiro?';
    }
    btn.disabled = false;
}

// Carrega wishes ao iniciar
loadWishes();

// ===================================
// PERFIL
// ===================================

function carregarPerfil() {
    const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
    
    if (perfil.nome) document.getElementById('nome').value = perfil.nome;
    document.getElementById('categoria').value = perfil.categoria || 'masculino';
    if (perfil.clima) document.getElementById('clima').value = perfil.clima;
    if (perfil.ambiente) document.getElementById('ambiente').value = perfil.ambiente;
    if (perfil.idade) document.getElementById('idade').value = perfil.idade;
    if (perfil.orcamento) document.getElementById('orcamento').value = perfil.orcamento;
    
    // Carrega email
    const email = localStorage.getItem('userEmail');
    if (email) {
        document.getElementById('email').value = email;
    }
}

function salvarPerfil() {
    const perfil = {
        nome: document.getElementById('nome').value,
        categoria: document.getElementById('categoria').value,
        clima: document.getElementById('clima').value,
        ambiente: document.getElementById('ambiente').value,
        idade: document.getElementById('idade').value,
        orcamento: document.getElementById('orcamento').value
    };
    
    // Salva email separadamente (para rate limiting VIP)
    const email = document.getElementById('email').value.trim();
    if (email) {
        localStorage.setItem('userEmail', email.toLowerCase());
    }
    
    localStorage.setItem('perfilUsuario', JSON.stringify(perfil));
    
    // ☁️ SINCRONIZA PERFIL COM NUVEM
    if (email && window.supabaseSync) {
        const colecao = JSON.parse(localStorage.getItem('minhaColecao') || '[]');
        window.supabaseSync.salvarNaNuvem(email, colecao, perfil);
    }
    
    // 📊 TRACKING: Salva perfil no Supabase (sem nome)
    trackProfile(perfil);
    
    // Atualiza barra de nível com nome
    atualizarNivelDOM();
    
    // Mostra mensagem de sucesso
    const message = document.getElementById('profile-saved-message');
    message.style.display = 'block';
    
    setTimeout(() => {
        message.style.display = 'none';
    }, 3000);
}

// ===================================
// COLEÇÃO
// ===================================

let minhaColecao = JSON.parse(localStorage.getItem('minhaColecao') || '[]');
let radarChart = null;
let radarRenderizando = false;

function adicionarPerfume() {
    const input = document.getElementById('perfume-input');
    const selectConcentracao = document.getElementById('concentracao-select');
    let nome = input.value.trim();
    const concentracao = selectConcentracao.value;
    
    if (!nome) {
        alert('Digite o nome do perfume');
        return;
    }
    
    // Capitaliza primeira letra de cada palavra
    nome = capitalizarPerfume(nome);
    
    // Verifica se perfume já existe COM A MESMA CONCENTRAÇÃO
    const jaExiste = minhaColecao.some(p => {
        const perfumeNome = typeof p === 'string' ? p : p.nome;
        const perfumeConc = typeof p === 'string' ? 'Eau de Parfum' : p.concentracao;
        return perfumeNome === nome && perfumeConc === concentracao;
    });
    
    if (jaExiste) {
        alert(`${nome} (${concentracao}) já está na sua coleção`);
        return;
    }
    
    // Adiciona com concentração
    minhaColecao.push({ nome, concentracao });
    
    // Ordena alfabeticamente pelo nome
    minhaColecao.sort((a, b) => {
        const nomeA = typeof a === 'string' ? a : a.nome;
        const nomeB = typeof b === 'string' ? b : b.nome;
        return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
    });
    
    localStorage.setItem('minhaColecao', JSON.stringify(minhaColecao));
    
    // ☁️ SINCRONIZA COM NUVEM
    const email = localStorage.getItem('userEmail');
    if (email && window.supabaseSync) {
        const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
        window.supabaseSync.salvarNaNuvem(email, minhaColecao, perfil);
    }
    localStorage.removeItem('ultimaColecaoAnalisada');
    localStorage.removeItem('ultimaAnalise');
    
    // 🗑️ Limpa cards gamificados (força aviso de desatualização)
    const container = document.getElementById('analise-gamificada');
    if (container) {
        renderizarAnaliseGameficada(null);  // null = mostra aviso
    }
    
    // 📊 TRACKING: Perfume adicionado
    trackEvent('perfume_adicionado', {
        perfume: nome,
        total_colecao: minhaColecao.length
    });
    
    input.value = '';
    renderizarLista();
    atualizarNivelDOM();  // Agora recalcula com cache limpo
    atualizarMissoesSeExistir(); // ✨ NOVO: Atualiza missões
    atualizarCtaAnalise();       // ✨ CTA análise
    atualizarBuscaVisibilidade(); // ✨ Busca
    document.dispatchEvent(new Event('pm:colecao:mudou'));
    
    // ✨ Adiciona GLOW no botão Analisar
    const btnAnalisar = document.getElementById('btn-analisar');
    if (btnAnalisar && !btnAnalisar.style.animation) {
        btnAnalisar.style.animation = 'missionPulse 1.5s ease-in-out infinite';
    }
}

function capitalizarPerfume(texto) {
    // Palavras que não devem ser capitalizadas (exceto se forem a primeira palavra)
    const excecoes = ['de', 'da', 'do', 'das', 'dos', 'e', 'pour', 'by', 'le', 'la', 'for'];
    
    return texto.toLowerCase()
        .split(' ')
        .map((palavra, index) => {
            // Primeira palavra sempre capitaliza
            if (index === 0) {
                return palavra.charAt(0).toUpperCase() + palavra.slice(1);
            }
            
            // Palavras de exceção não capitalizam (a menos que seja primeira)
            if (excecoes.includes(palavra)) {
                return palavra;
            }
            
            // Resto capitaliza
            return palavra.charAt(0).toUpperCase() + palavra.slice(1);
        })
        .join(' ');
}

function removerPerfume(index) {
    const perfumeRemovido = minhaColecao[index];
    minhaColecao.splice(index, 1);
    localStorage.setItem('minhaColecao', JSON.stringify(minhaColecao));
    
    // ☁️ SINCRONIZA COM NUVEM
    const email = localStorage.getItem('userEmail');
    if (email && window.supabaseSync) {
        const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
        window.supabaseSync.salvarNaNuvem(email, minhaColecao, perfil);
    }
    localStorage.removeItem('ultimaColecaoAnalisada');
    localStorage.removeItem('ultimaAnalise');
    // 🗑️ Limpa cards gamificados
    const container = document.getElementById('analise-gamificada');
    if (container) {
        renderizarAnaliseGameficada(null);
    }
    
    // 📊 TRACKING: Perfume removido
    trackEvent('perfume_removido', {
        perfume: perfumeRemovido,
        total_colecao: minhaColecao.length
    });
    
    renderizarLista();
    atualizarNivelDOM();  // Agora vai recalcular com análise limpa
    atualizarMissoesSeExistir(); // ✨ NOVO: Atualiza missões
    atualizarCtaAnalise();       // ✨ CTA análise
    atualizarBuscaVisibilidade(); // ✨ Busca
    document.dispatchEvent(new Event('pm:colecao:mudou'));
    
    // ✨ Glow no botão Analisar
    const btnAnalisar = document.getElementById('btn-analisar');
    if (btnAnalisar && !btnAnalisar.style.animation) {
        btnAnalisar.style.animation = 'missionPulse 1.5s ease-in-out infinite';
    }
}

function limparColecao() {
    if (confirm('Deseja realmente limpar toda a coleção?')) {
        minhaColecao = [];
        localStorage.setItem('minhaColecao', JSON.stringify(minhaColecao));
        
        // 🔓 INVALIDA análise antiga
        localStorage.removeItem('ultimaColecaoAnalisada');
        localStorage.removeItem('ultimaAnalise');
        // Limpa radar (sem regenerar, pois não há perfumes)
        if (radarChart) {
            radarChart.destroy();
            radarChart = null;
        }
        
        // 🔄 FORÇA atualização IMEDIATA da lista
        const container = document.getElementById('perfume-list');
        const countSpan = document.getElementById('perfume-count');
        if (container) container.innerHTML = '';
        if (countSpan) countSpan.textContent = '0';
        
        // Atualiza tudo
        renderizarLista();
        atualizarRadar();
        atualizarNivelDOM();
        atualizarCtaAnalise();
        atualizarBuscaVisibilidade();
    }
}

function renderizarLista() {
    const container = document.getElementById('perfume-list');
    const countSpan = document.getElementById('perfume-count');
    
    // Atualiza contador
    if (countSpan) {
        countSpan.textContent = minhaColecao.length;
    }
    
    if (minhaColecao.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--tx3); padding: 20px;">Nenhum perfume adicionado ainda</p>';
        return;
    }
    
    container.innerHTML = minhaColecao.map((perfume, index) => {
        // Compatibilidade: suporta tanto string quanto objeto
        const nome = typeof perfume === 'string' ? perfume : perfume.nome;
        const concentracao = typeof perfume === 'string' ? 'Eau de Parfum' : perfume.concentracao;
        
        // Abreviações para display
        const concAbrev = {
            'Eau de Parfum': 'EDP',
            'Eau de Toilette': 'EDT',
            'Eau de Cologne': 'EDC',
            'Parfum': 'Parfum',
            'Elixir': 'Elixir',
            'Extrait': 'Extrait'
        };
        
        const displayConc = concAbrev[concentracao] || concentracao;
        
        return `
            <div class="perfume-item">
                <span class="perfume-name">
                    ${esc(nome)}
                    <span style="
                        color: var(--or); 
                        font-size: 0.8em; 
                        font-weight: 600;
                        background: rgba(232,93,4,.15);
                        padding: 2px 8px;
                        border-radius: 12px;
                        margin-left: 8px;
                    ">${displayConc}</span>
                </span>
                <button class="remove-button" onclick="removerPerfume(${index})">🗑️ Remover</button>
            </div>
        `;
    }).join('');
}

function toggleListaPerfumes() {
    const lista = document.getElementById('perfume-list');
    const icon = document.getElementById('toggle-icon');
    const button = document.getElementById('toggle-list-button');
    const clearContainer = document.getElementById('clear-button-container');
    
    if (lista.style.display === 'none') {
        lista.style.display = 'block';
        if (minhaColecao.length > 0) {
            clearContainer.style.display = 'block';
        }
        icon.textContent = '▲';
        button.style.borderBottomLeftRadius = '0';
        button.style.borderBottomRightRadius = '0';
    } else {
        lista.style.display = 'none';
        clearContainer.style.display = 'none';
        icon.textContent = '▼';
        button.style.borderBottomLeftRadius = '10px';
        button.style.borderBottomRightRadius = '10px';
    }
}

function atualizarRadar() {
    // Função desabilitada - radar só atualiza via API agora
    //
}

// ══════════════════════════════════════════════════════
// NORMALIZAÇÃO DE FAMÍLIAS OLFATIVAS
// ══════════════════════════════════════════════════════

// Nomes canônicos — única fonte de verdade
const FAMILIAS_CANONICAS = {
    'Fresco/Cítrico':       ['fresco','cítrico','citrico','citrus','citrique','fresh','bergamot'],
    'Aromático/Verde':      ['aromát','aromatic','verde','green','lavanda','lavender','fougère','fougere','herbal','ervas'],
    'Doce/Gourmand':        ['doce','gourmand','baunilha','vanilla','caramel','caramelo','mel','honey','açúcar','sugar'],
    'Amadeirado':           ['amadeirado','woody','wood','cedro','cedar','sândalo','sandalwood','vetiver','patchouli'],
    'Especiado/Oriental':   ['especiado','oriental','spicy','spice','canela','cinnamon','cardamom','âmbar','amber','resina','resin'],
    'Aquático/Mineral':     ['aquático','aquatico','aquatic','mineral','marinho','marine','oceânico','oceanic','ozônico','ozone'],
    'Talco/Fougère':        ['talco','talcum','talcado','fougère','fougere','sabonete','soap','íris','iris','powdery'],
    'Floral/Floral Branco': ['floral','flower','rosa','rose','jasmim','jasmine','muguet','lírio','lily','neroli','tuberosa'],
    'Frutado':              ['frutado','fruity','fruit','fruta','abacaxi','pineapple','maçã','apple','pêra','pear','tropical','mango','manga'],
    'Couro':                ['couro','leather','cuir','suede'],
    'Defumado':             ['defumado','smoky','smoke','fumaça','incenso','incense','oud'],
    'Chypre':               ['chypre','chipre','musgo','moss','oakmoss'],
    'Resinoso':             ['resinoso','resin','bálsamo','balsamic','benjoim','benzoin','olíbano','frankincense'],
};

function normalizarFamilia(nome) {
    if (!nome) return nome;
    const lower = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Match EXATO primeiro: evita colisão de palavra-chave entre famílias
    // (ex: "fougere" aparece tanto em Aromático/Verde quanto em Talco/Fougère,
    // e sem checar igualdade exata antes, "Talco/Fougère" virava "Aromático/Verde")
    for (const canonico of Object.keys(FAMILIAS_CANONICAS)) {
        const canonicoNorm = canonico.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (lower === canonicoNorm) return canonico;
    }

    for (const [canonico, keywords] of Object.entries(FAMILIAS_CANONICAS)) {
        for (const kw of keywords) {
            const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (lower.includes(kwNorm)) return canonico;
        }
    }

    // Não reconheceu — retorna o nome original capitalizado
    return nome.trim();
}

// Normaliza um objeto perfumes_por_familia, agrupando variações
function normalizarPfFam(pfFam) {
    const resultado = {};
    for (const [fam, qtd] of Object.entries(pfFam)) {
        const canon = normalizarFamilia(fam);
        resultado[canon] = (resultado[canon] || 0) + qtd;
    }
    return resultado;
}

// Normaliza array de classificacao
function normalizarClassificacao(classificacao) {
    return (classificacao || []).map(item => ({
        ...item,
        familia: normalizarFamilia(item.familia)
    }));
}

// ══════════════════════════════════════════════════════
// ANTI-DUPLICATA: sugestões da IA não podem repetir a coleção
// (o prompt já pede isso, mas a IA às vezes ignora — validamos no código)
// ══════════════════════════════════════════════════════
function normalizarNomePerfume(nome) {
    return (nome || '')
        .toString()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function perfumeJaConhecido(nome) {
    const alvo = normalizarNomePerfume(nome);
    if (!alvo) return false;
    const blacklist = JSON.parse(localStorage.getItem('perfumesBlacklist') || '[]');
    const conhecidos = minhaColecao
        .map(p => typeof p === 'string' ? p : p.nome)
        .concat(blacklist.map(p => typeof p === 'string' ? p : p.nome));
    return conhecidos.some(nomeConhecido => {
        const n = normalizarNomePerfume(nomeConhecido);
        if (!n) return false;
        if (n === alvo) return true;
        // match parcial só para nomes com tamanho razoável (evita falso positivo em tokens curtos)
        if (n.length > 3 && alvo.length > 3 && (n.includes(alvo) || alvo.includes(n))) return true;
        return false;
    });
}

// Remove da lista de recomendações da IA qualquer perfume que já esteja
// na coleção do usuário ou na blacklist
function filtrarRecomendacoesDuplicadas(recomendacoes) {
    if (!Array.isArray(recomendacoes)) return recomendacoes;
    return recomendacoes.filter(rec => !perfumeJaConhecido(rec && rec.nome));
}

// ══════════════════════════════════════════════════════
// SANITIZAÇÃO XSS
// Todo texto vindo da API de IA (ou de campos livres digitados
// pelo usuário) passa por aqui antes de ir pro innerHTML.
// ══════════════════════════════════════════════════════
function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// Cria um AbortSignal que cancela a requisição sozinho depois de `ms`
// milissegundos — sem isso, se a API travar o usuário fica com spinner
// infinito e nenhuma mensagem de erro.
function criarTimeoutSignal(ms = 30000) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
}

// Monta o conteúdo (nome/família/preço/por quê/quando usar) de um card de
// sugestão de perfume vindo da IA — usado nos vários lugares que renderizam
// recomendações, pra não duplicar a mesma escapagem em 5 lugares diferentes.
function renderizarCandidatoHTML(rec, indice) {
    const concTag = rec && rec.concentracao ? ` <span style="color: var(--or);">(${esc(rec.concentracao)})</span>` : '';
    return `<div class="candidate-name">${indice + 1}. ${esc(rec && rec.nome)}${concTag}</div>
            <div class="candidate-family">🌿 ${esc(rec && rec.familia)} • 💰 ${esc(rec && rec.faixa_preco)}</div>
            <div class="candidate-why"><strong>Por quê:</strong> ${esc(rec && rec.por_que)}</div>
            <div class="candidate-when"><strong>Quando usar:</strong> ${esc(rec && rec.quando_usar)}</div>`;
}

// ══════════════════════════════════════════════════════
// PERSISTÊNCIA DE FAMÍLIA POR PERFUME
// Bug fix: a família de um perfume não pode mudar sozinha a cada nova
// análise — uma vez classificado, o resultado fica fixo localmente e só
// perfumes novos (ainda sem família salva) são reclassificados pela IA.
// ══════════════════════════════════════════════════════
const FAMILIAS_NOVE = ['Fresco/Cítrico','Aromático/Verde','Doce/Gourmand','Amadeirado','Especiado/Oriental','Aquático/Mineral','Talco/Fougère','Floral/Floral Branco','Frutado'];

function chavePerfume(nome) {
    return normalizarNomePerfume(nome);
}

function getFamiliasPersistidas() {
    try {
        return JSON.parse(localStorage.getItem('familiaPorPerfume') || '{}');
    } catch (_) {
        return {};
    }
}

function salvarFamiliasPersistidas(mapa) {
    localStorage.setItem('familiaPorPerfume', JSON.stringify(mapa));
}

// Faz a família que a IA devolveu bater com um dos 9 nomes canônicos
// (tolera diferença de maiúscula/acento), sem usar normalizarFamilia()
// porque aquela função foi feita para outro conjunto (13 famílias) e
// tem colisão de palavra-chave entre "Fougère" e "Aromático/Verde".
function canonizarFamiliaClassificacao(nomeFamilia) {
    if (!nomeFamilia) return null;
    const alvo = nomeFamilia.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const match = FAMILIAS_NOVE.find(f => f.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === alvo);
    return match || nomeFamilia.trim();
}

// Recalcula perfumes_por_familia, familia_dominante e top3_faltando
// LOCALMENTE a partir do mapa persistido — nunca confia cegamente na
// contagem agregada que a IA devolve a cada chamada, porque essa
// contagem pode variar entre uma análise e outra (não-determinismo do modelo).
function recalcularAnaliseColecao(analiseColecao) {
    const persistidas = getFamiliasPersistidas();
    const contagem = {};
    minhaColecao.forEach(p => {
        const nome = typeof p === 'string' ? p : p.nome;
        const familia = persistidas[chavePerfume(nome)];
        if (familia) contagem[familia] = (contagem[familia] || 0) + 1;
    });

    let dominante = null, maxQtd = 0;
    Object.entries(contagem).forEach(([fam, qtd]) => {
        if (qtd > maxQtd) { maxQtd = qtd; dominante = fam; }
    });

    const naoClassificados = minhaColecao
        .map(p => typeof p === 'string' ? p : p.nome)
        .filter(nome => !persistidas[chavePerfume(nome)]);

    const top3Faltando = FAMILIAS_NOVE
        .map(fam => ({ fam, qtd: contagem[fam] || 0 }))
        .sort((a, b) => a.qtd - b.qtd)
        .slice(0, 3)
        .map(x => x.fam);

    return {
        ...analiseColecao,
        perfumes_por_familia: contagem,
        familia_dominante: dominante || (analiseColecao && analiseColecao.familia_dominante) || null,
        top3_faltando: top3Faltando,
        nao_classificados: naoClassificados
    };
}

function atualizarRadarComAPI(analiseAPI) {
    // Se não recebeu parâmetro, tenta carregar do localStorage
    if (!analiseAPI) {
        const ultimaAnalise = JSON.parse(localStorage.getItem('ultimaAnalise') || '{}');
        if (ultimaAnalise.dados && ultimaAnalise.dados.analise_colecao) {
            analiseAPI = ultimaAnalise.dados.analise_colecao;
        } else return;
    }

    if (!analiseAPI || !analiseAPI.perfumes_por_familia) return;

    const pfFam = normalizarPfFam(analiseAPI.perfumes_por_familia);

    // ── EMOJIS para famílias conhecidas + fallback ──
    const EMOJI_MAP = {
        'Fresco/Cítrico':      '🍋',
        'Aromático/Verde':     '🌳',
        'Doce/Gourmand':       '🍯',
        'Amadeirado':          '🪵',
        'Especiado/Oriental':  '🌶️',
        'Aquático/Mineral':    '💧',
        'Aquático':            '💧',
        'Talco/Fougère':       '🧼',
        'Floral/Floral Branco':'🌸',
        'Floral':              '🌸',
        'Frutado':             '🍇',
        'Tropical':            '🌴',
        'Couro':               '🤎',
        'Resinoso':            '🌿',
        'Defumado':            '🔥',
        'Chypre':              '🌺',
        'Gourmand':            '🍰',
        'Verde':               '🌱',
        'Cítrico':             '🍊',
    };

    // ── Usa APENAS famílias com perfumes (dinâmico) ──
    const familiasAtivas = Object.entries(pfFam)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);  // ordena por quantidade desc

    const labels = familiasAtivas.map(([k]) => {
        const emoji = EMOJI_MAP[k] || '🔹';
        // Encurta nome para caber no radar
        const nome = k.replace('/Floral Branco','').replace('/Verde','').replace('/Cítrico','')
                      .replace('/Mineral','').replace('/Oriental','').replace('/Fougère','');
        return `${emoji} ${nome}`;
    });
    const valores = familiasAtivas.map(([, v]) => v);

    // Tenta renderizar radar
    renderizarRadarChart(labels, valores, analiseAPI);

    // Fallback barras CSS após 5s
    setTimeout(() => {
        const canvas = document.getElementById('radarChart');
        if (!canvas || !radarChart) renderizarRadarAlternativo(analiseAPI);
    }, 5000);

    // Renderiza cards de análise
    renderizarAnaliseGameficada(analiseAPI);
}

function renderizarRadarAlternativo(analiseAPI, skipGameficada = false) {
    const radarContainer = document.querySelector('.radar-container');
    if (!radarContainer) return;
    

    
    const familias = analiseAPI.perfumes_por_familia;
    const total = Object.values(familias).reduce((a, b) => a + b, 0);
    
    const emojis = {
        'Fresco/Cítrico': '🍋',
        'Aromático/Verde': '🌳',
        'Doce/Gourmand': '🍯',
        'Amadeirado': '🪵',
        'Especiado/Oriental': '🌶️',
        'Aquático': '💧',
        'Talco/Fougère': '🧼',
        'Floral/Floral Branco': '🌸',
        'Floral': '🌸', // Retrocompatibilidade
        'Frutado': '🍇'
    };
    
    const cores = {
        'Fresco/Cítrico': '#4CAF50',
        'Aromático/Verde': '#2196F3',
        'Doce/Gourmand': '#FF9800',
        'Amadeirado': '#795548',
        'Especiado/Oriental': '#E91E63',
        'Aquático/Mineral': '#00BCD4',
        'Aquático': '#00BCD4', // Retrocompatibilidade
        'Talco/Fougère': '#9C27B0',
        'Floral/Floral Branco': '#F06292',
        'Floral': '#F06292', // Retrocompatibilidade
        'Frutado': '#9C27B0'
    };
    
    let html = `
        <div style="padding: 30px 20px;">
            <h3 style="
                color: var(--or); 
                text-align: center; 
                margin-bottom: 25px;
                font-size: 1.3em;
                font-weight: 600;
            ">
                📊 Distribuição da Coleção
            </h3>
    `;
    
    // Ordena famílias por quantidade (maior primeiro)
    const familiasOrdenadas = Object.entries(familias)
        .sort(([, a], [, b]) => b - a);
    
    familiasOrdenadas.forEach(([familia, quantidade]) => {
        const porcentagem = total > 0 ? Math.round((quantidade / total) * 100) : 0;
        const emoji = emojis[familia] || '🎯';
        const cor = cores[familia] || 'var(--or)';
        
        html += `
            <div style="margin-bottom: 18px;">
                <div style="
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center;
                    margin-bottom: 6px;
                ">
                    <span style="
                        color: #ddd;
                        font-size: 0.95em;
                        font-weight: 500;
                    ">
                        ${emoji} ${familia}
                    </span>
                    <span style="
                        color: ${quantidade > 0 ? cor : '#666'};
                        font-weight: 600;
                        font-size: 0.9em;
                    ">
                        ${quantidade} ${quantidade === 1 ? 'perfume' : 'perfumes'}
                    </span>
                </div>
                <div style="
                    width: 100%;
                    height: 10px;
                    background: var(--s1);
                    border-radius: 10px;
                    overflow: hidden;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                ">
                    <div style="
                        width: ${porcentagem}%;
                        height: 100%;
                        background: linear-gradient(90deg, ${cor}, ${cor}dd);
                        border-radius: 10px;
                        transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: ${quantidade > 0 ? `0 0 10px ${cor}44` : 'none'};
                    "></div>
                </div>
            </div>
        `;
    });
    
    html += `
        </div>
    `;
    
    radarContainer.innerHTML = html;

    // Garante que os cards de análise e accordion também renderizam
    if (!skipGameficada) renderizarAnaliseGameficada(analiseAPI);
}
function renderizarAnaliseGameficada(analise) {
    const container = document.getElementById('analise-gamificada');
    if (!container) return;
    
    if (!analise || !analise.perfumes_por_familia) {
        container.innerHTML = `
            <div style="
                text-align: center;
                padding: 40px;
                color: var(--tx3);
                background: rgba(255, 152, 0, 0.1);
                border: 2px solid #ff9800;
                border-radius: 15px;
            ">
                <div style="font-size: 2em; margin-bottom: 10px;">⚠️</div>
                <div style="font-size: 1.2em; margin-bottom: 10px;">Análise desatualizada</div>
                <div style="font-size: 0.9em;">
                    Clique no botão <strong style="color: var(--or);">Analisar</strong> (que está piscando) para atualizar os cards
                </div>
            </div>
        `;
        return;
    }
    
    const nivel = analise.nivel || {};
    const equilibrio = analise.equilibrio || {};
    
    let dominante = analise.familia_dominante || {};
    if (typeof dominante === 'string') {
        const familias = analise.perfumes_por_familia || {};
        const total = Object.values(familias).reduce((a, b) => a + b, 0);
        const quantidade = familias[dominante] || 0;
        const porcentagem = total > 0 ? Math.round((quantidade / total) * 100) : 0;
        dominante = { nome: dominante, quantidade, porcentagem };
    }
    if (!dominante.nome || dominante.porcentagem === 0) {
        dominante = { nome: 'Equilibrado', porcentagem: 0 };
    }
    
    const top3_faltando = analise.top3_faltando || [];
    
    const html = `
        <div style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        ">
            <div style="
                background: linear-gradient(135deg, rgba(232,93,4,.15), rgba(232,93,4,.05));
                border: 2px solid ${nivel.emoji === '🎯' ? '#4caf50' : nivel.emoji === '⚠️' ? '#ff9800' : 'var(--or)'};
                border-radius: 15px;
                padding: 25px;
                min-height: 200px;
                display: flex;
                flex-direction: column;
                justify-content: center;
            ">
                <div style="text-align: center; margin-bottom: 15px;">
                    <div style="font-size: 3em;">${nivel.emoji || '🎯'}</div>
                    <div style="font-size: 1.5em; font-weight: 700; color: var(--or); margin-top: 10px;">
                        ${nivel.titulo || 'INICIANTE'}
                    </div>
                </div>
                <div style="color: var(--tx2); text-align: center; line-height: 1.6; font-size: 0.95em;">
                    ${nivel.descricao || 'Continue adicionando perfumes à sua coleção!'}
                </div>
            </div>
            
            <div style="
                background: linear-gradient(135deg, ${
                    equilibrio.status === 'equilibrada' ? 'rgba(76, 175, 80, 0.15)' :
                    equilibrio.status === 'leve_desequilibrio' ? 'rgba(255, 152, 0, 0.15)' :
                    'rgba(255, 68, 68, 0.15)'
                }, rgba(0, 0, 0, 0.1));
                border: 2px solid ${
                    equilibrio.status === 'equilibrada' ? '#4caf50' :
                    equilibrio.status === 'leve_desequilibrio' ? '#ff9800' :
                    '#ff4444'
                };
                border-radius: 15px;
                padding: 25px;
                min-height: 200px;
                display: flex;
                flex-direction: column;
                justify-content: center;
            ">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div style="font-size: 2.5em;">${equilibrio.emoji || '✅'}</div>
                    <div style="flex: 1;">
                        <div style="font-size: 1.2em; font-weight: 700; color: var(--or);">
                            ${equilibrio.status === 'equilibrada' ? '✅ Equilibrada' :
                              equilibrio.status === 'leve_desequilibrio' ? '⚠️ Leve Desequilíbrio' :
                              '🚨 Desbalanceada'}
                        </div>
                        <div style="color: var(--tx3); font-size: 0.85em; margin-top: 5px;">
                            ${dominante.porcentagem > 0
                                ? `${dominante.nome} (${dominante.porcentagem}%)`
                                : 'Equilibrado'}
                        </div>
                    </div>
                </div>
                <div style="color: var(--tx2); line-height: 1.5; font-size: 0.9em;">
                    ${equilibrio.mensagem || 'Continue diversificando!'}
                </div>
            </div>
            
            ${top3_faltando.length > 0 ? `
            <div style="
                background: linear-gradient(135deg, rgba(100, 181, 246, 0.15), rgba(100, 181, 246, 0.05));
                border: 2px solid #64b5f6;
                border-radius: 15px;
                padding: 25px;
                min-height: 200px;
                display: flex;
                flex-direction: column;
            ">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div style="font-size: 2.5em;">🎯</div>
                    <div style="font-size: 1.3em; font-weight: 700; color: #64b5f6;">Próximas Metas</div>
                </div>
                <div style="color: var(--tx2); font-size: 0.95em; margin-bottom: 12px;">
                    Expanda sua coleção nestas famílias:
                </div>
                <div style="color: var(--or); line-height: 2;">
                    ${top3_faltando.slice(0, 3).map((f, i) =>
                        `<div style="font-weight: 600;">${i + 1}. ${f}</div>`
                    ).join('')}
                </div>
            </div>
            ` : ''}
            
            <div style="
                background: linear-gradient(135deg, var(--orm), rgba(232,93,4,.05));
                border: 2px solid var(--or);
                border-radius: 15px;
                padding: 25px;
                min-height: 200px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
            ">
                <div style="color: var(--tx3); font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                    Total na Coleção
                </div>
                <div style="color: var(--or); font-size: 3em; font-weight: 700; text-shadow: 0 0 20px var(--org);">
                    ${minhaColecao.length}
                </div>
                <div style="color: var(--or); font-size: 1em; margin-top: 5px;">
                    ${minhaColecao.length === 1 ? 'perfume' : 'perfumes'}
                </div>
            </div>
        </div>

        <!-- ── Accordion: Famílias da coleção ── -->
        ${(() => {
            const pfFam = normalizarPfFam(analise.perfumes_por_familia || {});
            let classificacao = normalizarClassificacao(analise.classificacao || []);

            // Fallback: se API não retornou classificacao, distribui perfumes pelas famílias
            if (!classificacao.length && Object.keys(pfFam).length) {
                const famList = Object.entries(pfFam)
                    .filter(([, v]) => v > 0)
                    .sort((a, b) => b[1] - a[1]);
                const perfumes = minhaColecao.map(p => typeof p === 'string' ? p : p.nome);
                let pi = 0;
                famList.forEach(([fam, qtd]) => {
                    for (let i = 0; i < qtd && pi < perfumes.length; i++, pi++) {
                        classificacao.push({ nome: perfumes[pi], familia: fam });
                    }
                });
            }

            const EMOJI = {
                'Fresco/Cítrico':'🍋','Aromático/Verde':'🌳','Doce/Gourmand':'🍯',
                'Amadeirado':'🪵','Especiado/Oriental':'🌶️','Aquático/Mineral':'💧',
                'Aquático':'💧','Talco/Fougère':'🧼','Floral/Floral Branco':'🌸',
                'Floral':'🌸','Frutado':'🍇','Tropical':'🌴','Couro':'🤎',
                'Resinoso':'🌿','Defumado':'🔥','Chypre':'🌺',
            };

            const famPerfumes = {};
            classificacao.forEach(item => {
                if (!famPerfumes[item.familia]) famPerfumes[item.familia] = [];
                famPerfumes[item.familia].push(item.nome);
            });

            const familias = Object.entries(pfFam)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1]);

            if (!familias.length) return '';

            const items = familias.map(([fam, qtd]) => {
                const emoji = EMOJI[fam] || '🔹';
                const perfumes = famPerfumes[fam] || [];
                const listaHtml = perfumes.length
                    ? perfumes.map(p => `<li style="padding:.3rem 0;border-bottom:1px solid var(--bd);color:var(--tx2);font-size:.85rem;">${p}</li>`).join('')
                    : `<li style="color:var(--tx3);font-size:.82rem;padding:.3rem 0">Perfumes não identificados individualmente</li>`;

                return `
                <details style="border-radius:10px;overflow:hidden;background:var(--s2);border:1px solid var(--bd);">
                    <summary style="
                        display:flex;align-items:center;gap:.75rem;
                        padding:.85rem 1rem;cursor:pointer;list-style:none;
                        font-weight:700;font-size:.9rem;color:var(--tx);
                        user-select:none;
                    ">
                        <span style="font-size:1.2rem">${emoji}</span>
                        <span style="flex:1">${fam}</span>
                        <span style="
                            background:var(--or);color:#fff;
                            border-radius:20px;padding:.15rem .6rem;
                            font-size:.75rem;font-weight:700;
                        ">${qtd}</span>
                        <span style="color:var(--tx3);font-size:.7rem;margin-left:.25rem">▼</span>
                    </summary>
                    <ul style="margin:0;padding:.25rem 1rem .75rem 2.8rem;list-style:disc;">
                        ${listaHtml}
                    </ul>
                </details>`;
            }).join('');

            return `
            <div style="margin-top:1.5rem">
                <div style="font-weight:700;color:var(--or);font-size:.85rem;text-transform:uppercase;letter-spacing:.5px;margin-bottom:.75rem;">
                    🗂️ Sua Coleção por Família
                </div>
                <div style="display:flex;flex-direction:column;gap:.5rem;">
                    ${items}
                </div>
            </div>`;
        })()}
    `;
    
    container.innerHTML = html;
}
function renderizarRadarChart(familias, valores, analise, tentativa = 0) {
    if (radarRenderizando) return;

    const ctx = document.getElementById('radarChart');

    if (!ctx) {
        if (tentativa >= 3) return;
        goSection('colecao');
        setTimeout(() => renderizarRadarChart(familias, valores, analise, tentativa + 1), 1500);
        return;
    }

    const isVisible = ctx.offsetParent !== null;
    if (!isVisible && tentativa < 3) {
        setTimeout(() => renderizarRadarChart(familias, valores, analise, tentativa + 1), 1500);
        return;
    }

    radarRenderizando = true;

    if (radarChart) radarChart.destroy();

    setTimeout(() => {
        try {
            radarChart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: familias,
                    datasets: [{
                        label: 'Sua Coleção',
                        data: valores,
                        fill: true,
                        backgroundColor: 'var(--orm)',
                        borderColor: 'var(--or)',
                        pointBackgroundColor: 'var(--or)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'var(--or)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    scales: {
                        r: {
                            beginAtZero: true,
                            ticks: { stepSize: 1, color: '#999' },
                            grid: { color: 'var(--orm)' },
                            pointLabels: {
                                color: 'var(--or)',
                                font: { size: 12, weight: '600' }
                            }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        } catch (e) {
            // silencioso — fallback já foi renderizado
        } finally {
            radarRenderizando = false;
        }
    }, 1500);
}

// Função atualizarColecao removida - agora usamos apenas analisarColecao

// ===================================
// 🎯 SISTEMA LOCALSTORAGE-FIRST
// ===================================

/**
 * Função central que renderiza TUDO a partir do localStorage
 * Chamada em:
 * - Inicialização do app
 * - Após análise da API
 * - Ao mudar de aba
 */
function renderizarTudoDoLocalStorage() {

    
    const ultimaAnalise = JSON.parse(localStorage.getItem('ultimaAnalise') || '{}');
    
    if (!ultimaAnalise.dados) {
        // Limpa tudo
        const container = document.getElementById('analise-gamificada');
        if (container) {
            renderizarAnaliseGameficada(null);
        }
        
        return;
    }
    
    const dados = ultimaAnalise.dados;
    // 1. RADAR - Usa visualização ALTERNATIVA (barras CSS)
    if (dados.analise_colecao) {

        renderizarRadarAlternativo(dados.analise_colecao, true);
    }
    
    // 2. CARDS GAMIFICADOS
    if (dados.analise_colecao) {
        renderizarAnaliseGameficada(dados.analise_colecao);
    }
    
    // 3. MISSÃO + SUGESTÕES
    window.dadosAnaliseAtual = dados;
    renderizarMissaoGameficada(dados);
    
    // 4. RANKING/PONTOS
    atualizarNivelDOM();
}

// ===================================
// GUIA DE FAMÍLIAS OLFATIVAS POR CATEGORIA
// ===================================

function construirGuiaFamilias(categoria) {
    if (categoria === 'feminino') {
        return `Use seu conhecimento sobre perfumes femininos e os acordes principais de cada fragrância.

**FAMÍLIAS OLFATIVAS (escolha APENAS UMA por perfume):**

1. **Fresco/Cítrico**: Perfumes leves, cítricos, aquosos
   - Exemplos: Chanel Chance Eau Fraîche, Dolce & Gabbana Light Blue
   - Acordes: citrus, bergamot, lemon, aquatic, marine

2. **Aromático/Verde**: Perfumes frescos com ervas, chá verde, folhas
   - Exemplos: Chanel No. 19, Chanel Cristalle
   - Acordes: aromatic, green, herbal, galbanum

3. **Doce/Gourmand**: Perfumes doces, com baunilha, caramelo, praliné
   - Exemplos: Lancôme La Vie Est Belle, YSL Black Opium, Viktor & Rolf Flowerbomb
   - Acordes: sweet, vanilla, caramel, gourmand, praline

4. **Amadeirado**: Perfumes com madeiras e chypre (sândalo, patchouli, cedro)
   - Exemplos: Chanel Coco Mademoiselle, Narciso Rodriguez For Her, Chanel Bois des Îles
   - Acordes: woody, patchouli, sandalwood, chypre

5. **Especiado/Oriental**: Perfumes com especiarias fortes, âmbar, resinas
   - Exemplos: YSL Opium, Guerlain Shalimar, Thierry Mugler Alien
   - Acordes: spicy, oriental, amber, incense, cinnamon

6. **Aquático/Mineral**: Perfumes marinhos, ozônicos, minerais
   - Exemplos: Issey Miyake L'Eau d'Issey, Davidoff Cool Water Woman, Bvlgari Aqua Divina
   - Acordes: aquatic, marine, ozonic, mineral

7. **Talco/Fougère**: Perfumes com íris, talco, pó de arroz
   - Exemplos: Prada Infusion d'Iris, Guerlain L'Heure Bleue, Guerlain Après l'Ondée
   - Acordes: powdery, iris, musky clean

8. **Floral/Floral Branco**: Perfumes com flores (rosa, jasmim, tuberosa, lírio)
   - FLORAL: Rosa, gerânio, violeta, aldeídos (Chanel No. 5, Dior J'adore)
   - FLORAL BRANCO: Jasmim, tuberosa, lírio (Gucci Bloom, Chanel Gardénia)
   - Acordes: floral, white floral, jasmine, tuberose

9. **Frutado**: Perfumes com frutas (maçã, pêssego, frutas vermelhas)
   - Exemplos: DKNY Be Delicious (maçã), Nina Ricci Nina (maçã), Marc Jacobs Daisy (morango)
   - Acordes: fruity, apple, peach, berries

**INSTRUÇÕES DE CLASSIFICAÇÃO:**
- Use o acorde DOMINANTE do perfume
- Se tiver dúvida entre 2, escolha a mais característica
- NUNCA invente - use conhecimento real
- Se não conhecer um perfume, classifique baseado em perfumes similares da mesma linha/marca

**EXEMPLOS DE CLASSIFICAÇÃO CORRETA:**
- Chanel Coco Mademoiselle → Amadeirado (patchouli/âmbar dominante, apesar da laranja na abertura)
- YSL Black Opium → Doce/Gourmand (café/baunilha dominante)
- Chanel No. 5 → Floral (aldeídico-floral clássico)
- Gucci Bloom → Floral/Floral Branco (jasmim/tuberosa dominante)
- Guerlain Shalimar → Especiado/Oriental (âmbar/baunilha oriental)`;
    }

    if (categoria === 'compartilhavel') {
        return `Use seu conhecimento sobre perfumes compartilháveis/unissex e os acordes principais de cada fragrância.

**FAMÍLIAS OLFATIVAS (escolha APENAS UMA por perfume):**

1. **Fresco/Cítrico**: Perfumes leves, cítricos, aquosos
   - Exemplos: CK One, Hermès Eau d'Orange Verte, Acqua di Parma Colonia
   - Acordes: citrus, bergamot, lemon, aquatic, marine

2. **Aromático/Verde**: Perfumes frescos com ervas, folhas, figueira
   - Exemplos: Diptyque Philosykos, Aesop Tacit
   - Acordes: aromatic, green, herbal, fig

3. **Doce/Gourmand**: Perfumes doces, com baunilha, castanha, fumaça doce
   - Exemplos: Maison Margiela REPLICA By the Fireplace, Kayali Vanilla 28
   - Acordes: sweet, vanilla, chestnut, gourmand

4. **Amadeirado**: Perfumes com madeiras (sândalo, cedro, âmbar-madeira)
   - Exemplos: Le Labo Santal 33, Tom Ford Oud Wood, Byredo Gypsy Water
   - Acordes: woody, sandalwood, cedar, amber wood

5. **Especiado/Oriental**: Perfumes com especiarias fortes, âmbar, resinas
   - Exemplos: Le Labo Another 13, Kilian Black Phantom
   - Acordes: spicy, oriental, amber, incense

6. **Aquático/Mineral**: Perfumes marinhos, ozônicos, minerais
   - Exemplos: CK One, Comme des Garçons Concrete
   - Acordes: aquatic, marine, ozonic, mineral, metallic

7. **Talco/Fougère**: Perfumes com almíscar limpo, talco, sabonete
   - Exemplos: Maison Margiela REPLICA Lazy Sunday Morning, Byredo Blanche Absolu
   - Acordes: powdery, musky, clean, soapy

8. **Floral/Floral Branco**: Perfumes com flores (rosa, jasmim, tuberosa, lírio)
   - Exemplos: Le Labo Rose 31, Byredo Flowerhead
   - Acordes: floral, white floral, jasmine, rose

9. **Frutado**: Perfumes com frutas (frutas vermelhas, pera)
   - Exemplos: Jo Malone Blackberry & Bay Cologne, Byredo Bal d'Afrique
   - Acordes: fruity, berries, pear

**INSTRUÇÕES DE CLASSIFICAÇÃO:**
- Use o acorde DOMINANTE do perfume
- Se tiver dúvida entre 2, escolha a mais característica
- NUNCA invente - use conhecimento real
- Se não conhecer um perfume, classifique baseado em perfumes similares da mesma linha/marca

**EXEMPLOS DE CLASSIFICAÇÃO CORRETA:**
- Le Labo Santal 33 → Amadeirado (sândalo/couro dominante)
- CK One → Fresco/Cítrico (cítrico dominante)
- Maison Margiela REPLICA By the Fireplace → Doce/Gourmand (castanha/baunilha dominante)
- Diptyque Philosykos → Aromático/Verde (figueira/folhas dominante)`;
    }

    // masculino (padrão)
    return `Use seu conhecimento sobre perfumes masculinos e os acordes principais de cada fragrância.

**FAMÍLIAS OLFATIVAS (escolha APENAS UMA por perfume):**

1. **Fresco/Cítrico**: Perfumes leves, cítricos, aquosos
   - Exemplos: Acqua di Gio, Dolce & Gabbana Light Blue, Versace Man Eau Fraiche
   - Acordes: citrus, bergamot, lemon, aquatic, marine

2. **Aromático/Verde**: Perfumes frescos com ervas, lavanda, especiarias leves
   - Exemplos: Dior Sauvage, Bleu de Chanel, Paco Rabanne Invictus
   - Acordes: aromatic, fresh spicy, lavender, herbal, green

3. **Doce/Gourmand**: Perfumes doces, com baunilha, caramelo, açúcar
   - Exemplos: Paco Rabanne 1 Million, JPG Le Male, Viktor & Rolf Spicebomb
   - Acordes: sweet, vanilla, caramel, gourmand, tonka

4. **Amadeirado**: Perfumes com madeiras (cedro, sândalo, patchouli)
   - Exemplos: Dior Homme Intense, Tom Ford Oud Wood, Creed Aventus (base)
   - Acordes: woody, cedar, sandalwood, patchouli, vetiver

5. **Especiado/Oriental**: Perfumes com especiarias fortes, âmbar, resinas
   - Exemplos: YSL La Nuit de L'Homme, Givenchy Gentleman, Dior Fahrenheit
   - Acordes: spicy, oriental, amber, incense, cinnamon

6. **Aquático/Mineral**: Perfumes marinhos, ozônicos, minerais
   - AQUÁTICO: Notas marinhas, sal, brisa do mar (Davidoff Cool Water, Nautica Voyage)
   - MINERAL: Pedra molhada, concreto, ozônio mineral (Lalique Encre Noire Sport, Comme des Garçons)
   - Acordes: aquatic, marine, ozonic, mineral, metallic

7. **Talco/Fougère**: Perfumes clássicos com lavanda, cumarina, talco, íris talcada
   - Exemplos: Paco Rabanne Pour Homme, Prada L'Homme, Dior Homme
   - Acordes: powdery, lavender, fougere, coumarin, iris

8. **Floral/Floral Branco**: Perfumes com flores (raro em masculinos)
   - FLORAL: Rosa, gerânio, violeta
   - FLORAL BRANCO: Jasmim, muguet, lírio, neroli (Tom Ford Neroli Portofino)
   - Acordes: floral, white floral, jasmine, lily, neroli

9. **Frutado**: Perfumes com frutas (abacaxi, maçã, pêra)
   - Exemplos: Creed Aventus, Versace Eros, Carolina Herrera Bad Boy
   - Acordes: fruity, pineapple, apple, blackcurrant

**INSTRUÇÕES DE CLASSIFICAÇÃO:**
- Use o acorde DOMINANTE do perfume
- Se tiver dúvida entre 2, escolha a mais característica
- NUNCA invente - use conhecimento real
- Se não conhecer um perfume, classifique baseado em perfumes similares da mesma linha/marca

**EXEMPLOS DE CLASSIFICAÇÃO CORRETA:**
- Dior Sauvage → Aromático/Verde (fresh spicy dominante)
- Paco Rabanne 1 Million → Doce/Gourmand (sweet/cinnamon)
- Acqua di Gio → Fresco/Cítrico (citrus/marine)
- Creed Aventus → Frutado (pineapple dominante, apesar da base amadeirada)
- Tom Ford Oud Wood → Amadeirado (oud/woody)`;
}

// Faixas de preço por orçamento — fonte única usada em todos os prompts que
// pedem sugestão de compra. Antes disso, essas 4 linhas estavam coladas (e
// levemente divergentes) em 6 funções diferentes; mudar um preço exigia
// lembrar de editar todas.
function construirFaixaOrcamento() {
    return `- Se orçamento é "R$ 300-500" → Sugira perfumes de R$ 250-600, PRIORIZANDO R$ 300-500 (toda a faixa média)
- Se orçamento é "R$ 500-800" → Sugira perfumes de R$ 400-900, PRIORIZANDO R$ 700-900 (topo)
- Se orçamento é "R$ 800-1500" → Sugira perfumes de R$ 700-1700, PRIORIZANDO R$ 1200-1700 (topo)
- Se orçamento é "Acima de R$ 1500" → Sugira perfumes premium acima de R$ 1500`;
}

// ===================================
// MISSÃO (ANÁLISE)
// ===================================

async function analisarColecao() {

    
    // ✨ PARA animação do botão
    const btnAnalisar = document.getElementById('btn-analisar');
    if (btnAnalisar) {
        btnAnalisar.style.animation = '';
        btnAnalisar.style.background = '';
        btnAnalisar.style.boxShadow = '';
    }
    
    if (minhaColecao.length === 0) {
        alert('Adicione perfumes à sua coleção primeiro!');
        return;
    }
    
    // 🔒 VERIFICA SE É ASSINANTE (via Supabase)
    const isAssinante = await verificarAssinatura();
    if (!isAssinante) {
        mostrarModalAssinatura();
        return;
    }
    
    // 🔒 RATE LIMITING: Verifica limites
    if (window.rateLimiter) {
        const checkLimite = window.rateLimiter.podeExecutar('analise');
        if (!checkLimite.pode) {
            mostrarPopupLimite('analise', checkLimite.total, checkLimite.proximoReset);
            return;
        }
    }

    // 🗑️ LIMPA CACHE ao clicar em Analisar (força nova análise)
    const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
    
    // Verifica cache
    const ultimaAnalise = JSON.parse(localStorage.getItem('ultimaAnalise') || '{}');
    const colecaoAtualString = JSON.stringify(minhaColecao.sort());
    const perfilAtualString = JSON.stringify(perfil);
    
    // Usa cache APENAS se coleção E perfil não mudaram
    if (ultimaAnalise.colecao === colecaoAtualString && 
        ultimaAnalise.perfil === perfilAtualString && 
        ultimaAnalise.dados) {

        
        // Atualiza radar
        atualizarRadarComAPI(ultimaAnalise.dados.analise_colecao);
        
        // Renderiza missão (mas NÃO muda aba)
        const resultContainer = document.getElementById('result-container');
        renderizarMissaoGameficada(ultimaAnalise.dados);
        
        // Adiciona glow na aba Missão
        adicionarGlowMissao();
        
        // Toast
        mostrarToast('✅ Análise carregada!', 'Vá na aba Missão para ver suas sugestões', 'success');
        return;
    }
    
    if (ultimaAnalise.perfil !== perfilAtualString) {
    }
    // Mostra loading NO RADAR (não modal que bloqueia tudo)
    const radarContainer = document.querySelector('.radar-container');
    const radarBackup = radarContainer.innerHTML;
    radarContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px;">
            <div class="analyzing-spinner"></div>
            <div style="color: var(--or); font-weight: 600; margin-top: 20px; font-size: 1.1em;">
                Analisando coleção...
            </div>
            <div style="color: var(--tx3); font-size: 0.9em; margin-top: 8px;">
                Classificando via Fragantica
            </div>
        </div>
    `;
    
    // Mostra loading na aba Missão também
    const resultContainer = document.getElementById('result-container');
    resultContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px;">
            <div class="analyzing-spinner"></div>
            <div style="color: var(--or); font-weight: 600; margin-top: 20px; font-size: 1.3em;">
                Gerando sua missão...
            </div>
            <div style="color: var(--tx3); font-size: 1em; margin-top: 8px;">
                Analisando perfumes e criando sugestões personalizadas
            </div>
        </div>
    `;
    
    try {
        const blacklist = JSON.parse(localStorage.getItem('perfumesBlacklist') || '[]');
        const naoSugerir = minhaColecao.concat(blacklist);

        // Só perfumes SEM família salva localmente precisam ser classificados de novo
        // (evita que a IA reclassifique — e mude — a família de perfumes já conhecidos)
        const familiasPersistidas = getFamiliasPersistidas();
        const perfumesParaClassificar = minhaColecao
            .map(p => typeof p === 'string' ? p : p.nome)
            .filter(nome => !familiasPersistidas[chavePerfume(nome)]);

        const diagnostico = `
PERFIL DO USUÁRIO:
Clima: ${perfil.clima || 'Temperado'}
Ambiente: ${perfil.ambiente || 'Ambos'}
Idade: ${perfil.idade || '25-35'} anos
Orçamento: ${perfil.orcamento || 'R$ 300-500'}

COLEÇÃO ATUAL (${minhaColecao.length} perfumes):
${minhaColecao.map((p, i) => {
    const nome = typeof p === 'string' ? p : p.nome;
    const concentracao = typeof p === 'string' ? 'EDP' : p.concentracao;
    const familiaConhecida = familiasPersistidas[chavePerfume(nome)];
    const tag = familiaConhecida ? `[JÁ CLASSIFICADO: ${familiaConhecida} — NÃO reclassifique]` : '[PRECISA CLASSIFICAR]';
    return `${i + 1}. ${nome} (${concentracao}) ${tag}`;
}).join('\n')}

⚠️ NUNCA SUGERIR (usuário já tem OU não gostou):
${naoSugerir.map(p => typeof p === 'string' ? p : p.nome).join(', ')}

⚠️ PERFUMES JÁ SUGERIDOS ANTES (NÃO REPITA):
${window.perfumesJaSugeridos && window.perfumesJaSugeridos.length > 0 ? window.perfumesJaSugeridos.join(', ') : 'Nenhum ainda'}

INSTRUÇÕES CRÍTICAS:

===========================================================
📊 PARTE 1: CLASSIFICAÇÃO DE FAMÍLIAS OLFATIVAS (OBRIGATÓRIO)
===========================================================

${perfumesParaClassificar.length > 0
    ? `Para CADA perfume marcado [PRECISA CLASSIFICAR] acima (${perfumesParaClassificar.join(', ')}), você DEVE classificá-lo em UMA das 9 famílias abaixo.\nOs marcados [JÁ CLASSIFICADO] já têm família definida — NÃO os reclassifique e NÃO os inclua em "classificacao_perfumes".\n\n${construirGuiaFamilias(perfil.categoria)}\n\nRetorne em "classificacao_perfumes" um item {"nome":"...","familia":"..."} para CADA perfume marcado [PRECISA CLASSIFICAR] — obrigatório, um item por perfume.`
    : `Todos os perfumes já estão classificados localmente. Retorne "classificacao_perfumes": [] (array vazio).`
}

===========================================================
🚨 PARTE 2: SUGESTÕES - MARCAS DIFERENTES (OBRIGATÓRIO!) 🚨
===========================================================

Sugira EXATAMENTE 3 perfumes onde:

1️⃣ CADA perfume é de uma MARCA TOTALMENTE DIFERENTE
2️⃣ NUNCA repita a mesma marca entre os 3 perfumes
3️⃣ Preencham as MAIORES LACUNAS da coleção

❌ EXEMPLOS PROIBIDOS (ERRADO):
- Dior Sauvage, Dior Homme, Versace Eros (Dior repetiu!)
- Paco Rabanne Invictus, Paco Rabanne 1 Million, Dior Sauvage (Paco Rabanne repetiu!)
- Versace Eros, Versace Dylan Blue, Armani Code (Versace repetiu!)

✅ EXEMPLOS CORRETOS:
- Dior Sauvage, Versace Eros, Paco Rabanne Invictus (3 marcas diferentes!)
- Creed Aventus, Tom Ford Oud Wood, Yves Saint Laurent La Nuit (3 marcas diferentes!)
- Montblanc Explorer, Carolina Herrera Bad Boy, Azzaro Wanted (3 marcas diferentes!)

===========================================================
💰 PARTE 3: ORÇAMENTO - RESPEITE RIGOROSAMENTE! 💰
===========================================================

O usuário definiu orçamento de: ${perfil.orcamento || 'R$ 300-500'}

REGRAS DE ORÇAMENTO (INEGOCIÁVEIS):
${construirFaixaOrcamento()}

⚠️ R$ 300-500: ACEITE toda a faixa (inclui nacionais e importados acessíveis)
⚠️ R$ 500+: PRIORIZE o TOPO da faixa!
⚠️ NUNCA sugira abaixo do mínimo!

EXEMPLOS:
- Orçamento "R$ 300-500" → ✅ O Boticário Malbec (R$ 280), Phebo Vetiver (R$ 350), Hugo Boss (R$ 450)
- Orçamento "R$ 800-1500" → ✅ Creed Aventus (R$ 1400), Tom Ford Oud Wood (R$ 1600)
- Orçamento "R$ 800-1500" → ❌ Mont Blanc Legend (R$ 350) - MUITO ABAIXO!

===========================================================

REGRAS ADICIONAIS:
4️⃣ Considere clima e ambiente do usuário
5️⃣ VARIEDADE DE MARCAS: Misture marcas conhecidas (Dior, Chanel, YSL, Versace) com nicho acessível (Montblanc, Mancera, Lattafa)
6️⃣ NÃO foque apenas em hidden gems - inclua best-sellers também
7️⃣ EVITE repetir perfumes já sugeridos: ${window.perfumesJaSugeridos && window.perfumesJaSugeridos.length > 0 ? window.perfumesJaSugeridos.join(', ') : 'nenhum ainda'}
8️⃣ **CONCENTRAÇÃO OBRIGATÓRIA**: Para CADA perfume sugerido, informe a concentração mais comum (EDT, EDP, Parfum ou Elixir). Exemplo: "Dior Sauvage EDT" ou "Creed Aventus EDP"

EXEMPLOS DE BOA VARIEDADE:
✅ Dior Sauvage EDT (mainstream), Mancera Cedrat Boise EDP (nicho), Montblanc Explorer EDP (intermediário)
✅ Bleu de Chanel EDP (conhecido), Lattafa Khamrah EDP (nicho), Paco Rabanne Invictus EDT (popular)

❌ EVITE sugestões só de marcas obscuras:
❌ Todas as 3 de marcas desconhecidas (Phebo, Lalique, Rochas sempre)
❌ Repetir sempre os mesmos perfumes de nicho

IMPORTANTE: Classificação PRECISA + 3 MARCAS DIFERENTES + RESPEITAR ORÇAMENTO + VARIEDADE!

===========================================================
📦 FORMATO DE RESPOSTA OBRIGATÓRIO
===========================================================

Você DEVE retornar um JSON com este formato EXATO:

{
  "analise_colecao": {
    "classificacao_perfumes": [
      {"nome": "Nome exato do perfume marcado [PRECISA CLASSIFICAR]", "familia": "Uma das 9 famílias"}
    ],
    "perfumes_por_familia": {...},
    "familia_dominante": "...",
    "top3_faltando": [...]
  },
  "recomendacoes": [
    {
      "nome": "Dior Sauvage",
      "concentracao": "EDT",
      "familia": "Aromático/Verde",
      "faixa_preco": "R$ 400-600",
      "por_que": "Complementa sua coleção com frescor",
      "quando_usar": "Dia a dia, trabalho"
    },
    {
      "nome": "Creed Aventus",
      "concentracao": "EDP",
      "familia": "Frutado",
      "faixa_preco": "R$ 1.200-1.600",
      "por_que": "Adiciona sofisticação",
      "quando_usar": "Eventos, noite"
    },
    {
      "nome": "Tom Ford Oud Wood",
      "concentracao": "Parfum",
      "familia": "Amadeirado",
      "faixa_preco": "R$ 1.400-1.800",
      "por_que": "Perfume de assinatura único",
      "quando_usar": "Noite, inverno"
    }
  ]
}

⚠️⚠️⚠️ CRÍTICO: O campo "concentracao" é OBRIGATÓRIO em TODAS as 3 recomendações!
Valores aceitos: "EDT", "EDP", "Parfum", "Elixir"

Se você esquecer o campo "concentracao", o sistema VAI QUEBRAR!

Analise e retorne análise detalhada + recomendações COM CONCENTRAÇÃO.
`;
        const response = await fetch('https://operfumista-api.vercel.app/api/perfumista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: criarTimeoutSignal(),
            body: JSON.stringify({ diagnostico, categoria: perfil.categoria || 'masculino' })
        });
        const data = await response.json();
        if (data.analise_colecao) {
        }
        // Se API não retornou classificação
        if (!data.analise_colecao || !data.analise_colecao.perfumes_por_familia) {
            radarContainer.innerHTML = radarBackup;
            alert('❌ Erro: A API não conseguiu classificar os perfumes. Tente novamente.');
            return;
        }

        // Persiste a família de cada perfume recém-classificado (nunca sobrescreve o que já tinha)
        const familiasAtualizadas = getFamiliasPersistidas();
        (data.analise_colecao.classificacao_perfumes || []).forEach(item => {
            if (item && item.nome) {
                const chave = chavePerfume(item.nome);
                if (!familiasAtualizadas[chave]) {
                    familiasAtualizadas[chave] = canonizarFamiliaClassificacao(item.familia);
                }
            }
        });
        salvarFamiliasPersistidas(familiasAtualizadas);

        // Recalcula a análise localmente (fonte de verdade determinística) em vez de
        // confiar na contagem agregada que a IA devolveu nesta chamada específica
        data.analise_colecao = recalcularAnaliseColecao(data.analise_colecao);

        // Remove sugestões que a IA devolveu mas que já estão na coleção/blacklist
        data.recomendacoes = filtrarRecomendacoesDuplicadas(data.recomendacoes);

        // Salva classificações (compatibilidade)
        localStorage.setItem('classificacoesValidadas', JSON.stringify(data.analise_colecao.perfumes_por_familia));

        // Salva cache COM PERFIL
        localStorage.setItem('ultimaAnalise', JSON.stringify({
            colecao: colecaoAtualString,
            perfil: perfilAtualString,
            dados: data,
            timestamp: Date.now()
        }));
        // 🎯 RENDERIZA TUDO DO LOCALSTORAGE (fonte única)
        renderizarTudoDoLocalStorage();
        
        // Esconde CTA de análise (análise foi feita)
        if(typeof atualizarCtaAnalise === 'function') atualizarCtaAnalise();
        
        // Salva globalmente (compatibilidade)
        window.dadosAnaliseAtual = data;
        window.missaoAtualIndex = 0;
        
        // 🔒 MARCA coleção como analisada
        const colecaoAtual = minhaColecao.sort().join('|');
        localStorage.setItem('ultimaColecaoAnalisada', colecaoAtual);
        // Tracking
        const nivelAtual = calcularNivelAtual();
        trackCollection(minhaColecao, data.analise_colecao);
        trackAnalysis(data.analise_colecao, nivelAtual, data.recomendacoes);
        if (window.rateLimiter) window.rateLimiter.registrarUso('analise');
        if (typeof atualizarContadores === 'function') atualizarContadores();
        
        // Salva perfumes recomendados no histórico
        if (data.recomendacoes && data.recomendacoes.length > 0) {
            if (!window.perfumesJaSugeridos) {
                window.perfumesJaSugeridos = [];
            }
            data.recomendacoes.forEach(rec => {
                if (!window.perfumesJaSugeridos.includes(rec.nome)) {
                    window.perfumesJaSugeridos.push(rec.nome);
                }
            });
        }
        
        // Adiciona glow na aba Missão
        adicionarGlowMissao();
        
        // Toast + navega para Resumo
        mostrarToast('✅ Análise completa!', 'Seu resumo personalizado está pronto', 'success');
        setTimeout(() => goSection('resumo'), 600);
        
    } catch (error) {
        radarContainer.innerHTML = radarBackup;
        alert('❌ Erro ao analisar coleção. Tente novamente.');
    }
}

function mostrarToast(titulo, subtitulo, tipo = 'success') {
    const cor = tipo === 'success' ? '#4caf50' : '#ff6666';
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, ${cor}, ${cor}dd);
        color: var(--tx);
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        font-weight: 600;
        animation: fadeIn 0.3s ease-out;
        max-width: 350px;
    `;
    toast.innerHTML = `
        <div style="font-size: 1.1em; margin-bottom: 5px;">${titulo}</div>
        ${subtitulo ? '<div style="font-size: 0.9em; opacity: 0.95;">' + subtitulo + '</div>' : ''}
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transition = 'opacity 0.5s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

function adicionarGlowMissao() {
    const abaMissao = document.querySelector('.bn-item[data-section="missao"]');
    if (abaMissao) {
        abaMissao.style.animation = 'missionPulse 1.5s ease-in-out infinite';
        abaMissao.addEventListener('click', function removeGlow() {
            abaMissao.style.animation = '';
            abaMissao.removeEventListener('click', removeGlow);
        }, { once: true });
    }
}

function limparCache() {
    localStorage.removeItem('ultimaAnalise');
    alert('✅ Cache limpo! Clique em "Analisar" para gerar nova análise.');
}

async function trocarSugestaoIndividual(indice) {
    const dadosAnalise = window.dadosAnaliseAtual;
    
    if (!dadosAnalise) {
        alert('❌ Erro: faça uma análise primeiro.');
        return;
    }
    
    const card = document.getElementById(`candidato-${indice}`);
    if (!card) return;
    
    // Mostra loading no card
    const conteudoOriginal = card.innerHTML;
    card.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--tx3);">
            <div class="analyzing-spinner" style="margin: 0 auto 15px;"></div>
            <div>🔍 Buscando nova sugestão...</div>
        </div>
    `;
    
    try {
        const analise = dadosAnalise.analise_colecao || dadosAnalise.analise;
        const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
        const missaoIndex = window.missaoAtualIndex || 0;
        
        // Pega família alvo
        const top3_faltando = analise.top3_faltando || [];
        let familiaAlvo;
        if (top3_faltando.length > missaoIndex) {
            familiaAlvo = top3_faltando[missaoIndex];
        } else {
            familiaAlvo = getFamiliaComMenosPerfumes(analise.perfumes_por_familia);
        }
        
        // Pega perfumes já sugeridos + blacklist para não repetir
        const sugestoesAtuais = [];
        for (let i = 0; i < 3; i++) {
            const cardAtual = document.getElementById(`candidato-${i}`);
            if (cardAtual && i !== indice) {
                const nome = cardAtual.querySelector('.candidate-name')?.textContent.replace(/^\d+\.\s*/, '');
                if (nome) sugestoesAtuais.push(nome);
            }
        }
        
        // Adiciona blacklist de perfumes que o usuário não gostou
        const blacklist = JSON.parse(localStorage.getItem('perfumesBlacklist') || '[]');
        const naoSugerir = minhaColecao.concat(sugestoesAtuais).concat(window.perfumesJaSugeridos || []).concat(blacklist);
        
        const prompt = `
PERFIL DO USUÁRIO:
Clima: ${perfil.clima || 'Temperado'}
Ambiente: ${perfil.ambiente || 'Ambos'}
Idade: ${perfil.idade || '25-35'} anos
Orçamento: ${perfil.orcamento || 'R$ 300-500'}

COLEÇÃO ATUAL (${minhaColecao.length} perfumes):
${minhaColecao.map((p, i) => `${i + 1}. ${p}`).join('\n')}

⚠️ NÃO SUGERIR (usuário já tem OU não gostou):
${naoSugerir.join(', ')}

===========================================================
🎯 MISSÃO: Sugerir 1 ÚNICO perfume
===========================================================

REGRAS CRÍTICAS:
1️⃣ Deve ser da família: ${familiaAlvo}
2️⃣ NÃO sugerir NENHUM da lista acima
3️⃣ Marca DIFERENTE das outras sugestões

===========================================================
💰 ORÇAMENTO - RESPEITE RIGOROSAMENTE! 💰
===========================================================

O usuário definiu orçamento de: ${perfil.orcamento || 'R$ 300-500'}

REGRAS DE ORÇAMENTO (INEGOCIÁVEIS):
${construirFaixaOrcamento()}

⚠️ R$ 300-500: ACEITE toda a faixa (nacionais e importados OK)
⚠️ R$ 500+: PRIORIZE o TOPO!

===========================================================

VARIEDADE: Misture marcas conhecidas com nicho. NÃO foque só em hidden gems.

Retorne APENAS 1 perfume com: nome, família, faixa_preco, por_que, quando_usar
`;

        const response = await fetch('https://operfumista-api.vercel.app/api/perfumista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: criarTimeoutSignal(),
            body: JSON.stringify({ diagnostico: prompt, categoria: perfil.categoria || 'masculino' })
        });
        
        const data = await response.json();
        const candidata = data.recomendacoes?.[0];
        const novaSugestao = (candidata && !perfumeJaConhecido(candidata.nome)) ? candidata : null;

        if (!novaSugestao) {
            card.innerHTML = conteudoOriginal;
            alert('❌ Não foi possível gerar nova sugestão. Tente novamente.');
            return;
        }
        
        // Atualiza card
        card.innerHTML = `
            ${renderizarCandidatoHTML(novaSugestao, indice)}
            <div style="display: flex; gap: 8px; margin-top: 12px;">
                <button 
                    onclick="trocarSugestaoIndividual(${indice})"
                    style="
                        flex: 1;
                        padding: 8px 16px;
                        background: var(--orm);
                        border: 1px solid var(--org);
                        border-radius: 8px;
                        color: var(--or);
                        font-size: 0.9em;
                        cursor: pointer;
                        transition: all 0.3s;
                    "
                    onmouseover="this.style.background='var(--orm)'"
                    onmouseout="this.style.background='var(--orm)'"
                >
                    🔄 Trocar esta
                </button>
                <button 
                    onclick="naoGostoDesta('${novaSugestao.nome.replace(/'/g, "\\'")}', ${indice})"
                    style="
                        flex: 1;
                        padding: 8px 16px;
                        background: rgba(255, 68, 68, 0.1);
                        border: 1px solid rgba(255, 68, 68, 0.3);
                        border-radius: 8px;
                        color: #ff4444;
                        font-size: 0.9em;
                        cursor: pointer;
                        transition: all 0.3s;
                    "
                    onmouseover="this.style.background='rgba(255, 68, 68, 0.2)'"
                    onmouseout="this.style.background='rgba(255, 68, 68, 0.1)'"
                >
                    👎 Não gosto
                </button>
            </div>
        `;
    } catch (error) {
        card.innerHTML = conteudoOriginal;
        alert('❌ Erro ao trocar sugestão. Tente novamente.');
    }
}

function naoGostoDesta(nomePerfume, indice) {
    // Adiciona à blacklist
    let blacklist = JSON.parse(localStorage.getItem('perfumesBlacklist') || '[]');
    if (!blacklist.includes(nomePerfume)) {
        blacklist.push(nomePerfume);
        localStorage.setItem('perfumesBlacklist', JSON.stringify(blacklist));
    }
    
    // Remove da lista de sugeridos para não contar como "já mostrado"
    if (window.perfumesJaSugeridos) {
        window.perfumesJaSugeridos = window.perfumesJaSugeridos.filter(p => p !== nomePerfume);
    }
    
    // Troca automaticamente por outro
    mostrarToast('👎 Entendi!', `${nomePerfume} não será mais sugerido`, 'success');
    trocarSugestaoIndividual(indice);
}

// ===================================
// SUGESTÕES (CHAT)
// ===================================

async function enviarPergunta() {
    const input = document.getElementById('chat-input');
    const pergunta = input.value.trim();
    
    if (!pergunta) {
        alert('Digite sua pergunta');
        return;
    }
    
    // 🔒 VERIFICA ASSINATURA
    const isAssinante = await verificarAssinatura();
    if (!isAssinante) {
        mostrarModalAssinatura();
        return;
    }
    
    // 🔒 RATE LIMITING: Verifica se pode enviar
    if (window.rateLimiter) {
        const checkLimite = window.rateLimiter.podeExecutar('chat');
        if (!checkLimite.pode) {
            mostrarPopupLimite('chat', checkLimite.total, checkLimite.proximoReset);
            return;
        }
    }

    const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
    
    // Adiciona mensagem do usuário
    adicionarMensagemChat('user', esc(pergunta));
    
    input.value = '';
    document.getElementById('chat-send-button').disabled = true;
    
    // Adiciona mensagem de loading
    adicionarMensagemChat('assistant', '🔍 Analisando...');
    
    try {
        // Constrói wishlist como array de strings para o backend
        const wishlistArr = wishes.map(w => w.nome);

        const response = await fetch('https://operfumista-api.vercel.app/api/perfumista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: criarTimeoutSignal(),
            body: JSON.stringify({
                pergunta: pergunta + `\n\n[Não repita: ${(window.perfumesJaSugeridos || []).join(', ') || 'nenhum'}]`,
                colecao: minhaColecao.map(p => typeof p === 'string' ? p : `${p.nome}${p.concentracao ? ' ' + p.concentracao : ''}`),
                wishlist: wishlistArr,
                categoria: perfil.categoria || 'masculino',
                clima: perfil.clima || 'Temperado',
                ambiente: perfil.ambiente || 'Ambos',
                idade: perfil.idade || '25-35',
                orcamento: perfil.orcamento || 'R$ 300-500'
            })
        });
        
        const data = await response.json();
        
        // Remove mensagem de loading
        const messages = document.getElementById('chat-messages');
        messages.removeChild(messages.lastChild);
        
        // Adiciona resposta (escapa o texto livre da IA — o HTML dos cards
        // de sugestão abaixo já é montado com esc() campo a campo)
        let resposta = esc(data.resposta || '');
        
        // Se não tem resposta mas tem sugestões, cria resposta padrão
        if (!resposta && data.sugestoes && data.sugestoes.length > 0) {
            resposta = '✨ Aqui estão minhas recomendações baseadas no seu perfil e orçamento:';
        }
        
        if (data.sugestoes && data.sugestoes.length > 0) {
            resposta += '<div class="suggestions-grid" style="margin-top: 20px;">';
            
            data.sugestoes.forEach(sug => {
                resposta += `
                    <div class="suggestion-card">
                        <div class="suggestion-name">${esc(sug.nome)}${sug.concentracao ? ' <span style="color: var(--or);">(' + esc(sug.concentracao) + ')</span>' : ''}</div>
                        <div class="suggestion-familia">${esc(sug.familia)}</div>
                        <div class="suggestion-preco">${esc(sug.faixa_preco)}</div>
                        <div class="suggestion-por-que">${esc(sug.por_que)}</div>
                        <div class="suggestion-quando">${esc(sug.quando_usar)}</div>
                    </div>
                `;
            });
            
            resposta += '</div>';
            
            // Salva perfumes sugeridos no histórico global
            if (!window.perfumesJaSugeridos) {
                window.perfumesJaSugeridos = [];
            }
            data.sugestoes.forEach(sug => {
                if (!window.perfumesJaSugeridos.includes(sug.nome)) {
                    window.perfumesJaSugeridos.push(sug.nome);
                }
            });
            // Adiciona botão WhatsApp
            resposta += `
                <button 
                    onclick="enviarSugestoesWhatsApp(${JSON.stringify(data.sugestoes).replace(/"/g, '&quot;')})"
                    style="
                        width: 100%;
                        margin-top: 20px;
                        padding: 14px;
                        background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
                        border: none;
                        border-radius: 10px;
                        color: var(--tx);
                        font-size: 1em;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s;
                        box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);
                    "
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(37, 211, 102, 0.5)'"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(37, 211, 102, 0.3)'"
                >
                    📱 Enviar pro meu WhatsApp
                </button>
            `;
        }
        
        adicionarMensagemChat('assistant', resposta);

        // 📊 REGISTRA uso do Rate Limit
        if (window.rateLimiter) window.rateLimiter.registrarUso('chat');
        if (typeof atualizarContadores === 'function') atualizarContadores();

    } catch (error) {
        // Remove mensagem de loading
        const messages = document.getElementById('chat-messages');
        messages.removeChild(messages.lastChild);
        
        adicionarMensagemChat('assistant', '❌ Erro ao processar pergunta. Tente novamente.');
    }
    
    document.getElementById('chat-send-button').disabled = false;
}

function adicionarMensagemChat(tipo, conteudo) {
    const messagesContainer = document.getElementById('chat-messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${tipo}`;
    
    const header = tipo === 'user' ? '👤 Você' : '🧪 Perfumista';
    
    messageDiv.innerHTML = `
        <div class="chat-message-header">${header}</div>
        <div class="chat-message-content">${conteudo}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ===================================
// SISTEMA DE NÍVEIS E GAMIFICAÇÃO
// ===================================

function calcularNivelAtual() {
    if (minhaColecao.length === 0) return null;
    const categoriaAtual = JSON.parse(localStorage.getItem('perfilUsuario') || '{}').categoria;
    const categoriaDescricao = categoriaAtual === 'feminino' ? 'feminina' : categoriaAtual === 'compartilhavel' ? 'compartilhável' : 'masculina';

    // Tenta pegar análise do cache (da API)
    const ultimaAnalise = JSON.parse(localStorage.getItem('ultimaAnalise') || '{}');
    const analise = ultimaAnalise.dados?.analise_colecao;
    
    // O nível nunca pode regredir: guarda o maior score de pontos já
    // alcançado, e nenhum pontos calculado abaixo dele é aceito.
    // Bug fix: sem isso, "faltam X" podia AUMENTAR depois de adicionar
    // um perfume (ver bônus de equilíbrio removido abaixo).
    const recordePontos = parseInt(localStorage.getItem('recordePontosNivel') || '0', 10);

    if (!analise || !analise.perfumes_por_familia) {
        // Se não tem análise da API, retorna nível básico baseado só na quantidade
        const pontosBasico = Math.max(Math.min(minhaColecao.length * 2, 50), recordePontos);
        localStorage.setItem('recordePontosNivel', String(pontosBasico));
        return {
            nome: pontosBasico < 30 ? "Iniciante" : "Explorador",
            emoji: pontosBasico < 30 ? "🌱" : "🔍",
            pontos: pontosBasico,
            proximo: pontosBasico < 30 ? "Explorador" : "Colecionador",
            pontosProximo: pontosBasico < 30 ? 30 : 51,
            faixaInicio: pontosBasico < 30 ? 0 : 30,
            cor: pontosBasico < 30 ? "#4caf50" : "#2196f3",
            percentual: 0,
            faltam: (pontosBasico < 30 ? 30 : 51) - pontosBasico,
            total_perfumes: minhaColecao.length,
            familias: 0
        };
    }

    const total = analise.total_perfumes || minhaColecao.length;
    const familias = analise.familias_representadas || Object.keys(analise.perfumes_por_familia).filter(f => analise.perfumes_por_familia[f] > 0).length;

    let pontos = 0;

    // ============================================
    // SISTEMA DIFÍCIL - MODO REALISTA
    // ============================================

    // 1. QUANTIDADE (50 pontos máx aos 25 perfumes)
    // 2 pontos por perfume - precisa ter MUITOS perfumes
    pontos += Math.min(total * 2, 50);

    // 2. DIVERSIDADE (45 pontos máx - 5 por família)
    // Precisa explorar TODAS as 9 famílias
    pontos += familias * 5;

    // OBS: o bônus de equilíbrio (quanto menos concentrada a família
    // dominante, mais pontos) foi REMOVIDO daqui de propósito. Ele é
    // inversamente proporcional à concentração da família dominante, então
    // comprar mais um perfume de uma família que já era forte podia FAZER
    // A PONTUAÇÃO CAIR mesmo aumentando a coleção — e "faltam X" subir
    // depois de adicionar um perfume, o que confundia o usuário. O
    // equilíbrio da coleção continua sendo mostrado (card de família
    // dominante / gráfico), só não entra mais na conta de nível.

    // Total arredondado, e nunca abaixo do recorde já alcançado
    pontos = Math.round(pontos);
    pontos = Math.min(95, Math.max(0, pontos));
    pontos = Math.max(pontos, recordePontos);
    localStorage.setItem('recordePontosNivel', String(pontos));

    // ============================================
    // NÍVEIS - MODO DIFÍCIL
    // ============================================
    
    let nivel = {};
    if (pontos < 30) {
        // 🌱 INICIANTE: 0-30 pontos
        // Precisa de ~5 perfumes e 2-3 famílias
        nivel = {
            nome: "Iniciante",
            emoji: "🌱",
            pontos: pontos,
            proximo: "Explorador",
            pontosProximo: 30,
            faixaInicio: 0,
            cor: "#4caf50",
            descricao: "Começando a explorar o mundo dos perfumes"
        };
    } else if (pontos < 51) {
        // 🔍 EXPLORADOR: 30-50 pontos
        // Precisa de ~10 perfumes e 4-5 famílias
        nivel = {
            nome: "Explorador",
            emoji: "🔍",
            pontos: pontos,
            proximo: "Colecionador",
            pontosProximo: 51,
            faixaInicio: 30,
            cor: "#2196f3",
            descricao: "Explorando diferentes famílias olfativas"
        };
    } else if (pontos < 71) {
        // ⭐ COLECIONADOR: 51-70 pontos
        // Precisa de ~18-20 perfumes e 6-7 famílias
        nivel = {
            nome: "Colecionador",
            emoji: "⭐",
            pontos: pontos,
            proximo: "Expert",
            pontosProximo: 71,
            faixaInicio: 51,
            cor: "#9c27b0",
            descricao: "Construindo uma coleção diversificada"
        };
    } else if (pontos < 86) {
        // 💎 EXPERT: 71-85 pontos
        // Precisa de ~25-30 perfumes e 7-8 famílias
        nivel = {
            nome: "Expert",
            emoji: "💎",
            pontos: pontos,
            proximo: "Mestre",
            pontosProximo: 86,
            faixaInicio: 71,
            cor: "#ff9800",
            descricao: "Domínio avançado da perfumaria"
        };
    } else {
        // 👑 MESTRE: 86-95 pontos (teto real desde que o bônus de equilíbrio
        // saiu da conta — sem isso "faltam" nunca chegava a 0 pra quem já
        // tinha coleção máxima)
        // Precisa de 35+ perfumes e TODAS as 9 famílias
        nivel = {
            nome: "Mestre",
            emoji: "👑",
            pontos: pontos,
            proximo: "Máximo",
            pontosProximo: 95,
            faixaInicio: 86,
            cor: "var(--or)",
            descricao: `Maestria completa em perfumaria ${categoriaDescricao}`
        };
    }
    
    // Calcula percentual CORRETO
    const naFaixa = pontos - nivel.faixaInicio;
    const totalFaixa = nivel.pontosProximo - nivel.faixaInicio;
    nivel.percentual = Math.round((naFaixa / totalFaixa) * 100);
    
    // Calcula pontos faltantes
    nivel.faltam = nivel.pontosProximo - pontos;
    
    // Adiciona dados da análise
    nivel.total_perfumes = total;
    nivel.familias = familias;
    
    return nivel;
}

// Analisa coleção localmente (classificação instantânea)
// ===================================
// CLASSIFICAÇÃO LOCAL (DESABILITADA - USA APENAS API AGORA)
// ===================================

/*
function analisarColecaoLocal(perfumes) {
    const familias = {};
    
    perfumes.forEach(nome => {
        const familia = identificarFamiliaLocal(nome);
        familias[familia] = (familias[familia] || 0) + 1;
    });
    
    const total = perfumes.length;
    const familias_representadas = Object.keys(familias).length;
    
    // Família dominante
    let dominante = { nome: '', quantidade: 0, porcentagem: 0 };
    for (const [fam, qtd] of Object.entries(familias)) {
        if (qtd > dominante.quantidade) {
            dominante = {
                nome: fam,
                quantidade: qtd,
                porcentagem: Math.round((qtd / total) * 100)
            };
        }
    }
    
    return {
        total_perfumes: total,
        familias_representadas,
        perfumes_por_familia: familias,
        familia_dominante: dominante
    };
}
*/

async function identificarFamiliaFragrantica(nomePerfume) {
    try {
        // Monta URL de busca do Fragantica
        const searchQuery = encodeURIComponent(nomePerfume);
        const fraganticaSearchURL = `https://www.fragrantica.com/search/`;
        
        // Tenta buscar via web search tool (se disponível)
        // Como não temos acesso direto ao Fragantica aqui, vamos usar a API
        // para fazer uma busca inteligente que retorne a família
        const response = await fetch('https://operfumista-api.vercel.app/api/perfumista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: criarTimeoutSignal(),
            body: JSON.stringify({
                pergunta: `Qual a família olfativa principal do perfume "${nomePerfume}"? Responda APENAS com uma das opções: Fresco/Cítrico, Aromático/Verde, Doce/Gourmand, Amadeirado, Especiado/Oriental, Aquático/Mineral, Talco/Fougère, Floral/Floral Branco, ou Frutado. Responda apenas o nome da família, sem explicações.`
            })
        });
        
        const data = await response.json();
        const resposta = data.resposta || '';
        
        // Mapeia resposta para família com emoji
        const familiaMap = {
            'fresco': '🍋 Fresco/Cítrico',
            'citrico': '🍋 Fresco/Cítrico',
            'aromatico': '🌳 Aromático/Verde',
            'verde': '🌳 Aromático/Verde',
            'doce': '🍯 Doce/Gourmand',
            'gourmand': '🍯 Doce/Gourmand',
            'amadeirado': '🪵 Amadeirado',
            'especiado': '🌶️ Especiado/Oriental',
            'oriental': '🌶️ Especiado/Oriental',
            'aquatico': '💧 Aquático/Mineral',
            'aquático': '💧 Aquático/Mineral',
            'mineral': '💧 Aquático/Mineral',
            'talco': '🧼 Talco/Fougère',
            'fougere': '🧼 Talco/Fougère',
            'fougère': '🧼 Talco/Fougère',
            'floral': '🌸 Floral/Floral Branco',
            'branco': '🌸 Floral/Floral Branco',
            'frutado': '🍇 Frutado'
        };
        
        const respostaLower = resposta.toLowerCase();
        for (const [key, familia] of Object.entries(familiaMap)) {
            if (respostaLower.includes(key)) {
                return familia;
            }
        }
        
        // Fallback para sistema local se API falhar
        return identificarFamiliaLocal(nomePerfume);
        
    } catch (error) {
        // Fallback para sistema local
        return identificarFamiliaLocal(nomePerfume);
    }
}

// Mantém função local como backup
/*
function identificarFamiliaLocal(nome) {
    nome = nome.toLowerCase();
    
    // Sistema de pontuação para cada família
    let scores = {
        '🍋 Fresco/Cítrico': 0,
        '🌳 Aromático/Verde': 0,
        '🍯 Doce/Gourmand': 0,
        '🪵 Amadeirado': 0,
        '🌶️ Especiado/Oriental': 0,
        '💧 Aquático': 0,
        '🧼 Talco/Fougère': 0,
        '🌸 Floral': 0,
        '🍇 Frutado': 0
    };
    
    // FRESCO/CÍTRICO - palavras-chave
    const frescoKeywords = [
        'acqua', 'agua', 'light blue', 'citrus', 'citron', 'limão', 'bergamot', 
        'bergamota', 'lemon', 'orange', 'laranja', 'grapefruit', 'mandarin', 
        'tangerine', 'cologne', 'colonia', 'fresh', 'fresco', 'azzaro', 'chrome',
        'ck one', 'ck be', 'eternity', 'escape'
    ];
    
    // AROMÁTICO/VERDE - palavras-chave
    const aromaticoKeywords = [
        'sauvage', 'bleu', 'blue', 'polo', 'green', 'verde', 'lavanda', 'lavender',
        'sage', 'salvia', 'mint', 'menta', 'basil', 'manjericão', 'herbal',
        'aromatic', 'aromatico', 'dior homme', 'allure homme', 'prada homme',
        'armani', 'givenchy', 'sport', 'esporte'
    ];
    
    // DOCE/GOURMAND - palavras-chave
    const doceKeywords = [
        'one million', '1 million', 'ultra male', 'wanted', 'scandal', '212 vip',
        'vanilla', 'baunilha', 'caramel', 'caramelo', 'chocolate', 'tonka',
        'praline', 'honey', 'mel', 'sweet', 'doce', 'candy', 'good girl',
        'bombshell', 'pink sugar', 'angel', 'la vie est belle'
    ];
    
    // AMADEIRADO - palavras-chave
    const amadeiradoKeywords = [
        'terre', 'wood', 'oud', 'aoud', 'cedro', 'cedar', 'sandalwood', 'sandalo',
        'vetiver', 'patchouli', 'individuel', 'encre noire', 'tobacco', 'tabaco',
        'leather', 'couro', 'suede', 'iris', 'homme intense', 'tuscan leather',
        'terre d', 'voyage', 'antaeus'
    ];
    
    // ESPECIADO/ORIENTAL - palavras-chave
    const especiadoKeywords = [
        'spice', 'spicebomb', 'eros', 'noir', 'black', 'intense', 'extreme',
        'cardamom', 'cardamomo', 'pepper', 'pimenta', 'cinnamon', 'canela',
        'clove', 'cravo', 'nutmeg', 'noz moscada', 'oriental', 'ambre', 'amber',
        'âmbar', 'opium', 'obsession', 'interlude', 'jubilation'
    ];
    
    // AQUÁTICO - palavras-chave
    const aquaticoKeywords = [
        'invictus', 'aqua', 'ocean', 'oceano', 'sea', 'mar', 'marine', 'marinho',
        'cool water', 'davidoff', 'nautica', 'voyage', 'azz', 'azzaro',
        'light blue intense', 'dylan blue', 'y eau fraiche', 'legend spirit'
    ];
    
    // TALCO/FOUGÈRE - palavras-chave
    const talcoKeywords = [
        'royal', 'malbec', 'kouros', 'heritage', 'pasha', 'bvlgari pour homme',
        'fahrenheit', 'habit rouge', 'brut', 'old spice', 'joop', 'grey flannel',
        'drakkar', 'azzaro pour homme', 'pino silvestre', 'silvestre'
    ];
    
    // FLORAL - palavras-chave
    const floralKeywords = [
        'rose', 'rosa', 'jasmine', 'jasmim', 'lily', 'lirio', 'violet', 'violeta',
        'iris', 'geranium', 'geranio', 'neroli', 'ylang', 'magnolia', 'peony',
        'peonia', 'flowerbomb', 'amor amor', 'la nuit tresor'
    ];
    
    // FRUTADO - palavras-chave
    const frutadoKeywords = [
        'apple', 'maça', 'pear', 'pera', 'peach', 'pessego', 'plum', 'ameixa',
        'berry', 'mirtilo', 'blackberry', 'raspberry', 'morango', 'strawberry',
        'cherry', 'cereja', 'pineapple', 'abacaxi', 'mango', 'manga', 'melon',
        'melancia', 'watermelon', 'passion fruit', 'maracuja'
    ];
    
    // Conta pontos para cada família
    frescoKeywords.forEach(kw => { if (nome.includes(kw)) scores['🍋 Fresco/Cítrico'] += 2; });
    aromaticoKeywords.forEach(kw => { if (nome.includes(kw)) scores['🌳 Aromático/Verde'] += 2; });
    doceKeywords.forEach(kw => { if (nome.includes(kw)) scores['🍯 Doce/Gourmand'] += 2; });
    amadeiradoKeywords.forEach(kw => { if (nome.includes(kw)) scores['🪵 Amadeirado'] += 2; });
    especiadoKeywords.forEach(kw => { if (nome.includes(kw)) scores['🌶️ Especiado/Oriental'] += 2; });
    aquaticoKeywords.forEach(kw => { if (nome.includes(kw)) scores['💧 Aquático'] += 2; });
    talcoKeywords.forEach(kw => { if (nome.includes(kw)) scores['🧼 Talco/Fougère'] += 2; });
    floralKeywords.forEach(kw => { if (nome.includes(kw)) scores['🌸 Floral'] += 2; });
    frutadoKeywords.forEach(kw => { if (nome.includes(kw)) scores['🍇 Frutado'] += 2; });
    
    // Padrões específicos de marcas (ajuste fino)
    if (nome.includes('dior')) {
        if (nome.includes('sauvage')) scores['🌳 Aromático/Verde'] += 3;
        else if (nome.includes('homme intense')) scores['🪵 Amadeirado'] += 3;
        else if (nome.includes('fahrenheit')) scores['🧼 Talco/Fougère'] += 3;
    }
    
    if (nome.includes('chanel')) {
        if (nome.includes('bleu')) scores['🌳 Aromático/Verde'] += 3;
        else if (nome.includes('allure homme sport')) scores['🍋 Fresco/Cítrico'] += 3;
    }
    
    if (nome.includes('versace')) {
        if (nome.includes('eros')) scores['🌶️ Especiado/Oriental'] += 3;
        else if (nome.includes('dylan blue')) scores['💧 Aquático'] += 3;
        else if (nome.includes('pour homme')) scores['🍋 Fresco/Cítrico'] += 3;
    }
    
    if (nome.includes('paco rabanne')) {
        if (nome.includes('invictus')) scores['💧 Aquático'] += 3;
        else if (nome.includes('1 million') || nome.includes('one million')) scores['🍯 Doce/Gourmand'] += 3;
    }
    
    if (nome.includes('ysl') || nome.includes('saint laurent')) {
        if (nome.includes('y ')) scores['🌳 Aromático/Verde'] += 3;
        else if (nome.includes('la nuit')) scores['🌶️ Especiado/Oriental'] += 3;
    }
    
    if (nome.includes('armani')) {
        if (nome.includes('acqua di gio')) scores['💧 Aquático'] += 3;
        else if (nome.includes('code')) scores['🌶️ Especiado/Oriental'] += 3;
    }
    
    if (nome.includes('jean paul gaultier')) {
        if (nome.includes('le male') || nome.includes('ultra male')) scores['🍯 Doce/Gourmand'] += 3;
    }
    
    // Encontra a família com maior pontuação
    let maxScore = 0;
    let familiaVencedora = '🌳 Aromático/Verde'; // default mais neutro
    
    for (const [familia, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            familiaVencedora = familia;
        }
    }
    
    // Se nenhum padrão bateu (score 0), tenta inferir por palavras comuns
    if (maxScore === 0) {
        // Perfumes com "homme" geralmente são aromáticos
        if (nome.includes('homme') || nome.includes('man') || nome.includes('men')) {
            return '🌳 Aromático/Verde';
        }
        // Perfumes com "eau" ou "summer" geralmente são frescos
        if (nome.includes('eau fraiche') || nome.includes('summer') || nome.includes('soleil')) {
            return '🍋 Fresco/Cítrico';
        }
        // Perfumes com "nuit" ou "night" geralmente são orientais
        if (nome.includes('nuit') || nome.includes('night') || nome.includes('midnight')) {
            return '🌶️ Especiado/Oriental';
        }
    }
    return familiaVencedora;
}
*/

function renderizarBarraNivel(nivel) {
    if (!nivel) return '';
    
    const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
    const nomeUsuario = perfil.nome || 'Colecionador';
    
    return `
        <div style="
            background: linear-gradient(135deg, rgba(232,93,4,.15), rgba(232,93,4,.05));
            border: 2px solid ${nivel.cor};
            border-radius: 15px;
            padding: 20px;
            margin: 0 auto 20px auto;
            max-width: 100%;
            animation: fadeIn 0.5s ease-out;
        ">
            <!-- Nome do Usuário -->
            <div style="
                color: var(--or);
                font-size: 1.5em;
                font-weight: 700;
                margin-bottom: 15px;
                text-align: center;
            ">
                👋 Olá, ${esc(nomeUsuario)}!
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <div style="color: ${nivel.cor}; font-size: 1.3em; font-weight: 700; margin-bottom: 4px;">
                        ${nivel.emoji} ${nivel.nome}
                    </div>
                    <div style="color: var(--tx2); font-size: 0.85em;">
                        ${nivel.total_perfumes} perfumes • ${nivel.familias}/9 famílias
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="color: ${nivel.cor}; font-size: 1.8em; font-weight: 700;">
                        ${nivel.pontos}
                    </div>
                    <div style="color: var(--tx3); font-size: 0.8em;">pontos</div>
                </div>
            </div>
            
            <div style="
                background: var(--s2);
                border-radius: 8px;
                height: 24px;
                overflow: hidden;
                position: relative;
                margin-bottom: 8px;
            ">
                <div style="
                    background: linear-gradient(90deg, ${nivel.cor}, ${nivel.cor}aa);
                    height: 100%;
                    width: ${nivel.percentual}%;
                    transition: width 0.8s ease-out;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding-right: 8px;
                ">
                    <span style="color: var(--tx); font-weight: 700; font-size: 0.85em;">
                        ${nivel.percentual}%
                    </span>
                </div>
            </div>
            
            <div style="color: var(--tx2); font-size: 0.85em; text-align: center;">
                ${nivel.proximo === "Máximo" 
                    ? "🎉 Você atingiu o nível máximo!" 
                    : "Você tem " + nivel.pontos + " pontos • Faltam " + nivel.faltam + " para " + (nivel.proximo === "Explorador" ? "🔍" : nivel.proximo === "Colecionador" ? "⭐" : nivel.proximo === "Expert" ? "💎" : "👑") + " " + nivel.proximo
                }
            </div>
        </div>
    `;
}

function atualizarNivelDOM() {
    const nivel = calcularNivelAtual();
    const container = document.getElementById('nivel-fixo-container');
    
    if (!container) return;
    
    if (nivel) {
        container.innerHTML = renderizarBarraNivel(nivel);
        container.style.display = 'block';
    } else {
        // Se não tem nível, mostra só o nome
        const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
        const nomeUsuario = perfil.nome || 'Colecionador';
        
        container.innerHTML = `
            <div style="
                background: linear-gradient(135deg, rgba(232,93,4,.15), rgba(232,93,4,.05));
                border: 2px solid var(--org);
                border-radius: 15px;
                padding: 20px;
                margin: 0 auto 20px auto;
                max-width: 100%;
                text-align: center;
            ">
                <div style="
                    color: var(--or);
                    font-size: 1.5em;
                    font-weight: 700;
                ">
                    👋 Olá, ${esc(nomeUsuario)}!
                </div>
                <div style="
                    color: var(--tx3);
                    font-size: 0.95em;
                    margin-top: 8px;
                ">
                    Adicione perfumes à sua coleção para começar sua jornada
                </div>
            </div>
        `;
        container.style.display = 'block';
    }
}

// ===================================
// GAMIFICAÇÃO - RENDERIZAÇÃO DE MISSÕES
// ===================================

// ✨ NOVA FUNÇÃO: Atualiza missões automaticamente se análise existe
function atualizarMissoesSeExistir() {
    // Verifica se tem análise salva
    const ultimaAnalise = localStorage.getItem('ultimaAnalise');
    
    if (!ultimaAnalise) {
        return;
    }
    
    try {
        const data = JSON.parse(ultimaAnalise);
        const containerMissao = document.getElementById('missionContainer');
        
        // Só atualiza se o container de missão existir (usuário está na aba certa)
        if (containerMissao) {
            renderizarMissaoGameficada(data);
        } else {
        }
    } catch (error) {
    }
}

function renderizarMissaoGameficada(data, tituloCustomizado = null) {
    const analise = data.analise_colecao || data.analise;
    const recomendacoes = data.recomendacoes;
    const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
    
    const contexto_aplicado = {
        clima: perfil.clima || 'Temperado',
        ambiente: perfil.ambiente || 'Ambos',
        idade: perfil.idade || '25-35',
        orcamento: perfil.orcamento || 'R$ 300-500'
    };
    
    // Pega índice atual da missão (default 0)
    const missaoIndex = window.missaoAtualIndex || 0;
    
    // Gera missão baseada na análise
    const missao = gerarMissao(analise, contexto_aplicado, missaoIndex);
    
    // Usa título customizado se fornecido
    const titulo = tituloCustomizado || missao.titulo;
    const badge = tituloCustomizado ? '💎 ESPECIAL' : `🎯 MISSÃO ${missaoIndex + 1} de 3`;
    
    // HTML da missão
    const missaoHTML = `
        <div class="mission-container" id="missionContainer">
            <!-- Card Principal da Missão -->
            <div class="mission-card">
                <div class="mission-badge">${badge}</div>
                
                <h2 class="mission-title">${titulo}</h2>
                
                <div class="mission-details">
                    <div class="detail-row">
                        <strong>Alvo:</strong> ${missao.alvo}
                    </div>
                    <div class="detail-row">
                        <strong>Uso:</strong> ${missao.uso}
                    </div>
                    <div class="detail-row">
                        <strong>Clima:</strong> ${missao.clima}
                    </div>
                    <div class="detail-row">
                        <strong>Faixa ideal:</strong> ${missao.faixa_preco}
                    </div>
                </div>
                
                <div class="mission-why">
                    <strong>Por quê?</strong><br>
                    ${missao.justificativa}
                </div>
                
                <div class="mission-progress">
                    ✅ Você está <strong>${missao.compras_faltantes} ${missao.compras_faltantes === 1 ? 'compra' : 'compras'}</strong> de ter uma coleção redonda
                </div>
                
                <div class="mission-actions">
                    <button class="btn-mission-secondary" onclick="gerarNovaMissao()" style="width: 100%;">
                        🔄 Quero outra missão
                    </button>
                </div>
            </div>
            
            <!-- Card de Candidatos (sempre visível) -->
            <div class="candidates-card" style="display: block;">
                <h3 style="color: var(--or); font-size: 1.5em; margin-bottom: 20px;">
                    🎁 Seus Candidatos Perfeitos
                </h3>
                
                <div id="sugestoesContainer">
                    ${recomendacoes.map((rec, i) => `
                        <div class="candidate-item" id="candidato-${i}">
                            ${renderizarCandidatoHTML(rec, i)}
                        </div>
                    `).join('')}
                </div>
                
                <!-- Botão WhatsApp -->
                <button 
                    id="btn-whatsapp"
                    style="
                        width: 100%;
                        margin-top: 25px;
                        padding: 16px;
                        background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
                        border: none;
                        border-radius: 12px;
                        color: var(--tx);
                        font-size: 1.1em;
                        font-weight: 700;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        box-shadow: 0 5px 20px rgba(37, 211, 102, 0.3);
                    " 
                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 30px rgba(37, 211, 102, 0.5)'"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 5px 20px rgba(37, 211, 102, 0.3)'"
                >
                    📱 Enviar pro meu WhatsApp
                </button>
            </div>
        </div>
    `;
    
    const resultContainer = document.getElementById('result-container');
    resultContainer.innerHTML = missaoHTML;
    
    // Adiciona animação de glow na primeira missão
    setTimeout(() => {
        const missionContainer = document.getElementById('missionContainer');
        if (missionContainer) {
            missionContainer.classList.add('mission-changing');
            
            // Remove após animação terminar
            setTimeout(() => {
                missionContainer.classList.remove('mission-changing');
            }, 1500);
        }
    }, 100);
    
    // Adiciona listener ao botão WhatsApp DEPOIS de renderizar
    const btnWhatsapp = document.getElementById('btn-whatsapp');
    if (btnWhatsapp) {
        btnWhatsapp.addEventListener('click', () => enviarSugestoesWhatsApp(recomendacoes));
    }
}

function gerarMissao(analise, contexto, missaoIndex = 0) {
    const { familia_dominante, top3_faltando, perfumes_por_familia } = analise;
    
    // Determina qual família atacar baseado no índice de rotação
    let familiaAlvo;
    if (top3_faltando && top3_faltando.length > missaoIndex) {
        familiaAlvo = top3_faltando[missaoIndex];
    } else {
        familiaAlvo = getFamiliaComMenosPerfumes(perfumes_por_familia);
    }
    
    // Calcula compras faltantes
    const totalPerfumes = Object.values(perfumes_por_familia).reduce((a, b) => a + b, 0);
    const comprasFaltantes = totalPerfumes < 7 ? (7 - totalPerfumes) : 
                             totalPerfumes < 12 ? (12 - totalPerfumes) : 
                             (20 - totalPerfumes);
    
    // Gera título da missão
    const titulo = gerarTituloMissao(familiaAlvo, familia_dominante, contexto, missaoIndex);
    
    // Gera alvo específico
    const alvo = getAlvoEspecifico(familiaAlvo);
    
    // Gera uso sugerido
    const uso = getUsoSugerido(familiaAlvo, contexto);
    
    // Justificativa
    const porcentagemDominante = familia_dominante.porcentagem;
    const justificativa = porcentagemDominante > 50 
        ? `Você tem ${porcentagemDominante}% de ${familia_dominante.nome} e quase nada de ${familiaAlvo}`
        : `Falta ${familiaAlvo} para equilibrar sua coleção`;
    
    return {
        titulo,
        alvo,
        uso,
        clima: contexto.clima || 'Temperado',
        faixa_preco: contexto.orcamento || 'R$ 300-800',
        justificativa,
        compras_faltantes: Math.max(1, comprasFaltantes)
    };
}

function gerarTituloMissao(familiaAlvo, familiaDominante, contexto, missaoIndex = 0) {
    const ambiente = contexto.ambiente ? contexto.ambiente.toLowerCase() : 'trabalho';
    const prefixo = missaoIndex === 0 ? '' : missaoIndex === 1 ? 'Alternativa: ' : 'Opção extra: ';
    
    const titulos = {
        '🍋 Fresco/Cítrico': `Adicionar frescor ${ambiente === 'aberto' ? 'para ambientes abertos' : 'discreto ao seu arsenal'}`,
        '🌳 Aromático/Verde': `Equilibrar com aromáticos ${ambiente === 'fechado' ? 'para trabalho' : 'versáteis'}`,
        '🍯 Doce/Gourmand': 'Adicionar doçura sem ficar enjoativo',
        '🪵 Amadeirado': `Conquistar elegância amadeirada para ${ambiente === 'fechado' ? 'TRABALHO' : 'NOITE'}`,
        '🌶️ Especiado/Oriental': 'Dominar especiarias orientais marcantes',
        '💧 Aquático/Mineral': 'Completar com aquático mineral moderno',
        '💧 Aquático': 'Completar com aquático mineral moderno', // Retrocompatibilidade
        '🧼 Talco/Fougère': 'Adicionar clássico talcado atemporal',
        '🌸 Floral/Floral Branco': 'Equilibrar com floral branco elegante',
        '🌸 Floral': 'Equilibrar com floral branco elegante', // Retrocompatibilidade
        '🍇 Frutado': 'Adicionar frutado jovial e energético'
    };
    
    const tituloBase = titulos[familiaAlvo] || `Equilibrar sua coleção com ${familiaAlvo}`;
    return prefixo + tituloBase;
}

function getAlvoEspecifico(familia) {
    const alvos = {
        '🍋 Fresco/Cítrico': '🍋 Cítrico limpo / Bergamota fresca',
        '🌳 Aromático/Verde': '🌳 Aromático verde / Lavanda',
        '🍯 Doce/Gourmand': '🍯 Doce equilibrado / Baunilha + madeira',
        '🪵 Amadeirado': '🪵 Amadeirado seco / Âmbar discreto',
        '🌶️ Especiado/Oriental': '🌶️ Especiaria oriental / Cardamomo + âmbar',
        '💧 Aquático/Mineral': '💧 Aquático mineral / Ozônio + sal marinho',
        '💧 Aquático': '💧 Aquático mineral / Ozônio + sal marinho', // Retrocompatibilidade
        '🧼 Talco/Fougère': '🧼 Fougère clássico / Talco + lavanda',
        '🌸 Floral/Floral Branco': '🌸 Floral branco / Jasmim + neroli',
        '🌸 Floral': '🌸 Floral branco / Jasmim + neroli', // Retrocompatibilidade
        '🍇 Frutado': '🍇 Frutado fresco / Maçã + bergamota'
    };
    
    return alvos[familia] || familia;
}

function getUsoSugerido(familia, contexto) {
    const usos = {
        '🍋 Fresco/Cítrico': 'Dia • trabalho • verão',
        '🌳 Aromático/Verde': 'Trabalho • casual • dia a dia',
        '🍯 Doce/Gourmand': 'Noite • encontros • inverno',
        '🪵 Amadeirado': 'Noite • eventos • ambientes fechados',
        '🌶️ Especiado/Oriental': 'Noite • ocasiões especiais • clima frio',
        '💧 Aquático/Mineral': 'Verão • esportes • casual • moderno',
        '💧 Aquático': 'Verão • esportes • casual • moderno', // Retrocompatibilidade
        '🧼 Talco/Fougère': 'Trabalho • formal • qualquer ocasião',
        '🌸 Floral/Floral Branco': 'Primavera • casual • dia • elegante',
        '🌸 Floral': 'Primavera • casual • dia • elegante', // Retrocompatibilidade
        '🍇 Frutado': 'Casual • dia • verão'
    };
    
    return usos[familia] || 'Diversas ocasiões';
}

function getFamiliaComMenosPerfumes(perfumesPorFamilia) {
    let minFamilia = null;
    let minCount = Infinity;
    
    for (const [familia, count] of Object.entries(perfumesPorFamilia)) {
        if (count < minCount) {
            minCount = count;
            minFamilia = familia;
        }
    }
    
    return minFamilia || '🪵 Amadeirado';
}

function enviarSugestoesWhatsApp(sugestoes) {
    let mensagem = '🎯 *Minha Missão - Mapa de Perfumes*\n\n';
    mensagem += '*Perfumes Recomendados:*\n\n';
    
    sugestoes.forEach((sug, i) => {
        const concentracao = sug.concentracao ? ` (${sug.concentracao})` : '';
        mensagem += `${i + 1}. *${sug.nome}${concentracao}*\n`;
        mensagem += `   🌿 ${sug.familia}\n`;
        mensagem += `   💰 ${sug.faixa_preco}\n`;
        mensagem += `   📝 ${sug.por_que}\n`;
        mensagem += `   ⏰ ${sug.quando_usar}\n\n`;
    });
    
    mensagem += '---\n';
    mensagem += '💡 Gerado por mapadeperfumes.com.br';
    
    const whatsappURL = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(whatsappURL, '_blank');
    
    // Track evento
    trackEvent('whatsapp_compartilhado', {
        total_sugestoes: sugestoes.length
    });
}

async function gerarNovasSugestoes() {
    const dadosAnalise = window.dadosAnaliseAtual;
    
    if (!dadosAnalise) {
        alert('❌ Erro: faça uma análise primeiro.');
        return;
    }
    
    // Incrementa contador (1 → 2 → 3 → 1...)
    window.conjuntoSugestaoAtual = ((window.conjuntoSugestaoAtual || 1) % 3) + 1;
    
    const conjuntoAtual = window.conjuntoSugestaoAtual;
    document.getElementById('conjuntoAtual').textContent = conjuntoAtual;
    // Mostra loading
    const container = document.getElementById('sugestoesContainer');
    container.innerHTML = '<div class="loading">🔍 Buscando novas sugestões<span class="loading-dots"></span></div>';
    
    try {
        const analise = dadosAnalise.analise_colecao || dadosAnalise.analise;
        const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
        const missaoIndex = window.missaoAtualIndex || 0;
        
        // Pega família alvo
        const top3_faltando = analise.top3_faltando || [];
        let familiaAlvo;
        if (top3_faltando.length > missaoIndex) {
            familiaAlvo = top3_faltando[missaoIndex];
        } else {
            familiaAlvo = getFamiliaComMenosPerfumes(analise.perfumes_por_familia);
        }
        
        // Monta prompt com REGRA DE MARCAS DIFERENTES
        const promptNovasSugestoes = `
PERFIL DO USUÁRIO:
Clima: ${perfil.clima || 'Temperado'}
Ambiente: ${perfil.ambiente || 'Ambos'}
Idade: ${perfil.idade || '25-35'} anos
Orçamento: ${perfil.orcamento || 'R$ 300-500'}

COLEÇÃO ATUAL (${minhaColecao.length} perfumes):
${minhaColecao.map((p, i) => `${i + 1}. ${p}`).join('\n')}

===========================================================
🚨 REGRA CRÍTICA - MARCAS DIFERENTES (OBRIGATÓRIO!) 🚨
===========================================================

Você DEVE sugerir EXATAMENTE 3 perfumes onde:

1️⃣ CADA perfume é de uma MARCA TOTALMENTE DIFERENTE
2️⃣ NUNCA repita a mesma marca entre os 3 perfumes
3️⃣ TODOS devem ser da família: ${familiaAlvo}

❌ EXEMPLOS PROIBIDOS (ERRADO):
- Dior Sauvage, Dior Homme, Versace Eros (Dior repetiu!)
- Paco Rabanne Invictus, Paco Rabanne 1 Million, Dior Sauvage (Paco Rabanne repetiu!)
- Versace Eros, Versace Dylan Blue, Armani Code (Versace repetiu!)

✅ EXEMPLOS CORRETOS:
- Dior Sauvage, Versace Eros, Paco Rabanne Invictus (3 marcas diferentes!)
- Creed Aventus, Tom Ford Oud Wood, Yves Saint Laurent La Nuit (3 marcas diferentes!)
- Montblanc Explorer, Carolina Herrera Bad Boy, Azzaro Wanted (3 marcas diferentes!)

===========================================================

===========================================================
💰 ORÇAMENTO - RESPEITE RIGOROSAMENTE! 💰
===========================================================

O usuário definiu orçamento de: ${perfil.orcamento || 'R$ 300-500'}

REGRAS DE ORÇAMENTO (INEGOCIÁVEIS):
${construirFaixaOrcamento()}

⚠️ R$ 300-500: ACEITE toda a faixa (nacionais e importados OK)
⚠️ R$ 500+: PRIORIZE o TOPO!

EXEMPLOS:
- Orçamento "R$ 300-500" → ✅ O Boticário Malbec (R$ 280), Phebo (R$ 350), Hugo Boss (R$ 450)
- Orçamento "R$ 800-1500" → ✅ Creed Aventus (R$ 1400), Tom Ford (R$ 1600)
- Orçamento "R$ 800-1500" → ❌ Mont Blanc (R$ 350) - MUITO ABAIXO!

===========================================================

REGRAS ADICIONAIS:
4️⃣ NÃO sugerir perfumes que o usuário já tem
5️⃣ VARIEDADE: Misture marcas conhecidas com nicho acessível
6️⃣ NÃO foque apenas em hidden gems - inclua best-sellers
7️⃣ EVITE repetir: ${window.perfumesJaSugeridos && window.perfumesJaSugeridos.length > 0 ? window.perfumesJaSugeridos.join(', ') : 'nenhum'}

EXEMPLOS DE VARIEDADE:
✅ Dior + Mancera + Montblanc (mainstream + nicho + intermediário)
❌ Phebo + Lalique + Rochas (só hidden gems)

RESPONDA COM 3 PERFUMES DE MARCAS DIFERENTES COM BOA VARIEDADE!
`;
        
        // Chama API
        const response = await fetch('https://operfumista-api.vercel.app/api/perfumista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: criarTimeoutSignal(),
            body: JSON.stringify({
                diagnostico: promptNovasSugestoes,
                categoria: perfil.categoria || 'masculino'
            })
        });
        
        const data = await response.json();
        let novasSugestoes = filtrarRecomendacoesDuplicadas(data.recomendacoes || []);

        if (novasSugestoes.length === 0) {
            container.innerHTML = '<p style="color: var(--tx3); text-align: center; padding: 20px;">Não foi possível gerar novas sugestões. Tente novamente.</p>';
            return;
        }
        
        // 🔍 VALIDAÇÃO 1: Verifica se há marcas repetidas
        const marcas = novasSugestoes.map(sug => {
            // Extrai primeira palavra do nome (geralmente é a marca)
            return (sug.nome || '').split(' ')[0].toLowerCase();
        });

        const marcasUnicas = new Set(marcas);
        const temMarcaRepetida = marcasUnicas.size < novasSugestoes.length;

        // 🔍 VALIDAÇÃO 2: Verifica orçamento
        const faixas = {
            'R$ 300-500': { min: 250, max: 600 },
            'R$ 500-800': { min: 400, max: 900 },
            'R$ 800-1500': { min: 700, max: 1700 },
            'Acima de R$ 1500': { min: 1500, max: 999999 }
        };

        const faixaUsuario = perfil.orcamento || 'R$ 300-500';
        const limites = faixas[faixaUsuario];

        let temForaDoOrcamento = false;
        if (limites) {
            novasSugestoes.forEach(sug => {
                // Extrai valores de faixa_preco (ex: "R$ 400-600")
                const match = sug.faixa_preco?.match(/(\d+)/g);
                if (match && match.length >= 1) {
                    const precoMin = parseInt(match[0]);
                    if (precoMin < limites.min || precoMin > limites.max) {
                        temForaDoOrcamento = true;
                    }
                }
            });
        }

        // As validações acima não bloqueiam a exibição (a IA já foi consultada e
        // pedir de novo custaria outra chamada) — mas avisam o usuário quando o
        // resultado foge do que foi pedido, em vez de mostrar como se estivesse tudo certo.
        const avisoValidacaoHtml = (temMarcaRepetida || temForaDoOrcamento)
            ? `<div style="background: rgba(255,152,0,.12); border: 1px solid #ff9800; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: .85em; color: #ff9800;">
                ⚠️ ${temMarcaRepetida && temForaDoOrcamento
                    ? 'Algumas sugestões repetem marca e fogem um pouco do orçamento configurado.'
                    : temMarcaRepetida
                        ? 'Algumas sugestões repetem a mesma marca.'
                        : 'Algumas sugestões fogem um pouco do orçamento configurado.'}
               </div>`
            : '';

        // Renderiza sugestões
        container.innerHTML = avisoValidacaoHtml + novasSugestoes.map((rec, i) => `
            <div class="candidate-item">
                ${renderizarCandidatoHTML(rec, i)}
            </div>
        `).join('');
        
        // Track evento
        trackEvent('novas_sugestoes_geradas', {
            conjunto: conjuntoAtual,
            familia: familiaAlvo,
            total_sugestoes: novasSugestoes.length
        });
        
    } catch (error) {
        container.innerHTML = '<p style="color: #ff6666; text-align: center; padding: 20px;">❌ Erro ao gerar sugestões. Tente novamente.</p>';
    }
}

async function gerarHiddenGems() {
    const dadosAnalise = window.dadosAnaliseAtual;
    
    if (!dadosAnalise) {
        alert('❌ Faça uma análise primeiro!');
        return;
    }
    
    const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
    const analise = dadosAnalise.analise_colecao || dadosAnalise.analise;
    
    // Pega família alvo
    const top3_faltando = analise.top3_faltando || [];
    const missaoIndex = window.missaoAtualIndex || 0;
    let familiaAlvo;
    
    if (top3_faltando.length > missaoIndex) {
        familiaAlvo = top3_faltando[missaoIndex];
    } else {
        familiaAlvo = getFamiliaComMenosPerfumes(analise.perfumes_por_familia);
    }
    const blacklist = JSON.parse(localStorage.getItem('perfumesBlacklist') || '[]');
    const naoSugerir = minhaColecao.concat(blacklist).concat(window.perfumesJaSugeridos || []);
    
    // Mostra loading
    document.getElementById('missionContent').innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
            <div class="analyzing-spinner" style="margin: 0 auto 20px;"></div>
            <div style="color: var(--or); font-size: 1.2em;">💎 Buscando Hidden Gems...</div>
            <div style="color: var(--tx3); margin-top: 10px;">Perfumes incríveis que poucos conhecem</div>
        </div>
    `;
    
    try {
        const prompt = `
PERFIL DO USUÁRIO:
Clima: ${perfil.clima || 'Temperado'}
Ambiente: ${perfil.ambiente || 'Ambos'}
Idade: ${perfil.idade || '25-35'} anos
Orçamento: ${perfil.orcamento || 'R$ 300-500'}

COLEÇÃO ATUAL (${minhaColecao.length} perfumes):
${minhaColecao.map((p, i) => `${i + 1}. ${p}`).join('\n')}

⚠️ NÃO SUGERIR:
${naoSugerir.join(', ')}

===========================================================
💎 MISSÃO ESPECIAL: HIDDEN GEMS
===========================================================

Sugira 3 HIDDEN GEMS (perfumes pouco conhecidos mas excelentes) da família: ${familiaAlvo}

CRITÉRIOS PARA HIDDEN GEMS:
✅ Perfumes de nicho ou independentes
✅ Marcas menos conhecidas (Phebo, Lalique, Rochas, Nishane, Afnan, etc)
✅ Menos de 5000 reviews no Fragantica
✅ Alta qualidade mas baixa popularidade
✅ Boa relação custo-benefício

===========================================================
💰 ORÇAMENTO - RESPEITE RIGOROSAMENTE! 💰
===========================================================

O usuário definiu orçamento de: ${perfil.orcamento || 'R$ 300-500'}

REGRAS DE ORÇAMENTO (INEGOCIÁVEIS):
${construirFaixaOrcamento()}

⚠️ R$ 300-500: ACEITE toda a faixa (nacionais e importados OK)
⚠️ R$ 500+: PRIORIZE o TOPO!

===========================================================

REGRAS:
1. TODOS os 3 devem ser da família ${familiaAlvo}
2. CADA perfume de MARCA DIFERENTE
3. Foco em marcas de nicho/independentes
4. Respeitar orçamento
5. Alta qualidade comprovada

Retorne 3 hidden gems incríveis!
`;

        const response = await fetch('https://operfumista-api.vercel.app/api/perfumista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: criarTimeoutSignal(),
            body: JSON.stringify({ diagnostico: prompt, categoria: perfil.categoria || 'masculino' })
        });
        
        const data = await response.json();
        data.recomendacoes = filtrarRecomendacoesDuplicadas(data.recomendacoes);

        if (!data.recomendacoes || data.recomendacoes.length === 0) {
            throw new Error('Sem recomendações');
        }
        
        // Salva no histórico
        data.recomendacoes.forEach(rec => {
            if (!window.perfumesJaSugeridos) window.perfumesJaSugeridos = [];
            if (!window.perfumesJaSugeridos.includes(rec.nome)) {
                window.perfumesJaSugeridos.push(rec.nome);
            }
        });
        
        // Renderiza as hidden gems
        renderizarMissaoGameficada({
            analise_colecao: analise,
            recomendacoes: data.recomendacoes,
            contexto_aplicado: {
                clima: perfil.clima,
                ambiente: perfil.ambiente,
                orcamento: perfil.orcamento
            }
        }, '💎 Hidden Gems Especiais');
        

        
    } catch (error) {
        document.getElementById('missionContent').innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #ff4444;">
                ❌ Erro ao buscar hidden gems. Tente novamente.
            </div>
        `;
    }
}

async function gerarNovaMissao() {
    const dadosAnalise = window.dadosAnaliseAtual;
    
    if (!dadosAnalise) {
        alert('❌ Erro: faça uma análise primeiro clicando em "Analisa minha Coleção" na aba Coleção.');
        return;
    }
    
    // Adiciona animação de mudança
    const missionContainer = document.getElementById('missionContainer');
    if (missionContainer) {
        missionContainer.classList.add('mission-changing');
    }
    
    // Pega índice atual e incrementa (0 → 1 → 2 → 0...)
    const missaoAtual = window.missaoAtualIndex || 0;
    const proximaMissao = (missaoAtual + 1) % 3;
    window.missaoAtualIndex = proximaMissao;
    // Mostra loading enquanto busca novas sugestões
    const resultContainer = document.getElementById('result-container');
    resultContainer.innerHTML = `
        <div class="analyzing-animation">
            <div class="analyzing-spinner"></div>
            <div class="analyzing-text">🔄 Gerando nova missão<span class="loading-dots"></span></div>
            <div class="analyzing-subtext">
                Buscando os melhores perfumes para a nova família
            </div>
        </div>
    `;
    
    try {
        // Pega dados da análise
        const analise = dadosAnalise.analise_colecao || dadosAnalise.analise;
        const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
        
        // Identifica as 3 famílias mais deficitárias
        const top3_faltando = analise.top3_faltando || [];
        
        // Seleciona a família alvo baseada no índice da missão
        let familiaAlvo;
        if (top3_faltando.length > proximaMissao) {
            familiaAlvo = top3_faltando[proximaMissao];
        } else {
            familiaAlvo = getFamiliaComMenosPerfumes(analise.perfumes_por_familia);
        }
        // Monta prompt específico para a família alvo
        const promptNovaMissao = `
PERFIL DO USUÁRIO:
Clima: ${perfil.clima || 'Temperado'}
Ambiente: ${perfil.ambiente || 'Ambos'}
Idade: ${perfil.idade || '25-35'} anos
Orçamento: ${perfil.orcamento || 'R$ 300-500'}

COLEÇÃO ATUAL (${minhaColecao.length} perfumes):
${minhaColecao.map((p, i) => `${i + 1}. ${p}`).join('\n')}

MISSÃO ESPECÍFICA:
Sugira EXATAMENTE 3 perfumes APENAS da família: ${familiaAlvo}

===========================================================
💰 ORÇAMENTO - RESPEITE RIGOROSAMENTE! 💰
===========================================================

O usuário definiu orçamento de: ${perfil.orcamento || 'R$ 300-500'}

REGRAS DE ORÇAMENTO (INEGOCIÁVEIS):
${construirFaixaOrcamento()}

⚠️⚠️⚠️ CRÍTICO: Se orçamento R$ 500+, pelo menos 2 dos 3 perfumes DEVEM estar no TOPO da faixa!

EXEMPLOS:
✅ R$ 800-1500: Creed Aventus (R$ 1.400), Tom Ford (R$ 1.600), Mancera (R$ 1.200)
❌ R$ 800-1500: Dior Sauvage (R$ 450), Hugo Boss (R$ 400), Mont Blanc (R$ 350) - INACEITÁVEL!

===========================================================

REGRAS CRÍTICAS:
1. TODOS os 3 perfumes devem ser da família ${familiaAlvo}
2. CADA perfume deve ser de uma MARCA DIFERENTE
3. NÃO sugira perfumes que o usuário já tem
4. VARIEDADE: Misture marcas conhecidas com nicho acessível
5. NÃO foque apenas em hidden gems - inclua best-sellers
6. EVITE repetir: ${window.perfumesJaSugeridos && window.perfumesJaSugeridos.length > 0 ? window.perfumesJaSugeridos.slice(-10).join(', ') : 'nenhum'}

EXEMPLOS DE VARIEDADE:
✅ Dior + Mancera + Montblanc (mainstream + nicho + intermediário)
❌ Só marcas desconhecidas (Phebo + Lalique + Rochas)

===========================================================
📦 FORMATO JSON OBRIGATÓRIO
===========================================================

Retorne JSON com este formato EXATO:
{
  "recomendacoes": [
    {
      "nome": "Dior Sauvage",
      "concentracao": "EDT",
      "familia": "${familiaAlvo}",
      "faixa_preco": "R$ 400-600",
      "por_que": "...",
      "quando_usar": "..."
    }
  ]
}

⚠️⚠️⚠️ O campo "concentracao" é OBRIGATÓRIO! (EDT/EDP/Parfum/Elixir)

IMPORTANTE: Missão focada em ${familiaAlvo} com BOA VARIEDADE DE MARCAS + CONCENTRAÇÃO!
`;
        
        // Chama API para novas sugestões
        const response = await fetch('https://operfumista-api.vercel.app/api/perfumista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: criarTimeoutSignal(),
            body: JSON.stringify({
                diagnostico: promptNovaMissao,
                categoria: perfil.categoria || 'masculino'
            })
        });
        
        const data = await response.json();
        
        // Se API retornou recomendações válidas (sem duplicar a coleção), usa elas. Senão, mantém as originais
        const recomendacoesFiltradas = filtrarRecomendacoesDuplicadas(data.recomendacoes);
        const novasRecomendacoes = (recomendacoesFiltradas && recomendacoesFiltradas.length > 0) ? recomendacoesFiltradas : dadosAnalise.recomendacoes;
        
        // Atualiza dados globais com novas recomendações
        window.dadosAnaliseAtual.recomendacoes = novasRecomendacoes;
        
        // Gera contexto
        const contexto_aplicado = {
            clima: perfil.clima || 'Temperado',
            ambiente: perfil.ambiente || 'Ambos',
            idade: perfil.idade || '25-35',
            orcamento: perfil.orcamento || 'R$ 300-500'
        };
        
        // Gera missão baseada no novo índice
        const missao = gerarMissao(analise, contexto_aplicado, proximaMissao);
        
        // HTML da missão com badge de número
        const missaoHTML = `
            <div class="mission-container" id="missionContainer">
                <!-- Card Principal da Missão -->
                <div class="mission-card">
                    <div class="mission-badge">🎯 MISSÃO ${proximaMissao + 1} de 3</div>
                    
                    <h2 class="mission-title">${missao.titulo}</h2>
                    
                    <div class="mission-details">
                        <div class="detail-row">
                            <strong>Alvo:</strong> ${missao.alvo}
                        </div>
                        <div class="detail-row">
                            <strong>Uso:</strong> ${missao.uso}
                        </div>
                        <div class="detail-row">
                            <strong>Clima:</strong> ${missao.clima}
                        </div>
                        <div class="detail-row">
                            <strong>Faixa ideal:</strong> ${missao.faixa_preco}
                        </div>
                    </div>
                    
                    <div class="mission-why">
                        <strong>Por quê?</strong><br>
                        ${missao.justificativa}
                    </div>
                    
                    <div class="mission-progress">
                        ✅ Você está <strong>${missao.compras_faltantes} ${missao.compras_faltantes === 1 ? 'compra' : 'compras'}</strong> de ter uma coleção redonda
                    </div>
                    
                    <div class="mission-actions">
                        <button class="btn-mission-secondary" onclick="gerarNovaMissao()" style="width: 100%;">
                            🔄 Quero outra missão
                        </button>
                    </div>
                </div>
                
                <!-- Card de Candidatos (sempre visível) -->
                <div class="candidates-card" style="display: block;">
                    <h3 style="color: var(--or); margin-bottom: 20px; font-size: 1.5em;">
                        🎁 Candidatos Perfeitos para sua Missão
                    </h3>
                    ${novasRecomendacoes.map((rec, i) => `
                        <div class="candidate-item">
                            ${renderizarCandidatoHTML(rec, i)}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        resultContainer.innerHTML = missaoHTML;
        
        // Remove a classe de animação após ela terminar (1.5s)
        setTimeout(() => {
            const missionContainer = document.getElementById('missionContainer');
            if (missionContainer) {
                missionContainer.classList.remove('mission-changing');
            }
        }, 1500);
        
    } catch (error) {
        // Em caso de erro, gera missão sem buscar novas sugestões (fallback)
        const analise = dadosAnalise.analise_colecao || dadosAnalise.analise;
        const recomendacoes = dadosAnalise.recomendacoes;
        const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
        
        const contexto_aplicado = {
            clima: perfil.clima || 'Temperado',
            ambiente: perfil.ambiente || 'Ambos',
            idade: perfil.idade || '25-35',
            orcamento: perfil.orcamento || 'R$ 300-500'
        };
        
        const missao = gerarMissao(analise, contexto_aplicado, proximaMissao);
        
        const missaoHTML = `
            <div class="mission-container" id="missionContainer">
                <div class="mission-card">
                    <div class="mission-badge">🎯 MISSÃO ${proximaMissao + 1} de 3</div>
                    <h2 class="mission-title">${missao.titulo}</h2>
                    <div class="mission-details">
                        <div class="detail-row"><strong>Alvo:</strong> ${missao.alvo}</div>
                        <div class="detail-row"><strong>Uso:</strong> ${missao.uso}</div>
                        <div class="detail-row"><strong>Clima:</strong> ${missao.clima}</div>
                        <div class="detail-row"><strong>Faixa ideal:</strong> ${missao.faixa_preco}</div>
                    </div>
                    <div class="mission-why">
                        <strong>Por quê?</strong><br>
                        ${missao.justificativa}
                    </div>
                    <div class="mission-progress">
                        ✅ Você está <strong>${missao.compras_faltantes} ${missao.compras_faltantes === 1 ? 'compra' : 'compras'}</strong> de ter uma coleção redonda
                    </div>
                    <div class="mission-actions">
                        <button class="btn-mission-secondary" onclick="gerarNovaMissao()" style="width: 100%;">
                            🔄 Quero outra missão
                        </button>
                    </div>
                </div>
                <div class="candidates-card" style="display: block;">
                    <h3 style="color: var(--or); margin-bottom: 20px; font-size: 1.5em;">
                        🎁 Candidatos para sua Missão
                    </h3>
                    ${recomendacoes.map((rec, i) => `
                        <div class="candidate-item">
                            ${renderizarCandidatoHTML(rec, i)}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        resultContainer.innerHTML = missaoHTML;
        
        // Remove a classe de animação após ela terminar (1.5s)
        setTimeout(() => {
            const missionContainer = document.getElementById('missionContainer');
            if (missionContainer) {
                missionContainer.classList.remove('mission-changing');
            }
        }, 1500);
    }
}

// ===================================
// INICIAR COLEÇÃO DO ZERO
// ===================================

async function iniciarColecaoDoZero() {
    const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
    
    if (!perfil.clima || !perfil.ambiente || !perfil.idade || !perfil.orcamento) {
        alert('⚠️ Por favor, preencha seu perfil primeiro na aba "Perfil"!');
        // Muda para aba perfil
        goSection('perfil');
        return;
    }
    
    // 🔒 VERIFICA ASSINATURA
    const isAssinante = await verificarAssinatura();
    if (!isAssinante) {
        mostrarModalAssinatura();
        return;
    }
    
    // 🔒 RATE LIMITING: Verifica se pode usar (3 vezes VITALÍCIO)
    if (window.rateLimiter) {
        const checkLimite = window.rateLimiter.podeExecutar('dicas');
        if (!checkLimite.pode) {
            mostrarPopupLimite('dicas', checkLimite.total, checkLimite.proximoReset);
            return;
        }
    }

    // Muda para aba sugestões
    goSection('sugestoes');
    
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = `
        <div class="analyzing-animation">
            <div class="analyzing-spinner"></div>
            <div class="analyzing-text">🌱 Criando sua coleção inicial<span class="loading-dots"></span></div>
            <div class="analyzing-subtext">
                Analisando seu perfil e selecionando os<br>
                3 perfumes essenciais para começar
            </div>
        </div>
    `;
    
    try {
        const contextoInicio = `
Quero COMEÇAR minha coleção de perfumes do zero.

MEU CONTEXTO:
- Clima: ${perfil.clima}
- Ambiente de trabalho: ${perfil.ambiente}
- Faixa etária: ${perfil.idade}
- Orçamento: ${perfil.orcamento}

===========================================================
🎯 OBJETIVO: 3 PERFUMES ESSENCIAIS PARA COMEÇAR
===========================================================

Sugira 3 perfumes que cobrem as funções básicas:
1. DIA/TRABALHO - Versátil, discreto, profissional
2. NOITE/SOCIAL - Marcante, sofisticado, sexy  
3. VERSÁTIL - Funciona em várias ocasiões

===========================================================
💰 ORÇAMENTO - RESPEITE RIGOROSAMENTE! 💰
===========================================================

O usuário definiu orçamento de: ${perfil.orcamento}

REGRAS DE ORÇAMENTO (INEGOCIÁVEIS):
${construirFaixaOrcamento()}

⚠️ R$ 300-500: ACEITE toda a faixa (nacionais e importados OK)
⚠️ R$ 500+: PRIORIZE o TOPO!

===========================================================
🎨 VARIEDADE DE MARCAS
===========================================================

PRIORIZE perfumes CONHECIDOS e ACESSÍVEIS para iniciantes:
✅ Dior, Versace, Paco Rabanne, Calvin Klein, Hugo Boss
✅ Armani, YSL, Carolina Herrera, Dolce & Gabbana
✅ O Boticário, Natura, Phebo (nacionais OK para faixa baixa)

NÃO sugira apenas nicho/hidden gems para iniciantes!
Iniciantes precisam de clássicos confiáveis e fáceis de achar.

IMPORTANTE: 3 marcas DIFERENTES + dentro do orçamento + adequados ao clima!
        `.trim();
        
        const response = await fetch('https://operfumista-api.vercel.app/api/perfumista', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: criarTimeoutSignal(),
            body: JSON.stringify({
                iniciar_colecao: true,
                contexto: contextoInicio,
                categoria: perfil.categoria || 'masculino',
                clima: perfil.clima,
                ambiente: perfil.ambiente,
                idade: perfil.idade,
                orcamento: perfil.orcamento
            })
        });
        
        const data = await response.json();
        
        // Renderiza sugestões iniciais
        let html = `
            <div class="chat-message assistant">
                <div class="chat-message-header">🧪 Perfumista</div>
                <div class="chat-message-content">
                    <strong>🌱 Sua Coleção Inicial Perfeita!</strong><br><br>
                    Baseado no seu perfil, aqui estão 3 perfumes essenciais para começar:
                    <div class="suggestions-grid" style="margin-top: 20px;">`;
        
        if (data.recomendacoes && data.recomendacoes.length > 0) {
            data.recomendacoes.forEach(sug => {
                html += `
                    <div class="suggestion-card">
                        <div class="suggestion-name">${esc(sug.nome)}${sug.concentracao ? ' <span style="color: var(--or);">(' + esc(sug.concentracao) + ')</span>' : ''}</div>
                        <div class="suggestion-familia">${esc(sug.familia)}</div>
                        <div class="suggestion-preco">${esc(sug.faixa_preco)}</div>
                        <div class="suggestion-por-que">${esc(sug.por_que)}</div>
                        <div class="suggestion-quando">${esc(sug.quando_usar)}</div>
                    </div>
                `;
            });
        }
        
        html += `
                    </div>
                </div>
            </div>
        `;
        
        chatMessages.innerHTML = html;
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // 📊 REGISTRA uso do Rate Limit (VITALÍCIO)
        if (window.rateLimiter) window.rateLimiter.registrarUso('dicas');
        if (typeof atualizarContadores === 'function') atualizarContadores();

    } catch (error) {
        chatMessages.innerHTML = `
            <div class="chat-message assistant">
                <div class="chat-message-header">🧪 Perfumista</div>
                <div class="chat-message-content">
                    ❌ Erro ao criar sugestões. Tente novamente.
                </div>
            </div>
        `;
    }
}

// ===================================
// INICIALIZAÇÃO
// ===================================

// ===================================
// CONTADORES E POPUPS DE LIMITE
// (mostrarPopupLimite/fecharPopupLimite vêm de rate-limiting-system.js —
// a versão que existia aqui esperava proximoReset como Date, mas
// window.rateLimiter.podeExecutar() sempre devolveu string já formatada,
// então as duas nunca foram realmente compatíveis)
// ===================================

// ===================================
// SALVAR/CARREGAR RADAR E ANÁLISE
// ===================================

function salvarRadarNoStorage(dados) {
    localStorage.setItem('radarSalvo', JSON.stringify({
        dados: dados,
        timestamp: Date.now(),
        colecao: minhaColecao.slice() // Cópia da coleção atual
    }));
}

function carregarRadarDoStorage() {
    const radarSalvo = localStorage.getItem('radarSalvo');
    if (!radarSalvo) {
        return null;
    }
    
    try {
        const { dados, timestamp, colecao } = JSON.parse(radarSalvo);
        
        if (!dados || !colecao) {
            return null;
        }
        
        // Normaliza coleções para comparação (suporta string e objeto)
        const normalizarColecao = (col) => {
            return col.map(p => {
                const nome = typeof p === 'string' ? p : p.nome;
                return nome.toLowerCase();
            }).sort();
        };
        
        const colecaoAtualNorm = normalizarColecao(minhaColecao);
        const colecaoSalvaNorm = normalizarColecao(colecao);
        
        const colecaoAtual = JSON.stringify(colecaoAtualNorm);
        const colecaoSalvaStr = JSON.stringify(colecaoSalvaNorm);
        
        if (colecaoAtual !== colecaoSalvaStr) {
            return null;
        }
        return dados;
    } catch (error) {
        return null;
    }
}

// ══════════════════════════════════════════
// NOVOS RECURSOS: UPLOAD / BUSCA / CTA / CHIPS
// ══════════════════════════════════════════

// ── UPLOAD DE ARQUIVO ──
(function(){
    const banner   = document.getElementById('upload-banner');
    const dz       = document.getElementById('upload-dz');
    const fi       = document.getElementById('upload-file-input');
    const st       = document.getElementById('upload-status');
    const dismiss  = document.getElementById('upload-dismiss-btn');

    if(localStorage.getItem('mapa_upload_ok')) banner.style.display = 'none';

    dismiss.addEventListener('click', () => {
        banner.style.display = 'none';
        localStorage.setItem('mapa_upload_ok', '1');
    });

    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dg'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dg'));
    dz.addEventListener('drop', e => {
        e.preventDefault(); dz.classList.remove('dg');
        if(e.dataTransfer.files[0]) processarArquivo(e.dataTransfer.files[0]);
    });
    fi.addEventListener('change', function(){ if(this.files[0]) processarArquivo(this.files[0]); });

    async function processarArquivo(f){
        const ext = f.name.split('.').pop().toLowerCase();
        if(!['pdf','txt','doc','docx'].includes(ext)){
            setStatus('⚠️ Use PDF, TXT ou Word (.doc/.docx).', 'er'); return;
        }
        setStatus('⏳ Lendo arquivo...', 'ld');
        try{
            const txt = ext === 'pdf' ? await lerPdf(f) : await lerTexto(f);
            if(!txt.trim()) throw new Error('vazio');
            const nomes = parsearPerfumes(txt);
            if(!nomes.length) throw new Error('nenhum');
            let adicionados = 0;
            nomes.forEach(nome => {
                const jatem = minhaColecao.some(p => {
                    const n = typeof p === 'string' ? p : p.nome;
                    return n.toLowerCase() === nome.toLowerCase();
                });
                if(!jatem){ minhaColecao.push({ nome, concentracao: 'EDP' }); adicionados++; }
            });
            localStorage.setItem('minhaColecao', JSON.stringify(minhaColecao));
            renderizarLista();
            atualizarNivelDOM();
            atualizarCtaAnalise();
            atualizarBuscaVisibilidade();
            setStatus('✅ ' + adicionados + ' perfume(s) importado(s)!', 'ok');
            // Fecha banner após sucesso
            setTimeout(() => {
                banner.style.display = 'none';
                localStorage.setItem('mapa_upload_ok', '1');
            }, 3000);
        } catch(e){
            setStatus('❌ Não foi possível extrair perfumes do arquivo.', 'er');
        }
    }

    function setStatus(msg, cls){
        st.textContent = msg;
        st.className = 'upload-status ' + cls;
    }

    function parsearPerfumes(txt){
        const linhas = txt.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);

        // Detecta formato tabular com células por linha (PDF com colunas)
        // Padrão: número sozinho numa linha, seguido de Marca, Nome, Perfumista...
        const reNum = /^\d+$/;
        const reHeader = /^(#|Marca|Nome|Perfumista|Família|Gênero|Notas|Coleção|Total:)/i;
        const reNotas = /^(Limão|Bergamota|Oud|Âmbar|Baunilha|Rosa|Jasmim|Cedro|Patchouli|Lavanda|Almíscar|Incenso|Especiarias|Couro|Sândalo|Tabaco|Canela|Madeira|Vetiver|Gengibre|Notas|limão|bergamota)/i;
        const reFamilia = /^(Oriental|Amadeirado|Aromático|Cítrico|Floral|Frutado|Aquático|Talco|Especiado|Gourmand|Chipre|Fougère|Almíscarado|Ambarado|Resinoso|Aldeídico|Unissex|Masculino|Feminino|Não informado)/i;

        // Conta quantas linhas são números puros — se houver muitos, é tabela
        const numLinhas = linhas.filter(l => reNum.test(l)).length;

        if (numLinhas > 5) {
            // Formato tabela (célula por linha)
            // Padrão de cada perfume: [num] [marca] [nome] [perfumista?] [família] [gênero] [notas]
            const resultado = [];
            let i = 0;
            while (i < linhas.length) {
                // Pula headers e linhas de título
                if (reHeader.test(linhas[i])) { i++; continue; }

                // Encontrou número de índice
                if (reNum.test(linhas[i])) {
                    i++; // pula o número
                    if (i >= linhas.length) break;

                    // Próxima linha: Marca
                    const marca = linhas[i]; i++;
                    if (i >= linhas.length) { resultado.push(marca); break; }

                    // Próxima linha: Nome do perfume
                    let nome = linhas[i];

                    // Verifica se é nome ou já é família/gênero/notas
                    if (!reFamilia.test(nome) && !reNotas.test(nome) && nome.length > 1) {
                        i++; // consome o nome
                        resultado.push(`${marca} ${nome}`.trim());
                    } else {
                        // Nome ausente — usa só a marca
                        resultado.push(marca);
                    }
                    continue;
                }
                i++;
            }

            if (resultado.length > 3) {
                return resultado.filter(n => n.length > 2 && n.length < 150);
            }
        }

        // Formato lista simples (uma linha por perfume)
        const reDash = /^(.+?)\s*[–\-—]\s*(.+)$/;
        return linhas
            .filter(l => !/^\d+$/.test(l) && !reHeader.test(l) && l.length < 150 && l.length > 2)
            .map(l => {
                const m = l.match(reDash);
                return m ? capitalize(m[2].trim()) + ' — ' + capitalize(m[1].trim()) : capitalize(l);
            })
            .filter(n => n.length > 2);
    }

    function lerTexto(f){ return new Promise((r,j) => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.onerror = j; rd.readAsText(f,'utf-8'); }); }

    async function lerPdf(f){
        if(typeof pdfjsLib === 'undefined') throw new Error('pdfjs não carregado');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
        let txt = '';
        for(let i = 1; i <= pdf.numPages; i++){
            const pg = await pdf.getPage(i);
            const ct = await pg.getTextContent();
            let uy = null, ln = [];
            ct.items.forEach(it => {
                const y = Math.round(it.transform[5]);
                if(uy !== null && Math.abs(y - uy) > 3){ txt += ln.join('') + '\n'; ln = []; }
                ln.push(it.str); uy = y;
            });
            if(ln.length) txt += ln.join('') + '\n';
        }
        return txt;
    }

    function capitalize(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
})();

// ── BUSCA NA COLEÇÃO ──
const _colecaoSearchInput = document.getElementById('colecao-search-input');
let _buscaColecao = '';

function atualizarBuscaVisibilidade(){
    const wrap = document.getElementById('colecao-search-wrap');
    if(wrap) wrap.style.display = minhaColecao.length > 0 ? 'block' : 'none';
}

if(_colecaoSearchInput){
    _colecaoSearchInput.addEventListener('input', function(){
        _buscaColecao = this.value.toLowerCase().trim();
        _renderizarListaFiltrada();
    });
}

function _renderizarListaFiltrada(){
    const container = document.getElementById('perfume-list');
    if(!container) return;
    const countSpan = document.getElementById('perfume-count');

    const filtrados = _buscaColecao
        ? minhaColecao.filter(p => {
            const nome = typeof p === 'string' ? p : p.nome;
            return nome.toLowerCase().includes(_buscaColecao);
          })
        : minhaColecao;

    if(countSpan) countSpan.textContent = minhaColecao.length;

    if(filtrados.length === 0){
        container.innerHTML = _buscaColecao
            ? '<p style="text-align:center;color:#777;padding:20px">🔍 Nenhum perfume encontrado.</p>'
            : '<p style="text-align: center; color: var(--tx3); padding: 20px;">Nenhum perfume adicionado ainda</p>';
        return;
    }

    const concAbrev = { 'Eau de Parfum':'EDP','Eau de Toilette':'EDT','Eau de Cologne':'EDC','Parfum':'Parfum','Elixir':'Elixir','Extrait':'Extrait','EDP':'EDP','EDT':'EDT' };

    container.innerHTML = filtrados.map((perfume, index) => {
        const nome = typeof perfume === 'string' ? perfume : perfume.nome;
        const concentracao = typeof perfume === 'string' ? 'EDP' : (perfume.concentracao || 'EDP');
        const displayConc = concAbrev[concentracao] || concentracao;
        const idxReal = minhaColecao.indexOf(perfume);
        return `<div class="perfume-item">
            <span class="perfume-name">${esc(nome)}
                <span style="color:var(--or);font-size:.8em;font-weight:600;background:rgba(232,93,4,.15);padding:2px 8px;border-radius:12px;margin-left:8px">${displayConc}</span>
            </span>
            <button class="remove-button" onclick="removerPerfume(${idxReal})">🗑️ Remover</button>
        </div>`;
    }).join('');
}

// ── PATCH SEGURO: após cada renderizarLista, reaplicar filtro se busca ativa ──
// Usamos um flag para evitar recursão
let _aplicandoFiltro = false;
const _rlOrigRef = typeof renderizarLista === 'function' ? renderizarLista : null;

if(_rlOrigRef){
    // Guarda referência antes de redefinir
    window._renderizarListaSemFiltro = _rlOrigRef;

    // Redefine com wrapper seguro
    window.renderizarLista = function(){
        if(_aplicandoFiltro){ _renderizarListaSemFiltro(); return; }
        _renderizarListaSemFiltro();
        atualizarBuscaVisibilidade();
        atualizarCtaAnalise();
        if(_buscaColecao){
            _aplicandoFiltro = true;
            _renderizarListaFiltrada();
            _aplicandoFiltro = false;
        }
    };
}

// Patch não-recursivo já aplicado acima.

// ── CTA ANÁLISE ──
function atualizarCtaAnalise(){
    const cta = document.getElementById('cta-analise-banner');
    if(!cta) return;
    const temAnalise = !!localStorage.getItem('ultimaAnalise');
    if(minhaColecao.length >= 3 && !temAnalise){
        cta.classList.add('show');
    } else {
        cta.classList.remove('show');
    }
}

// ── CHIPS DE ATALHO NO CHAT ──
function usarChip(btn){
    const input = document.getElementById('chat-input');
    if(!input) return;
    input.value = btn.textContent.replace(/^[^\w]+/, '').trim();
    // Oculta chips após usar
    const chips = document.getElementById('chat-chips-mapa');
    if(chips) chips.style.display = 'none';
    input.focus();
    // Dispara envio
    if(typeof enviarPergunta === 'function') enviarPergunta();
}

function usarChipWishlist() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    input.value = 'Minha wishlist vai melhorar minha coleção? Qual devo comprar primeiro?';
    const chips = document.getElementById('chat-chips-mapa');
    if (chips) chips.style.display = 'none';
    input.focus();
    if (typeof enviarPergunta === 'function') enviarPergunta();
}

// Mostra chip de wishlist quando o usuário tem desejos salvos
function atualizarChipWishlist() {
    const chip = document.getElementById('chip-wishlist');
    if (chip) chip.style.display = wishes.length > 0 ? 'inline-flex' : 'none';
}

// Inicializa estado de busca e CTA ao carregar
window.addEventListener('DOMContentLoaded', () => {
    atualizarBuscaVisibilidade();
    atualizarCtaAnalise();
    atualizarChipWishlist();
    // FAB visível por padrão (aba inicial = Perfil, não é Perfumista)
    const fab = document.getElementById('chat-fab');
    if (fab) fab.style.display = 'flex';
});

// ══════════════════════════════════════════════════════
// NOVOS RECURSOS: MISSÃO SEMANAL + RANKING + NÍVEL HERO
// ══════════════════════════════════════════════════════

// ── Níveis Perfumap ──
const PM_NIVEIS = [
    {min:0,   max:10,  emoji:'🌱', titulo:'Iniciante',    cor:'#2ECC71', bonus:0},
    {min:11,  max:25,  emoji:'🔥', titulo:'Entusiasta',   cor:'#F59E0B', bonus:10},
    {min:26,  max:50,  emoji:'💎', titulo:'Colecionador', cor:'#3B82F6', bonus:25},
    {min:51,  max:100, emoji:'🏆', titulo:'Expert',       cor:'#8B5CF6', bonus:50},
    {min:101, max:9999,emoji:'👑', titulo:'Curador',      cor:'#E85D04', bonus:100},
];

function pmCalcNivel(n) { return PM_NIVEIS.find(v => n >= v.min && n <= v.max) || PM_NIVEIS[PM_NIVEIS.length - 1]; }

function pmCalcScore() {
    const perfumes = minhaColecao;
    const n = perfumes.length;
    const nv = pmCalcNivel(n);
    // conta famílias únicas da coleção atual
    const famsClass = new Set(perfumes.filter(p => typeof p === 'object' && p.familia).map(p => p.familia)).size;
    return { total: n + (famsClass * 10) + nv.bonus, perfumes: n, familias: famsClass, nivelBonus: nv.bonus, nivel: nv };
}

// ── Render Nível Hero (Perfumap style) ──
function pmRenderNivel() {
    const sc = pmCalcScore();
    const nv = sc.nivel;
    const prox = PM_NIVEIS.find(v => v.min > nv.min);
    const hero = document.getElementById('pm-nivel-hero');
    if (!hero) return;
    hero.style.display = 'block';
    hero.style.borderColor = nv.cor + '55';
    document.getElementById('pm-nv-badge').textContent = nv.emoji;
    document.getElementById('pm-nv-badge').style.cssText = `background:${nv.cor}22;box-shadow:0 0 16px ${nv.cor}44;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0`;
    document.getElementById('pm-nv-titulo').textContent = nv.titulo;
    document.getElementById('pm-nv-titulo').style.color = nv.cor;
    const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
    document.getElementById('pm-nv-nome').textContent = perfil.nome || 'Colecionador';
    document.getElementById('pm-nv-sub').textContent = `${sc.perfumes} perfume${sc.perfumes !== 1 ? 's' : ''} na coleção`;
    if (prox) {
        const pct = Math.round(((sc.perfumes - nv.min) / (prox.min - nv.min)) * 100);
        document.getElementById('pm-nv-bar').style.cssText = `width:${Math.min(pct,100)}%;background:${nv.cor};height:100%;border-radius:4px;transition:width .6s ease`;
        document.getElementById('pm-nv-cur').textContent = sc.perfumes;
        document.getElementById('pm-nv-next').textContent = `próximo: ${prox.min}`;
    } else {
        document.getElementById('pm-nv-bar').style.cssText = `width:100%;background:${nv.cor};height:100%;border-radius:4px`;
        document.getElementById('pm-nv-cur').textContent = sc.perfumes;
        document.getElementById('pm-nv-next').textContent = 'Nível máximo 👑';
    }
}

// ── Missão Semanal ──

// ══════════════════════════════════════
// RESUMO — TELA PRINCIPAL PÓS-ANÁLISE
// ══════════════════════════════════════

const FAMILIA_CONFIG = {
    'Amadeirado':  { icon: '🪵', bg: 'linear-gradient(135deg,#3d1f00,#7a3e00)' },
    'Aquático':    { icon: '💧', bg: 'linear-gradient(135deg,#001a3d,#0052a3)' },
    'Fresco':      { icon: '🌬️', bg: 'linear-gradient(135deg,#003d1a,#007a35)' },
    'Cítrico':     { icon: '🍋', bg: 'linear-gradient(135deg,#3d3a00,#9e9500)' },
    'Oriental':    { icon: '✨', bg: 'linear-gradient(135deg,#3d2800,#9e6800)' },
    'Fougère':     { icon: '🌲', bg: 'linear-gradient(135deg,#1a3d00,#3d8c00)' },
    'Gourmand':    { icon: '🍫', bg: 'linear-gradient(135deg,#3d1a00,#8c4500)' },
    'Floral':      { icon: '🌸', bg: 'linear-gradient(135deg,#3d001a,#8c0045)' },
    'Chypre':      { icon: '💎', bg: 'linear-gradient(135deg,#2a1a3d,#5a3d8c)' },
    'Aromático':   { icon: '🌿', bg: 'linear-gradient(135deg,#1a3d1a,#3d7a3d)' },
    'Especiado':   { icon: '🌶️', bg: 'linear-gradient(135deg,#3d1500,#9e3800)' },
    'Talco':       { icon: '🫧', bg: 'linear-gradient(135deg,#1a1a3d,#3d3d8c)' },
};

function _famConfig(familia) {
    if (!familia) return { icon: '🧴', bg: 'linear-gradient(135deg,#222,#444)' };
    for (const key of Object.keys(FAMILIA_CONFIG)) {
        if (familia.toLowerCase().includes(key.toLowerCase())) return FAMILIA_CONFIG[key];
    }
    return { icon: '🧴', bg: 'linear-gradient(135deg,#222,#444)' };
}

function gerarLeituraColecao(analise) {
    const dom = analise.familia_dominante || {};
    const faltando = analise.top3_faltando || [];
    const total = analise.total_perfumes || 0;
    const familias = analise.familias_representadas || 0;
    const nomeDom = (dom.nome || '').toLowerCase();

    let intro = '';
    if (nomeDom.includes('amadeirado') || nomeDom.includes('oriental') || nomeDom.includes('especiado')) {
        intro = `Sua coleção tem identidade forte — concentrada em perfumes ${dom.nome ? dom.nome.toLowerCase() + 's' : 'com personalidade definida'}, com presença marcante e sofisticação.`;
    } else if (nomeDom.includes('fresco') || nomeDom.includes('aquático') || nomeDom.includes('cítrico')) {
        intro = `Sua coleção é leve e funcional — dominada por perfumes ${dom.nome ? dom.nome.toLowerCase() + 's' : 'frescos'}, versáteis e fáceis de usar no dia a dia.`;
    } else if (dom.nome) {
        intro = `Sua coleção tem gosto definido — com domínio em perfumes ${dom.nome.toLowerCase()}s e identidade olfativa própria.`;
    } else {
        intro = `Com ${total} perfume${total !== 1 ? 's' : ''} e ${familias} famíli${familias !== 1 ? 'as' : 'a'} representad${familias !== 1 ? 'as' : 'a'}, sua coleção já tem boa diversidade.`;
    }

    let destaque = '';
    if (faltando.length > 0) {
        destaque = `O que falta é contraste: sua coleção carece de ${faltando.slice(0, 2).join(' e ')}. ${analise.equilibrio?.mensagem || 'Adicionar essas famílias vai ampliar as ocasiões de uso.'}`;
    } else {
        destaque = analise.equilibrio?.mensagem || 'Sua coleção está bem equilibrada entre as famílias olfativas.';
    }
    return { intro, destaque };
}

function gerarResumoEstrategico(recs) {
    const contextos = [
        { keys: ['dia', 'diári', 'daytime', 'casual'], icon: '☀️', label: 'Uso diário' },
        { keys: ['calor', 'verão', 'quente', 'verao'], icon: '🔥', label: 'Calor' },
        { keys: ['noite', 'evento', 'balada', 'jantar'], icon: '🌙', label: 'Noite' },
        { keys: ['trabalho', 'escritório', 'formal', 'work'], icon: '💼', label: 'Trabalho' },
        { keys: ['versátil', 'versatil', 'todas'], icon: '⚡', label: 'Versátil' },
        { keys: ['assinatura', 'identidade', 'marcante'], icon: '💍', label: 'Assinatura' },
    ];
    const result = [];
    const used = new Set();
    for (const ctx of contextos) {
        if (result.length >= 4) break;
        for (const rec of recs) {
            if (used.has(rec.nome)) continue;
            const txt = ((rec.quando_usar || '') + ' ' + (rec.por_que || '')).toLowerCase();
            if (ctx.keys.some(k => txt.includes(k))) {
                result.push({ icon: ctx.icon, label: ctx.label, perfume: rec.nome });
                used.add(rec.nome);
                break;
            }
        }
    }
    // Fallback: fill with remaining recs
    const fallbacks = [
        { icon: '☀️', label: 'Primeira escolha' },
        { icon: '🌙', label: 'Segunda escolha' },
        { icon: '⚡', label: 'Versatilidade' },
        { icon: '💍', label: 'Assinatura' },
    ];
    recs.slice(0, 4).forEach((rec, i) => {
        if (!used.has(rec.nome) && result.length < 4) {
            result.push({ icon: fallbacks[i]?.icon || '✨', label: fallbacks[i]?.label || 'Sugestão', perfume: rec.nome });
            used.add(rec.nome);
        }
    });
    return result;
}

function renderizarResumo() {
    const container = document.getElementById('resumo');
    if (!container) return;
    const ultimaAnalise = JSON.parse(localStorage.getItem('ultimaAnalise') || '{}');

    if (!ultimaAnalise.dados) {
        container.innerHTML = `
            <div class="resumo-topbar">
                <div class="resumo-topbar-title">perfu<span>map</span></div>
                <button class="resumo-settings-btn" onclick="goSection('perfil')">⚙️ Perfil</button>
            </div>
            <div class="container">
                <div class="resumo-empty">
                    <div class="resumo-empty-ico">🔮</div>
                    <h2>Seu resumo ainda não existe</h2>
                    <p>Vá em <strong>Coleção</strong>, adicione seus perfumes e clique em <strong>Analisar</strong>. Seu resumo personalizado aparecerá aqui.</p>
                    <button class="resumo-empty-btn" onclick="goSection('colecao')">Ir para Coleção →</button>
                </div>
            </div>`;
        return;
    }

    const dados = ultimaAnalise.dados;
    const analise = dados.analise_colecao || {};
    const recs = dados.recomendacoes || [];
    const nivel = analise.nivel || {};
    const faltando = analise.top3_faltando || [];
    const dominante = analise.familia_dominante || {};

    const leitura = gerarLeituraColecao(analise);
    const estrategico = gerarResumoEstrategico(recs);

    const faltandoChips = faltando.map(f => `<span class="resumo-chip-deficit">⚠ ${esc(f)}</span>`).join('');
    const dominanteChip = dominante.nome ? `<span class="resumo-chip-ok">✓ ${esc(dominante.nome)}</span>` : '';

    const cardsHtml = recs.map((rec, i) => {
        const fc = _famConfig(rec.familia);
        return `
        <div class="resumo-rec-card">
            <div class="resumo-rec-top">
                <div class="resumo-rec-img" style="background:${fc.bg}">${fc.icon}</div>
                <div class="resumo-rec-info">
                    <div class="resumo-rec-num">${String(i + 1).padStart(2, '0')}</div>
                    <div class="resumo-rec-nome">${esc(rec.nome)}</div>
                    <div class="resumo-rec-tags">
                        <span class="resumo-tag-fam">${esc(rec.familia || '')}</span>
                        <span class="resumo-tag-preco">${esc(rec.faixa_preco || '')}</span>
                    </div>
                </div>
            </div>
            <div class="resumo-rec-body">
                <div class="resumo-rec-linha">
                    <span class="resumo-rec-ico">💡</span>
                    <div>
                        <div class="resumo-rec-label">Por que</div>
                        <div class="resumo-rec-val">${esc(rec.por_que || '')}</div>
                    </div>
                </div>
                <div class="resumo-rec-linha">
                    <span class="resumo-rec-ico">🕐</span>
                    <div>
                        <div class="resumo-rec-label">Quando usar</div>
                        <div class="resumo-rec-val">${esc(rec.quando_usar || '')}</div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    const estrategicoHtml = estrategico.map(item => `
        <div class="resumo-estrategico-item">
            <div class="resumo-est-icon">${item.icon}</div>
            <div class="resumo-est-label">${item.label}</div>
            <div class="resumo-est-val">${esc(item.perfume)}</div>
        </div>`).join('');

    container.innerHTML = `
        <div class="resumo-topbar">
            <div class="resumo-topbar-title">perfu<span>map</span></div>
            <button class="resumo-settings-btn" onclick="goSection('perfil')">⚙️ Perfil</button>
        </div>
        <div class="resumo-content">
            <div class="resumo-nivel-badge">
                <span class="resumo-nivel-ico">${nivel.emoji || '🎯'}</span>
                <span class="resumo-nivel-txt">${nivel.titulo || 'Colecionador'} · ${analise.total_perfumes || 0} perfumes</span>
            </div>
            <div class="resumo-leitura-card">
                <div class="resumo-section-label">◆ Leitura da Coleção</div>
                <p class="resumo-leitura-text">${leitura.intro}</p>
                <div class="resumo-leitura-destaque">${leitura.destaque}</div>
            </div>
            ${(faltandoChips || dominanteChip) ? `
            <div class="resumo-familias-card">
                <div class="resumo-section-label">📊 Famílias mais deficitárias</div>
                <div class="resumo-chips-row">${faltandoChips}${dominanteChip}</div>
            </div>` : ''}
            <div>
                <div class="resumo-sugestoes-header">
                    <div class="resumo-section-label" style="margin:0">🎯 ${recs.length} sugestão${recs.length !== 1 ? 'ões' : ''} para sua coleção</div>
                    <span class="resumo-count-badge">Personalizadas</span>
                </div>
                <div class="resumo-cards-list">${cardsHtml}</div>
            </div>
            ${estrategicoHtml ? `
            <div class="resumo-estrategico-card">
                <div class="resumo-estrategico-title">✦ Resumo Estratégico</div>
                <div class="resumo-estrategico-grid">${estrategicoHtml}</div>
            </div>` : ''}
            <button class="resumo-reanalisar-btn" onclick="goSection('colecao')">🔄 Atualizar coleção</button>
        </div>`;
}

// ── Hook na aba Missão: estende goSection ──
// goSection já existe como function — adicionamos side-effects via evento
const _origGoSection = goSection;
window.goSection = function goSection(section) {
    _origGoSection(section);
    if (section === 'missao') {
        // pmRenderNivel(); // handled by atualizarNivelDOM
    }
    if (section === 'resumo') renderizarResumo();
};

// ── Atualiza nível ao adicionar/remover perfumes (via evento customizado) ──
document.addEventListener('pm:colecao:mudou', () => {
    if (document.getElementById('missao')?.classList.contains('active')) {
        // pmRenderNivel(); // handled by atualizarNivelDOM
    }
});

carregarPerfil();

renderizarLista();

// Tenta carregar análise salva (radar + missão)
// 🎯 RENDERIZA TUDO DO LOCALSTORAGE (fonte única)
renderizarTudoDoLocalStorage();

// Roteamento inicial: se tem análise salva → abre no Resumo; senão → Perfil
(function rotearInicio() {
    const ultimaAnalise = JSON.parse(localStorage.getItem('ultimaAnalise') || '{}');
    if (ultimaAnalise.dados) {
        goSection('resumo');
    } else {
        goSection('perfil');
    }
})();

// Observer para mudanças no localStorage
let ultimaColecao = localStorage.getItem('minhaColecao') || '[]';

setInterval(() => {
    const colecaoAtual = localStorage.getItem('minhaColecao') || '[]';
    
    if (colecaoAtual !== ultimaColecao) {
        ultimaColecao = colecaoAtual;
        atualizarNivelDOM();
    }
}, 500);

// ===== FAQ + VERIFICAÇÃO =====

// ===============================================
// VERIFICAÇÃO DE ASSINATURA (Supabase)
// ===============================================

// Cache da verificação (5 minutos)
let cacheAssinatura = null;
let cacheTimestamp = 0;
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutos

async function verificarAssinatura() {
    const email = localStorage.getItem('userEmail');
    
    // 1. Sem email → bloqueado
    if (!email) return false;
    
    // 2. VIP passa direto
    if (email === 'vguerise@gmail.com') return true;
    
    // 3. Cache (5 min)
    const now = Date.now();
    if (cacheAssinatura !== null && (now - cacheTimestamp) < CACHE_TIMEOUT) {
        return cacheAssinatura;
    }
    
    const SB_URL = 'https://frivahuiffxrxzcjrlom.supabase.co';
    const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaXZhaHVpZmZ4cnh6Y2pybG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NzgxMTAsImV4cCI6MjA4MzA1NDExMH0.9cIQs8qhctqZsiNlh4hOVHCjOBMR7UBFpBXiVST6iL4';
    const hdrs = {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json'
    };
    const emailEnc = encodeURIComponent(email.toLowerCase());

    try {
        // Consulta as duas tabelas em paralelo
        const [resCurso, resEntitlements] = await Promise.all([
            // Tabela do curso (alunos)
            fetch(`${SB_URL}/rest/v1/usuarios_curso?email=eq.${emailEnc}&status=eq.ativo&select=email`, { headers: hdrs }),
            // Tabela do Perfumap avulso
            fetch(`${SB_URL}/rest/v1/entitlements?email=eq.${emailEnc}&product_id=eq.mapa_de_perfumes&status=eq.active&select=email`, { headers: hdrs })
        ]);

        let isPro = false;

        if (resCurso.ok) {
            const d = await resCurso.json();
            if (d && d.length > 0) isPro = true;
        }

        if (!isPro && resEntitlements.ok) {
            const d = await resEntitlements.json();
            if (d && d.length > 0) isPro = true;
        }

        cacheAssinatura = isPro;
        cacheTimestamp = now;
        return isPro;

    } catch (error) {
        return false;
    }
}

// Modal de assinatura (quando não é assinante)
// ===============================================
// MODAL DE LOGIN (primeiro acesso)
// ===============================================

function mostrarModalLogin() {
    // Verifica se tem email na URL (vindo do Hotmart)
    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('email');
    
    const modal = `
        <div id="modal-login" style="
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        ">
            <div style="
                background: var(--bk);
                border: 2px solid var(--or);
                border-radius: 20px;
                padding: 40px;
                max-width: 500px;
                text-align: center;
            ">
                <div style="font-size: 4em; margin-bottom: 20px;">🔑</div>
                
                <h2 style="color: var(--or); margin-bottom: 15px; font-size: 2em;">
                    ${emailFromUrl ? 'Confirme seu Acesso' : 'Bem-vindo ao Perfumap'}
                </h2>
                
                <p style="color: var(--tx2); margin-bottom: 25px; line-height: 1.6;">
                    ${emailFromUrl 
                        ? 'Detectamos seu email! Clique em Acessar para entrar:'
                        : 'Para acessar, digite o email que você usou<br>na compra do produto no Hotmart:'
                    }
                </p>
                
                <input 
                    type="email" 
                    id="input-email-login" 
                    placeholder="seu@email.com"
                    value="${emailFromUrl || ''}"
                    style="
                        width: 100%;
                        padding: 15px;
                        border: 2px solid var(--or);
                        border-radius: 10px;
                        background: var(--orm);
                        color: var(--tx);
                        font-size: 1.1em;
                        text-align: center;
                        margin-bottom: 20px;
                    "
                    onkeypress="if(event.key === 'Enter') fazerLogin()"
                />
                
                <button onclick="fazerLogin()" style="
                    background: var(--or);
                    color: #fff;
                    border: none;
                    padding: 18px 50px;
                    border-radius: 12px;
                    font-size: 1.2em;
                    font-weight: 700;
                    cursor: pointer;
                    width: 100%;
                    margin-bottom: 15px;
                    box-shadow: 0 4px 15px rgba(232,93,4,.4);
                ">
                    🔓 Acessar
                </button>
                
            </div>
        </div>
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            #input-email-login:focus {
                outline: none;
                border-color: var(--or);
                box-shadow: 0 0 10px rgba(232,93,4,.5);
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
    
    // Se tem email da URL, já faz login automaticamente
    if (emailFromUrl) {
        setTimeout(() => {
            fazerLogin();
        }, 1000); // 1 segundo para o usuário ver
    } else {
        // Senão, foco no input
        setTimeout(() => {
            document.getElementById('input-email-login')?.focus();
        }, 300);
    }
}

async function fazerLogin() {
    const input = document.getElementById('input-email-login');
    const email = input?.value.trim().toLowerCase();
    
    if (!email) {
        alert('⚠️ Digite seu email');
        return;
    }
    
    // Validação básica de email
    if (!email.includes('@') || !email.includes('.')) {
        alert('⚠️ Digite um email válido');
        return;
    }
    // Salva email
    localStorage.setItem('userEmail', email);
    
    // Remove modal de login
    document.getElementById('modal-login')?.remove();
    
    // Mostra loading
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-verificacao';
    loadingDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        ">
            <div style="text-align: center;">
                <div style="
                    border: 4px solid var(--or);
                    border-top: 4px solid transparent;
                    border-radius: 50%;
                    width: 50px;
                    height: 50px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px auto;
                "></div>
                <div style="color: var(--or); font-size: 1.2em;">
                    Verificando sua assinatura...
                </div>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(loadingDiv);
    
    // Verifica assinatura
    const isAssinante = await verificarAssinatura();
    
    // Remove loading
    loadingDiv.remove();
    
    if (isAssinante) {
        liberarInterface();
        
        // ☁️ SINCRONIZA COLEÇÃO COM NUVEM
        if (window.supabaseSync) {
            await window.supabaseSync.sincronizar(email);
        }
        
        // Mensagem de sucesso
        const sucessoDiv = document.createElement('div');
        sucessoDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: var(--tx);
            padding: 20px 30px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 10002;
            animation: slideIn 0.3s ease;
        `;
        sucessoDiv.innerHTML = '✅ Acesso liberado! Bem-vindo!';
        document.body.appendChild(sucessoDiv);
        
        setTimeout(() => sucessoDiv.remove(), 3000);
    } else {
        localStorage.removeItem('userEmail');
        mostrarModalAssinatura(false);
    }
}

function irParaCheckoutDireto() {
    window.location.href = 'https://pay.hotmart.com/A105191777G?off=13u0n1z9&checkoutMode=10';
}

function mostrarModalAssinatura(permiteFechar = true) {
    const botaoVoltar = permiteFechar ? `
        <button onclick="fecharModalAssinatura()" style="
            background: transparent;
            color: var(--tx3);
            border: 1px solid #444;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            width: 100%;
            margin-top: 12px;
            font-family: inherit;
        ">
            Voltar
        </button>
    ` : '';
    
    const modal = `
        <div id="modal-assinatura" style="
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 1.5rem;
            animation: fadeIn 0.3s ease;
        ">
            <div style="
                background: var(--s1);
                border: 2px solid var(--or);
                border-radius: 20px;
                padding: 2rem 1.8rem;
                max-width: 420px;
                width: 100%;
                text-align: center;
            ">
                <div style="font-size: 3em; margin-bottom: 16px;">🗺️</div>

                <h2 style="color: var(--or); margin-bottom: 12px; font-size: 1.5em; font-family: 'Montserrat', sans-serif; font-weight: 900;">
                    Acesso ao Perfumap
                </h2>

                <p style="color: var(--tx2); margin-bottom: 24px; line-height: 1.65; font-size: .93rem;">
                    Seu email não tem acesso ativo ao Perfumap.<br>
                    Adquira o acesso vitalício por apenas:
                </p>

                <div style="
                    background: var(--orm);
                    border: 2px solid var(--or);
                    border-radius: 14px;
                    padding: 1.4rem;
                    margin-bottom: 24px;
                ">
                    <div style="color: var(--or); font-size: 2.5em; font-weight: 700; font-family: 'Montserrat', sans-serif;">
                        R$ 37
                    </div>
                    <div style="color: var(--tx3); font-size: .88rem; margin-top: 4px;">
                        Pagamento único • Acesso vitalício
                    </div>
                </div>

                <ul style="
                    text-align: left;
                    color: var(--tx2);
                    line-height: 2;
                    margin-bottom: 24px;
                    list-style: none;
                    padding: 0;
                    font-size: .9rem;
                ">
                    <li>✅ Análise completa da coleção com I.A.</li>
                    <li>✅ Radar de famílias olfativas</li>
                    <li>✅ Chat com O Perfumista</li>
                    <li>✅ Lista de desejos com priorização</li>
                    <li>✅ Coleção salva na nuvem</li>
                </ul>

                <button onclick="irParaCheckout()" style="
                    background: var(--or);
                    color: #fff;
                    border: none;
                    padding: 16px;
                    border-radius: 12px;
                    font-size: 1.05em;
                    font-weight: 700;
                    cursor: pointer;
                    width: 100%;
                    box-shadow: 0 4px 20px rgba(232,93,4,.4);
                    font-family: inherit;
                ">
                    🗺️ Quero meu acesso — R$ 37
                </button>

                ${botaoVoltar}
            </div>
        </div>
        <style>
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
}

function fecharModalAssinatura() {
    const modal = document.getElementById('modal-assinatura');
    if (modal) modal.remove();
}

function irParaCheckout() {
    const email = localStorage.getItem('userEmail') || '';
    const base = 'https://pay.hotmart.com/A105191777G?off=13u0n1z9&checkoutMode=10';
    window.location.href = email ? `${base}&email=${encodeURIComponent(email)}` : base;
}

// Limpa cache (chamar após compra/login)
function limparCacheAssinatura() {
    cacheAssinatura = null;
    cacheTimestamp = 0;
}

// Disponibiliza no window
window.verificarAssinatura = verificarAssinatura;
window.limparCacheAssinatura = limparCacheAssinatura;

// ===============================================
// VERIFICAÇÃO GLOBAL AO CARREGAR PÁGINA
// ===============================================

async function verificarAcessoGlobal() {
    const email = localStorage.getItem('userEmail');
    
    // Se não tem email, mostra MODAL DE LOGIN
    if (!email) {
        mostrarModalLogin();
        bloquearInterface();
        return;
    }
    
    // Verifica se é assinante
    const isAssinante = await verificarAssinatura();
    
    if (!isAssinante) {
        mostrarModalAssinatura(false); // false = não pode fechar
        bloquearInterface();
    } else {
        liberarInterface();
    }
}

// Bloqueia interface
function bloquearInterface() {
    // Desabilita botões principais
    const botoes = [
        document.getElementById('btn-analisar'),
        document.getElementById('chat-send-button'),
        document.getElementById('btn-dicas')
    ];
    
    botoes.forEach(btn => {
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        }
    });
    
    // Adiciona overlay em todas as seções
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.style.pointerEvents = 'none';
        section.style.opacity = '0.6';
    });
}

// Libera interface
function liberarInterface() {
    // Habilita botões
    const botoes = [
        document.getElementById('btn-analisar'),
        document.getElementById('chat-send-button'),
        document.getElementById('btn-dicas')
    ];
    
    botoes.forEach(btn => {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });
    
    // Remove overlay
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.style.pointerEvents = 'auto';
        section.style.opacity = '1';
    });
}

// Executa ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
    // PRIORIDADE 1: Verifica se tem token na URL (magic link)
    verificarMagicLink();
    
    // PRIORIDADE 2: Aguarda 500ms para garantir que DOM carregou
    setTimeout(() => {
        verificarAcessoGlobal();
    }, 500);
});

// ===============================================
// MAGIC LINK - Detecta token na URL
// ===============================================

async function verificarMagicLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
        return;
    }
    // Mostra loading
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-magic-link';
    loadingDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        ">
            <div style="text-align: center;">
                <div style="font-size: 4em; margin-bottom: 20px;">🔓</div>
                <div style="
                    border: 4px solid var(--or);
                    border-top: 4px solid transparent;
                    border-radius: 50%;
                    width: 60px;
                    height: 60px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px auto;
                "></div>
                <div style="color: var(--or); font-size: 1.3em; font-weight: 700;">
                    Validando seu acesso...
                </div>
                <div style="color: var(--tx3); font-size: 0.9em; margin-top: 10px;">
                    Aguarde alguns segundos
                </div>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(loadingDiv);
    
    try {
        // Valida token no backend
        const response = await fetch(
            `https://operfumista-api-git-main-victors-projects-99f4b8c2.vercel.app/api/validate-magic-link?token=${token}`
        );
        
        const data = await response.json();
        
        // Remove loading
        loadingDiv.remove();
        
        if (data.valid && data.email) {
            // Salva email no localStorage
            localStorage.setItem('userEmail', data.email);
            
            // Remove token da URL (limpa histórico)
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Limpa cache para forçar nova verificação
            if (window.limparCacheAssinatura) {
                window.limparCacheAssinatura();
            }
            
            // Libera interface
            liberarInterface();
            
            // Mensagem de sucesso
            mostrarNotificacaoSucesso('🎉 Acesso liberado com sucesso! Bem-vindo!');
            
        } else {
            // Mostra mensagem de erro
            mostrarNotificacaoErro(
                data.message || 'Link inválido ou expirado. Por favor, faça login com seu email.'
            );
            
            // Remove token inválido da URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        
    } catch (error) {
        loadingDiv.remove();
        
        mostrarNotificacaoErro(
            'Erro ao validar link. Por favor, tente fazer login com seu email.'
        );
        
        // Remove token da URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

function mostrarNotificacaoSucesso(mensagem) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: var(--tx);
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10002;
        animation: slideInRight 0.3s ease;
        max-width: 350px;
        font-weight: 600;
    `;
    notif.innerHTML = mensagem;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 4000);
}

function mostrarNotificacaoErro(mensagem) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #f44336, #d32f2f);
        color: var(--tx);
        padding: 20px 30px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 10002;
        animation: slideInRight 0.3s ease;
        max-width: 350px;
        font-weight: 600;
    `;
    notif.innerHTML = mensagem;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notif.remove(), 300);
    }, 5000);
}

// ===== PWA INSTALL =====

// ── PWA INSTALL ──
let deferredPrompt;
const _pwaBtn = document.getElementById('pwa-install-btn');

async function instalarPWA() {
    if (!deferredPrompt) {
        alert('Este navegador não suporta instalação de PWA ou o app já está instalado.');
        return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        if (_pwaBtn) _pwaBtn.style.display = 'none';
    }
    deferredPrompt = null;
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (_pwaBtn) _pwaBtn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (_pwaBtn) _pwaBtn.style.display = 'none';
});

if (window.matchMedia('(display-mode: standalone)').matches) {
    if (_pwaBtn) _pwaBtn.style.display = 'none';
}

// ===== SERVICE WORKER =====

// Registra Service Worker para funcionalidade PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = 'service-worker.js';
    
    navigator.serviceWorker.register(swPath)
      .then((registration) => {
        // Verifica atualizações
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Opcional: Mostrar notificação para usuário recarregar
            }
          });
        });
      })
      .catch((error) => {
      });
  });
  
  // Escuta mudanças no Service Worker
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
  
  // Verifica se já está controlado por SW
  navigator.serviceWorker.ready.then(() => {
    if (navigator.serviceWorker.controller) {
    } else {
    }
  });
} else {
}
