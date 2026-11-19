#!/usr/bin/env bash
# Execute no seu terminal autenticado. Não usa nem exibe tokens.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
NAME="${1:-nobre-jjcar}"
[[ "$NAME" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || {
  printf 'Nome de repositório inválido.\n' >&2
  exit 1
}

for tool in gh git node; do
  command -v "$tool" >/dev/null || {
    printf 'Comando necessário não encontrado: %s\n' "$tool" >&2
    exit 1
  }
done

for file in index.html styles.css mobile.css script.js .nojekyll README.md; do
  [[ -f "$ROOT/$file" ]] || { printf 'Arquivo ausente: %s\n' "$file" >&2; exit 1; }
done

node --check "$ROOT/script.js"
node --test "$ROOT/tests/site.test.cjs"

ACCOUNT="$(gh api user --jq '[.login, (.id | tostring)] | @tsv')"
IFS=$'\t' read -r OWNER USER_ID <<< "$ACCOUNT"
[[ "$OWNER" == "Rafaelzzzx" ]] || {
  printf 'Conta ativa: %s. Entre como Rafaelzzzx antes de publicar.\n' "$OWNER" >&2
  exit 1
}
REPO="$OWNER/$NAME"
TEMP="$(mktemp -d -t nobre-publicacao.XXXXXXXX)"
trap 'rm -rf -- "$TEMP"' EXIT

printf '\nDestino: %s (repositório público)\n' "$REPO"
if PRIVATE="$(gh api "repos/$REPO" --jq .private 2>"$TEMP/repo-error")"; then
  [[ "$PRIVATE" == "false" ]] || {
    printf 'Este repositório é privado. Não alterei sua visibilidade. Escolha outro nome.\n' >&2
    exit 1
  }
  read -r -p "O repositório já existe. Atualizar os arquivos deste site nele? [s/N] " CONFIRM
  [[ "$CONFIRM" == [sS] ]] || { printf 'Publicação cancelada, sem alterações.\n'; exit 1; }
else
  if ! grep -q 'HTTP 404' "$TEMP/repo-error"; then
    cat "$TEMP/repo-error" >&2
    exit 1
  fi
  gh repo create "$REPO" --public --description "Site institucional da Nobre Soluções Financeiras e JJCar"
fi

gh repo clone "$REPO" "$TEMP/site"
cd "$TEMP/site"
if git show-ref --verify --quiet refs/heads/main; then
  git switch main
elif git show-ref --verify --quiet refs/remotes/origin/main; then
  git switch --track origin/main
else
  git switch -c main
fi

# Somente os arquivos do site; nunca copia credenciais ou pastas de configuração.
cp -- "$ROOT/index.html" "$ROOT/styles.css" "$ROOT/mobile.css" \
  "$ROOT/script.js" "$ROOT/.nojekyll" "$ROOT/README.md" "$ROOT/publicar-github.sh" .
mkdir -p assets tests
cp -- "$ROOT"/assets/*.webp assets/
cp -- "$ROOT/tests/site.test.cjs" tests/

git config user.name "$OWNER"
git config user.email "$USER_ID+$OWNER@users.noreply.github.com"
git add -- index.html styles.css mobile.css script.js .nojekyll README.md publicar-github.sh assets tests
if ! git diff --cached --quiet; then
  git commit -m "Publica site Nobre e JJCar"
fi
# Sem force push: preserva o histórico remoto.
git push -u origin main
EXPECTED_COMMIT="$(git rev-parse HEAD)"
gh repo edit "$REPO" --default-branch main

if gh api "repos/$REPO/pages" >"$TEMP/pages.json" 2>"$TEMP/pages-error"; then
  gh api --method PUT "repos/$REPO/pages" \
    -f 'build_type=legacy' -f 'source[branch]=main' -f 'source[path]=/' >/dev/null
else
  if ! grep -q 'HTTP 404' "$TEMP/pages-error"; then
    cat "$TEMP/pages-error" >&2
    exit 1
  fi
  gh api --method POST "repos/$REPO/pages" \
    -f 'build_type=legacy' -f 'source[branch]=main' -f 'source[path]=/' >/dev/null
fi

SITE_URL="$(gh api "repos/$REPO/pages" --jq .html_url)"
gh repo edit "$REPO" --homepage "$SITE_URL"
printf '\nArquivos enviados. Aguardando o GitHub Pages...\n'

for ((attempt = 1; attempt <= 30; attempt++)); do
  if BUILD="$(gh api "repos/$REPO/pages/builds/latest" \
    --jq '[.status, .commit] | @tsv' 2>"$TEMP/build-error")"; then
    IFS=$'\t' read -r STATUS BUILD_COMMIT <<< "$BUILD"
  else
    if ! grep -q 'HTTP 404' "$TEMP/build-error"; then
      cat "$TEMP/build-error" >&2
      exit 1
    fi
    STATUS="queued"
    BUILD_COMMIT=""
  fi
  if [[ "$BUILD_COMMIT" != "$EXPECTED_COMMIT" ]]; then
    printf 'Aguardando o build da versão enviada...\n'
    sleep 10
    continue
  fi
  case "$STATUS" in
    built)
      printf '\nPUBLICADO: %s\nREPOSITÓRIO: https://github.com/%s\n' "$SITE_URL" "$REPO"
      exit 0
      ;;
    errored)
      printf '\nO build do Pages falhou. Consulte: https://github.com/%s/actions\n' "$REPO" >&2
      exit 1
      ;;
  esac
  printf 'Status: %s — aguardando...\n' "$STATUS"
  sleep 10
done

printf '\nArquivos enviados e Pages configurado; publicação ainda não confirmada.\n'
printf 'Endereço reservado: %s\nAcompanhe: https://github.com/%s/actions\n' "$SITE_URL" "$REPO"
