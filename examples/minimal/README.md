# examples/minimal — 最小の設計正本

aozu を 5 分で体験するための最小サンプル。小さなタスク管理ドメインを題材に、設計正本（design/）の形と、閉包検証・rules export の歯を実際に回す。

このサンプルは本リポジトリの CI で `check` exit 0 と rules 同期が強制されている。仕様が変わればこのサンプルが CI で割れるため、仕様に置き去りにされない。

## 前提

[bun](https://bun.sh) が必要（Node.js では動かない）。aozu 自体のインストールは不要で、`bunx` で実行できる。

## 中身

```
design/
  manifest.md            # 有効な型の宣言（static, domain のみの小さなプロファイル）
  rules.json             # export rules の出力（コミット済み成果物。--verify の比較対象）
  static/
    modules.md           # モジュール分割（mod-api / mod-domain）と実装パスの対応
    dependencies.md      # 許可依存の列挙。ここに無い依存はすべて禁止（fail-closed）
  domain/
    glossary.md          # 用語（term-backlog）
    model.md             # エンティティ（ent-task / ent-user）
    actors.md            # アクター（act-member）
    invariants.md        # 不変条件（inv-completion-by-assignee）
```

要素は「ID つき見出し + 自由な Markdown 本文」で、本文中の `[[id]]` が要素間の参照になる。機械検証されるのは骨格（ID・参照・リンク義務）だけで、本文は自由に書ける。全 7 要素。

## 1. 閉包検証を回す

```sh
cd examples/minimal
bunx @color4pen/aozu check --dir design
```

exit 0（診断なし）が合格。ID が一意で、すべての `[[参照]]` が実在要素に解決し、型の義務（mod の責務行・inv の粒度など）が満たされている状態 = 閉包。

## 2. 壊してみる

`design/domain/model.md` の `[[term-backlog]]` を `[[term-backlogs]]` に書き換えて再実行すると、参照切れが落ちる:

```
ERROR C3 term-backlogs unresolved reference "[[term-backlogs]]" (design/domain/model.md:4)
```

typo も未知の型 prefix も fail-closed で必ず違反になる（黙って通ることは無い）。戻せば exit 0 に戻る。

## 3. 構造の歯を見る

```sh
bunx @color4pen/aozu export rules --dir design
```

modules.md / dependencies.md から architecture test 用の ruleset JSON が出る。これをコード側の依存検査（dependency-cruiser / ArchUnit 等）に食わせると、宣言されていない依存を持つ実装が CI で落ちるようになる——設計文書が実装を拘束する側に回る（出口ゲート。[spec/integration.md](../../spec/integration.md) §3）。

コミット済みの rules.json と設計文書の同期は `--verify` が検査する（このサンプルでは CI が回している）:

```sh
bunx @color4pen/aozu export rules --dir design --verify
```

modules.md に `実装:` 行の無いモジュールを足すと export が exit 1 で落ちることも試せる（設計と実装の接地は省略できない）。

## 次に読むもの

- [docs/boundary.md](../../docs/boundary.md) — aozu が解く問題と解かない問題・既存ツールとの関係
- [docs/adoption.md](../../docs/adoption.md) — 既存プロジェクトへの導入手順（このサンプルの形に段階的に到達する経路）
- [spec/format.md](../../spec/format.md) — 形式仕様（ID 文法・型スキーマ・閉包規則 C1〜C12）
- [README のステータス](../../README.md#ステータス) — ここで使わなかった動詞（plan / derive / coverage / mark・ビュー型）の全体像
