

// const express = require("express");
// const QRCode = require("qrcode");
// const crypto = require("crypto");

// const app = express();
// const PORT = process.env.PORT || 3000;

// // 1. Dinamik QR verisi üreten API ucu
// app.get("/api/dynamic-qr", async (req, res) => {
//     try {
//         // Her 5 saniyede bir değişen benzersiz token ve zaman damgası
//         const token = crypto.randomBytes(8).toString("hex");
//         const timestamp = Date.now();
        
//         // QR içine gömülecek dinamik hedef adres (örn. tek kullanımlık oturum linki)
//         const targetUrl = `https://www.ercanglobal.com/verify?token=${token}&t=${timestamp}`;

//         // QR kodu base64 formatında oluştur
//         const qrDataUrl = await QRCode.toDataURL(targetUrl, {
//             errorCorrectionLevel: "M",
//             margin: 2,
//             width: 250
//         });

//         res.json({
//             success: true,
//             qrDataUrl,
//             token,
//             timestamp
//         });
//     } catch (err) {
//         console.error("QR oluşturma hatası:", err);
//         res.status(500).json({ success: false, error: "QR oluşturulamadı" });
//     }
// });

// // 2. Kullanıcıya gösterilen ve 5 saniyede bir kodu yenileyen sayfa
// app.get("/qrcode", (req, res) => {
//     res.send(`
//         <!DOCTYPE html>
//         <html lang="tr">
//         <head>
//             <meta charset="UTF-8">
//             <meta name="viewport" content="width=device-width, initial-scale=1.0">
//             <title>Dinamik QR Kodu</title>
//             <style>
//                 body {
//                     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//                     background-color: #f8fafc;
//                     display: flex;
//                     justify-content: center;
//                     align-items: center;
//                     height: 100vh;
//                     margin: 0;
//                 }
//                 .card {
//                     background: #ffffff;
//                     padding: 30px;
//                     border-radius: 16px;
//                     box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
//                     text-align: center;
//                     width: 320px;
//                 }
//                 h2 {
//                     margin-top: 0;
//                     color: #1e293b;
//                     font-size: 20px;
//                 }
//                 .qr-container {
//                     position: relative;
//                     margin: 20px 0;
//                     min-height: 250px;
//                     display: flex;
//                     justify-content: center;
//                     align-items: center;
//                 }
//                 .qr-image {
//                     width: 250px;
//                     height: 250px;
//                     border-radius: 8px;
//                     border: 1px solid #e2e8f0;
//                     transition: opacity 0.3s ease;
//                 }
//                 .fade-out {
//                     opacity: 0.3;
//                 }
//                 .status {
//                     font-size: 13px;
//                     color: #64748b;
//                     margin-top: 10px;
//                 }
//                 .timer-bar-container {
//                     width: 100%;
//                     height: 4px;
//                     background: #e2e8f0;
//                     border-radius: 2px;
//                     overflow: hidden;
//                     margin-top: 15px;
//                 }
//                 .timer-bar {
//                     width: 100%;
//                     height: 100%;
//                     background: #3b82f6;
//                     transition: width 1s linear;
//                 }
//                 .badge {
//                     display: inline-block;
//                     padding: 4px 10px;
//                     background-color: #eff6ff;
//                     color: #1d4ed8;
//                     border-radius: 9999px;
//                     font-size: 12px;
//                     font-weight: 600;
//                     margin-top: 10px;
//                 }
//             </style>
//         </head>
//         <body>
//             <div class="card">
//                 <h2>Güvenli Giriş</h2>
//                 <div class="badge">Otomatik Yenilenir</div>
                
//                 <div class="qr-container">
//                     <img id="qr-code" class="qr-image" src="" alt="Yükleniyor...">
//                 </div>

//                 <div class="status" id="countdown-text">Yeni koda: 5 saniye</div>
                
//                 <div class="timer-bar-container">
//                     <div id="progress" class="timer-bar"></div>
//                 </div>
//             </div>

//             <script>
//                 const INTERVAL_SECONDS = 5;
//                 let remaining = INTERVAL_SECONDS;
//                 const qrImage = document.getElementById("qr-code");
//                 const countdownText = document.getElementById("countdown-text");
//                 const progressBar = document.getElementById("progress");

//                 // QR kodunu arka plandan çeken fonksiyon
//                 async function fetchNewQRCode() {
//                     qrImage.classList.add("fade-out");
//                     try {
//                         const response = await fetch("/api/dynamic-qr");
//                         const data = await response.json();
//                         if (data.success) {
//                             qrImage.src = data.qrDataUrl;
//                         }
//                     } catch (error) {
//                         console.error("Yenileme hatası:", error);
//                     } finally {
//                         qrImage.classList.remove("fade-out");
//                     }
//                 }

//                 // 1 saniyelik sayaç döngüsü
//                 function startCountdown() {
//                     fetchNewQRCode(); // Sayfa açılır açılmaz ilk kodu yükle

//                     setInterval(() => {
//                         remaining--;
//                         countdownText.innerText = "Yeni koda: " + remaining + " saniye";
//                         progressBar.style.width = ((remaining / INTERVAL_SECONDS) * 100) + "%";

//                         if (remaining <= 0) {
//                             remaining = INTERVAL_SECONDS;
//                             fetchNewQRCode();
//                         }
//                     }, 1000);
//                 }

//                 startCountdown();
//             </script>
//         </body>
//         </html>
//     `);
// });

// app.listen(PORT, () => {
//     console.log(`Sunucu çalışıyor: http://localhost:${PORT}/qrcode`);
// });





const express = require("express");
const QRCode = require("qrcode"); // Modül isimlerinde genelde CamelCase veya PascalCase tercih edilir

const app = express();
const PORT = process.env.PORT || 3000; // Portu esnek hale getirdik

app.get("/qrcode", async (req, res) => {
    // URL'yi dinamik yaptık: ?url=https://baska-site.com yazılmazsa varsayılan siteyi alır
    const url = req.query.url || "https://www.ercanglobal.com";

    try {
        // Callback yerine daha temiz olan async/await yapısını kullandık
        const qrCodeUrl = await QRCode.toDataURL(url);
        
        // Çok satırlı metin ve değişken kullanımı için backtick (`) kullandık
        res.send(`
            <!DOCTYPE HTML>
            <html lang="tr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>QR Kodu Oluşturucu</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            text-align: center;
                            background-color: #f4f4f9;
                            padding-top: 50px;
                        }
                        img {
                            border: 2px solid #ddd;
                            padding: 10px;
                            background: #fff;
                            border-radius: 10px;
                            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                        }
                    </style>
                </head>
                <body>
                    <h1>QR Kodu Oluşturucu</h1>
                    <img src="${qrCodeUrl}" alt="${url} için QR Kod">
                    <p><strong>${url}</strong> adresini ziyaret etmek için QR kodu tarayın.</p>
                </body>
            </html>
        `);
    } catch (err) {
        console.error("QR Kod oluşturulurken hata meydana geldi:", err);
        res.status(500).send("Internal Server Error (Sunucu Hatası)");
    }
});

app.listen(PORT, () => {
    // Değişkeni okuyabilmesi için backtick (`) kullandık
    console.log(`Server is running on port http://localhost:${PORT}`);
});