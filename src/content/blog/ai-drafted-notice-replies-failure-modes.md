---
title: 'Five Failure Modes of AI-Drafted Income Tax Notice Replies'
description: 'The five recurring ways an AI-drafted Income Tax notice reply fails review — fabricated citations, hallucinated sections, stale circulars, generic facts.'
pubDate: '2026-04-27'
updatedDate: '2026-04-27'
pillar: 'Income Tax Notices'
author: 'DPS & Co.'
readTime: 9
tone: 'rose'
featured: false
---

An AI-drafted Income Tax notice reply fails on the review desk for one of five reasons: fabricated case citations, hallucinated section numbers, superseded CBDT circulars, generic factual reconciliations, and the boilerplate prose pattern that signals to a faceless AO that no one read the notice. Each failure is detectable in under a minute. None is intrinsic to AI; all five are products of the same gap — between a draft that *looks* drafted and a reply that has been *thought through*.

We've reviewed several hundred AI-drafted notice replies at DPS &amp; Co. over the past twelve months — partly our own, partly forwarded by colleagues who wanted a second pair of eyes before filing. The five failure modes recur with remarkable consistency. The fixes are mechanical. The cost of skipping the review is, sometimes, the assessment order itself.

## The five, in the order they appear in a typical draft

> 1. **Fabricated case citations** — a judgment with the right ring of authority that does not, in fact, exist.
> 2. **Hallucinated section numbers** — *"section 147A"* and other inventions of the IT Act.
> 3. **Stale CBDT circulars** — references to instructions that were withdrawn or superseded years ago.
> 4. **Generic factual reconciliations** — turnover and demand numbers reconciled with placeholder logic, not ledger evidence.
> 5. **The application-of-mind tell** — boilerplate prose any reviewing officer recognises in three lines.

The rest of this post takes them one at a time, with the fix for each.

## 1. Fabricated case citations

A fabricated citation is the failure mode that costs the most when missed. The pattern is consistent: the case name sounds plausible — often a real assessee surname combined with a real Department appellation — the citation format is correct (*"(2018) 405 ITR 156 (Del)"*), and the proposition the case is cited for is exactly the proposition the AI needed to support the argument. The combination of plausible name, correct format, and on-point proposition is the tell. Real practice rarely produces all three on demand.

Specific patterns we have seen recurring in s. 148 and s. 143(2) drafts:

- Citations to *"Delhi High Court"* or *"Bombay High Court"* benches that, on a one-line search of any reporter, do not exist.
- Citations to ITAT orders with dates of issue that fall on weekends or national holidays.
- Citations to Supreme Court judgments attributed to judges who were not on that bench in the cited year.
- Two real cases combined into a single fabricated citation — *Smt. X v. CIT* (real) merged with *(2019) 412 ITR 88 (SC)* (real reporter, different case) to produce a citation that looks correct but resolves to nothing.

The fix is structural, not editorial. Every case citation in a reply should pass through a verification step before the draft leaves the reviewer's desk — a 30-second cross-check on Indian Kanoon or the relevant court's reporter index. If the case does not return, or returns a judgment that says something different, the citation is fabricated. Replace it with a real case for the proposition, or remove the proposition.

This is also why Accountic ships citation verification as a first-class feature with a credit-refund commitment. The failure mode is too consequential to leave to memory. For the doctrinal anchor on why a wrongly-cited case does more damage than a missing case, see our note on [why ITO v. Lakhmani Mewal Das still decides your s. 148 reply](/blog/lakhmani-mewal-das-s148).

## 2. Hallucinated section numbers

The Income Tax Act, 1961 has nearly three hundred sections plus several schedules. A model trained on a wide corpus that includes academic articles, practitioner blogs, and old Bare Acts will, on occasion, return citations to sections that do not exist.

The most common we have seen:

- ***"Section 147A"*** — there is no s. 147A. The Finance Act 2021 introduced **section 148A**. The drafted argument usually still works if the citation is corrected; the fabricated section was conjured to bridge a procedural step the model didn't quite remember.
- **Repealed sections cited as live.** A draft will sometimes cite a section that was deleted by an earlier Finance Act. The proposition reads correctly because that section *did* once cover it; the citation is dead.
- **Sub-clause numbers misformatted as standalone sections.** *"Section 143(1A)"* is a sub-clause; *"section 143-1A"* or *"section 143A"* are not the same thing. AI drafts sometimes flatten the formatting and produce a non-existent section in the process.

The fix is mechanical: open a current Bare Act or the Income Tax Department's e-filing portal and verify each section number cited. A reply that opens with a wrong section number is a reply the AO will treat with reduced presumption of competence, regardless of how strong the substantive argument is.

## 3. Stale CBDT circulars

CBDT circulars and instructions are issued continuously. They are also withdrawn, superseded, and replaced continuously. An AI draft trained on a corpus that includes pre-2023 practitioner articles will, by default, cite circulars in the form they appeared in pre-2023 commentary — without flagging that the circular has since been replaced.

The most common stale-circular patterns:

- A reply to a section 148 notice citing a pre-2021 reassessment circular without acknowledging the post-Finance Act 2021 framework that materially changed the procedure.
- A section 245 reply citing a CBDT instruction on prior-intimation requirements that has since been superseded.
- A faceless-assessment reply citing the original 2019 NFAC scheme circular without acknowledging the changes through 2024.

The remedy is to maintain a current circular index. A practical heuristic: any circular older than three years cited in an AI draft should be checked against the CBDT repository before the reply is filed. Newer circulars are usually safe; older ones need to be re-verified each time. The audit log of citations checked — and which version of each circular was current at the date of the reply — is exactly the artefact peer reviewers will ask for under the [ICAI Code of Ethics, 1 April 2026](/blog/icai-code-of-ethics-april-2026).

## 4. Generic factual reconciliations

This failure mode is harder to spot because the draft *looks* specific — there are numbers in it, after all. But the numbers are reconciled with placeholder logic rather than ledger evidence:

> Turnover as per audited financial statements: ₹X
> Turnover as per GSTR-3B for the year: ₹Y
> Difference: ₹Z, attributable to inter-state stock transfers and credit notes.

If the draft can be regenerated for a different client by changing only the numbers and the assessee name, it is a generic reconciliation. A real reconciliation cites the specific ledger account, the specific entry date, and the specific document — and arrives at the difference number by addition, not by reverse-engineering.

The fix: every reconciliation paragraph should cite at least one document by file name, page number, and entry date. *"Annexure 3, page 4, ledger A/c 4400-101, entry dated 17 March 2024."* If an AI draft cannot produce that level of specificity, the draft is a starting point — not a reply.

This failure mode is most damaging in s. 143(2) scrutiny work, where reconciliation *is* the reply. For the drafting conventions that hold up at appellate level, see our note on [section 143(2) scrutiny drafting conventions](/blog/section-143-2-scrutiny-drafting).

## 5. The application-of-mind tell

The fifth failure mode is the most expensive in repeat-reputational terms. AI-drafted replies, even when their substantive arguments are sound, often share a prose register that any AO who reads more than 20 replies a week recognises:

- Long opening paragraphs that recite the notice in passive voice before saying anything specific.
- Topic sentences that begin with *"It is humbly submitted that…"* or *"Without prejudice to the foregoing…"* every paragraph.
- Closing paragraphs that *"respectfully pray"* without specifying what is being prayed for.
- A uniform sentence cadence — every sentence roughly the same length, with the same pattern of sub-clauses.

The result is a reply that reads drafted but does not read thought-through. The application-of-mind doctrine has been clear since the faceless regime began: the AO must apply mind to each reply specifically; a boilerplate reply makes a boilerplate order possible. The same standard, applied on the other side of the table, is what separates replies that survive appeal from replies that don't.

The remedy is editorial. Read the reply aloud once. If three consecutive sentences could appear, unchanged, in a reply for a different client and a different section, rewrite them. The full discipline is in our note on [application of mind in faceless assessment](/blog/faceless-assessment-application-of-mind).

## How a firm catches these — the review pass

At DPS &amp; Co., AI-drafted replies on routine and standard matters move through a fixed five-step review before they reach the partner desk:

1. **Citation pass.** Every case and circular cited is verified against an authoritative source.
2. **Section pass.** Every IT Act section reference is matched against a current Bare Act.
3. **Reconciliation pass.** Every reconciliation paragraph is matched to a specific ledger entry and source document.
4. **Voice pass.** The reply is read aloud; sentences that could be lifted to a different matter are rewritten.
5. **Prayer pass.** The closing prayer is matched to the relief being sought, ground by ground.

The five steps add roughly 20 minutes to a routine reply and 40 minutes to a scrutiny reply. They are also, mostly, the steps that could be embedded into the workflow itself — citation verification with an audit log is not a manual step in any sustainable practice; it is the floor.

For the broader operational frame — how this review fits a small firm running 40+ notices a month — see [how a small CA firm actually handles 40 notices a month](/blog/firm-notice-workflow). For the next layer of detail on the s. 148-specific review, see our spoke on [reviewing an AI-drafted section 148 reply](/blog/ai-drafted-section-148-reply-review).

## What this is not

This post is not an argument against AI-assisted notice drafting. The five failure modes above are real, but each has a structural fix. The alternative — drafting every reply by hand under deadline pressure — has its own well-documented failure modes: omitted citations, missed reconciliations, stale templates copied from a prior matter, partner-time spent on routine drafting that should have been spent on review.

The point is that an AI draft is a starting point. The CA's signature is the operational unit of trust in the assessment regime. The Code of Ethics' professional-judgment standard is the legal expression of that fact. AI is the leverage; the judgment is the work.

## FAQ

**Is an AI-drafted reply itself a violation of the ICAI Code?**
No. The ICAI Code does not prohibit AI-assisted drafting. It requires that the professional judgment applied to the final output be the CA's, demonstrable on the record. An AI-drafted reply that has been verified, edited, and signed by a CA is consistent with the Code; an unverified AI draft filed verbatim is not.

**How long does the five-step review take?**
At DPS &amp; Co., the review adds roughly 20 minutes to a routine notice reply and 40 minutes to a scrutiny reply. The citation pass is the longest; voice and prayer passes are the fastest.

**Which of the five failure modes is the most expensive when missed?**
Fabricated case citations. A fabricated citation that the AO catches is the closest thing in notice-reply work to a one-step path to an adverse inference, and the citation is in writing.

**Can the failure modes be detected automatically?**
Citation verification and section-number verification can and should be automated — they are mechanical, error-prone if done manually, and consequential when missed. Reconciliation specificity and prose-voice review require CA judgment and don't generalise to a deterministic check.

**Does this apply to GST notices as well?**
The patterns generalise — fabricated citations, stale circulars, generic facts, and boilerplate prose are not specific to Income Tax. The section-numbering and CBDT-circular failure modes are IT-Act-specific. We expect to publish a parallel note on GST as the V2 product expands.

---

**Further reading:** [Reviewing an AI-drafted section 148 reply — the five checks](/blog/ai-drafted-section-148-reply-review) · [Replying to a section 148 notice — the template that holds up](/blog/section-148-reply-template) · [Section 143(2) scrutiny: drafting conventions](/blog/section-143-2-scrutiny-drafting) · [Application of mind in faceless assessment](/blog/faceless-assessment-application-of-mind) · [The ICAI Code of Ethics, 1 April 2026](/blog/icai-code-of-ethics-april-2026)
