# @_linked/live-sessions

Transport-neutral live media admission and lifecycle contracts for Linked applications. Applications own identity, Linked/SHACL policy, audience partitioning, seat leases, and any Matrix conversation binding. This package has no media server or chat history.

The server calls `issueCredential` with an application-owned `AdmissionAuthority`. Its `decide` method must authenticate the request context and make a fresh policy decision; `isCurrent` must recheck it. Never expose the authority, minter, or request context to a browser, and never treat a browser-supplied WebID as verified identity. Physical `mediaRoom` names must be unique per audience generation. Rotating the generation must create a new room.

`requiredEnforcement` is fail-closed. An adapter that cannot enforce per-listener track ACLs must report `false`; client subscription selection is a bandwidth hint only. Revocation results distinguish media-service acknowledgement from prevention of token reuse.

Run `npm ci && npm test && npm run typecheck`.
