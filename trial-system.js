// ===============================================
// SISTEMA DE TRIAL 7 DIAS
// Muito mais simples que freemium!
// ===============================================

class TrialManager {
    constructor() {
        // Lista de emails VIP (acesso ilimitado)
        this.emailsVIP = [
            'vguerise@gmail.com'
        ];
        
        // Configuração do trial
        this.trialDays = 7;
        this.priceYearly = 47; // R$ 47/ano
    }
    
    // Verifica se usuário tem acesso
    temAcesso() {
        const email = localStorage.getItem('userEmail');
        
        // 1. VIP? (bypass total)
        if (email && this.emailsVIP.includes(email.toLowerCase().trim())) {
            return {
                hasAccess: true,
                type: 'vip',
                message: '👑 Acesso VIP'
            };
        }
        
        // 2. Já é PRO pago?
        const isPro = localStorage.getItem('isPro') === 'true';
        if (isPro) {
            const proExpiry = localStorage.getItem('proExpiry');
            if (proExpiry && new Date(proExpiry) > new Date()) {
                const daysLeft = Math.ceil((new Date(proExpiry) - new Date()) / (1000 * 60 * 60 * 24));
                return {
                    hasAccess: true,
                    type: 'pro',
                    expiresIn: daysLeft,
                    message: `💎 PRO - ${daysLeft} dias restantes`
                };
            } else {
                // PRO expirado
                localStorage.setItem('isPro', 'false');
            }
        }
        
        // 3. Trial ativo?
        const trialStarted = localStorage.getItem('trialStarted');
        
        if (!trialStarted) {
            // Nunca usou trial - pode começar!
            return {
                hasAccess: false,
                canStartTrial: true,
                message: '✨ Comece seu trial grátis de 7 dias'
            };
        }
        
        // Verifica se trial ainda é válido
        const trialExpiry = localStorage.getItem('trialExpiry');
        const now = new Date().getTime();
        
        if (trialExpiry && now < parseInt(trialExpiry)) {
            const daysLeft = Math.ceil((parseInt(trialExpiry) - now) / (1000 * 60 * 60 * 24));
            return {
                hasAccess: true,
                type: 'trial',
                expiresIn: daysLeft,
                message: `🎁 Trial - ${daysLeft} dias restantes`
            };
        }
        
        // 4. Trial expirado
        return {
            hasAccess: false,
            trialExpired: true,
            message: '⏰ Trial expirou - Faça upgrade para continuar'
        };
    }
    
    // Inicia trial
    iniciarTrial(email) {
        const now = new Date().getTime();
        const expiry = now + (this.trialDays * 24 * 60 * 60 * 1000);
        
        localStorage.setItem('userEmail', email);
        localStorage.setItem('trialStarted', now.toString());
        localStorage.setItem('trialExpiry', expiry.toString());
        
        const expiryDate = new Date(expiry);
        console.log(`✅ Trial iniciado! Expira em: ${expiryDate.toLocaleDateString()}`);
        
        return {
            success: true,
            expiryDate: expiryDate,
            daysLeft: this.trialDays
        };
    }
    
    // Ativa PRO (após pagamento)
    ativarPro(duracaoDias = 365) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + duracaoDias);
        
        localStorage.setItem('isPro', 'true');
        localStorage.setItem('proExpiry', expiry.toISOString());
        localStorage.setItem('proActivatedAt', new Date().toISOString());
        
        console.log('💎 PRO ativado até:', expiry.toLocaleDateString());
        
        return {
            success: true,
            expiryDate: expiry
        };
    }
    
    // Dias restantes (trial ou PRO)
    diasRestantes() {
        const status = this.temAcesso();
        return status.expiresIn || 0;
    }
    
    // Tipo de acesso atual
    tipoAcesso() {
        const status = this.temAcesso();
        return status.type || 'none';
    }
}

// Inicializa globalmente
window.trialManager = new TrialManager();


// ===============================================
// FUNÇÕES DE USO NO APP
// ===============================================

// Verifica acesso antes de qualquer ação
function verificarAcessoEExecutar(callback) {
    const status = window.trialManager.temAcesso();
    
    if (status.hasAccess) {
        // Tem acesso - executa normalmente
        callback();
    } else if (status.canStartTrial) {
        // Pode iniciar trial - mostra modal
        mostrarModalIniciarTrial();
    } else if (status.trialExpired) {
        // Trial expirou - mostra upgrade
        mostrarModalUpgrade();
    }
}

// Modal para iniciar trial
function mostrarModalIniciarTrial() {
    const modal = `
        <div id="trial-modal" style="
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        ">
            <div style="
                background: linear-gradient(135deg, #1e1e1e, #2d2d2d);
                border: 2px solid #d4af37;
                border-radius: 20px;
                padding: 40px;
                max-width: 500px;
                text-align: center;
            ">
                <div style="font-size: 4em; margin-bottom: 20px;">🎁</div>
                
                <h2 style="color: #d4af37; margin-bottom: 15px; font-size: 2em;">
                    7 Dias Grátis!
                </h2>
                
                <p style="color: #ccc; margin-bottom: 25px; line-height: 1.6;">
                    Experimente todas as funcionalidades sem compromisso.
                    Cancele quando quiser!
                </p>
                
                <div style="
                    background: rgba(212, 175, 55, 0.1);
                    border: 1px solid #d4af37;
                    border-radius: 10px;
                    padding: 20px;
                    margin-bottom: 25px;
                    text-align: left;
                ">
                    <div style="color: #ccc; line-height: 2;">
                        ✅ Análises ilimitadas por 7 dias<br>
                        ✅ Sugestões personalizadas com IA<br>
                        ✅ Radar da sua coleção<br>
                        ✅ Histórico completo<br>
                        ✅ Sem cartão de crédito agora
                    </div>
                </div>
                
                <div style="margin-bottom: 25px;">
                    <input 
                        type="email" 
                        id="trial-email" 
                        placeholder="Seu melhor email"
                        style="
                            width: 100%;
                            padding: 15px;
                            border: 1px solid #d4af37;
                            border-radius: 10px;
                            background: rgba(0,0,0,0.3);
                            color: #fff;
                            font-size: 1em;
                        "
                    />
                </div>
                
                <button onclick="iniciarTrial()" style="
                    background: linear-gradient(135deg, #d4af37, #ffd700);
                    color: #000;
                    border: none;
                    padding: 18px 40px;
                    border-radius: 12px;
                    font-size: 1.2em;
                    font-weight: 700;
                    cursor: pointer;
                    width: 100%;
                    margin-bottom: 15px;
                ">
                    🚀 Começar Trial Grátis
                </button>
                
                <p style="color: #666; font-size: 0.85em;">
                    Depois do trial: R$ 47/ano (R$ 3,92/mês)
                </p>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
}

// Inicia trial após usuário digitar email
function iniciarTrial() {
    const email = document.getElementById('trial-email').value.trim();
    
    if (!email || !email.includes('@')) {
        alert('Por favor, digite um email válido');
        return;
    }
    
    // Inicia trial
    const result = window.trialManager.iniciarTrial(email);
    
    // Remove modal
    const modal = document.getElementById('trial-modal');
    if (modal) modal.remove();
    
    // Feedback
    alert(`🎉 Trial ativado! Você tem ${result.daysLeft} dias para explorar tudo!`);
    
    // Recarrega página para atualizar UI
    location.reload();
}

// Modal de upgrade (trial expirado)
function mostrarModalUpgrade() {
    const modal = `
        <div id="upgrade-modal" style="
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        ">
            <div style="
                background: linear-gradient(135deg, #1e1e1e, #2d2d2d);
                border: 2px solid #d4af37;
                border-radius: 20px;
                padding: 40px;
                max-width: 500px;
                text-align: center;
            ">
                <div style="font-size: 4em; margin-bottom: 20px;">⏰</div>
                
                <h2 style="color: #d4af37; margin-bottom: 15px; font-size: 2em;">
                    Seu Trial Expirou
                </h2>
                
                <p style="color: #ccc; margin-bottom: 25px; line-height: 1.6;">
                    Continue aproveitando todas as funcionalidades por apenas:
                </p>
                
                <div style="
                    background: rgba(212, 175, 55, 0.1);
                    border: 2px solid #d4af37;
                    border-radius: 15px;
                    padding: 30px;
                    margin-bottom: 25px;
                ">
                    <div style="color: #d4af37; font-size: 3em; font-weight: 700;">
                        R$ 47/ano
                    </div>
                    <div style="color: #999; font-size: 1em; margin-top: 5px;">
                        Menos de R$ 4 por mês
                    </div>
                </div>
                
                <button onclick="irParaCheckout()" style="
                    background: linear-gradient(135deg, #d4af37, #ffd700);
                    color: #000;
                    border: none;
                    padding: 18px 40px;
                    border-radius: 12px;
                    font-size: 1.2em;
                    font-weight: 700;
                    cursor: pointer;
                    width: 100%;
                    margin-bottom: 15px;
                ">
                    💎 Fazer Upgrade Agora
                </button>
                
                <button onclick="fecharModal()" style="
                    background: transparent;
                    color: #999;
                    border: 1px solid #444;
                    padding: 12px;
                    border-radius: 10px;
                    cursor: pointer;
                    width: 100%;
                ">
                    Voltar
                </button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
}

// Fecha modal
function fecharModal() {
    const modal = document.getElementById('upgrade-modal') || document.getElementById('trial-modal');
    if (modal) modal.remove();
}

// Redireciona para checkout
function irParaCheckout() {
    const email = localStorage.getItem('userEmail');
    // Link do Hotmart com email pre-preenchido
    window.location.href = `https://pay.hotmart.com/G103674727A?checkoutMode=10&email=${email}`;
}

// Atualiza badge do usuário
function atualizarBadgeUsuario() {
    const status = window.trialManager.temAcesso();
    const badge = document.getElementById('user-badge');
    
    if (!badge) return;
    
    if (status.type === 'vip') {
        badge.innerHTML = '👑 VIP';
        badge.style.background = 'linear-gradient(135deg, #9c27b0, #e91e63)';
    } else if (status.type === 'pro') {
        badge.innerHTML = `💎 PRO (${status.expiresIn}d)`;
        badge.style.background = 'linear-gradient(135deg, #d4af37, #ffd700)';
    } else if (status.type === 'trial') {
        badge.innerHTML = `🎁 Trial (${status.expiresIn}d)`;
        badge.style.background = 'linear-gradient(135deg, #2196f3, #00bcd4)';
    } else {
        badge.innerHTML = '🆓 Iniciar Trial';
        badge.style.background = '#666';
        badge.style.cursor = 'pointer';
        badge.onclick = mostrarModalIniciarTrial;
    }
    
    // Atualiza botão "Virar PRO" na aba Perfil
    atualizarBotaoVirarPro(status);
}

// Mostra/esconde botão "Virar PRO" baseado no status
function atualizarBotaoVirarPro(status) {
    const botao = document.querySelector('.upgrade-button');
    if (!botao) return;
    
    if (status.type === 'pro' || status.type === 'vip') {
        // Já é PRO ou VIP - esconde botão
        botao.style.display = 'none';
    } else if (status.type === 'trial') {
        // Em trial - mostra com texto especial
        botao.style.display = 'block';
        botao.innerHTML = `💎 Garantir PRO (${status.expiresIn}d restantes)`;
    } else {
        // Free - mostra botão normal
        botao.style.display = 'block';
        botao.innerHTML = '💎 Virar PRO!';
    }
}

// Inicializa ao carregar
window.addEventListener('load', () => {
    atualizarBadgeUsuario();
    
    // Verifica se deve mostrar aviso de expiração
    const status = window.trialManager.temAcesso();
    
    if (status.type === 'trial' && status.expiresIn <= 2) {
        // Aviso nos últimos 2 dias do trial
        setTimeout(() => {
            alert(`⏰ Seu trial expira em ${status.expiresIn} dia(s)! Faça upgrade para não perder acesso.`);
        }, 2000);
    }
});
