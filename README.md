# Nobre & JJCar

Site institucional estático em português. Não exige instalação de dependências ou build.

## Visualização

Abra `index.html` no navegador ou inicie um servidor nesta pasta:

```bash
python -m http.server 4173
```

O site estará disponível na porta 4173 do computador local.

## Estrutura

- `index.html`: conteúdo, formulário de contato e perguntas frequentes.
- `styles.css`: identidade visual e layout principal.
- `mobile.css`: adaptações para tablet e celular.
- `script.js`: menu, navegação, animações e preparação da mensagem para WhatsApp.
- `assets/`: recortes WebP otimizados das imagens fornecidas.
- `imagems/`: materiais originais preservados localmente, não necessários para a publicação.

As fontes DM Sans e Playfair Display são carregadas pelo Google Fonts, com alternativas locais caso a conexão não esteja disponível.

O formulário não armazena informações nem envia mensagens automaticamente. Ele abre uma conversa com o número original, `+55 48 98813-4546`, e prepara um texto com as opções escolhidas. O visitante confirma o envio no WhatsApp.

## Testes

```bash
node --check script.js
node --test tests/site.test.cjs
```

Os testes verificam referências locais, links, segurança de novas abas, as nove combinações do formulário, menu, foco de teclado, rolagem e redução de movimento. Usam simulações do DOM e **não substituem a revisão visual em navegador**.

## Publicar no GitHub Pages

Com Git, Node.js e GitHub CLI instalados, autentique sua conta no GitHub CLI e execute:

```bash
rtk proxy bash publicar-github.sh
```

O script publica na conta `Rafaelzzzx`, usando o repositório público `nobre-jjcar`.
Envia apenas os arquivos necessários, configura o Pages a partir da raiz da branch
`main` e aguarda o build do commit enviado. Se o repositório já existir, pede
confirmação antes de atualizar. Não altera o histórico Git da pasta de trabalho
nem copia credenciais. É possível escolher outro nome passando-o como argumento.
