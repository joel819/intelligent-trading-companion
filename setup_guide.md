# Intelligent Trading Companion: Setup Guide

This guide explains how to launch this app for free and configure it for real trading accounts.

## 1. How to Launch the App for Free

### Option A: Local Development (Recommended)
You can run this app on your own computer for free.
1. **Prerequisites**: Install [Node.js](https://nodejs.org/).
2. **Setup**:
   - Open your terminal in this project folder.
   - Run `npm install` (to download dependencies).
3. **Launch**:
   - Run `npm run dev`.
   - Open your browser to `http://localhost:8080`.

### Option B: Free Web Hosting
You can host this app online for free using services like **Vercel** or **Netlify**:
1. Push your code to a **GitHub** repository.
2. Connect your repository to [Vercel](https://vercel.com/) or [Netlify](https://www.netlify.com/).
3. **Important**: Add your `.env` variables (like `VITE_DERIV_APP_ID`) to the hosting provider's Environment Variables settings.

---

## 2. How to Add a Real Trading Account

To switch from a Demo account to a Real account, follow these steps:

### Step 1: Get Real API Credentials
1. Log in to your [Deriv.com](https://deriv.com/) account.
2. Go to **Settings > API Token**.
3. Create a new token with **Read** and **Trade** scopes.
4. Note your **App ID** (you can create one at [api.deriv.com/registration](https://api.deriv.com/registration) or use `117289` as a default for testing).

### Step 2: Update Configuration
1. Open the `.env` file in the project's root directory.
2. Update the following values:
   ```env
   VITE_DERIV_APP_ID=YOUR_REAL_APP_ID
   VITE_DERIV_API_TOKEN=YOUR_REAL_API_TOKEN
   ```
3. **Save the file**.

### Step 3: Restart the App
- If running locally, stop the app (`Ctrl + C`) and run `npm run dev` again.
- The app will automatically connect to your real account and show the real balance.

---

## 3. UI Status Indicators
- **Online Badge**: Green "Online" badge in the top-right indicates a successful WebSocket connection to Deriv.
- **Header Balance**: Displays your real/demo balance and equity directly from Deriv.
- **Live Ticks**: Real-time price feed from Deriv (currently streaming Volatility 100 Index).
