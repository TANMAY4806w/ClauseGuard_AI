---
name: legal_clause_auditor
description: Rule patterns, risk categorization heuristics, and counter-negotiation templates for auditing legal clauses in commercial contracts.
---

# Legal Clause Auditor Skill

## 1. High-Risk Legal Patterns to Audit
1. **Auto-Renewal Notice Trap:**
   - *Pattern:* Advance cancellation notice $\ge 60$ days prior to renewal anniversary.
   - *Risk:* CRITICAL / HIGH.
   - *Counter-term suggestion:* Shorten notice period to 30 days and allow termination for convenience with prorated refund.
2. **Uncapped & Asymmetric Indemnification:**
   - *Pattern:* Customer indemnifies vendor for all third-party claims with no reciprocal indemnity or financial cap.
   - *Risk:* CRITICAL.
   - *Counter-term suggestion:* Mutual indemnification capped at total fees paid in preceding 12 months.
3. **Unilateral Price / SLA Modification:**
   - *Pattern:* Vendor reserves right to alter fees, payment terms, or features upon website posting without mutual signed amendment.
   - *Risk:* HIGH.
   - *Counter-term suggestion:* Any material terms change requires 30 days prior written notice and provides the right to terminate without penalty.
4. **Remote Jurisdiction Selection:**
   - *Pattern:* Dispute resolution exclusively situated in an offshore or remote counterparty state/country.
   - *Risk:* MEDIUM.
   - *Counter-term suggestion:* Change venue to mutual neutral location or customer principal place of business.
5. **Perpetual IP Assignment of Background IP:**
   - *Pattern:* Broad IP assignment including pre-existing tools, libraries, or generic methodology.
   - *Risk:* HIGH.
   - *Counter-term suggestion:* Retain ownership of Background IP; assign only specific custom deliverables upon full payment.
