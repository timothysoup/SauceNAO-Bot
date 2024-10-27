const { REST, Routes, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { config } = require('dotenv');
config();

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        const self = await rest.get(Routes.user());
        const clientId = self.id;

        const data = await rest.put(Routes.applicationCommands(clientId), {
            body: [
                new ContextMenuCommandBuilder()
                    .setName('Sauce. Now.')
                    .setType(ApplicationCommandType.Message)
                    .toJSON(),
                new ContextMenuCommandBuilder()
                    .setName('Sauce. Now. (SECRET MODE)')
                    .setType(ApplicationCommandType.Message)
                    .toJSON()
            ]
        });

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
