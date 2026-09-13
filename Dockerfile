# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────────
# Casa Libre buyer portal — deterministic, multi-country build for Coolify.
#
# WHY THIS FILE EXISTS
#   The platform's auto-generated build wrote the service's env into a baked
#   `.env.production.local` and reused a cached `next build` layer. So when a
#   service's country/DB env changed, the change didn't take effect — a stale
#   image kept serving the wrong country (branding AND the wrong database).
#
# HOW THIS FIXES IT PERMANENTLY
#   1. Build-affecting vars are declared as ARG below → Docker's layer cache key
#      includes them, so ANY change to a service's value invalidates the
#      `next build` cache automatically. No manual "rebuild without cache".
#   2. Nothing is written to a `.env*` file, and `.dockerignore` blocks any local
#      `.env*` from entering the image → at RUNTIME the app reads ONLY the env
#      that Coolify injects into the container. It can never go stale.
#   3. The app already resolves the active country at runtime (lib/country.js +
#      window injection), so ONE image serves any country purely from that env.
#
# COOLIFY SETUP: set this service's Build Pack to "Dockerfile". Coolify passes the
# service's variables as --build-arg, so the ARGs below receive the right values
# per service (py/bo/uy). Runtime (server-only) secrets are injected as container
# env and read at request time — they do NOT need to be build args.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Vars that affect the BUILD output: client-inlined NEXT_PUBLIC_* (Stripe/PostHog),
# the country (drives generateStaticParams for /comparar & /propiedades-en, and the
# client bundle), and the canonical site URL / index flag baked into static pages.
# Declaring them as ARG is what makes the cache bust per-value.
ARG NEXT_PUBLIC_COUNTRY
ARG COUNTRY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG APP_PUBLIC_URL
ARG SITE_INDEXABLE
ENV NEXT_PUBLIC_COUNTRY=$NEXT_PUBLIC_COUNTRY \
    COUNTRY=$COUNTRY \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    APP_PUBLIC_URL=$APP_PUBLIC_URL \
    SITE_INDEXABLE=$SITE_INDEXABLE \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# Copy the built app (source + node_modules + .next + public + config). We run
# `next start`, and ALL per-country + secret env (AIROBASE_URL/SECRET, SESSION_SECRET,
# CRON_SECRET, RESEND_*, B2_*, GOOGLE_CLIENT_*, and the country) are read at RUNTIME
# from Coolify's injected container env — nothing baked, nothing to go stale.
COPY --from=build /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
