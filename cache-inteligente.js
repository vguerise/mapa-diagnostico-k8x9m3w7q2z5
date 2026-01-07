// ============================================
// SISTEMA DE CACHE INTELIGENTE
// ============================================

class CacheInteligente {
    constructor() {
        this.ttl = {
            analise: 24 * 60 * 60 * 1000, // 24h - análise muda pouco
            missao: 1 * 60 * 60 * 1000,   // 1h - missões podem variar
            chat: 5 * 60 * 1000,          // 5min - respostas contextuais
            perfil_fragantica: 7 * 24 * 60 * 60 * 1000 // 7 dias - classificação estável
        };
    }
    
    // Gera chave única para cache
    gerarChave(tipo, params) {
        if (tipo === 'analise') {
            // Chave baseada na coleção atual
            const colecao = params.colecao.sort().join('|');
            return `cache_analise_${this.hash(colecao)}`;
        }
        
        if (tipo === 'missao') {
            // Chave baseada em coleção + família alvo
            const colecao = params.colecao.sort().join('|');
            return `cache_missao_${params.familiaAlvo}_${this.hash(colecao)}`;
        }
        
        if (tipo === 'chat') {
            // Chave baseada na pergunta (normalizada)
            const pergunta = params.pergunta.toLowerCase().trim();
            return `cache_chat_${this.hash(pergunta)}`;
        }
        
        if (tipo === 'perfil_fragantica') {
            // Chave baseada no nome do perfume
            return `cache_frag_${this.hash(params.perfume)}`;
        }
        
        return null;
    }
    
    // Hash simples para gerar IDs únicos
    hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    
    // Busca no cache
    buscar(tipo, params) {
        const chave = this.gerarChave(tipo, params);
        if (!chave) return null;
        
        const cached = localStorage.getItem(chave);
        if (!cached) {
            console.log(`📭 Cache MISS: ${tipo}`);
            return null;
        }
        
        const dados = JSON.parse(cached);
        
        // Verifica se expirou
        const agora = Date.now();
        const idade = agora - dados.timestamp;
        
        if (idade > this.ttl[tipo]) {
            console.log(`⏰ Cache EXPIRADO: ${tipo} (${Math.round(idade/1000/60)}min)`);
            localStorage.removeItem(chave);
            return null;
        }
        
        console.log(`✅ Cache HIT: ${tipo} (${Math.round(idade/1000)}s atrás)`);
        return dados.resposta;
    }
    
    // Salva no cache
    salvar(tipo, params, resposta) {
        const chave = this.gerarChave(tipo, params);
        if (!chave) return;
        
        const dados = {
            timestamp: Date.now(),
            resposta: resposta,
            tipo: tipo
        };
        
        localStorage.setItem(chave, JSON.stringify(dados));
        console.log(`💾 Salvou no cache: ${tipo}`);
        
        // Limpa caches antigos (garbage collection)
        this.limpezaAutomatica();
    }
    
    // Remove caches expirados
    limpezaAutomatica() {
        const keys = Object.keys(localStorage);
        const agora = Date.now();
        let removidos = 0;
        
        keys.forEach(key => {
            if (!key.startsWith('cache_')) return;
            
            try {
                const dados = JSON.parse(localStorage.getItem(key));
                const tipo = dados.tipo;
                const idade = agora - dados.timestamp;
                
                if (idade > this.ttl[tipo]) {
                    localStorage.removeItem(key);
                    removidos++;
                }
            } catch (e) {
                // Cache corrompido, remove
                localStorage.removeItem(key);
            }
        });
        
        if (removidos > 0) {
            console.log(`🗑️ Limpeza automática: ${removidos} caches removidos`);
        }
    }
    
    // Invalida cache quando coleção muda
    invalidarAnalise() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('cache_analise_') || key.startsWith('cache_missao_')) {
                localStorage.removeItem(key);
            }
        });
        console.log('🔄 Cache de análise invalidado');
    }
    
    // Estatísticas
    getEstatisticas() {
        const keys = Object.keys(localStorage);
        const caches = keys.filter(k => k.startsWith('cache_'));
        
        const stats = {
            total: caches.length,
            por_tipo: {},
            tamanho_kb: 0
        };
        
        caches.forEach(key => {
            try {
                const dados = JSON.parse(localStorage.getItem(key));
                const tipo = dados.tipo;
                
                stats.por_tipo[tipo] = (stats.por_tipo[tipo] || 0) + 1;
                stats.tamanho_kb += new Blob([JSON.stringify(dados)]).size / 1024;
            } catch (e) {}
        });
        
        return stats;
    }
}

// Instância global
window.cacheInteligente = new CacheInteligente();

// ============================================
// INTEGRAÇÃO COM FUNÇÕES EXISTENTES
// ============================================

// Exemplo: analisarColecao com cache
async function analisarColecaoComCache() {
    const colecao = minhaColecao;
    
    // 1. Tenta buscar no cache
    const cacheKey = { colecao };
    const cached = window.cacheInteligente.buscar('analise', cacheKey);
    
    if (cached) {
        // Usa resposta cacheada
        console.log('🚀 Usando análise do cache (economizou 1 chamada de API!)');
        renderizarAnalise(cached);
        return;
    }
    
    // 2. Cache miss - chama API
    console.log('📡 Chamando API (não estava no cache)');
    const resposta = await fetch('https://operfumista-api.vercel.app/api/perfumista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnostico: prompt })
    });
    
    const data = await resposta.json();
    
    // 3. Salva no cache
    window.cacheInteligente.salvar('analise', cacheKey, data);
    
    // 4. Renderiza
    renderizarAnalise(data);
}

// Exemplo: Chat com cache de perguntas frequentes
async function enviarPerguntaComCache(pergunta) {
    // Perguntas frequentes podem ser cacheadas
    const perguntaNormalizada = pergunta.toLowerCase().trim();
    
    // Lista de perguntas que SEMPRE tem a mesma resposta
    const perguntasEstaticas = [
        'o que é família olfativa',
        'como funciona o radar',
        'o que significa amadeirado',
        'qual a diferença entre edt e edp',
        'quanto tempo dura um perfume'
    ];
    
    const ehEstatica = perguntasEstaticas.some(p => 
        perguntaNormalizada.includes(p)
    );
    
    if (ehEstatica) {
        const cached = window.cacheInteligente.buscar('chat', { pergunta });
        
        if (cached) {
            console.log('💬 Resposta FAQ do cache!');
            return cached;
        }
    }
    
    // Chama API normalmente
    const resposta = await chamarAPIChat(pergunta);
    
    // Salva FAQ no cache
    if (ehEstatica) {
        window.cacheInteligente.salvar('chat', { pergunta }, resposta);
    }
    
    return resposta;
}

// Hook: Quando adiciona/remove perfume, invalida cache
function adicionarPerfumeComInvalidacao(nome) {
    minhaColecao.push(nome);
    salvarColecao();
    
    // Invalida caches de análise
    window.cacheInteligente.invalidarAnalise();
    
    console.log('✅ Perfume adicionado. Cache invalidado.');
}

// ============================================
// INICIALIZAÇÃO GLOBAL
// ============================================
window.cacheInteligente = new CacheInteligente();
console.log('✅ Sistema de Cache carregado e INICIALIZADO!');

// UI: Mostrar estatísticas no console
console.log('📊 Cache Stats:', window.cacheInteligente.getEstatisticas());
