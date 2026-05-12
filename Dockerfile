FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build
ENV NODE_ENV=production
EXPOSE 8080
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
