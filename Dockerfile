FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000

# Em modo desenvolvimento, usar start:dev (hot reload)
# Em modo produção, fazer build e usar node dist/main
CMD if [ "$NODE_ENV" = "production" ]; then \
      npm run build && node dist/main; \
    else \
      npm run start:dev; \
    fi
