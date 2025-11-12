FROM node:24-slim

WORKDIR /app

# sh
RUN corepack enable && corepack prepare pnpm@10.12.3 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY src/ ./src/

COPY ./entrypoint.sh ./entrypoint.sh

COPY .env ./.env

COPY tsconfig.json ./tsconfig.json

ENTRYPOINT ["./entrypoint.sh"]