import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";

const app=express();
dotenv.config();

console.log("MongoDB URI:", process.env.MONGODB_URI);
console.log("JWT Secret:", process.env.JWT_SECRET);


app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

const PORT=process.env.PORT || 5000;
const MONGOURL = process.env.MONGODB_URI || "mongodb+srv://parvathybala842:Parvathybala@cluster0.ogeih.mongodb.net/bank?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGOURL)
  .then(() => {
    console.log("Database connected successfuly");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((error) => {
    console.error("MongoDB connection error details:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    if (error.reason) console.error("Error reason:", error.reason);
    process.exit(1); 
  });

// Transaction Schema
const transactionSchema = new mongoose.Schema({
  username: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'withdraw', 'transfer'], required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

// User Schema
const userSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    default: () => new mongoose.Types.ObjectId().toString(), 
    unique: true 
  },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  accountNumber: { type: String },
  branchName: { type: String },
  balance: { type: Number, default: 0 },
  name: { type: String },
  dob: { type: String },
  father_name: { type: String },
  phone: { type: String },
  email: { type: String, required: true, unique: true },
  gender: { type: String },
  address: { type: String },
  account_type: { type: String },
  transactions: [{
    type: { type: String },
    amount: { type: Number },
    date: { type: Date, default: Date.now }
  }]
});

const User = mongoose.model("User", userSchema);

// Authentication Middleware
// const authenticateUser = (req, res, next) => {
//   try {
//     const token = req.header("Authorization");
//     if (!token) return res.status(401).json({ message: "Access denied" });

//     const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
//     req.user = decoded;
//     next();
//   } catch (error) {
//     return res.status(403).json({ message: "Invalid token", error: error.message });
//   }
// };

// Register Route
app.post("/api/register", async (req, res) => {
  try {
      const { username, email, password, confirmPassword} = req.body;
      
      if (!username ||!email || !password || !confirmPassword) {
        return res.status(400).json({message: "All fields are required"});
      }

      if(password !== confirmPassword) {
        return res.status(400).json({message: "Passwords do not match"});
      }
      const existingUser = await User.findOne({username});
      if(existingUser) {
        return res.status(400).json({message: "Username already exists"});
      }
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser=new User({username, email, password: hashedPassword});
      await newUser.save();
      console.log("User registered:", newUser);
      res.status(201).json({message: "User registered successfully"});
    } catch (error) {
      res.status(500).json({message: "Registration error", error: error.message});
    }
  });
     
// Login Route
app.post("/api/login", async (req, res) => {
  try {
      const { username, password } = req.body;
      const user = await User.findOne({ username });
      if (!user || !(await bcrypt.compare(password, user.password))) {
          return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.status(200).json({ message: "Login successful", token: `Bearer ${token}` });
  } catch (error) {
      res.status(500).json({ message: "Login error", error: error.message });
  }
});

//user details route
app.post("/api/user-details/:username", async (req, res) => {
  try {
    const { username } = req.params;
    console.log("URL Parameter username:", username);
    
    const {
      accountNumber,
      branchName,
      name,
      dob,
      father_name,
      phone,
      email,
      gender,
      address,
      account_type
    } = req.body;
    
    // Use trimmed username (optionally, lowercased if needed)
    const queryUsername = username.trim(); // or username.trim().toLowerCase();
    const user = await User.findOne({ username: queryUsername });
    if (!user) {
      console.error("User not found for username:", queryUsername);
      return res.status(404).json({ message: "User not found" });
    }
    
    // Update user details
    user.accountNumber = accountNumber;
    user.branchName = branchName;
    user.name = name;
    user.dob = dob;
    user.father_name = father_name;
    user.phone = phone;
    user.email = email;
    user.gender = gender;
    user.address = address;
    user.account_type = account_type;

    await user.save();
    console.log("User details updated successfully for:", queryUsername);
    res.status(200).json({ message: "User details saved successfully" });
  } catch (error) {
    console.error("Error saving user details:", error);
    res.status(500).json({ message: "Error saving user details", error: error.message });
  }
});

// Deposit Route
app.post("/deposit", async (req, res) => {
  try {
      const { amount } = req.body;
      if (amount <= 0) return res.status(400).json({ message: "Invalid amount" });
      const user = await User.findOne({ username: req.user.username });
      user.balance += amount;
      const transaction = new Transaction({ username: username, type: 'deposit', amount });
      await transaction.save();
      user.transactions.push(transaction._id);
      await user.save();
      res.status(200).json({ message: "Deposit successful", balance: user.balance });
  } catch (error) {
      res.status(500).json({ message: "Deposit error", error: error.message });
  }
});

// Withdraw Route
app.post("/withdraw", async (req, res) => {
  try {
      const { amount } = req.body;
      const user = await User.findOne({ username: req.user.username });
      if (user.balance < amount) return res.status(400).json({ message: "Insufficient balance" });
      user.balance -= amount;
      const transaction = new Transaction({ username: username, type: 'withdraw', amount });
      await transaction.save();
      user.transactions.push(transaction._id);
      await user.save();
      res.status(200).json({ message: "Withdrawal successful", balance: user.balance });
  } catch (error) {
      res.status(500).json({ message: "Withdrawal error", error: error.message });
  }
});

// Transfer Route
app.post("/api/transfer", async (req, res) => {
  const { sender, recipient, amount } = req.body;

  if (!sender || !recipient || !amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "Invalid input!" });
}
try {
  const senderUser = await User.findOne({ accountNumber: sender });
  const recipientUser = await User.findOne({ accountNumber: recipient });

  if (!senderUser) return res.status(404).json({ success: false, message: "Sender not found!" });
  if (!recipientUser) return res.status(404).json({ success: false, message: "Recipient not found!" });
  if (senderUser.balance < amount) return res.status(400).json({ success: false, message: "Insufficient balance!" });

  // Perform Transfer
  senderUser.balance -= amount;
  recipientUser.balance += amount;

  // Save Transactions
  senderUser.transactions.push({ type: "Sent", amount, date: new Date(), to: recipientUser.name });
  recipientUser.transactions.push({ type: "Received", amount, date: new Date(), from: senderUser.name });

  await senderUser.save();
  await recipientUser.save();

  res.json({ success: true, message: "Transfer Successful!" });
} catch (error) {
  console.error("Transfer Error:", error);
  res.status(500).json({ success: false, message: "Server error!" });
}
});

// Transaction History
app.post('/api/transaction/:type', async (req, res) => {
  const { type } = req.params;
  const { username, amount } = req.body;
  const user = await User.findOne({ username });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (type === 'withdraw' && user.balance < amount) {
    return res.status(400).json({ message: "Insufficient balance" });
  }

  // Update balance
  if (type === 'deposit') {
    user.balance += amount;
  } else if (type === 'withdraw') {
    user.balance -= amount;
  }

  // Add transaction
  user.transactions.push({ type, amount });
  await user.save();
  res.status(200).json({ message: "Transaction successful" });
});

app.get('/api/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      accountNumber: user.accountNumber,
      branchName: user.branchName,
      balance: user.balance,
      name: user.name,
      dob: user.dob,
      father_name: user.father_name,
      phone: user.phone,
      email: user.email,
      gender: user.gender,
      address: user.address,
      account_type: user.account_type,
      transactions: user.transactions
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user data" });
  }
});

app.post("/api/user-details", async (req, res) => {
  try {
    const {
      username,
      accountNumber,
      branchName,
      name,
      dob,
      father_name,
      phone,
      email,
      gender,
      address,
      account_type
    } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user details
    user.accountNumber = accountNumber;
    user.branchName = branchName;
    user.name = name;
    user.dob = dob;
    user.father_name = father_name;
    user.phone = phone;
    user.email = email;
    user.gender = gender;
    user.address = address;
    user.account_type = account_type;

    await user.save();
    res.status(200).json({ message: "User details saved successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error saving user details", error: error.message });
  }
});



