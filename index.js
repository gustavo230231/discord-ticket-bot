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
    },
    shop: {
        channelId: null, // Canal da loja
        deliveryChannelId: null, // Canal de entrega de códigos
        enabled: false,
        paymentMethods: {
            paypal: 'pagamentos@pixelcode.com', // Email PayPal
            mbway: '+351 912 345 678' // Número MBWay
        }
    }
};

// Sistema de loja - produtos disponíveis
const shopProducts = {
    'discord_bot': {
        name: '🤖 Bot Discord Personalizado',
        description: 'Bot Discord completo com sistema de tickets, moderação e comandos personalizados',
        price: 25.00,
        currency: 'EUR',
        deliveryType: 'code', // 'code', 'role', 'channel'
        deliveryContent: 'Seu bot Discord foi criado! Código de acesso: BOT-{RANDOM}',
        channelAccess: null // ID do canal para dar acesso
    },
    'website': {
        name: '🌐 Website Profissional',
        description: 'Website responsivo e moderno para sua empresa ou projeto pessoal',
        price: 50.00,
        currency: 'EUR',
        deliveryType: 'code',
        deliveryContent: 'Seu website está pronto! Link e credenciais: WEB-{RANDOM}',
        channelAccess: null
    },
    'logo_design': {
        name: '🎨 Logo Profissional',
        description: 'Logo personalizado para sua marca com múltiplas variações e formatos',
        price: 15.00,
        currency: 'EUR',
        deliveryType: 'code',
        deliveryContent: 'Seu logo foi criado! Download: LOGO-{RANDOM}',
        channelAccess: null
    },
    'video_edit': {
        name: '🎬 Edição de Vídeo',
        description: 'Edição profissional de vídeo até 10 minutos com efeitos e transições',
        price: 30.00,
        currency: 'EUR',
        deliveryType: 'code',
        deliveryContent: 'Seu vídeo foi editado! Download: VIDEO-{RANDOM}',
        channelAccess: null
    },
    'premium_access': {
        name: '⭐ Acesso Premium',
        description: 'Acesso ao canal premium com conteúdo exclusivo e suporte prioritário',
        price: 10.00,
        currency: 'EUR',
        deliveryType: 'channel',
        deliveryContent: 'Bem-vindo ao Premium! Você agora tem acesso ao canal exclusivo.',
        channelAccess: null // Será configurado depois
    }
};

// Armazenar pedidos pendentes
const pendingOrders = new Map();

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
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('setup-loja')
        .setDescription('Criar painel da loja automática')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('config-loja')
        .setDescription('Configurar sistema de loja')
        .addChannelOption(option =>
            option.setName('canal-loja')
                .setDescription('Canal onde será exibida a loja')
                .setRequired(false))
        .addChannelOption(option =>
            option.setName('canal-entrega')
                .setDescription('Canal onde serão entregues os códigos')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('paypal')
                .setDescription('Email do PayPal para receber pagamentos')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('mbway')
                .setDescription('Número MBWay para receber pagamentos')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('ativar')
                .setDescription('Ativar ou desativar loja')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    new SlashCommandBuilder()
        .setName('config-produto')
        .setDescription('Configurar um produto da loja')
        .addStringOption(option =>
            option.setName('produto')
                .setDescription('ID do produto')
                .setRequired(true)
                .addChoices(
                    { name: 'Bot Discord', value: 'discord_bot' },
                    { name: 'Website', value: 'website' },
                    { name: 'Logo Design', value: 'logo_design' },
                    { name: 'Edição de Vídeo', value: 'video_edit' },
                    { name: 'Acesso Premium', value: 'premium_access' }
                ))
        .addNumberOption(option =>
            option.setName('preco')
                .setDescription('Preço do produto em EUR')
                .setRequired(false))
        .addChannelOption(option =>
            option.setName('canal-acesso')
                .setDescription('Canal para dar acesso (apenas para produtos de acesso)')
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
        
        else if (interaction.commandName === 'setup-loja') {
            const embed = new EmbedBuilder()
                .setTitle('🛒 Loja Automática - Pixel & Code')
                .setDescription(`Bem-vindo à nossa loja automática! 🎉

Aqui você pode comprar nossos produtos digitais com pagamento instantâneo e entrega automática.

💳 **Métodos de Pagamento:**
💙 **PayPal** - Pagamento internacional seguro
📱 **MBWay** - Pagamento instantâneo (Portugal)

🔄 **Como funciona:**
1️⃣ Escolha o produto desejado
2️⃣ Clique em "Comprar"
3️⃣ Escolha PayPal ou MBWay
4️⃣ Faça o pagamento
5️⃣ Confirme o pagamento
6️⃣ Receba seu código/acesso automaticamente

🔒 **Seguro e Confiável**
✅ Pagamento seguro
✅ Entrega instantânea
✅ Suporte 24/7`)
                .setColor('#00ff00')
                .setFooter({ text: 'Loja Automática - Pixel & Code' });

            // Criar botões para cada produto
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('buy_discord_bot')
                        .setLabel('🤖 Bot Discord - €25')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('buy_website')
                        .setLabel('� Website - €50')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('buy_logo_design')
                        .setLabel('🎨 Logo - €15')
                        .setStyle(ButtonStyle.Secondary)
                );

            const row2 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('buy_video_edit')
                        .setLabel('🎬 Edição Vídeo - €30')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('buy_premium_access')
                        .setLabel('⭐ Premium - €10')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ embeds: [embed], components: [row1, row2] });
        }
        
        else if (interaction.commandName === 'config-loja') {
            const canalLoja = interaction.options.getChannel('canal-loja');
            const canalEntrega = interaction.options.getChannel('canal-entrega');
            const paypal = interaction.options.getString('paypal');
            const mbway = interaction.options.getString('mbway');
            const ativar = interaction.options.getBoolean('ativar');

            if (canalLoja) botConfig.shop.channelId = canalLoja.id;
            if (canalEntrega) botConfig.shop.deliveryChannelId = canalEntrega.id;
            if (paypal) botConfig.shop.paymentMethods.paypal = paypal;
            if (mbway) botConfig.shop.paymentMethods.mbway = mbway;
            if (ativar !== null) botConfig.shop.enabled = ativar;

            const embed = new EmbedBuilder()
                .setTitle('🛒 Loja Configurada')
                .setDescription('Sistema de loja foi atualizado com sucesso!')
                .setColor('#00ff00')
                .addFields(
                    { name: 'Status', value: botConfig.shop.enabled ? '✅ Ativado' : '❌ Desativado', inline: true },
                    { name: 'Canal Loja', value: botConfig.shop.channelId ? `<#${botConfig.shop.channelId}>` : 'Não configurado', inline: true },
                    { name: 'Canal Entrega', value: botConfig.shop.deliveryChannelId ? `<#${botConfig.shop.deliveryChannelId}>` : 'Não configurado', inline: true },
                    { name: '💙 PayPal', value: botConfig.shop.paymentMethods.paypal, inline: true },
                    { name: '📱 MBWay', value: botConfig.shop.paymentMethods.mbway, inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        else if (interaction.commandName === 'config-produto') {
            const produto = interaction.options.getString('produto');
            const preco = interaction.options.getNumber('preco');
            const canalAcesso = interaction.options.getChannel('canal-acesso');

            if (preco) shopProducts[produto].price = preco;
            if (canalAcesso) shopProducts[produto].channelAccess = canalAcesso.id;

            const embed = new EmbedBuilder()
                .setTitle('🛍️ Produto Configurado')
                .setDescription(`Produto **${shopProducts[produto].name}** foi atualizado!`)
                .setColor('#00ff00')
                .addFields(
                    { name: 'Produto', value: shopProducts[produto].name, inline: true },
                    { name: 'Preço', value: `€${shopProducts[produto].price}`, inline: true },
                    { name: 'Canal Acesso', value: shopProducts[produto].channelAccess ? `<#${shopProducts[produto].channelAccess}>` : 'Não configurado', inline: true }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        return;
    }
    
    // Botões
    if (!interaction.isButton()) return;

    console.log(`Botão clicado: ${interaction.customId}`); // Debug

    // Sistema de compras
    if (interaction.customId.startsWith('buy_')) {
        const productId = interaction.customId.replace('buy_', '');
        await handlePurchase(interaction, productId);
        return;
    }

    // Pagamento PayPal
    if (interaction.customId.startsWith('pay_paypal_')) {
        const orderId = interaction.customId.replace('pay_paypal_', '');
        await showPayPalInstructions(interaction, orderId);
        return;
    }

    // Pagamento MBWay
    if (interaction.customId.startsWith('pay_mbway_')) {
        const orderId = interaction.customId.replace('pay_mbway_', '');
        await showMBWayInstructions(interaction, orderId);
        return;
    }

    // Confirmação de pagamento
    if (interaction.customId.startsWith('confirm_payment_')) {
        const orderId = interaction.customId.replace('confirm_payment_', '');
        await confirmPayment(interaction, orderId);
        return;
    }

    // Cancelar pedido
    if (interaction.customId.startsWith('cancel_order_')) {
        const orderId = interaction.customId.replace('cancel_order_', '');
        await cancelOrder(interaction, orderId);
        return;
    }

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

// Função para gerar código aleatório
function generateRandomCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Função para mostrar instruções PayPal
async function showPayPalInstructions(interaction, orderId) {
    const order = pendingOrders.get(orderId);
    if (!order) {
        return interaction.reply({ content: '❌ Pedido não encontrado!', ephemeral: true });
    }

    const product = shopProducts[order.productId];

    const embed = new EmbedBuilder()
        .setTitle('💙 Pagamento via PayPal')
        .setDescription(`**Produto:** ${product.name}\n**Valor:** €${product.price}`)
        .setColor('#0070ba')
        .addFields(
            { name: '📧 Email PayPal', value: botConfig.shop.paymentMethods.paypal, inline: false },
            { name: '💰 Valor a Enviar', value: `€${product.price}`, inline: true },
            { name: '🆔 Referência', value: orderId, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '📋 Instruções:', value: 
                `1️⃣ Abra o PayPal ou acesse paypal.com\n` +
                `2️⃣ Clique em "Enviar Dinheiro"\n` +
                `3️⃣ Digite o email: **${botConfig.shop.paymentMethods.paypal}**\n` +
                `4️⃣ Valor: **€${product.price}**\n` +
                `5️⃣ Na descrição, coloque: **${orderId}**\n` +
                `6️⃣ Confirme o pagamento\n` +
                `7️⃣ Clique em "Confirmar Pagamento" abaixo`
            }
        )
        .setFooter({ text: '⚠️ Importante: Inclua a referência na descrição do pagamento!' });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_payment_${orderId}`)
                .setLabel('✅ Confirmar Pagamento')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_order_${orderId}`)
                .setLabel('❌ Cancelar')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.update({ embeds: [embed], components: [buttons] });
}

// Função para mostrar instruções MBWay
async function showMBWayInstructions(interaction, orderId) {
    const order = pendingOrders.get(orderId);
    if (!order) {
        return interaction.reply({ content: '❌ Pedido não encontrado!', ephemeral: true });
    }

    const product = shopProducts[order.productId];

    const embed = new EmbedBuilder()
        .setTitle('📱 Pagamento via MBWay')
        .setDescription(`**Produto:** ${product.name}\n**Valor:** €${product.price}`)
        .setColor('#e20074')
        .addFields(
            { name: '📱 Número MBWay', value: botConfig.shop.paymentMethods.mbway, inline: false },
            { name: '💰 Valor a Enviar', value: `€${product.price}`, inline: true },
            { name: '🆔 Referência', value: orderId, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '📋 Instruções:', value: 
                `1️⃣ Abra a app do seu banco\n` +
                `2️⃣ Selecione "MBWay" → "Enviar Dinheiro"\n` +
                `3️⃣ Digite o número: **${botConfig.shop.paymentMethods.mbway}**\n` +
                `4️⃣ Valor: **€${product.price}**\n` +
                `5️⃣ Na descrição, coloque: **${orderId}**\n` +
                `6️⃣ Confirme com o PIN MBWay\n` +
                `7️⃣ Clique em "Confirmar Pagamento" abaixo`
            }
        )
        .setFooter({ text: '⚠️ Importante: Inclua a referência na descrição do pagamento!' });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_payment_${orderId}`)
                .setLabel('✅ Confirmar Pagamento')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_order_${orderId}`)
                .setLabel('❌ Cancelar')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.update({ embeds: [embed], components: [buttons] });
}

// Função para processar compra
async function handlePurchase(interaction, productId) {
    const product = shopProducts[productId];
    if (!product) {
        return interaction.reply({ content: '❌ Produto não encontrado!', ephemeral: true });
    }

    const orderId = `ORDER_${Date.now()}_${generateRandomCode()}`;
    const member = interaction.member;

    // Armazenar pedido pendente
    pendingOrders.set(orderId, {
        productId,
        userId: member.id,
        username: member.user.username,
        timestamp: Date.now(),
        status: 'pending'
    });

    const embed = new EmbedBuilder()
        .setTitle('🛒 Escolha o Método de Pagamento')
        .setDescription(`Você está prestes a comprar:\n\n**${product.name}**\n${product.description}`)
        .setColor('#ffaa00')
        .addFields(
            { name: '💰 Preço', value: `€${product.price}`, inline: true },
            { name: '🆔 Pedido', value: orderId, inline: true },
            { name: '📦 Entrega', value: 'Automática após pagamento', inline: true }
        )
        .setFooter({ text: 'Escolha seu método de pagamento preferido' });

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`pay_paypal_${orderId}`)
                .setLabel('💙 Pagar com PayPal')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`pay_mbway_${orderId}`)
                .setLabel('📱 Pagar com MBWay')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_order_${orderId}`)
                .setLabel('❌ Cancelar')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });

    // Log da compra iniciada
    await sendLog(
        'PURCHASE_INITIATED',
        '🛒 Compra Iniciada',
        `${member.user} iniciou compra de **${product.name}**`,
        '#ffaa00',
        [
            { name: '👤 Cliente', value: `${member.user.tag}`, inline: true },
            { name: '🛍️ Produto', value: product.name, inline: true },
            { name: '� Valor', value: `€${product.price}`, inline: true },
            { name: '🆔 Pedido', value: orderId, inline: false }
        ]
    );
}

// Função para confirmar pagamento (simulado)
async function confirmPayment(interaction, orderId) {
    const order = pendingOrders.get(orderId);
    if (!order) {
        return interaction.reply({ content: '❌ Pedido não encontrado!', ephemeral: true });
    }

    if (order.userId !== interaction.user.id) {
        return interaction.reply({ content: '❌ Este não é seu pedido!', ephemeral: true });
    }

    const product = shopProducts[order.productId];
    
    // Simular verificação de pagamento (em produção, integrar com API real)
    const paymentConfirmed = true; // Aqui você integraria com API de pagamento real

    if (paymentConfirmed) {
        // Marcar como pago
        order.status = 'paid';
        pendingOrders.set(orderId, order);

        // Processar entrega
        await processDelivery(interaction, order, product);
        
        // Remover pedido da lista
        pendingOrders.delete(orderId);
    } else {
        await interaction.reply({ 
            content: '❌ Pagamento não confirmado. Verifique se incluiu a referência correta.', 
            ephemeral: true 
        });
    }
}

// Função para processar entrega
async function processDelivery(interaction, order, product) {
    const member = interaction.member;
    const guild = interaction.guild;
    const randomCode = generateRandomCode();
    
    let deliveryMessage = product.deliveryContent.replace('{RANDOM}', randomCode);
    
    // Processar diferentes tipos de entrega
    if (product.deliveryType === 'channel' && product.channelAccess) {
        // Dar acesso ao canal
        const channel = guild.channels.cache.get(product.channelAccess);
        if (channel) {
            await channel.permissionOverwrites.create(member.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            deliveryMessage += `\n\n🔓 Você agora tem acesso ao canal <#${product.channelAccess}>!`;
        }
    }

    // Enviar código/acesso por DM
    try {
        const dmEmbed = new EmbedBuilder()
            .setTitle('🎉 Compra Confirmada!')
            .setDescription(`Obrigado pela sua compra!\n\n**Produto:** ${product.name}\n\n**Entrega:**\n${deliveryMessage}`)
            .setColor('#00ff00')
            .setTimestamp()
            .setFooter({ text: 'Pixel & Code - Obrigado pela preferência!' });

        await member.send({ embeds: [dmEmbed] });
    } catch (error) {
        console.log('Não foi possível enviar DM, enviando no canal de entrega');
    }

    // Enviar também no canal de entrega se configurado
    if (botConfig.shop.deliveryChannelId) {
        const deliveryChannel = guild.channels.cache.get(botConfig.shop.deliveryChannelId);
        if (deliveryChannel) {
            const publicEmbed = new EmbedBuilder()
                .setTitle('📦 Entrega Realizada')
                .setDescription(`${member} recebeu: **${product.name}**`)
                .setColor('#00ff00')
                .setTimestamp();

            await deliveryChannel.send({ embeds: [publicEmbed] });
        }
    }

    // Responder à interação
    await interaction.reply({ 
        content: '✅ Pagamento confirmado! Verifique sua DM para receber o produto.', 
        ephemeral: true 
    });

    // Log da venda concluída
    await sendLog(
        'SALE_COMPLETED',
        '💰 Venda Concluída',
        `Venda de **${product.name}** para ${member.user} foi concluída`,
        '#00ff00',
        [
            { name: '👤 Cliente', value: `${member.user.tag}`, inline: true },
            { name: '🛍️ Produto', value: product.name, inline: true },
            { name: '💰 Valor', value: `€${product.price}`, inline: true },
            { name: '🎁 Código', value: randomCode, inline: true }
        ]
    );
}

// Função para cancelar pedido
async function cancelOrder(interaction, orderId) {
    const order = pendingOrders.get(orderId);
    if (!order) {
        return interaction.reply({ content: '❌ Pedido não encontrado!', ephemeral: true });
    }

    if (order.userId !== interaction.user.id) {
        return interaction.reply({ content: '❌ Este não é seu pedido!', ephemeral: true });
    }

    pendingOrders.delete(orderId);
    await interaction.reply({ content: '✅ Pedido cancelado com sucesso!', ephemeral: true });
}

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
