# CricScore Pro - Deployment Guide

## Render.com Deployment Instructions

### 1. Prerequisites
- GitHub account
- Render.com account
- Gemini API key from Google AI Studio

### 2. Setup Steps

#### A. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

#### B. Configure Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:

**Basic Settings:**
- **Name**: cricscore-pro
- **Environment**: Node
- **Region**: Choose closest to your users
- **Branch**: main
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

**Environment Variables:**
Add the following in the "Environment" section:
- `API_KEY` = Your Gemini API key
- `DATABASE_URL` = (Optional) Your PostgreSQL connection string
- `NODE_VERSION` = 22

5. Click "Create Web Service"

### 3. Environment Variables Details

#### Required:
- **API_KEY**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)

#### Optional:
- **DATABASE_URL**: PostgreSQL connection string for persistent storage
  - Format: `postgresql://user:password@host:port/database`
  - Without this, the app works but data is not persisted across deployments

- **PORT**: Auto-set by Render (leave empty)

### 4. Post-Deployment

After successful deployment:
1. Visit your app URL: `https://your-app-name.onrender.com`
2. Create your first match
3. Share the match password with scorers

### 5. Troubleshooting

**Build Fails:**
- Ensure `NODE_VERSION=22` is set in environment variables
- Check that all dependencies are in package.json

**Server Won't Start:**
- Verify `API_KEY` environment variable is set
- Check Render logs for specific errors

**Database Issues:**
- Verify `DATABASE_URL` format is correct
- Ensure database is accessible from Render's IP addresses

### 6. Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env and add your API_KEY

# Run development server
npm run dev

# Run production build locally
npm run build
npm start
```

### 7. Features Checklist

- ✅ Live cricket scoring
- ✅ Password-protected scorer access
- ✅ AI-powered commentary (Gemini)
- ✅ Text-to-speech commentary
- ✅ Real-time strike rotation
- ✅ Fall of wickets tracking
- ✅ Detailed scorecards
- ✅ Mobile-responsive design
- ✅ Optional PostgreSQL sync

### 8. Architecture

```
Frontend (React + Vite)
    ↓
Express Server (Node.js)
    ↓
PostgreSQL (Optional)
    ↓
Gemini API (Commentary + TTS)
```

### 9. Cost Estimate

**Render.com:**
- Free tier: 750 hours/month (sufficient for small usage)
- Starter: $7/month for always-on service

**Google Gemini API:**
- Free tier: 15 requests/minute
- Pay-as-you-go after free tier

**PostgreSQL (if used):**
- Render: $7/month for 1GB database
- Alternative: Use free tier of other providers

### 10. Support

For issues or questions:
1. Check Render logs: Dashboard → Your Service → Logs
2. Review build logs for compilation errors
3. Test locally first with `npm run dev`

---

## Quick Deploy Checklist

- [ ] Code pushed to GitHub
- [ ] Render service created
- [ ] `API_KEY` environment variable set
- [ ] `NODE_VERSION=22` environment variable set
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm start`
- [ ] Deployment successful
- [ ] App accessible at Render URL
- [ ] First match created successfully
