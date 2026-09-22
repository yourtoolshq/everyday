# Phase 1 — Git Subtree Imports

Applications were imported with unsquashed `git subtree add` to preserve full history.

| Application | Prefix | Source SHA | Import commit |
|---|---|---|---|
| Taxbook | `apps/taxbook` | `a22a2d35342f77b7f09deecb65a4a65755ce332a` | `0570270` |
| Passbook | `apps/passbook` | `c624c2904f9f9e9a7927c5bc44bf0d7c7325b827` | `cdda17f` |
| Tenure | `apps/tenure` | `1be3cbddfcb6bc4119cd8bd89ebc9ba19ad4f92c` | `fba8d1b` |
| First Aid | `apps/firstaid` | `b41a8c85a8f58b06691cea4d48fc317832ed7df9` | `04166e9` |

Verify history remains reachable:

```bash
git log --oneline apps/taxbook | head
git log --follow apps/taxbook/README.md
```
