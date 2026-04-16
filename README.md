# 🚀 SwiftrideX

A modern ride-hailing web application inspired by Uber, built with real-time tracking, driver matching, and a polished dark UI.

## ✨ Features

- Rider & Driver authentication with JWT
- Real-time ride updates with Socket.io
- Driver location tracking with Redis GEO
- Smart nearest-driver matching
- Interactive map with location search and autocomplete
- "Use My Location" support
- Ride lifecycle management:
  - Request
  - Accept
  - Start
  - Complete
- Modern Tailwind CSS UI with responsive layouts
- Google login support

## 🛠️ Tech Stack

### Frontend
- React
- Tailwind CSS
- Axios
- Socket.io-client

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- Redis for geolocation and online driver tracking
- JWT authentication
- Socket.io

## 📁 Project Structure

```text
SwiftrideX/
  backend/
  frontend/
  README.md
  .gitignore
```

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/29di/SwiftRideX.git
cd SwiftrideX
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create a `backend/.env` file:

```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
REDIS_URL=your_redis_url
GOOGLE_CLIENT_ID=your_google_client_id
```

Run the backend:

```bash
npm run dev
```

### 3. Frontend setup

```bash
cd ../frontend
npm install
```

Create a `frontend/.env` file:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Run the frontend:

```bash
npm run dev
```

## 🚀 Usage

- Register as a rider or driver
- Login with email/password or Google
- Request a ride
- Driver accepts the ride via the backend/API flow
- Track the ride in real time with Socket.io

## 🔐 Environment Variables

### Backend
- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `REDIS_URL`
- `GOOGLE_CLIENT_ID`

### Frontend
- `VITE_API_URL`
- `VITE_SOCKET_URL`
- `VITE_GOOGLE_CLIENT_ID`

## ⚠️ Notes

- Do not commit `.env` files.
- Ensure MongoDB and Redis are running before starting the backend.
- Update the frontend API URL if the backend runs on a non-default port.
- Keep JWT and Google credentials private.

## 📦 Deployment

Suggested production targets:
- Backend: Render
- Frontend: Vercel

## 🏁 Status

Production-ready full-stack ride-hailing system 🚀

## 🔗 Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit - SwiftrideX full stack app"
git branch -M main
git remote add origin https://github.com/29di/SwiftRideX.git
git push -u origin main
```
