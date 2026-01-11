/**
 * Confirmation Bus Module
 *
 * Provides async communication for tool confirmations using a
 * request/response pattern with correlation IDs.
 */

export {
  ConfirmationBus,
  createConfirmationBus,
  DEFAULT_CONFIRMATION_TIMEOUT,
  type ConfirmationRequest,
  type ConfirmationResponse,
  type ConfirmationHandler,
} from './messageBus.js';
