import { config } from 'dotenv';
config();
import {
    Client,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    GuildTextBasedChannel,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import sagiri from 'sagiri';

const client = new Client({
    intents: ['Guilds', 'MessageContent']
});

const sauceclient = sagiri(process.env.SAUCENAO_TOKEN as string);

type E621RawData = {
    ext_urls: string[]; // ['https://e621.net/post/show/id'];
    e621_id: number;
    creator: string;
    material: string;
    characters: string;
    source: string; // 'https://www.furaffinity.net/view/id/';
};

export function applyE621RawData(e: EmbedBuilder, rawData: E621RawData) {
    return e.addFields(
        { name: 'Material', value: `\`${rawData.material}\``, inline: true },
        {
            name: 'Characters',
            value: rawData.characters
                .split(',')
                .map(x => `\`${x.trim()}\``)
                .join('\n'),
            inline: true
        }
    );
}

const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

async function buildSelectorMessage(
    c: GuildTextBasedChannel,
    mId: string,
    i: number,
    userId: string
) {
    const message = await c.messages.fetch(mId);
    const x = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(JSON.stringify({ a: 'selector', m: mId, uId: userId }))
            .addOptions(
                [...message.attachments.values()].map((x, index) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`Image ${index + 1}`)
                        .setEmoji(numberEmojis[index])
                        .setValue(index.toString())
                        .setDefault(i === index)
                )
            )
    );
    const y = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setEmoji('◀️')
            .setCustomId(JSON.stringify({ a: 'prev', m: mId, i: i - 1, uId: userId }))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(i - 1 < 0),
        new ButtonBuilder()
            .setEmoji('✅')
            .setCustomId(JSON.stringify({ a: 'accept', m: mId, i: i, uId: userId }))
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setEmoji('▶️')
            .setCustomId(JSON.stringify({ a: 'next', m: mId, i: i + 1, uId: userId }))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(i + 1 > message.attachments.size - 1)
    );
    const e = new EmbedBuilder()
        .setTitle('Select an image')
        .setImage(message.attachments.map(x => x)[i].url)
        .setColor('Red')
        .setFooter({ text: `Image ${i + 1}/${message.attachments.size} | Made by mrtomato` });
    return {
        embeds: [e],
        components: [x, y] as any[]
    };
}

async function buildSaucyMessage(c: GuildTextBasedChannel, mId: string, i: number) {
    const message = await c.messages.fetch(mId);
    const results = (await sauceclient(message.attachments.map(x => x)[i].url))
        .map(v => {
            v.similarity = parseFloat(v.similarity as unknown as string);
            if (v.url.includes('e621')) v.similarity += 5;
            return v;
        })
        .sort((a, b) => b.similarity - a.similarity)
        .map(v => {
            v.similarity = parseFloat(v.similarity as unknown as string);
            if (v.url.includes('e621')) v.similarity -= 5;
            return v;
        });
    const result = results[0];
    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${result.authorName || result.raw.data.creator || result.raw.data.creator_name}`,
            url: result.authorUrl ?? undefined
        })
        .setThumbnail(
            `https://www.google.com/s2/favicons?domain=${new URL(result.url).hostname}&sz=256`
        )
        .setTitle(result.raw.data.title || 'Sauce found!!')
        .setURL(result.url)
        .setImage(result.thumbnail)
        .setFooter({ text: `Similarity: ${result.similarity} | Made by mrtomato` })
        .setColor('Yellow');
    if (result.url.includes('e621')) applyE621RawData(embed, result.raw.data as any);
    const x = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(result.url).setLabel('Open Post!')
    );
    return {
        embeds: [embed],
        components: [x as any]
    };
}

client.on('ready', () => console.log(`Bot ${client.user?.tag} is ready!`));

client.on('interactionCreate', async i => {
    try {
        if (i.isMessageContextMenuCommand()) {
            if (i.commandName.startsWith('Sauce. Now.')) {
                const eph = i.commandName.includes('SECRET');
                const attachment = i.targetMessage.attachments.first()?.url;
                if (!attachment)
                    return void i.reply({ ephemeral: true, content: 'No attachment found' });
                if (i.targetMessage.attachments.size > 1) {
                    return void i.reply({
                        ...(await buildSelectorMessage(
                            i.channel as GuildTextBasedChannel,
                            i.targetId,
                            0,
                            i.user.id
                        )),
                        ephemeral: eph
                    });
                } else
                    i.reply({
                        ...(await buildSaucyMessage(
                            i.channel as GuildTextBasedChannel,
                            i.targetId,
                            0
                        )),
                        ephemeral: eph
                    });
            }
        } else if (i.isMessageComponent()) {
            const customId = JSON.parse(i.customId);
            if (customId.uId !== i.user.id && process.env.OVERRIDER_USER !== i.user.id)
                return void i.reply({ ephemeral: true, content: "That isn't for you" });
            if (i.isStringSelectMenu() && customId.a === 'selector') {
                i.update(
                    await buildSelectorMessage(
                        i.channel as GuildTextBasedChannel,
                        customId.m,
                        parseInt(i.values[0]),
                        customId.uId
                    )
                );
            } else if (i.isButton() && customId.a === 'accept') {
                i.update(
                    await buildSaucyMessage(
                        i.channel as GuildTextBasedChannel,
                        customId.m,
                        customId.i
                    )
                );
            } else if (i.isButton()) {
                i.update(
                    await buildSelectorMessage(
                        i.channel as GuildTextBasedChannel,
                        customId.m,
                        customId.i,
                        customId.uId
                    )
                );
            }
        }
    } catch (e) {
        console.error(e);
    }
});

client.login(process.env.DISCORD_TOKEN);
