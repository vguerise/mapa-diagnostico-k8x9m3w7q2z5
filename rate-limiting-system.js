// ===============================================
// RATE LIMITING - 100% PAGO
// Todos usuários são assinantes (R$ 47/ano)
// Sistema apenas controla limites de uso
// ===============================================

class RateLimiter {
    constructor() {
        // Lista de emails VIP (sem limites)
        this.emailsVIP = [
            'vguerise@gmail.com'
        ];
        
        // LIMITES PARA TODOS OS ASSINANTES
        this.limits = {
            basico: {  // Nome mantido por compatibilidade com código existente
                analise: {
                    max: 8,
                    periodo: 'mensal',
                    window: 30 * 24 * 60 * 60 * 1000
                },
                chat: {
                    max: 12,
                    periodo: 'mensal',
                    window: 30 * 24 * 60 * 60 * 1000
                },
                dicas: {
                    max: 3,
                    periodo: 'lifetime',
                    window: null
                }
            }
        };
    }
    
    // Verifica se é VIP (sem limites)
    isVIP() {
        const email = localStorage.getItem('userEmail');
        return email && this.emailsVIP.includes(email.toLowerCase().trim());
    }
    
    // Verifica se pode executar ação
    podeExecutar(acao) {
        // VIP tem ilimitado
        if (this.isVIP()) {
            return {
                pode: true,
                restante: 999,
                total: 999,
                vip: true
            };
        }
        
        const config = this.limits.basico[acao];
        
        if (!config) {
            return { pode: false, restante: 0 };
        }
        
        const key = `limit_${acao}`;
        let dados = JSON.parse(localStorage.getItem(key) || '{}');
        
        // Reseta se mudou o período
        if (config.periodo === 'mensal') {
            const mesAtual = new Date().toISOString().slice(0, 7); // "2026-01"
            
            if (dados.mes !== mesAtual) {
                dados = { mes: mesAtual, usado: 0 };
                localStorage.setItem(key, JSON.stringify(dados));
            }
        } else if (config.periodo === 'lifetime') {
            if (!dados.usado) {
                dados = { usado: 0 };
            }
        }
        
        const usado = dados.usado || 0;
        const restante = config.max - usado;
        
        // Calcula próximo reset (para mensais)
        let proximoReset = null;
        if (config.periodo === 'mensal') {
            const hoje = new Date();
            const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
            proximoReset = proximoMes.toLocaleDateString('pt-BR');
        }
        
        console.log(`📊 ${acao}: ${usado}/${config.max} usado`);
        
        return {
            pode: usado < config.max,
            restante: Math.max(0, restante),
            total: config.max,
            usado: usado,
            proximoReset: proximoReset
        };
    }
    
    // Registra uso
    registrarUso(acao) {
        if (this.isVIP()) {
            console.log('👑 VIP - uso não contabilizado');
            return;
        }
        
        const config = this.limits.basico[acao];
        if (!config) return;
        
        const key = `limit_${acao}`;
        let dados = JSON.parse(localStorage.getItem(key) || '{}');
        
        if (config.periodo === 'mensal') {
            const mesAtual = new Date().toISOString().slice(0, 7);
            
            if (dados.mes !== mesAtual) {
                dados = { mes: mesAtual, usado: 1 };
            } else {
                dados.usado = (dados.usado || 0) + 1;
            }
        } else if (config.periodo === 'lifetime') {
            dados.usado = (dados.usado || 0) + 1;
        }
        
        localStorage.setItem(key, JSON.stringify(dados));
        
        const restante = config.max - dados.usado;
        console.log(`✅ ${acao} registrado: ${dados.usado}/${config.max} (${restante} restantes)`);
    }
    
    // Reseta limites (útil para testes)
    resetarLimites() {
        localStorage.removeItem('limit_analise');
        localStorage.removeItem('limit_chat');
        localStorage.removeItem('limit_dicas');
        console.log('🔄 Limites resetados');
    }
}

// Inicializa globalmente
window.rateLimiter = new RateLimiter();


// ===============================================
// MODAL DE LIMITE ATINGIDO
// ===============================================

function mostrarPopupLimite(tipo, limite, proximoReset) {
    const titulos = {
        'analise': 'Análises',
        'chat': 'Conversas com IA',
        'dicas': 'Dicas para Iniciantes'
    };
    
    const periodos = {
        'analise': 'mensal',
        'chat': 'mensal',
        'dicas': 'vitalício'
    };
    
    const mensagemReset = periodos[tipo] === 'mensal' 
        ? `O limite renova em: <strong>${proximoReset}</strong>`
        : 'Este é um limite vitalício (total de usos)';
    
    const modal = `
        <div id="modal-limite" style="
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        ">
            <div style="
                background: linear-gradient(135deg, #1e1e1e, #2d2d2d);
                border: 2px solid #d4af37;
                border-radius: 20px;
                padding: 40px;
                max-width: 450px;
                text-align: center;
            ">
                <div style="font-size: 3em; margin-bottom: 15px;">⏰</div>
                
                <h3 style="color: #d4af37; margin-bottom: 15px; font-size: 1.5em;">
                    Limite de ${titulos[tipo]} Atingido
                </h3>
                
                <p style="color: #ccc; line-height: 1.6; margin-bottom: 20px;">
                    Você usou suas <strong>${limite} ${titulos[tipo].toLowerCase()}</strong> este período.<br><br>
                    ${mensagemReset}
                </p>
                
                <div style="
                    background: rgba(212, 175, 55, 0.1);
                    border: 1px solid #d4af37;
                    border-radius: 10px;
                    padding: 15px;
                    margin-bottom: 20px;
                ">
                    <div style="color: #999; font-size: 0.9em; line-height: 1.6;">
                        💡 Sua assinatura está ativa!<br>
                        Os limites existem para garantir<br>
                        qualidade e performance para todos.
                    </div>
                </div>
                
                <button onclick="fecharPopupLimite()" style="
                    background: linear-gradient(135deg, #d4af37, #ffd700);
                    color: #000;
                    border: none;
                    padding: 15px 40px;
                    border-radius: 10px;
                    font-size: 1.1em;
                    font-weight: 700;
                    cursor: pointer;
                    width: 100%;
                ">
                    Entendi
                </button>
            </div>
        </div>
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
}

// Fecha popup
function fecharPopupLimite() {
    const modal = document.getElementById('modal-limite');
    if (modal) modal.remove();
}


// ===============================================
// ATUALIZAR CONTADORES (visual nos botões)
// ===============================================

function atualizarContadores() {
    if (!window.rateLimiter) return;
    
    try {
        // Análise
        const checkAnalise = window.rateLimiter.podeExecutar('analise');
        const contadorAnalise = document.getElementById('contador-analise');
        if (contadorAnalise) {
            contadorAnalise.textContent = `(${checkAnalise.restante}/${checkAnalise.total})`;
        }
        
        // Chat
        const checkChat = window.rateLimiter.podeExecutar('chat');
        const contadorChat = document.getElementById('contador-chat');
        if (contadorChat) {
            contadorChat.textContent = `(${checkChat.restante}/${checkChat.total})`;
        }
        
        // Dicas
        const checkDicas = window.rateLimiter.podeExecutar('dicas');
        const contadorDicas = document.getElementById('contador-dicas');
        if (contadorDicas) {
            contadorDicas.textContent = `(${checkDicas.restante}/${checkDicas.total})`;
        }
    } catch (error) {
        console.error('Erro ao atualizar contadores:', error);
    }
}

// Atualiza contadores ao carregar e após cada ação
window.addEventListener('load', atualizarContadores);


// ===============================================
// FUNÇÕES UTILITÁRIAS
// ===============================================

// Ver status atual (console)
function verStatus() {
    console.log('📊 STATUS DOS LIMITES:');
    
    const analise = window.rateLimiter.podeExecutar('analise');
    console.log(`Análises: ${analise.usado}/${analise.total} (${analise.restante} restantes)`);
    
    const chat = window.rateLimiter.podeExecutar('chat');
    console.log(`Chat: ${chat.usado}/${chat.total} (${chat.restante} restantes)`);
    
    const dicas = window.rateLimiter.podeExecutar('dicas');
    console.log(`Dicas: ${dicas.usado}/${dicas.total} (${dicas.restante} restantes)`);
}

// Disponibiliza no console
window.verStatus = verStatus;
