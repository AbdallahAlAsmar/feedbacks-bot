# AGENTS.md

## Cursor Cloud specific instructions

### What this is
A single-file Discord bot (`index.js`) built on `discord.js` v14. It lets approved
users submit structured feedback via a button → service select menu → modal flow, and
posts the result as an embed in a target channel. There is no web server, database, or
build step — it is one long-running Node process that connects to the Discord gateway.

### Running
- Start: `npm start` (runs `node index.js`). There is no dev/watch script; restart the
  process manually after code changes.
- Required env vars (the process throws on startup if any are missing): `TOKEN`,
  `GUILD_ID`, `FEEDBACK_CHANNEL_ID`, `ALLOWED_ROLE_ID`. Copy `.env.example` to `.env`
  (loaded via `dotenv`) or export them; `.env` is gitignored.
- These credentials are external prerequisites that cannot be created from inside the VM:
  a real Discord bot token (Developer Portal), the bot invited to a guild with the
  `MessageContent`, `GuildMembers`, and `GuildMessageReactions` privileged/standard
  intents enabled, plus a text channel ID and a role ID. Without a real token the bot
  fails at `client.login` with `DiscordjsError [TokenInvalid]`.
- Outbound access to `discord.com` works from the VM, so a valid token connects.

### Testing / linting
- There are no automated tests and no lint/format config (no ESLint/Prettier/Jest).
  The only meaningful static check is `node --check index.js`.
- Manual smoke test without credentials: running `node index.js` with no env vars should
  throw the "Missing required environment variables" error; running with dummy values
  should reach `client.login` and fail with `TokenInvalid`. Both confirm the code path
  loads correctly.

### Runtime notes
- Bootstrap the panel in Discord with the admin-only message command `!init_feedback`
  (requires the Administrator permission). The panel message id is persisted to
  `feedback_panel_state.json` (gitignored) so re-running the command edits the existing
  panel instead of posting a duplicate.
- Only members with `ALLOWED_ROLE_ID` can open the feedback modal; rating must parse to a
  number between 1 and 5.
- The select-menu placeholder and option labels are in Arabic — this is expected, not a
  mojibake/encoding bug.
