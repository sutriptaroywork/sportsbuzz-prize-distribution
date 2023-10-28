# Fantasy WL prize distribution
> This project provide better Prize distribution support.

## Requirements  (Prerequisites)
Tools and packages required to successfully install this project.

* Nodejs - 16.13.1 LTS [Install](https://nodejs.org/en/download/)
* NPM - 8.1.2
* Redis - [Install](https://redis.io/download)
* MongoDB - [Install](https://www.mongodb.com/try/download/community)
* SQL - [Install](https://dev.mysql.com/downloads/)

## Cloning Project
`Clone with HTTPS: `
```sh
git clone https://gitlab.com/fantasy-wl/fantasy-prize-distribution.git
```
or 
`Clone with SSH: `
```sh
git@gitlab.com:fantasy-wl/fantasy-prize-distribution.git
```

## Installation and Setup
A step by step list of commands / guide that informs how to install an instance of this project. 

```sh
cd ./fantasy-prize-distribution

npm install
```

## Run Project
Now you're done with setup and install please run your project using this command.

In Development Environment
```sh
npm run dev
```

In Production Environment
```sh
npm run start
```

## Folder Structure
This Project follows four main directories

### config
- In this folder all configuration related to this project goes here.
For e.g.- 
  - config.js -> all environments configuration.
  - dev.js -> dev(Development) environment related configuration goes here.
  - staging.js -> stag(Staging) environment related configuration goes here.
  - production.js -> prod(Production) environment related configuration goes here.
  - test.js -> test(Test) environment related configuration goes here.

### databases
- In this folder all databases related setup for this project goes here.
For e.g.- 
  - mongoose.js -> Mongoose (Mongo DB) connection establishment
  - sequelize.js -> Sequelize (My SQL) connection establishment

### helper
- In this folder all reusable and frequently used functions and services for this project goes here according to different file.
For e.g.- 
  - api.responses.js -> all response status and messages, etc. goes here.
  - redis.js -> all redis configuration and it's services goes here.
  - utillities.services.js -> all common helper services which is frequently used in project goes here.

### middlewares
- In this folder all middleware function and routes defined in this project goes here according to different folder.
For e.g.- 
  - index.js -> all nodejs server related configurations goes here.
  - middleware.js -> all middleware functions goes here.

### models-routes-services
- In this folder all module's models, routes and it's services for this project goes here according to different folder respectively.

## Deployment Notes
Explain how to deploy your project on a live server. To do so include step by step guide will explained in this documentation. 
[While Going Live Docs.](https://docs.google.com/document/d/1kSftEMdaUh3OvKtZfCoVq195uRpPj0oij76Rjo6E-_Q/edit?usp=sharing)

