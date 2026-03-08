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

// Registrar slash command
const commands = [
    new SlashCommandBuilder()
        .setName('setup-tickets')
        .setDescription('Criar painel de tickets')
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

// Interações com botões e comandos
client.on('interactionCreate', async (interaction) => {
    // Slash commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-tickets') {
            const embed = new EmbedBuilder()
                .setTitle('Pixel & Code')
                .setDescription(`Olá! 👋 Bem-vindo(a) ao Pixel & Code.
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

✅ Após abrir o ticket, você será guiado(a) passo a passo até receber o seu pedido!`)
                .setColor('#5865F2')
                .setFooter({ text: 'Powered by Ticket King' });

            const row1 = new ActionRowBuilder()
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

            await interaction.reply({ embeds: [embed], components: [row1] });
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