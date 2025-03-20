import "dotenv/config";
import axios from "axios";
import { google } from "googleapis";

const API_KEY = process.env.YT_API_KEY;
const OSU_API_KEY = process.env.OSU_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const LIVE_CHAT_ID = process.env.YT_LIVE_CHAT_ID;
const youtube = google.youtube({ version: "v3", auth: API_KEY });

const processedMessages = new Set(); // Menyimpan ID pesan yang sudah diproses

async function fetchLiveChatMessages() {
    try {
        const res = await youtube.liveChatMessages.list({
            liveChatId: LIVE_CHAT_ID,
            part: "snippet,authorDetails"
        });

        for (const message of res.data.items) {
            const messageId = message.id;
            if (processedMessages.has(messageId)) continue; // Lewati jika sudah diproses

            const text = message.snippet.displayMessage;
            const username = message.authorDetails.displayName;

            const match = text.match(/^!req (\d+)$/);
            if (match) {
                const beatmapId = match[1];
                processedMessages.add(messageId); // Tandai pesan sebagai sudah diproses
                sendToDiscord(beatmapId, username);
            }
        }
    } catch (error) {
        console.error("Error fetching live chat:", error);
    }
}

async function sendToDiscord(beatmapId, username) {
    try {
        const osuApiUrl = `https://osu.ppy.sh/api/get_beatmaps?k=${OSU_API_KEY}&b=${beatmapId}`;
        const response = await axios.get(osuApiUrl);
        if (response.data.length === 0) return;

        const beatmap = response.data[0];
        const embed = {
            title: `${beatmap.artist} - ${beatmap.title} [${beatmap.version}] (${parseFloat(beatmap.difficultyrating).toFixed(2)}★)`,
            url: `https://osu.ppy.sh/b/${beatmapId}`,
            color: 16711680,
            fields: [
                { name: "Mapper", value: beatmap.creator, inline: true },
                { name: "Star Rating", value: `${parseFloat(beatmap.difficultyrating).toFixed(2)}★`, inline: true },
                { name: "BPM", value: beatmap.bpm, inline: true },
                { name: "Requested by", value: username, inline: false }
            ],
            thumbnail: { url: `https://b.ppy.sh/thumb/${beatmap.beatmapset_id}l.jpg` }
        };

        await axios.post(DISCORD_WEBHOOK, { embeds: [embed] });
        console.log(`Sent ${beatmapId} to Discord from ${username}`);
    } catch (error) {
        console.error("Error sending to Discord:", error);
    }
}

setInterval(fetchLiveChatMessages, 5000);
console.log("Bot started...");
