// ============================================
// SISTEMA DE RATE LIMITING - PAID-ONLY
// ============================================

class RateLimiter {
    constructor() {
        this.limits = {
            basico: {
                analise: { max: 8, periodo: '30d' },
                chat: { max: 12, periodo: '30d' },
                dicas: { max: 3, periodo: 'vitalicio' }
            }
        };
    }
    
    getPlanoAtual() {
        return 'basico';
    }
    
    getContador(acao) {
        const key = `ratelimit_${acao}`;
        const data = localStorage.getItem(key);
        
        if (!data) {
            return { contador: 0, timestamp: Date.now() };
        }
        
        return JSON.parse(data);
    }
    
    salvarContador(acao, contador, timestamp) {
        const key = `ratelimit_${acao}`;
        localStorage.setItem(key, JSON.stringify({ contador, timestamp }));
    }
    
    expirou(timestamp, periodo) {
        if (periodo === 'vitalicio') return false;
        
        const agora = Date.now();
        const diff = agora - timestamp;
        
        if (periodo === '30d') return diff > 30 * 24 * 60 * 60 * 1000;
        
        return false;
    }
    
    podeExecutar(acao) {
        const plano = this.getPlanoAtual();
        const limite = this.limits[plano][acao];
        
        if (!limite) {
            return { pode: true, restante: 999 };
        }
        
        const { contador, timestamp } = this.getContador(acao);
        
        // Verifica se expirou
        if (this.expirou(timestamp, limite.periodo)) {
            // Reset
            this.salvarContador(acao, 0, Date.now());
            return { 
                pode: true, 
                restante: limite.max,
                proximoReset: this.getProximoReset(Date.now(), limite.periodo)
            };
        }
        
        // Verifica limite
        if (contador >= limite.max) {
            return { 
                pode: false, 
                restante: 0,
                proximoReset: this.getProximoReset(timestamp, limite.periodo)
            };
        }
        
        return { 
            pode: true, 
            restante: limite.max - contador,
            proximoReset: this.getProximoReset(timestamp, limite.periodo)
        };
    }
    
    registrarUso(acao) {
        const { contador, timestamp } = this.getContador(acao);
        this.salvarContador(acao, contador + 1, timestamp || Date.now());
    }
    
    getProximoReset(timestamp, periodo) {
        if (periodo === 'vitalicio') return new Date(9999, 11, 31);
        
        const data = new Date(timestamp);
        if (periodo === '30d') {
            data.setDate(data.getDate() + 30);
        }
        return data;
    }
}

// INICIALIZAÇÃO
window.rateLimiter = new RateLimiter();
console.log('✅ Rate Limiting System inicializado!');
console.log('📊 Limites:', window.rateLimiter.limits.basico);
