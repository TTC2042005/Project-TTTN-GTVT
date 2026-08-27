const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./models');
const authRoutes = require('./routes/auth');
const filmLabRoutes = require('./routes/filmLabs');
const orderRoutes = require('./routes/orders');
const marketplaceRoutes = require('./routes/marketplace');
const communityRoutes = require('./routes/community');
const eventsRoutes = require('./routes/events');
const labManagementRoutes = require('./routes/labManagement');
const aiRoutes = require('./routes/ai');
const uploadsRoutes = require('./routes/uploads');
const reviewsRoutes = require('./routes/reviews');
const messagesRoutes = require('./routes/messages');
const transactionsRoutes = require('./routes/transactions');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const { initializeRealtimeServer } = require('./services/realtimeService');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
  res.json({ message: 'Film Lab backend API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/film-labs', filmLabRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/lab-management', labManagementRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

const port = process.env.PORT || 4000;

async function start() {
  try {
    await db.sequelize.authenticate();
    await db.sequelize.sync({ alter: true });
    const server = app.listen(port, () => {
      console.log(`Backend listening on port ${port}`);
    });
    initializeRealtimeServer(server);
  } catch (error) {
    console.error('Unable to start the backend:', error);
    process.exit(1);
  }
}

start();
