# 🗂️ SEI + Trello v2

Extensão de navegador que integra o **SEI** (Sistema Eletrônico de Informações) com o **Trello** — visualize, crie e associe cards diretamente nos processos do SEI.

---

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 🔍 **Visualizar cards** | Painel lateral com detalhes do card associado ao processo |
| ➕ **Criar cards** | Cria um card no Trello a partir de um processo SEI |
| 🔗 **Associar cards** | Vincula um card existente a um processo |
| ✅ **Checklists** | Visualize e marque itens de checklist sem sair do SEI |
| 📅 **Datas de vencimento** | Exibe alertas visuais de prazo |
| 🔔 **Notificações** | Avisa sobre cards vencendo nas próximas 24h |
| 💾 **Persistência** | Associações salvas localmente no navegador |

---

## 🚀 Instalação

### Chrome / Edge (Manifest V3)

1. Baixe ou clone este repositório
2. Abra `chrome://extensions/` (ou `edge://extensions/`)
3. Ative o **Modo do desenvolvedor** (canto superior direito)
4. Clique em **"Carregar sem compactação"**
5. Selecione a pasta raiz do projeto (onde está o `manifest.json`)

### Firefox (Manifest V2)

1. Renomeie `manifest-firefox.json` → `manifest.json` (substitua o original)
2. Abra `about:debugging#/runtime/this-firefox`
3. Clique em **"Carregar extensão temporária…"**
4. Selecione o arquivo `manifest.json`

> **Nota:** Para Firefox em produção, empacote como `.xpi` e assine via [addons.mozilla.org](https://addons.mozilla.org).

---

## ⚙️ Configuração

Após instalar, clique no ícone 🗂️ na barra de ferramentas e acesse **Configurações**, ou clique com o botão direito → **Opções**.

### 1. Autenticação Trello

1. Acesse [trello.com/app-key](https://trello.com/app-key)
2. Copie sua **API Key**
3. Na mesma página, clique em **"Token"**, autorize e copie o token
4. Cole ambos nas configurações e clique em **Validar & Salvar**

### 2. Board e Lista Padrão

Selecione o board e lista que serão pré-selecionados ao criar novos cards.

### 3. Opções de Cards

- Incluir número do processo no nome do card
- Incluir link do SEI na descrição/attachment
- Template de descrição customizável com variáveis: `{processo}`, `{url}`, `{titulo}`

---

## 📁 Estrutura do Projeto

```
sei-trello/
├── manifest.json              # Chrome/Edge (Manifest V3)
├── manifest-firefox.json      # Firefox (Manifest V2)
├── generate_icons.py          # Script para gerar ícones
└── src/
    ├── background/
    │   ├── background.js      # Service Worker — hub de mensagens
    │   ├── trelloAPI.js       # Wrapper da API REST do Trello
    │   └── storage.js         # Abstração do chrome.storage
    ├── content/
    │   ├── content.js         # Injetado no SEI — UI do painel
    │   └── content.css        # Estilos do painel e modais
    ├── popup/
    │   ├── popup.html         # Popup rápido da barra de ferramentas
    │   ├── popup.css
    │   └── popup.js
    ├── options/
    │   ├── options.html       # Página de configurações completa
    │   ├── options.css
    │   └── options.js
    └── icons/
        ├── icon16.png
        ├── icon32.png
        ├── icon48.png
        └── icon128.png
```

---

## 🔧 Desenvolvimento

### Adicionar suporte a novo órgão SEI

O content script é injetado em URLs que contenham `sei` e `gov.br`. Para domínios customizados, edite o `host_permissions` e os `matches` nos manifestos:

```json
"host_permissions": [
  "*://sei.meuorgao.gov.br/*"
]
```

### Adicionar novas funcionalidades

1. **Background:** adicione um novo `case` em `handleMessage()` em `background.js`
2. **Content:** chame via `sendMsg('NOVO_ACTION', payload)`
3. **TrelloAPI:** adicione o método na classe `TrelloAPI`

### Regenerar ícones

```bash
python3 generate_icons.py
# Com melhor qualidade (requer cairosvg):
pip install cairosvg && python3 generate_icons.py
```

---

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch: `git checkout -b feature/minha-feature`
3. Commit: `git commit -m 'feat: minha nova feature'`
4. Push: `git push origin feature/minha-feature`
5. Abra um Pull Request

---

## 📋 Roadmap

- [ ] Suporte a múltiplos cards por processo
- [ ] Criação de checklists pelo SEI
- [ ] Atribuição de membros ao criar card
- [ ] Sincronização bidirecional de prazos
- [ ] Exportação de relatório de associações
- [ ] Suporte a Power-Ups do Trello

---

## ⚠️ Aviso Legal

Esta extensão **não é oficial** e não possui vínculo com o Governo Federal, o Ministério da Gestão ou com o Trello/Atlassian. Use por sua conta e risco. Suas credenciais são armazenadas localmente no seu navegador.

---

## 📄 Licença

MIT License — veja [LICENSE](LICENSE) para detalhes.
