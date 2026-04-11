import discord
from discord.ext import commands
from discord.ui import View, Button, Modal, TextInput, Select
import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID", "0"))
FEEDBACK_CHANNEL_ID = int(os.getenv("FEEDBACK_CHANNEL_ID", "0"))
ALLOWED_ROLE_ID = int(os.getenv("ALLOWED_ROLE_ID", "0"))

if not TOKEN or GUILD_ID == 0 or FEEDBACK_CHANNEL_ID == 0 or ALLOWED_ROLE_ID == 0:
    raise ValueError("Missing required environment variables. Check TOKEN, GUILD_ID, FEEDBACK_CHANNEL_ID, and ALLOWED_ROLE_ID in .env")

intents = discord.Intents.default()
intents.guilds = True
intents.messages = True
intents.message_content = True
intents.reactions = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)


def rating_to_stars(rating: float) -> str:
    full_stars = int(rating)
    half_star = rating - full_stars >= 0.5
    return "⭐" * full_stars + ("✨" if half_star else "") + "☆" * (5 - full_stars - (1 if half_star else 0))


class FeedbackModal(Modal, title="Submit Feedback"):
    server_name = TextInput(label="Server Name", placeholder="Enter the server name", max_length=100)
    rating = TextInput(label="Rating (e.g., 4.5)", placeholder="1-5", max_length=3)
    description = TextInput(label="Description", style=discord.TextStyle.paragraph, max_length=1000)

    def __init__(self, user, original_view, service_type):
        super().__init__()
        self.user = user
        self.original_view = original_view
        self.service_type = service_type

    async def on_submit(self, interaction: discord.Interaction):
        try:
            rating_value = float(self.rating.value.strip())
            if not (1 <= rating_value <= 5):
                raise ValueError
        except ValueError:
            await interaction.response.send_message("Invalid rating. Must be a number between 1 and 5.", ephemeral=True)
            return

        embed = discord.Embed(
            title=self.server_name.value.strip(),
            description=self.description.value.strip(),
            color=0x5200FF
        )
        embed.set_author(
            name="PXVault 𝐅𝐞𝐞𝐝𝐛𝐚𝐜𝐤𝐬",
            url="https://discord.gg/pxvault",
            icon_url="https://cdn.discordapp.com/attachments/1247885669414600764/1394656637112946749/logo.png"
        )
        embed.add_field(name="Service Type", value=self.service_type, inline=True)
        embed.add_field(name="Rating", value=rating_to_stars(rating_value), inline=True)
        embed.set_thumbnail(url=interaction.user.avatar.url if interaction.user.avatar else interaction.user.default_avatar.url)
        embed.set_footer(
            text="PXVault 𝐒𝐭𝐨𝐫𝐞",
            icon_url="https://cdn.discordapp.com/attachments/1247885669414600764/1394656637112946749/logo.png"
        )

        channel = bot.get_channel(FEEDBACK_CHANNEL_ID)
        if channel:
            message = await channel.send(embed=embed, view=self.original_view)
            try:
                await message.add_reaction("<:Purple_heart:1395756650144731186>")
            except:
                pass

        await interaction.response.send_message("✅ Feedback submitted.", ephemeral=True)


class ServiceTypeSelect(Select):
    def __init__(self, user, original_view):
        options = [
            discord.SelectOption(label="خدمة برمجية", value="خدمة برمجية"),
            discord.SelectOption(label="شراء سكربت", value="شراء سكربت"),
            discord.SelectOption(label="بوستات دسكورد", value="بوستات دسكورد"),
            discord.SelectOption(label="بوت دسكورد", value="بوت دسكورد")
        ]
        super().__init__(placeholder="اختر نوع الخدمة", options=options, min_values=1, max_values=1)
        self.user = user
        self.original_view = original_view

    async def callback(self, interaction: discord.Interaction):
        selected_service = self.values[0]
        
        # Create and show the modal with the selected service type
        modal = FeedbackModal(user=self.user, original_view=self.original_view, service_type=selected_service)
        await interaction.response.send_modal(modal)


class ServiceTypeView(View):
    def __init__(self, user, original_view):
        super().__init__(timeout=60)
        self.add_item(ServiceTypeSelect(user, original_view))


class FeedbackButton(Button):
    def __init__(self):
        super().__init__(label="Submit Feedback", style=discord.ButtonStyle.primary)

    async def callback(self, interaction: discord.Interaction):
        if ALLOWED_ROLE_ID not in [role.id for role in interaction.user.roles]:
            await interaction.response.send_message("You don't have permission to submit feedback.", ephemeral=True)
            return

        # Create a view with the service type select menu
        select_view = ServiceTypeView(user=interaction.user, original_view=self.view)
        
        # Send the select menu first
        await interaction.response.send_message("Please select the service type:", view=select_view, ephemeral=True)


class FeedbackView(View):
    def __init__(self):
        super().__init__(timeout=None)
        self.add_item(FeedbackButton())


@bot.command(name="init_feedback")
@commands.has_permissions(administrator=True)
async def init_feedback(ctx):
    """Posts the initial embed with the feedback button."""
    embed = discord.Embed(
        title="📝 Submit Your Feedback",
        description="Click the button below to submit feedback.",
        color=discord.Color.blurple()
    )
    view = FeedbackView()
    await ctx.send(embed=embed, view=view)


bot.run(TOKEN)
