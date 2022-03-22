FROM node:17

RUN apt-get update
RUN apt-get install -y curl

WORKDIR /usr/src/server

COPY core ./core
COPY loadbalancer ./loadbalancer
COPY gateway ./gateway
COPY db ./db

COPY modAlias.ts \
    ServerConfigurations.ts \ 
    package.json \
    package-lock.json \
    gruntfile.js \
    tsconfig.json ./

RUN npm install
RUN npm run build:all

EXPOSE 5679 8765
CMD ["npm", "run", "start:loadbalancer"]