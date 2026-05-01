/**
 * TrelloAPI — wrapper para a API REST do Trello
 * Suporta API Key + Token (configurados pelo usuário nas opções da extensão)
 */

export class TrelloAPI {
  constructor(apiKey, token) {
    this.apiKey = apiKey;
    this.token = token;
    this.base = 'https://api.trello.com/1';
  }

  get authParams() {
    return `key=${this.apiKey}&token=${this.token}`;
  }

  async request(path, options = {}) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${this.base}${path}${sep}${this.authParams}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Trello API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  /* ── Autenticação ── */
  async validateCredentials() {
    try {
      const member = await this.request('/members/me?fields=fullName,username,avatarUrl');
      return { valid: true, member };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  /* ── Boards ── */
  async getBoards() {
    return this.request('/members/me/boards?fields=id,name,shortUrl,closed&filter=open');
  }

  /* ── Lists ── */
  async getLists(boardId) {
    return this.request(`/boards/${boardId}/lists?fields=id,name,closed&filter=open`);
  }

  /* ── Cards ── */
  async getCards(boardId) {
    return this.request(
      `/boards/${boardId}/cards?fields=id,name,desc,shortUrl,idList,labels,due,dueComplete,idMembers,idChecklists&checklists=all&members=true`
    );
  }

  async getCard(cardId) {
    return this.request(
      `/cards/${cardId}?fields=id,name,desc,shortUrl,idList,labels,due,dueComplete,idMembers,idChecklists&checklists=all&members=true&attachments=true`
    );
  }

  async createCard({ idList, name, desc = '', due = null, labelIds = [] }) {
    return this.request('/cards', {
      method: 'POST',
      body: JSON.stringify({ idList, name, desc, due, idLabels: labelIds }),
    });
  }

  async updateCard(cardId, data) {
    return this.request(`/cards/${cardId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /* ── Checklists ── */
  async getChecklists(cardId) {
    return this.request(`/cards/${cardId}/checklists`);
  }

  async createChecklist(cardId, name) {
    return this.request('/checklists', {
      method: 'POST',
      body: JSON.stringify({ idCard: cardId, name }),
    });
  }

  async createCheckItem(checklistId, name) {
    return this.request(`/checklists/${checklistId}/checkItems`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async updateCheckItem(cardId, checklistId, checkItemId, state) {
    return this.request(`/cards/${cardId}/checkItem/${checkItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ state }),
    });
  }

  /* ── Labels ── */
  async getLabels(boardId) {
    return this.request(`/boards/${boardId}/labels?fields=id,name,color`);
  }

  /* ── Members ── */
  async getBoardMembers(boardId) {
    return this.request(`/boards/${boardId}/members?fields=id,fullName,username,avatarUrl`);
  }

  /* ── Attachments ── */
  async addAttachment(cardId, url, name) {
    return this.request(`/cards/${cardId}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ url, name }),
    });
  }

  /* ── Busca de cards ── */
  async searchCards(query, boardIds = []) {
    const boardFilter = boardIds.length
      ? `&idBoards=${boardIds.join(',')}`
      : '';
    return this.request(
      `/search?query=${encodeURIComponent(query)}&modelTypes=cards&card_fields=id,name,desc,shortUrl,idList${boardFilter}`
    );
  }
}
