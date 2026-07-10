# Spec: dependency-citation

## Requirements

### Requirement: 依存行は `依存: [[id]](, [[id]])*` の文法で認識される

extractRequestCitations SHALL 行頭 `依存: [[id]](, [[id]])*` の行を依存宣言として認識する。`[[id]]` の id は `[a-z0-9-]+` に一致する。依存行は 1 文書に複数書いてよく、位置を問わない。依存行上の `[[id]]` は依存引用として分類される。

#### Scenario: 単一の依存行

**Given** content に `依存: [[ent-a]], [[ent-b]]` の行がある
**When** extractRequestCitations を呼ぶ
**Then** dependencyIds が `{"ent-a", "ent-b"}` を含み、coverageRefs にはこれらが含まれない

#### Scenario: 複数の依存行

**Given** content に `依存: [[ent-a]]` と `依存: [[ent-b]], [[ent-c]]` の 2 行がある
**When** extractRequestCitations を呼ぶ
**Then** dependencyIds が `{"ent-a", "ent-b", "ent-c"}` を含む

#### Scenario: 依存行上の単一 ID

**Given** content に `依存: [[ent-a]]` の行がある
**When** extractRequestCitations を呼ぶ
**Then** dependencyIds が `{"ent-a"}` を含む

### Requirement: 不正な依存行は malformedLines として報告される

extractRequestCitations SHALL 行頭が `依存:` で始まるが完全な文法 `依存: [[id]](, [[id]])*` に一致しない行を malformedLines に追加する。当該行の引用は被覆引用にも依存引用にも分類しない。

#### Scenario: カンマ区切りでない依存行

**Given** content に `依存: [[ent-a]] と [[ent-b]]` の行がある
**When** extractRequestCitations を呼ぶ
**Then** malformedLines にその行が含まれ、coverageRefs にも dependencyIds にも ent-a, ent-b は含まれない

#### Scenario: ID の無い依存行

**Given** content に `依存:` の行がある（ID なし）
**When** extractRequestCitations を呼ぶ
**Then** malformedLines にその行が含まれる

#### Scenario: 空白のみの依存行

**Given** content に `依存:   ` の行がある
**When** extractRequestCitations を呼ぶ
**Then** malformedLines にその行が含まれる

### Requirement: コードフェンス内の依存行は無視される

extractRequestCitations SHALL コードフェンス（``` で囲まれた範囲）内の `依存:` 行を無視する。コードフェンス内の `[[id]]` も被覆引用として抽出しない（§6 除外規則）。

#### Scenario: コードフェンス内の依存行

**Given** content の ``` フェンス内に `依存: [[ent-a]]` がある
**When** extractRequestCitations を呼ぶ
**Then** dependencyIds は空であり、malformedLines も空である

### Requirement: インラインコード内の参照は除外される

extractRequestCitations SHALL インラインコード（バッククォート内）の `[[id]]` を被覆引用として抽出しない（§6 除外規則、extractReferences と同一挙動）。

#### Scenario: インラインコード内の参照

**Given** content の通常行に `` `[[ent-a]]` `` がある
**When** extractRequestCitations を呼ぶ
**Then** coverageRefs に ent-a は含まれない

### Requirement: 同一 ID が依存行と本文の両方に現れた場合、出現箇所ごとに分類される

extractRequestCitations SHALL 同一 ID が依存行と本文の両方に現れた場合、依存行上の出現を依存引用、本文上の出現を被覆引用として分類する。依存宣言は被覆引用を免除しない。

#### Scenario: 同一 ID の両出現

**Given** content に `依存: [[ent-a]]` の行と、本文に `[[ent-a]]` の引用がある
**When** extractRequestCitations を呼ぶ
**Then** dependencyIds が `{"ent-a"}` を含み、coverageRefs にも ent-a の Reference が含まれる

### Requirement: check --request は依存引用の状態を問わない

handleCheckRequest SHALL 依存引用に対して実在解決のみを検証する。implemented 要素の依存引用は合格とする。

#### Scenario: implemented 要素の依存引用は合格

**Given** ent-a が implemented 状態であり、request 文書に `依存: [[ent-a]]` がある
**When** check --request を実行する
**Then** exit 0

### Requirement: check --request は被覆引用の implemented を R2 で拒否する

handleCheckRequest SHALL 被覆引用（依存行の外の引用）に対して従来どおり R2（implemented 拒否）を適用する。

#### Scenario: implemented 要素の被覆引用は不合格

**Given** ent-a が implemented 状態であり、request 文書の本文に `[[ent-a]]` がある（依存行ではない）
**When** check --request を実行する
**Then** R2 error で exit 1

#### Scenario: 同一 ID が依存行にも本文にもある場合

**Given** ent-a が implemented 状態であり、request 文書に `依存: [[ent-a]]` と本文の `[[ent-a]]` がある
**When** check --request を実行する
**Then** 本文側の被覆引用が R2 error で exit 1

### Requirement: 未解決の依存引用は R1 で拒否される

handleCheckRequest SHALL 依存引用であっても graph に存在しない ID は R1 error とする。

#### Scenario: 未解決の依存引用

**Given** graph に ent-unknown が存在せず、request 文書に `依存: [[ent-unknown]]` がある
**When** check --request を実行する
**Then** R1 error で exit 1

### Requirement: --require-citation は被覆引用のみを数える

`--require-citation` SHALL 被覆引用が 0 件の場合に R0 error を出す。依存引用のみの文書は R0 不合格とする。

#### Scenario: 依存引用のみの文書

**Given** request 文書に `依存: [[ent-a]]` のみがあり、本文の被覆引用がない
**When** check --request --require-citation を実行する
**Then** R0 error で exit 1

### Requirement: 不正な依存行は R3 error で exit 1 になる

handleCheckRequest SHALL malformedLines が 1 件でもあれば R3 error 診断を出して exit 1 とする。

#### Scenario: 不正な依存行

**Given** request 文書に `依存: [[ent-a]] と [[ent-b]]` がある
**When** check --request を実行する
**Then** R3 error で exit 1

### Requirement: coverage は依存引用を被覆集合から除外する

handleCoverage SHALL 草稿の引用抽出に extractRequestCitations を使い、依存引用を draftRefs に含めない。依存行にしか現れない要素は NOT_COVERED になる。

#### Scenario: 依存行のみの要素は NOT_COVERED

**Given** plan グループに ent-a が含まれ、草稿に `依存: [[ent-a]]` のみがある（本文には ent-a の被覆引用がない）
**When** coverage を実行する
**Then** ent-a は NOT_COVERED で exit 1

### Requirement: coverage の草稿に不正な依存行があれば exit 1

handleCoverage SHALL 草稿に malformed 依存行があれば error 診断を出力して exit 1 とする。

#### Scenario: 草稿の不正な依存行

**Given** 草稿に `依存: [[ent-a]] と [[ent-b]]` がある
**When** coverage を実行する
**Then** error 診断が出力され exit 1

### Requirement: 依存行の無い文書は既存挙動と完全一致する

依存行を含まない request 文書に対する check --request および coverage の診断・exit code は現行と完全一致しなければならない（MUST）。extractRequestCitations の返り値は coverageRefs に全引用、dependencyIds は空集合、malformedLines は空配列となる。

#### Scenario: 依存行の無い request 文書

**Given** request 文書に `[[ent-a]]` の被覆引用のみがあり、依存行がない
**When** check --request を実行する
**Then** 既存の extractReferences と同一の結果になる

### Requirement: verifyCoverage のシグネチャは不変である

実装は verifyCoverage の関数シグネチャ（引数の型と返り値の型）を変更してはならない（MUST NOT）。依存行の分類は呼び出し側（handleCoverage）の責務であり、verifyCoverage は従来どおり Set<string> の draftRefs を受け取る。

#### Scenario: verifyCoverage の型互換

**Given** verifyCoverage の現行シグネチャ
**When** 実装完了後
**Then** verifyCoverage の引数型と返り値型が変更されていない
