
const express = require('express');
const path = require("path");
const fs = require("fs");
const moment = require("moment");
const app = express();
const PORT = process.env.PORT || 3000;
const USER_IP_FILE = path.join(__dirname, 'ip_data.json');

// Trust the X-Forwarded-For header from Replit's proxy
app.set('trust proxy', true);

// Load Telegram Bot Configuration from config.json
let config;
try {
    const configFile = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
    config = JSON.parse(configFile);
} catch (error) {
    console.error('Error loading config.json:', error);
    config = {
        telegram: {
            botToken: 'YOUR_BOT_TOKEN_HERE',
            chatId: 'YOUR_CHAT_ID_HERE'
        }
    };
}

const TELEGRAM_BOT_TOKEN = config.telegram.botToken;
const TELEGRAM_CHAT_ID = config.telegram.chatId;

app.use(express.json());
app.use('/music', express.static(path.join(__dirname, 'music')));

app.get("/", async (req, res) => {
    // Track homepage visit
    try {
        const userIp = req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress;
        
        // Load IP data if available
        let ipData = null;
        try {
            if (fs.existsSync(USER_IP_FILE)){
                const ipDataRaw = fs.readFileSync(USER_IP_FILE, "utf8");
                const allIpData = JSON.parse(ipDataRaw);
                ipData = allIpData.find(entry => entry.query === userIp);
            }
        } catch (error) {
            console.error("Error reading IP data:", error);
        }
        
        // Get detailed IP information from API if not cached
        if (!ipData) {
            const ipInfoResponse = await fetch(`http://ip-api.com/json/${userIp}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
            ipData = await ipInfoResponse.json();
            
            // Save to file for future reference
            try {
                let allIpData = [];
                if (fs.existsSync(USER_IP_FILE)) {
                    const existingData = fs.readFileSync(USER_IP_FILE, "utf8");
                    allIpData = JSON.parse(existingData);
                }
                allIpData.push(ipData);
                fs.writeFileSync(USER_IP_FILE, JSON.stringify(allIpData, null, 2));
            } catch (error) {
                console.error("Error saving IP data:", error);
            }
        }
        
        // Send message to Telegram
        const notificationMsg = `🚀 Website Visited!\n\n` +
            `🌐 IP: ${userIp}\n` +
            `📍 Location: ${ipData?.city || 'Unknown'}, ${ipData?.country || 'Unknown'}\n` +
            `🏢 ISP: ${ipData?.isp || 'Unknown'}\n` +
            `📮 ZIP: ${ipData?.zip || 'Unknown'}\n` +
            `⏰ Time: ${moment().format("YYYY-MM-DD HH:mm:ss")}\n` +
            `🌍 Region: ${ipData?.regionName || 'Unknown'}\n` +
            `👀 User Agent: ${req.headers["user-agent"] || 'Unknown'}\n` +
            `🖥️ Path: Homepage Visit`;
        
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(telegramUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: notificationMsg
            })
        });
    } catch (error) {
        console.error("Error tracking homepage visit:", error);
    }
    
    res.sendFile(__dirname + "/index.html");
});

app.get("/random-music", async (req, res) => {
    try {
        const musicDir = path.join(__dirname, 'music');
        const files = fs.readdirSync(musicDir).filter(file => file.endsWith('.mp3'));
        
        if (files.length === 0) {
            return res.status(404).json({ error: "No music files found" });
        }
        
        const randomFile = files[Math.floor(Math.random() * files.length)];
        res.json({ file: randomFile, url: `/music/${randomFile}` });
    } catch (error) {
        console.error("Error reading music directory:", error);
        res.status(500).json({ error: "Error reading music files" });
    }
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
