# Planning docs

Product scope, feature roadmap, and engineering checklist for Trades Planner.

| Doc | Description |
|-----|-------------|
| [v2-design.md](./v2-design.md) | v2 contract: product, data model, rules, milestones. Owner decisions from 2026-10-15 are in section 11. |
| [agent-tasks.md](./agent-tasks.md) | Work queue for that contract (T01–T65). Where the two files disagree, this one wins. |
| [trades-planner-scope.md](./trades-planner-scope.md) | Earlier scoping plan. Kept for reference. |
| [plan-stated-price.md](./plan-stated-price.md) | A price named in the message is not replaced by the labour rate. |
| [plan-one-quote.md](./plan-one-quote.md) | A quote or invoice in one message confirms as one draft. |
| [plan-home-lists.md](./plan-home-lists.md) | Quotes waiting, open jobs, and unpaid invoices on Home. |
| [plan-receipt-split.md](./plan-receipt-split.md) | One receipt across jobs. Already shipped. |
| [plan-ops.md](./plan-ops.md) | Capture off switch, plan-thread failure, approve-link limit. |
| [plan-email-document.md](./plan-email-document.md) | Email the client the document link and total. |
| [plan-phone.md](./plan-phone.md) | Phone sign-in and one text plan through confirm. |

Cursor may also keep a copy under `.cursor/plans/` for in-IDE task tracking. **This folder is the source of truth in git.**
