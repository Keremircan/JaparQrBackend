const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
// Dokümantasyondaki güncel içe aktarma yöntemi:
const { authenticator } = require('@otplib/preset-default');

const app = express();
app.use(cors());
app.use(express.json());

// --- SİSTEM AYARLARI ---
// 10 saniyede bir kod değişir, +-10 saniye ağ toleransı bırakılır
authenticator.options = { step: 50, window: 1 };

// Gizli anahtarlar
const TOTP_SECRET = authenticator.generateSecret(); 
const AES_KEY = crypto.randomBytes(32); 

// --- YARDIMCI FONKSİYONLAR ---
function generateQRData(factoryId, deviceId) {
    const token = authenticator.generate(TOTP_SECRET);
    const payload = JSON.stringify({ t: token, f: factoryId, d: deviceId });

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

function verifyQRData(qrString) {
    try {
        const [ivHex, encryptedHex, authTagHex] = qrString.split(':');
        const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, Buffer.from(ivHex, 'hex'));
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        const payload = JSON.parse(decrypted);

        // Kodun geçerli ve son 10 saniye içinde olup olmadığını kontrol et
        const isValid = authenticator.check(payload.t, TOTP_SECRET);

        if (!isValid) {
            return { success: false, reason: "Karekodun süresi dolmuş veya geçersiz." };
        }

        return { success: true, data: payload };
    } catch (error) {
        return { success: false, reason: "Güvenlik İhlali: Bozuk veya geçersiz kod yapısı." };
    }
}

// --- API UÇ NOKTALARI (ENDPOINTS) ---
// Mobil uygulamanın kamerayla okutup POST edeceği adres
app.post('/api/verify', (req, res) => {
    const { qrData, employeeId, hardwareId } = req.body;

    if (!qrData || !employeeId || !hardwareId) {
        return res.status(400).json({ success: false, message: "Eksik parametre gönderildi." });
    }

    const verification = verifyQRData(qrData);

    if (!verification.success) {
        return res.status(403).json({ success: false, message: verification.reason });
    }

    return res.status(200).json({
        success: true,
        message: "Giriş işlemi başarıyla kaydedildi.",
        factory: verification.data.f,
        gate: verification.data.d,
        employee: employeeId,
        time: new Date().toISOString()
    });
});


// --- SUNUCUYU ÇALIŞTIR ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} portunda başarıyla ayağa kalktı.`);
});
