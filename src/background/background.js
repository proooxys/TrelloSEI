/**
 * Background Service Worker — SEI + Trello v2
 * Hub central de mensagens entre content script ↔ popup ↔ options
 */

import { TrelloAPI } from './trelloAPI.js';
import { StorageService } from './storage.js';

/* ── Utilitário: instanciar API com credenciais salvas ── */
async function getAPI() {
  const settings = await StorageService.getSettings();
  if (!settings.apiKey || !settings.token) {
    throw new Error('Credenciais do Trello não configuradas. Acesse as opções da extensão.');
  }
  return new TrelloAPI(settings.apiKey, settings.token);
}

/* ── Roteador de mensagens ── */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: err.message }));
  return true; // mantém canal aberto para resposta assíncrona
});

async function handleMessage(msg) {
  const { action, payload } = msg;

  switch (action) {
    /* ── Validação de credenciais ── */
    case 'VALIDATE_CREDENTIALS': {
      const api = new TrelloAPI(payload.apiKey, payload.token);
      return api.validateCredentials();
    }

    /* ── Boards ── */
    case 'GET_BOARDS': {
      const cached = await StorageService.getCachedBoards();
      if (cached) return { boards: cached };
      const api = await getAPI();
      const boards = await api.getBoards();
      await StorageService.setCachedBoards(boards);
      return { boards };
    }

    /* ── Listas de um board ── */
    case 'GET_LISTS': {
      const api = await getAPI();
      const lists = await api.getLists(payload.boardId);
      return { lists };
    }

    /* ── Cards de um board ── */
    case 'GET_CARDS': {
      const api = await getAPI();
      const cards = await api.getCards(payload.boardId);
      return { cards };
    }

    /* ── Card específico com detalhes ── */
    case 'GET_CARD': {
      const api = await getAPI();
      const card = await api.getCard(payload.cardId);
      return { card };
    }

    /* ── Criar card ── */
    case 'CREATE_CARD': {
      const api = await getAPI();
      const card = await api.createCard(payload);
      return { card };
    }

    /* ── Atualizar card ── */
    case 'UPDATE_CARD': {
      const api = await getAPI();
      const card = await api.updateCard(payload.cardId, payload.data);
      return { card };
    }

    /* ── Adicionar attachment (link do SEI) ── */
    case 'ADD_ATTACHMENT': {
      const api = await getAPI();
      const result = await api.addAttachment(payload.cardId, payload.url, payload.name);
      return { result };
    }

    /* ── Buscar cards ── */
    case 'SEARCH_CARDS': {
      const api = await getAPI();
      const result = await api.searchCards(payload.query, payload.boardIds || []);
      return { cards: result.cards || [] };
    }

    /* ── Labels ── */
    case 'GET_LABELS': {
      const api = await getAPI();
      const labels = await api.getLabels(payload.boardId);
      return { labels };
    }

    /* ── Members ── */
    case 'GET_MEMBERS': {
      const api = await getAPI();
      const members = await api.getBoardMembers(payload.boardId);
      return { members };
    }

    /* ── Checklists ── */
    case 'GET_CHECKLISTS': {
      const api = await getAPI();
      const checklists = await api.getChecklists(payload.cardId);
      return { checklists };
    }

    case 'UPDATE_CHECK_ITEM': {
      const api = await getAPI();
      await api.updateCheckItem(payload.cardId, payload.checklistId, payload.checkItemId, payload.state);
      return { success: true };
    }

    /* ── Associações SEI ↔ Card ── */
    case 'GET_ASSOCIATION': {
      const assoc = await StorageService.getAssociation(payload.nrProcesso);
      return { association: assoc };
    }

    case 'SAVE_ASSOCIATION': {
      await StorageService.saveAssociation(payload.nrProcesso, payload.data);
      return { success: true };
    }

    case 'REMOVE_ASSOCIATION': {
      await StorageService.removeAssociation(payload.nrProcesso);
      return { success: true };
    }

    case 'GET_ALL_ASSOCIATIONS': {
      const associations = await StorageService.getAllAssociations();
      return { associations };
    }

    /* ── Settings ── */
    case 'GET_SETTINGS': {
      const settings = await StorageService.getSettings();
      return { settings };
    }

    case 'SAVE_SETTINGS': {
      await StorageService.saveSettings(payload);
      return { success: true };
    }

    default:
      throw new Error(`Ação desconhecida: ${action}`);
  }
}

/* ── Alarme para checar vencimentos ── */
chrome.alarms?.create('checkDueCards', { periodInMinutes: 60 });

chrome.alarms?.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'checkDueCards') return;
  try {
    const settings = await StorageService.getSettings();
    if (!settings.notificaVencimento || !settings.apiKey) return;
    const api = await getAPI();
    if (!settings.defaultBoardId) return;
    const cards = await api.getCards(settings.defaultBoardId);
    const now = new Date();
    const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dueCards = cards.filter(
      (c) => c.due && !c.dueComplete && new Date(c.due) <= soon && new Date(c.due) > now
    );
    if (dueCards.length > 0) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '../icons/icon48.png',
        title: 'SEI + Trello — Cards Vencendo',
        message: `${dueCards.length} card(s) vence(m) nas próximas 24h no Trello.`,
      });
    }
  } catch (_) {}
});
