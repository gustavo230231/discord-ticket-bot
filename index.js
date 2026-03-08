const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, SlashCommandBuilder, REST, Routes } = require('discord.js');
const http = require('http');
require('dotenv').config();

// Criar servidor HTTP simples para o Render
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Discord Bot is running!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
});

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Armazenar tickets ativos e contadores
const activeTickets = new Map();
const ticketCounters = {
    comprar: 0,
    design: 0,
    edicao: 0,
    programacao: 0
};

// Configurações personalizáveis
const botConfig = {
    embed: {
        title: 'Pixel & Code',
        description: `Olá! 👋 Bem-vindo(a) ao Pixel & Code.
Aqui você pode abrir um ticket para solicitar nossos serviços digitais:

🔹 **Serviços disponíveis:**
🎬 Edição de Vídeos
🎨 Design & Posters  
💻 Códigos de Programação

🔹 **Como abrir um ticket:**
1️⃣ Clique no botão "Abrir Ticket" abaixo (ou reaja com 🎫)
2️⃣ Escolha o tipo de serviço que deseja
3️⃣ Aguarde nossa equipe responder para confirmar detalhes e pagamento

⚡ **Dicas:**

Informe todas as referências, links ou exemplos para facilitar o serviço

Seja claro(a) sobre prazos e revisões

Apenas o dono do ticket e a equipe poderão ver as mensagens neste canal

✅ Após abrir o ticket, você será guiado(a) passo a passo até receber o seu pedido!`,
        color: '#5865F2',
        footer: 'Powered by Ticket King'
    },
    buttons: {
        comprar: { label: '🛒 Comprar', style: 'Primary', emoji: '🛒' },
        design: { label: '🎨 Design', style: 'Success', emoji: '🎨' },
        edicao: { label: '🎬 Edição', style: 'Danger', emoji: '🎬' },
        programacao: { label: '💻 Programação', style: 'Secondary', emoji: '💻' }
    },
    logs: {
        channelId: null, // ID do canal de logs
        enabled: false
    }
};

// Registrar slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Criar painel de tickets')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('config-embed')
        .setDescription('Configurar o embed do painel de tickets')
        .addStringOption(option =>
            option.setName('titulo')
                .setDescription('Título do embed')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('descricao')
                .setDescription('Descrição do embed')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('cor')
                .setDescription('Cor do embed (hex: #5865F2)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('rodape')
                .setDescription('Texto do rodapé')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('config-botao')
        .setDescription('Configurar um botão específico')
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo do botão')
                .setRequired(true)
                .addChoices(
                    { name: 'Comprar', value: 'comprar' },
                    { name: 'Design', value: 'design' },
                    { name: 'Edição', value: 'edicao' },
                    { name: 'Programação', value: 'programacao' }
                ))
        .addStringOption(option =>
            option.setName('texto')
                .setDescription('Texto do botão')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('Emoji do botão')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('cor')
                .setDescription('Cor do botão')
                .setRequired(false)
                .addChoices(
                    { name: 'Azul', value: 'Primary' },
                    { name: 'Verde', value: 'Success' },
                    { name: 'Vermelho', value: 'Danger' },
                    { name: 'Cinza', value: 'Secondary' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('ver-config')
        .setDescription('Ver configurações atuais do bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('config-logs')
        .setDescription('Configurar sistema de logs')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal onde serão enviados os logs')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('ativar')
                .setDescription('Ativar ou desativar logs')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`✅ Bot conectado como ${client.user.tag}`);
    
    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('✅ Slash commands registrados!');
    } catch (error) {
        console.error('Erro ao registrar commands:', error);
    }
});

// Função para enviar logs
async function sendLog(type, title, description, color, fields = []) {
    if (!botConfig.logs.enabled || !botConfig.logs.channelId) return;
    
    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const logChannel = guild.channels.cache.get(botConfig.logs.channelId);
        
        if (!logChannel) return;
        
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp()
            .setFooter({ text: `Tipo: ${type}` });
            
        if (fields.length > 0) {
            embed.addFields(fields);
        }
        
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Erro ao enviar log:', error);
    }
}

// Eventos de entrada e saída de membros
client.on('guildMemberAdd', async (member) => {
    const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));
    
    await sendLog(
        'MEMBER_JOIN',
        '📥 Membro Entrou',
        `${member.user} entrou no servidor`,
        '#00ff00',
        [
            { name: '👤 Usuário', value: `${member.user.tag}`, inline: true },
            { name: '🆔 ID', value: member.user.id, inline: true },
            { name: '📅 Conta Criada', value: `${accountAge} dias atrás`, inline: true },
            { name: '⏰ Entrou em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        ]
    );
});

client.on('guildMemberRemove', async (member) => {
    const joinedAt = member.joinedTimestamp ? Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24)) : 'Desconhecido';
    
    await sendLog(
        'MEMBER_LEAVE',
        '📤 Membro Saiu',
        `${member.user} saiu do servidor`,
        '#ff0000',
        [
            { name: '👤 Usuário', value: `${member.user.tag}`, inline: true },
            { name: '🆔 ID', value: member.user.id, inline: true },
            { name: '⏱️ Tempo no Servidor', value: `${joinedAt} dias`, inline: true },
            { name: '⏰ Saiu em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        ]
    );
});

// Eventos de canais (criação/exclusão)
client.on('channelCreate', async (channel) => {
    if (channel.guild.id !== process.env.GUILD_ID) return;
    
    await sendLog(
        'CHANNEL_CREATE',
        '🆕 Canal Criado',
        `Canal ${channel} foi criado`,
        '#00ffff',
        [
            { name: '📝 Nome', value: channel.name, inline: true },
            { name: '🏷️ Tipo', value: channel.type.toString(), inline: true },
            { name: '🆔 ID', value: channel.id, inline: true }
        ]
    );
});

client.on('channelDelete', async (channel) => {
    if (channel.guild.id !== process.env.GUILD_ID) return;
    
    await sendLog(
        'CHANNEL_DELETE',
        '🗑️ Canal Deletado',
        `Canal **${channel.name}** foi deletado`,
        '#ff6600',
        [
            { name: '📝 Nome', value: channel.name, inline: true },
            { name: '🏷️ Tipo', value: channel.type.toString(), inline: true },
            { name: '🆔 ID', value: channel.id, inline: true }
        ]
    );
});

// Interações com botões e comandos
client.on('interactionCreate', async (interaction) => {
    // Slash commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-tickets') {
            const embed = new EmbedBuilder()
                .setTitle(botConfig.embed.title)
                .setDescription(botConfig.embed.description)
                .setColor(botConfig.embed.color)
                .setFooter({ text: botConfig.embed.footer });

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_comprar')
                        .setLabel(botConfig.buttons.comprar.label)
                        .setStyle(ButtonStyle[botConfig.buttons.comprar.style]),
                    new ButtonBuilder()
                        .setCustomId('ticket_design')
                        .setLabel(botConfig.buttons.design.label)
                        .setStyle(ButtonStyle[botConfig.buttons.design.style]),
                    new ButtonBuilder()
                        .setCustomId('ticket_edicao')
                        .setLabel(botConfig.buttons.edicao.label)
                        .setStyle(ButtonStyle[botConfig.buttons.edicao.style]),
                    new ButtonBuilder()
                        .setCustomId('ticket_programacao')
                        .setLabel(botConfig.buttons.programacao.label)
                        .setStyle(ButtonStyle[botConfig.buttons.programacao.style])
                );

            await interaction.reply({ embeds: [embed], components: [row1] });
        }
        
        else if (interaction.commandName === 'config-embed') {
            const titulo = interaction.options.getString('titulo');
            const descricao = interaction.options.getString('descricao');
            const cor = interaction.options.getString('cor');
            const rodape = interaction.options.getString('rodape');

            if (titulo) botConfig.embed.title = titulo;
            if (descricao) botConfig.embed.description = descricao;
            if (cor) botConfig.embed.color = cor;
            if (rodape) botConfig.embed.footer = rodape;

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Configuração Atualizada')
                .setDescription('Configurações do embed foram atualizadas com sucesso!')
                .setColor('#00ff00')
                .addFields(
                    { name: 'Título', value: botConfig.embed.title, inline: true },
                    { name: 'Cor', value: botConfig.embed.color, inline: true },
                    { name: 'Rodapé', value: botConfig.embed.footer, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (interaction.commandName === 'config-botao') {
            const tipo = interaction.options.getString('tipo');
            const texto = interaction.options.getString('texto');
            const emoji = interaction.options.getString('emoji');
            const cor = interaction.options.getString('cor');

            if (texto) botConfig.buttons[tipo].label = `${emoji || botConfig.buttons[tipo].emoji} ${texto}`;
            if (emoji) botConfig.buttons[tipo].emoji = emoji;
            if (cor) botConfig.buttons[tipo].style = cor;

            const embed = new EmbedBuilder()
                .setTitle('🔘 Botão Atualizado')
                .setDescription(`Botão **${tipo}** foi atualizado com sucesso!`)
                .setColor('#00ff00')
                .addFields(
                    { name: 'Tipo', value: tipo, inline: true },
                    { name: 'Texto', value: botConfig.buttons[tipo].label, inline: true },
                    { name: 'Cor', value: botConfig.buttons[tipo].style, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (interaction.commandName === 'ver-config') {
            const embed = new EmbedBuilder()
                .setTitle('⚙️ Configurações Atuais')
                .setDescription('Aqui estão as configurações atuais do bot:')
                .setColor('#5865F2')
                .addFields(
                    { name: '📝 Título do Embed', value: botConfig.embed.title, inline: false },
                    { name: '🎨 Cor do Embed', value: botConfig.embed.color, inline: true },
                    { name: '📄 Rodapé', value: botConfig.embed.footer, inline: true },
                    { name: '\u200B', value: '\u200B', inline: false },
                    { name: '🔘 Botões:', value: 
                        `**Comprar:** ${botConfig.buttons.comprar.label} (${botConfig.buttons.comprar.style})\n` +
                        `**Design:** ${botConfig.buttons.design.label} (${botConfig.buttons.design.style})\n` +
                        `**Edição:** ${botConfig.buttons.edicao.label} (${botConfig.buttons.edicao.style})\n` +
                        `**Programação:** ${botConfig.buttons.programacao.label} (${botConfig.buttons.programacao.style})`
                    },
                    { name: '📊 Sistema de Logs:', value: 
                        `**Status:** ${botConfig.logs.enabled ? '✅ Ativado' : '❌ Desativado'}\n` +
                        `**Canal:** ${botConfig.logs.channelId ? `<#${botConfig.logs.channelId}>` : 'Não configurado'}`
                    }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (interaction.commandName === 'config-logs') {
            const canal = interaction.options.getChannel('canal');
            const ativar = interaction.options.getBoolean('ativar');

            if (canal) botConfig.logs.channelId = canal.id;
            if (ativar !== null) botConfig.logs.enabled = ativar;

            const embed = new EmbedBuilder()
                .setTitle('📊 Logs Configurados')
                .setDescription('Sistema de logs foi atualizado com sucesso!')
                .setColor('#00ff00')
                .addFields(
                    { name: 'Status', value: botConfig.logs.enabled ? '✅ Ativado' : '❌ Desativado', inline: true },
                    { name: 'Canal', value: botConfig.logs.channelId ? `<#${botConfig.logs.channelId}>` : 'Não configurado', inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        return;
    }
    
    // Botões
    if (!interaction.isButton()) return;

    console.log(`Botão clicado: ${interaction.customId}`); // Debug

    // Diferentes tipos de tickets
    const ticketTypes = {
        'ticket_comprar': { name: 'comprar', displayName: 'Comprar', emoji: '🛒', color: '#5865F2' },
        'ticket_design': { name: 'design', displayName: 'Design', emoji: '🎨', color: '#57F287' },
        'ticket_edicao': { name: 'edicao', displayName: 'Edição', emoji: '🎬', color: '#ED4245' },
        'ticket_programacao': { name: 'programacao', displayName: 'Programação', emoji: '💻', color: '#99AAB5' }
    };

    if (ticketTypes[interaction.customId]) {
        await createTicket(interaction, ticketTypes[interaction.customId]);
    } else if (interaction.customId === 'close_ticket') {
        await closeTicket(interaction);
    }
});

async function createTicket(interaction, ticketType) {
    const guild = interaction.guild;
    const member = interaction.member;
    
    console.log(`Criando ticket tipo: ${ticketType.name} para ${member.user.username}`); // Debug
    
    // Verificar se o usuário já tem um ticket aberto
    const existingTicket = activeTickets.get(member.id);
    if (existingTicket) {
        return interaction.reply({ 
            content: `❌ Você já tem um ticket aberto: <#${existingTicket}>`, 
            ephemeral: true 
        });
    }

    try {
        // Incrementar contador para este tipo de ticket
        ticketCounters[ticketType.name]++;
        const ticketNumber = ticketCounters[ticketType.name];
        
        console.log(`Contador atual para ${ticketType.name}: ${ticketNumber}`); // Debug

        // Criar canal do ticket com numeração
        const channelName = `${ticketType.name}-${ticketNumber}`;
        
        const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: null, // Sem categoria por enquanto
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: member.id, // Usuário que abriu o ticket
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory
                    ]
                }
            ]
        });

        console.log(`Canal criado: ${ticketChannel.name} (ID: ${ticketChannel.id})`); // Debug

        // Adicionar ticket à lista de ativos
        activeTickets.set(member.id, ticketChannel.id);

        // Log de criação de ticket
        await sendLog(
            'TICKET_CREATE',
            '🎫 Ticket Criado',
            `${member.user} criou um ticket de **${ticketType.displayName}**`,
            ticketType.color,
            [
                { name: '👤 Usuário', value: `${member.user.tag}`, inline: true },
                { name: '🏷️ Tipo', value: ticketType.displayName, inline: true },
                { name: '📝 Canal', value: `<#${ticketChannel.id}>`, inline: true },
                { name: '🔢 Número', value: `#${ticketNumber}`, inline: true }
            ]
        );

        // Embed personalizado para cada tipo
        let description = '';
        switch(ticketType.name) {
            case 'comprar':
                description = `Olá ${member}! 👋\n\nVocê abriu um ticket para **compras**.\n\nPor favor, nos informe:\n• Que tipo de serviço deseja adquirir?\n• Qual seu orçamento?\n• Prazo desejado?\n\nNossa equipe responderá em breve!`;
                break;
            case 'design':
                description = `Olá ${member}! 🎨\n\nVocê abriu um ticket para **Design & Posters**.\n\nPor favor, nos informe:\n• Tipo de design (logo, poster, banner, etc.)\n• Estilo desejado\n• Referências ou exemplos\n• Dimensões necessárias\n\nNossa equipe responderá em breve!`;
                break;
            case 'edicao':
                description = `Olá ${member}! 🎬\n\nVocê abriu um ticket para **Edição de Vídeos**.\n\nPor favor, nos informe:\n• Tipo de vídeo (YouTube, TikTok, Instagram, etc.)\n• Duração aproximada\n• Estilo de edição desejado\n• Material disponível\n\nNossa equipe responderá em breve!`;
                break;
            case 'programacao':
                description = `Olá ${member}! 💻\n\nVocê abriu um ticket para **Programação**.\n\nPor favor, nos informe:\n• Tipo de projeto (website, bot, app, etc.)\n• Linguagens/tecnologias preferidas\n• Funcionalidades desejadas\n• Prazo e orçamento\n\nNossa equipe responderá em breve!`;
                break;
        }

        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`${ticketType.emoji} Ticket ${ticketType.displayName} #${ticketNumber}`)
            .setDescription(description)
            .setColor(ticketType.color)
            .setTimestamp()
            .setFooter({ text: 'Pixel & Code - Serviços Digitais' });

        const closeButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('🔒 Fechar Ticket')
                    .setStyle(ButtonStyle.Danger)
            );

        await ticketChannel.send({ 
            content: `${member} | <@&${process.env.STAFF_ROLE_ID}>`,
            embeds: [welcomeEmbed], 
            components: [closeButton] 
        });

        await interaction.reply({ 
            content: `✅ Ticket de **${ticketType.displayName} #${ticketNumber}** criado com sucesso! ${ticketType.emoji} <#${ticketChannel.id}>`, 
            ephemeral: true 
        });

        console.log(`Ticket criado com sucesso: ${channelName}`); // Debug

    } catch (error) {
        console.error('Erro detalhado ao criar ticket:', error);
        
        // Verificar permissões específicas
        const botMember = guild.members.cache.get(client.user.id);
        const hasManageChannels = botMember.permissions.has(PermissionFlagsBits.ManageChannels);
        const hasManageRoles = botMember.permissions.has(PermissionFlagsBits.ManageRoles);
        
        console.log(`Permissões do bot:`);
        console.log(`- Gerenciar Canais: ${hasManageChannels}`);
        console.log(`- Gerenciar Cargos: ${hasManageRoles}`);
        console.log(`- ID da Categoria: ${process.env.TICKET_CATEGORY_ID}`);
        console.log(`- ID do Staff: ${process.env.STAFF_ROLE_ID}`);
        
        await interaction.reply({ 
            content: `❌ Erro ao criar o ticket.\n\n**Debug:**\n• Gerenciar Canais: ${hasManageChannels}\n• Gerenciar Cargos: ${hasManageRoles}\n• Erro: ${error.message}`, 
            ephemeral: true 
        });
    }
}

async function closeTicket(interaction) {
    const channel = interaction.channel;
    const member = interaction.member;

    // Verificar se é um canal de ticket
    if (!channel.name.includes('-') || !['comprar', 'design', 'edicao', 'programacao'].some(type => channel.name.startsWith(type))) {
        return interaction.reply({ 
            content: '❌ Este comando só pode ser usado em canais de ticket.', 
            ephemeral: true 
        });
    }

    // Verificar permissões
    const hasStaffRole = member.roles.cache.has(process.env.STAFF_ROLE_ID);
    const isTicketOwner = activeTickets.get(member.id) === channel.id;

    if (!hasStaffRole && !isTicketOwner) {
        return interaction.reply({ 
            content: '❌ Você não tem permissão para fechar este ticket.', 
            ephemeral: true 
        });
    }

    try {
        const closeEmbed = new EmbedBuilder()
            .setTitle('🔒 Fechando Ticket')
            .setDescription('Este ticket será fechado em 5 segundos...')
            .setColor('#ff0000')
            .setTimestamp();

        await interaction.reply({ embeds: [closeEmbed] });

        // Remover da lista de tickets ativos
        for (const [userId, channelId] of activeTickets.entries()) {
            if (channelId === channel.id) {
                activeTickets.delete(userId);
                break;
            }
        }

        // Log de fechamento de ticket
        await sendLog(
            'TICKET_CLOSE',
            '🔒 Ticket Fechado',
            `Ticket **${channel.name}** foi fechado por ${member.user}`,
            '#ff0000',
            [
                { name: '👤 Fechado por', value: `${member.user.tag}`, inline: true },
                { name: '📝 Canal', value: channel.name, inline: true },
                { name: '⏰ Fechado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            ]
        );

        // Fechar canal após 5 segundos
        setTimeout(async () => {
            await channel.delete();
        }, 5000);

    } catch (error) {
        console.error('Erro ao fechar ticket:', error);
        await interaction.reply({ 
            content: '❌ Erro ao fechar o ticket.', 
            ephemeral: true 
        });
    }
}

client.login(process.env.DISCORD_TOKEN);
