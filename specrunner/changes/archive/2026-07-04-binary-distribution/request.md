# 単一バイナリ配布を立てる（GitHub Releases + install.sh — ADR-0021 の実施）

## Meta

- **type**: new-feature
- **slug**: binary-distribution
- **base-branch**: main
- **adr**: false

<!-- adr 判断基準: 新しい port/adapter 追加、既存パターンと異なる設計選択、振る舞い/契約を変える修正、構造的リファクタリング → true。いずれにも該当しない → false -->
<!-- 配布戦略の決定は ADR-0021 に既存。本 request はその実施であり新たな構造判断を伴わないため false -->

## 背景

ADR-0021 は配布チャネルを「npm（JS エコシステム向け）+ GitHub Releases の単一バイナリ（言語非依存層向け）」の二正面と決定した。npm 側は稼働済み（`@color4pen/aozu`）だが、バイナリ側が未実装で、JS ツールチェーンを持たない開発者・CI に aozu が届かない。`bun build --compile` は bun ランタイムを同梱した単一実行ファイルをクロスコンパイルでき（Bun API のままコンパイル可能 — ADR-0021 決定 2）、これを release-please のリリースに自動添付する。

## 現状コードの前提

<!-- 書く直前に grep で再検証する。 -->

- .github/workflows/publish.yml — `v*` タグ push と workflow_dispatch（tag 入力）で起動し、`npm publish --provenance --access public` を実行する。リリース作成は release-please（.github/workflows/release-please.yml、タグ形式は `v*` — release-please-config.json の `include-component-in-tag: false`）
- src/cli/main.ts — CLI エントリ。`--version` / `-v` 実装済み（package.json の version を実行時読みで返す。**コンパイル済みバイナリでは package.json が同梱されない**ため、この読み方はバイナリで壊れる — 要件 4 参照）
- tests/packaging.test.ts — npm pack の tarball 検証と `--help` smoke の既存パターン
- `bun build --compile --target=<triple>` はクロスコンパイル対応（bun-darwin-arm64 / bun-darwin-x64 / bun-linux-x64 / bun-linux-arm64 / bun-windows-x64）
- GitHub Releases への添付は `gh release upload <tag> <files>`（publish workflow は `contents: read` 権限のため、添付には権限追加が要る）

## 要件

<!-- 実装の最重量部を名指しする。 -->

1. **コンパイル matrix（最重量部）**: publish workflow（または release トリガの別 workflow）に、5 ターゲット（darwin-arm64 / darwin-x64 / linux-x64 / linux-arm64 / windows-x64）の `bun build --compile` を追加する。成果物名は `aozu-<target>`（windows は `.exe`）
2. **release への自動添付**: コンパイル済みバイナリを該当バージョンの GitHub Release に `gh release upload` で添付する。workflow の permissions に `contents: write` を追加する（npm publish job とは job を分け、最小権限を保つ）
3. **install.sh**: リポジトリ直下（または `scripts/`）に、OS/arch を判定して最新 release から該当バイナリを取得し `~/.local/bin/aozu` に配置するインストーラを置く。`curl -fsSL <raw URL> | bash` で動くこと。取得後に `aozu --version` で導通確認を出力する
4. **バイナリでの `--version` 動作**: 現実装は package.json の実行時読みのため、`--compile` されたバイナリでは失敗する。ビルド時にバージョンを埋め込む（`--define` によるコンパイル時定数注入等）方式に改め、**npm 配布（ソース実行）とバイナリの両方で同じ値を返す**こと
5. **README の導入節にバイナリ導入を追記**: install.sh の一行と、npm / バイナリの使い分け（ADR-0021 の二正面）
6. **smoke**: CI 上で、当該 runner のネイティブターゲットのコンパイル済みバイナリに対し `--help` と `--version` が exit 0 で動くことを検証する step を含める

## スコープ外

- Homebrew tap・winget 等の追加チャネル（ADR-0021: 需要が観測されてから）
- Node API 面への移行（ADR-0021 で保留・トリガー明記済み）
- npm 配布側の変更（bin・files・publish 手順は現状維持）
- コード署名・notarization（macOS Gatekeeper 対応は初版では扱わず、必要になったら別 request）

## 受け入れ基準

<!-- 機械検証できる文にする。 -->

- [ ] workflow 定義に 5 ターゲットの `bun build --compile` と release 添付 step が存在することを grep テストで固定する
- [ ] ネイティブターゲットのバイナリをローカル/CI でコンパイルし、`--help` と `--version` が exit 0 になることをテストで固定する
- [ ] `--version` がソース実行とコンパイル済みバイナリで同一の値（package.json の version）を返すことをテストで固定する
- [ ] install.sh が shellcheck 相当の静的検証を通り、OS/arch 判定（darwin/linux × arm64/x64）の分岐を持つことをテストまたは grep で固定する
- [ ] npm publish の既存経路（tarball 内容・packaging smoke）が無変更で green
- [ ] 既存テスト無変更で green / `tsc --noEmit && bun test` green / dependencies 空

## architect 評価済みの設計判断

- **コンパイルは Bun API のまま行う**（ADR-0021 決定 2 の帰結）。`--compile` はランタイム同梱のため API 面の移行を要しない。却下した代替: Node API 移行と同時実施 — 独立した変更を束ねると本 request の検証面が不必要に広がる
- **バイナリ添付は npm publish と別 job にする**。npm 側は `contents: read` + `id-token: write`（provenance）、添付側は `contents: write` と、権限を job 単位で最小化する。却下した代替: 単一 job に権限を足す — provenance の署名文脈に不要な書き込み権限を同居させない
- **バージョンはビルド時埋め込みに統一**。却下した代替: バイナリに package.json を同梱 — `--compile` の単一ファイル性を壊す。実行時読みとビルド時定数のフォールバック二段構え（定数があれば優先）とし、ソース実行の挙動は変えない
- **インストーラは bun 本体と同型の curl | bash 方式**。却下した代替: 各パッケージマネージャ対応 — ADR-0021 が需要駆動と決定済み
