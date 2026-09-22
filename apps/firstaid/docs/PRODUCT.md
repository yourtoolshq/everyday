# First Aid — Product Overview

First Aid is a personal tool for planning and managing our healthcare year.

The problem is not that medical information is impossible to store. The problem is that healthcare is easy to handle reactively.

A doctor recommends bloodwork in a few months and it gets forgotten. An eye exam is overdue. Flu season arrives without us thinking about vaccination. Insurance includes massage or physiotherapy coverage, but part of the year passes before we notice that we have barely used it. Receipts, claim records, intake forms, prescriptions, and notes end up scattered across email, insurance portals, paper, and folders.

First Aid exists to make that easier to manage.

It is being built first for our own household and our own workflow. The goal is not to create a general-purpose electronic medical record, insurance platform, or healthcare product.

## What I want it to help me do

At any point in the year, I should be able to answer:

- What healthcare should we be thinking about this year?
- What routine or preventive care is due?
- What did a provider recommend that we do later?
- What have we planned but not scheduled yet?
- What appointments are coming up?
- What insurance benefits are available and how much remains?
- What happened during a previous visit?
- Where are the related receipts, claim records, forms, and other documents?

The most important workflow is the healthcare year itself.

I may plan the year in January, but I should also be able to review it again at any time and adjust it based on what has happened.

## Examples

First Aid should eventually make workflows like these easy.

### Preventive care

I want to remember things such as:

- routine family-doctor reviews
- dental exams and cleanings
- eye exams
- vaccinations such as the seasonal flu vaccine
- screening that is due for a household member
- other recurring or preventive care we decide belongs in our plan

Not everything is annual. Some care may be seasonal, every few years, provider-recommended, or only needed once.

### Provider follow-up

A family doctor may tell me to repeat bloodwork after a certain date.

That should not remain buried in notes from the appointment.

The visit should be able to create something that appears in the future healthcare plan until it is handled.

### Insurance benefits

If our insurance includes massage therapy coverage, I want to see:

- annual or benefit-period limit
- how much has been used
- how much remains
- how much time remains in the benefit period

If it is early in the year, I may decide to spread useful sessions throughout the year. If I review the plan much later, I may make a different decision.

First Aid should provide the information needed to make that decision. It should not encourage unnecessary healthcare simply to consume insurance benefits.

### Visit history

A completed visit may have:

- provider
- scheduled/completed date
- my own notes
- intake forms
- receipt
- insurance claim information
- insurance reimbursement
- out-of-pocket cost
- prescription or requisition
- other documents
- a future recommendation or follow-up

The record should remain lightweight. Most visits should not require filling out a large medical form.

## Product principles

### Solve our problem first

First Aid is not being designed around everything a healthcare application could support.

Features should come from problems encountered while actually using the tool.

### Planning is as important as history

This should not become a document archive with appointments attached.

Its main value is helping us run the healthcare year intentionally.

### Benefits are one input, not the goal

Insurance coverage matters, but an ideal healthcare year is not defined by maximizing insurance spending.

Care can belong in the plan even when insurance does not cover it.

### Do not become an EMR

First Aid does not need to model the healthcare industry.

For the first version, concepts such as diagnoses, medications, lab tests, referrals, vaccinations, and prescriptions do not automatically need dedicated data models.

They can remain care items, visit notes, follow-ups, or documents until actual usage proves that a richer model is needed.

### Keep source and reasoning visible

A care item may exist because:

- a provider recommended it
- it is part of our chosen preventive-care routine
- public-health guidance made us consider it
- it is a follow-up from a previous visit
- an insurance benefit makes it practical
- we personally decided to include it

First Aid should preserve that context rather than presenting every item as universal medical advice.

### Self-hosted and private by default

Healthcare information is personal.

The application should be suitable for self-hosting and should avoid unnecessary external dependencies or sharing of medical information.

## V1 focus

V1 should make it possible to:

1. Manage household members.
2. Build and review a healthcare plan for a year.
3. Add care items for preventive care, recurring care, seasonal care, and provider follow-ups.
4. Turn planned care into scheduled/completed visits.
5. Keep reusable provider information.
6. Track basic insurance benefits and remaining usage.
7. Record claims and out-of-pocket cost.
8. Attach documents to visits and claims.
9. Carry future recommendations back into the care plan.
10. Expose scheduled care to an external calendar without building a full calendar product.

The exact implementation should stay small enough that the application becomes useful early.

## Not the goal

At least initially, First Aid is not:

- an electronic medical record
- a medical diagnosis tool
- a symptom checker
- a replacement for a healthcare provider
- a medical recommendation engine
- a pharmacy or medication-management platform
- a claims adjudication engine
- a provider marketplace
- an appointment-booking marketplace
- an insurance portal
- a complete health or fitness tracker
- a generic document-management system

Some of these areas may eventually intersect with First Aid, but they should only be added when they solve a real problem discovered through use.
