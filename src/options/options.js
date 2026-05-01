/**
 * Options Page JS — SEI + Trello v2
 */

/* ── Utilitários ── */
function $(id) { return document.getElementById(id); }

function toast(msg, type = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast toast--${type}`;
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function sendMsg(action, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, payload }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (res?.error) return reject(new Error(res.error));
      resolve(res);
    });
  });
}

/* ── Carregar configurações salvas ── */
async function loadSettings() {
  const { settings } = await sendMsg('GET_SETTINGS');

  $('apiKey').value = settings.apiKey || '';
  $('token').value = settings.token || '';
  $('seiDomain').value = settings.seiDomain || '';
  $('showPanelOnLoad').checked = settings.showPanelOnLoad !== false;
  $('incluirNrProcesso').checked = settings.incluirNrProcesso !== false;
  $('incluirLink').checked = settings.incluirLink !== false;
  $('notificaVencimento').checked = settings.notificaVencimento !== false;
  $('cardTemplate').value = settings.cardTemplate || '';

  if (settings.apiKey && settings.token) {
    await showUserInfo(settings.apiKey, settings.token);
    await loadBoards(settings.defaultBoardId, settings.defaultListId);
  }
}

/* ── Exibir info do usuário Trello ── */
async function showUserInfo(apiKey, token) {
  try {
    const res = await sendMsg('VALIDATE_CREDENTIALS', { apiKey, token });
    if (res.valid && res.member) {
      const { fullName, username, avatarUrl } = res.member;
      $('user-name').textContent = fullName;
      $('user-username').textContent = '@' + username;
      if (avatarUrl) $('user-avatar').src = avatarUrl + '/50.png';
      $('user-info').classList.remove('hidden');
      return true;
    }
  } catch (_) {}
  $('user-info').classList.add('hidden');
  return false;
}

/* ── Carregar boards ── */
async function loadBoards(selectedBoard, selectedList) {
  const boardSel = $('defaultBoard');
  const listSel = $('defaultList');

  try {
    const { boards } = await sendMsg('GET_BOARDS');
    boardSel.innerHTML = '<option value="">— Selecione —</option>';
    for (const b of boards) {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      boardSel.appendChild(opt);
    }
    if (selectedBoard) {
      boardSel.value = selectedBoard;
      await loadLists(selectedBoard, selectedList);
    }
  } catch (err) {
    boardSel.innerHTML = '<option value="">Erro ao carregar boards</option>';
  }
}

async function loadLists(boardId, selectedList) {
  const listSel = $('defaultList');
  listSel.disabled = true;
  listSel.innerHTML = '<option>Carregando…</option>';

  try {
    const { lists } = await sendMsg('GET_LISTS', { boardId });
    listSel.innerHTML = '<option value="">— Selecione a lista —</option>';
    for (const l of lists) {
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = l.name;
      listSel.appendChild(opt);
    }
    if (selectedList) listSel.value = selectedList;
    listSel.disabled = false;
  } catch (_) {
    listSel.innerHTML = '<option value="">Erro ao carregar listas</option>';
    listSel.disabled = false;
  }
}

/* ── Carregar associações ── */
async function loadAssociations(filter = '') {
  const list = $('assocList');
  list.innerHTML = '<div class="loading-msg">Carregando…</div>';

  try {
    const { associations } = await sendMsg('GET_ALL_ASSOCIATIONS');
    const entries = Object.entries(associations).filter(([k]) =>
      !filter || k.includes(filter)
    );

    list.innerHTML = '';

    if (!entries.length) {
      list.innerHTML = '<div class="empty-msg">Nenhuma associação encontrada.</div>';
      return;
    }

    for (const [nrRaw, data] of entries) {
      const nr = nrRaw.replace(/_/g, '/');
      const item = document.createElement('div');
      item.className = 'assoc-item';

      const nrEl = document.createElement('span');
      nrEl.className = 'assoc-item__nr';
      nrEl.textContent = nr;

      const link = document.createElement('a');
      link.className = 'assoc-item__link';
      link.href = `https://trello.com/c/${data.cardId}`;
      link.target = '_blank';
      link.title = 'Abrir card no Trello';
      link.textContent = `Card: ${data.cardId}`;

      const del = document.createElement('button');
      del.className = 'assoc-item__del';
      del.title = 'Remover associação';
      del.textContent = '🗑';
      del.addEventListener('click', async () => {
        if (!confirm(`Remover associação do processo ${nr}?`)) return;
        await sendMsg('REMOVE_ASSOCIATION', { nrProcesso: nr });
        item.remove();
        toast('Associação removida.');
      });

      item.append(nrEl, link, del);
      list.appendChild(item);
    }
  } catch (err) {
    list.innerHTML = `<div class="loading-msg" style="color:red">Erro: ${err.message}</div>`;
  }
}

/* ══════════════════════════════════════════════
   Event Listeners
══════════════════════════════════════════════ */

/* Mostrar/ocultar token */
$('toggleToken').addEventListener('click', () => {
  const inp = $('token');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});

/* Validar & salvar credenciais */
$('btnValidate').addEventListener('click', async () => {
  const apiKey = $('apiKey').value.trim();
  const token = $('token').value.trim();

  if (!apiKey || !token) {
    toast('Preencha API Key e Token.', 'error');
    return;
  }

  $('btnValidate').textContent = 'Validando…';
  $('btnValidate').disabled = true;

  try {
    const valid = await showUserInfo(apiKey, token);
    if (!valid) throw new Error('Credenciais inválidas.');

    await sendMsg('SAVE_SETTINGS', { apiKey, token });
    await loadBoards();
    toast('✓ Credenciais salvas com sucesso!');
  } catch (err) {
    toast('Erro: ' + err.message, 'error');
  } finally {
    $('btnValidate').textContent = 'Validar & Salvar';
    $('btnValidate').disabled = false;
  }
});

/* Limpar credenciais */
$('btnClearAuth').addEventListener('click', async () => {
  if (!confirm('Limpar todas as credenciais do Trello?')) return;
  await sendMsg('SAVE_SETTINGS', { apiKey: '', token: '' });
  $('apiKey').value = '';
  $('token').value = '';
  $('user-info').classList.add('hidden');
  $('defaultBoard').innerHTML = '<option value="">— Selecione —</option>';
  $('defaultList').innerHTML = '<option value="">— Selecione um board —</option>';
  $('defaultList').disabled = true;
  toast('Credenciais removidas.');
});

/* Trocar board → carrega listas */
$('defaultBoard').addEventListener('change', () => {
  const boardId = $('defaultBoard').value;
  if (boardId) loadLists(boardId, null);
  else {
    $('defaultList').innerHTML = '<option value="">— Selecione um board primeiro —</option>';
    $('defaultList').disabled = true;
  }
});

/* Salvar board/lista padrão */
$('btnSaveBoard').addEventListener('click', async () => {
  await sendMsg('SAVE_SETTINGS', {
    defaultBoardId: $('defaultBoard').value,
    defaultListId: $('defaultList').value,
  });
  toast('✓ Preferências de board salvas!');
});

/* Salvar opções de cards */
$('btnSaveCards').addEventListener('click', async () => {
  await sendMsg('SAVE_SETTINGS', {
    incluirNrProcesso: $('incluirNrProcesso').checked,
    incluirLink: $('incluirLink').checked,
    notificaVencimento: $('notificaVencimento').checked,
    cardTemplate: $('cardTemplate').value,
  });
  toast('✓ Configurações de cards salvas!');
});

/* Salvar opções do painel */
$('btnSavePainel').addEventListener('click', async () => {
  await sendMsg('SAVE_SETTINGS', {
    showPanelOnLoad: $('showPanelOnLoad').checked,
    seiDomain: $('seiDomain').value.trim(),
  });
  toast('✓ Configurações do painel salvas!');
});

/* Filtrar associações */
let filterDebounce;
$('assocFilter').addEventListener('input', () => {
  clearTimeout(filterDebounce);
  filterDebounce = setTimeout(() => loadAssociations($('assocFilter').value.trim()), 300);
});

/* Limpar todas as associações */
$('btnClearAll').addEventListener('click', async () => {
  if (!confirm('Remover TODAS as associações? Esta ação não pode ser desfeita.')) return;
  const { associations } = await sendMsg('GET_ALL_ASSOCIATIONS');
  for (const nr of Object.keys(associations)) {
    await sendMsg('REMOVE_ASSOCIATION', { nrProcesso: nr.replace(/_/g, '/') });
  }
  await loadAssociations();
  toast('Todas as associações foram removidas.');
});

/* Smooth scroll para seções pelo menu */
document.querySelectorAll('.menu-item').forEach((item) => {
  item.addEventListener('click', (e) => {
    document.querySelectorAll('.menu-item').forEach((i) => i.classList.remove('active'));
    item.classList.add('active');
  });
});

/* Intersection Observer para ativar menu */
const sections = document.querySelectorAll('.section');
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      document.querySelectorAll('.menu-item').forEach((i) => i.classList.remove('active'));
      document.querySelector(`.menu-item[href="#${id}"]`)?.classList.add('active');
    }
  }
}, { threshold: 0.4 });

sections.forEach((s) => observer.observe(s));

/* ── Init ── */
loadSettings();
loadAssociations();
