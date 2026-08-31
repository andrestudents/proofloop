# Kane context — proofloop-target-app

A single-page signup app served at http://localhost:4000.

- Page: "Create your account" heading, then a form with three inputs — Name (`#name`, text),
  Email (`#email`, text), Password (`#password`, password) — and a "Sign Up" button
  (`#signup-button`).
- Submitting the form shows a status message in `#message` (success class — rendered as an
  oxblood "rubber stamp" block, uppercase via CSS but the DOM text keeps its original case).
- All behavior is client-side in `public/app.js`; there is no backend API beyond a health check.
- Field validation behavior may change between runs (that is the point of this app).
