#!/bin/bash
# 暫定チェッカ: 本実装が立つまでのつなぎ。C1〜C5 と C11(domain) を行指向処理で検査する
set -u
DESIGN="$1"
fail=0

# 宣言 ID: 見出し {#id} + frontmatter id:
declared=$( { grep -rhoE '\{#[a-z0-9][a-z0-9-]*\}' "$DESIGN" | tr -d '{#}' ;
              grep -rh '^id: ' "$DESIGN" | sed 's/^id: *//' ; } | sort )

# 重複検出 (C2)
dups=$(echo "$declared" | uniq -d)
[ -n "$dups" ] && { echo "C2 違反: ID 重複:"; echo "$dups"; fail=1; }

# 参照 ID: コードフェンス内とインラインコードを除外して [[id]] を抽出 (C3)
refs=$(find "$DESIGN" -name '*.md' -print0 | xargs -0 awk '
  /^```/ { fence = !fence; next }
  fence { next }
  { line = $0; gsub(/`[^`]*`/, "", line);
    while (match(line, /\[\[[a-z0-9-]+\]\]/)) {
      print substr(line, RSTART+2, RLENGTH-4);
      line = substr(line, RSTART+RLENGTH) } }' | sort -u)

unresolved=$(comm -23 <(echo "$refs") <(echo "$declared" | uniq))
[ -n "$unresolved" ] && { echo "C3 違反: 未解決参照:"; echo "$unresolved"; fail=1; }

# 許可依存の構文と端点 (C4)
while IFS= read -r line; do
  case "$line" in
    "- [["*"]] -> [["*"]]")
      edge=$(echo "$line" | grep -oE '\[\[[a-z0-9-]+\]\]' | tr -d '[]')
      for e in $edge; do
        case "$e" in mod-*) ;; *) echo "C4 違反: mod 以外の端点: $e"; fail=1;; esac
      done ;;
    "# "*|"") ;;
    *) echo "C4 違反: 依存行の構文不正: $line"; fail=1 ;;
  esac
done < "$DESIGN/static/dependencies.md"

# seq の登場要素が非空で mod に解決される (C5)
for f in "$DESIGN"/dynamic/*.md; do
  parts=$(awk '/^## 登場要素/{on=1;next} /^## /{on=0} on && /^- \[\[/' "$f" | grep -oE '\[\[[a-z0-9-]+\]\]' | tr -d '[]')
  [ -z "$parts" ] && { echo "C5 違反: 登場要素が空: $f"; fail=1; }
  for p in $parts; do
    case "$p" in mod-*) ;; *) echo "C5 違反: mod 以外の登場要素: $p ($f)"; fail=1;; esac
  done
done

# 層間参照方向 (C11): domain は domain のみ参照可
viol=$(find "$DESIGN/domain" -name '*.md' -print0 | xargs -0 awk '
  /^```/ { fence = !fence; next }
  fence { next }
  { line = $0; gsub(/`[^`]*`/, "", line);
    while (match(line, /\[\[[a-z0-9-]+\]\]/)) {
      id = substr(line, RSTART+2, RLENGTH-4);
      if (id !~ /^(term|ent|inv)-/) print FILENAME ": " id;
      line = substr(line, RSTART+RLENGTH) } }')
[ -n "$viol" ] && { echo "C11 違反: domain から下層への参照:"; echo "$viol"; fail=1; }

[ $fail -eq 0 ] && echo "OK: 宣言 $(echo "$declared" | uniq | wc -l | tr -d ' ') 要素 / 参照 $(echo "$refs" | wc -l | tr -d ' ') 種すべて解決"
exit $fail
