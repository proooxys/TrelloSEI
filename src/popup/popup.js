/**
 * Popup JS — SEI + Trello v2
 */

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
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) e.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}

document.getElementById('btnSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

async function init() {
  const body = document.getElementById('popupBody');

  try {
    const { settings } = await sendMsg('GET_SETTINGS');

    // Sem credenciais
    if (!settings.apiKey || !settings.token) {
      body.innerHTML = '';
      const wrap = el('div', { className: 'unconfigured' },
        el('div', { className: 'icon' }, '🔑'),
        el('p', {}, 'Configure suas credenciais do Trello para começar.'),
        el('button', { className: 'btn btn--primary', onClick: () => chrome.runtime.openOptionsPage() }, '⚙️ Ir para Configurações')
      );
      body.appendChild(wrap);
      return;
    }

    // Verifica se está numa aba do SEI com processo
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isSEI = tab?.url && (tab.url.includes('sei') && tab.url.includes('gov.br'));

    if (!isSEI) {
      body.innerHTML = '';
      const wrap = el('div', { className: 'outside-sei' },
        el('div', { className: 'icon' }, '🔍'),
        el('p', {}, 'Navegue até uma página do SEI para utilizar a extensão.'),
        el('div', { className: 'divider' }),
        el('button', { className: 'btn btn--secondary', onClick: () => chrome.runtime.openOptionsPage() }, '⚙️ Configurações')
      );
      body.appendChild(wrap);
      return;
    }

    // Tenta buscar número do processo via content script
    let nrProcesso = null;
    try {
      const result = await chrome.tabs.sendMessage(tab.id, { action: 'GET_PROCESSO_NR' });
      nrProcesso = result?.nrProcesso;
    } catch (_) {}

    body.innerHTML = '';
    const wrap = el('div', { className: 'status-section' });

    // Status conexão
    wrap.appendChild(el('div', { className: 'status-row' },
      el('span', { className: 'status-dot status-dot--green' }),
      el('span', {}, 'Conectado ao Trello')
    ));

    if (nrProcesso) {
      // Processo detectado
      wrap.appendChild(el('div', { className: 'status-row' },
        el('span', { className: 'status-dot status-dot--green' }),
        el('span', {}, 'Processo:'),
        el('span', { className: 'processo-badge' }, nrProcesso)
      ));

      // Verifica associação
      const { association } = await sendMsg('GET_ASSOCIATION', { nrProcesso });

      if (association?.cardId) {
        try {
          const { card } = await sendMsg('GET_CARD', { cardId: association.cardId });
          wrap.appendChild(el('div', { className: 'divider' }));
          wrap.appendChild(
            el('a', { className: 'card-link', href: card.shortUrl, target: '_blank' },
              el('span', { className: 'card-link__icon' }, '🃏'),
              el('div', { className: 'card-link__info' },
                el('div', { className: 'card-link__name' }, card.name),
                el('div', { className: 'card-link__sub' }, '↗ Abrir no Trello')
              )
            )
          );
        } catch (_) {}
      } else {
        wrap.appendChild(el('div', { className: 'divider' }));
        wrap.appendChild(
          el('div', { className: 'status-row' },
            el('span', { className: 'status-dot status-dot--grey' }),
            el('span', {}, 'Sem card associado a este processo')
          )
        );
      }
    } else {
      wrap.appendChild(el('div', { className: 'status-row' },
        el('span', { className: 'status-dot status-dot--grey' }),
        el('span', {}, 'Nenhum processo detectado nesta página')
      ));
    }

    wrap.appendChild(el('div', { className: 'divider' }));
    wrap.appendChild(
      el('button', { className: 'btn btn--secondary', onClick: () => chrome.runtime.openOptionsPage() }, '⚙️ Configurações')
    );

    body.appendChild(wrap);

  } catch (err) {
    body.innerHTML = `<div style="color:#eb5a46;padding:16px;font-size:12px">⚠️ ${err.message}</div>`;
  }
}

init();
