# Spec Review Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- The verdict line MUST appear before the Findings table.
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
  - approved:    specification is complete, consistent, and ready for implementation
  - needs-fix:   specification has issues that must be resolved before implementation
  - escalation:  unresolvable conflicts, missing context, or requires human judgment
- Findings table MUST have exactly 6 columns in this order:
  # | Severity | Category | File | Description | How to Fix
- Valid Severity values (uppercase): CRITICAL | HIGH | MEDIUM | LOW
  - CRITICAL: production outage, data loss, security breach
  - HIGH:     functional failure, clear bug, no workaround — blocks approval
  - MEDIUM:   quality degradation, maintainability issue, future risk
  - LOW:      informational, style, minor improvement
- If no findings, write a table row with "None" or omit the table body.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approved

## Findings

| # | Severity | Category | File | Description | How to Fix |
|---|----------|----------|------|-------------|------------|
| 1 | MEDIUM | Consistency | design.md D3 | **チェックサム検証ステップが D3 の手順リストに欠落**: spec.md は「SHA256SUMS をダウンロードし、ダウンロードしたバイナリのチェックサムを検証する」ことを SHALL で要求し、tasks.md T-05 も詳細な手順として明記している。しかし design.md D3 の numbered step list（1〜6）には SHA256SUMS のダウンロードとチェックサム検証のステップが存在しない（ステップ 3「Downloads the matching binary」→ ステップ 4「Places it in ~/.local/bin/aozu」と直接続く）。design.md だけを参照した実装者がチェックサム検証を省略するリスクがある。 | design.md D3 の手順リストに「3b. Downloads `SHA256SUMS` from the same release and verifies the binary checksum (`sha256sum -c` on Linux / `shasum -a 256 -c` on macOS); aborts on mismatch」をステップ 3 と 4 の間に挿入する。実装優先度は低い（spec.md と tasks.md で仕様は完備しているため実装は正しく行われる）が、設計文書の正確性として対応推奨。 |
| 2 | LOW | Clarity | design.md D2 | **"Produces binaries named `aozu-<target>`" の `<target>` プレースホルダが誤読を誘発する可能性**: D2 本文は matrix target（`bun-darwin-arm64` 等）の `bun-` 接頭辞を除去した名前を生成すると説明していないため、`aozu-bun-darwin-arm64` と誤読する余地が残る。D5 の具体例（`aozu-darwin-arm64` 等）と T-03 step 5 の明示的な変換ロジックによって実装者は正しい名前を把握できるが、D2 の記述が依然として不正確。 | D2 の「Produces binaries named `aozu-<target>`」を「Produces binaries named `aozu-<os>-<arch>` (stripping the `bun-` prefix from the target triple)」に修正し、D5 の表記と統一する。 |

## Review Notes

### 前回 escalation からの解消状況

前回（spec-review-result-001.md / events.jsonl spec-review attempt 1）で escalation となった理由は、finding #2（チェックサム検証）の `resolution: "decision-needed"` が escalation ルールを発火させたことによる。今回の spec ファイル群でこの decision が解決済みであることを確認した。

| 前回 Finding | 前回 Severity/Resolution | 今回の状況 |
|---|---|---|
| バイナリ命名不一致（T-03 ↔ D5） | HIGH / fixable | **解消**: T-03 step 5 が `ASSET="aozu-${TARGET#bun-}"` と明示し、MUST NOT 制約を追記 |
| チェックサム検証なし | MEDIUM / decision-needed | **解消**: spec.md が SHALL で要求、T-03 upload-binaries job が `sha256sum aozu-* > SHA256SUMS` を生成・アップロード、T-05 が install.sh でのダウンロードと検証（linux/darwin 両対応）を明記 |
| T-07「job または steps」の揺れ | LOW / fixable | **解消**: T-07 が「add a `binary-smoke` job」と断言、or 選択肢を削除 |
| curl \| bash リスク未明示 | LOW / fixable | **解消**: spec.md 要件文に「The `curl \| bash` execution model is an accepted risk per the distribution ADR (HTTPS delivery from this repository); binary integrity is protected by the checksum verification.」を追記 |

### 仕様整合性の確認

- **バイナリ命名**: T-03 step 5 → D5 → T-05（`aozu-${os}-${arch}`）が完全一致 ✅
- **チェックサム生成**: T-03 upload-binaries job が `sha256sum aozu-* > SHA256SUMS` を生成し、`gh release upload ... SHA256SUMS --clobber` でリリースに添付 ✅
- **チェックサム検証**: T-05 install.sh が SHA256SUMS をダウンロードし、linux では `sha256sum -c`、darwin では `shasum -a 256 -c` で検証（バイナリのリネーム前に検証する順序が手順に従い正しい）✅
- **spec.md シナリオ**: チェックサム検証シナリオ（「install.sh verifies binary checksum」）が追加され、機械検証可能な形式で固定されている ✅
- **job 権限分離**: npm publish job（`contents: read` + `id-token: write`）と upload-binaries job（`contents: write`）が分離 ✅
- **バージョン埋め込み**: T-01（version.ts モジュール）→ T-02（binary.test.ts）→ T-03（`--define` 注入）→ spec.md シナリオが一貫 ✅

### セキュリティ評価（OWASP Top 10 観点）

- **A08 Software and Data Integrity Failures**: チェックサム検証が spec.md・tasks.md の両方で必須要件として規定された。SHA256SUMS の生成（upload-binaries job）と検証（install.sh）が整合しており、MITM・改ざんリリースアセットへの経路がバイナリレベルで遮断される ✅
- **A05 Security Misconfiguration**: `contents: write` を npm publish job から分離する設計は維持されており、provenance 署名文脈への不要な書き込み権限混入を防いでいる ✅
- **curl | bash のリスク受容**: HTTPS + GitHub Releases のホスト信頼 + SHA256SUMS チェックサム検証の三重構造で ADR-0021 の決定と整合したリスク管理が実現されている ✅

### 承認の根拠

前回 escalation の原因（decision-needed ≥ 1）が全て解消し、現 spec ファイル群に critical / high / decision-needed の findings がない。残余 findings（MEDIUM 1 件、LOW 1 件）は design.md の文書精度に関するものであり、spec.md と tasks.md が正確かつ整合的であるため実装への影響はない。仕様全体として実装の入力として十分な品質に達している。
