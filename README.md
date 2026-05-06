# Discord Feedback Bot

A Discord bot that lets approved users submit structured feedback through a button, service selector, and modal form.

## Features

- Feedback submit flow using Discord UI components:
  - Button
  - Select menu for service type
  - Modal for server name, rating, and description
- Role-based permission check for who can submit feedback
- Posts final feedback as an embed in a target channel
- Rating displayed with star formatting
- Environment variable configuration via .env

## Requirements

- Node.js 18+
- A Discord bot token
- Bot invited to your server with required permissions

## Installation

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

## Configuration

1. Copy .env.example to .env.
2. Fill in your values:

```env
TOKEN=your_discord_bot_token
GUILD_ID=your_server_id
FEEDBACK_CHANNEL_ID=target_channel_id
ALLOWED_ROLE_ID=role_id_allowed_to_submit
```

## Run

```bash
npm start
```

## Usage

1. Start the bot.
2. In Discord, run the admin command:

```text
!init_feedback
```

3. The bot posts an embed with a Submit Feedback button.
4. Authorized users click the button, choose service type, and submit feedback.

## Security Notes

- Never commit .env.
- If a token is ever exposed, rotate it immediately in the Discord Developer Portal.

## Permissions Checklist

Make sure the bot has:

- Read Messages / View Channels
- Send Messages
- Embed Links
- Add Reactions
- Read Message History
- Use Application Commands and interactions support in your server setup
