# Design: permission-view

## Context

ADR-0023 が permission ビューの仕様を確定し、spec/format.md は §3（前提表: permission -> domain）・§8（perm スキーマ）・§10（C6 二相化・C11 views 方向）・§11（permissions export JSON）に反映済み。spec/integration.md §7 に export permissions の CLI 契約も定義済み。仕様は確定しているが、src/ の実装が未追従である。

現状コードの状態:

- **C6**: `checkC6` は enabled 中のビュー型名をすべて error にする一相構造（src/check/rules/c06-view-links.ts）。サポート/未サポートの区別が無い
- **型表**: src/check/manifest.ts に集約。`LAYER_PREREQUISITES` の permission は `["static"]`（仕様は `["domain"]` に確定）。`VIEW_ENABLED_NAME_TO_PREFIX` / `VIEW_TYPE_NAMES` / `LAYER_MAP` は perm を含む。`getEnabledPrefixes` はビュー型 prefix を返さない（コメント「View type prefixes are NOT included」）
- **C11**: `LAYER_ALLOWED_TARGET_PREFIXES` に views 層は未収載。コメント「Unlisted layers (loop, adr, views) have no restriction」でビュー要素からの参照は無制限。逆にコア 3 層の許可集合に perm prefix は無いため、コア -> views の参照は既に C11 違反になる
- **構造行**: src/parse/structured-lines.ts は 責務:/実装:/依存辺/登場要素/elements: の 5 種を認識。操作行・対象: 行は未実装
- **export**: src/cli/commands/export.ts は rules サブコマンドのみ。permissions サブコマンドは未実装
- **Graph**: graph.actorIds は seq の登場要素専用。perm の操作行データを運ぶフィールドは未存在
- **ParseResult / Graph 型**: perm 固有のデータ構造は未定義

## Goals / Non-Goals

**Goals**:

- C6 を二相化: サポート済みビュー型（permission）はスキーマのリンク義務を検証、未サポート型は従来どおり error
- LAYER_PREREQUISITES の permission を `["domain"]` に修正（仕様確定に合致）
- 操作行・対象: 行のパースを structured-lines.ts に追加
- C6 の perm 検証: 操作行の非空義務・operation 一意・参照 prefix が act であること
- C11 に views 層の参照方向制限を追加
- export permissions サブコマンドを実装
- getEnabledPrefixes をサポート済みビュー型の prefix を返すように拡張
- 縮退の一貫性を維持（permission 未 enabled 時の perm 宣言は従来挙動と一致）
- aozu 自身の design/ の check 結果が不変

**Non-Goals**:

- permission 以外のビュー型のサポート（screen / api / ext 等は C6 error のまま）
- scaffold の perm 対応
- prompt 注入規則の変更
- state.json / loop 機構の変更
- clearflow 側の書き起こし・突合テスト結線
- README のステータス更新

## Decisions

### D1: サポート型集合を manifest.ts の型表群と同居させる

`SUPPORTED_VIEW_TYPES: Set<string>` を src/check/manifest.ts に追加する。初期値は `new Set(["permission"])`。C6 はこの集合で分岐する。

**Rationale**: 型の知識は manifest.ts に集約されている現行構造（LAYER_MAP / VIEW_ENABLED_NAME_TO_PREFIX / VIEW_TYPE_NAMES）に従う。C6 内のローカル定数にすると、型の知識が 2 箇所に分散する。

**Alternatives**: C6 内のローカル定数 -- 型表の集約場所と分散する。却下。

### D2: getEnabledPrefixes をサポート済みビュー型に対応させる

`getEnabledPrefixes` を拡張し、manifest.enabled にサポート済みビュー型名が含まれる場合、対応する prefix を enabledPrefixes に含める。これにより C3 の縮退（既知だが無効な型は評価しない）が perm に正しく適用される。

**Rationale**: perm 要素が enabled なら、perm prefix は C3 / C11 の評価対象に含まれる必要がある。現状の getEnabledPrefixes はビュー型を全て除外するため、perm 参照が C3 の評価対象にならない。サポート済みビュー型のみを追加することで、未サポート型は従来の縮退を維持する。

**Alternatives**: perm prefix を常に enabledPrefixes に含める -- 未サポート型との一貫性が崩れる。却下。

### D3: 操作行パースを structured-lines.ts に追加する

操作行 `- <operation>: [[act-id]](, [[act-id]])*` と対象: 行 `対象: [[<id>]]` の認識を structured-lines.ts に追加する。パース結果は ParseResult / Graph に新フィールドとして運ぶ。

**Rationale**: 構造行の認識は一箇所に集約する現行設計（依存辺・登場要素・責務: と同族）に従う。perm 専用パーサを新設すると、パーサが分散し保守コストが上がる。

**Alternatives**: perm 専用パーサの新設 -- 構造行の集約原則に反する。却下。

### D4: C6 の perm 検証は適格性のみ、解決は C3 に委ねる

C5 と同じ分担に従う: prefix の適格性（操作行の参照が act prefix か）は C6 が検証し、参照の解決（act 要素が実在するか）は C3 の一般規則に委ねる。C6 で独自に解決を再検証しない。

**Rationale**: C5 が同じ分担（適格性は C5・解決は C3）を既に採用している。act は permission の前提 domain に属するため、permission enabled なら domain も enabled であり、act は C3 の評価対象に含まれる。二重診断のリスクは無い。

**Alternatives**: C6 で適格性と解決をまとめて検証 -- C5 との一貫性が崩れ、将来のビュー型で同じ判断を繰り返す。却下。

### D5: perm パースデータの型設計

ParseResult と Graph に以下のフィールドを追加する:

- `permOperations`: `{ elementFile: string; elementLine: number; operation: string; actorIds: string[]; file: string; line: number }[]` -- 操作行のパース結果。elementFile / elementLine は帰属先 perm 要素の特定に使う（C5 の actorIds が file で seq に帰属するのと同じパターン）
- `permTargets`: `{ targetId: string; file: string; line: number }[]` -- 対象: 行のパース結果

C6 は graph.permOperations を perm 要素の file で突合して検証する。graph.permTargets は export permissions で使用する。

**Rationale**: actorIds（seq の登場要素）と同じデータ運搬パターンに従う。file-based attribution で perm 要素に帰属させる（perm は見出し要素であり 1 ファイルに複数置ける）ため、elementFile ではなく file で帰属を取る。ただし perm は 1 ファイルに複数置けるため、owning element の特定には findOwningElement と同じ行ベース帰属を使う。

### D6: C11 の views 層参照方向

LAYER_ALLOWED_TARGET_PREFIXES に views エントリを追加する。許可 prefix はビュー型全 prefix + static / domain / dynamic の全 prefix（下位層 + 自層）。loop と adr は引き続き無制限。

**Rationale**: spec §10 C11 の確定仕様「views は views・static・domain・dynamic を参照できる」に従う。コア層の許可集合にビュー prefix を含めないことで、コア -> views の参照禁止は既存実装で達成済み。

### D7: export permissions の構造

export.ts に permissions サブコマンドのハンドリングを追加する。permissions 固有のロジック（JSON 生成）は src/export/ に新ファイル（permissions.ts）として分離する。generator.ts（rules 用）と対称の構造。

**Rationale**: export 内のサブコマンド分岐は export.ts が担い、生成ロジックは export/ モジュール内で型ごとに分離する。generator.ts が rules の生成を担っているのと同じ構造。

## Risks / Trade-offs

- [Risk] perm 要素は見出し要素で 1 ファイルに複数置けるため、操作行・対象: 行の帰属判定に行ベース帰属（findOwningElement と同等）が必要
  -> Mitigation: C5 の actorIds が file ベースで seq に帰属する既存パターンに加え、findOwningElement の行ベース帰属を C6 の perm 検証で使用する。perm は 1 ファイルに複数置ける（seq は 1 ファイル 1 要素）ため、file 単位ではなく行ベースで帰属を取る
- [Risk] getEnabledPrefixes の拡張が、C3 の縮退挙動に影響する可能性
  -> Mitigation: サポート済みビュー型のみを追加対象にする。未サポート型は従来どおり enabledPrefixes に含まれず、C3 の縮退を維持する
- [Risk] aozu 自身の design/（enabled: static, domain, dynamic）の check 結果が変わる可能性
  -> Mitigation: aozu の design/ は permission を enabled にしていない。perm prefix の要素は存在せず、getEnabledPrefixes に perm は含まれない。C6 / C11 / C3 のいずれも aozu の design/ には影響しない。integration.test.ts で回帰確認する

## Open Questions

（なし。設計判断は ADR-0023 で確定済み。実装で仕様と矛盾が出たら halt して設計に返す）
