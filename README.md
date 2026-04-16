# Sporty Pulse Pro

> A personal training platform for people who take their fitness seriously — built for real life, not just the gym.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)

---

## Overview

**Sporty Pulse Pro** is a personal training platform built for people who take their fitness seriously but can't always make it to the gym. It brings structured, equipment-based workout programs directly to your phone, wherever you are.

Every program is built around the equipment you own. Whether you train with kettlebells, resistance bands, a pull-up bar, or a full rack — Sporty Pulse Pro meets you where you are.

---

## Features

- **Equipment-based workout programs** — Programs tailored to the gear you actually own
- **Mobile-first design** — Train anywhere, on any device
- **Authentication** — Secure sign-in with NextAuth
- **Payments** — Integrated with Paystack for subscriptions or purchases
- **Media uploads** — Cloudinary-powered image management
- **Fast & reactive** — Powered by TanStack Query and Next.js Server Actions
- **Robust data layer** — Prisma ORM with PostgreSQL via Supabase

---

## Tech Stack

| Layer         | Technology                                                                      |
| ------------- | ------------------------------------------------------------------------------- |
| Framework     | [Next.js](https://nextjs.org/) (App Router)                                     |
| Language      | [TypeScript](https://www.typescriptlang.org/)                                   |
| Styling       | [Tailwind CSS](https://tailwindcss.com/)                                        |
| Auth          | [NextAuth.js](https://next-auth.js.org/)                                        |
| ORM           | [Prisma](https://www.prisma.io/)                                                |
| Database      | [PostgreSQL](https://www.postgresql.org/) via [Supabase](https://supabase.com/) |
| Data Fetching | [TanStack Query](https://tanstack.com/query)                                    |
| Media         | [Cloudinary](https://cloudinary.com/)                                           |
| Payments      | [Paystack](https://paystack.com/)                                               |
| Server Logic  | Next.js Server Actions                                                          |

---

## Project Structure

```
sporty-pulse-pro/
├── app/                  # Next.js App Router (pages, layouts, server actions)
├── components/           # Reusable UI components
├── lib/                  # Utility functions, Prisma client, auth config
├── prisma/               # Prisma schema and migrations
├── public/               # Static assets
└── types/                # TypeScript type definitions
```

---

## Deployment

> 🔗 Live Demo: _Coming soon_

## 🤝 Contributing

Contributions are welcome! If you find a bug or have a feature request, feel free to open an issue or submit a pull request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">Built by <a href="https://github.com/LusaphoMatiti">LusaphoMatiti</a></p>
