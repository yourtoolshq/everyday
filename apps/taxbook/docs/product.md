# Tax Book

## Overview

Tax Book is a personal, Canada-focused household tax tracking app.

It exists to make tax season easier by keeping tax-relevant information organized throughout the year instead of reconstructing everything when it is time to file.

The app is designed around one household and one tax year at a time.

Its main job is to help answer questions such as:

- How much income has each household member earned so far?
- What is each person likely to earn by the end of the year?
- Which deductions, credits, benefits, expenses, and contributions may matter?
- Which supporting records do we need to keep ourselves?
- Which official tax documents are still expected?
- Are we likely to receive a refund or owe tax?
- Are we ready to file?
- After filing, can we confidently look back at the completed tax year?

## Problem

Personal tax information accumulates gradually throughout the year.

Some information comes from employment paycheques. Some comes from expenses and receipts that need to be retained. Some comes from official tax documents such as T4s and registered-plan slips. Other items require planning before the end of the year.

Without a dedicated system, this information can end up spread across:

- payslips
- receipts
- downloaded tax documents
- spreadsheets
- notes
- email
- memory

This makes tax preparation unnecessarily dependent on finding and reconstructing information later.

Tax Book should instead allow the household to maintain a current view of the tax year as it happens.

## Core Workflow

The intended lifecycle is:

```text
Track during the year
        ↓
Record tax-relevant items
        ↓
Keep supporting records where required
        ↓
Track expected official tax documents
        ↓
Estimate the tax result
        ↓
Prepare and file the return
        ↓
Record the CRA assessment and final result
        ↓
Preserve the completed tax year
```

## Primary Use Case

The initial use case is a Canadian household with two people.

The household may have:

- regular employment income
- variable employment income
- multiple paycheques throughout the year
- income tax, CPP, and EI deductions
- self-employment or freelance income
- RRSP and FHSA activity
- medical expenses
- professional expenses
- federal and provincial credits or benefits
- tax documents expected from employers and financial institutions

The app should support individual items belonging to either household member as well as items that apply to the household more broadly.

## Income Tracking

Employment income should be tracked from individual paycheques.

Each paycheque may include values such as:

- gross pay
- income tax withheld
- federal tax withheld
- Manitoba tax withheld
- CPP
- CPP2
- EI
- weekly indemnity (WI)
- long-term disability (LTD)
- other deductions
- net pay

Each Employment chooses which deduction fields appear during paycheque entry and
can reorder those fields to match the pay statement. When federal or Manitoba
tax is enabled, income tax withheld is calculated as their total.
Net pay is calculated from gross pay minus all recorded deductions so that it can
be compared with the amount on the pay statement.

This allows the app to calculate:

- actual year-to-date income
- actual tax withheld
- year-to-date CPP and EI
- average pay
- projected full-year income

This is particularly useful when income varies from one pay period to another.

## Tax Items

A Tax Item represents something that matters to the household's tax return.

Examples include:

- employment income
- RRSP deduction
- FHSA deduction
- medical expenses
- professional expenses
- tax credits
- benefits
- business income
- business expenses

Different Tax Items may eventually determine their filing value in different ways.

For example:

- some values may be entered manually
- some may be calculated from paycheques
- some may total multiple records
- some may come from official tax documents
- some may eventually require tax-specific calculations

The first versions of the app do not need to generalize all of these behaviours.

## Records

A Record is information the household is responsible for retaining to support a tax item.

For example, a medical-expense Tax Item may contain several Records, with each Record containing its related receipt or document.

Records are intended for situations where the household needs to preserve its own supporting evidence in case it is needed later.

Official tax documents such as a T4 are treated separately.

## Tax Documents

Tax Documents are official documents expected for tax filing.

Examples include:

- T4
- T5
- RRSP contribution receipt
- FHSA tax document
- other tax slips issued by employers, financial institutions, or government agencies

The app should track whether an expected Tax Document:

- is expected
- has been received
- is ready to file after review
- has been used for filing

This helps determine whether a tax year is ready to file.

## Tax Estimate

The app provides a 2026 Manitoba planning estimate for the household using the information currently available.

This may include:

- projected annual income
- expected deductions
- credits
- tax already withheld
- estimated tax payable
- estimated refund or amount owing

The estimate is intended for planning.

Each supported Tax Item has an explicit Tax treatment. The treatment tells the
estimate how to interpret the tracked amount; names and free-text tax-line
references never control calculations. The tracked amount remains the filing
input—for example, rent paid or eligible medical expenses—while the estimate
shows the resulting credit separately.

Recorded-to-date inputs are shown beside a best-known year-end projection. Tax
is calculated for each person separately and then summarized as one household
refund or amount owing. A temporary RRSP/FHSA sandbox can compare additional
contributions and deductions without changing tracked data.

Tax Book is not intended to replace tax filing software.

## Self-Employment

Each person may track multiple sole-proprietor business activities separately.
An activity records gross revenue and ordinary eligible expenses, grouped by
supported T2125 expense lines, and calculates a signed net business income or
loss. Revenue and expense Records may retain one supporting PDF or image.

The net result is exposed as a managed Tax Item and included in the 2026
planning estimate. A loss reduces other income, while positive aggregate net
self-employment income contributes to the income-tax and CPP estimate. Tax Book
does not decide whether income or an expense is eligible and does not prepare a
T2125.

## Filing and Assessment

After a tax return is filed, the app should preserve information about the filing itself.

This may include:

- filing date
- submitted T1 return
- expected refund or amount owing
- actual refund or payment
- refund or payment date
- Notice of Assessment
- CRA assessment result
- relevant notes

Once the filing and assessment are complete, the tax year should become a trustworthy historical snapshot.

The household should be able to open a previous year and understand what was filed, what documents supported it, and what the final result was.

## Goals

Tax Book should help the household:

- maintain an accurate picture of the current tax year
- track income throughout the year
- handle variable employment income
- identify and track tax-relevant items
- retain supporting records where necessary
- know which official tax documents are still missing
- estimate refund or amount owing
- understand whether the year is ready to file
- preserve completed tax years for future reference

## Non-Goals

Tax Book is not intended to become:

- a general budgeting app
- a banking transaction aggregator
- a replacement for YNAB or similar personal-finance software
- a full accounting or double-entry bookkeeping system
- payroll software
- a complete Canadian tax rules engine
- tax filing software
- a commercial tax product designed around hypothetical users

The project should prioritize solving the household's actual tax workflow before adding generalization, automation, or features intended for broader audiences.

Some exclusions are documented in more detail so future work does not reopen
settled scope decisions. See [Intentional Exclusions](./intentional-exclusions.md).

## Product Principle

The app should remain useful before it becomes sophisticated.

Each development phase should produce something that can be used for the current tax year.

When deciding between a broad generalized feature and a small workflow that solves an immediate tax problem, prefer the small usable workflow.
