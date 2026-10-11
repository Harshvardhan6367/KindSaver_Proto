# Deploying KindSaver to Render (Step-by-Step Guide)

**Platform**: [Render.com](https://render.com)  
**Repository**: [https://github.com/Harshvardhan6367/KindSaver_Proto.git](https://github.com/Harshvardhan6367/KindSaver_Proto.git)  

KindSaver consists of:
1. **Backend API Service**: Node.js microservice (`backend/server.js`) connected to MongoDB Atlas.
2. **Frontend Client**: React + Vite single page application with interactive 3D Jaipur maps (`frontend/`).

Render offers **Free Tier** support for both Web Services and Static Sites.

---

## Prerequisites: MongoDB Atlas Network Access

Because Render uses dynamic IP addresses, ensure your MongoDB Atlas cluster allows connections from Render:
1. Go to **[cloud.mongodb.com](https://cloud.mongodb.com/)** $\to$ **Network Access**.
2. Click **Add IP Address**.
3. Select **Allow Access From Anywhere** (`0.0.0.0/0`) $\to$ **Confirm**.

---

## Method 1: Automatic Deployment via Render Blueprint (Recommended)

KindSaver includes a configured `render.yaml` blueprint.

1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** $\to$ select **Blueprint**.
3. Connect your repository: `Harshvardhan6367/KindSaver_Proto`.
4. Render will read `render.yaml` and automatically detect:
   - `kindsaver-backend` (Node Web Service)
   - `kindsaver-frontend` (Static Site)
5. Fill in the prompted environment variables:
   - **`MONGODB_URI`**: Your MongoDB Atlas connection string:
     ```
     mongodb+srv://Harshvardhan:Harsh6367@cluster0.zigs48n.mongodb.net/?appName=Cluster0
     ```
   - **`VITE_API_BASE_URL`**: Set this to `https://kindsaver-backend.onrender.com` (replace with your actual backend service name).
6. Click **Apply**. Render will automatically build, deploy, and provision SSL certificates for both services.

---

## Method 2: Manual Deployment via Render Dashboard

If you prefer configuring each service manually:

### Step 1: Deploy Backend Web Service

1. On the Render Dashboard, click **New +** $\to$ **Web Service**.
2. Select your repository: `Harshvardhan6367/KindSaver_Proto`.
3. Configure settings:
   - **Name**: `kindsaver-backend`
   - **Region**: Choose the closest region (e.g. Singapore or Frankfurt)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
4. Add **Environment Variables**:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Production mode |
   | `STORAGE_DRIVER` | `mongodb` | Use MongoDB Atlas store |
   | `MONGODB_URI` | `mongodb+srv://Harshvardhan:Harsh6367@cluster0.zigs48n.mongodb.net/?appName=Cluster0` | Your database URI |
   | `MONGODB_DB` | `kindreport_jaipur` | Database name |
   | `CORS_ORIGIN` | `*` | Or specify frontend URL |
   | `TRUST_PROXY` | `true` | Required for reverse proxy |
   | `JWT_SECRET` | *(Click "Generate" or use your random secret)* | Auth encryption token |
   | `UPLOAD_DIR` | `uploads` | Local upload directory |
   | `MAX_UPLOAD_BYTES` | `5242880` | 5 MB upload limit |
5. Click **Create Web Service**.
6. Note the deployed backend URL (e.g., `https://kindsaver-backend.onrender.com`).
7. Verify backend health by visiting: `https://kindsaver-backend.onrender.com/health` $\to$ Should return `{"ok":true,"service":"kindreport-backend",...}`.

---

### Step 2: Deploy Frontend Static Site

1. On the Render Dashboard, click **New +** $\to$ **Static Site**.
2. Select your repository: `Harshvardhan6367/KindSaver_Proto`.
3. Configure settings:
   - **Name**: `kindsaver-frontend`
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add **Environment Variables**:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://kindsaver-backend.onrender.com` *(Replace with your Step 1 backend URL)* |
5. Under **Redirects / Rewrites**:
   - The file `frontend/public/_redirects` is already included (`/*  /index.html  200`), guaranteeing client-side routing fallback.
6. Click **Create Static Site**.

---

## Step 3: Verification & Smoke Test

Once both services show **Live**:
1. Open your frontend Render URL: `https://kindsaver-frontend.onrender.com`.
2. Verify that the **API Live** status dot in the topbar is green.
3. Test reporting an issue or checking the live Jaipur map.
4. Log into the Admin Console with:
   - **Email**: `admin@jaipur.gov.in`
   - **Password**: `Admin@12345`
