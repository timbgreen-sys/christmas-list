# Family Xmas Lists

Shared gift lists. Tick a gift once it's bought and it drops off the list for everyone.

| Page | People | Sheet tab |
|---|---|---|
| `/` Mini Greens | Tim, Sue, Lucy, James, Albie | Full list |
| `/aged-greens/` Aged Greens | Nanny Liz, Grandpa Brian | Aged Greens |
| `/elliott-aunties/` Elliott Aunties | Auntie Ruth, Auntie Pat | Elliott Aunties |

- `app.js` and `app.css` are shared by all three pages; each page picks its list and theme with `<html data-list="…">`.
- The data lives in the "Christmas List 2026" Google Sheet, reached through `apps-script/Code.gs` deployed as an Apps Script web app.
