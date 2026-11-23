const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');
const UserModel = require('./user');
const FilmLabModel = require('./filmLab');
const LabServiceModel = require('./labService');
const LabPackageModel = require('./labPackage');
const OrderModel = require('./order');
const OrderItemModel = require('./orderItem');
const ProductModel = require('./product');
const ReviewModel = require('./review');
const MessageModel = require('./message');
const PostModel = require('./post');
const CommentModel = require('./comment');
const TransactionModel = require('./transaction');
const UploadModel = require('./upload');
const FavoriteModel = require('./favorite');
const MarketplaceOrderModel = require('./marketplaceOrder');
const WorkshopModel = require('./workshop');
const PhotowalkModel = require('./photowalk');
const EventRegistrationModel = require('./eventRegistration');
const RagDocumentModel = require('./ragDocument');
const FilmScreeningModel = require('./filmScreening');
const TicketReservationModel = require('./ticketReservation');
const AdminAuditLogModel = require('./adminAuditLog');
const ContentReportModel = require('./contentReport');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgres://film_lab_user:film_lab_pass@localhost:5432/film_lab_db', {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },
});

const User = UserModel(sequelize);
const FilmLab = FilmLabModel(sequelize);
const LabService = LabServiceModel(sequelize);
const LabPackage = LabPackageModel(sequelize);
const Order = OrderModel(sequelize);
const OrderItem = OrderItemModel(sequelize);
const Product = ProductModel(sequelize);
const Review = ReviewModel(sequelize);
const Message = MessageModel(sequelize);
const Post = PostModel(sequelize);
const Comment = CommentModel(sequelize);
const Transaction = TransactionModel(sequelize);
const Upload = UploadModel(sequelize);
const Favorite = FavoriteModel(sequelize);
const MarketplaceOrder = MarketplaceOrderModel(sequelize);
const Workshop = WorkshopModel(sequelize);
const Photowalk = PhotowalkModel(sequelize);
const EventRegistration = EventRegistrationModel(sequelize);
const RagDocument = RagDocumentModel(sequelize);
const FilmScreening = FilmScreeningModel(sequelize);
const TicketReservation = TicketReservationModel(sequelize);
const AdminAuditLog = AdminAuditLogModel(sequelize);
const ContentReport = ContentReportModel(sequelize);

User.hasMany(FilmLab, { foreignKey: 'ownerId', as: 'labs' });
FilmLab.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

User.hasMany(Upload, { foreignKey: 'userId', as: 'uploads' });
Upload.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

FilmLab.hasMany(LabService, { foreignKey: 'labId', as: 'services' });
LabService.belongsTo(FilmLab, { foreignKey: 'labId' });

FilmLab.hasMany(LabPackage, { foreignKey: 'labId', as: 'packages' });
LabPackage.belongsTo(FilmLab, { foreignKey: 'labId' });

User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId' });
FilmLab.hasMany(Order, { foreignKey: 'labId', as: 'orders' });
Order.belongsTo(FilmLab, { foreignKey: 'labId' });

Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

User.hasMany(Product, { foreignKey: 'sellerId', as: 'products' });
Product.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });

User.hasMany(Favorite, { foreignKey: 'userId', as: 'favorites' });
Favorite.belongsTo(User, { foreignKey: 'userId' });
Product.hasMany(Favorite, { foreignKey: 'productId', as: 'favorites' });
Favorite.belongsTo(Product, { foreignKey: 'productId' });

User.hasMany(MarketplaceOrder, { foreignKey: 'buyerId', as: 'buyerOrders' });
MarketplaceOrder.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });
User.hasMany(MarketplaceOrder, { foreignKey: 'sellerId', as: 'sellerOrders' });
MarketplaceOrder.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });
Product.hasMany(MarketplaceOrder, { foreignKey: 'productId', as: 'marketplaceOrders' });
MarketplaceOrder.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

User.hasMany(Review, { foreignKey: 'authorId', as: 'reviews' });

User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
User.hasMany(Message, { foreignKey: 'recipientId', as: 'receivedMessages' });

User.hasMany(Post, { foreignKey: 'authorId', as: 'posts' });
Post.belongsTo(User, { foreignKey: 'authorId', as: 'author' });
Post.hasMany(Comment, { foreignKey: 'postId', as: 'comments' });
Comment.belongsTo(Post, { foreignKey: 'postId' });
Comment.belongsTo(User, { foreignKey: 'authorId', as: 'author' });

User.hasMany(Workshop, { foreignKey: 'organizerId', as: 'workshops' });
Workshop.belongsTo(User, { foreignKey: 'organizerId', as: 'organizer' });
User.hasMany(Photowalk, { foreignKey: 'organizerId', as: 'photowalks' });
Photowalk.belongsTo(User, { foreignKey: 'organizerId', as: 'organizer' });

User.hasMany(EventRegistration, { foreignKey: 'userId', as: 'eventRegistrations' });
EventRegistration.belongsTo(User, { foreignKey: 'userId' });

FilmScreening.hasMany(TicketReservation, { foreignKey: 'screeningId', as: 'reservations' });
TicketReservation.belongsTo(FilmScreening, { foreignKey: 'screeningId', as: 'screening' });
User.hasMany(TicketReservation, { foreignKey: 'userId', as: 'ticketReservations' });
TicketReservation.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Order.hasMany(Transaction, { foreignKey: 'orderId', as: 'transactions' });
Transaction.belongsTo(Order, { foreignKey: 'orderId' });
User.hasMany(Transaction, { foreignKey: 'verifiedBy', as: 'verifiedTransactions' });
Transaction.belongsTo(User, { foreignKey: 'verifiedBy', as: 'verifier' });
User.hasMany(AdminAuditLog, { foreignKey: 'actorId', as: 'adminActions' });
AdminAuditLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });
User.hasMany(ContentReport, { foreignKey: 'reporterId', as: 'contentReports' });
ContentReport.belongsTo(User, { foreignKey: 'reporterId', as: 'reporter' });

const db = {
  sequelize,
  Sequelize,
  User,
  FilmLab,
  LabService,
  LabPackage,
  Order,
  OrderItem,
  Product,
  Review,
  Message,
  Post,
  Comment,
  Transaction,
  Upload,
  Favorite,
  MarketplaceOrder,
  Workshop,
  Photowalk,
  EventRegistration,
  RagDocument,
  FilmScreening,
  TicketReservation,
  AdminAuditLog,
  ContentReport,
};

module.exports = db;
