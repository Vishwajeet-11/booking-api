const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use('/', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
