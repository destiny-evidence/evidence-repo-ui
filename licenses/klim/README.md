# Klim Type Foundry — Web licence

The font binaries shipped at `src/styles/fonts/` are licensed from
Klim Type Foundry under their standard Web licence.

| Field           | Value                            |
| --------------- | -------------------------------- |
| Licensee        | Future Evidence Foundation       |
| Domain          | evidence-repository.org          |
| Format          | Web (woff2)                      |
| User cap        | 5,000 monthly unique users       |
| Licence terms   | <https://klim.co.nz/licences>    |

## Cuts shipped

| Family        | Cut             | File                                      |
| ------------- | --------------- | ----------------------------------------- |
| Signifier     | Regular         | `signifier-regular.woff2`                 |
| Signifier     | Regular Italic  | `signifier-regular-italic.woff2`          |
| Untitled Sans | Medium          | `untitled-sans-medium.woff2`              |
| Untitled Sans | Medium Italic   | `untitled-sans-medium-italic.woff2`       |
| Söhne Mono    | Buch (400)      | `soehne-mono-buch.woff2`                  |
| Söhne Mono    | Kräftig (500)   | `soehne-mono-kraftig.woff2`               |
| Söhne Mono    | Halbfett (600)  | `soehne-mono-halbfett.woff2`              |

## Notes for contributors

- Only the cuts above are licensed. Do not introduce CSS that depends on
  weights or styles outside this set — the project sets
  `font-synthesis: none` in `src/styles/reset.css` to prevent the browser
  from faking them.
- New domains or higher MAU caps require an updated Klim licence. Contact
  the project owners before deploying these fonts to a domain other than
  `evidence-repository.org`.
- Proof-of-purchase (Klim invoice) is held off-repo by the project owner.
