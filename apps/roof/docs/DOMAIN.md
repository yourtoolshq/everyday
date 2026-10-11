# Roof — Domain

The initial slice keeps one continuous record for each place, from purchase through possession or from an active tenancy to a past rental.

## Property

A property is any place the household has a relationship with: a rental (current or past) or a home under construction/purchase.

| Kind                 | Meaning                                        |
| -------------------- | ---------------------------------------------- |
| `under_construction` | Purchase or build in progress before occupancy |
| `owned`              | Home after possession                          |
| `current_rental`     | Active lease                                   |
| `past_rental`        | Former rental kept for reference               |

Properties carry optional address fields, lease dates and notes, simple landlord contact fields, and renter insurance metadata (not a full insurance product).

## Property event

A dated record of something that happened or mattered: a notice, leak report, construction change, correspondence, etc. Events have category, title, calendar date, optional local time, status, notes, and optional linked documents. A visit uses the visit category and starts planned; edit it after the appointment to mark completed and add notes. Cancelled visits remain in history. Time is local to the property and is never converted to an instant.

Documents linked to an event must belong to the same property. Removing an event preserves its documents as property reference documents. Ending a tenancy or taking possession changes the property relationship without deleting its history. Properties are not permanently deletable in this first slice.

## Document

A file stored through the platform file layer and linked to a property, optionally to an event. Types include lease, notice, agreement, receipt, drawing, correspondence, photo, insurance, and other.

## Future concepts (documented, not implemented)

Assets, parties, projects/quotations, and maintenance tasks remain roadmap items. Do not model them in the first vertical slice unless the roadmap explicitly expands.
