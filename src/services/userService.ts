import { User } from '../contexts/AuthContext';

export interface AssignmentRequest {
  candidateIds: string[];
  analystId: string;
  adminId: string;
}

// Serviço para comunicação com Google Sheets
class GoogleSheetsService {
  private scriptUrl: string;

  constructor(scriptUrl: string) {
    this.scriptUrl = scriptUrl;
  }

  async fetchData(action: string, data?: any): Promise<any> {
    try {
      if (!this.scriptUrl) {
        throw new Error('URL do Google Script não configurada. Verifique o arquivo .env');
      }

      const payload = {
        action,
        ...data
      };

      console.log('🔄 [UserService] Chamando Google Apps Script:', action);
      console.log('📦 [UserService] Payload:', payload);

      const response = await fetch(this.scriptUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('📡 [UserService] Resposta recebida - Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [UserService] Erro na resposta:', errorText);
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ [UserService] Dados recebidos:', result);
      return result;
    } catch (error) {
      console.error('❌ [UserService] Erro na comunicação com Google Apps Script:', error);
      console.error('🔍 URL configurada:', this.scriptUrl);
      console.error('🔍 Action:', action);
      console.error('🔍 Data:', data);
      throw error;
    }
  }
}

const SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwQK8whrNC039L5V-7JeVLAjkdsrPM65L3YhdCPPWrF782uQv5UTdsitYMwUS9BQuyj/exec';
const sheetsService = new GoogleSheetsService(SCRIPT_URL);

export async function getUsers(): Promise<User[]> {
  try {
    const result = await sheetsService.fetchData('getAllUsers');
    if (result && result.users) {
      return result.users.map((user: any) => ({
        id: user.Email || user.id,
        email: user.Email || user.email,
        name: user.Nome || user.name,
        role: user.Role || user.role,
        active: user.Ativo !== undefined ? user.Ativo : user.active,
        password: user.Password || user.password
      }));
    }
    return [];
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    throw error;
  }
}

export async function getAnalysts(): Promise<User[]> {
  try {
    console.log('🔍 Buscando analistas...');
    const result = await sheetsService.fetchData('getAnalysts');
    console.log('📥 Resultado completo de getAnalysts:', JSON.stringify(result, null, 2));

    // Verificar se houve erro na requisição
    if (!result) {
      console.error('❌ Resultado vazio ou null');
      return [];
    }

    if (result.success === false) {
      console.error('❌ Erro retornado do servidor:', result.error);
      return [];
    }

    // CORREÇÃO: Verificar múltiplas estruturas possíveis
    let analysts = [];

    if (result.success && result.data && result.data.analysts && Array.isArray(result.data.analysts)) {
      // Estrutura: { success: true, data: { analysts: [...] } }
      console.log('📦 Estrutura detectada: { success: true, data: { analysts: [...] } }');
      analysts = result.data.analysts;
    } else if (result.success && result.data && Array.isArray(result.data)) {
      // Estrutura: { success: true, data: [...] }
      console.log('📦 Estrutura detectada: { success: true, data: [...] }');
      analysts = result.data;
    } else if (result.success && result.analysts && Array.isArray(result.analysts)) {
      // Estrutura: { success: true, analysts: [...] }
      console.log('📦 Estrutura detectada: { success: true, analysts: [...] }');
      analysts = result.analysts;
    } else if (result.data && result.data.analysts && Array.isArray(result.data.analysts)) {
      // Estrutura: { data: { analysts: [...] } }
      console.log('📦 Estrutura detectada: { data: { analysts: [...] } }');
      analysts = result.data.analysts;
    } else if (result.data && Array.isArray(result.data)) {
      // Estrutura: { data: [...] }
      console.log('📦 Estrutura detectada: { data: [...] }');
      analysts = result.data;
    } else if (Array.isArray(result)) {
      // Estrutura: [...] (array direto)
      console.log('📦 Estrutura detectada: [...] (array direto)');
      analysts = result;
    } else {
      console.warn('⚠️ Estrutura de dados inesperada:', result);
      console.warn('⚠️ Tipo de result:', typeof result);
      console.warn('⚠️ result.success:', result.success);
      console.warn('⚠️ result.data:', result.data);
      console.warn('⚠️ Verificar logs do Google Apps Script');
      analysts = [];
    }

    console.log('✅ Analistas extraídos:', analysts);
    console.log('📊 Total de analistas:', analysts.length);

    if (analysts.length === 0) {
      console.warn('⚠️ Nenhum analista encontrado. Verifique:');
      console.warn('   1. Se há usuários com role "analista" na aba USUARIOS');
      console.warn('   2. Se o Google Apps Script está retornando dados corretos');
      console.warn('   3. Os logs do Google Apps Script para mais detalhes');
    }

    // Mapear para o formato User
    const mappedAnalysts = analysts.map((analyst: any) => ({
      id: analyst.id || analyst.Email || analyst.email,
      email: analyst.Email || analyst.email,
      name: analyst.Nome || analyst.name || 'Nome não informado',
      role: analyst.Role || analyst.role || 'analista',
      active: analyst.Ativo !== undefined ? analyst.Ativo : (analyst.active !== false)
    }));

    console.log('✅ Analistas mapeados:', mappedAnalysts);
    return mappedAnalysts;

  } catch (error) {
    console.error('❌ Erro ao buscar analistas:', error);
    console.error('❌ Stack trace:', error instanceof Error ? error.stack : 'N/A');
    // Retornar array vazio em caso de erro para não quebrar a UI
    return [];
  }
}

export async function createUser(user: Omit<User, 'id' | 'active'>): Promise<User> {
  try {
    return await sheetsService.fetchData('createUser', user);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    throw error;
  }
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  try {
    return await sheetsService.fetchData('updateUser', { id, updates });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    throw error;
  }
}

export async function deactivateUser(id: string): Promise<void> {
  try {
    await sheetsService.fetchData('deactivateUser', { id });
  } catch (error) {
    console.error('Erro ao desativar usuário:', error);
    throw error;
  }
}

export async function assignCandidates(request: AssignmentRequest): Promise<void> {
  try {
    console.log('🔵 Alocando candidatos:', request);

    const result = await sheetsService.fetchData('assignCandidates', {
      candidateIds: request.candidateIds.join(','),
      analystEmail: request.analystId,
      adminEmail: request.adminId
    });

    console.log('✅ Alocação concluída:', result);

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  } catch (error) {
    console.error('❌ Erro ao atribuir candidatos:', error);
    throw error;
  }
}

export async function unassignCandidates(candidateIds: string[]): Promise<void> {
  try {
    await sheetsService.fetchData('unassignCandidates', { candidateIds });
  } catch (error) {
    console.error('Erro ao remover atribuição de candidatos:', error);
    throw error;
  }
}
