import 'reflect-metadata';
import { api } from './api';
import { env } from './env';
import { logger } from './logger';
import('newrelic');

const runningMode = env.APPLICATION.RUNNING_MODE;
import connect from './database/connect';
import { startWorker as startEthWorker } from './workers/eth/EthUpdater';
import ZilUpdater from './workers/ZilUpdater';

connect().then(async () => {
  /**
   * Temporary disable snapshot feature until we implement chain reorg handling functionality.
   * Check the following story and PR for details:
   * - https://www.pivotaltracker.com/n/projects/2463706/stories/178945048
   * - https://github.com/unstoppabledomains/unstoppable-domains-website/pull/2908
   */

  // if (runningMode.includes('LOAD_SNAPSHOT')) {
  //   logger.info('Loading db snapshot');
  //   try {
  //     await loadSnapshot();
  //   } catch (error) {
  //     logger.error(error);
  //     process.exit(1);
  //   }
  //   logger.info('Db snapshot loaded');
  // }

  if (runningMode.includes('ETH_WORKER')) {
    startEthWorker();
    logger.info('ETH worker is enabled and running');
  }

  if (runningMode.includes('ZIL_WORKER')) {
    ZilUpdater();
    logger.info(`ZIL worker is enabled and running`);
  }

  if (runningMode.includes('API')) {
    api.listen(env.APPLICATION.PORT);
    logger.info(`API is enabled and running on port ${env.APPLICATION.PORT}`);
  }
});
