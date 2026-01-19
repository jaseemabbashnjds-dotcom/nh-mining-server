const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- 🛠️ YE LINE SABSE ZAROORI HAI (Iske bina 400 error aata hai) ---
app.use(express.json()); 
app.use(cors());

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Home Route (Browser Check)
app.get('/', (req, res) => {
  res.send('NH Mining Server is Running! 🚀');
});

// 2. Mining Route (App Request)
app.post('/api/claim', async (req, res) => {
  try {
    console.log("📥 Incoming Request Body:", req.body); // Ye Logs mein dikhega

    const { userId, amount } = req.body;

    // Validation
    if (!userId) {
      console.log("❌ Error: UserId missing");
      return res.status(400).json({ error: "User ID is required" });
    }

    // Database Insert
    const { data, error } = await supabase
      .from('inventory')
      .insert([
        { 
          user_id: userId, 
          serial_no: `NH-${Date.now()}`, // Unique Serial
          amount: amount || 1.0,
          created_at: new Date()
        }
      ]);

    if (error) {
      console.error("🔥 Supabase Error:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log("✅ Success! Note Minted for:", userId);
    res.status(200).json({ message: "Mining Successful", data });

  } catch (err) {
    console.error("🔥 Server Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Server Start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});