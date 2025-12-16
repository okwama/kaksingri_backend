# Kaksingri Backend API

NestJS backend API for Kaksingri Denim E-commerce platform.

## Tech Stack

- **NestJS** - Progressive Node.js framework
- **TypeScript** - Type-safe JavaScript
- **PostgreSQL** - Relational database
- **Prisma** - Modern ORM
- **JWT** - Authentication
- **Swagger** - API documentation

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Set up database:**
   ```bash
   # Generate Prisma Client
   npm run prisma:generate

   # Run migrations
   npm run prisma:migrate
   ```

4. **Start development server:**
   ```bash
   npm run start:dev
   ```

The API will be available at `http://localhost:3001`
Swagger documentation at `http://localhost:3001/api/docs`

## Project Structure

```
src/
├── auth/           # Authentication module
├── users/          # User management
├── products/       # Products & Categories
├── orders/         # Order management
├── inventory/      # Inventory management
├── sales/          # Sales & Quotes
├── clients/        # Client management
├── marketing/      # Marketing campaigns
├── analytics/      # Analytics & Reports
├── settings/       # System settings
├── notifications/  # Notifications
└── common/         # Shared utilities
```

## API Endpoints

All endpoints are prefixed with `/api`

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product by ID
- `PATCH /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `GET /api/categories/:id` - Get category by ID
- `PATCH /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Orders
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order by ID
- `PATCH /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order

### Sales/Quotes
- `GET /api/sales/quotes` - Get all quotes
- `POST /api/sales/quotes` - Create quote
- `GET /api/sales/quotes/:id` - Get quote by ID
- `PATCH /api/sales/quotes/:id` - Update quote
- `DELETE /api/sales/quotes/:id` - Delete quote

### Clients
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create client
- `GET /api/clients/:id` - Get client by ID
- `PATCH /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

## Database

The database schema is defined in `prisma/schema.prisma`. To make changes:

1. Edit `prisma/schema.prisma`
2. Run `npm run prisma:migrate` to create a migration
3. Run `npm run prisma:generate` to regenerate Prisma Client

## Authentication

The API uses JWT-based authentication. Include the token in the Authorization header:

```
Authorization: Bearer <token>
```

## License

MIT

