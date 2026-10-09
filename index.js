const express = require("express");
const cors = require("cors");
const CryptoJS = require("crypto-js");
const OTPAuth = require("otpauth");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// ========================================================
// 1. POSTGRESQL BAĞLANTISI
// ========================================================
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "JaparQrSystemDb",
  password: "Kerem2727*.",
  port: 5432,
});

pool.on("connect", () => {
  console.log("PostgreSQL veritabanına başarıyla bağlanıldı.");
});

// ========================================================
// 2. SİSTEM AYARLARI (KioskScreen ile BİREBİR AYNI)
// ========================================================
const SHARED_SECRET_BASE32 = "JBSWY3DPEHPK3PXP";
const AES_SECRET_KEY = "12345678901234567890123456789012";

const totp = new OTPAuth.TOTP({
  issuer: "FactorySystem",
  label: "Gate-01",
  algorithm: "SHA256",
  digits: 6,
  period: 10,
  secret: OTPAuth.Secret.fromBase32(SHARED_SECRET_BASE32),
});

// Çift okutma engeli (Replay Attack) için RAM belleği
const usedTokens = new Set();

// ========================================================
// 3. DOĞRULAMA VE ŞİFRE ÇÖZME FONKSİYONU
// ========================================================
function verifyQRData(qrString) {
  try {
    const bytes = CryptoJS.AES.decrypt(qrString, AES_SECRET_KEY);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedText) {
      return {
        success: false,
        reason: "Güvenlik İhlali: Şifre çözülemedi veya anahtar uyuşmuyor.",
      };
    }

    const payload = JSON.parse(decryptedText);

    const delta = totp.validate({
      token: payload.t,
      window: 1, // +- 10 saniyelik ağ gecikmesi payı
    });

    if (delta === null) {
      return {
        success: false,
        reason: "Karekodun süresi dolmuş veya geçersiz.",
      };
    }

    return {
      success: true,
      data: {
        token: payload.t,
        factoryId: payload.f,
        gateId: payload.d,
      },
    };
  } catch (error) {
    console.error("Doğrulama hatası:", error);
    return {
      success: false,
      reason: "Güvenlik İhlali: Bozuk karekod formatı.",
    };
  }
}

// ========================================================
// 4. API UÇ NOKTASI (POST /api/verify)
// ========================================================

app.post("/api/verify", async (req, res) => {
  const { qrData, employeeId, hardwareId, type = "IN" } = req.body;

  if (!qrData || !employeeId || !hardwareId) {
    return res
      .status(400)
      .json({ success: false, message: "Eksik parametre gönderildi." });
  }

  // 1. QR Kod Çözme ve Süre Kontrolü
  const verification = verifyQRData(qrData);
  if (!verification.success) {
    return res
      .status(403)
      .json({ success: false, message: verification.reason });
  }

  const { token, factoryId, gateId } = verification.data;

  // 2. Çift Okutma (Replay Attack) Kontrolü
  if (usedTokens.has(token)) {
    return res.status(409).json({
      success: false,
      message: "Güvenlik Uyarısı: Bu karekod az önce kullanıldı!",
    });
  }
  // Kodu 55 saniye belleğe kilitle
  usedTokens.add(token);
  setTimeout(() => {
    usedTokens.delete(token);
  }, 10000);

  try {
    // 3. PostgreSQL Personel Sorgusu (registered_hardware_id sütununa göre)
    const empQuery = await pool.query(
      "SELECT id, employee_code, full_name, registered_hardware_id, is_active FROM employees WHERE employee_code = $1",
      [employeeId],
    );

    if (empQuery.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Personel bulunamadı." });
    }

    const employee = empQuery.rows[0];

    if (!employee.is_active) {
      return res
        .status(403)
        .json({ success: false, message: "Personel hesabı pasif durumda." });
    }

    // 4. Cihaz Kilitleme (Hardware Binding) Kontrolü
    if (!employee.registered_hardware_id) {
      await pool.query(
        "UPDATE employees SET registered_hardware_id = $1 WHERE id = $2",
        [hardwareId, employee.id],
      );
      console.log(
        `[DB Cihaz Kilitlendi] ${employee.full_name} -> ${hardwareId}`,
      );
    } else if (employee.registered_hardware_id !== hardwareId) {
      return res.status(403).json({
        success: false,
        message:
          "Yetkisiz Cihaz: Kayıtlı telefonunuz dışındaki bir cihazdan işlem yapılamaz!",
      });
    }

    // Personelin bugünkü en son hareketini sorgula
    const lastLogResult = await pool.query(
      `SELECT log_type 
     FROM attendance_logs 
     WHERE employee_code = $1 
       AND created_at::date = CURRENT_DATE 
     ORDER BY created_at DESC 
     LIMIT 1`,
      [employeeId],
    );

    const lastLog = lastLogResult.rows[0];

    // Kural Kontrolleri
    if (lastLog) {
      if (lastLog.log_type === "IN" && type === "IN") {
        return res.status(400).json({
          success: false,
          message:
            "Zaten içeridesiniz! Tekrar giriş yapmadan önce çıkış yapmalısınız.",
        });
      }

      if (lastLog.log_type === "OUT" && type === "OUT") {
        return res.status(400).json({
          success: false,
          message:
            "Zaten çıkış yapmış durumdasınız! Tekrar çıkış yapmadan önce giriş yapmalısınız.",
        });
      }
    } else {
      // Günün İLK hareketi kontrolü:
      // Personel günün ilk hareketinde 'OUT' (çıkış) yapmaya çalışırsa engelleyelim
      if (type === "OUT") {
        return res.status(400).json({
          success: false,
          message:
            "Bugün henüz giriş kaydınız bulunmuyor. Önce giriş yapmalısınız.",
        });
      }
    }

    // 5. Giriş/Çıkış Hareketini attendance_logs Tablosuna Kaydet
    const logQuery = await pool.query(
      `INSERT INTO attendance_logs (employee_code, factory_id, gate_id, hardware_id, log_type) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, created_at`,
      [employee.employee_code, factoryId, gateId, hardwareId, type],
    );

    const logRecord = logQuery.rows[0];
    console.log(
      `[DB Kayıt Başarılı] ID: ${logRecord.id} | ${type} | ${employee.full_name} | Kapı: ${gateId}`,
    );

    return res.status(200).json({
      success: true,
      message: `${type === "IN" ? "Giriş" : "Çıkış"} başarıyla onaylandı ve kaydedildi.`,
      gate: gateId,
    });
  } catch (dbError) {
    console.error("Veritabanı Hatası:", dbError);
    return res
      .status(500)
      .json({ success: false, message: "Sunucu veritabanı hatası oluştu." });
  }
});
// POST /api/login
app.post("/api/login", async (req, res) => {
  const { employeeCode, password } = req.body;

  if (!employeeCode || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Sicil no ve şifre gereklidir." });
  }

  try {
    const result = await pool.query(
      "SELECT id, employee_code, full_name, password_hash, is_active, department, job, shift, shift_type FROM employees WHERE employee_code = $1",
      [employeeCode],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Kullanıcı bulunamadı." });
    }

    const employee = result.rows[0];

    if (!employee.is_active) {
      return res
        .status(403)
        .json({ success: false, message: "Hesabınız pasif durumdadır." });
    }

    // Şimdilik düz metin kontrolü (İleride bcrypt.compare yapabilirsiniz)
    if (employee.password_hash !== password) {
      return res
        .status(401)
        .json({ success: false, message: "Hatalı şifre girdiniz." });
    }

    return res.json({
      success: true,
      message: "Giriş başarılı.",
      user: {
        id: employee.id,
        employeeCode: employee.employee_code,
        fullName: employee.full_name,
        department: employee.department,
        job: employee.job,
        shift: employee.shift,
        shift_type: employee.shift_type
      },
    });
  } catch (error) {
    console.error("Login Hatası:", error);
    return res
      .status(500)
      .json({ success: false, message: "Sunucu hatası oluştu." });
  }
});

app.post("/api/listLogs", async (req, res) => {
  const { employeeCode } = req.body;

  if (!employeeCode) {
    return res
      .status(400)
      .json({ success: false, message: "Sicil no gereklidir." });
  }

  try {
    const result = await pool.query(
      `SELECT id, gate_id, log_type, created_at FROM attendance_logs WHERE employee_code = $1 AND created_at::date = CURRENT_DATE
        ORDER BY created_at DESC`,
      [employeeCode],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Hiç kayıt yok." });
    }

    const logList = result.rows.map((row) => ({
      id: row.id,
      gate: row.gate_id,
      type: row.log_type,
      time: new Date(row.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    return res.json({
      success: true,
      logList: logList,
    });
  } catch (error) {
    console.error("Log Listeleme Hatası:", error);
    return res
      .status(500)
      .json({ success: false, message: "Sunucu hatası oluştu." });
  }
});
// ========================================================
// 5. SUNUCUYU BAŞLAT
// ========================================================
const PORT = 3000;
// Dış bağlantıları (iPhone) rahat karşılaması için '0.0.0.0' eklendi
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Sunucu http://0.0.0.0:${PORT} üzerinde aktif (PostgreSQL entegrasyonu hazır).`,
  );
});
