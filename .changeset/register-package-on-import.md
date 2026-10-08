---
'@linked.cm/live-sessions': patch
---

Importing any entry point now registers the package with `@_linked/core`. Before, it was registered only when a consumer imported `@linked.cm/live-sessions/package` itself.
