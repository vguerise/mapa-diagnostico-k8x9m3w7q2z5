// ============================================
// SISTEMA DE SINCRONIZAÇÃO COM SUPABASE
// Sincroniza coleção de perfumes na nuvem
// ============================================

class SupabaseSync {
    constructor() {
        // Configuração do Supabase (mesma do index.html)
        this.SUPABASE_URL = 'https://frivahuiffxrxzcjrlom.supabase.co';
        this.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaXZhaHVpZmZ4cnh6Y2pybG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NzgxMTAsImV4cCI6MjA4MzA1NDExMH0.9cIQs8qhctqZsiNlh4hOVHCjOBMR7UBFpBXiVST6iL4';
        
        this.syncInProgress = false;
        this.lastSyncTime = null;
        this.syncQueue = [];
        
        console.log('☁️ Sistema de sincronização Supabase inicializado');
    }
    
    // ============================================
    // CARREGAR COLEÇÃO DA NUVEM
    // ============================================
    
    async carregarDaNuvem(email) {
        if (!email) {
            console.warn('⚠️ Email não fornecido para carregar coleção');
            return null;
        }
        
        try {
            console.log('📥 Carregando coleção da nuvem para:', email);
            
            const response = await fetch(
                `${this.SUPABASE_URL}/rest/v1/user_collections?email=eq.${email.toLowerCase()}&select=*&order=last_sync.desc&limit=1`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': this.SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                console.error('❌ Erro HTTP ao carregar:', response.status);
                return null;
            }
            
            const data = await response.json();
            
            if (data && data.length > 0) {
                const userCollection = data[0];
                console.log('✅ Coleção carregada da nuvem!');
                console.log(`📦 Total de perfumes: ${userCollection.collection.length}`);
                console.log(`🕐 Última sync: ${new Date(userCollection.last_sync).toLocaleString('pt-BR')}`);
                
                this.lastSyncTime = new Date(userCollection.last_sync);
                
                return {
                    collection: userCollection.collection,
                    profile: userCollection.profile,
                    lastSync: userCollection.last_sync
                };
            } else {
                console.log('📝 Nenhuma coleção encontrada na nuvem (primeiro acesso)');
                return null;
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar da nuvem:', error);
            return null;
        }
    }
    
    // ============================================
    // SALVAR COLEÇÃO NA NUVEM
    // ============================================
    
    async salvarNaNuvem(email, collection, profile = null) {
        if (!email) {
            console.warn('⚠️ Email não fornecido para salvar coleção');
            return false;
        }
        
        if (this.syncInProgress) {
            console.log('⏳ Sync em progresso, adicionando à fila...');
            this.syncQueue.push({ email, collection, profile });
            return true;
        }
        
        this.syncInProgress = true;
        
        try {
            console.log('📤 Salvando coleção na nuvem...');
            
            // Verifica se já existe registro para este email
            const existingResponse = await fetch(
                `${this.SUPABASE_URL}/rest/v1/user_collections?email=eq.${email.toLowerCase()}&select=id`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': this.SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            const existing = await existingResponse.json();
            const exists = existing && existing.length > 0;
            
            const payload = {
                email: email.toLowerCase(),
                collection: collection,
                profile: profile || {},
                last_sync: new Date().toISOString()
            };
            
            let response;
            
            if (exists) {
                // UPDATE - Atualiza registro existente
                console.log('🔄 Atualizando coleção existente...');
                response = await fetch(
                    `${this.SUPABASE_URL}/rest/v1/user_collections?email=eq.${email.toLowerCase()}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'apikey': this.SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(payload)
                    }
                );
            } else {
                // INSERT - Cria novo registro
                console.log('➕ Criando nova coleção...');
                payload.created_at = new Date().toISOString();
                
                response = await fetch(
                    `${this.SUPABASE_URL}/rest/v1/user_collections`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': this.SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify(payload)
                    }
                );
            }
            
            if (!response.ok) {
                console.error('❌ Erro HTTP ao salvar:', response.status);
                const errorText = await response.text();
                console.error('Detalhes:', errorText);
                this.syncInProgress = false;
                return false;
            }
            
            const result = await response.json();
            console.log('✅ Coleção salva na nuvem com sucesso!');
            console.log(`📦 Total de perfumes salvos: ${collection.length}`);
            
            this.lastSyncTime = new Date();
            this.mostrarIndicadorSync('✅ Salvo na nuvem');
            
            this.syncInProgress = false;
            
            // Processa próximo item da fila
            if (this.syncQueue.length > 0) {
                const next = this.syncQueue.shift();
                setTimeout(() => this.salvarNaNuvem(next.email, next.collection, next.profile), 500);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao salvar na nuvem:', error);
            this.syncInProgress = false;
            this.mostrarIndicadorSync('❌ Erro ao salvar', true);
            return false;
        }
    }
    
    // ============================================
    // SINCRONIZAR (MERGE INTELIGENTE)
    // ============================================
    
    async sincronizar(email) {
        if (!email) {
            console.warn('⚠️ Email não fornecido para sincronizar');
            return;
        }
        
        try {
            console.log('🔄 Iniciando sincronização...');
            
            // 1. Carrega da nuvem
            const nuvem = await this.carregarDaNuvem(email);
            
            // 2. Carrega do localStorage
            const local = JSON.parse(localStorage.getItem('minhaColecao') || '[]');
            const perfilLocal = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
            
            // 3. Se não tem nada na nuvem, sobe o local
            if (!nuvem) {
                console.log('📤 Primeira sincronização - enviando dados locais para nuvem');
                await this.salvarNaNuvem(email, local, perfilLocal);
                return;
            }
            
            // 4. Se não tem nada no local, baixa da nuvem
            if (local.length === 0) {
                console.log('📥 Coleção local vazia - carregando da nuvem');
                localStorage.setItem('minhaColecao', JSON.stringify(nuvem.collection));
                if (nuvem.profile) {
                    localStorage.setItem('perfilUsuario', JSON.stringify(nuvem.profile));
                }
                
                // Atualiza interface
                if (typeof minhaColecao !== 'undefined') {
                    minhaColecao = nuvem.collection;
                }
                if (typeof atualizarListaColecao === 'function') {
                    atualizarListaColecao();
                }
                if (typeof carregarPerfil === 'function') {
                    carregarPerfil();
                }
                
                this.mostrarIndicadorSync('✅ Carregado da nuvem');
                return;
            }
            
            // 5. MERGE INTELIGENTE - combina local + nuvem (sem duplicatas)
            console.log('🔀 Fazendo merge entre local e nuvem...');
            
            const merged = [...nuvem.collection];
            const nomesNaNuvem = new Set(
                nuvem.collection.map(p => {
                    const nome = typeof p === 'string' ? p : p.nome;
                    const conc = typeof p === 'string' ? 'Eau de Parfum' : p.concentracao;
                    return `${nome}|${conc}`;
                })
            );
            
            // Adiciona perfumes do local que não estão na nuvem
            local.forEach(perfume => {
                const nome = typeof perfume === 'string' ? perfume : perfume.nome;
                const conc = typeof perfume === 'string' ? 'Eau de Parfum' : perfume.concentracao;
                const chave = `${nome}|${conc}`;
                
                if (!nomesNaNuvem.has(chave)) {
                    merged.push(perfume);
                    console.log(`➕ Adicionado do local: ${nome} (${conc})`);
                }
            });
            
            // Ordena alfabeticamente
            merged.sort((a, b) => {
                const nomeA = typeof a === 'string' ? a : a.nome;
                const nomeB = typeof b === 'string' ? b : b.nome;
                return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
            });
            
            // 6. Salva resultado do merge
            localStorage.setItem('minhaColecao', JSON.stringify(merged));
            await this.salvarNaNuvem(email, merged, perfilLocal);
            
            // Atualiza interface
            if (typeof minhaColecao !== 'undefined') {
                minhaColecao = merged;
            }
            if (typeof atualizarListaColecao === 'function') {
                atualizarListaColecao();
            }
            
            console.log('✅ Sincronização concluída!');
            console.log(`📊 Total após merge: ${merged.length} perfumes`);
            
            this.mostrarIndicadorSync('✅ Sincronizado');
            
        } catch (error) {
            console.error('❌ Erro na sincronização:', error);
            this.mostrarIndicadorSync('❌ Erro na sincronização', true);
        }
    }
    
    // ============================================
    // INDICADOR VISUAL DE SINCRONIZAÇÃO
    // ============================================
    
    mostrarIndicadorSync(mensagem, isError = false) {
        // Remove indicador anterior se existir
        const existente = document.getElementById('sync-indicator');
        if (existente) existente.remove();
        
        const indicator = document.createElement('div');
        indicator.id = 'sync-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${isError ? 'linear-gradient(135deg, #f44336, #d32f2f)' : 'linear-gradient(135deg, #4CAF50, #45a049)'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 0.9em;
            font-weight: 600;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        indicator.textContent = mensagem;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(indicator);
        
        // Remove após 3 segundos
        setTimeout(() => {
            indicator.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => indicator.remove(), 300);
        }, 3000);
    }
    
    // ============================================
    // LIMPAR DADOS DA NUVEM (para testes)
    // ============================================
    
    async limparNuvem(email) {
        if (!email) {
            console.warn('⚠️ Email não fornecido');
            return false;
        }
        
        try {
            console.log('🗑️ Limpando dados da nuvem...');
            
            const response = await fetch(
                `${this.SUPABASE_URL}/rest/v1/user_collections?email=eq.${email.toLowerCase()}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': this.SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${this.SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                console.error('❌ Erro ao limpar:', response.status);
                return false;
            }
            
            console.log('✅ Dados da nuvem limpos!');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao limpar nuvem:', error);
            return false;
        }
    }
}

// ============================================
// INICIALIZAÇÃO GLOBAL
// ============================================

window.supabaseSync = new SupabaseSync();
console.log('✅ Sistema de sincronização Supabase pronto!');

// ============================================
// FUNÇÕES DE CONVENIÊNCIA (para o console)
// ============================================

// Sincronizar manualmente
window.syncNow = async function() {
    const email = localStorage.getItem('userEmail');
    if (!email) {
        console.error('❌ Nenhum email encontrado. Faça login primeiro.');
        return;
    }
    await window.supabaseSync.sincronizar(email);
};

// Ver última sincronização
window.lastSync = function() {
    if (window.supabaseSync.lastSyncTime) {
        console.log('🕐 Última sincronização:', window.supabaseSync.lastSyncTime.toLocaleString('pt-BR'));
    } else {
        console.log('⚠️ Ainda não houve sincronização');
    }
};

// Limpar dados da nuvem (CUIDADO!)
window.limparNuvem = async function() {
    const email = localStorage.getItem('userEmail');
    if (!email) {
        console.error('❌ Nenhum email encontrado');
        return;
    }
    
    if (confirm('⚠️ ATENÇÃO: Isso vai apagar TODOS os dados da nuvem para este email. Continuar?')) {
        await window.supabaseSync.limparNuvem(email);
    }
};
