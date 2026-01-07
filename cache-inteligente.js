// ============================================
// SISTEMA DE CACHE INTELIGENTE
// ============================================

class CacheInteligente {
    constructor() {
        this.ttl = {
            analise: 48 * 60 * 60 * 1000,  // 48h
            chat: 60 * 60 * 1000,           // 1h
            dicas: 30 * 24 * 60 * 60 * 1000 // 30 dias
        };
    }
    
    gerarChave(tipo, params) {
        if (tipo === 'analise') {
            const colecao = params.colecao.sort().join('|');
            return `cache_analise_${this.hash(colecao)}`;
        }
        
        if (tipo === 'chat') {
            return `cache_chat_${this.hash(params.pergunta)}`;
        }
        
        if (tipo === 'dicas') {
            const perfil = JSON.stringify(params.perfil);
            return `cache_dicas_${this.hash(perfil)}`;
        }
        
        return `cache_${tipo}_${Date.now()}`;
    }
    
    hash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }
    
    buscar(tipo, params) {
        const chave = this.gerarChave(tipo, params);
        const cached = localStorage.getItem(chave);
        
        if (!cached) {
            console.log(`❌ Cache MISS (${tipo})`);
            return null;
        }
        
        const { dados, timestamp } = JSON.parse(cached);
        const idade = Date.now() - timestamp;
        
        if (idade > this.ttl[tipo]) {
            console.log(`⏰ Cache EXPIRADO (${tipo})`);
            localStorage.removeItem(chave);
            return null;
        }
        
        console.log(`✅ Cache HIT (${tipo}) - Economizou 1 chamada!`);
        return dados;
    }
    
    salvar(tipo, params, dados) {
        const chave = this.gerarChave(tipo, params);
        const cache = {
            dados,
            timestamp: Date.now()
        };
        
        localStorage.setItem(chave, JSON.stringify(cache));
        console.log(`💾 Cache SALVO (${tipo})`);
    }
    
    invalidarAnalise() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('cache_analise_')) {
                localStorage.removeItem(key);
            }
        });
        console.log('🗑️ Cache de análise invalidado');
    }
    
    getEstatisticas() {
        const keys = Object.keys(localStorage);
        const stats = {
            analise: 0,
            chat: 0,
            dicas: 0
        };
        
        keys.forEach(key => {
            if (key.startsWith('cache_analise_')) stats.analise++;
            if (key.startsWith('cache_chat_')) stats.chat++;
            if (key.startsWith('cache_dicas_')) stats.dicas++;
        });
        
        return stats;
    }
}

// INICIALIZAÇÃO
window.cacheInteligente = new CacheInteligente();
console.log('✅ Sistema de Cache inicializado!');
console.log('📊 Cache Stats:', window.cacheInteligente.getEstatisticas());
