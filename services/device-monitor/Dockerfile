FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* tsconfig.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY package.json .

EXPOSE 3003

CMD ["node", "dist/index.js"]
