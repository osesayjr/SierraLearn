# SierraLearn
# SierraLearn 🇸🇱

**An open educational resource (OER) platform for Sierra Leone.**

SierraLearn lets teachers upload openly-licensed learning materials — PDFs, documents, videos, images, and links — for review by an admin. Once approved, students and the public can browse, search, filter, download, rate, like, and comment on resources — completely free.

Built for the **DLAW207: IT Law and IPR Legal Issues** module at Limkokwing University of Creative Technology, Sierra Leone campus, as part of the **DPG-in-Academia Pilot Programme**.

---

## 🌍 The Problem

Sierra Leone faces a critical shortage of educational materials:

- Rural schools often have textbook-to-student ratios as poor as **1:6 to 1:8**
- A single textbook can cost **SLE 50,000–150,000** — far beyond many families' budgets
- No centralised platform exists for teachers to legally share open educational content
- Students preparing for WASSCE/BECE in rural areas have far less access to revision materials than urban students

## 💡 The Solution

SierraLearn provides a free, web-based library of openly-licensed educational resources covering Primary, Junior Secondary, Senior Secondary, and Tertiary levels. Teachers contribute content; an admin reviews and approves it; students and the public access it for free — forever.

## 🎯 SDG Alignment

**Primary: SDG 4 — Quality Education**
SierraLearn directly supports SDG 4 by giving every student in Sierra Leone — regardless of location or income — equal access to quality learning materials.

It also contributes to:
- **SDG 10 — Reduced Inequalities** (urban vs. rural access)
- **SDG 17 — Partnerships for the Goals** (open data, open standards)

---

## ✨ Features

### For Everyone (Guests)
- Browse and search the full library of approved resources
- Filter by subject, level, license, and resource type
- View resource details, license information, and contributor profiles

### For Students
- Everything guests can do, plus:
- Download real files
- Rate resources (1–5 stars)
- Like resources
- Comment on resources

### For Teachers
- Everything students can do, plus:
- Upload resources (PDF, Document, Video, Image, or Link) for admin review
- Choose an open-source license (MIT, Apache 2.0, CC BY 4.0, or GPL 3.0)
- Enter a custom subject if not in the dropdown
- Track submission status (pending / approved / rejected) on their profile
- See per-resource stats: downloads, likes, ratings
- Receive in-app notifications when resources are approved, rejected, liked, or commented on
- View rejection reasons if a submission is declined

### For Admins
- Dashboard with platform-wide statistics (coloured stat cards)
- Approve or reject pending submissions (with mandatory rejection reason)
- Manage all users — change roles, remove accounts
- View Top Content: most downloaded, highest rated, and most liked resources
- View the teacher with the most uploads

### Platform-wide
- Profile photo upload and name editing for all users
- One-click JSON export of all resource metadata (open data)
- Fully responsive design — mobile to desktop
- Fixed navbar, animated hero, and a modern wide-layout design system

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript (ES Modules) |
| Backend | [Supabase](https://supabase.com) (PostgreSQL, Auth, Storage, Row Level Security) |
| Fonts | Clash Display & Satoshi (via Fontshare) |
| Hosting | Any static file host / VS Code Live Server for local development |

No build tools, frameworks, or bundlers required — pure ES Modules running directly in the browser.

---

## 📁 Project Structure

```
sierralearn/
├── index.html          # Public library / homepage
├── login.html          # Sign in
├── signup.html         # Register (Student or Teacher)
├── upload.html         # Teacher resource submission
├── resource.html        # Resource detail page (comments, likes, ratings)
├── profile.html         # User profile & teacher dashboard
├── dashboard.html        # Admin dashboard
├── privacy.html         # Privacy policy
├── style.css           # Complete design system
├── auth.js             # Session management, role guards, navbar
├── supabase.js          # All Supabase database operations
└── schema.sql           # Database schema, RLS policies, functions, triggers
```

---

## 🚀 Getting Started

### 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Open the **SQL Editor** and run the entire contents of [`schema.sql`](./schema.sql)
3. Go to **Authentication → Providers → Email** and turn **off** "Confirm email" (for development/demo purposes)
4. Copy your **Project URL** and **anon public key** from **Settings → API**
5. Paste them into `supabase.js`:

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### 2. Run the app locally

ES Modules require the app to be served over HTTP (not opened directly as a file).

**Using VS Code Live Server:**
1. Open the project folder in VS Code
2. Install the **Live Server** extension
3. Right-click `index.html` → **Open with Live Server**

### 3. Create your first admin account

1. Sign up normally at `signup.html` (choose Student or Teacher — it doesn't matter)
2. In the Supabase SQL Editor, run:

```sql
UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
```

3. Sign out and sign back in — you now have full admin access via the **Dashboard**

---

## 👥 User Roles

| Role | Access |
|---|---|
| **Guest** | Browse and view approved resources only |
| **Student** | Download, rate, like, and comment on resources |
| **Teacher** | All student permissions + submit resources for review |
| **Admin** | Full platform control via the dashboard |

Roles are enforced at both the application layer **and** the database layer via PostgreSQL Row Level Security (RLS).

---

## 🔒 Privacy & Security

- Passwords hashed with **bcrypt** via Supabase Auth
- All data encrypted in transit via **TLS**
- **Row Level Security** on every table
- Input sanitisation prevents XSS on all user-generated content
- See [`privacy.html`](./privacy.html) for the full privacy policy

---

## 📜 License

This project is licensed under the **MIT License** — see [`LICENSE`](./LICENSE) for details.

Resources uploaded to the platform may carry their own license (MIT, Apache 2.0, CC BY 4.0, or GPL 3.0) as chosen by the contributing teacher.

---

## 🙌 Acknowledgments

- Built for the **DLAW207: IT Law and IPR Legal Issues** module
- Limkokwing University of Creative Technology, Sierra Leone Campus
- DPG-in-Academia Pilot Programme, Department of ICT
- Examiner: Ing. Sheku Dinneh Kamara

---

## 📬 Contact

For questions about this project, please reach out via the university module coordinator or open an issue on this repository.
