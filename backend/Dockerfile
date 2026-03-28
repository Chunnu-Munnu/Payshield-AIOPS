# FILE: Dockerfile
# ROLE: Build the PayShield backend API container
# INSPIRED BY: Production Node.js service containers
# PERFORMANCE TARGET: Container boot to healthy state in under 20s
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["node", "src/server.js"]
