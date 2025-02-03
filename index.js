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

app.use(express.json());
app.use(cors());

const PORT=process.env.PORT || 6000;
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
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'withdraw', 'transfer'], required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

// User Schema
const userSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  userId: { type: String, unique: true, required: true },
  balance: { type: Number, default: 0 },
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }]
});
const User = mongoose.model("User", userSchema);

// Authentication Middleware
const authenticateUser = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ message: "Access denied" });
  try {
      const decoded = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET);
      req.user = decoded;
      next();
  } catch (error) {
      res.status(400).json({ message: "Invalid token" });
  }
};

// Register Route
app.post("/register", async (req, res) => {
  try {
      const { fullname, email, password, userId } = req.body;
      if (await User.findOne({ $or: [{ email }, { userId }] })) {
          return res.status(400).json({ message: "User already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ fullname, email, password: hashedPassword, userId });
      await newUser.save();
      res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
      res.status(500).json({ message: "Registration error", error: error.message });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  try {
      const { userId, password } = req.body;
      const user = await User.findOne({ userId });
      if (!user || !(await bcrypt.compare(password, user.password))) {
          return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = jwt.sign({ userId: user.userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.status(200).json({ message: "Login successful", token: `Bearer ${token}` });
  } catch (error) {
      res.status(500).json({ message: "Login error", error: error.message });
  }
});

// Deposit Route
app.post("/deposit", authenticateUser, async (req, res) => {
  try {
      const { amount } = req.body;
      if (amount <= 0) return res.status(400).json({ message: "Invalid amount" });
      const user = await User.findOne({ userId: req.user.userId });
      user.balance += amount;
      const transaction = new Transaction({ userId: user._id, type: 'deposit', amount });
      await transaction.save();
      user.transactions.push(transaction._id);
      await user.save();
      res.status(200).json({ message: "Deposit successful", balance: user.balance });
  } catch (error) {
      res.status(500).json({ message: "Deposit error", error: error.message });
  }
});

// Withdraw Route
app.post("/withdraw", authenticateUser, async (req, res) => {
  try {
      const { amount } = req.body;
      const user = await User.findOne({ userId: req.user.userId });
      if (user.balance < amount) return res.status(400).json({ message: "Insufficient balance" });
      user.balance -= amount;
      const transaction = new Transaction({ userId: user._id, type: 'withdraw', amount });
      await transaction.save();
      user.transactions.push(transaction._id);
      await user.save();
      res.status(200).json({ message: "Withdrawal successful", balance: user.balance });
  } catch (error) {
      res.status(500).json({ message: "Withdrawal error", error: error.message });
  }
});

// Transfer Route
app.post("/transfer", authenticateUser, async (req, res) => {
  try {
      const { recipientUserId, amount } = req.body;
      const sender = await User.findOne({ userId: req.user.userId });
      const recipient = await User.findOne({ userId: recipientUserId });
      if (!recipient || sender.balance < amount) return res.status(400).json({ message: "Invalid transfer" });
      sender.balance -= amount;
      recipient.balance += amount;
      const senderTransaction = new Transaction({ userId: sender._id, type: 'transfer', amount: -amount });
      const recipientTransaction = new Transaction({ userId: recipient._id, type: 'transfer', amount });
      await Promise.all([senderTransaction.save(), recipientTransaction.save(), sender.save(), recipient.save()]);
      sender.transactions.push(senderTransaction._id);
      recipient.transactions.push(recipientTransaction._id);
      await Promise.all([sender.save(), recipient.save()]);
      res.status(200).json({ message: "Transfer successful", senderBalance: sender.balance });
  } catch (error) {
      res.status(500).json({ message: "Transfer error", error: error.message });
  }
});

// Transaction History
app.get("/transactions", authenticateUser, async (req, res) => {
  try {
      const user = await User.findOne({ userId: req.user.userId }).populate('transactions');
      res.status(200).json({ transactions: user.transactions, balance: user.balance });
  } catch (error) {
      res.status(500).json({ message: "Transaction history error", error: error.message });
  }
});
