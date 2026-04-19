<img width="1677" height="859" alt="Screenshot 2026-04-19 154717" src="https://github.com/user-attachments/assets/0e8d3030-2fe8-4d54-bd9e-62564cea65d1" />
<img width="1599" height="838" alt="Screenshot 2026-04-19 154739" src="https://github.com/user-attachments/assets/5626946a-c81f-4c65-b879-47585e518b0f" />
<img width="1618" height="845" alt="Screenshot 2026-04-19 154808" src="https://github.com/user-attachments/assets/e52f8b2d-ff2d-44e7-bd72-a74463d02fbf" />
<img width="1700" height="722" alt="Screenshot 2026-04-19 154952" src="https://github.com/user-attachments/assets/9ae7e0b6-3f85-4b41-9f19-7f29fd412456" />
<img width="1700" height="722" alt="Screenshot 2026-04-19 154952" src="https://github.com/user-attachments/assets/2fd8cfe3-f01f-4f37-93b3-65cf59fa7949" />
<img width="1618" height="845" alt="Screenshot 2026-04-19 154808" src="https://github.com/user-attachments/assets/57f8cfcf-4333-423d-86d7-9498d407e430" />
<img width="1599" height="838" alt="Screenshot 2026-04-19 154739" src="https://github.com/user-attachments/assets/08085328-baae-4e33-85c3-369b2076f3da" />
# SwiftrideX 🚀

SwiftrideX is a full-stack ride-hailing web app inspired by apps like Uber. It focuses on real-time ride updates, driver tracking, and a clean user experience.

---

## Live Demo

(https://swift-ride-x-git-testbranch-divya-sinhas-projects-58f302de.vercel.app)

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

## API

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
