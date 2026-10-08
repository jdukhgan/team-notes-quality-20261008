// Fictional team notes used by the fixture adapter and tests. Timestamps are
// expressed as offsets from "now" so relative labels stay realistic.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const SEED = [
  {
    id: 12,
    title: 'Harbor Street pop-up: opening checklist',
    author: 'Priya Natarajan',
    archived: false,
    created: 3 * DAY,
    updated: 18 * MINUTE,
    body: `Doors at 10:00, soft launch for neighbours from 09:30.

Before opening
- Float in both tills (counted by two people)
- Chalkboard menu updated with the oat-milk surcharge
- Check the awning crank — it stuck on Tuesday

After close
1. Wipe down the espresso group heads
2. Log waste on the shared sheet
3. Lock the side gate (code is on the staff board, not here)`,
  },
  {
    id: 11,
    title: 'Retro notes — sprint 41',
    author: 'Tomás Okafor',
    archived: false,
    created: 2 * DAY,
    updated: 3 * HOUR,
    body: `Went well
  • Pairing on the invoice export saved a day
  • New on-call rota felt fair

Could improve
  • Too many late scope changes on Thursday
  • Staging was down for half of Wednesday

Actions
  → Tomás: draft a "scope freeze" proposal for Wednesday noon
  → Mei: add a staging health check to the stand-up board`,
  },
  {
    id: 10,
    title: 'Supplier call with Northfield Paper Co.',
    author: 'Mei Lindqvist',
    archived: false,
    created: 5 * DAY,
    updated: 1 * DAY + 2 * HOUR,
    body: `Spoke with Arjun from Northfield.

- Recycled kraft bags: price holds until end of quarter.
- They can't do the printed logo run before the 14th.
- Sample box of compostable lids is on its way.

Follow up next Monday about the logo run.`,
  },
  {
    id: 9,
    title: 'Onboarding: first week for new floor staff',
    author: 'Priya Natarajan',
    archived: false,
    created: 9 * DAY,
    updated: 2 * DAY + 5 * HOUR,
    body: `Day 1 — shadow opening shift, safety walk-through, allergen chart.
Day 2 — till training with Sam.
Day 3 — latte art basics (no pressure!).
Day 4 — closing shift with a buddy.
Day 5 — check-in chat, questions, feedback on this list.`,
  },
  {
    id: 8,
    title: 'Ideas for the autumn menu',
    author: 'Sam Achterberg',
    archived: false,
    created: 12 * DAY,
    updated: 4 * DAY,
    body: `Spiced pear loaf (test batch Friday)
Maple oat flat white
Savoury: leek & cheddar scone?

Need costings before we commit.`,
  },
  {
    id: 7,
    title: 'Wi-Fi password rotation reminder',
    author: 'Lena Fischer',
    archived: false,
    created: 20 * DAY,
    updated: 6 * DAY,
    body: 'Guest network password rotates on the first of each month. New one goes on the counter card, old cards in the recycling.',
  },
  {
    id: 6,
    title: 'Q',
    author: 'Ola',
    archived: false,
    created: 21 * DAY,
    updated: 9 * DAY,
    body: 'Short one: ask about the spare key.',
  },
  {
    id: 5,
    title: 'Summer rota (June–August)',
    author: 'Tomás Okafor',
    archived: true,
    created: 120 * DAY,
    updated: 32 * DAY,
    body: `Final summer rota, kept for reference.

Mon–Wed  Priya / Sam
Thu–Fri  Mei / Lena
Weekend  rotating, see the shared calendar`,
  },
  {
    id: 4,
    title: 'Old espresso machine service log',
    author: 'Sam Achterberg',
    archived: true,
    created: 200 * DAY,
    updated: 60 * DAY,
    body: 'Replaced gaskets in March. Descaled monthly. Machine retired when the new one arrived.',
  },
  {
    id: 3,
    title: 'Street festival stall — what we learned',
    author: 'Mei Lindqvist',
    archived: true,
    created: 300 * DAY,
    updated: 90 * DAY,
    body: `Bring twice as many cups as we think.
Shade matters more than signage.
Card reader needs its own battery pack.`,
  },
];

export function buildFixtureNotes(now = Date.now()) {
  return SEED.map(({ created, updated, ...note }) => ({
    ...note,
    createdAt: new Date(now - created).toISOString(),
    updatedAt: new Date(now - updated).toISOString(),
  }));
}
