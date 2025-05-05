FROM node:20

WORKDIR /usr/src/app

# Enable Corepack to use the correct Yarn version
RUN corepack enable

COPY . .

RUN yarn install
RUN yarn build

EXPOSE 3000

ENTRYPOINT [ "yarn", "start" ]