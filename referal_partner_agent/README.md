# Referral Partner Tracker — staff only

An internal Lua agent for the Noblestride deal team. It keeps the referral record
straight: who introduced which deal, how each partner relationship and fee share
is set up, which introductions converted, and what fees are due.

## Partner self service was removed (August 2026 client feedback, F5.6)

The client's feedback on image23 was to "drop the partner usage" from this agent,
because referral partners now have somewhere better to go: the **Noblestride
partner portal** (`/portal/partner`), which WS-B made a real, password-protected
surface with its own invitations and staff access panel.

Removed in that change:

- the `partner-self-service` skill and its four tools (`verify_partner_code`,
  `get_partner_self_view`, `update_partner_self_info`, `issue_partner_access_code`);
- the `partner` gate outcome, which used to pass **every** unverified visitor
  through so they could reach those tools.

The gate is therefore now a hard block. Because a block is only fair if it is
explicable, it does three things instead of stonewalling:

1. answers help questions before the gate (`help` outcome);
2. acknowledges an email that arrives without the passphrase, rather than
   repeating the challenge (`hint_missing_passphrase`);
3. tells a referral partner, in the challenge itself, that the partner portal is
   where they see the deals they introduced.

`staffRefusal` (`src/lib/staff-mode.ts`) still guards every staff tool. The gate
is the door, not the only lock — a tool that is somehow reached by a non-staff
caller still refuses.

## Verification

- `TEAM_PASSPHRASE` — the shared staff secret, set with
  `lua env sandbox -k TEAM_PASSPHRASE -v "<phrase>"`.
- `PASSPHRASE_VERSION` — bump this whenever the phrase changes. Verification is
  stored per user, so without a generation number a rotated passphrase would
  leave everyone who had already verified still verified. Blank or unset counts
  as generation 1, so introducing the variable signs nobody out.

Say "log out" to end a staff session.

## Server-side cleanup

`lua push` does not delete a skill that no longer exists locally. After pushing
this change, remove the retired skill from the server explicitly:

```
lua skills delete --skill-name partner-self-service
```

(`lua skills` has no `deactivate` action — only preprocessors do.)
