FROM node:20-alpine
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
EXPOSE 8545
CMD ["yarn", "hardhat", "node", "--hostname", "0.0.0.0"]
