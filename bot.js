/// bot.js
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const axios = require("axios"); 
const FormData = require("form-data"); 
const fetch = require("node-fetch");
const path = require("path");
const { TOKEN, ADMIN_ID } = require("./config");

const bot = new TelegramBot(TOKEN, { polling: true });

// =============================
// Database
// =============================
const premiumDB = "./premium.json";
const tempPremiumDB = "./temp_premium.json";
const groupsDB = "./groups.json";
const channelsDB = "./channels.json"; // NEW
const groupInviterDB = "./group_inviter.json";
if (!fs.existsSync(groupInviterDB)) fs.writeFileSync(groupInviterDB, JSON.stringify([]));
const utangDB = "./utang.json";
if (!fs.existsSync(utangDB)) fs.writeFileSync(utangDB, JSON.stringify([]));
const payDB = "./pay.json";
if (!fs.existsSync(payDB)) fs.writeFileSync(payDB, JSON.stringify([]));
const blacklistDB = "./blacklist.json";
if (!fs.existsSync(blacklistDB)) fs.writeFileSync(blacklistDB, JSON.stringify([]));

function getBlacklist() {
  return JSON.parse(fs.readFileSync(blacklistDB));
}
function addBlacklist(groupId) {
  const data = getBlacklist();
  if (!data.includes(groupId)) {
    data.push(groupId);
    fs.writeFileSync(blacklistDB, JSON.stringify(data, null, 2));
  }
}
function isBlacklisted(groupId) {
  return getBlacklist().includes(groupId);
}

function getPay() {
  return JSON.parse(fs.readFileSync(payDB));
}
function savePay(data) {
  fs.writeFileSync(payDB, JSON.stringify(data, null, 2));
}

function getUtang() {
  return JSON.parse(fs.readFileSync(utangDB));
}
function saveUtang(data) {
  fs.writeFileSync(utangDB, JSON.stringify(data, null, 2));
}

function addGroupInviter(groupId, userId) {
  const data = JSON.parse(fs.readFileSync(groupInviterDB));
  if (!data.find(x => x.groupId === groupId)) {
    data.push({ groupId, userId });
    fs.writeFileSync(groupInviterDB, JSON.stringify(data, null, 2));
  }
}

function getGroupInviter(groupId) {
  const data = JSON.parse(fs.readFileSync(groupInviterDB));
  return data.find(x => x.groupId === groupId);
}

function removeGroupInviter(groupId) {
  let data = JSON.parse(fs.readFileSync(groupInviterDB));
  data = data.filter(x => x.groupId !== groupId);
  fs.writeFileSync(groupInviterDB, JSON.stringify(data, null, 2));
}

if (!fs.existsSync(channelsDB)) fs.writeFileSync(channelsDB, JSON.stringify([]));

function getChannels() {
  return JSON.parse(fs.readFileSync(channelsDB));
}
function addChannel(channelId) {
  const data = getChannels();
  if (!data.includes(channelId)) {
    data.push(channelId);
    fs.writeFileSync(channelsDB, JSON.stringify(data, null, 2));
  }
}
function removeChannel(channelId) {
  let data = getChannels();
  data = data.filter(id => id !== channelId);
  fs.writeFileSync(channelsDB, JSON.stringify(data, null, 2));
}

// buat file database jika belum ada
if (!fs.existsSync(premiumDB)) fs.writeFileSync(premiumDB, JSON.stringify([]));
if (!fs.existsSync(tempPremiumDB)) fs.writeFileSync(tempPremiumDB, JSON.stringify([]));
if (!fs.existsSync(groupsDB)) fs.writeFileSync(groupsDB, JSON.stringify([]));

// helper database
function isPremium(userId) {
  const data = JSON.parse(fs.readFileSync(premiumDB));
  return data.includes(userId);
}
function addPremium(userId) {
  const data = JSON.parse(fs.readFileSync(premiumDB));
  if (!data.includes(userId)) {
    data.push(userId);
    fs.writeFileSync(premiumDB, JSON.stringify(data, null, 2));
  }
}
function removePremium(userId) {
  let data = JSON.parse(fs.readFileSync(premiumDB));
  data = data.filter(id => id !== userId);
  fs.writeFileSync(premiumDB, JSON.stringify(data, null, 2));
}
function addTempPremium(userId) {
  const data = JSON.parse(fs.readFileSync(tempPremiumDB));
  if (!data.find(x => x.userId === userId)) {
    data.push({ userId, addedAt: new Date().toISOString() });
    fs.writeFileSync(tempPremiumDB, JSON.stringify(data, null, 2));
  }
}
function addTempPremiumCustom(userId, durationSec) {
  const data = JSON.parse(fs.readFileSync(tempPremiumDB));
  const expireAt = new Date(Date.now() + durationSec * 1000).toISOString();
  if (!data.find(x => x.userId === userId)) {
    data.push({ userId, expireAt });
    fs.writeFileSync(tempPremiumDB, JSON.stringify(data, null, 2));
  }
}
// Update fungsi cek habis premium
async function checkTempPremium() {
  const data = JSON.parse(fs.readFileSync(tempPremiumDB));
  const now = new Date();
  for (const item of data) {
    if (item.expireAt && new Date(item.expireAt) <= now) {
      removeTempPremium(item.userId);
      removePremium(item.userId);
      bot.sendMessage(item.userId, "<blockquote>⚠️ Premium kamu sudah berakhir</blockquote>", { parse_mode: "HTML" });
    }
  }
}
function removeTempPremium(userId) {
  let data = JSON.parse(fs.readFileSync(tempPremiumDB));
  data = data.filter(x => x.userId !== userId);
  fs.writeFileSync(tempPremiumDB, JSON.stringify(data, null, 2));
}

function getGroups() {
  return JSON.parse(fs.readFileSync(groupsDB));
}
function addGroup(groupId) {
  const data = JSON.parse(fs.readFileSync(groupsDB));
  if (!data.includes(groupId)) {
    data.push(groupId);
    fs.writeFileSync(groupsDB, JSON.stringify(data, null, 2));
  }
}

// =============================
// Premium 1 hari check
// =============================
async function checkTempPremium() {
  const data = JSON.parse(fs.readFileSync(tempPremiumDB));
  const now = new Date();
  for (const item of data) {
    const added = new Date(item.addedAt);
    if ((now - added) / 1000 > 86400) {
      removeTempPremium(item.userId);
      removePremium(item.userId);
      bot.sendMessage(item.userId, "<blockquote>⚠️ Premium 1 hari kamu sudah berakhir</blockquote>", { parse_mode: "HTML" });
    }
  }
}
setInterval(checkTempPremium, 10 * 60 * 1000);

const esc = (v) => String(v ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  if (msg.new_chat_members) {
    const botInfo = await bot.getMe();
    for (const member of msg.new_chat_members) {
      if (member.id === botInfo.id) {
        const addedBy = msg.from.id;

        // ✅ cek blacklist
        if (isBlacklisted(chatId)) {
          bot.sendMessage(
            ADMIN_ID,
            `<blockquote>⚠️ BOT DITAMBAHKAN KEMBALI KE GRUP BLACKLIST</blockquote>
<blockquote>🆔 : <code>${esc(chatId)}</code></blockquote>
<blockquote>👥 : ${esc(msg.chat.title || "Unknown Group")}</blockquote>`,
            { parse_mode: "HTML" }
          );

          removePremium(addedBy);
          removeTempPremium(addedBy);
          removeGroupInviter(chatId);
          return; // stop
        }

        // ✅ ambil jumlah member grup
        const memberCount = await bot.getChatMemberCount(chatId);

        // Tentukan durasi premium berdasarkan memberCount
        let durationSec = 0;
        let label = "";
        if (memberCount >= 1 && memberCount <= 20) {
          durationSec = 2 * 60 * 60; // 2 jam
          label = "2 Jam";
        } else if (memberCount >= 50 && memberCount <= 100) {
          durationSec = 3 * 24 * 60 * 60; // 3 hari
          label = "3 Hari";
        } else if (memberCount >= 200) {
          durationSec = 5 * 24 * 60 * 60; // 5 hari
          label = "5 Hari";
        } else {
          durationSec = 24 * 60 * 60; // fallback 1 hari
          label = "1 Hari";
        }

        // === simpan data premium ===
        addPremium(addedBy);
        addTempPremiumCustom(addedBy, durationSec);

        addGroupInviter(chatId, addedBy);
        addGroup(chatId);

        // Notif ke user
        bot.sendMessage(
          addedBy,
          `<blockquote>🎉 Kamu mendapatkan akses Premium selama ${label} karena menambahkan bot ke grup</blockquote>`,
          { parse_mode: "HTML" }
        );

        // Info pengundang
        const inviter = msg.from;
        const userName = inviter.first_name + (inviter.last_name ? " " + inviter.last_name : "");
        const userMention = inviter.username ? `@${inviter.username}` : userName;

        // === Notif ke channel (detail) ===
        const premiumText = `🎉 PREMIUM AKTIF 🎉

👤 Pengguna : ${esc(userName)} (${esc(userMention)})
🆔 ID Pengguna : <code>${esc(addedBy)}</code>
🏡 Group : ${esc(msg.chat.title || "Unknown Group")}
🔗 Id Group : <code>${esc(chatId)}</code>
📊 Member Group : ${memberCount}
💎 Jenis Premium : Premium ${label}`;

        const CHANNEL_ID = -1003036935969; // ganti ID channel kamu
        bot.sendMessage(CHANNEL_ID, premiumText, { parse_mode: "HTML" }).catch(() => {});

        // === Notif ke admin utama (singkat seperti awal) ===
        const notifText =
          `<blockquote>GROUP BARU</blockquote>\n` +
          `<blockquote>🆔 : <code>${esc(chatId)}</code></blockquote>\n` +
          `<blockquote>👤 : ${esc(msg.chat.title || "Unknown Group")}</blockquote>`;

        bot.sendMessage(ADMIN_ID, notifText, { parse_mode: "HTML" }).catch(() => {});
      }
    }
  }
});

// =============================
// Bot ditambahkan / dihapus dari channel
// =============================
bot.on("my_chat_member", async (update) => {
  const chat = update.chat;
  const newStatus = update.new_chat_member.status;

  if (chat.type === "channel") {
    const channelId = chat.id;
    const channelName = chat.title || "Unknown Channel";

    if (newStatus === "administrator" || newStatus === "member") {
      // bot baru ditambahkan ke channel
      addChannel(channelId);

      const notifText = `<blockquote>📌 CHANNEL BARU TERDETEKSI</blockquote>
<blockquote>🆔 : <code>${channelId}</code></blockquote>
<blockquote>📢 : ${channelName}</blockquote>`;
      bot.sendMessage(ADMIN_ID, notifText, { parse_mode: "HTML" });
    } else if (newStatus === "kicked" || newStatus === "left") {
      // bot dihapus dari channel
      removeChannel(channelId);

      const notifText = `<blockquote>🚨 BOT DIHAPUS DARI CHANNEL</blockquote>
<blockquote>🆔 : <code>${channelId}</code></blockquote>
<blockquote>📢 : ${channelName}</blockquote>`;
      bot.sendMessage(ADMIN_ID, notifText, { parse_mode: "HTML" });
    }
  }
});

// =============================
// Bot dikeluarkan dari grup
// =============================
bot.on("my_chat_member", async (update) => {
  const chat = update.chat;
  const newStatus = update.new_chat_member.status;

  if (chat.type === "group" || chat.type === "supergroup") {
    // cek kalau bot dihapus
    if (newStatus === "kicked" || newStatus === "left") {
      const groupId = chat.id;
      const groupName = chat.title || "Unknown Group";

      // hapus dari groups.json
      let groups = getGroups();
      groups = groups.filter(id => id !== groupId);
      fs.writeFileSync(groupsDB, JSON.stringify(groups, null, 2));

      // ✅ tambahkan ke blacklist
      addBlacklist(groupId);

      // cabut premium user pengundang
      const inviter = getGroupInviter(groupId);
      if (inviter) {
        removePremium(inviter.userId);
        removeTempPremium(inviter.userId);
        removeGroupInviter(groupId);

        bot.sendMessage(
          inviter.userId,
          "<blockquote>⚠️ Premium kamu dicabut karena bot dikeluarkan dari grup.</blockquote>",
          { parse_mode: "HTML" }
        );
      }

      // notif admin
      const notifText = `<blockquote>🚨 BOT DIKELUARKAN DARI GRUP</blockquote>
<blockquote>🆔 : <code>${groupId}</code></blockquote>
<blockquote>👤 : ${groupName}</blockquote>`;
      bot.sendMessage(ADMIN_ID, notifText, { parse_mode: "HTML" });
    }
  }
});

// =============================
// Pesan sambutan
// =============================
const logoUrl = "https://files.catbox.moe/wwz9uq.jpg";

bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  const users = JSON.parse(fs.readFileSync(premiumDB)).length;
  const groups = getGroups().length;

  const buttons = [
    [
      { text: "𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁", url: "https://t.me/Jangansoasikdeh" },
      { text: "𝙲𝙷𝙰𝙽𝙽𝙴𝙻", url: "https://t.me/jasebfreedisini" }
    ],
    [
      { text: "+ 𝙰𝙳𝙳 𝚃𝙾 𝙼𝙴 𝙶𝚁𝙾𝚄𝙿", url: `https://t.me/${(await bot.getMe()).username}?startgroup=true` }
    ],
    [
      { text: "𝚅𝙴𝚁𝙸𝙵𝙸𝙴𝙳", callback_data: "verified" } // awal belum premium/admin
    ]
  ];

  bot.sendPhoto(chatId, logoUrl, {
    caption: `<blockquote>👋 Ola ${username} Selamat Datang Di Bot Jaseb Free</blockquote>
<blockquote>☐ 𝚅𝙴𝚁𝚂𝙸𝙾𝙽 : 𝟷.𝟶 𝚅𝙸𝙿
☐ 𝙰𝚄𝚃𝙷𝙾𝚁 : @Jangansoasikdeh</blockquote>
<blockquote>𝙳𝙰𝚃𝙰𝙱𝙰𝚂𝙴 </blockquote>
<blockquote>👤 𝚄𝚂𝙴𝚁 : ${users}
👥 𝙶𝚁𝙾𝚄𝙿 : ${groups}</blockquote>`,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons }
  });
});

// =============================
// Handler tombol VERIFIED & ALL MENU
// =============================
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;

  if (query.data === "verified") {
    if (isPremium(userId) || userId === ADMIN_ID) {
      const buttons = [
        [
          { text: "𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁", url: "https://t.me/Jangansoasikdeh" },
          { text: "𝙲𝙷𝙰𝙽𝙽𝙴𝙻", url: "https://t.me/jasebfreedisini" }
        ],
        [
          { text: "+ 𝙰𝙳𝙳 𝚃𝙾 𝙼𝙴 𝙶𝚁𝙾𝚄𝙿", url: `https://t.me/${(await bot.getMe()).username}?startgroup=true` }
        ],
        [
          { text: "𝙼𝙴𝙽𝚄 𝙹𝙰𝚂𝙷𝙴𝚁", callback_data: "all_menu" }
        ]
      ];

      await bot.editMessageReplyMarkup({ inline_keyboard: buttons }, {
        chat_id: chatId,
        message_id: query.message.message_id
      });

      bot.answerCallbackQuery(query.id, { text: "✅ Kamu sekarang bisa akses" });
    } else {
      bot.answerCallbackQuery(query.id, { text: "❌ Kamu belum terdaftar Premium" });
    }
  }

  if (query.data === "all_menu") {
    bot.deleteMessage(chatId, query.message.message_id);
    const buttons = [[{ text: "⬅ BACK", callback_data: "back" }]];

    bot.sendPhoto(chatId, logoUrl, {
      caption: `<blockquote>𝗙𝗜𝗧𝗨𝗥 𝗝𝗔𝗦𝗛𝗘𝗥 𝗠𝗘𝗡𝗨</blockquote>
<blockquote>/share -> 𝚂𝙷𝙰𝚁𝙴 𝙲𝙾𝙿𝚈 + 𝚂𝙴𝙱𝙰𝚁 
/share2 -> 𝚂𝙷𝙰𝚁𝙴 𝙵𝙾𝚁𝙴𝚆𝙳 + 𝚂𝙴𝙱𝙰𝚁
/setpesan -> 𝚂𝙴𝚃 𝙿𝙴𝚂𝙰𝙽 𝙰𝚄𝚃𝙾 𝙵𝙾𝚁𝚆𝙰𝚁𝙳
/auto on -> 𝙼𝚄𝙻𝙰𝙸 𝙰𝚄𝚃𝙾 𝙵𝙾𝚁𝚆𝙰𝚁𝙳
/auto off -> 𝙱𝙴𝚁𝙷𝙴𝙽𝚃𝙸 𝙰𝚄𝚃𝙾 𝙵𝙾𝚁𝚆𝙰𝚁𝙳
/auto status -> 𝚂𝚃𝙰𝚃𝚄𝚂 𝙰𝚄𝚃𝙾 𝙵𝙾𝚁𝚆𝙰𝚁𝙳
/bcuser -> 𝙵𝙾𝚁𝚆𝙴𝙳 𝙺𝙴 𝙿𝙴𝙽𝙶𝙶𝚄𝙽𝙰 BOT
/sharech -> 𝙵𝙾𝚁𝚆𝙴𝙳 𝙺𝙴 𝙲𝙷𝙰𝙽𝙴𝙻 𝚃𝙴𝙻𝙴𝙶𝚁𝙰𝙼
/tourl -> 𝙹𝙰𝙳𝙸𝙺𝙰𝙽 𝙵𝙾𝚃𝙾/𝚅𝙸𝙳𝙴𝙾 𝙹𝙰𝙳𝙸 𝙻𝙸𝙽𝙺
/copyweb -> 𝙲𝙾𝙿𝚈 𝙷𝚃𝙼𝙻 𝚆𝙴𝙱𝙸𝚂𝚃𝙴 𝚃𝙰𝚁𝙶𝙴𝚃</blockquote>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons }
    });
  }

  if (query.data === "back") {
    bot.deleteMessage(chatId, query.message.message_id);

    const username = query.from.username ? `@${query.from.username}` : query.from.first_name;
    const users = JSON.parse(fs.readFileSync(premiumDB)).length;
    const groups = getGroups().length;

    const buttons = [
      [
        { text: "𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁", url: "https://t.me/Jangansoasikdeh" },
        { text: "𝙲𝙷𝙰𝙽𝙽𝙴𝙻", url: "https://t.me/jasebfreedisini" }
      ],
      [
        { text: "+ 𝙰𝙳𝙳 𝚃𝙾 𝙼𝙴 𝙶𝚁𝙾𝚄𝙿", url: `https://t.me/${(await bot.getMe()).username}?startgroup=true` }
      ],
      [
        isPremium(userId) || userId === ADMIN_ID
          ? { text: "𝙼𝙴𝙽𝚄 𝙹𝙰𝚂𝙷𝙴𝚁", callback_data: "all_menu" }
          : { text: "𝚅𝙴𝚁𝙸𝙵𝙸𝙴𝙳", callback_data: "verified" }
      ]
    ];

    bot.sendPhoto(chatId, logoUrl, {
      caption: `<blockquote>👋 Ola ${username} Selamat Datang Di Bot Jaseb Free</blockquote>
<blockquote>☐ 𝚅𝙴𝚁𝚂𝙸𝙾𝙽 : 𝟷.𝟶 𝚅𝙸𝙿
☐ 𝙰𝚄𝚃𝙷𝙾𝚁 : @Jangansoasikdeh</blockquote>
<blockquote>𝙳𝙰𝚃𝙰𝙱𝙰𝚂𝙴 </blockquote>
<blockquote>👤 𝚄𝚂𝙴𝚁 : ${users}
👥 𝙶𝚁𝙾𝚄𝙿 : ${groups}</blockquote>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons }
    });
  }
});

// =============================
// Cooldown Map untuk /share
// =============================
const shareCooldown = new Map(); // NEW

// =============================
// Fitur /share (premium + admin)
// =============================
bot.onText(/^\/share$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!msg.reply_to_message) return bot.sendMessage(chatId, "⚠️ Reply pesan untuk /share");
  if (!(userId === ADMIN_ID || isPremium(userId))) return bot.sendMessage(chatId, "❌ Hanya Admin/Premium yang bisa pakai.");

  // === Cek cooldown (hanya untuk premium, bukan admin utama) ===
  if (userId !== ADMIN_ID && isPremium(userId)) { // NEW
    const lastUsed = shareCooldown.get(userId);
    const now = Date.now();
    if (lastUsed && now - lastUsed < 30000) { // 30 detik
      const waitSec = Math.ceil((30000 - (now - lastUsed)) / 1000);
      return bot.sendMessage(chatId, `⏳ Tunggu ${waitSec} detik sebelum menggunakan /share lagi.`);
    }
    shareCooldown.set(userId, now);
  }
  // ============================================================

  const GROUPS = getGroups();
  if (GROUPS.length === 0) return bot.sendMessage(chatId, "📭 Tidak ada grup tersimpan.");

  let success = 0, failed = 0;
  let progressMsg = await bot.sendMessage(chatId, `<blockquote>📤 Mengirim ke grup 0%\n▱▱▱▱▱▱▱▱▱▱</blockquote>`, { parse_mode: "HTML" });

  for (let i = 0; i < GROUPS.length; i++) {
    if (isBlacklisted(GROUPS[i])) continue; // ✅ skip grup blacklist
    try {
      if (msg.reply_to_message.text) {
        await bot.sendMessage(GROUPS[i], msg.reply_to_message.text);
      } else if (msg.reply_to_message.photo) {
        const photo = msg.reply_to_message.photo.pop().file_id;
        await bot.sendPhoto(GROUPS[i], photo, { caption: msg.reply_to_message.caption || "" });
      }
      success++;
    } catch { failed++; }

    const percent = Math.round(((i + 1) / GROUPS.length) * 100);
    if (percent % 5 === 0 || percent === 100) {
      const filled = Math.round(percent / 10);
      const bar = "▰".repeat(filled) + "▱".repeat(10 - filled);
      await bot.editMessageText(`<blockquote>📤 Mengirim ke grup ${percent}%\n${bar}</blockquote>`, {
        chat_id: chatId,
        message_id: progressMsg.message_id,
        parse_mode: "HTML"
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 300));
    }
  }

  await bot.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
  bot.sendMessage(chatId, `<blockquote>✅ Berhasil: ${success}</blockquote>
<blockquote>❌ Gagal: ${failed}</blockquote>
<blockquote>📊 Total: ${GROUPS.length}</blockquote>`, { parse_mode: "HTML" });
});

// =============================
// Fitur /share2 (admin utama)
// =============================
bot.onText(/^\/share2$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!msg.reply_to_message) return bot.sendMessage(chatId, "⚠️ Reply pesan untuk /share2");
  if (userId !== ADMIN_ID) return bot.sendMessage(chatId, "❌ Hanya Admin Utama yang bisa pakai.");

  const GROUPS = getGroups();
  if (GROUPS.length === 0) return bot.sendMessage(chatId, "📭 Tidak ada grup tersimpan.");

  let success = 0, failed = 0;
  let progressMsg = await bot.sendMessage(chatId, `<blockquote>📤 Forwarding ke grup 0%\n▱▱▱▱▱▱▱▱▱▱</blockquote>`, { parse_mode: "HTML" });

  for (let i = 0; i < GROUPS.length; i++) {
    if (isBlacklisted(GROUPS[i])) continue; // ✅ skip grup blacklist
    try {
      await bot.forwardMessage(GROUPS[i], chatId, msg.reply_to_message.message_id);
      success++;
    } catch { failed++; }

    const percent = Math.round(((i + 1) / GROUPS.length) * 100);
    if (percent % 5 === 0 || percent === 100) {
      const filled = Math.round(percent / 10);
      const bar = "▰".repeat(filled) + "▱".repeat(10 - filled);
      await bot.editMessageText(`<blockquote>📤 Forwarding ke grup ${percent}%\n${bar}</blockquote>`, {
        chat_id: chatId,
        message_id: progressMsg.message_id,
        parse_mode: "HTML"
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 300));
    }
  }

  await bot.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
  bot.sendMessage(chatId, `<blockquote>✅ Berhasil: ${success}</blockquote>
<blockquote>❌ Gagal: ${failed}</blockquote>
<blockquote>📊 Total: ${GROUPS.length}</blockquote>`, { parse_mode: "HTML" });
});

// =============================
// Admin commands: add/list premium & groups
// =============================
bot.onText(/\/addprem (\d+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const userId = parseInt(match[1]);
  addPremium(userId);
  bot.sendMessage(msg.chat.id, `<blockquote>✅ User ${userId} ditambahkan ke Premium</blockquote>`, { parse_mode: "HTML" });
});

bot.onText(/\/listprem/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  const data = JSON.parse(fs.readFileSync(premiumDB));
  bot.sendMessage(msg.chat.id, `<blockquote>👤 Premium Users:</blockquote>\n${data.join("\n") || "Kosong"}`, { parse_mode: "HTML" });
});

// =============================
// Admin command: delprem
// =============================
bot.onText(/\/delprem (\d+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const userId = parseInt(match[1]);
  removePremium(userId);
  bot.sendMessage(msg.chat.id, `<blockquote>🗑 User ${userId} dihapus dari Premium</blockquote>`, { parse_mode: "HTML" });
});

// =============================
// Admin command: addgrupid & delgrupid
// =============================
bot.onText(/\/addgrupid (-?\d+)/, (msg, match) => { // NEW
  if (msg.from.id !== ADMIN_ID) return;
  const groupId = parseInt(match[1]);
  const groups = getGroups();
  if (!groups.includes(groupId)) {
    groups.push(groupId);
    fs.writeFileSync(groupsDB, JSON.stringify(groups, null, 2));
    bot.sendMessage(msg.chat.id, `<blockquote>✅ Grup ${groupId} berhasil ditambahkan ke database</blockquote>`, { parse_mode: "HTML" });
  } else {
    bot.sendMessage(msg.chat.id, `<blockquote>⚠️ Grup ${groupId} sudah ada di database</blockquote>`, { parse_mode: "HTML" });
  }
});

bot.onText(/\/delgrupid (-?\d+)/, async (msg, match) => { // NEW
  if (msg.from.id !== ADMIN_ID) return;
  const groupId = parseInt(match[1]);

  // hapus dari database
  let groups = getGroups();
  if (groups.includes(groupId)) {
    groups = groups.filter(id => id !== groupId);
    fs.writeFileSync(groupsDB, JSON.stringify(groups, null, 2));

    // coba keluar dari grup
    try {
      await bot.leaveChat(groupId);
      bot.sendMessage(msg.chat.id, `<blockquote>🚪 Bot keluar dan grup ${groupId} dihapus dari database</blockquote>`, { parse_mode: "HTML" });
    } catch (e) {
      bot.sendMessage(msg.chat.id, `<blockquote>⚠️ Grup ${groupId} dihapus dari database, tapi bot tidak bisa keluar (mungkin bukan member)</blockquote>`, { parse_mode: "HTML" });
    }
  } else {
    bot.sendMessage(msg.chat.id, `<blockquote>❌ Grup ${groupId} tidak ditemukan di database</blockquote>`, { parse_mode: "HTML" });
  }
});

bot.onText(/\/listgroup/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  const data = getGroups();
  bot.sendMessage(msg.chat.id, `<blockquote>👥 Groups:</blockquote>\n${data.join("\n") || "Kosong"}`, { parse_mode: "HTML" });
});

// =============================
// Admin command: bcuser (broadcast ke user Premium)
// =============================
bot.onText(/^\/bcuser$/, async (msg) => { // NEW
  if (msg.from.id !== ADMIN_ID) return;
  if (!msg.reply_to_message) return bot.sendMessage(msg.chat.id, "⚠️ Reply pesan untuk /bcuser");

  const data = JSON.parse(fs.readFileSync(premiumDB));
  if (data.length === 0) return bot.sendMessage(msg.chat.id, "📭 Tidak ada user premium terdaftar.");

  let success = 0, failed = 0;
  for (const userId of data) {
    try {
      await bot.forwardMessage(userId, msg.chat.id, msg.reply_to_message.message_id);
      success++;
    } catch {
      failed++;
    }
    await new Promise(r => setTimeout(r, 200)); // beri jeda kecil biar aman
  }

  bot.sendMessage(msg.chat.id, `<blockquote>📢 Broadcast selesai</blockquote>
<blockquote>✅ Berhasil: ${success}</blockquote>
<blockquote>❌ Gagal: ${failed}</blockquote>
<blockquote>👤 Total: ${data.length}</blockquote>`, { parse_mode: "HTML" });
});

// =============================
// Fitur /tourl (Admin Utama & Premium Only)
// =============================
bot.onText(/^\/tourl$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // ✅ hanya Admin Utama & Premium
  if (!(userId === ADMIN_ID || isPremium(userId))) {
    return bot.sendMessage(chatId, `<blockquote>❌ Hanya Admin Utama & Premium yang bisa menggunakan perintah ini.</blockquote>`, { parse_mode: "HTML" });
  }

  // Harus reply
  if (!msg.reply_to_message) {
    return bot.sendMessage(chatId, `<blockquote>⚠️ Harus reply foto/video!</blockquote>`, { parse_mode: "HTML" });
  }

  try {
    const reply = msg.reply_to_message;
    let fileId, filename;

    if (reply.photo) {
      fileId = reply.photo[reply.photo.length - 1].file_id;
      filename = "file.jpg";
    } else if (reply.video) {
      fileId = reply.video.file_id;
      filename = "file.mp4";
    } else if (reply.document) {
      fileId = reply.document.file_id;
      filename = reply.document.file_name || "file.bin";
    } else {
      return bot.sendMessage(chatId, `<blockquote>❌ Harus reply foto atau video!</blockquote>`, { parse_mode: "HTML" });
    }

    // Ambil file dari Telegram
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
    const buffer = await (await fetch(fileUrl)).buffer();

    // Upload ke Catbox
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", buffer, { filename });

    const { data } = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
    });

    if (typeof data === "string" && data.startsWith("https://")) {
      await bot.sendMessage(chatId, `<blockquote>🔗 URL: ${data}</blockquote>`, {
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
      });
    } else {
      throw new Error("Upload gagal, respons tidak valid dari Catbox.");
    }
  } catch (err) {
    console.error("Tourl Error:", err.message);
    bot.sendMessage(chatId, `<blockquote>❌ Gagal upload media.\nAlasan: ${err.message}</blockquote>`, {
      parse_mode: "HTML",
      reply_to_message_id: msg.message_id,
    });
  }
});

// =============================
// Admin command: sharech (broadcast ke channel)
// =============================
bot.onText(/^\/sharech$/, async (msg) => { // NEW
  if (msg.from.id !== ADMIN_ID) return;
  if (!msg.reply_to_message) return bot.sendMessage(msg.chat.id, "⚠️ Reply pesan untuk /sharech");

  const CHANNELS = getChannels();
  if (CHANNELS.length === 0) return bot.sendMessage(msg.chat.id, "📭 Tidak ada channel tersimpan.");

  let success = 0, failed = 0;
  let progressMsg = await bot.sendMessage(msg.chat.id, `<blockquote>📤 Mengirim ke channel 0%\n▱▱▱▱▱▱▱▱▱▱</blockquote>`, { parse_mode: "HTML" });

  for (let i = 0; i < CHANNELS.length; i++) {
    try {
      await bot.forwardMessage(CHANNELS[i], msg.chat.id, msg.reply_to_message.message_id);
      success++;
    } catch {
      failed++;
    }

    const percent = Math.round(((i + 1) / CHANNELS.length) * 100);
    if (percent % 5 === 0 || percent === 100) {
      const filled = Math.round(percent / 10);
      const bar = "▰".repeat(filled) + "▱".repeat(10 - filled);
      await bot.editMessageText(`<blockquote>📤 Mengirim ke channel ${percent}%\n${bar}</blockquote>`, {
        chat_id: msg.chat.id,
        message_id: progressMsg.message_id,
        parse_mode: "HTML"
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 300));
    }
  }

  await bot.deleteMessage(msg.chat.id, progressMsg.message_id).catch(() => {});
  bot.sendMessage(msg.chat.id, `<blockquote>✅ Berhasil: ${success}</blockquote>
<blockquote>❌ Gagal: ${failed}</blockquote>
<blockquote>📊 Total: ${CHANNELS.length}</blockquote>`, { parse_mode: "HTML" });
});

// =============================
// Admin command: add/list/del utang
// =============================
// /addutang <teks>
bot.onText(/^\/addutang (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const text = match[1].trim();
  if (!text) return bot.sendMessage(msg.chat.id, "<blockquote>⚠️ Teks utang tidak boleh kosong</blockquote>", { parse_mode: "HTML" });

  const data = getUtang();
  data.push(text);
  saveUtang(data);

  bot.sendMessage(msg.chat.id, `<blockquote>✅ Utang berhasil ditambahkan</blockquote>\n<blockquote>${text}</blockquote>`, { parse_mode: "HTML" });
});

// /listutang
bot.onText(/^\/listutang$/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  const data = getUtang();
  if (data.length === 0) return bot.sendMessage(msg.chat.id, "<blockquote>📭 Tidak ada utang tersimpan</blockquote>", { parse_mode: "HTML" });

  let listText = "<blockquote>📑 DAFTAR UTANG</blockquote>\n";
  data.forEach((utang, i) => {
    listText += `<blockquote>${i + 1}. ${utang}</blockquote>\n`;
  });

  bot.sendMessage(msg.chat.id, listText.trim(), { parse_mode: "HTML" });
});

// /delutang <nomor>
bot.onText(/^\/delutang (\d+)$/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const index = parseInt(match[1]) - 1;
  let data = getUtang();

  if (index < 0 || index >= data.length) {
    return bot.sendMessage(msg.chat.id, "<blockquote>❌ Nomor utang tidak valid</blockquote>", { parse_mode: "HTML" });
  }

  const removed = data.splice(index, 1);
  saveUtang(data);

  bot.sendMessage(msg.chat.id, `<blockquote>🗑 Utang berhasil dihapus:</blockquote>\n<blockquote>${removed[0]}</blockquote>`, { parse_mode: "HTML" });
});

// =============================
// Admin command: add/del pay + fitur /pay
// =============================
// /addpay namapay,nomer,atasnama
bot.onText(/^\/addpay (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const input = match[1].split(",");
  if (input.length < 3) {
    return bot.sendMessage(
      msg.chat.id,
      "<blockquote>⚠️ Format salah.\nContoh: /addpay DANA,08123456789,Budi</blockquote>",
      { parse_mode: "HTML" }
    );
  }

  const [nama, nomor, atasnama] = input.map(x => x.trim());
  const data = getPay();

  data.push({ nama, nomor, atasnama });
  savePay(data);

  bot.sendMessage(
    msg.chat.id,
    `<blockquote>✅ Payment berhasil ditambahkan</blockquote>
<blockquote>💳 ${nama} : ${nomor}</blockquote>
<blockquote>👤 ATAS NAMA : ${atasnama}</blockquote>`,
    { parse_mode: "HTML" }
  );
});

// /delpay namapay
bot.onText(/^\/delpay (.+)/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const nama = match[1].trim().toLowerCase();
  let data = getPay();

  const index = data.findIndex(x => x.nama.toLowerCase() === nama);
  if (index === -1) {
    return bot.sendMessage(
      msg.chat.id,
      `<blockquote>❌ Payment dengan nama "${nama}" tidak ditemukan</blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  const removed = data.splice(index, 1);
  savePay(data);

  bot.sendMessage(
    msg.chat.id,
    `<blockquote>🗑 Payment berhasil dihapus:</blockquote>
<blockquote>💳 ${removed[0].nama} : ${removed[0].nomor}</blockquote>
<blockquote>👤 ATAS NAMA : ${removed[0].atasnama}</blockquote>`,
    { parse_mode: "HTML" }
  );
});

// /pay
bot.onText(/^\/pay$/, (msg) => {
  const chatId = msg.chat.id;
  const data = getPay();
  if (data.length === 0) {
    return bot.sendMessage(
      chatId,
      "<blockquote>📭 Belum ada data payment tersimpan</blockquote>",
      { parse_mode: "HTML" }
    );
  }

  let text = "<blockquote>💰 DETAIL PAYMENT</blockquote>\n\n";
  data.forEach((p) => {
    text += `<blockquote>💳 ${p.nama} : ${p.nomor}</blockquote>\n<blockquote>👤 ATAS NAMA : ${p.atasnama}</blockquote>\n\n`;
  });
  text += "<blockquote>📷 QRIS SCAN DI ATAS</blockquote>";

  const buttons = [[{ text: "👤 OWNER", url: "https://t.me/Jangansoasikdeh" }]];

  // Kirim foto QRIS terlebih dahulu (bisa URL atau path lokal)
  const qrisPhoto = "https://files.catbox.moe/cvhg67.jpg"; // ganti dengan URL/file QRIS kamu
  bot.sendPhoto(chatId, qrisPhoto, {
    caption: text.trim(),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons }
  });
});

// =============================
// Fitur /copyweb (Admin Utama & Premium + Wajib Join Channel)
// =============================
bot.onText(/^\/copyweb (.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const targetUrl = (match[1] || "").trim();

  // cek admin/premium
  if (!(userId === ADMIN_ID || isPremium(userId))) {
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Admin Utama & Premium.");
  }

  // cek join channel
  try {
    const member = await bot.getChatMember("@jasebfreedisini", userId);
    if (["left", "kicked"].includes(member.status)) {
      const buttons = [[{ text: "📢 JOIN CHANNEL", url: "https://t.me/jasebfreedisini" }]];
      return bot.sendMessage(
        chatId,
        "⚠️ Untuk menggunakan fitur ini kamu harus join channel 📢 @jasebfreedisini",
        { reply_markup: { inline_keyboard: buttons } }
      );
    }
  } catch (e) {
    console.error("Error cek channel:", e.message);
    return bot.sendMessage(chatId, "❌ Tidak bisa memverifikasi membership channel.");
  }

  // validasi URL
  if (!/^https?:\/\//i.test(targetUrl)) {
    return bot.sendMessage(chatId, "⚠️ Contoh: /copyweb https://example.com");
  }

  await bot.sendMessage(chatId, "⏳ Sedang menyalin website...");

  const stamp = Date.now();
  const workDir = path.join(__dirname, `copyweb-${stamp}`);
  fs.mkdirSync(workDir, { recursive: true });

  function tryBeautify(content, type = "html") {
    try {
      const beautify = require("js-beautify");
      if (type === "js") return beautify.js(content, { indent_size: 2 });
      if (type === "css") return beautify.css(content, { indent_size: 2 });
      return beautify.html(content, { indent_size: 2 });
    } catch {
      return content;
    }
  }

  try {
    const res = await axios.get(targetUrl, {
      timeout: 20000,
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const type = res.headers["content-type"] || "";
    let fileName = "index.html";
    let content = res.data.toString();

    if (/text\/html/i.test(type)) {
      content = tryBeautify(content, "html");
      fileName = "index.html";
    } else if (/javascript/i.test(type)) {
      content = tryBeautify(content, "js");
      fileName = path.basename(new URL(targetUrl).pathname) || "script.js";
    } else if (/css/i.test(type)) {
      content = tryBeautify(content, "css");
      fileName = path.basename(new URL(targetUrl).pathname) || "style.css";
    } else {
      fileName = path.basename(new URL(targetUrl).pathname) || "file.txt";
    }

    const filePath = path.join(workDir, fileName);
    fs.writeFileSync(filePath, content, "utf8");

    await bot.sendDocument(chatId, filePath, {
      caption: `✅ File berhasil disalin:\n🌐 ${targetUrl}\n📄 ${fileName}`,
      parse_mode: "HTML"
    });

    fs.rmSync(workDir, { recursive: true, force: true });

  } catch (err) {
    console.error("COPYWEB ERROR:", err);
    bot.sendMessage(chatId, "❌ Gagal menyalin website.");
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
});

// =============================
// Admin command: add/del/list blacklist group
// =============================

// /addbl -> hanya admin utama, dipakai di grup
bot.onText(/^\/addbl$/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return; // ✅ hanya admin utama
  const chatId = msg.chat.id;
  if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
    return bot.sendMessage(chatId, "<blockquote>⚠️ Perintah ini hanya bisa digunakan di grup.</blockquote>", { parse_mode: "HTML" });
  }

  addBlacklist(chatId);
  bot.sendMessage(chatId, `<blockquote>✅ Grup "${esc(msg.chat.title || "Unknown Group")}" berhasil ditambahkan ke blacklist.</blockquote>`, { parse_mode: "HTML" });

  // Notif admin utama
  bot.sendMessage(ADMIN_ID, `<blockquote>🚫 Grup masuk blacklist</blockquote>\n<blockquote>👥 ${esc(msg.chat.title || "Unknown Group")}</blockquote>\n<blockquote>🆔 <code>${chatId}</code></blockquote>`, { parse_mode: "HTML" });
});

// /deladdbl -> hanya admin utama, dipakai di grup
bot.onText(/^\/deladdbl$/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return; // ✅ hanya admin utama
  const chatId = msg.chat.id;
  if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
    return bot.sendMessage(chatId, "<blockquote>⚠️ Perintah ini hanya bisa digunakan di grup.</blockquote>", { parse_mode: "HTML" });
  }

  let data = getBlacklist();
  if (data.includes(chatId)) {
    data = data.filter(id => id !== chatId);
    fs.writeFileSync(blacklistDB, JSON.stringify(data, null, 2));
    bot.sendMessage(chatId, `<blockquote>🗑 Grup "${esc(msg.chat.title || "Unknown Group")}" berhasil dihapus dari blacklist.</blockquote>`, { parse_mode: "HTML" });

    // Notif admin utama
    bot.sendMessage(ADMIN_ID, `<blockquote>✅ Grup dihapus dari blacklist</blockquote>\n<blockquote>👥 ${esc(msg.chat.title || "Unknown Group")}</blockquote>\n<blockquote>🆔 <code>${chatId}</code></blockquote>`, { parse_mode: "HTML" });
  } else {
    bot.sendMessage(chatId, `<blockquote>❌ Grup ini tidak ada di blacklist.</blockquote>`, { parse_mode: "HTML" });
  }
});

// /listaddbl -> hanya admin utama
bot.onText(/^\/listaddbl$/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return; // ✅ hanya admin utama
  const data = getBlacklist();
  if (data.length === 0) {
    return bot.sendMessage(msg.chat.id, "<blockquote>📭 Tidak ada grup dalam blacklist.</blockquote>", { parse_mode: "HTML" });
  }

  let listText = "<blockquote>📑 DAFTAR BLACKLIST GROUP</blockquote>\n\n";
  for (let i = 0; i < data.length; i++) {
    try {
      const chat = await bot.getChat(data[i]);
      listText += `<blockquote>${i + 1}. ${esc(chat.title || "Unknown Group")} (ID: <code>${data[i]}</code>)</blockquote>\n`;
    } catch {
      listText += `<blockquote>${i + 1}. ID: <code>${data[i]}</code> (❌ Tidak bisa ambil nama)</blockquote>\n`;
    }
  }

  listText += `\n<blockquote>📊 Total blacklist: ${data.length} grup</blockquote>`;

  bot.sendMessage(msg.chat.id, listText.trim(), { parse_mode: "HTML" });
});

// =============================
// AUTO SHARE SYSTEM
// =============================
let autoShareInterval = null;
let autoShareCooldown = 60000; // default 1 menit
let autoShareMessage = null;
let autoShareRunning = false; // biar tidak tabrakan dengan /share2

// Parser fleksibel: contoh "90s", "5m", "2h", "1h30m20s"
function parseDuration(str) {
  const regex = /(\d+)([smh])/g;
  let total = 0;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === "s") total += value * 1000;
    if (unit === "m") total += value * 60 * 1000;
    if (unit === "h") total += value * 60 * 60 * 1000;
  }
  return total > 0 ? total : null;
}

// Format ms jadi string (contoh: 1h30m20s)
function formatDuration(ms) {
  let sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  sec %= 3600;
  const m = Math.floor(sec / 60);
  sec %= 60;
  let parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec) parts.push(`${sec}s`);
  return parts.length ? parts.join(" ") : "0s";
}

// Fungsi forward cepat ke semua grup
async function forwardToAllGroups(message, fromChatId) {
  const GROUPS = getGroups();
  for (const gid of GROUPS) {
    if (isBlacklisted(gid)) continue;
    try {
      await bot.forwardMessage(gid, fromChatId, message.message_id);
    } catch {}
  }
}

// /autoshare
bot.onText(/^\/autoshare$/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  if (!msg.reply_to_message) return bot.sendMessage(msg.chat.id, "<blockquote>⚠️ Harus reply pesan untuk /autoshare</blockquote>", { parse_mode: "HTML" });

  if (autoShareInterval) {
    return bot.sendMessage(msg.chat.id, "<blockquote>⚠️ AutoShare sudah aktif.\nGunakan /stopauto untuk menghentikan.</blockquote>", { parse_mode: "HTML" });
  }

  autoShareMessage = msg.reply_to_message;

  const cycle = async () => {
    if (autoShareRunning) return; // skip kalau ada cycle yang masih jalan
    autoShareRunning = true;
    await forwardToAllGroups(autoShareMessage, msg.chat.id);
    autoShareRunning = false;
  };

  // jalankan pertama kali langsung
  await cycle();

  // jalankan berulang sesuai cooldown
  autoShareInterval = setInterval(cycle, autoShareCooldown);

  bot.sendMessage(msg.chat.id, `<blockquote>✅ AutoShare dimulai</blockquote>\n<blockquote>⏳ Cooldown antar cycle: ${formatDuration(autoShareCooldown)}</blockquote>`, { parse_mode: "HTML" });
});

// /stopauto
bot.onText(/^\/stopauto$/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  if (!autoShareInterval) return bot.sendMessage(msg.chat.id, "<blockquote>⚠️ AutoShare belum aktif.</blockquote>", { parse_mode: "HTML" });

  clearInterval(autoShareInterval);
  autoShareInterval = null;
  autoShareMessage = null;
  autoShareRunning = false;

  bot.sendMessage(msg.chat.id, "<blockquote>🛑 AutoShare dihentikan.</blockquote>", { parse_mode: "HTML" });
});

// /setcd <durasi>
bot.onText(/^\/setcd (.+)$/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const input = match[1].trim();
  const ms = parseDuration(input);
  if (!ms) return bot.sendMessage(msg.chat.id, "<blockquote>⚠️ Format salah.</blockquote>\n<blockquote>Contoh: 30s, 5m, 2h, 1h30m20s</blockquote>", { parse_mode: "HTML" });
  autoShareCooldown = ms;

  if (autoShareInterval) {
    clearInterval(autoShareInterval);
    autoShareInterval = setInterval(async () => {
      if (autoShareRunning) return;
      autoShareRunning = true;
      await forwardToAllGroups(autoShareMessage, msg.chat.id);
      autoShareRunning = false;
    }, autoShareCooldown);
  }

  bot.sendMessage(msg.chat.id, `<blockquote>✅ Cooldown AutoShare diatur ke ${formatDuration(ms)}</blockquote>`, { parse_mode: "HTML" });
});

// /listcd
bot.onText(/^\/listcd$/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  bot.sendMessage(
    msg.chat.id,
    `<blockquote>⏳ Cooldown AutoShare sekarang: ${formatDuration(autoShareCooldown)}</blockquote>\n\n` +
    `<blockquote>Cara pakai:</blockquote>\n` +
    `<blockquote>/setcd 30s → 30 detik</blockquote>\n` +
    `<blockquote>/setcd 5m → 5 menit</blockquote>\n` +
    `<blockquote>/setcd 2h → 2 jam</blockquote>\n` +
    `<blockquote>/setcd 1h30m → 1 jam 30 menit</blockquote>\n` +
    `<blockquote>/setcd 1h30m20s → 1 jam 30 menit 20 detik</blockquote>`,
    { parse_mode: "HTML" }
  );
});

// =============================
// AUTO FORWARD PER-USER SYSTEM
// =============================
const autoForwardDB = "./auto_forward.json";
if (!fs.existsSync(autoForwardDB)) fs.writeFileSync(autoForwardDB, JSON.stringify({}));

function getAutoForwardData() {
  return JSON.parse(fs.readFileSync(autoForwardDB));
}
function saveAutoForwardData(data) {
  fs.writeFileSync(autoForwardDB, JSON.stringify(data, null, 2));
}

// In-memory state untuk interval per user
const autoForwardIntervals = new Map(); // userId -> intervalId
const autoForwardState = new Map(); // userId -> { putaran, running, startedAt }

// /setpesan - user reply pesan untuk disimpan
bot.onText(/^\/setpesan$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Cek akses
  if (!(userId === ADMIN_ID || isPremium(userId))) {
    return bot.sendMessage(chatId, "<blockquote>❌ Hanya Owner/Premium yang bisa menggunakan fitur ini.</blockquote>", { parse_mode: "HTML" });
  }

  if (!msg.reply_to_message) {
    return bot.sendMessage(chatId, "<blockquote>⚠️ Reply pesan yang ingin di-forward otomatis.</blockquote>", { parse_mode: "HTML" });
  }

  // Simpan data pesan ke database
  const data = getAutoForwardData();
  data[userId] = {
    messageId: msg.reply_to_message.message_id,
    fromChatId: chatId,
    setAt: new Date().toISOString(),
    active: data[userId] ? data[userId].active : false
  };
  saveAutoForwardData(data);

  bot.sendMessage(chatId, "<blockquote>✅ Pesan berhasil disimpan!\nGunakan /auto on untuk memulai auto forward.</blockquote>", { parse_mode: "HTML" });
});

// /auto on - mulai auto forward
bot.onText(/^\/auto on$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Cek akses
  if (!(userId === ADMIN_ID || isPremium(userId))) {
    return bot.sendMessage(chatId, "<blockquote>❌ Hanya Owner/Premium yang bisa menggunakan fitur ini.</blockquote>", { parse_mode: "HTML" });
  }

  // Cek apakah sudah setpesan
  const data = getAutoForwardData();
  if (!data[userId] || !data[userId].messageId) {
    return bot.sendMessage(chatId, "<blockquote>⚠️ Kamu belum /setpesan!\nReply pesan lalu ketik /setpesan terlebih dahulu.</blockquote>", { parse_mode: "HTML" });
  }

  // Cek apakah sudah aktif
  if (autoForwardIntervals.has(userId)) {
    return bot.sendMessage(chatId, "<blockquote>⚠️ Auto Forward kamu sudah aktif.\nKetik /auto off untuk menghentikan.</blockquote>", { parse_mode: "HTML" });
  }

  // Set active
  data[userId].active = true;
  saveAutoForwardData(data);

  // State putaran
  autoForwardState.set(userId, { putaran: 0, running: false, startedAt: Date.now() });

  // Fungsi forward 1 putaran
  const runCycle = async () => {
    const state = autoForwardState.get(userId);
    if (!state || state.running) return;
    state.running = true;

    const currentData = getAutoForwardData();
    if (!currentData[userId] || !currentData[userId].active) {
      state.running = false;
      return;
    }

    state.putaran++;
    const GROUPS = getGroups();
    let success = 0, failed = 0;

    for (const gid of GROUPS) {
      if (isBlacklisted(gid)) continue;
      try {
        await bot.forwardMessage(gid, currentData[userId].fromChatId, currentData[userId].messageId);
        success++;
      } catch {
        failed++;
      }
      // Delay kecil supaya tidak kena rate limit
      await new Promise(r => setTimeout(r, 100));
    }

    // Kirim laporan putaran
    const report = `<blockquote><b>AUTO FORWARD ON</b>\nTarget : ${GROUPS.length} grup\nPutaran : ${state.putaran}\nBerhasil : ${success} grup\nGagal : ${failed} grup</blockquote>\n\n<i>Ketik /auto off untuk berhenti.</i>`;
    bot.sendMessage(chatId, report, { parse_mode: "HTML" }).catch(() => {});

    state.running = false;
  };

  // Jalankan pertama kali langsung
  await runCycle();

  // Jalankan setiap 10 menit
  const intervalId = setInterval(runCycle, 10 * 60 * 1000);
  autoForwardIntervals.set(userId, intervalId);

  bot.sendMessage(chatId, "<blockquote>✅ Auto Forward dimulai!\n⏳ Putaran berikutnya dalam 10 menit.</blockquote>", { parse_mode: "HTML" });
});

// /auto off - hentikan auto forward
bot.onText(/^\/auto off$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Cek akses
  if (!(userId === ADMIN_ID || isPremium(userId))) {
    return bot.sendMessage(chatId, "<blockquote>❌ Hanya Owner/Premium yang bisa menggunakan fitur ini.</blockquote>", { parse_mode: "HTML" });
  }

  // Cek apakah memang aktif
  if (!autoForwardIntervals.has(userId)) {
    return bot.sendMessage(chatId, "<blockquote>⚠️ Auto Forward kamu belum aktif.</blockquote>", { parse_mode: "HTML" });
  }

  // Stop interval
  clearInterval(autoForwardIntervals.get(userId));
  autoForwardIntervals.delete(userId);
  autoForwardState.delete(userId);

  // Update database
  const data = getAutoForwardData();
  if (data[userId]) {
    data[userId].active = false;
    saveAutoForwardData(data);
  }

  bot.sendMessage(chatId, "<blockquote>🛑 Auto Forward berhasil dihentikan.</blockquote>", { parse_mode: "HTML" });
});

// /auto status - tampilkan status auto forward
bot.onText(/^\/auto status$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Cek akses
  if (!(userId === ADMIN_ID || isPremium(userId))) {
    return bot.sendMessage(chatId, "<blockquote>❌ Hanya Owner/Premium yang bisa menggunakan fitur ini.</blockquote>", { parse_mode: "HTML" });
  }

  const data = getAutoForwardData();
  const GROUPS = getGroups();
  const isActive = autoForwardIntervals.has(userId);
  const state = autoForwardState.get(userId);

  // Info user ini
  const statusText = isActive ? "On" : "Off";
  const putaranText = state ? state.putaran : 0;

  // Bangun antrian (semua user yang sedang auto forward aktif)
  let antrianText = "";
  let antrianNum = 0;
  for (const [uid, intervalId] of autoForwardIntervals.entries()) {
    antrianNum++;
    try {
      const chat = await bot.getChat(uid);
      const nama = chat.first_name + (chat.last_name ? " " + chat.last_name : "");
      const uname = chat.username ? `(@${chat.username})` : "";
      const role = parseInt(uid) === ADMIN_ID ? "Owner" : "Premium";
      antrianText += `${antrianNum}. ${esc(nama)} ${esc(uname)}\n > ${role}\n`;
    } catch {
      const role = parseInt(uid) === ADMIN_ID ? "Owner" : "Premium";
      antrianText += `${antrianNum}. User ${uid}\n > ${role}\n`;
    }
  }

  if (!antrianText) antrianText = "Tidak ada antrian aktif.";

  const report = `<blockquote><b>AUTO FORWARD STATUS</b>\nStatus : ${statusText}\nTarget : ${GROUPS.length} grup\nPutaran saat ini : ${putaranText}\nPutaran selanjutnya : 10 menit\n\nAntrian :\n${antrianText}</blockquote>`;

  bot.sendMessage(chatId, report, { parse_mode: "HTML" });
});

// =============================
// Fitur /backup (Admin Utama saja)
// =============================
bot.onText(/^\/backup$/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return; // hanya admin utama

  try {
    if (!fs.existsSync(groupsDB)) {
      return bot.sendMessage(msg.chat.id, "<blockquote>❌ File groups.json tidak ditemukan</blockquote>", { parse_mode: "HTML" });
    }

    await bot.sendDocument(ADMIN_ID, groupsDB, {
      caption: "<blockquote>📦 Backup file groups.json berhasil dikirim</blockquote>",
      parse_mode: "HTML"
    });
  } catch (err) {
    console.error("Backup Error:", err);
    bot.sendMessage(msg.chat.id, "<blockquote>❌ Gagal membuat backup groups.json</blockquote>", { parse_mode: "HTML" });
  }
});