const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "JaparQrSystemDb",
  password: "Kerem2727*.",
  port: 5432,
});

async function migratePasswords() {
  try {
    const res = await pool.query("SELECT id, password_hash FROM employees");

    for (const emp of res.rows) {
      // Eğer şifre zaten $2a$ veya $2b$ ile başlamıyorsa (yani hash'lenmemişse)
      if (!emp.password_hash.startsWith("$2")) {
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(emp.password_hash, salt);

        await pool.query(
          "UPDATE employees SET password_hash = $1 WHERE id = $2",
          [hashed, emp.id]
        );
        console.log(`ID ${emp.id} kullanıcısının şifresi başarıyla hash'lendi.`);
      }
    }
    console.log("Tüm şifreler başarıyla güncellendi.");
  } catch (err) {
    console.error("Hata:", err);
  } finally {
    await pool.end();
  }
}

migratePasswords();