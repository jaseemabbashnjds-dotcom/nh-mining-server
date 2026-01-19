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

// 1. Home Route
app.get('/', (req, res) => {
  res.send('NH Mining Server is Running! 🚀 (Monthly Leaderboard Active)');
});

// 2. Mining Route (Ye data banata hai)
app.post('/api/claim', async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId) return res.status(400).json({ error: "User ID missing" });

    const { data, error } = await supabase
      .from('inventory')
      .insert([{ 
          user_id: userId, 
          serial_no: `NH-${Date.now()}`, 
          amount: amount || 1.0,
          created_at: new Date()
        }]);

    if (error) throw error;
    res.status(200).json({ message: "Mining Successful", data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. WALLET ROUTE (Ye kabhi reset nahi hoga - Lifetime Earning)
app.get('/api/wallet/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json(data);

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// 4. 🏆 LEADERBOARD ROUTE (Monthly Reset + Top 10)
app.get('/api/leaderboard', async (req, res) => {
  try {
    // --- 🗓️ MONTHLY RESET LOGIC ---
    const now = new Date();
    // Iss mahine ki 1st tareekh nikalo (Example: Feb 1st 00:00:00)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    console.log(`🏆 Fetching Leaderboard data since: ${startOfMonth}`);

    // Database se sirf wo data mango jo "Start of Month" ke baad bana hai
    const { data, error } = await supabase
      .from('inventory')
      .select('user_id, amount')
      .gte('created_at', startOfMonth); // gte = Greater Than Equal (Isse naya)

    if (error) return res.status(500).json({ error: error.message });

    // --- Counting Logic ---
    const counts = {};
    data.forEach(item => {
      counts[item.user_id] = (counts[item.user_id] || 0) + item.amount;
    });

    // --- Top 10 Sorting ---
    const leaderboard = Object.keys(counts)
      .map(userId => ({
        userId: userId,
        balance: counts[userId]
      }))
      .sort((a, b) => b.balance - a.balance) // Sabse zyada wala upar
      .slice(0, 10); // 🔥 SIRF TOP 10 DIKHAO

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