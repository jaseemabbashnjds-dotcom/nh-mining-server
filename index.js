const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Supabase Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Home Route
app.get('/', (req, res) => {
  res.send('NH Mining Server is Running! 🚀');
});

// 2. Claim Mining Route
app.post('/api/claim', async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ error: 'User ID aur Amount zaroori hai' });
  }

  try {
    // Check User
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('balance, total_notes')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    let newBalance = amount;
    let newNotes = 1;

    if (user) {
      newBalance = parseFloat(user.balance) + parseFloat(amount);
      newNotes = user.total_notes + 1;
      
      // Update User
      const { error: updateError } = await supabase
        .from('users')
        .update({ balance: newBalance, total_notes: newNotes })
        .eq('user_id', userId);
      if (updateError) throw updateError;
    } else {
      // Create New User
      const { error: insertError } = await supabase
        .from('users')
        .insert([{ user_id: userId, balance: amount, total_notes: 1 }]);
      if (insertError) throw insertError;
    }

    // Add to Inventory
    await supabase.from('inventory').insert([
      { user_id: userId, amount: amount, serial_no: '#NOTE' + Date.now() }
    ]);

    res.json({ success: true, newBalance });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
