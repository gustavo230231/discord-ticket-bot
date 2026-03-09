const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const express = require('express');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

const app = express();
const PORT = process.env.PORT || 8080;
app.get('/', (req, res) => res.send('Pixel & Code Ticket Bot está rodando!'));
app.listen(PORT, () => console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`));

// Configurações do sistema de tickets
const ticketConfig = {
    embed: {
        title: 'Pixel & Code',
        description: 'Olá! 👋 Bem-vindo(a) ao Pixel & Code.\nAqui você pode abrir um ticket para solicitar nossos serviços digitais:',
        color: '#5865F2', // Cor azul do Discord
        footer: 'Pixel & Code'
    },
    services: {
        title: '🔹 Serviços disponíveis:',
        items: [
            '🎬 Edição de Vídeos',
            '🎨 Design & Posters', 
            '💻 Códigos de Programação'
        ]
    },
    howToOpen: {
        title: '🔹 Como abrir um ticket:',
        steps: [
            '1️⃣ Clique no botão "Abrir Ticket" abaixo (ou reaja com 🎫)',
            '2️⃣ Escolha o tipo de serviço que deseja',
            '3️⃣ Aguarde nossa equipe responder para confirmar detalhes e pagamento'
        ]
    },
    tips: {
        title: '⚡ Dicas:',
        items: [
            'Informe todas as referências, links ou exemplos para facilitar o serviço',
            'Seja claro(a) sobre prazos e revisões',
            'Apenas o dono do ticket e a equipe poderão ver as mensagens neste canal'
        ]
    },
    finalNote: '✅ Após abrir o ticket, você será guiado(a) passo a passo até receber o seu pedido!',
    logs: { channelId: null, enabled: false }
};

// Função para enviar logs
async function sendLog(guild, message, type = 'info') {
    if (!ticketConfig.logs.enabled || !ticketConfig.logs.channelId) return;
    try {
        const logChannel = guild.channels.cache.get(ticketConfig.logs.channelId);
        if (!logChannel) return;
        const colors = { info: '#0099ff', success: '#00ff00', warning: '#ffff00', error: '#ff0000' };
        const embed = new EmbedBuilder().setColor(colors[type] || colors.info).setDescription(message).setTimestamp();
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Erro ao enviar log:', error);
    }
}

// Função para criar canal de ticket
async function createTicketChannel(guild, user, serviceType) {
    try {
        const staffRole = guild.roles.cache.get(process.env.STAFF_ROLE_ID);
        const channel = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: staffRole?.id || guild.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
            ],
        });

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`🎫 Ticket - ${serviceType}`)
            .setDescription(`Olá ${user}! Bem-vindo ao seu ticket.\n\n**Serviço solicitado:** ${serviceType}\n\nPor favor, descreva detalhadamente o que você precisa:\n• Especificações do projeto\n• Prazo desejado\n• Orçamento disponível\n• Referências ou exemplos\n\nNossa equipe responderá em breve!`)
            .setColor('#00ff00')
            .setTimestamp()
            .setFooter({ text: 'Pixel & Code - Suporte' });

        const closeButton = new ActionRowBuilder()
            .addComponents(new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Fechar Ticket').setStyle(ButtonStyle.Danger));

        await channel.send({ content: `${user} | <@&${process.env.STAFF_ROLE_ID}>`, embeds: [welcomeEmbed], components: [closeButton] });
        await sendLog(guild, `🎫 Ticket criado por ${user.tag} - Serviço: ${serviceType}`, 'success');
        return channel;
    } catch (error) {
        console.error('Erro ao criar canal de ticket:', error);
        return null;
    }
}
// Event: Bot pronto
client.once('clientReady', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    
    const commands = [
        new SlashCommandBuilder()
            .setName('setup-pixel-tickets')
            .setDescription('Configura o sistema de tickets do Pixel & Code'),
        new SlashCommandBuilder()
            .setName('config-logs')
            .setDescription('Configura o sistema de logs')
            .addChannelOption(option => option.setName('canal').setDescription('Canal para logs').setRequired(false))
            .addBooleanOption(option => option.setName('ativar').setDescription('Ativar logs').setRequired(false))
    ];

    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
            await guild.commands.set(commands);
            console.log('✅ Comandos registrados!');
        }
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
});

// Event: Interações
client.on('interactionCreate', async interaction => {
    if (!interaction.guild) return;

    try {
        if (interaction.isChatInputCommand()) {
            const { commandName } = interaction;

            if (commandName === 'setup-pixel-tickets') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Você precisa ser administrador!', ephemeral: true });
                }

                // Criar o embed principal
                const mainEmbed = new EmbedBuilder()
                    .setTitle(ticketConfig.embed.title)
                    .setDescription(ticketConfig.embed.description)
                    .setColor(ticketConfig.embed.color)
                    .setFooter({ text: ticketConfig.embed.footer });

                // Adicionar seção de serviços
                let servicesText = ticketConfig.services.title + '\n';
                ticketConfig.services.items.forEach(item => {
                    servicesText += item + '\n';
                });
                mainEmbed.addFields({ name: '\u200B', value: servicesText, inline: false });

                // Adicionar seção de como abrir ticket
                let howToText = ticketConfig.howToOpen.title + '\n';
                ticketConfig.howToOpen.steps.forEach(step => {
                    howToText += step + '\n';
                });
                mainEmbed.addFields({ name: '\u200B', value: howToText, inline: false });

                // Adicionar dicas
                let tipsText = ticketConfig.tips.title + '\n\n';
                ticketConfig.tips.items.forEach(tip => {
                    tipsText += tip + '\n\n';
                });
                mainEmbed.addFields({ name: '\u200B', value: tipsText, inline: false });

                // Adicionar nota final
                mainEmbed.addFields({ name: '\u200B', value: ticketConfig.finalNote, inline: false });

                // Criar botões
                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_comprar')
                            .setLabel('🛒 Comprar')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('ticket_design')
                            .setLabel('🎨 Design')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('ticket_edicao')
                            .setLabel('🎬 Edição')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('ticket_programacao')
                            .setLabel('💻 Programação')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.channel.send({ embeds: [mainEmbed], components: [buttons] });
                await interaction.reply({ content: '✅ Sistema de tickets configurado!', ephemeral: true });
            }

            else if (commandName === 'config-logs') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return interaction.reply({ content: '❌ Você precisa ser administrador!', ephemeral: true });
                }
                const canal = interaction.options.getChannel('canal');
                const ativar = interaction.options.getBoolean('ativar');
                if (canal) {
                    ticketConfig.logs.channelId = canal.id;
                    ticketConfig.logs.enabled = true;
                }
                if (ativar !== null) {
                    ticketConfig.logs.enabled = ativar;
                }
                await interaction.reply({ content: '✅ Configurações de logs atualizadas!', ephemeral: true });
            }
        }

        else if (interaction.isButton()) {
            const { customId } = interaction;

            if (customId.startsWith('ticket_')) {
                const serviceType = customId.replace('ticket_', '');
                const serviceNames = {
                    comprar: 'Comprar Serviços',
                    design: 'Design & Posters',
                    edicao: 'Edição de Vídeos',
                    programacao: 'Códigos de Programação'
                };

                // Verificar se já tem ticket aberto
                const existingTicket = interaction.guild.channels.cache.find(
                    channel => channel.name === `ticket-${interaction.user.username}` && channel.type === ChannelType.GuildText
                );

                if (existingTicket) {
                    return interaction.reply({ 
                        content: `❌ Você já tem um ticket aberto: ${existingTicket}\n\nPor favor, finalize seu ticket atual antes de abrir um novo.`, 
                        ephemeral: true 
                    });
                }

                const ticketChannel = await createTicketChannel(interaction.guild, interaction.user, serviceNames[serviceType]);
                
                if (ticketChannel) {
                    await interaction.reply({ 
                        content: `✅ Ticket criado com sucesso!\n\n🎫 Acesse seu ticket: ${ticketChannel}\n\nDescreva detalhadamente o que você precisa e nossa equipe responderá em breve!`, 
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ content: '❌ Erro ao criar ticket. Tente novamente.', ephemeral: true });
                }
            }

            else if (customId === 'close_ticket') {
                if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) && 
                    !interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID)) {
                    return interaction.reply({ content: '❌ Você não tem permissão para fechar tickets!', ephemeral: true });
                }

                const confirmEmbed = new EmbedBuilder()
                    .setTitle('🔒 Confirmar Fechamento do Ticket')
                    .setDescription('Tem certeza que deseja fechar este ticket?\n\n⚠️ **Esta ação não pode ser desfeita!**\n\nO canal será deletado permanentemente.')
                    .setColor('#ff0000')
                    .setTimestamp();

                const confirmButtons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId('confirm_close').setLabel('✅ Sim, fechar').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('cancel_close').setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary)
                    );

                await interaction.reply({ embeds: [confirmEmbed], components: [confirmButtons], ephemeral: true });
            }

            else if (customId === 'confirm_close') {
                await sendLog(interaction.guild, `🔒 Ticket ${interaction.channel.name} fechado por ${interaction.user.tag}`, 'warning');
                
                const closingEmbed = new EmbedBuilder()
                    .setTitle('🔒 Fechando Ticket')
                    .setDescription('Este ticket será fechado em **5 segundos**...\n\nObrigado por usar nossos serviços!')
                    .setColor('#ff6b6b')
                    .setTimestamp()
                    .setFooter({ text: 'Pixel & Code' });

                await interaction.update({ embeds: [closingEmbed], components: [] });
                
                setTimeout(async () => {
                    try {
                        await interaction.channel.delete();
                    } catch (error) {
                        console.error('Erro ao deletar canal:', error);
                    }
                }, 5000);
            }

            else if (customId === 'cancel_close') {
                await interaction.update({ 
                    content: '✅ Fechamento cancelado. O ticket permanece aberto.', 
                    embeds: [], 
                    components: [] 
                });
            }
        }
    } catch (error) {
        console.error('Erro na interação:', error);
        try {
            const errorMessage = '❌ Ocorreu um erro. Tente novamente ou contate um administrador.';
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (replyError) {
            console.error('Erro ao responder:', replyError);
        }
    }
});

// Events de logs
client.on('guildMemberAdd', async member => {
    await sendLog(member.guild, `📥 **${member.user.tag}** entrou no servidor`, 'success');
});

client.on('guildMemberRemove', async member => {
    await sendLog(member.guild, `📤 **${member.user.tag}** saiu do servidor`, 'warning');
});

client.on('channelCreate', async channel => {
    if (channel.guild && channel.name.startsWith('ticket-')) {
        await sendLog(channel.guild, `🎫 Canal de ticket **${channel.name}** foi criado`, 'info');
    }
});

client.on('channelDelete', async channel => {
    if (channel.guild && channel.name.startsWith('ticket-')) {
        await sendLog(channel.guild, `🗑️ Canal de ticket **${channel.name}** foi deletado`, 'warning');
    }
});

// Tratamento de erros
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

// Login
client.login(process.env.DISCORD_TOKEN);
