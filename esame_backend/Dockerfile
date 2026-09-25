FROM node:24-alpine

WORKDIR /app

# Prima il manifest e le dipendenze: finche' package.json non cambia, docker
# riusa questo livello e non reinstalla niente ad ogni build.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

EXPOSE 3000

USER node

CMD ["node", "src/index.js"]
