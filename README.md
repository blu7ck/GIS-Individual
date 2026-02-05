<p align="center">
  <img src="public/assets/logo.png" alt="HEKAMAP Logo" width="120" height="120" style="border-radius: 50%;">
</p>

<h1 align="center">HEKAMAP Workspace</h1>

<p align="center">
  <strong>Professional 3D Geospatial Asset Management Platform</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#api">API</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.x-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/CesiumJS-1.136-6CADDF?style=flat-square" alt="CesiumJS">
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare" alt="Cloudflare">
  <img src="https://img.shields.io/badge/Supabase-Auth%20%26%20DB-3ECF8E?style=flat-square&logo=supabase" alt="Supabase">
</p>

---

## 🌍 Overview

**HEKAMAP Workspace** is a full-stack geospatial visualization platform that enables professionals to upload, manage, and securely share 3D assets on an interactive globe. Built with CesiumJS and React, it provides enterprise-grade features with a modern, intuitive UI.

Perfect for:
- 🏗️ **Construction & Architecture** - Visualize BIM models and site surveys
- 🌾 **Agriculture & Forestry** - Map terrain and analyze land data
- 🏛️ **Urban Planning** - 3D city models and infrastructure planning
- 🛰️ **Surveying & GIS** - Professional geospatial data management

---

## ✨ Features

### 📁 Multi-Format Support
| Format | Description | Features |
|--------|-------------|----------|
| **KML/KMZ** | Google Earth files | Auto fly-to, styling preservation |
| **GLB/GLTF** | 3D models | Coordinated(passive) & uncoordinated placement |
| **3D Tiles** | Massive datasets | Stream photogrammetry, point clouds, BIM |
| **DXF** | CAD files | Auto-convert to GeoJSON |
| **Shapefile** | GIS standard | Full support with styling |
| **Annotations** | Measurements | Distance, area, saved to project |

### 📊 Project Management
- **Folder Structure** - Organize assets into projects
- **Category Grouping** - Auto-categorize by file type
- **Bulk Operations** - Toggle all layers visibility
- **Real-time Sync** - Supabase-powered data persistence
- **Storage Bar** - Visual storage usage indicator

### 📏 Measurement Tools
- **Distance** - Measure linear distances between points
- **Area** - Calculate polygon areas with precision
- **Persistent Storage** - Save measurements to projects
- **Export Ready** - GeoJSON-compatible data format

### 🔒 Secure Sharing
- **PIN Protection** - 6-digit encrypted access codes
- **Email Delivery** - Mailgun-powered notifications
- **Expiring Links** - Time-limited secure access
- **Read-Only Mode** - Viewers can measure but not edit
- **Project Sharing** - Share entire projects with multiple assets

### 🎨 Modern UI/UX
- **Frosted Glass Design** - Backdrop blur with transparency
- **Collapsible Panels** - Clean, distraction-free viewing
- **Mobile Responsive** - Touch-friendly on all devices
- **Dark Theme** - Easy on the eyes for extended use
- **Quality Settings** - Adjustable map rendering quality

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI Framework |
| **TypeScript** | Type Safety |
| **Vite** | Build Tool |
| **Tailwind CSS** | Styling |
| **CesiumJS + Resium** | 3D Globe Rendering |
| **Turf.js** | Geospatial Calculations |
| **Lucide React** | Icons |

### Backend
| Technology | Purpose |
|------------|---------|
| **Cloudflare Workers** | Serverless API |
| **Cloudflare R2** | Object Storage |
| **Supabase** | Auth & PostgreSQL Database |
| **Mailgun** | Transactional Email |

### Infrastructure
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Cloudflare     │     │   Cloudflare     │     │    Supabase     │
│     Pages       │────▶│    Workers       │────▶│   PostgreSQL    │
│   (Frontend)    │     │   (API Layer)    │     │   (Database)    │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │  Cloudflare R2   │
                        │    (Storage)     │
                        └──────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm
- Cloudflare account
- Supabase account
- Mailgun account (for email features)

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/hekamap-workspace.git
cd hekamap-workspace

# Install frontend dependencies
npm install

# Start development server
npm run dev

# In a separate terminal, start the backend worker (optional)
cd backend
npm install
wrangler dev
```

Open [http://localhost:5173](http://localhost:5173) to view the app.

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

---

## 📦 Project Structure

```
hekamap-workspace/
├── App.tsx                 # Main application component
├── CesiumViewer.tsx        # 3D globe with CesiumJS
├── components/
│   ├── Auth.tsx            # Login/signup screen
│   ├── ProjectPanel.tsx    # Project sidebar
│   ├── StorageBar.tsx      # Storage usage indicator
│   ├── MeasurementControls.tsx
│   ├── SecureViewer.tsx    # PIN-protected viewer
│   ├── ShareProjectModal.tsx
│   ├── QualitySettingsPanel.tsx
│   └── ...
├── lib/
│   └── supabase.ts         # Supabase client
├── services/
│   └── storage.ts          # R2 storage service
├── types.ts                # TypeScript interfaces
├── backend/
│   ├── worker.js           # Cloudflare Worker
│   └── wrangler.toml       # Worker configuration
└── public/
    └── assets/
        └── CartaX.svg      # Application logo
```

---

## 🔌 API Endpoints

The Cloudflare Worker exposes the following endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Generate signed upload URL for R2 |
| `POST` | `/delete` | Delete file or folder from R2 |
| `POST` | `/share` | Create share link and send email |
| `POST` | `/verify-share` | Verify PIN and return asset data |
| `GET` | `/list-r2` | List R2 bucket contents (debug) |
| `GET` | `/storage-stats` | Get total storage usage |

### Delete Endpoint
```typescript
// Single file
await fetch(`${workerUrl}/delete`, {
  method: 'POST',
  body: JSON.stringify({ key: 'uploads/file.kml', isPrefix: false })
});

// Folder (3D Tiles)
await fetch(`${workerUrl}/delete`, {
  method: 'POST',
  body: JSON.stringify({ key: 'uploads/tileset/', isPrefix: true })
});
```

### Storage Stats Response
```json
{
  "success": true,
  "totalBytes": 10737418240,
  "fileCount": 1500,
  "totalGB": 10
}
```

---

## 🚢 Deployment

See [PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md) for detailed deployment instructions.

### Quick Deploy Checklist

1. **Cloudflare R2**
   - Create bucket
   - Configure CORS policy
   - Add custom domain (optional)
   - Generate API tokens

2. **Supabase**
   - Create project
   - Run migration script
   - Enable Email/Password auth

3. **Cloudflare Workers**
   ```bash
   cd backend
   wrangler secret put R2_ACCESS_KEY_ID
   wrangler secret put R2_SECRET_ACCESS_KEY
   wrangler secret put MAILGUN_API_KEY
   wrangler deploy
   ```

4. **Cloudflare Pages**
   - Connect to Git repository
   - Build command: `npm run build`
   - Output directory: `dist`

---

## 🔧 Key Features

### Storage Bar
Visual indicator in ProjectPanel footer showing R2 storage usage. Refreshes every 5 minutes.

### Upload Cleanup
Failed uploads (database errors) automatically cleanup the R2 file to prevent orphan files.

### 3D Tiles Folder Deletion
Deleting a TILES_3D asset removes the entire folder contents from R2 using `isPrefix: true`.

---

## 📄 License

This project is proprietary software developed by **FIXURELABS** for **HEKAMAP**.

---

<p align="center">
  <strong>POWERED BY FIXURELABS</strong>
</p>
