const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Collection,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  Partials,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const FEEDBACK_CHANNEL_ID = process.env.FEEDBACK_CHANNEL_ID;
const ALLOWED_ROLE_ID = process.env.ALLOWED_ROLE_ID;

if (!TOKEN || !GUILD_ID || !FEEDBACK_CHANNEL_ID || !ALLOWED_ROLE_ID) {
  throw new Error('Missing required environment variables. Check TOKEN, GUILD_ID, FEEDBACK_CHANNEL_ID, and ALLOWED_ROLE_ID in .env');
}

const FEEDBACK_PANEL_STATE_FILE = path.join(__dirname, 'feedback_panel_state.json');
const FEEDBACK_BUTTON_ID = 'feedback:submit';
const FEEDBACK_SELECT_ID = 'feedback:service_type';
const FEEDBACK_MODAL_ID = 'feedback:modal';
const PREFIX = '!';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel],
});

const pendingFeedback = new Collection();

function ratingToStars(rating) {
  const fullStars = Math.floor(rating);
  const halfStar = rating - fullStars >= 0.5;
  return '⭐'.repeat(fullStars) + (halfStar ? '✨' : '') + '☆'.repeat(5 - fullStars - (halfStar ? 1 : 0));
}

function loadFeedbackPanelState() {
  if (!fs.existsSync(FEEDBACK_PANEL_STATE_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(FEEDBACK_PANEL_STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveFeedbackPanelState(channelId, messageId) {
  fs.writeFileSync(
    FEEDBACK_PANEL_STATE_FILE,
    JSON.stringify({ channel_id: channelId, message_id: messageId }, null, 2),
    'utf8',
  );
}

function buildFeedbackPanelEmbed() {
  return new EmbedBuilder()
    .setTitle('📝 Submit Your Feedback')
    .setDescription('Click the button below to submit feedback.')
    .setColor(0x5865f2);
}

function buildFeedbackPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(FEEDBACK_BUTTON_ID)
      .setLabel('Submit Feedback')
      .setStyle(ButtonStyle.Primary),
  );
}

function buildServiceTypeRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(FEEDBACK_SELECT_ID)
      .setPlaceholder('اختر نوع الخدمة')
      .addOptions(
        { label: 'خدمة برمجية', value: 'خدمة برمجية' },
        { label: 'شراء سكربت', value: 'شراء سكربت' },
        { label: 'بوستات دسكورد', value: 'بوستات دسكورد' },
        { label: 'بوت دسكورد', value: 'بوت دسكورد' },
      ),
  );
}

function buildFeedbackModal(selectedService, userId) {
  const modal = new ModalBuilder()
    .setCustomId(`${FEEDBACK_MODAL_ID}:${selectedService}:${userId}`)
    .setTitle('Submit Feedback');

  const serverNameInput = new TextInputBuilder()
    .setCustomId('server_name')
    .setLabel('Server Name (optional)')
    .setPlaceholder('Enter a server name or leave blank')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(false);

  const ratingInput = new TextInputBuilder()
    .setCustomId('rating')
    .setLabel('Rating (e.g., 4.5)')
    .setPlaceholder('1-5')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(3)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(serverNameInput),
    new ActionRowBuilder().addComponents(ratingInput),
    new ActionRowBuilder().addComponents(descriptionInput),
  );

  return modal;
}

async function getFeedbackPanelChannel() {
  const channel = await client.channels.fetch(FEEDBACK_CHANNEL_ID);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error('Feedback channel must be a text channel that the bot can access.');
  }

  return channel;
}

async function handleInitFeedback(message) {
  const embed = buildFeedbackPanelEmbed();
  const row = buildFeedbackPanelRow();
  const state = loadFeedbackPanelState();
  const channel = await getFeedbackPanelChannel();

  if (state && state.channel_id === FEEDBACK_CHANNEL_ID) {
    try {
      const savedMessage = await channel.messages.fetch(String(state.message_id));
      await savedMessage.edit({ embeds: [embed], components: [row] });
      await message.reply('✅ Updated the saved feedback panel message.');
      return;
    } catch {
      // Fall through and create a new panel message.
    }
  }

  const sentMessage = await channel.send({ embeds: [embed], components: [row] });
  saveFeedbackPanelState(channel.id, sentMessage.id);
  await message.reply('✅ Created and saved the feedback panel message.');
}

function parseServiceTypeFromModalCustomId(customId) {
  const parts = customId.split(':');
  if (parts.length < 4) {
    return null;
  }

  return {
    serviceType: parts[2],
    userId: parts.slice(3).join(':'),
  };
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) {
    return;
  }

  if (message.content.trim() === `${PREFIX}init_feedback`) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.reply('You do not have permission to use this command.');
      return;
    }

    await handleInitFeedback(message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId !== FEEDBACK_BUTTON_ID) {
        return;
      }

      if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
        await interaction.reply({ content: "You don't have permission to submit feedback.", ephemeral: true });
        return;
      }

      await interaction.reply({
        content: 'Please select the service type:',
        components: [buildServiceTypeRow()],
        ephemeral: true,
      });
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId !== FEEDBACK_SELECT_ID) {
        return;
      }

      const selectedService = interaction.values[0];
      const modal = buildFeedbackModal(selectedService, interaction.user.id);
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit()) {
      if (!interaction.customId.startsWith(FEEDBACK_MODAL_ID)) {
        return;
      }

      const parsed = parseServiceTypeFromModalCustomId(interaction.customId);
      if (!parsed || parsed.userId !== interaction.user.id) {
        await interaction.reply({ content: 'This feedback form is no longer valid.', ephemeral: true });
        return;
      }

      const ratingValue = Number.parseFloat(interaction.fields.getTextInputValue('rating').trim());
      if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        await interaction.reply({ content: 'Invalid rating. Must be a number between 1 and 5.', ephemeral: true });
        return;
      }

      const serverName = interaction.fields.getTextInputValue('server_name').trim();
      const description = interaction.fields.getTextInputValue('description').trim();

      const embed = new EmbedBuilder()
        .setColor(0x5200ff)
        .setAuthor({
          name: '𝐅𝐞𝐞𝐝𝐛𝐚𝐜𝐤𝐬',
          url: 'https://discord.gg/pxvault',
          iconURL: 'https://cdn.discordapp.com/attachments/1399395829122465823/1492498182524108840/e72b2f4ba36509c1f3c2e751de7dc02f.png?ex=69fc823f&is=69fb30bf&hm=53158c261cb79f74f0ffa167a0832d2be366ad4c550d4df31e966fc3c6867414&',
        })
        .addFields(
          { name: 'Service Type', value: parsed.serviceType, inline: true },
          { name: 'Rating', value: ratingToStars(ratingValue), inline: true },
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({
          text: 'PXVault Team',
          iconURL: 'https://cdn.discordapp.com/attachments/1399395829122465823/1492498182524108840/e72b2f4ba36509c1f3c2e751de7dc02f.png?ex=69fc823f&is=69fb30bf&hm=53158c261cb79f74f0ffa167a0832d2be366ad4c550d4df31e966fc3c6867414&',
        });

      if (serverName) {
        embed.setTitle(serverName);
      }

      if (description) {
        embed.setDescription(description);
      }

      const channel = await client.channels.fetch(FEEDBACK_CHANNEL_ID);
      if (channel && channel.isTextBased()) {
        const message = await channel.send({ embeds: [embed] });
        try {
          await message.react('<:Purple_heart:1395756650144731186>');
        } catch {
          // Reaction is optional.
        }
      }

      await interaction.reply({ content: '✅ Feedback submitted.', ephemeral: true });
    }
  } catch (error) {
    console.error(error);

    if (interaction.isRepliable()) {
      const payload = { content: 'Something went wrong while handling that interaction.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
});

client.login(TOKEN);