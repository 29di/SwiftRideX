# SwiftrideX 🚀

SwiftrideX is a full-stack ride-hailing web app inspired by apps like Uber. It focuses on real-time ride updates, driver tracking, and a clean user experience.

---

## Live Demo

Coming soon...

---

## Features

* User authentication for riders and drivers (JWT based)
* Real-time ride updates using Socket.io
* Driver location tracking using Redis
* Nearest driver matching
* Ride flow: request → accept → start → complete
* Google login support
* Map integration with search and current location
* Responsive UI built with Tailwind CSS

---

## Tech Stack

**Frontend**

* React
* Tailwind CSS
* Axios
* Socket.io-client

**Backend**

* Node.js
* Express.js
* MongoDB (Mongoose)
* Redis
* JWT
* Socket.io

---

## Project Structure

```
SwiftrideX/
  backend/
  frontend/
```

---

## Setup

### 1. Clone the repo

```
git clone https://github.com/29di/SwiftRideX.git
cd SwiftrideX
```

---

### 2. Backend

```
cd backend
npm install
```

Create a `.env` file inside backend:

```
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
REDIS_URL=your_redis_url
GOOGLE_CLIENT_ID=your_google_client_id
```

Run:

```
npm run dev
```

---

### 3. Frontend

```
cd frontend
npm install
```

Create a `.env` file inside frontend:

```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Run:

```
npm run dev
```

---

## How it works (basic idea)

* User requests a ride from frontend
* Request goes to backend (Node + Express)
* Nearby drivers are found using Redis
* Ride updates are sent in real-time using Socket.io
* Ride status changes as driver accepts and completes the trip

---

## API (sample)

```
POST /api/auth/register
POST /api/auth/login
POST /api/rides/request
GET  /api/rides/:id
```

---

## Notes

* `.env` files are not included in the repo
* Make sure MongoDB and Redis are running
* Update API URL if needed

---

## Status

Project is working and can be extended further.
