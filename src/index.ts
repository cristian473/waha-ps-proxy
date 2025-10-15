import './pre-start'; // Must be the first import
import logger from 'jet-logger';
import server from './server';

// **** Run **** //

const SERVER_START_MSG = ('Express server started on port: ' + process.env.PORT);

const startServer = async () => {
  try {
    server.listen(process.env.PORT || 8081, () => logger.info(SERVER_START_MSG));
  } catch (error) {
    logger.err('Failed to connect to Redis:', error);
    process.exit(1);
  }
};

startServer();

module.exports = server;

