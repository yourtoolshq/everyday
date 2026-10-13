# Roof — Domain

The initial slice keeps one continuous record for each place, from purchase through possession or from an active tenancy to a past rental.

## Property

A property is any place the household has a relationship with: a rental (current or past) or a home under construction/purchase.

A property has a stable **relationship** (`rental` or `purchase`) and a changing **stage**:

| Relationship         | Stages                                                               |
| -------------------- | -------------------------------------------------------------------- |
| Rental               | Current, past                                                        |
| Purchase / ownership | Purchase in progress, under construction, awaiting possession, owned |

Buying and ownership are stages of the same home, not separate property types. Taking possession or ending a tenancy updates the stage on the existing record. Relationship stays fixed after creation; stage updates preserve earlier dates, contacts, history, files, and insurance records.

Only a name, relationship, and stage are required. Rentals ask for optional move-in/out dates and landlord contact. Purchased homes ask for expected possession, and actual possession and move-in when owned. The server validates the relationship/stage combination and rejects details belonging to the other relationship. Address and notes apply to both.

A property may have one optional JPEG, PNG, or WebP photo, up to 10 MB, stored through the platform file layer. It is displayed beside the entry form, on the property list, and on the property detail. Replacing or removing it also removes its old stored file. It is separate from supporting documents.

Creation uses a nearly full-screen centered dialog: relationship and stage, place and photo, relevant details, then review. Back/Continue retain the draft, optional details can be left blank, and closing a changed draft asks before discarding it. Editing uses the same centered dialog without repeating the creation steps.

## Lease record

Leases belong to rental properties as separate records. Each has a required title and term type (fixed term or month-to-month), optional start/end calendar dates, and notes. Renewals and explicit month-to-month continuations are new entries, preserving earlier terms and supporting documents. Landlord contact and move-in/out dates remain on the property.

Status is derived from calendar dates, with inclusive start and end boundaries: ended when end precedes today, upcoming when start follows today, otherwise active when start is known and either end is known or the term is month-to-month. Remaining records have dates incomplete. A fixed term never automatically becomes month-to-month. This summarizes recorded dates, not contractual validity. Status does not change the property's current/past stage.

Active leases appear first, followed by upcoming, incomplete, and ended entries. Multiple active entries show an overlap warning; none is silently selected as authoritative. With no active entry, show “No active lease recorded.”

Each lease owns its supporting files, including signed agreements and confirmation emails. Existing files can be assigned through document editing. Removing a lease preserves its documents as property references, retaining any event or insurance links.

The upgrade creates one fixed-term “Existing lease” entry for each rental with old lease dates or nonblank notes. It copies values without inferring missing dates or linking documents. Original property columns remain in storage but new reads and writes use lease records.

## Insurance record

Insurance belongs to a property as a separate record: tenant or home insurance, optional provider, policy number, coverage start/end, and notes. A provider or policy number identifies a new record. Multiple records preserve renewals and prior policies; documents can be attached later. The property surfaces each record and its documents together.

Coverage status is derived from calendar dates: ended, upcoming, in effect, or dates incomplete. This is a record summary, not a determination of actual coverage. Removing an insurance record preserves its documents as property references.

The upgrade maps the old four kinds to relationship/stage and copies existing insurance metadata into records. It does not infer start dates or automatically link an existing insurance file. The ambiguous legacy renewal/expiry date is copied to coverage end with a note asking users to confirm it. Legacy columns remain in storage to preserve the original values and unrelated details; application reads and new writes use the new model.

## Property event

A dated record of something that happened or mattered: a notice, leak report, construction change, correspondence, etc. Events have category, title, calendar date, optional local time, status, notes, and optional linked documents. A visit uses the visit category and starts planned; edit it after the appointment to mark completed and add notes. Cancelled visits remain in history. Time is local to the property and is never converted to an instant.

Documents linked to an event must belong to the same property. Removing an event preserves its documents as property reference documents. Ending a tenancy or taking possession changes the property relationship without deleting its history. Properties are not permanently deletable in this first slice.

## Document

A file stored through the platform file layer and linked to a property, optionally to an event, insurance record, and/or lease. All links must belong to the same property. Types include lease, notice, agreement, receipt, drawing, correspondence, photo, insurance, and other.

## Future concepts (documented, not implemented)

Assets, parties, projects/quotations, and maintenance tasks remain roadmap items. Do not model them in the first vertical slice unless the roadmap explicitly expands.
