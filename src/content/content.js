/**
 * Content Script — SEI + Trello v2
 * Injetado nas páginas do SEI. Detecta o número do processo,
 * injeta o painel lateral e gerencia toda a UI dentro do SEI.
 */

(function () {
  'use strict';

  // Evita injeção dupla
  if (window.__seiTrelloInjected) return;
  window.__seiTrelloInjected = true;

  /* ══════════════════════════════════════════════
     1. UTILITÁRIOS
  ══════════════════════════════════════════════ */

  function sendMsg(action, payload = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, payload }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (res?.error) return reject(new Error(res.error));
        resolve(res);
      });
    });
  }

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') e.className = v;
      else if (k === 'innerHTML') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
    for (const c of children) {
      if (c) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function labelColor(color) {
    const map = {
      green: '#61bd4f', yellow: '#f2d600', orange: '#ff9f1a',
      red: '#eb5a46', purple: '#c377e0', blue: '#0079bf',
      sky: '#00c2e0', lime: '#51e898', pink: '#ff78cb',
      black: '#344563', null: '#b3bac5',
    };
    return map[color] || '#b3bac5';
  }

  /* ══════════════════════════════════════════════
     2. DETECÇÃO DO PROCESSO SEI
  ══════════════════════════════════════════════ */

  function detectarProcesso() {
    // Tenta vários seletores comuns do SEI
    const selectors = [
      '.processoVisualizado',
      '#spanNrProcesso',
      '[id*="ProcessoFormatado"]',
      'a[href*="processo"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const texto = el.textContent.trim();
        const match = texto.match(/\d{5}\.\d{6}\/\d{4}-\d{2}/);
        if (match) return match[0];
      }
    }

    // Fallback: busca no texto da página inteira
    const match = document.body.innerText.match(/\d{5}\.\d{6}\/\d{4}-\d{2}/);
    return match ? match[0] : null;
  }

  function detectarTituloProcesso() {
    const selectors = ['#lblEspecificacao', '.especificacao', '[id*="Especificacao"]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.textContent.trim()) return el.textContent.trim();
    }
    return document.title || 'Processo SEI';
  }

  /* ══════════════════════════════════════════════
     3. PAINEL LATERAL
  ══════════════════════════════════════════════ */

  let panel = null;
  let currentProcesso = null;
  let currentSettings = null;

  async function initPanel() {
    currentSettings = (await sendMsg('GET_SETTINGS')).settings;
    currentProcesso = detectarProcesso();

    if (!currentProcesso) return; // Não é página de processo
    if (!currentSettings.apiKey || !currentSettings.token) return;

    criarPainel();
    carregarDados();
  }

  function criarPainel() {
    // Remove painel anterior se existir
    document.getElementById('st-panel')?.remove();

    panel = el('div', { id: 'st-panel', className: 'st-panel st-panel--loading' });

    // Cabeçalho
    const header = el('div', { className: 'st-panel__header' },
      el('div', { className: 'st-panel__logo' },
        el('span', { className: 'st-logo-icon' }, '🗂️'),
        el('span', { className: 'st-logo-text' }, 'SEI + Trello')
      ),
      el('div', { className: 'st-panel__actions' },
        el('button', { className: 'st-btn-icon', title: 'Recarregar', onClick: carregarDados }, '↻'),
        el('button', { className: 'st-btn-icon st-btn-close', title: 'Fechar painel', onClick: () => panel.classList.toggle('st-panel--collapsed') }, '✕')
      )
    );

    const processoInfo = el('div', { className: 'st-processo-info' },
      el('span', { className: 'st-processo-label' }, 'Processo:'),
      el('strong', { className: 'st-processo-nr' }, currentProcesso)
    );

    const body = el('div', { id: 'st-panel-body', className: 'st-panel__body' },
      el('div', { className: 'st-spinner-wrap' },
        el('div', { className: 'st-spinner' }),
        el('p', {}, 'Carregando dados do Trello…')
      )
    );

    panel.append(header, processoInfo, body);
    document.body.appendChild(panel);
  }

  async function carregarDados() {
    if (!panel) return;

    const body = document.getElementById('st-panel-body');
    body.innerHTML = '<div class="st-spinner-wrap"><div class="st-spinner"></div><p>Carregando…</p></div>';

    try {
      const { association } = await sendMsg('GET_ASSOCIATION', { nrProcesso: currentProcesso });

      if (association?.cardId) {
        await renderizarCardAssociado(body, association);
      } else {
        renderizarSemAssociacao(body);
      }
    } catch (err) {
      body.innerHTML = `<div class="st-error">⚠️ ${err.message}</div>`;
    }
  }

  /* ── Sem associação ── */
  function renderizarSemAssociacao(body) {
    body.innerHTML = '';

    const wrap = el('div', { className: 'st-sem-assoc' },
      el('div', { className: 'st-sem-assoc__icon' }, '🔗'),
      el('p', { className: 'st-sem-assoc__msg' }, 'Nenhum card do Trello associado a este processo.'),
      el('button', { className: 'st-btn st-btn--primary', onClick: () => abrirModalCriar() }, '+ Criar novo card'),
      el('button', { className: 'st-btn st-btn--secondary', onClick: () => abrirModalAssociar() }, '🔍 Associar card existente')
    );

    body.appendChild(wrap);
  }

  /* ── Card associado ── */
  async function renderizarCardAssociado(body, association) {
    body.innerHTML = '<div class="st-spinner-wrap"><div class="st-spinner"></div><p>Buscando card…</p></div>';

    try {
      const { card } = await sendMsg('GET_CARD', { cardId: association.cardId });
      body.innerHTML = '';
      body.appendChild(renderCard(card, association));
    } catch (err) {
      body.innerHTML = `<div class="st-error">⚠️ Erro ao buscar card: ${err.message}
        <br><button class="st-btn st-btn--danger" id="st-desassociar">Remover associação</button></div>`;
      document.getElementById('st-desassociar')?.addEventListener('click', desassociar);
    }
  }

  function renderCard(card, association) {
    const wrap = el('div', { className: 'st-card-detail' });

    // Badges de labels
    const labelsEl = el('div', { className: 'st-labels' });
    for (const lbl of card.labels || []) {
      labelsEl.appendChild(el('span', {
        className: 'st-label',
        style: `background:${labelColor(lbl.color)}`,
      }, lbl.name || ''));
    }

    // Due date
    const dueClass = card.due
      ? (card.dueComplete ? 'st-due--ok' : new Date(card.due) < new Date() ? 'st-due--late' : 'st-due--soon')
      : '';
    const dueEl = card.due
      ? el('div', { className: `st-due ${dueClass}` },
          el('span', {}, card.dueComplete ? '✅' : '📅'),
          el('span', {}, formatDate(card.due))
        )
      : null;

    // Título
    const titleEl = el('a', {
      className: 'st-card-title',
      href: card.shortUrl,
      target: '_blank',
      title: 'Abrir no Trello',
    }, card.name);

    // Descrição
    const descEl = card.desc
      ? el('p', { className: 'st-card-desc' }, card.desc.slice(0, 200) + (card.desc.length > 200 ? '…' : ''))
      : null;

    // Checklists
    const checklistsEl = el('div', { className: 'st-checklists' });
    for (const cl of card.checklists || []) {
      const total = cl.checkItems?.length || 0;
      const done = cl.checkItems?.filter((i) => i.state === 'complete').length || 0;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      const clEl = el('div', { className: 'st-checklist' },
        el('div', { className: 'st-checklist__header' },
          el('span', { className: 'st-checklist__name' }, cl.name),
          el('span', { className: 'st-checklist__count' }, `${done}/${total}`)
        ),
        el('div', { className: 'st-progress' },
          el('div', { className: `st-progress__bar ${pct === 100 ? 'st-progress__bar--done' : ''}`, style: `width:${pct}%` })
        )
      );

      // Items individuais
      const itemsEl = el('div', { className: 'st-checklist__items' });
      for (const item of cl.checkItems || []) {
        const checked = item.state === 'complete';
        const itemEl = el('label', { className: 'st-check-item' },
          el('input', {
            type: 'checkbox',
            checked: checked ? 'checked' : '',
            onChange: async (e) => {
              const state = e.target.checked ? 'complete' : 'incomplete';
              try {
                await sendMsg('UPDATE_CHECK_ITEM', {
                  cardId: card.id,
                  checklistId: cl.id,
                  checkItemId: item.id,
                  state,
                });
                // Atualiza progresso localmente
                item.state = state;
                carregarDados();
              } catch (err) {
                e.target.checked = !e.target.checked;
              }
            }
          }),
          el('span', { className: checked ? 'st-check-item__text--done' : '' }, item.name)
        );
        itemsEl.appendChild(itemEl);
      }
      clEl.appendChild(itemsEl);
      checklistsEl.appendChild(clEl);
    }

    // Botões de ação
    const actions = el('div', { className: 'st-card-actions' },
      el('a', { className: 'st-btn st-btn--primary', href: card.shortUrl, target: '_blank' }, '↗ Abrir no Trello'),
      el('button', { className: 'st-btn st-btn--secondary', onClick: () => adicionarLinkSEI(card.id) }, '🔗 Adicionar link SEI'),
      el('button', { className: 'st-btn st-btn--danger', onClick: desassociar }, '✕ Desassociar')
    );

    wrap.append(labelsEl);
    if (dueEl) wrap.appendChild(dueEl);
    wrap.append(titleEl);
    if (descEl) wrap.appendChild(descEl);
    if ((card.checklists || []).length > 0) wrap.appendChild(checklistsEl);
    wrap.appendChild(actions);

    return wrap;
  }

  /* ══════════════════════════════════════════════
     4. MODAIS
  ══════════════════════════════════════════════ */

  function criarModal(titulo, conteudo) {
    document.getElementById('st-modal-overlay')?.remove();

    const overlay = el('div', { id: 'st-modal-overlay', className: 'st-modal-overlay',
      onClick: (e) => { if (e.target === overlay) overlay.remove(); }
    });

    const modal = el('div', { className: 'st-modal' },
      el('div', { className: 'st-modal__header' },
        el('h3', {}, titulo),
        el('button', { className: 'st-btn-icon', onClick: () => overlay.remove() }, '✕')
      ),
      el('div', { className: 'st-modal__body' }, conteudo)
    );

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    return { overlay, modal };
  }

  /* ── Modal: Criar card ── */
  async function abrirModalCriar() {
    const { overlay, modal } = criarModal('Criar Card no Trello', el('div', {}, el('p', {}, 'Carregando boards…')));
    const body = modal.querySelector('.st-modal__body');

    try {
      const { boards } = await sendMsg('GET_BOARDS');
      const titulo = detectarTituloProcesso();
      const url = window.location.href;

      body.innerHTML = '';

      const form = el('div', { className: 'st-form' });

      // Board
      const boardSel = el('select', { id: 'st-board', className: 'st-select' },
        el('option', { value: '' }, '— Selecione o Board —'),
        ...boards.map((b) => el('option', { value: b.id }, b.name))
      );

      // Lista (preenchida ao escolher board)
      const listSel = el('select', { id: 'st-list', className: 'st-select', disabled: 'disabled' },
        el('option', { value: '' }, '— Selecione o Board primeiro —')
      );

      boardSel.addEventListener('change', async () => {
        listSel.innerHTML = '<option>Carregando…</option>';
        listSel.disabled = true;
        const { lists } = await sendMsg('GET_LISTS', { boardId: boardSel.value });
        listSel.innerHTML = '';
        listSel.appendChild(el('option', { value: '' }, '— Selecione a Lista —'));
        for (const l of lists) listSel.appendChild(el('option', { value: l.id }, l.name));
        listSel.disabled = false;

        // Pré-seleciona lista padrão
        if (currentSettings.defaultListId) listSel.value = currentSettings.defaultListId;
      });

      // Pré-seleciona board padrão
      if (currentSettings.defaultBoardId) {
        boardSel.value = currentSettings.defaultBoardId;
        boardSel.dispatchEvent(new Event('change'));
      }

      const nomeInput = el('input', {
        type: 'text', id: 'st-card-nome', className: 'st-input',
        value: currentSettings.incluirNrProcesso ? `[${currentProcesso}] ${titulo}` : titulo,
        placeholder: 'Nome do card',
      });

      const descInput = el('textarea', {
        id: 'st-card-desc', className: 'st-textarea',
        placeholder: 'Descrição (opcional)',
        rows: '3',
      });

      if (currentSettings.incluirLink) {
        descInput.value = `🔗 Processo SEI: ${currentProcesso}\n${url}\n\n`;
      }

      const dueInput = el('input', { type: 'date', id: 'st-card-due', className: 'st-input' });

      const btnCriar = el('button', { className: 'st-btn st-btn--primary', onClick: async () => {
        btnCriar.disabled = true;
        btnCriar.textContent = 'Criando…';
        try {
          await criarCard({
            idList: listSel.value,
            name: nomeInput.value,
            desc: descInput.value,
            due: dueInput.value || null,
          });
          overlay.remove();
        } catch (err) {
          alert('Erro: ' + err.message);
          btnCriar.disabled = false;
          btnCriar.textContent = 'Criar Card';
        }
      } }, 'Criar Card');

      form.append(
        el('label', { className: 'st-label-form' }, 'Board'),
        boardSel,
        el('label', { className: 'st-label-form' }, 'Lista'),
        listSel,
        el('label', { className: 'st-label-form' }, 'Nome do Card'),
        nomeInput,
        el('label', { className: 'st-label-form' }, 'Descrição'),
        descInput,
        el('label', { className: 'st-label-form' }, 'Data de Vencimento'),
        dueInput,
        btnCriar
      );

      body.appendChild(form);
    } catch (err) {
      body.innerHTML = `<div class="st-error">⚠️ ${err.message}</div>`;
    }
  }

  /* ── Modal: Associar card existente ── */
  async function abrirModalAssociar() {
    const { overlay, modal } = criarModal('Associar Card Existente', el('div', {}, el('p', {}, 'Carregando…')));
    const body = modal.querySelector('.st-modal__body');

    try {
      const { boards } = await sendMsg('GET_BOARDS');
      body.innerHTML = '';

      const form = el('div', { className: 'st-form' });

      const searchInput = el('input', {
        type: 'text', className: 'st-input',
        placeholder: 'Buscar card pelo nome…',
      });

      const resultList = el('div', { className: 'st-search-results' });

      let debounce;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
          const q = searchInput.value.trim();
          if (q.length < 3) return;
          resultList.innerHTML = '<div class="st-spinner-wrap"><div class="st-spinner"></div></div>';
          try {
            const { cards } = await sendMsg('SEARCH_CARDS', {
              query: q,
              boardIds: boards.map((b) => b.id),
            });
            resultList.innerHTML = '';
            if (!cards.length) {
              resultList.innerHTML = '<p class="st-muted">Nenhum card encontrado.</p>';
              return;
            }
            for (const c of cards) {
              const item = el('div', { className: 'st-search-result-item', onClick: async () => {
                await associarCard(c.id, null, null);
                overlay.remove();
              } },
                el('strong', {}, c.name),
                el('span', { className: 'st-muted' }, c.shortUrl)
              );
              resultList.appendChild(item);
            }
          } catch (err) {
            resultList.innerHTML = `<div class="st-error">⚠️ ${err.message}</div>`;
          }
        }, 400);
      });

      form.append(
        el('label', { className: 'st-label-form' }, 'Buscar card'),
        searchInput,
        resultList
      );

      body.appendChild(form);
    } catch (err) {
      body.innerHTML = `<div class="st-error">⚠️ ${err.message}</div>`;
    }
  }

  /* ══════════════════════════════════════════════
     5. AÇÕES
  ══════════════════════════════════════════════ */

  async function criarCard(data) {
    const { card } = await sendMsg('CREATE_CARD', data);
    await associarCard(card.id, null, data.idList);
    carregarDados();
  }

  async function associarCard(cardId, boardId, listId) {
    await sendMsg('SAVE_ASSOCIATION', {
      nrProcesso: currentProcesso,
      data: { cardId, boardId, listId },
    });

    // Adiciona link do SEI como attachment no card
    if (currentSettings.incluirLink) {
      try {
        await sendMsg('ADD_ATTACHMENT', {
          cardId,
          url: window.location.href,
          name: `SEI — ${currentProcesso}`,
        });
      } catch (_) {}
    }

    carregarDados();
  }

  async function desassociar() {
    if (!confirm('Remover associação entre este processo e o card do Trello?')) return;
    await sendMsg('REMOVE_ASSOCIATION', { nrProcesso: currentProcesso });
    carregarDados();
  }

  async function adicionarLinkSEI(cardId) {
    try {
      await sendMsg('ADD_ATTACHMENT', {
        cardId,
        url: window.location.href,
        name: `SEI — ${currentProcesso}`,
      });
      alert('Link do SEI adicionado ao card com sucesso!');
    } catch (err) {
      alert('Erro ao adicionar link: ' + err.message);
    }
  }

  /* ══════════════════════════════════════════════
     6. INICIALIZAÇÃO
  ══════════════════════════════════════════════ */

  // Aguarda DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPanel);
  } else {
    initPanel();
  }

  // Observa navegação SPA (SEI usa iframes e navegação dinâmica)
  const observer = new MutationObserver(() => {
    const nr = detectarProcesso();
    if (nr && nr !== currentProcesso) {
      currentProcesso = nr;
      carregarDados();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
