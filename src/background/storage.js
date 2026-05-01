/**
 * StorageService — abstrai o chrome.storage.sync / local
 * Centraliza todas as operações de leitura/escrita da extensão
 */

export const StorageService = {
  /* ── Configurações da extensão ── */
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          apiKey: '',
          token: '',
          defaultBoardId: '',
          defaultListId: '',
          seiDomain: '',
          showPanelOnLoad: true,
          panelPosition: 'right',
          cardTemplate: '',
          incluirNrProcesso: true,
          incluirLink: true,
          notificaVencimento: true,
        },
        resolve
      );
    });
  },

  async saveSettings(settings) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(settings, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  },

  /* ── Associações SEI ↔ Trello ── */
  // Chave: "assoc_<nrProcesso>" → { cardId, boardId, listId, createdAt }
  async getAssociation(nrProcesso) {
    const key = `assoc_${nrProcesso.replace(/\//g, '_')}`;
    return new Promise((resolve) => {
      chrome.storage.local.get({ [key]: null }, (res) => resolve(res[key]));
    });
  },

  async saveAssociation(nrProcesso, data) {
    const key = `assoc_${nrProcesso.replace(/\//g, '_')}`;
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: { ...data, createdAt: Date.now() } }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  },

  async removeAssociation(nrProcesso) {
    const key = `assoc_${nrProcesso.replace(/\//g, '_')}`;
    return new Promise((resolve) => chrome.storage.local.remove(key, resolve));
  },

  async getAllAssociations() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const assocs = {};
        for (const [k, v] of Object.entries(items)) {
          if (k.startsWith('assoc_')) assocs[k.replace('assoc_', '')] = v;
        }
        resolve(assocs);
      });
    });
  },

  /* ── Cache de boards/listas (TTL 5min) ── */
  async getCachedBoards() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ _boardsCache: null, _boardsCacheTs: 0 }, (res) => {
        const age = Date.now() - res._boardsCacheTs;
        resolve(age < 5 * 60 * 1000 ? res._boardsCache : null);
      });
    });
  },

  async setCachedBoards(boards) {
    return new Promise((resolve) =>
      chrome.storage.local.set({ _boardsCache: boards, _boardsCacheTs: Date.now() }, resolve)
    );
  },
};
