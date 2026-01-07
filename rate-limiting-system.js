// ============================================
// SISTEMA DE RATE LIMITING - O MAPA DE PERFUMES
// ============================================

class RateLimiter {
    constructor() {
        this.limits = {
            // Plano BÁSICO (R$ 47/ano) - ÚNICO PLANO
            basico: {
                analise: { max: 8, periodo: '30d', resetDiario: false },  // 8 por mês
                chat: { max: 12, periodo: '30d', resetDiario: false },     // 12 por mês
                dicas: { max: 3, periodo: 'vitalicio', resetDiario: false }, // 3 vitalício
                missao: { max: 999, periodo: '30d', resetDiario: false }   // Ilimitado
            }
        };
    }
    
    // Pega plano do usuário (sempre 'basico' agora)
    getPlanoAtual() {
        return 'basico'; // Todos são pagos
    }
    
    // Verifica se pode fazer ação
    podeExecutar(acao) {
        const plano = this.getPlanoAtual();
        const limite = this.limits[plano][acao];
        
        if (!limite) return { pode: true }; // Sem limite definido
        
        const key = `ratelimit_${acao}`;
        const dados = JSON.parse(localStorage.getItem(key) || '{}');
        
        // Reseta se mudou o dia (para limites diários)
        if (limite.resetDiario && this.mudouDia(dados.ultimaAtualizacao)) {
            localStorage.setItem(key, JSON.stringify({
                contador: 0,
                ultimaAtualizacao: Date.now()
            }));
            return { pode: true, restante: limite.max };
        }
        
        // Verifica período (7 dias, 1 dia, etc)
        if (this.expirou(dados.ultimaAtualizacao, limite.periodo)) {
            localStorage.setItem(key, JSON.stringify({
                contador: 0,
                ultimaAtualizacao: Date.now()
            }));
            return { pode: true, restante: limite.max };
        }
        
        // Verifica se atingiu limite
        const contador = dados.contador || 0;
        const restante = limite.max - contador;
        
        if (contador >= limite.max) {
            return {
                pode: false,
                restante: 0,
                mensagem: this.getMensagemUpgrade(plano, acao),
                proximoReset: this.getProximoReset(dados.ultimaAtualizacao, limite.periodo)
            };
        }
        
        return { pode: true, restante };
    }
    
    // Registra uso
    registrarUso(acao) {
        const key = `ratelimit_${acao}`;
        const dados = JSON.parse(localStorage.getItem(key) || '{}');
        
        localStorage.setItem(key, JSON.stringify({
            contador: (dados.contador || 0) + 1,
            ultimaAtualizacao: Date.now()
        }));
        
        console.log(`📊 Rate Limit: ${acao} usado. Restante:`, this.podeExecutar(acao).restante);
    }
    
    // Helpers
    mudouDia(timestamp) {
        if (!timestamp) return true;
        const ultima = new Date(timestamp);
        const agora = new Date();
        return ultima.getDate() !== agora.getDate();
    }
    
    expirou(timestamp, periodo) {
        if (!timestamp) return true;
        if (periodo === 'vitalicio') return false; // Nunca expira
        
        const agora = Date.now();
        const diff = agora - timestamp;
        
        if (periodo === '1d') return diff > 24 * 60 * 60 * 1000;
        if (periodo === '7d') return diff > 7 * 24 * 60 * 60 * 1000;
        if (periodo === '30d') return diff > 30 * 24 * 60 * 60 * 1000;
        
        return false;
    }
    
    getProximoReset(timestamp, periodo) {
        if (!timestamp) return new Date();
        if (periodo === 'vitalicio') return new Date(9999, 11, 31); // Nunca
        
        const data = new Date(timestamp);
        
        if (periodo === '1d') {
            data.setDate(data.getDate() + 1);
            data.setHours(0, 0, 0, 0);
        } else if (periodo === '7d') {
            data.setDate(data.getDate() + 7);
        }
        
        return data;
    }
    
    getMensagemUpgrade(plano, acao) {
        if (plano === 'free') {
            return `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 3em; margin-bottom: 10px;">🔒</div>
                    <h3 style="color: #d4af37; margin-bottom: 10px;">Limite do Período Gratuito Atingido</h3>
                    <p style="color: #ccc; margin-bottom: 20px;">
                        Você usou todas as ${this.limits.free[acao].max} ${acao === 'analise' ? 'análises' : acao === 'missao' ? 'missões' : 'perguntas'} 
                        disponíveis no período de teste.
                    </p>
                    <p style="color: #d4af37; font-weight: bold; margin-bottom: 20px;">
                        Assine por apenas R$ 47/ano e tenha:
                    </p>
                    <ul style="text-align: left; max-width: 300px; margin: 0 auto 20px; color: #ccc;">
                        <li>✅ 10 análises por dia</li>
                        <li>✅ 5 missões por dia</li>
                        <li>✅ 15 conversas com o Perfumista/dia</li>
                        <li>✅ Acesso total ao radar e níveis</li>
                    </ul>
                    <button 
                        onclick="window.location.href='https://pay.hotmart.com/SEU_LINK'"
                        style="
                            background: linear-gradient(135deg, #d4af37, #f4d03f);
                            color: #000;
                            border: none;
                            padding: 15px 40px;
                            border-radius: 30px;
                            font-size: 1.1em;
                            font-weight: bold;
                            cursor: pointer;
                            box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
                        "
                    >
                        🚀 Assinar Agora - R$ 47/ano
                    </button>
                </div>
            `;
        } else {
            const proxReset = this.getProximoReset(Date.now(), this.limits[plano][acao].periodo);
            return `
                <div style="text-align: center; padding: 20px;">
                    <div style="font-size: 3em; margin-bottom: 10px;">⏰</div>
                    <h3 style="color: #d4af37; margin-bottom: 10px;">Limite Diário Atingido</h3>
                    <p style="color: #ccc; margin-bottom: 20px;">
                        Você atingiu o limite de ${this.limits[plano][acao].max} ${acao === 'analise' ? 'análises' : acao === 'missao' ? 'missões' : 'perguntas'} por dia.
                    </p>
                    <p style="color: #d4af37; font-weight: bold;">
                        Limite reseta em: ${proxReset.toLocaleString('pt-BR')}
                    </p>
                </div>
            `;
        }
    }
    
    // Status para exibir no UI
    getStatus() {
        const plano = this.getPlanoAtual();
        const status = {};
        
        ['analise', 'missao', 'chat'].forEach(acao => {
            const check = this.podeExecutar(acao);
            status[acao] = {
                usado: this.limits[plano][acao].max - (check.restante || 0),
                total: this.limits[plano][acao].max,
                restante: check.restante || 0,
                pode: check.pode
            };
        });
        
        return status;
    }
}

// Instância global
window.rateLimiter = new RateLimiter();

// ============================================
// INTEGRAÇÃO COM FUNÇÕES EXISTENTES
// ============================================

// Exemplo de uso em analisarColecao():
async function analisarColecaoComLimite() {
    // Verifica rate limit
    const check = window.rateLimiter.podeExecutar('analise');
    
    if (!check.pode) {
        mostrarModal(check.mensagem);
        return;
    }
    
    // Executa análise normal
    await analisarColecao();
    
    // Registra uso
    window.rateLimiter.registrarUso('analise');
}

// Exemplo de uso no chat:
async function enviarPerguntaComLimite() {
    const check = window.rateLimiter.podeExecutar('chat');
    
    if (!check.pode) {
        mostrarModal(check.mensagem);
        return;
    }
    
    await enviarPergunta();
    window.rateLimiter.registrarUso('chat');
}

// Exemplo de uso em missões:
async function gerarNovaMissaoComLimite() {
    const check = window.rateLimiter.podeExecutar('missao');
    
    if (!check.pode) {
        mostrarModal(check.mensagem);
        return;
    }
    
    await gerarNovaMissao();
    window.rateLimiter.registrarUso('missao');
}

// UI: Mostrar status no header
function renderizarStatusLimites() {
    const status = window.rateLimiter.getStatus();
    const plano = window.rateLimiter.getPlanoAtual();
    
    if (plano === 'free') {
        return `
            <div style="background: rgba(255,68,68,0.1); border: 1px solid rgba(255,68,68,0.3); 
                        padding: 10px; border-radius: 8px; margin: 10px 0;">
                <div style="color: #ff4444; font-weight: bold; margin-bottom: 5px;">
                    ⚠️ Período Gratuito (7 dias)
                </div>
                <div style="font-size: 0.9em; color: #ccc;">
                    📊 Análises: ${status.analise.usado}/${status.analise.total}<br>
                    🎯 Missões: ${status.missao.usado}/${status.missao.total}<br>
                    💬 Chat: ${status.chat.usado}/${status.chat.total}
                </div>
            </div>
        `;
    } else {
        return `
            <div style="font-size: 0.85em; color: #999; margin-top: 5px;">
                Hoje: ${status.analise.usado} análises • ${status.missao.usado} missões • ${status.chat.usado} perguntas
            </div>
        `;
    }
}

console.log('✅ Rate Limiting System carregado!');
