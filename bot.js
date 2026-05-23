/// bot.js
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const axios = require("axios"); 
const FormData = require("form-data"); 
const fetch = require("node-fetch");
const path = require("path");
const { TOKEN, ADMIN_ID, DEVELOPER_ID, REQUIRED_JOINS } = require("./config");

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
const ownerDB = "./owners.json";
if (!fs.existsSync(ownerDB)) fs.writeFileSync(ownerDB, JSON.stringify([]));
const blacklistDB = "./blacklist.json";
if (!fs.existsSync(blacklistDB)) fs.writeFileSync(blacklistDB, JSON.stringify([]));

// Users database (semua user yang /start)
const usersDB = "./users.json";
if (!fs.existsSync(usersDB)) fs.writeFileSync(usersDB, JSON.stringify([]));

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

// Users database helpers
function getUsers() {
  return JSON.parse(fs.readFileSync(usersDB));
}
function addUser(userId) {
  const data = getUsers();
  if (!data.includes(userId)) {
    data.push(userId);
    fs.writeFileSync(usersDB, JSON.stringify(data, null, 2));
  }
}

// Cek apakah user adalah "premium gratisan" (dari tambah bot ke grup, bukan /addprem manual)
function isFreePremium(userId) {
  if (isOwner(userId) || isDeveloper(userId)) return false;
  if (!isPremium(userId)) return false;
  // Jika user ada di group_inviter sebagai pengundang → free premium
  const inviters = JSON.parse(fs.readFileSync(groupInviterDB));
  return inviters.some(x => x.userId === userId);
}

// Cek apakah user adalah premium yang di-add manual via /addprem (bukan dari grup)
function isManualPremium(userId) {
  if (isOwner(userId) || isDeveloper(userId)) return true; // owner/dev selalu dianggap manual
  if (!isPremium(userId)) return false;
  return !isFreePremium(userId);
}

// Owner database helpers
function getOwners() {
  return JSON.parse(fs.readFileSync(ownerDB));
}
function saveOwners(data) {
  fs.writeFileSync(ownerDB, JSON.stringify(data, null, 2));
}
function addOwnerToDB(userId, durationSec) {
  const data = getOwners();
  const expireAt = new Date(Date.now() + durationSec * 1000).toISOString();
  const existing = data.find(x => x.userId === userId);
  if (existing) {
    existing.expireAt = expireAt;
  } else {
    data.push({ userId, expireAt });
  }
  saveOwners(data);
}
function removeOwnerFromDB(userId) {
  let data = getOwners();
  data = data.filter(x => x.userId !== userId);
  saveOwners(data);
}
function isOwnerFromDB(userId) {
  const data = getOwners();
  return data.some(x => x.userId === userId);
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

const channelBlacklistDB = "./channel_blacklist.json";
if (!fs.existsSync(channelBlacklistDB)) fs.writeFileSync(channelBlacklistDB, JSON.stringify([]));
const userChannelsDB = "./user_channels.json";
if (!fs.existsSync(userChannelsDB)) fs.writeFileSync(userChannelsDB, JSON.stringify({}));

function getChannelBlacklist() {
  return JSON.parse(fs.readFileSync(channelBlacklistDB));
}
function addChannelBlacklist(channelId) {
  const data = getChannelBlacklist();
  if (!data.includes(channelId)) {
    data.push(channelId);
    fs.writeFileSync(channelBlacklistDB, JSON.stringify(data, null, 2));
  }
}
function isChannelBlacklisted(channelId) {
  return getChannelBlacklist().includes(channelId);
}
function removeChannelBlacklist(channelId) {
  let data = getChannelBlacklist();
  data = data.filter(id => id !== channelId);
  fs.writeFileSync(channelBlacklistDB, JSON.stringify(data, null, 2));
}

// User channel mapping: { "userId": [channelId1, channelId2] }
function getUserChannels(userId) {
  const data = JSON.parse(fs.readFileSync(userChannelsDB));
  return data[String(userId)] || [];
}
function addUserChannel(userId, channelId) {
  const data = JSON.parse(fs.readFileSync(userChannelsDB));
  const key = String(userId);
  if (!data[key]) data[key] = [];
  if (!data[key].includes(channelId)) {
    data[key].push(channelId);
    fs.writeFileSync(userChannelsDB, JSON.stringify(data, null, 2));
  }
}
function removeUserChannel(userId, channelId) {
  const data = JSON.parse(fs.readFileSync(userChannelsDB));
  if (data[userId]) {
    data[userId] = data[userId].filter(id => id !== channelId);
    fs.writeFileSync(userChannelsDB, JSON.stringify(data, null, 2));
  }
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

// Role helper functions
function isDeveloper(userId) {
  return userId === DEVELOPER_ID;
}
function isOwner(userId) {
  return userId === ADMIN_ID || userId === DEVELOPER_ID || isOwnerFromDB(userId);
}
function hasAccess(userId) {
  // Premium, Owner, or Developer
  return isPremium(userId) || isOwner(userId);
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

// Check expired owners
async function checkExpiredOwners() {
  const data = getOwners();
  const now = new Date();
  let changed = false;
  for (const item of data) {
    if (item.expireAt && new Date(item.expireAt) <= now) {
      changed = true;
      bot.sendMessage(item.userId, "<blockquote>⚠️ Akses Owner kamu sudah berakhir.</blockquote>", { parse_mode: "HTML" }).catch(() => {});
    }
  }
  if (changed) {
    const filtered = data.filter(x => new Date(x.expireAt) > now);
    saveOwners(filtered);
  }
}
setInterval(checkExpiredOwners, 10 * 60 * 1000);

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
  const userId = msg.from.id;
  const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  // Simpan user ID ke database users.json
  addUser(userId);

  // Cek wajib join channel/grup (skip untuk developer)
  if (!isDeveloper(userId)) {
    let belumJoin = [];
    for (const req of REQUIRED_JOINS) {
      try {
        const member = await bot.getChatMember(req.id, userId);
        if (["left", "kicked"].includes(member.status)) {
          belumJoin.push(req);
        }
      } catch {
        belumJoin.push(req);
      }
    }

    if (belumJoin.length > 0) {
      const joinButtons = belumJoin.map(r => [{ text: r.text, url: r.url }]);
      joinButtons.push([{ text: "✅ 𝚂𝚄𝙳𝙰𝙷 𝙹𝙾𝙸𝙽", callback_data: "check_join" }]);

      return bot.sendPhoto(chatId, logoUrl, {
        caption: `<blockquote>⚠️ ${username}, kamu harus join semua channel/grup berikut sebelum bisa menggunakan bot ini:</blockquote>`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: joinButtons }
      });
    }
  }

  // Loading animation
  const loadMsg = await bot.sendMessage(chatId, "<blockquote>▰▱▱▱▱▱▱▱▱▱</blockquote>", { parse_mode: "HTML" });
  await new Promise(r => setTimeout(r, 400));
  await bot.editMessageText("<blockquote>▰▰▰▱▱▱▱▱▱▱</blockquote>", { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML" }).catch(() => {});
  await new Promise(r => setTimeout(r, 400));
  await bot.editMessageText("<blockquote>▰▰▰▰▰▱▱▱▱▱</blockquote>", { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML" }).catch(() => {});
  await new Promise(r => setTimeout(r, 400));
  await bot.editMessageText("<blockquote>▰▰▰▰▰▰▰▱▱▱</blockquote>", { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML" }).catch(() => {});
  await new Promise(r => setTimeout(r, 400));
  await bot.editMessageText("<blockquote>▰▰▰▰▰▰▰▰▰▰</blockquote>", { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML" }).catch(() => {});
  await new Promise(r => setTimeout(r, 300));
  await bot.deleteMessage(chatId, loadMsg.message_id).catch(() => {});

  const users = getUsers().length;
  const groups = getGroups().length;

  // Get current date/time in WIB
  const now = new Date();
  const wibDate = now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

  // User info
  const nameUser = msg.from.first_name + (msg.from.last_name ? " " + msg.from.last_name : "");
  const userIdDisplay = msg.from.id;
  let roleDisplay = "Free";
  if (isDeveloper(userId)) roleDisplay = "Developer";
  else if (isOwner(userId)) roleDisplay = "Owner";
  else if (isPremium(userId)) roleDisplay = "Premium";

  const buttons = [
    [
      { text: "𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁", url: "https://t.me/Jangansoasikdeh" },
      { text: "𝙲𝙷𝙰𝙽𝙽𝙴𝙻", url: "https://t.me/jasebfreedisini" }
    ],
    [
      { text: "+ 𝙰𝙳𝙳 𝚃𝙾 𝙼𝙴 𝙶𝚁𝙾𝚄𝙿", url: `https://t.me/${(await bot.getMe()).username}?startgroup=true` }
    ],
    [
      { text: "𝚅𝙴𝚁𝙸𝙵𝙸𝙴𝙳", callback_data: "verified" }
    ]
  ];

  bot.sendPhoto(chatId, logoUrl, {
    caption: `<blockquote>👋 Ola ${username} Selamat Datang Di Bot Jaseb Free</blockquote>
<blockquote>☐ 𝚅𝙴𝚁𝚂𝙸𝙾𝙽 : 𝟷.𝟶 𝚅𝙸𝙿
☐ 𝙰𝚄𝚃𝙷𝙾𝚁 : @axcelforlife</blockquote>
<blockquote>𝙳𝙰𝚃𝙰𝙱𝙰𝚂𝙴</blockquote>
<blockquote>✰ 𝙳𝙰𝚃𝙴 : ${wibDate}(WIB)
✰ 𝚄𝚂𝙴𝚁 : ${users}
✰ 𝙶𝚁𝙾𝚄𝙿 : ${groups}</blockquote>
<blockquote>𝚄𝚂𝙴𝚁 𝙸𝙽𝙵𝙾𝚁𝙼𝙰𝚃𝙸𝙾𝙽</blockquote>
<blockquote>✰ 𝙽𝙰𝙼𝙴 : ${esc(nameUser)}
✰ 𝙸𝙳 : <code>${userIdDisplay}</code>
✰ 𝚁𝙾𝙻𝙴 : ${roleDisplay}</blockquote>`,
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

  if (query.data === "check_join") {
    // Cek ulang apakah user sudah join semua
    let belumJoin = [];
    for (const req of REQUIRED_JOINS) {
      try {
        const member = await bot.getChatMember(req.id, userId);
        if (["left", "kicked"].includes(member.status)) {
          belumJoin.push(req);
        }
      } catch {
        belumJoin.push(req);
      }
    }

    if (belumJoin.length > 0) {
      return bot.answerCallbackQuery(query.id, { text: "❌ Kamu belum join semua channel/grup!", show_alert: true });
    }

    // Sudah join semua, hapus pesan lama dan tampilkan loading
    bot.deleteMessage(chatId, query.message.message_id);

    // Loading animation
    const loadMsg = await bot.sendMessage(chatId, "<blockquote>▰▱▱▱▱▱▱▱▱▱</blockquote>", { parse_mode: "HTML" });
    await new Promise(r => setTimeout(r, 400));
    await bot.editMessageText("<blockquote>▰▰▰▱▱▱▱▱▱▱</blockquote>", { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML" }).catch(() => {});
    await new Promise(r => setTimeout(r, 400));
    await bot.editMessageText("<blockquote>▰▰▰▰▰▱▱▱▱▱</blockquote>", { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML" }).catch(() => {});
    await new Promise(r => setTimeout(r, 400));
    await bot.editMessageText("<blockquote>▰▰▰▰▰▰▰▱▱▱</blockquote>", { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML" }).catch(() => {});
    await new Promise(r => setTimeout(r, 400));
    await bot.editMessageText("<blockquote>▰▰▰▰▰▰▰▰▰▰</blockquote>", { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML" }).catch(() => {});
    await new Promise(r => setTimeout(r, 300));
    await bot.deleteMessage(chatId, loadMsg.message_id).catch(() => {});

    const username = query.from.username ? `@${query.from.username}` : query.from.first_name;
    const users = getUsers().length;
    const groups = getGroups().length;

    // Get current date/time in WIB
    const nowJoin = new Date();
    const wibDateJoin = nowJoin.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

    // User info
    const nameUserJoin = query.from.first_name + (query.from.last_name ? " " + query.from.last_name : "");
    const userIdDisplayJoin = query.from.id;
    let roleDisplayJoin = "Free";
    if (isDeveloper(userId)) roleDisplayJoin = "Developer";
    else if (isOwner(userId)) roleDisplayJoin = "Owner";
    else if (isPremium(userId)) roleDisplayJoin = "Premium";

    const buttons = [
      [
        { text: "𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁", url: "https://t.me/axcelforlife" },
        { text: "𝙲𝙷𝙰𝙽𝙽𝙴𝙻", url: "https://t.me/limakoshongenam" }
      ],
      [
        { text: "+ 𝙰𝙳𝙳 𝚃𝙾 𝙼𝙴 𝙶𝚁𝙾𝚄𝙿", url: `https://t.me/${(await bot.getMe()).username}?startgroup=true` }
      ],
      [
        { text: "𝚅𝙴𝚁𝙸𝙵𝙸𝙴𝙳", callback_data: "verified" }
      ]
    ];

    bot.sendPhoto(chatId, logoUrl, {
      caption: `<blockquote>👋 Ola ${username} Selamat Datang Di Bot Jaseb Free</blockquote>
<blockquote>☐ 𝚅𝙴𝚁𝚂𝙸𝙾𝙽 : 𝟷.𝟶 𝚅𝙸𝙿
☐ 𝙰𝚄𝚃𝙷𝙾𝚁 : @axcelforlife</blockquote>
<blockquote>𝙳𝙰𝚃𝙰𝙱𝙰𝚂𝙴</blockquote>
<blockquote>✰ 𝙳𝙰𝚃𝙴 : ${wibDateJoin}(WIB)
✰ 𝚄𝚂𝙴𝚁 : ${users}
✰ 𝙶𝚁𝙾𝚄𝙿 : ${groups}</blockquote>
<blockquote>𝚄𝚂𝙴𝚁 𝙸𝙽𝙵𝙾𝚁𝙼𝙰𝚃𝙸𝙾𝙽</blockquote>
<blockquote>✰ 𝙽𝙰𝙼𝙴 : ${esc(nameUserJoin)}
✰ 𝙸𝙳 : <code>${userIdDisplayJoin}</code>
✰ 𝚁𝙾𝙻𝙴 : ${roleDisplayJoin}</blockquote>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons }
    });

    return bot.answerCallbackQuery(query.id, { text: "✅ Verifikasi berhasil!" });
  }

  if (query.data === "verified") {
    if (hasAccess(userId)) {
      const buttons = [
        [
          { text: "𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁", url: "https://t.me/axcelforlife" },
        { text: "𝙲𝙷𝙰𝙽𝙽𝙴𝙻", url: "https://t.me/limakoshongenam" }
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
    const buttons = [];
    // Tampilkan button Owner jika user adalah Owner atau Developer
    if (isOwner(userId)) {
      buttons.push([{ text: "👑 𝙾𝚆𝙽𝙴𝚁 𝙵𝙸𝚃𝚄𝚁", callback_data: "owner_menu" }]);
    }
    // Tampilkan button Developer jika user adalah Developer
    if (userId === DEVELOPER_ID) {
      buttons.push([{ text: "⚙️ 𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁 𝙵𝙸𝚃𝚄𝚁", callback_data: "dev_menu" }]);
    }
    buttons.push([{ text: "⬅ BACK", callback_data: "back" }]);

    bot.sendPhoto(chatId, logoUrl, {
      caption: `<blockquote>𝗙𝗜𝗧𝗨𝗥 𝗝𝗔𝗦𝗛𝗘𝗥 𝗠𝗘𝗡𝗨</blockquote>
<blockquote>/share -> 𝚂𝙷𝙰𝚁𝙴 𝙲𝙾𝙿𝚈 + 𝚂𝙴𝙱𝙰𝚁 
/share2 -> 𝚂𝙷𝙰𝚁𝙴 𝙵𝙾𝚁𝙴𝚆𝙳 + 𝚂𝙴𝙱𝙰𝚁
/autoshare -> 𝙼𝚄𝙻𝙰𝙸 𝙰𝚄𝚃𝙾 𝙵𝙾𝚁𝚆𝙰𝚁𝙳
/stopauto -> 𝙱𝙴𝚁𝙷𝙴𝙽𝚃𝙸 𝙰𝚄𝚃𝙾 𝙵𝙾𝚁𝚆𝙰𝚁𝙳
/statushare -> 𝚂𝚃𝙰𝚃𝚄𝚂 𝙰𝚄𝚃𝙾 𝙵𝙾𝚁𝚆𝙰𝚁𝙳
/bcuser -> 𝙵𝙾𝚁𝚆𝙴𝙳 𝙺𝙴 𝙿𝙴𝙽𝙶𝙶𝚄𝙽𝙰 BOT
/sharech -> 𝙵𝙾𝚁𝚆𝙴𝙳 𝙺𝙴 𝙲𝙷𝙰𝙽𝙴𝙻 𝚃𝙴𝙻𝙴𝙶𝚁𝙰𝙼
/tourl -> 𝙹𝙰𝙳𝙸𝙺𝙰𝙽 𝙵𝙾𝚃𝙾/𝚅𝙸𝙳𝙴𝙾 𝙹𝙰𝙳𝙸 𝙻𝙸𝙽𝙺
/copyweb -> 𝙲𝙾𝙿𝚈 𝙷𝚃𝙼𝙻 𝚆𝙴𝙱𝙸𝚂𝚃𝙴 𝚃𝙰𝚁𝙶𝙴𝚃
/addch [id] -> 𝚃𝙰𝙼𝙱𝙰𝙷 𝙲𝙷𝙰𝙽𝙽𝙴𝙻 𝙱𝙾𝚃</blockquote>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons }
    });
  }

  if (query.data === "owner_menu") {
    bot.deleteMessage(chatId, query.message.message_id);
    const buttons = [[{ text: "⬅ BACK", callback_data: "all_menu" }]];

    bot.sendPhoto(chatId, logoUrl, {
      caption: `<blockquote>👑 𝗢𝗪𝗡𝗘𝗥 𝗙𝗜𝗧𝗨𝗥</blockquote>
<blockquote>/addprem [id] [durasi] -> 𝚃𝙰𝙼𝙱𝙰𝙷 𝙿𝚁𝙴𝙼𝙸𝚄𝙼 (contoh: 30d, 2w, 1m)
/delprem [id] -> 𝙷𝙰𝙿𝚄𝚂 𝚄𝚂𝙴𝚁 𝙿𝚁𝙴𝙼𝙸𝚄𝙼
/listprem -> 𝙻𝙸𝙷𝙰𝚃 𝙳𝙰𝙵𝚃𝙰𝚁 𝙿𝚁𝙴𝙼𝙸𝚄𝙼
/bcuser -> 𝙱𝚁𝙾𝙰𝙳𝙲𝙰𝚂𝚃 𝙺𝙴 𝚄𝚂𝙴𝚁
/addch [id] -> 𝚃𝙰𝙼𝙱𝙰𝙷 𝙲𝙷𝙰𝙽𝙽𝙴𝙻 𝙱𝙾𝚃</blockquote>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons }
    });
  }

  if (query.data === "dev_menu") {
    bot.deleteMessage(chatId, query.message.message_id);
    const buttons = [[{ text: "⬅ BACK", callback_data: "all_menu" }]];

    bot.sendPhoto(chatId, logoUrl, {
      caption: `<blockquote>⚙️ 𝗗𝗘𝗩𝗘𝗟𝗢𝗣𝗘𝗥 𝗙𝗜𝗧𝗨𝗥</blockquote>
<blockquote>/addowner [id] [durasi] -> 𝚃𝙰𝙼𝙱𝙰𝙷 𝙾𝚆𝙽𝙴𝚁 (contoh: 5h, 7d, 1m)
/delowner [id] -> 𝙷𝙰𝙿𝚄𝚂 𝙾𝚆𝙽𝙴𝚁
/listowner -> 𝙻𝙸𝙷𝙰𝚃 𝙳𝙰𝙵𝚃𝙰𝚁 𝙾𝚆𝙽𝙴𝚁
/setcd [durasi] -> 𝙰𝚃𝚄𝚁 𝙳𝙴𝙻𝙰𝚈 𝙻𝙾𝙾𝙿𝙸𝙽𝙶 𝙰𝚄𝚃𝙾𝚂𝙷𝙰𝚁𝙴
/addgrupid [id] -> 𝚃𝙰𝙼𝙱𝙰𝙷 𝙶𝚁𝚄𝙿 𝙼𝙰𝙽𝚄𝙰𝙻
/delgrupid [id] -> 𝙷𝙰𝙿𝚄𝚂 𝙶𝚁𝚄𝙿 + 𝙱𝙾𝚃 𝙺𝙴𝙻𝚄𝙰𝚁
/listgroup -> 𝙻𝙸𝙷𝙰𝚃 𝚂𝙴𝙼𝚄𝙰 𝙶𝚁𝚄𝙿
/bcuser -> 𝙱𝚁𝙾𝙰𝙳𝙲𝙰𝚂𝚃 𝙺𝙴 𝚄𝚂𝙴𝚁
/backup -> 𝙱𝙰𝙲𝙺𝚄𝙿 𝚂𝙴𝙼𝚄𝙰 𝙵𝙸𝙻𝙴 (𝚉𝙸𝙿)
/setbackup [menit] -> 𝙰𝚃𝚄𝚁 𝙰𝚄𝚃𝙾 𝙱𝙰𝙲𝙺𝚄𝙿
/addbl -> 𝙱𝙻𝙰𝙲𝙺𝙻𝙸𝚂𝚃 𝙶𝚁𝚄𝙿
/deladdbl -> 𝙷𝙰𝙿𝚄𝚂 𝙱𝙻𝙰𝙲𝙺𝙻𝙸𝚂𝚃
/listaddbl -> 𝙻𝙸𝙷𝙰𝚃 𝙱𝙻𝙰𝙲𝙺𝙻𝙸𝚂𝚃
/listcd -> 𝙻𝙸𝙷𝙰𝚃 𝙳𝙴𝙻𝙰𝚈 𝚂𝙴𝙺𝙰𝚁𝙰𝙽𝙶
/addch [id] -> 𝚃𝙰𝙼𝙱𝙰𝙷 𝙲𝙷𝙰𝙽𝙽𝙴𝙻 𝙱𝙾𝚃
/listch -> 𝙻𝙸𝙷𝙰𝚃 𝙲𝙷𝙰𝙽𝙽𝙴𝙻 𝙳𝙰𝚃𝙰𝙱𝙰𝚂𝙴
/delch [id] -> 𝙷𝙰𝙿𝚄𝚂 𝙲𝙷𝙰𝙽𝙽𝙴𝙻
/blch [id] -> 𝙱𝙻𝙰𝙲𝙺𝙻𝙸𝚂𝚃 𝙲𝙷𝙰𝙽𝙽𝙴𝙻
/setdch [durasi] -> 𝙰𝚃𝚄𝚁 𝙳𝙴𝙻𝙰𝚈 /sharech
/addpay [nama,nomor,atas nama] -> 𝚃𝙰𝙼𝙱𝙰𝙷 𝙿𝙰𝚈𝙼𝙴𝙽𝚃
/delpay [nama] -> 𝙷𝙰𝙿𝚄𝚂 𝙿𝙰𝚈𝙼𝙴𝙽𝚃
/addutang [teks] -> 𝚃𝙰𝙼𝙱𝙰𝙷 𝚄𝚃𝙰𝙽𝙶
/delutang [nomor] -> 𝙷𝙰𝙿𝚄𝚂 𝚄𝚃𝙰𝙽𝙶
/listutang -> 𝙻𝙸𝙷𝙰𝚃 𝚄𝚃𝙰𝙽𝙶</blockquote>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons }
    });
  }

  if (query.data === "back") {
    bot.deleteMessage(chatId, query.message.message_id);

    const username = query.from.username ? `@${query.from.username}` : query.from.first_name;
    const users = getUsers().length;
    const groups = getGroups().length;

    // Get current date/time in WIB
    const nowBack = new Date();
    const wibDateBack = nowBack.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

    // User info
    const nameUserBack = query.from.first_name + (query.from.last_name ? " " + query.from.last_name : "");
    const userIdDisplayBack = query.from.id;
    let roleDisplayBack = "Free";
    if (isDeveloper(userId)) roleDisplayBack = "Developer";
    else if (isOwner(userId)) roleDisplayBack = "Owner";
    else if (isPremium(userId)) roleDisplayBack = "Premium";

    const buttons = [
      [
        { text: "𝙳𝙴𝚅𝙴𝙻𝙾𝙿𝙴𝚁", url: "https://t.me/Jangansoasikdeh" },
        { text: "𝙲𝙷𝙰𝙽𝙽𝙴𝙻", url: "https://t.me/jasebfreedisini" }
      ],
      [
        { text: "+ 𝙰𝙳𝙳 𝚃𝙾 𝙼𝙴 𝙶𝚁𝙾𝚄𝙿", url: `https://t.me/${(await bot.getMe()).username}?startgroup=true` }
      ],
      [
        hasAccess(userId)
          ? { text: "𝙼𝙴𝙽𝚄 𝙹𝙰𝚂𝙷𝙴𝚁", callback_data: "all_menu" }
          : { text: "𝚅𝙴𝚁𝙸𝙵𝙸𝙴𝙳", callback_data: "verified" }
      ]
    ];

    bot.sendPhoto(chatId, logoUrl, {
      caption: `<blockquote>👋 Ola ${username} Selamat Datang Di Bot Jaseb Free</blockquote>
<blockquote>𝙳𝙰𝚃𝙰𝙱𝙰𝚂𝙴</blockquote>
<blockquote>✰ 𝙳𝙰𝚃𝙴 : ${wibDateBack}(WIB)
✰ 𝚄𝚂𝙴𝚁 : ${users}
✰ 𝙶𝚁𝙾𝚄𝙿 : ${groups}</blockquote>
<blockquote>𝚄𝚂𝙴𝚁 𝙸𝙽𝙵𝙾𝚁𝙼𝙰𝚃𝙸𝙾𝙽</blockquote>
<blockquote>✰ 𝙽𝙰𝙼𝙴 : ${esc(nameUserBack)}
✰ 𝙸𝙳 : <code>${userIdDisplayBack}</code>
✰ 𝚁𝙾𝙻𝙴 : ${roleDisplayBack}</blockquote>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons }
    });
  }
});

// =============================
// Callback handler untuk /bcuser2 buttons
// =============================
bot.on("callback_query", async (query) => {
  const data = query.data;
  
  if (data && data.startsWith("bcuser2_forward_")) {
    // Format: bcuser2_forward_{chatId}_{messageId}
    const parts = data.replace("bcuser2_forward_", "").split("_");
    const fromChatId = parseInt(parts[0]);
    const messageId = parseInt(parts[1]);
    const userId = query.from.id;
    
    try {
      // Forward pesan asli ke semua grup user
      const GROUPS = getGroups();
      let success = 0, failed = 0;
      for (const gid of GROUPS) {
        if (isBlacklisted(gid)) continue;
        try {
          await bot.copyMessage(gid, fromChatId, messageId);
          success++;
        } catch { failed++; }
        await new Promise(r => setTimeout(r, 300));
      }
      bot.answerCallbackQuery(query.id, { text: `✅ Forwarded ke ${success} grup!`, show_alert: true });
    } catch (err) {
      bot.answerCallbackQuery(query.id, { text: "❌ Gagal forward pesan.", show_alert: true });
    }
  }

  if (data === "bcuser2_notforward") {
    bot.answerCallbackQuery(query.id, { text: "Okay, pesan tidak di-forward.", show_alert: false });
  }
});

// =============================
// Cooldown Map untuk /share
// =============================
const shareCooldown = new Map(); // NEW

// /sharech cooldown & delay settings
const sharechCooldown = new Map(); // userId -> lastUsedTimestamp
let sharechDelayNormal = 24 * 60 * 60 * 1000; // user biasa: 1x per hari (24 jam)
let sharechDelayPremium = 60 * 60 * 1000; // premium: 1 jam
let sharechDelayOwner = 30 * 60 * 1000; // owner: 30 menit

// =============================
// Fitur /share (premium + admin) — copyMessage + watermark untuk premium gratisan
// =============================
bot.onText(/^\/share$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!msg.reply_to_message) return bot.sendMessage(chatId, "⚠️ Reply pesan untuk /share");
  if (!(hasAccess(userId))) return bot.sendMessage(chatId, "❌ Hanya Admin/Premium yang bisa pakai.");

  // === Cek cooldown (hanya untuk premium, bukan admin utama) ===
  if (!isOwner(userId) && isPremium(userId)) {
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

  const senderUsername = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
  const botInfo = await bot.getMe();
  const botUsername = botInfo.username;
  const useWatermark = isFreePremium(userId); // watermark hanya untuk premium gratisan

  let success = 0, failed = 0;
  let progressMsg = await bot.sendMessage(chatId, `<blockquote>📤 Mengirim ke grup 0%\n▱▱▱▱▱▱▱▱▱▱</blockquote>`, { parse_mode: "HTML" });

  for (let i = 0; i < GROUPS.length; i++) {
    if (isBlacklisted(GROUPS[i])) continue; // skip grup blacklist
    try {
      if (useWatermark) {
        // Premium gratisan: "pesan dari @username" di atas + copyMessage + watermark di bawah
        await bot.sendMessage(GROUPS[i], `<blockquote>pesan dari ${esc(senderUsername)}</blockquote>`, { parse_mode: "HTML" });
        await bot.copyMessage(GROUPS[i], chatId, msg.reply_to_message.message_id);
        await bot.sendMessage(GROUPS[i], `<blockquote>jasher by @${botUsername}</blockquote>`, { parse_mode: "HTML" });
      } else {
        // Owner/Developer/Manual Premium: copyMessage tanpa watermark
        await bot.copyMessage(GROUPS[i], chatId, msg.reply_to_message.message_id);
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
// Fitur /share2 (premium manual, owner, developer ONLY — premium gratisan TIDAK bisa)
// =============================
bot.onText(/^\/share2$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!msg.reply_to_message) return bot.sendMessage(chatId, "⚠️ Reply pesan untuk /share2");
  
  // Premium gratisan TIDAK bisa akses /share2
  if (isFreePremium(userId)) {
    return bot.sendMessage(chatId, "<blockquote>❌ Premium gratisan tidak bisa menggunakan /share2.\nGunakan /share sebagai gantinya.</blockquote>", { parse_mode: "HTML" });
  }
  if (!isManualPremium(userId)) {
    return bot.sendMessage(chatId, "<blockquote>❌ Hanya Premium (manual), Owner, dan Developer yang bisa pakai.</blockquote>", { parse_mode: "HTML" });
  }

  const GROUPS = getGroups();
  if (GROUPS.length === 0) return bot.sendMessage(chatId, "📭 Tidak ada grup tersimpan.");

  let success = 0, failed = 0;
  let progressMsg = await bot.sendMessage(chatId, `<blockquote>📤 Forwarding ke grup 0%\n▱▱▱▱▱▱▱▱▱▱</blockquote>`, { parse_mode: "HTML" });

  for (let i = 0; i < GROUPS.length; i++) {
    if (isBlacklisted(GROUPS[i])) continue; // skip grup blacklist
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
bot.onText(/^\/addprem (\d+)\s+(\d+)(d|w|m)$/, (msg, match) => {
  if (!isOwner(msg.from.id)) return;
  const userId = parseInt(match[1]);
  const amount = parseInt(match[2]);
  const unit = match[3];

  let durationSec = 0;
  let label = "";
  if (unit === "d") {
    durationSec = amount * 24 * 60 * 60;
    label = `${amount} Hari`;
  } else if (unit === "w") {
    durationSec = amount * 7 * 24 * 60 * 60;
    label = `${amount} Minggu`;
  } else if (unit === "m") {
    durationSec = amount * 30 * 24 * 60 * 60;
    label = `${amount} Bulan`;
  }

  addPremium(userId);
  addTempPremiumCustom(userId, durationSec);

  const expiry = new Date(Date.now() + durationSec * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  bot.sendMessage(msg.chat.id, `<blockquote>✅ User ${userId} ditambahkan ke Premium</blockquote>\n<blockquote>⏳ Durasi: ${label}</blockquote>\n<blockquote>📅 Expired: ${expiry}</blockquote>`, { parse_mode: "HTML" });
});

bot.onText(/\/listprem/, (msg) => {
  if (!isOwner(msg.from.id)) return;
  const data = JSON.parse(fs.readFileSync(premiumDB));
  const tempData = JSON.parse(fs.readFileSync(tempPremiumDB));

  if (data.length === 0) return bot.sendMessage(msg.chat.id, "<blockquote>📭 Tidak ada user premium</blockquote>", { parse_mode: "HTML" });

  let listText = "<blockquote>👤 Premium Users:</blockquote>\n";
  for (const uid of data) {
    const temp = tempData.find(x => x.userId === uid);
    if (temp && temp.expireAt) {
      const expiry = new Date(temp.expireAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
      listText += `<blockquote>• <code>${uid}</code> — Exp: ${expiry}</blockquote>\n`;
    } else if (temp && temp.addedAt) {
      listText += `<blockquote>• <code>${uid}</code> — Added: ${new Date(temp.addedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}</blockquote>\n`;
    } else {
      listText += `<blockquote>• <code>${uid}</code> — Permanent</blockquote>\n`;
    }
  }

  bot.sendMessage(msg.chat.id, listText.trim(), { parse_mode: "HTML" });
});

// =============================
// Admin command: delprem
// =============================
bot.onText(/\/delprem (\d+)/, (msg, match) => {
  if (!isOwner(msg.from.id)) return;
  const userId = parseInt(match[1]);
  removePremium(userId);
  bot.sendMessage(msg.chat.id, `<blockquote>🗑 User ${userId} dihapus dari Premium</blockquote>`, { parse_mode: "HTML" });
});

// =============================
// Admin command: addgrupid & delgrupid
// =============================
bot.onText(/\/addgrupid (-?\d+)/, (msg, match) => { // NEW
  if (!isDeveloper(msg.from.id)) return;
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
  if (!isDeveloper(msg.from.id)) return;
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
  if (!isDeveloper(msg.from.id)) return;
  const data = getGroups();
  bot.sendMessage(msg.chat.id, `<blockquote>👥 Groups:</blockquote>\n${data.join("\n") || "Kosong"}`, { parse_mode: "HTML" });
});

// =============================
// Cooldown tracker untuk /bcuser (premium gratisan = 1 jam sekali)
const bcuserCooldown = {};

// Admin command: bcuser (broadcast ke SEMUA user di users.json)
// =============================
bot.onText(/^\/bcuser$/, async (msg) => {
  const userId = msg.from.id;
  if (!hasAccess(userId)) return;

  // Cek cooldown untuk premium gratisan (1 jam)
  if (isFreePremium(userId)) {
    const lastUsed = bcuserCooldown[userId];
    if (lastUsed) {
      const elapsed = Date.now() - lastUsed;
      const cooldownMs = 60 * 60 * 1000; // 1 jam
      if (elapsed < cooldownMs) {
        const sisaMenit = Math.ceil((cooldownMs - elapsed) / 60000);
        return bot.sendMessage(msg.chat.id, `<blockquote>⏳ Kamu harus menunggu ${sisaMenit} menit lagi untuk menggunakan /bcuser.\n(Premium gratisan hanya bisa 1 jam sekali)</blockquote>`, { parse_mode: "HTML" });
      }
    }
  }

  if (!msg.reply_to_message) return bot.sendMessage(msg.chat.id, "⚠️ Reply pesan untuk /bcuser");

  const data = getUsers();
  if (data.length === 0) return bot.sendMessage(msg.chat.id, "📭 Tidak ada user terdaftar.");

  // Set cooldown untuk premium gratisan
  if (isFreePremium(userId)) {
    bcuserCooldown[userId] = Date.now();
  }

  const senderUsername = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;

  let success = 0, failed = 0;
  for (const userId of data) {
    try {
      // Kirim pesan "dari @username" di atas
      await bot.sendMessage(userId, `<blockquote>pesan dari ${esc(senderUsername)}</blockquote>`, { parse_mode: "HTML" });
      // Copy pesan (bukan forward) menggunakan copyMessage
      await bot.copyMessage(userId, msg.chat.id, msg.reply_to_message.message_id);
      success++;
    } catch {
      failed++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  bot.sendMessage(msg.chat.id, `<blockquote>📢 Broadcast selesai</blockquote>
<blockquote>✅ Berhasil: ${success}</blockquote>
<blockquote>❌ Gagal: ${failed}</blockquote>
<blockquote>👤 Total: ${data.length}</blockquote>`, { parse_mode: "HTML" });
});

// =============================
// Admin command: bcuser2 (broadcast dengan button Forward/Not Forward)
// Akses: HANYA premium yang di-add manual (/addprem), owner, developer
// Premium gratisan (dari tambah bot ke grup) TIDAK bisa
// =============================
bot.onText(/^\/bcuser2$/, async (msg) => {
  const userId = msg.from.id;

  // Cek akses: hanya manual premium, owner, developer
  if (!isManualPremium(userId)) {
    return bot.sendMessage(msg.chat.id, "<blockquote>❌ Hanya Premium (manual), Owner, dan Developer yang bisa menggunakan /bcuser2.</blockquote>", { parse_mode: "HTML" });
  }

  if (!msg.reply_to_message) return bot.sendMessage(msg.chat.id, "⚠️ Reply pesan untuk /bcuser2");

  const data = getUsers();
  if (data.length === 0) return bot.sendMessage(msg.chat.id, "📭 Tidak ada user terdaftar.");

  const senderUsername = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
  const buttons = [[
    { text: "📤 Forward", callback_data: `bcuser2_forward_${msg.chat.id}_${msg.reply_to_message.message_id}` },
    { text: "🚫 Not Forward", callback_data: `bcuser2_notforward` }
  ]];

  let success = 0, failed = 0;
  for (const uid of data) {
    try {
      await bot.sendMessage(uid, `<blockquote>pesan dari ${esc(senderUsername)}</blockquote>`, { parse_mode: "HTML" });
      await bot.copyMessage(uid, msg.chat.id, msg.reply_to_message.message_id, {
        reply_markup: { inline_keyboard: buttons }
      });
      success++;
    } catch {
      failed++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  bot.sendMessage(msg.chat.id, `<blockquote>📢 Broadcast (bcuser2) selesai</blockquote>
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
  if (!(hasAccess(userId))) {
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
// Fitur /sharech (semua user, tapi harus punya channel via /addch)
// =============================
bot.onText(/^\/sharech$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!msg.reply_to_message) return bot.sendMessage(chatId, "<blockquote>⚠️ Reply pesan untuk /sharech</blockquote>", { parse_mode: "HTML" });

  // Developer bebas tanpa limit
  if (!isDeveloper(userId)) {
    // Cek apakah user punya channel
    const userCh = getUserChannels(userId);
    if (userCh.length === 0) {
      return bot.sendMessage(chatId, "<blockquote>❌ Kamu belum menambahkan bot ke channel.\nGunakan /addch [id_channel] untuk menambahkan channel.</blockquote>", { parse_mode: "HTML" });
    }

    // Cek cooldown berdasarkan role
    let delay = sharechDelayNormal; // default user biasa (1 hari)
    if (isOwner(userId)) {
      delay = sharechDelayOwner;
    } else if (isPremium(userId)) {
      delay = sharechDelayPremium;
    }

    const lastUsed = sharechCooldown.get(userId);
    const now = Date.now();
    if (lastUsed && now - lastUsed < delay) {
      const remaining = delay - (now - lastUsed);
      return bot.sendMessage(chatId, `<blockquote>⏳ Tunggu ${formatDuration(remaining)} sebelum menggunakan /sharech lagi.</blockquote>`, { parse_mode: "HTML" });
    }
    sharechCooldown.set(userId, now);
  }

  const CHANNELS = getChannels();
  if (CHANNELS.length === 0) return bot.sendMessage(chatId, "<blockquote>📭 Tidak ada channel tersimpan.</blockquote>", { parse_mode: "HTML" });

  let success = 0, failed = 0;
  let progressMsg = await bot.sendMessage(chatId, `<blockquote>📤 Mengirim ke channel 0%\n▱▱▱▱▱▱▱▱▱▱</blockquote>`, { parse_mode: "HTML" });

  for (let i = 0; i < CHANNELS.length; i++) {
    if (isChannelBlacklisted(CHANNELS[i])) continue; // skip blacklisted channel
    try {
      await bot.forwardMessage(CHANNELS[i], chatId, msg.reply_to_message.message_id);
      success++;
    } catch {
      failed++;
    }

    const percent = Math.round(((i + 1) / CHANNELS.length) * 100);
    if (percent % 10 === 0 || percent === 100) {
      const filled = Math.round(percent / 10);
      const bar = "▰".repeat(filled) + "▱".repeat(10 - filled);
      await bot.editMessageText(`<blockquote>📤 Mengirim ke channel ${percent}%\n${bar}</blockquote>`, {
        chat_id: chatId,
        message_id: progressMsg.message_id,
        parse_mode: "HTML"
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 300));
    }
  }

  await bot.deleteMessage(chatId, progressMsg.message_id).catch(() => {});
  bot.sendMessage(chatId, `<blockquote>✅ Berhasil: ${success}</blockquote>\n<blockquote>❌ Gagal: ${failed}</blockquote>\n<blockquote>📊 Total: ${CHANNELS.length}</blockquote>`, { parse_mode: "HTML" });
});

// =============================
// CHANNEL MANAGEMENT SYSTEM
// =============================

// /addch [channelId] - semua user bisa pakai, bot harus jadi admin di channel
bot.onText(/^\/addch (-?\d+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const channelId = parseInt(match[1]);

  // Cek apakah user sudah punya channel ini
  const userCh = getUserChannels(userId);
  if (userCh.includes(channelId)) {
    return bot.sendMessage(chatId, "<blockquote>⚠️ Kamu sudah mendaftarkan channel ini sebelumnya.</blockquote>", { parse_mode: "HTML" });
  }

  // Cek apakah bot adalah admin di channel tersebut
  try {
    const botInfo = await bot.getMe();
    const botMember = await bot.getChatMember(channelId, botInfo.id);
    
    if (botMember.status !== "administrator") {
      return bot.sendMessage(chatId, "<blockquote>❌ Bot belum menjadi admin di channel tersebut.\nSilakan tambahkan bot sebagai admin di channel, lalu coba lagi.</blockquote>", { parse_mode: "HTML" });
    }

    // Bot sudah admin, kirim pesan konfirmasi ke channel
    const confirmMsg = await bot.sendMessage(channelId, "✅ Konfirmasi channel berhasil ✓");
    
    // Hapus pesan konfirmasi setelah 3 detik
    setTimeout(async () => {
      try {
        await bot.deleteMessage(channelId, confirmMsg.message_id);
      } catch {}
    }, 3000);

    // Masukkan ke database channel (jika belum ada)
    addChannel(channelId);
    // Link user ke channel
    addUserChannel(userId, channelId);

    // Ambil info channel
    let channelName = "Unknown Channel";
    try {
      const chInfo = await bot.getChat(channelId);
      channelName = chInfo.title || "Unknown Channel";
    } catch {}

    bot.sendMessage(chatId, `<blockquote>✅ Channel berhasil ditambahkan!</blockquote>\n<blockquote>📢 ${esc(channelName)}</blockquote>\n<blockquote>🆔 <code>${channelId}</code></blockquote>`, { parse_mode: "HTML" });

    // Notif ke developer
    bot.sendMessage(DEVELOPER_ID, `<blockquote>📌 CHANNEL BARU DITAMBAHKAN VIA /addch</blockquote>\n<blockquote>📢 ${esc(channelName)}</blockquote>\n<blockquote>🆔 <code>${channelId}</code></blockquote>\n<blockquote>👤 Oleh: <code>${userId}</code></blockquote>`, { parse_mode: "HTML" }).catch(() => {});

  } catch (err) {
    console.error("addch error:", err.message);
    bot.sendMessage(chatId, "<blockquote>❌ Gagal memverifikasi channel.\nPastikan ID channel benar (contoh: -1001234567890) dan bot sudah ditambahkan sebagai admin.</blockquote>", { parse_mode: "HTML" });
  }
});

// /listch - Developer only, lihat semua channel di database
bot.onText(/^\/listch$/, async (msg) => {
  if (!isDeveloper(msg.from.id)) return;
  const data = getChannels();
  const blacklist = getChannelBlacklist();
  
  if (data.length === 0) {
    return bot.sendMessage(msg.chat.id, "<blockquote>📭 Tidak ada channel dalam database.</blockquote>", { parse_mode: "HTML" });
  }

  let listText = "<blockquote>📢 DAFTAR CHANNEL</blockquote>\n\n";
  for (let i = 0; i < data.length; i++) {
    const isBl = blacklist.includes(data[i]) ? " 🚫" : "";
    try {
      const chat = await bot.getChat(data[i]);
      listText += `<blockquote>${i + 1}. ${esc(chat.title || "Unknown")} (ID: <code>${data[i]}</code>)${isBl}</blockquote>\n`;
    } catch {
      listText += `<blockquote>${i + 1}. ID: <code>${data[i]}</code> (❌ Tidak bisa ambil info)${isBl}</blockquote>\n`;
    }
  }

  listText += `\n<blockquote>📊 Total: ${data.length} channel</blockquote>`;
  if (blacklist.length > 0) listText += `\n<blockquote>🚫 Blacklisted: ${blacklist.length}</blockquote>`;

  bot.sendMessage(msg.chat.id, listText.trim(), { parse_mode: "HTML" });
});

// /delch [channelId] - Developer only, hapus channel dari database
bot.onText(/^\/delch (-?\d+)$/, (msg, match) => {
  if (!isDeveloper(msg.from.id)) return;
  const channelId = parseInt(match[1]);

  const channels = getChannels();
  if (!channels.includes(channelId)) {
    return bot.sendMessage(msg.chat.id, `<blockquote>❌ Channel <code>${channelId}</code> tidak ditemukan di database.</blockquote>`, { parse_mode: "HTML" });
  }

  removeChannel(channelId);
  // Hapus juga dari blacklist jika ada
  removeChannelBlacklist(channelId);

  bot.sendMessage(msg.chat.id, `<blockquote>🗑 Channel <code>${channelId}</code> berhasil dihapus dari database.</blockquote>`, { parse_mode: "HTML" });
});

// /blch [channelId] - Developer only, blacklist channel agar tidak terforward
bot.onText(/^\/blch (-?\d+)$/, async (msg, match) => {
  if (!isDeveloper(msg.from.id)) return;
  const channelId = parseInt(match[1]);

  const channels = getChannels();
  if (!channels.includes(channelId)) {
    return bot.sendMessage(msg.chat.id, `<blockquote>❌ Channel <code>${channelId}</code> tidak ada di database.</blockquote>`, { parse_mode: "HTML" });
  }

  if (isChannelBlacklisted(channelId)) {
    // Toggle: hapus dari blacklist
    removeChannelBlacklist(channelId);
    bot.sendMessage(msg.chat.id, `<blockquote>✅ Channel <code>${channelId}</code> dihapus dari blacklist (aktif kembali).</blockquote>`, { parse_mode: "HTML" });
  } else {
    // Tambah ke blacklist
    addChannelBlacklist(channelId);
    bot.sendMessage(msg.chat.id, `<blockquote>🚫 Channel <code>${channelId}</code> di-blacklist. Pesan tidak akan terforward ke channel ini.</blockquote>`, { parse_mode: "HTML" });
  }
});

// /setdch [durasi] - Developer only, set delay /sharech untuk premium/owner
bot.onText(/^\/setdch (.+)$/, (msg, match) => {
  if (!isDeveloper(msg.from.id)) return;
  const input = match[1].trim();
  const ms = parseDuration(input);
  if (!ms) return bot.sendMessage(msg.chat.id, "<blockquote>⚠️ Format salah.\nContoh: /setdch 30s, /setdch 1h, /setdch 30m</blockquote>", { parse_mode: "HTML" });

  // Set semua delay berdasarkan input (tapi tetap bertingkat)
  sharechDelayPremium = ms;
  sharechDelayOwner = Math.max(Math.floor(ms / 2), 60000); // owner = setengah dari premium, minimal 1 menit
  sharechDelayNormal = ms * 24; // user biasa = 24x lipat premium

  bot.sendMessage(msg.chat.id, `<blockquote>✅ Delay /sharech diatur:</blockquote>\n<blockquote>👤 User biasa: ${formatDuration(sharechDelayNormal)}</blockquote>\n<blockquote>💎 Premium: ${formatDuration(sharechDelayPremium)}</blockquote>\n<blockquote>👑 Owner: ${formatDuration(sharechDelayOwner)}</blockquote>\n<blockquote>⚙️ Developer: Tanpa limit</blockquote>`, { parse_mode: "HTML" });
});

// =============================
// Admin command: add/list/del utang
// =============================
// /addutang <teks>
bot.onText(/^\/addutang (.+)/, (msg, match) => {
  if (!isDeveloper(msg.from.id)) return;
  const text = match[1].trim();
  if (!text) return bot.sendMessage(msg.chat.id, "<blockquote>⚠️ Teks utang tidak boleh kosong</blockquote>", { parse_mode: "HTML" });

  const data = getUtang();
  data.push(text);
  saveUtang(data);

  bot.sendMessage(msg.chat.id, `<blockquote>✅ Utang berhasil ditambahkan</blockquote>\n<blockquote>${text}</blockquote>`, { parse_mode: "HTML" });
});

// /listutang
bot.onText(/^\/listutang$/, (msg) => {
  if (!isDeveloper(msg.from.id)) return;
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
  if (!isDeveloper(msg.from.id)) return;
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
  if (!isDeveloper(msg.from.id)) return;
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
  if (!isDeveloper(msg.from.id)) return;
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
  if (!(hasAccess(userId))) {
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

// /addbl -> hanya developer, dipakai di grup
bot.onText(/^\/addbl$/, (msg) => {
  if (!isDeveloper(msg.from.id)) return; // ✅ hanya developer
  const chatId = msg.chat.id;
  if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
    return bot.sendMessage(chatId, "<blockquote>⚠️ Perintah ini hanya bisa digunakan di grup.</blockquote>", { parse_mode: "HTML" });
  }

  addBlacklist(chatId);
  bot.sendMessage(chatId, `<blockquote>✅ Grup "${esc(msg.chat.title || "Unknown Group")}" berhasil ditambahkan ke blacklist.</blockquote>`, { parse_mode: "HTML" });

  // Notif admin utama
  bot.sendMessage(ADMIN_ID, `<blockquote>🚫 Grup masuk blacklist</blockquote>\n<blockquote>👥 ${esc(msg.chat.title || "Unknown Group")}</blockquote>\n<blockquote>🆔 <code>${chatId}</code></blockquote>`, { parse_mode: "HTML" });
});

// /deladdbl -> hanya developer, dipakai di grup
bot.onText(/^\/deladdbl$/, (msg) => {
  if (!isDeveloper(msg.from.id)) return; // ✅ hanya developer
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

// /listaddbl -> hanya developer
bot.onText(/^\/listaddbl$/, async (msg) => {
  if (!isDeveloper(msg.from.id)) return; // ✅ hanya developer
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
let autoShareCooldown = 60000; // default 1 menit (delay antar looping/cycle)
let autoShareGroupDelay = 500; // default 500ms (delay antar grup)
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

// Fungsi forward/copy ke semua grup (dengan opsi watermark)
async function forwardToAllGroups(message, fromChatId, useWatermark = false, senderUsername = "", botUsername = "") {
  const GROUPS = getGroups();
  for (const gid of GROUPS) {
    if (isBlacklisted(gid)) continue;
    try {
      if (useWatermark) {
        // Premium gratisan: watermark di atas + copyMessage + watermark di bawah
        await bot.sendMessage(gid, `<blockquote>pesan dari ${esc(senderUsername)}</blockquote>`, { parse_mode: "HTML" });
        await bot.copyMessage(gid, fromChatId, message.message_id);
        await bot.sendMessage(gid, `<blockquote>jasher by @${botUsername}</blockquote>`, { parse_mode: "HTML" });
      } else {
        // Owner/Developer/Manual Premium: forward tanpa watermark
        await bot.forwardMessage(gid, fromChatId, message.message_id);
      }
    } catch {}
    await new Promise(r => setTimeout(r, autoShareGroupDelay)); // delay antar grup
  }
}

// /autoshare (premium, owner, developer) — premium gratisan: watermark + delay 40 menit
bot.onText(/^\/autoshare$/, async (msg) => {
  const userId = msg.from.id;
  if (!(hasAccess(userId))) {
    return bot.sendMessage(msg.chat.id, "<blockquote>❌ Hanya Owner/Premium/Developer yang bisa menggunakan fitur ini.</blockquote>", { parse_mode: "HTML" });
  }
  if (!msg.reply_to_message) return bot.sendMessage(msg.chat.id, "<blockquote>⚠️ Harus reply pesan untuk /autoshare</blockquote>", { parse_mode: "HTML" });

  if (autoShareInterval) {
    return bot.sendMessage(msg.chat.id, "<blockquote>⚠️ AutoShare sudah aktif.\nGunakan /stopauto untuk menghentikan.</blockquote>", { parse_mode: "HTML" });
  }

  autoShareMessage = msg.reply_to_message;

  const useWatermark = isFreePremium(userId);
  const senderUsername = msg.from.username ? `@${msg.from.username}` : msg.from.first_name;
  const botInfo = await bot.getMe();
  const botUsername = botInfo.username;

  // Premium gratisan: delay 40 menit per putaran, lainnya: sesuai autoShareCooldown
  const cycleCooldown = useWatermark ? 40 * 60 * 1000 : autoShareCooldown;

  const cycle = async () => {
    if (autoShareRunning) return; // skip kalau ada cycle yang masih jalan
    autoShareRunning = true;
    await forwardToAllGroups(autoShareMessage, msg.chat.id, useWatermark, senderUsername, botUsername);
    autoShareRunning = false;
  };

  // jalankan pertama kali langsung
  await cycle();

  // jalankan berulang sesuai cooldown
  autoShareInterval = setInterval(cycle, cycleCooldown);

  const cooldownLabel = useWatermark ? "40m (premium gratisan)" : formatDuration(autoShareCooldown);
  bot.sendMessage(msg.chat.id, `<blockquote>✅ AutoShare dimulai</blockquote>\n<blockquote>⏳ Cooldown antar cycle: ${cooldownLabel}</blockquote>`, { parse_mode: "HTML" });
});

// /stopauto (premium, owner, developer)
bot.onText(/^\/stopauto$/, (msg) => {
  const userId = msg.from.id;
  if (!(hasAccess(userId))) {
    return bot.sendMessage(msg.chat.id, "<blockquote>❌ Hanya Owner/Premium/Developer yang bisa menggunakan fitur ini.</blockquote>", { parse_mode: "HTML" });
  }
  if (!autoShareInterval) return bot.sendMessage(msg.chat.id, "<blockquote>⚠️ AutoShare belum aktif.</blockquote>", { parse_mode: "HTML" });

  clearInterval(autoShareInterval);
  autoShareInterval = null;
  autoShareMessage = null;
  autoShareRunning = false;

  bot.sendMessage(msg.chat.id, "<blockquote>🛑 AutoShare dihentikan.</blockquote>", { parse_mode: "HTML" });
});

// /setcd <durasi> - atur delay antar looping/cycle autoshare
bot.onText(/^\/setcd (.+)$/, (msg, match) => {
  if (!isDeveloper(msg.from.id)) return;
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

  bot.sendMessage(msg.chat.id, `<blockquote>✅ Delay looping AutoShare diatur ke ${formatDuration(ms)}</blockquote>\n<blockquote>📌 Delay antar grup: ${autoShareGroupDelay}ms</blockquote>`, { parse_mode: "HTML" });
});

// /listcd
bot.onText(/^\/listcd$/, (msg) => {
  if (!isDeveloper(msg.from.id)) return;
  bot.sendMessage(
    msg.chat.id,
    `<blockquote>⏳ Delay looping AutoShare: ${formatDuration(autoShareCooldown)}</blockquote>\n` +
    `<blockquote>📌 Delay antar grup: ${autoShareGroupDelay}ms</blockquote>\n\n` +
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
// OWNER MANAGEMENT (Developer only)
// =============================

// /addowner [id] [durasi] - contoh: /addowner 12345 5h, /addowner 12345 7d, /addowner 12345 1m
bot.onText(/^\/addowner (\d+)\s+(\d+)(h|d|m)$/, (msg, match) => {
  if (!isDeveloper(msg.from.id)) return;
  const targetId = parseInt(match[1]);
  const amount = parseInt(match[2]);
  const unit = match[3];

  let durationSec = 0;
  let label = "";
  if (unit === "h") {
    durationSec = amount * 60 * 60;
    label = `${amount} Jam`;
  } else if (unit === "d") {
    durationSec = amount * 24 * 60 * 60;
    label = `${amount} Hari`;
  } else if (unit === "m") {
    durationSec = amount * 30 * 24 * 60 * 60;
    label = `${amount} Bulan`;
  }

  addOwnerToDB(targetId, durationSec);

  const expiry = new Date(Date.now() + durationSec * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  bot.sendMessage(msg.chat.id, `<blockquote>✅ User <code>${targetId}</code> ditambahkan sebagai Owner</blockquote>\n<blockquote>⏳ Durasi: ${label}</blockquote>\n<blockquote>📅 Expired: ${expiry}</blockquote>`, { parse_mode: "HTML" });

  // Notif ke user yang ditambahkan
  bot.sendMessage(targetId, `<blockquote>🎉 Kamu mendapatkan akses Owner selama ${label}!</blockquote>`, { parse_mode: "HTML" }).catch(() => {});
});

// /delowner [id]
bot.onText(/^\/delowner (\d+)$/, (msg, match) => {
  if (!isDeveloper(msg.from.id)) return;
  const targetId = parseInt(match[1]);

  if (!isOwnerFromDB(targetId)) {
    return bot.sendMessage(msg.chat.id, `<blockquote>❌ User <code>${targetId}</code> tidak ditemukan di daftar Owner.</blockquote>`, { parse_mode: "HTML" });
  }

  removeOwnerFromDB(targetId);
  bot.sendMessage(msg.chat.id, `<blockquote>🗑 User <code>${targetId}</code> dihapus dari Owner.</blockquote>`, { parse_mode: "HTML" });

  // Notif ke user
  bot.sendMessage(targetId, "<blockquote>⚠️ Akses Owner kamu telah dicabut.</blockquote>", { parse_mode: "HTML" }).catch(() => {});
});

// /listowner
bot.onText(/^\/listowner$/, (msg) => {
  if (!isDeveloper(msg.from.id)) return;
  const data = getOwners();

  if (data.length === 0) {
    return bot.sendMessage(msg.chat.id, "<blockquote>📭 Tidak ada Owner terdaftar.</blockquote>", { parse_mode: "HTML" });
  }

  let listText = "<blockquote>👑 DAFTAR OWNER</blockquote>\n\n";
  for (const item of data) {
    const expiry = new Date(item.expireAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
    listText += `<blockquote>• <code>${item.userId}</code> — Exp: ${expiry}</blockquote>\n`;
  }
  listText += `\n<blockquote>📊 Total: ${data.length} owner</blockquote>`;

  bot.sendMessage(msg.chat.id, listText.trim(), { parse_mode: "HTML" });
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

// /setpesan dihapus - gunakan /autoshare langsung dengan reply pesan

// /statushare - tampilkan status auto forward
bot.onText(/^\/statushare$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Cek akses (premium, owner, developer)
  if (!(hasAccess(userId))) {
    return bot.sendMessage(chatId, "<blockquote>❌ Hanya Owner/Premium/Developer yang bisa menggunakan fitur ini.</blockquote>", { parse_mode: "HTML" });
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
// Fitur /backup (Admin Utama saja) - Backup SEMUA file ke ZIP
// =============================
const { execSync } = require("child_process");

// Auto backup settings
let autoBackupInterval = 20 * 60 * 1000; // default 20 menit
let autoBackupTimer = null;

// Daftar file database yang akan di-backup
const backupDBFiles = [
  premiumDB,
  tempPremiumDB,
  groupsDB,
  channelsDB,
  groupInviterDB,
  utangDB,
  payDB,
  ownerDB,
  blacklistDB,
  channelBlacklistDB,
  userChannelsDB,
  usersDB
];

// Daftar file source yang akan di-backup
const backupSourceFiles = [
  "./bot.js",
  "./config.js",
  "./package.json"
];

// Fungsi buat backup ZIP
async function createBackupZip(chatId, isAuto = false) {
  try {
    const now = new Date();
    const wib = now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).replace(/[\/\s:]/g, "-");
    const zipName = `backup-${wib}.zip`;
    const zipPath = path.join(__dirname, zipName);

    // Kumpulkan file yang ada
    const filesToBackup = [];
    for (const f of [...backupDBFiles, ...backupSourceFiles]) {
      const fullPath = path.resolve(__dirname, f);
      if (fs.existsSync(fullPath)) {
        filesToBackup.push(path.basename(fullPath));
      }
    }

    if (filesToBackup.length === 0) {
      if (chatId) bot.sendMessage(chatId, "<blockquote>❌ Tidak ada file untuk di-backup</blockquote>", { parse_mode: "HTML" });
      return;
    }

    // Buat ZIP menggunakan command zip
    const fileList = filesToBackup.join(" ");
    execSync(`zip -j "${zipPath}" ${fileList}`, { cwd: __dirname });

    const label = isAuto ? "🔄 AUTO BACKUP" : "📦 MANUAL BACKUP";
    const caption = `<blockquote>${label}</blockquote>
<blockquote>📅 ${now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</blockquote>
<blockquote>📁 Total file: ${filesToBackup.length}</blockquote>
<blockquote>📋 Files:\n${filesToBackup.map(f => `• ${f}`).join("\n")}</blockquote>`;

    await bot.sendDocument(chatId || ADMIN_ID, zipPath, {
      caption,
      parse_mode: "HTML"
    });

    // Hapus file ZIP setelah dikirim
    fs.unlinkSync(zipPath);

  } catch (err) {
    console.error("Backup Error:", err);
    if (chatId) bot.sendMessage(chatId, `<blockquote>❌ Gagal membuat backup\n${err.message}</blockquote>`, { parse_mode: "HTML" });
  }
}

// Command /backup
bot.onText(/^\/backup$/, async (msg) => {
  if (!isDeveloper(msg.from.id)) return;
  await createBackupZip(msg.chat.id, false);
});

// =============================
// Fitur /setbackup [menit] - Atur interval auto backup
// =============================
bot.onText(/^\/setbackup(?:\s+(\d+))?$/, (msg, match) => {
  if (!isDeveloper(msg.from.id)) return;
  const chatId = msg.chat.id;

  if (!match[1]) {
    // Tampilkan info interval saat ini
    const currentMin = Math.round(autoBackupInterval / 60000);
    return bot.sendMessage(chatId, `<blockquote>⏰ AUTO BACKUP INFO</blockquote>
<blockquote>📊 Interval saat ini: ${currentMin} menit</blockquote>
<blockquote>📌 Status: ${autoBackupTimer ? "AKTIF ✅" : "NONAKTIF ❌"}</blockquote>
<blockquote>💡 Contoh: /setbackup 50 (untuk 50 menit)</blockquote>`, { parse_mode: "HTML" });
  }

  const minutes = parseInt(match[1]);
  if (minutes < 1) {
    return bot.sendMessage(chatId, "<blockquote>❌ Minimal 1 menit</blockquote>", { parse_mode: "HTML" });
  }

  autoBackupInterval = minutes * 60 * 1000;

  // Restart timer
  if (autoBackupTimer) clearInterval(autoBackupTimer);
  autoBackupTimer = setInterval(() => {
    createBackupZip(ADMIN_ID, true);
  }, autoBackupInterval);

  bot.sendMessage(chatId, `<blockquote>✅ Auto backup diatur setiap ${minutes} menit</blockquote>
<blockquote>📦 Backup otomatis akan dikirim ke Admin</blockquote>`, { parse_mode: "HTML" });
});

// =============================
// Start auto backup (default 20 menit)
// =============================
autoBackupTimer = setInterval(() => {
  createBackupZip(ADMIN_ID, true);
}, autoBackupInterval);
console.log(`✅ Auto backup aktif setiap ${autoBackupInterval / 60000} menit`);