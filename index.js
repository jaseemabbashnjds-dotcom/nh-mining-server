const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Config
app.use(express.json()); 
app.use(cors());

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. HOME ROUTE
app.get('/', (req, res) => {
  res.send('NH Mining Server 2.0 is Running! (With 1000 Bonus System) 🚀');
});

// 2. REGISTER / LOGIN ROUTE (Auto 1000 Bonus Logic)
app.post('/api/register', async (req, res) => {
  const { uid, email, username } = req.body;

  try {
    // Check karo user pehle se hai kya?
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();

    if (existingUser) {
      // User purana hai -> Bas Success bhejo (Bonus mat do)
      return res.status(200).json({ success: true, message: existingUser.username });
    }

    // User naya hai -> Create karo + 1000 Bonus do
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ 
        uid: uid, 
        email: email, 
        username: username,
        balance: 1000, // 🎁 1000 BONUS
        today_taps: 0
      }]);

    if (insertError) throw insertError;

    res.status(200).json({ success: true, message: username });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. MINING ROUTE (Ab ye sirf +1 karega)
app.post('/api/claim', async (req, res) => {
  const { userId, amount } = req.body; // userId yahan UID hai
  
  try {
    // Database me balance badhao (RPC function ki zaroorat nahi, simple update)
    // Pehle current balance nikalo
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('balance')
      .eq('uid', userId)
      .single();
      
    if (fetchError) throw fetchError;

    const newBalance = (user.balance || 0) + (amount || 1);

    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('uid', userId);

    if (updateError) throw updateError;

    res.status(200).json({ success: true, message: "Mined" });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. MINING STATS (App khulte waqt data lene ke liye)
app.post('/api/mining-stats', async (req, res) => {
  const { uid } = req.body;
  try {
    // 1. User ka data lao
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();

    if (error) throw error;

    // 2. Global Circulation nikalo (Sabka total)
    // Note: Iske liye hum ek RPC function use kar sakte hain, par abhi simple query chalayenge
    const { data: globalData, error: globalError } = await supabase
      .from('users')
      .select('balance');
    
    // Javascript me total jod lo (Agar users kam hain to ye theek hai)
    // Users badhne par hum SQL function banayenge.
    let globalCirculation = 0;
    if (globalData) {
      globalCirculation = globalData.reduce((acc, curr) => acc + (curr.balance || 0), 0);
    }

    res.status(200).json({
      success: true,
      totalNotes: user.balance,
      currentTaps: user.today_taps,
      maxTaps: 5000, // Hardcoded for now
      streak: 1, // Logic baad me daalenge
      referralCount: 0,
      globalCirculation: globalCirculation
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. SYNC TAPS (App band hone par taps save karna)
app.post('/api/sync-taps', async (req, res) => {
  const { uid, taps } = req.body;
  try {
    const { error } = await supabase
      .from('users')
      .update({ today_taps: taps })
      .eq('uid', uid);

    if (error) throw error;
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
