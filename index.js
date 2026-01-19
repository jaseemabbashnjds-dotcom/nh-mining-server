const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- 🛠️ CONFIGURATION ---
app.use(express.json()); 
app.use(cors());

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Home Route (Browser Check)
app.get('/', (req, res) => {
  res.send('NH Mining Server is Running! 🚀 (Mining + Wallet + Leaderboard Ready)');
});

// 2. Mining Route (App Mining Request)
app.post('/api/claim', async (req, res) => {
  try {
    console.log("📥 Incoming Mining Request:", req.body);
    const { userId, amount } = req.body;

    // Validation
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Database Insert
    const { data, error } = await supabase
      .from('inventory')
      .insert([
        { 
          user_id: userId, 
          serial_no: `NH-${Date.now()}`, 
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

// 3. WALLET ROUTE (My Notes)
app.get('/api/wallet/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Sirf uss user ka data laao
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data);

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// 4. 🏆 LEADERBOARD ROUTE (Top Miners)
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Inventory se sirf user_id aur amount nikalo
    const { data, error } = await supabase
      .from('inventory')
      .select('user_id, amount');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // --- Calculation Logic (Server side) ---
    // Hum data ko group karke count karenge ki kiske paas kitna hai
    const counts = {};
    
    data.forEach(item => {
      // Agar user pehle se list mein hai toh add karo, nahi toh new entry
      counts[item.user_id] = (counts[item.user_id] || 0) + item.amount;
    });

    // Object ko Array mein convert karo aur Sort karo (Sabse zyada wala upar)
    const leaderboard = Object.keys(counts)
      .map(userId => ({
        userId: userId,
        balance: counts[userId]
      }))
      .sort((a, b) => b.balance - a.balance) // High to Low
      .slice(0, 50); // Sirf Top 50 log dikhao

    res.status(200).json(leaderboard);

  } catch (err) {
    console.error("🔥 Leaderboard Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Server Start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
